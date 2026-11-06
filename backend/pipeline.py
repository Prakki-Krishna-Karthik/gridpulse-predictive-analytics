"""Build compact, reproducible artifacts from the supplied CSV datasets.

The pipeline intentionally uses the standard library so the project can run on a
fresh machine. It performs chronological walk-forward validation for four
forecasting baselines and builds a graph snapshot suitable for the dashboard.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import statistics
from collections import Counter, defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from physics import (
        DEFAULT_CROSS_SECTION_MM2,
        DEFAULT_LINE_VOLTAGE_KV,
        DEFAULT_POWER_FACTOR,
        DEFAULT_RESISTIVITY_OHM_M,
        calculate_distance_loss_proxy,
        haversine_distance_km,
    )
except ImportError:
    from backend.physics import (
        DEFAULT_CROSS_SECTION_MM2,
        DEFAULT_LINE_VOLTAGE_KV,
        DEFAULT_POWER_FACTOR,
        DEFAULT_RESISTIVITY_OHM_M,
        calculate_distance_loss_proxy,
        haversine_distance_km,
    )


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DYNAMIC = Path(
    r"C:\Users\Krishna Karthik\Documents\Codex\2026-10-04\for\work\project_source\Predictive analytics DA\project\dynamic_with_flows.csv"
)
DEFAULT_POWER = Path(
    r"C:\Users\Krishna Karthik\Documents\Codex\2026-10-04\for\work\project_source\Predictive analytics DA\project\power_flow.csv"
)
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"
KEEP_HISTORY = 960
EVAL_HORIZON = 168

MODEL_LABELS = {
    "persistence": "Persistence",
    "moving_average": "24h moving average",
    "linear_trend": "Linear trend",
    "seasonal_naive": "Seasonal naive (24h)",
}


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def as_float(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def quantile(values: list[float], q: float, default: float = 1.0) -> float:
    clean = sorted(abs(v) for v in values if v is not None and math.isfinite(v))
    if not clean:
        return default
    position = (len(clean) - 1) * q
    low = math.floor(position)
    high = math.ceil(position)
    if low == high:
        return clean[low]
    return clean[low] + (clean[high] - clean[low]) * (position - low)


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def safe_div(a: float, b: float) -> float:
    return a / b if b else 0.0


def canonical_edge(source: str, target: str) -> str:
    return "-".join(sorted((source.upper(), target.upper())))


def edge_endpoints(edge_id: str) -> tuple[str, str]:
    a, b = edge_id.split("-", 1)
    return a, b


def class_from_score(score: float) -> str:
    if score >= 85:
        return "Critical"
    if score >= 65:
        return "Warning"
    return "Normal"


def class_from_utilization(utilization: float) -> str:
    if utilization >= 0.9:
        return "Critical"
    if utilization >= 0.75:
        return "Warning"
    return "Normal"


def predict_next(history: list[float], model: str) -> float:
    if not history:
        return 0.0
    if model == "persistence":
        return history[-1]
    if model == "moving_average":
        return mean(history[-24:])
    if model == "seasonal_naive":
        return history[-24] if len(history) >= 24 else history[-1]
    # A small, stable least-squares trend. Clamping prevents runaway extrapolation
    # during a data gap, which is important for operator-facing recommendations.
    window = history[-24:]
    if len(window) < 3:
        return history[-1]
    x_mean = (len(window) - 1) / 2
    y_mean = mean(window)
    denominator = sum((i - x_mean) ** 2 for i in range(len(window)))
    slope = safe_div(sum((i - x_mean) * (y - y_mean) for i, y in enumerate(window)), denominator)
    prediction = y_mean + slope * len(window)
    low = min(window) - 0.15 * max(abs(min(window)), 1.0)
    high = max(window) + 0.15 * max(abs(max(window)), 1.0)
    return max(low, min(high, prediction))


def risk_class_for_value(value: float, warning_limit: float, critical_limit: float) -> str:
    magnitude = abs(value)
    if magnitude >= critical_limit:
        return "Critical"
    if magnitude >= warning_limit:
        return "Warning"
    return "Normal"


def classification_metrics(actual: list[str], predicted: list[str]) -> dict[str, float]:
    labels = ["Normal", "Warning", "Critical"]
    correct = sum(a == p for a, p in zip(actual, predicted))
    per_label = {}
    for label in labels:
        tp = sum(a == label and p == label for a, p in zip(actual, predicted))
        fp = sum(a != label and p == label for a, p in zip(actual, predicted))
        fn = sum(a == label and p != label for a, p in zip(actual, predicted))
        precision = safe_div(tp, tp + fp)
        recall = safe_div(tp, tp + fn)
        f1 = safe_div(2 * precision * recall, precision + recall)
        per_label[label] = {"precision": precision, "recall": recall, "f1": f1}
    return {
        "accuracy": safe_div(correct, len(actual)),
        "precision": mean([per_label[label]["precision"] for label in labels]),
        "recall": mean([per_label[label]["recall"] for label in labels]),
        "f1": mean([per_label[label]["f1"] for label in labels]),
        "per_class": per_label,
    }


def evaluate_models(country_series: dict[str, list[float]]) -> tuple[list[dict], str, list[dict]]:
    results = []
    curves = {model: [] for model in MODEL_LABELS}
    for model in MODEL_LABELS:
        absolute_errors: list[float] = []
        squared_errors: list[float] = []
        percentage_errors: list[float] = []
        actual_classes: list[str] = []
        predicted_classes: list[str] = []
        for _, values in sorted(country_series.items()):
            if len(values) < EVAL_HORIZON + 48:
                continue
            split = len(values) - EVAL_HORIZON
            warning_limit = quantile(values[:split], 0.75)
            critical_limit = quantile(values[:split], 0.90)
            for index in range(split, len(values)):
                history = values[:index]
                actual = values[index]
                prediction = predict_next(history, model)
                error = prediction - actual
                absolute_errors.append(abs(error))
                squared_errors.append(error * error)
                if abs(actual) > 1e-6:
                    percentage_errors.append(abs(error) / abs(actual))
                actual_classes.append(risk_class_for_value(actual, warning_limit, critical_limit))
                predicted_classes.append(risk_class_for_value(prediction, warning_limit, critical_limit))
        classification = classification_metrics(actual_classes, predicted_classes)
        mae = mean(absolute_errors)
        rmse = math.sqrt(mean(squared_errors)) if squared_errors else 0.0
        mape = mean(percentage_errors) if percentage_errors else 0.0
        results.append(
            {
                "model": model,
                "label": MODEL_LABELS[model],
                "target": "country net flow (MW)",
                "mae": mae,
                "rmse": rmse,
                "mape": mape,
                "accuracy": classification["accuracy"],
                "precision": classification["precision"],
                "recall": classification["recall"],
                "f1": classification["f1"],
                "per_class": classification["per_class"],
                "validation": "walk-forward, chronological holdout",
                "n_predictions": len(absolute_errors),
            }
        )
    results.sort(key=lambda item: (item["rmse"], item["mae"]))
    selected = results[0]["model"] if results else "persistence"

    # Diagnostic trace: how the selected model behaves as the chronological
    # training window grows. This is a validation curve, not a neural epoch curve.
    for step in range(8, 25, 2):
        train_days = step * 7
        train_horizon = min(24, max(6, train_days // 7))
        train_errors = []
        validation_errors = []
        for values in country_series.values():
            if len(values) < train_days * 24 + train_horizon + 2:
                continue
            train_end = len(values) - (25 - step) * 24
            train_start = max(0, train_end - train_days * 24)
            train = values[train_start:train_end]
            if len(train) < train_horizon + 24:
                continue
            for i in range(train_horizon, len(train), max(1, len(train) // 12)):
                pred = predict_next(train[:i], selected)
                train_errors.append(abs(pred - train[i]))
            validation = values[train_end : min(len(values), train_end + train_horizon)]
            history = values[:train_end]
            for offset, actual in enumerate(validation):
                pred = predict_next(history[: len(history) + offset], selected)
                validation_errors.append(abs(pred - actual))
        curves[selected].append(
            {
                "window_days": train_days,
                "train_mae": mean(train_errors),
                "validation_mae": mean(validation_errors),
            }
        )
    return results, selected, curves[selected]


def node_score(net_flow: float, flow_capacity: float, imbalance: float, residual: float, load: float) -> float:
    utilization = safe_div(abs(net_flow), max(flow_capacity, 1.0))
    residual_ratio = safe_div(abs(residual), max(abs(load), 1.0))
    return max(0.0, min(100.0, utilization * 75 + min(1.0, abs(imbalance)) * 15 + min(1.0, residual_ratio) * 10))


def build_artifacts(dynamic_path: Path, power_path: Path) -> dict:
    if not dynamic_path.exists():
        raise FileNotFoundError(f"Dynamic CSV not found: {dynamic_path}")
    if not power_path.exists():
        raise FileNotFoundError(f"Power-flow CSV not found: {power_path}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    countries: set[str] = set()
    country_counts: Counter[str] = Counter()
    country_series: dict[str, dict[str, deque]] = defaultdict(lambda: {"load": deque(maxlen=KEEP_HISTORY), "flow": deque(maxlen=KEEP_HISTORY), "times": deque(maxlen=KEEP_HISTORY), "imbalance": deque(maxlen=KEEP_HISTORY), "residual": deque(maxlen=KEEP_HISTORY)})
    country_meta: dict[str, dict] = {}
    country_last_time: dict[str, datetime] = {}
    country_gaps: Counter[str] = Counter()
    dynamic_rows = 0
    dynamic_missing = Counter()
    dynamic_duplicates: Counter[tuple[str, str]] = Counter()
    dynamic_min_time: datetime | None = None
    dynamic_max_time: datetime | None = None

    with dynamic_path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        dynamic_columns = reader.fieldnames or []
        for row in reader:
            dynamic_rows += 1
            country = (row.get("country") or "").strip().upper()
            timestamp = row.get("datetime") or ""
            dt = parse_time(timestamp)
            dynamic_min_time = dt if dynamic_min_time is None or dt < dynamic_min_time else dynamic_min_time
            dynamic_max_time = dt if dynamic_max_time is None or dt > dynamic_max_time else dynamic_max_time
            countries.add(country)
            country_counts[country] += 1
            key = (timestamp, country)
            dynamic_duplicates[key] += 1
            for column, value in row.items():
                if value is None or value.strip() == "":
                    dynamic_missing[column] += 1
            previous = country_last_time.get(country)
            if previous is not None and dt - previous != timedelta(hours=1):
                gap_hours = int((dt - previous).total_seconds() // 3600) - 1
                country_gaps[country] += max(gap_hours, 1)
            country_last_time[country] = dt
            bucket = country_series[country]
            bucket["times"].append(timestamp)
            bucket["load"].append(as_float(row.get("Actual_Total_Load_MW")) or 0.0)
            bucket["flow"].append(as_float(row.get("net_flow")) or 0.0)
            bucket["imbalance"].append(as_float(row.get("flow_imbalance_ratio")) or 0.0)
            bucket["residual"].append(as_float(row.get("load_residual")) or 0.0)
            country_meta[country] = {
                "country": country,
                "latitude": as_float(row.get("latitude")) or 0.0,
                "longitude": as_float(row.get("longitude")) or 0.0,
                "degree_centrality": as_float(row.get("degree_centrality")) or 0.0,
                "closeness_centrality": as_float(row.get("closeness_centrality")) or 0.0,
                "betweenness_centrality": as_float(row.get("betweenness_centrality")) or 0.0,
                "gdp": as_float(row.get("GDP")) or 0.0,
                "population": as_float(row.get("population")) or 0.0,
                "latest": {
                    "timestamp": timestamp,
                    "load_mw": as_float(row.get("Actual_Total_Load_MW")) or 0.0,
                    "forecast_load_mw": as_float(row.get("Day_ahead_Total_Load_Forecast_MW")) or 0.0,
                    "net_flow_mw": as_float(row.get("net_flow")) or 0.0,
                    "flow_imbalance_ratio": as_float(row.get("flow_imbalance_ratio")) or 0.0,
                    "load_residual_mw": as_float(row.get("load_residual")) or 0.0,
                    "air_temp": as_float(row.get("air_temp")) or 0.0,
                    "renewables_mw": sum(as_float(row.get(column)) or 0.0 for column in ("Wind_Offshore_Actual_Aggregated_MW", "Wind_Onshore_Actual_Aggregated_MW", "Solar_Actual_Aggregated_MW")),
                },
            }

    # Read the edge file in a second pass so directional rows can be merged by
    # physical endpoints and aliases can be audited.
    edge_values: dict[str, list[float]] = defaultdict(list)
    edge_series: dict[str, deque] = defaultdict(lambda: deque(maxlen=KEEP_HISTORY))
    edge_latest: dict[str, dict[str, float]] = defaultdict(dict)
    edge_aliases: dict[str, str] = {}
    power_rows = 0
    power_missing = Counter()
    power_duplicates: Counter[tuple[str, str, str, str]] = Counter()
    power_times: list[str] = []
    current_time: str | None = None
    current_flows: dict[str, dict[str, float]] = defaultdict(dict)

    def flush_power_time(time_value: str | None, values: dict[str, dict[str, float]]) -> None:
        if not time_value:
            return
        power_times.append(time_value)
        for edge_id, directional in values.items():
            a, b = edge_endpoints(edge_id)
            forward = directional.get(f"{a}->{b}", 0.0)
            reverse = directional.get(f"{b}->{a}", 0.0)
            net = forward - reverse
            magnitude = max(abs(forward), abs(reverse), abs(net))
            edge_values[edge_id].append(magnitude)
            edge_series[edge_id].append({"timestamp": time_value, "net_mw": net, "forward_mw": forward, "reverse_mw": reverse, "magnitude_mw": magnitude})

    with power_path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        power_columns = reader.fieldnames or []
        for row in reader:
            power_rows += 1
            timestamp = row.get("datetime") or ""
            if current_time is not None and timestamp != current_time:
                flush_power_time(current_time, current_flows)
                current_flows = defaultdict(dict)
            current_time = timestamp
            source = (row.get("source") or "").strip().upper()
            target = (row.get("target") or "").strip().upper()
            raw_edge = (row.get("interconnector") or "").strip().upper()
            edge_id = canonical_edge(source, target)
            edge_aliases[raw_edge] = edge_id
            current_flows[edge_id][f"{source}->{target}"] = as_float(row.get("power_flow_mw")) or 0.0
            power_duplicates[(timestamp, raw_edge, source, target)] += 1
            for column, value in row.items():
                if value is None or value.strip() == "":
                    power_missing[column] += 1
        flush_power_time(current_time, current_flows)

    unique_power_times = sorted(set(power_times))
    latest_timestamp = max((meta["latest"]["timestamp"] for meta in country_meta.values()), default="")
    for edge_id, series in edge_series.items():
        if series:
            latest = series[-1]
            edge_latest[edge_id] = latest

    edge_meta: dict[str, dict] = {}
    for edge_id in sorted(edge_values):
        a, b = edge_endpoints(edge_id)
        capacity_proxy = max(quantile(edge_values[edge_id], 0.95), 1.0)
        a_meta = country_meta.get(a, {})
        b_meta = country_meta.get(b, {})
        distance_km = haversine_distance_km(a_meta.get("latitude", 0.0), a_meta.get("longitude", 0.0), b_meta.get("latitude", 0.0), b_meta.get("longitude", 0.0))
        latest = edge_latest.get(edge_id, {"timestamp": latest_timestamp, "net_mw": 0.0, "forward_mw": 0.0, "reverse_mw": 0.0, "magnitude_mw": 0.0})
        loss_proxy = calculate_distance_loss_proxy(latest.get("magnitude_mw", 0.0), distance_km)
        edge_meta[edge_id] = {
            "id": edge_id,
            "source": a,
            "target": b,
            "capacity_proxy_mw": capacity_proxy,
            "capacity_proxy_basis": "95th percentile of observed directional flow magnitude",
            "distance_km": distance_km,
            "resistance_ohm": loss_proxy["resistance_ohm"],
            "estimated_loss_mw": loss_proxy["loss_mw"],
            "loss_pct_of_flow": loss_proxy["loss_pct_of_flow"],
            "loss_method": loss_proxy["loss_method"],
            "loss_assumptions": loss_proxy["assumptions"],
            "latest": latest,
        }

    net_flow_series = {country: list(bucket["flow"]) for country, bucket in country_series.items()}
    model_metrics, selected_model, validation_curve = evaluate_models(net_flow_series)
    model_data = {
        "selected_model": selected_model,
        "selected_label": MODEL_LABELS[selected_model],
        "selection_rule": "lowest pooled RMSE on chronological walk-forward holdout",
        "metrics": model_metrics,
        "validation_curve": validation_curve,
        "note": "Classical baselines are used because this dataset has no ground-truth engineering labels or complete line parameters. A GNN can be added after a leakage-safe benchmark is established.",
    }

    # Compact aligned history for the UI and API.
    history_times = sorted(set(
        timestamp
        for bucket in country_series.values()
        for timestamp in bucket["times"]
    ))[-KEEP_HISTORY:]
    country_artifacts = {}
    for country in sorted(countries):
        bucket = country_series[country]
        country_artifacts[country] = {
            "timestamps": list(bucket["times"]),
            "load_mw": list(bucket["load"]),
            "net_flow_mw": list(bucket["flow"]),
            "flow_imbalance_ratio": list(bucket["imbalance"]),
            "load_residual_mw": list(bucket["residual"]),
        }
    edge_artifacts = {edge_id: list(edge_series[edge_id]) for edge_id in sorted(edge_series)}

    nodes = []
    for country in sorted(countries):
        meta = country_meta[country]
        flow_values = list(country_series[country]["flow"])
        capacity = max(quantile(flow_values, 0.95), 1.0)
        latest = meta["latest"]
        score = node_score(latest["net_flow_mw"], capacity, latest["flow_imbalance_ratio"], latest["load_residual_mw"], latest["load_mw"])
        nodes.append({
            **{key: meta[key] for key in ("country", "latitude", "longitude", "degree_centrality", "closeness_centrality", "betweenness_centrality", "population")},
            "flow_capacity_proxy_mw": capacity,
            "risk_score": score,
            "risk_class": class_from_score(score),
            **latest,
        })

    edges = []
    for edge_id, meta in edge_meta.items():
        latest = meta["latest"]
        utilization = safe_div(latest.get("magnitude_mw", 0.0), meta["capacity_proxy_mw"])
        risk_score = min(100.0, utilization * 100)
        edges.append({
            **meta,
            "flow_mw": latest.get("net_mw", 0.0),
            "magnitude_mw": latest.get("magnitude_mw", 0.0),
            "utilization": utilization,
            "risk_score": risk_score,
            "risk_class": class_from_utilization(utilization),
            "direction": f"{meta['source']} → {meta['target']}" if latest.get("net_mw", 0.0) >= 0 else f"{meta['target']} → {meta['source']}",
        })

    quality = {
        "dynamic_missing_cells": sum(dynamic_missing.values()),
        "power_missing_cells": sum(power_missing.values()),
        "dynamic_duplicate_keys": sum(1 for count in dynamic_duplicates.values() if count > 1),
        "power_duplicate_keys": sum(1 for count in power_duplicates.values() if count > 1),
        "country_timestamp_gaps": dict(country_gaps),
        "country_timestamp_gap_total": sum(country_gaps.values()),
        "known_country_codes": sorted(countries),
        "invalid_country_codes": [],
        "normalized_interconnector_aliases": [
            {"raw": raw, "canonical": canonical}
            for raw, canonical in sorted(edge_aliases.items())
            if raw != canonical
        ],
        "physical_loss": {
            "status": "proxy_estimate",
            "label": "simplified distance-based three-phase loss proxy",
            "engineering_grade": "unavailable",
            "missing_parameters": ["actual line route geometry", "actual conductor material", "actual cross-section", "actual voltage", "actual power factor", "actual thermal capacity"],
            "assumptions": {
                "line_voltage_kv": DEFAULT_LINE_VOLTAGE_KV,
                "power_factor": DEFAULT_POWER_FACTOR,
                "resistivity_ohm_m": DEFAULT_RESISTIVITY_OHM_M,
                "cross_section_mm2": DEFAULT_CROSS_SECTION_MM2,
                "distance_method": "Haversine distance between country-centroid coordinates",
            },
            "formula": "R = rho*L/A; S = |P|/pf; I = S/(sqrt(3)*V); P_loss = 3I^2R",
            "proxy_label": "distance-based flow loss estimate; engineering validation required",
        },
        "power_balance_check": {
            "status": "proxy_only",
            "label": "available net-flow and directional-flow sign conventions require operator confirmation",
            "method": "compare node net_flow against reconstructed edge balance after canonicalization",
        },
        "assumptions": [
            "Interconnector aliases are merged using source/target endpoints.",
            "A capacity proxy is the 95th percentile observed directional flow magnitude; it is not an engineering thermal rating.",
            "Risk is a screening score for prioritization, not a security assessment.",
            "Forecast evaluation is chronological and walk-forward to avoid future-data leakage.",
            "Distance-based losses use centroid geodesics and assumed conductor constants; they are not engineering-grade line studies.",
        ],
    }

    manifest = {
        "generated_at": iso(datetime.now(timezone.utc)),
        "sources": {"dynamic_csv": str(dynamic_path), "power_flow_csv": str(power_path)},
        "dataset": {
            "dynamic_rows": dynamic_rows,
            "power_rows": power_rows,
            "dynamic_columns": dynamic_columns,
            "power_columns": power_columns,
            "countries": sorted(countries),
            "edge_count": len(edges),
            "date_min": iso(dynamic_min_time) if dynamic_min_time else "",
            "date_max": iso(dynamic_max_time) if dynamic_max_time else latest_timestamp,
            "history_points": len(history_times),
        },
        "quality": quality,
        "graph": {"nodes": nodes, "edges": edges},
    }

    snapshot = {
        "timestamp": latest_timestamp,
        "nodes": nodes,
        "edges": edges,
        "selected_model": MODEL_LABELS[selected_model],
        "data_quality": quality,
    }

    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (OUTPUT_DIR / "series.json").write_text(json.dumps({"timestamps": history_times, "countries": country_artifacts, "edges": edge_artifacts}, separators=(",", ":")), encoding="utf-8")
    (OUTPUT_DIR / "model_metrics.json").write_text(json.dumps(model_data, indent=2), encoding="utf-8")
    (OUTPUT_DIR / "snapshot.json").write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    return {"manifest": manifest, "model_data": model_data, "snapshot": snapshot}


def main() -> None:
    parser = argparse.ArgumentParser(description="Build GridPulse processed artifacts")
    parser.add_argument("--dynamic", type=Path, default=Path(os.environ.get("DYNAMIC_CSV", DEFAULT_DYNAMIC)))
    parser.add_argument("--power", type=Path, default=Path(os.environ.get("POWER_FLOW_CSV", DEFAULT_POWER)))
    args = parser.parse_args()
    result = build_artifacts(args.dynamic, args.power)
    print(json.dumps({
        "processed_dir": str(OUTPUT_DIR),
        "countries": result["manifest"]["dataset"]["countries"],
        "edges": result["manifest"]["dataset"]["edge_count"],
        "selected_model": result["model_data"]["selected_label"],
        "dynamic_rows": result["manifest"]["dataset"]["dynamic_rows"],
        "power_rows": result["manifest"]["dataset"]["power_rows"],
    }, indent=2))


if __name__ == "__main__":
    main()
