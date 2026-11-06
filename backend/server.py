"""Local API and static server for GridPulse.

Run with: python backend/server.py
Then open http://localhost:8000.
"""

from __future__ import annotations

import json
import math
import threading
import time
from collections import deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    import numpy as np
    import torch
    try:
        from experiments import DCRNN, FusionGRU, build_feature_tensor, build_transition_matrices, make_global_samples, make_samples, standardize, standardize_global
    except ImportError:
        from backend.experiments import DCRNN, FusionGRU, build_feature_tensor, build_transition_matrices, make_global_samples, make_samples, standardize, standardize_global
    RESEARCH_IMPORT_ERROR = None
except Exception as error:  # Keep the lightweight dashboard available without research dependencies.
    np = None
    torch = None
    FusionGRU = None
    DCRNN = None
    build_feature_tensor = None
    build_transition_matrices = None
    make_global_samples = None
    make_samples = None
    standardize = None
    standardize_global = None
    RESEARCH_IMPORT_ERROR = str(error)

try:
    from physics import calculate_distance_loss_proxy, calculate_three_phase_loss
    from routing import plan_reroute
    from graph_analysis import analyze_snapshot, build_graph_context
except ImportError:  # Supports `python -m backend.server` as well as the README command.
    from backend.physics import calculate_distance_loss_proxy, calculate_three_phase_loss
    from backend.routing import plan_reroute
    from backend.graph_analysis import analyze_snapshot, build_graph_context


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT / "frontend"
PROCESSED_DIR = ROOT / "data" / "processed"
RESULTS_DIR = ROOT / "results"
PORT = 8000


def load_json(name: str):
    path = PROCESSED_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run: python backend/pipeline.py")
    return json.loads(path.read_text(encoding="utf-8"))


def load_optional_result(name: str, default):
    path = RESULTS_DIR / name
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


MANIFEST = load_json("manifest.json")
SERIES = load_json("series.json")
MODEL_DATA = load_json("model_metrics.json")
RESEARCH_DATA = load_optional_result("model_comparison.json", {"models": [], "research_winner": None})
SNAPSHOT = load_json("snapshot.json")
GRAPH_CONTEXT = build_graph_context(MANIFEST["graph"])
TIMESTAMPS = SERIES["timestamps"]
COUNTRY_INDEX = {
    country: {timestamp: index for index, timestamp in enumerate(data["timestamps"])}
    for country, data in SERIES["countries"].items()
}
STREAM_STATE = {"cursor": max(len(TIMESTAMPS) - 1, 0)}
STREAM_LOCK = threading.Lock()


def load_research_runtime() -> dict:
    """Load the trained Fusion GRU, DCRNN and exact training-time scaling.

    The dashboard keeps Persistence and the other classical baselines available,
    but both neural models are real checkpoint-backed inference paths.  The feature
    tensor and chronological training split are rebuilt from the same processed
    artifacts used by backend/experiments.py, so the runtime does not invent a
    different feature order or normalization scheme.
    """

    checkpoint_path = RESULTS_DIR / "models" / "fusion_gru.pt"
    if torch is None or np is None or not checkpoint_path.exists():
        return {"available": False, "model": None, "reason": RESEARCH_IMPORT_ERROR or f"Missing {checkpoint_path}"}
    try:
        features, targets, countries, timestamps = build_feature_tensor(SERIES, MANIFEST)
        train_x, train_y, val_x, val_y, test_x, test_y, _ = make_samples(features, targets, countries, timestamps)
        _, _, _, _, _, _, x_mean, x_std, y_mean, y_std = standardize(
            train_x, val_x, test_x, train_y, val_y, test_y
        )
        model = FusionGRU(input_size=features.shape[-1], hidden_size=32)
        try:
            checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        except TypeError:
            checkpoint = torch.load(checkpoint_path, map_location="cpu")
        model.load_state_dict(checkpoint["state_dict"])
        model.eval()
        dcrnn_runtime = None
        dcrnn_checkpoint_path = RESULTS_DIR / "models" / "dcrnn.pt"
        if dcrnn_checkpoint_path.exists():
            global_train_x, global_train_y, global_val_x, global_val_y, global_test_x, global_test_y, _ = make_global_samples(features, targets, timestamps)
            _, _, _, _, _, _, gx_mean, gx_std, gy_mean, gy_std = standardize_global(
                global_train_x, global_val_x, global_test_x, global_train_y, global_val_y, global_test_y
            )
            transitions = build_transition_matrices(MANIFEST, countries)
            dcrnn_model = DCRNN(global_train_x.shape[-1], hidden_size=24, transitions=transitions, diffusion_steps=2)
            try:
                dcrnn_checkpoint = torch.load(dcrnn_checkpoint_path, map_location="cpu", weights_only=False)
            except TypeError:
                dcrnn_checkpoint = torch.load(dcrnn_checkpoint_path, map_location="cpu")
            dcrnn_model.load_state_dict(dcrnn_checkpoint["state_dict"])
            dcrnn_model.eval()
            dcrnn_runtime = {
                "model": dcrnn_model,
                "x_mean": gx_mean.astype(np.float32),
                "x_std": gx_std.astype(np.float32),
                "y_mean": float(gy_mean),
                "y_std": float(gy_std),
                "checkpoint": str(dcrnn_checkpoint_path),
            }
        return {
            "available": True,
            "model": model,
            "dcrnn": dcrnn_runtime,
            "features": features.astype(np.float32),
            "countries": countries,
            "timestamps": timestamps,
            "x_mean": x_mean.astype(np.float32),
            "x_std": x_std.astype(np.float32),
            "y_mean": float(y_mean),
            "y_std": float(y_std),
            "checkpoint": str(checkpoint_path),
            "reason": "trained Fusion GRU checkpoint loaded",
        }
    except Exception as error:
        return {"available": False, "model": None, "reason": f"Fusion GRU load failed: {error}"}


RESEARCH_RUNTIME = load_research_runtime()


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def standard_deviation(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    average = mean(values)
    return math.sqrt(sum((value - average) ** 2 for value in values) / (len(values) - 1))


def quantile(values: list[float], q: float, default: float = 1.0) -> float:
    values = sorted(abs(value) for value in values if math.isfinite(value))
    if not values:
        return default
    position = (len(values) - 1) * q
    low = math.floor(position)
    high = math.ceil(position)
    if low == high:
        return values[low]
    return values[low] + (values[high] - values[low]) * (position - low)


def risk_class(score: float) -> str:
    if score >= 85:
        return "Critical"
    if score >= 65:
        return "Warning"
    return "Normal"


def edge_class(utilization: float) -> str:
    if utilization >= 0.9:
        return "Critical"
    if utilization >= 0.75:
        return "Warning"
    return "Normal"


def get_country_value(country: str, timestamp: str, field: str) -> float:
    data = SERIES["countries"].get(country)
    if not data or not data[field]:
        return 0.0
    index = COUNTRY_INDEX[country].get(timestamp)
    if index is None:
        # A short missing interval uses the most recent observed value. The
        # quality panel still exposes the gap so the substitution is visible.
        index = min(len(data[field]) - 1, len(data[field]) - 1)
    return float(data[field][index])


def snapshot_at(index: int | None = None) -> dict:
    if not TIMESTAMPS:
        return SNAPSHOT
    if index is None:
        with STREAM_LOCK:
            index = STREAM_STATE["cursor"]
    index = int(clamp(index, 0, len(TIMESTAMPS) - 1))
    timestamp = TIMESTAMPS[index]
    base_nodes = {node["country"]: node for node in MANIFEST["graph"]["nodes"]}
    nodes = []
    for country, base in sorted(base_nodes.items()):
        data = SERIES["countries"].get(country, {})
        country_idx = COUNTRY_INDEX.get(country, {}).get(timestamp)
        if country_idx is None:
            country_idx = max(0, min(index, len(data.get("load_mw", [0])) - 1))
        load = float(data.get("load_mw", [0])[country_idx]) if data.get("load_mw") else 0.0
        flow = float(data.get("net_flow_mw", [0])[country_idx]) if data.get("net_flow_mw") else 0.0
        imbalance = float(data.get("flow_imbalance_ratio", [0])[country_idx]) if data.get("flow_imbalance_ratio") else 0.0
        residual = float(data.get("load_residual_mw", [0])[country_idx]) if data.get("load_residual_mw") else 0.0
        capacity = max(float(base.get("flow_capacity_proxy_mw", 1.0)), 1.0)
        score = clamp(abs(flow) / capacity * 75 + min(1.0, abs(imbalance)) * 15 + min(1.0, abs(residual) / max(abs(load), 1.0)) * 10, 0, 100)
        nodes.append({
            **base,
            "timestamp": timestamp,
            "load_mw": load,
            "net_flow_mw": flow,
            "flow_imbalance_ratio": imbalance,
            "load_residual_mw": residual,
            "risk_score": score,
            "risk_class": risk_class(score),
        })
    edges = []
    for base in MANIFEST["graph"]["edges"]:
        edge_id = base["id"]
        series = SERIES["edges"].get(edge_id, [])
        edge_point = series[min(index, len(series) - 1)] if series else {}
        magnitude = float(edge_point.get("magnitude_mw", 0.0))
        net = float(edge_point.get("net_mw", 0.0))
        utilization = magnitude / max(float(base.get("capacity_proxy_mw", 1.0)), 1.0)
        edges.append({
            **base,
            "timestamp": timestamp,
            "flow_mw": net,
            "magnitude_mw": magnitude,
            "current_loss_mw": calculate_distance_loss_proxy(magnitude, float(base.get("distance_km", 0.0)))["loss_mw"] if magnitude and base.get("distance_km") else 0.0,
            "current_loss_pct_of_flow": calculate_distance_loss_proxy(magnitude, float(base.get("distance_km", 0.0)))["loss_pct_of_flow"] if magnitude and base.get("distance_km") else 0.0,
            "utilization": utilization,
            "risk_score": clamp(utilization * 100, 0, 100),
            "risk_class": edge_class(utilization),
            "direction": f"{base['source']} → {base['target']}" if net >= 0 else f"{base['target']} → {base['source']}",
        })
    graph_signal = analyze_snapshot(nodes, edges, GRAPH_CONTEXT)
    return {
        "timestamp": timestamp,
        "index": index,
        "total_flow_mw": sum(edge["magnitude_mw"] for edge in edges),
        "nodes": nodes,
        "edges": edges,
        "graph_analysis": graph_signal,
        "selected_model": MODEL_DATA["selected_label"],
        "data_quality": MANIFEST["quality"],
    }


def model_predict(history: list[float], model: str) -> float:
    if not history:
        return 0.0
    if model == "persistence":
        return history[-1]
    if model == "moving_average":
        return mean(history[-24:])
    if model == "seasonal_naive":
        return history[-24] if len(history) >= 24 else history[-1]
    window = history[-24:]
    if len(window) < 3:
        return history[-1]
    x_mean = (len(window) - 1) / 2
    y_mean = mean(window)
    denominator = sum((i - x_mean) ** 2 for i in range(len(window)))
    slope = sum((i - x_mean) * (value - y_mean) for i, value in enumerate(window)) / max(denominator, 1)
    candidate = y_mean + slope * len(window)
    return clamp(candidate, min(window) - 0.15 * max(abs(min(window)), 1), max(window) + 0.15 * max(abs(max(window)), 1))


def fusion_gru_predict(window: np.ndarray) -> float:
    """Run one real Fusion GRU inference step and invert target scaling."""

    runtime = RESEARCH_RUNTIME
    normalized = (window.astype(np.float32) - runtime["x_mean"]) / runtime["x_std"]
    with torch.no_grad():
        prediction = runtime["model"](torch.from_numpy(normalized[None, ...])).cpu().numpy()[0]
    return float(prediction * runtime["y_std"] + runtime["y_mean"])


def fusion_gru_forecast(country: str, horizon: int) -> dict:
    """Generate a recursive forecast from the trained Fusion GRU checkpoint.

    The model predicts net flow. For later steps the predicted local net-flow
    feature is fed back into the next 24-hour window; unavailable future
    exogenous features remain at their latest observed values.
    """

    runtime = RESEARCH_RUNTIME
    if not runtime.get("available"):
        raise RuntimeError(f"Fusion GRU runtime unavailable: {runtime.get('reason', 'unknown error')}")
    country_index = runtime["countries"].index(country)
    window = runtime["features"][country_index, -24:, :].copy()
    data = SERIES["countries"][country]
    timestamps = data["timestamps"][-48:]
    load_history = [float(value) for value in data["load_mw"][-48:]]
    flow_history = [float(value) for value in data["net_flow_mw"][-48:]]
    last_time = timestamps[-1] if timestamps else TIMESTAMPS[-1]
    from datetime import datetime, timedelta, timezone
    current = datetime.fromisoformat(last_time.replace("Z", "+00:00"))
    residual_std = max(standard_deviation(data["load_residual_mw"][-48:]), 1.0)
    flow_std = max(standard_deviation(flow_history), 1.0)
    future = []
    load_working = list(load_history)
    for step in range(1, horizon + 1):
        flow_prediction = fusion_gru_predict(window)
        next_row = window[-1].copy()
        next_row[0] = flow_prediction
        window = np.vstack([window[1:], next_row]).astype(np.float32)
        load_prediction = model_predict(load_working, "persistence")
        load_working.append(load_prediction)
        current += timedelta(hours=1)
        band_scale = math.sqrt(step)
        future.append({
            "timestamp": current.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "load_mw": load_prediction,
            "flow_mw": flow_prediction,
            "load_lower_mw": load_prediction - residual_std * band_scale,
            "load_upper_mw": load_prediction + residual_std * band_scale,
            "flow_lower_mw": flow_prediction - flow_std * band_scale,
            "flow_upper_mw": flow_prediction + flow_std * band_scale,
        })
    return {
        "country": country,
        "model": "fusion_gru",
        "model_label": "Fusion GRU · PyTorch checkpoint",
        "engine": "trained_checkpoint",
        "checkpoint": runtime["checkpoint"],
        "exogenous_policy": "latest observed non-flow features held for recursive horizon",
        "horizon_hours": horizon,
        "history": [{"timestamp": timestamp, "load_mw": load, "flow_mw": flow} for timestamp, load, flow in zip(timestamps, load_history, flow_history)],
        "forecast": future,
        "uncertainty": "adaptive residual bands; not a calibrated probability interval",
    }


def dcrnn_predict(window: np.ndarray) -> np.ndarray:
    """Run one real graph-wide DCRNN inference step."""

    runtime = RESEARCH_RUNTIME
    dcrnn = runtime["dcrnn"]
    normalized = (window.astype(np.float32) - dcrnn["x_mean"]) / dcrnn["x_std"]
    with torch.no_grad():
        prediction = dcrnn["model"](torch.from_numpy(normalized[None, ...])).cpu().numpy()[0]
    return prediction * dcrnn["y_std"] + dcrnn["y_mean"]


def dcrnn_forecast(country: str, horizon: int) -> dict:
    """Generate a recursive graph-wide forecast from the DCRNN checkpoint."""

    runtime = RESEARCH_RUNTIME
    if not runtime.get("dcrnn"):
        raise RuntimeError("DCRNN runtime unavailable: checkpoint or graph model could not be loaded")
    country_index = runtime["countries"].index(country)
    feature_window = runtime["features"][:, -24:, :].copy()
    data = SERIES["countries"][country]
    timestamps = data["timestamps"][-48:]
    load_history = [float(value) for value in data["load_mw"][-48:]]
    flow_history = [float(value) for value in data["net_flow_mw"][-48:]]
    last_time = timestamps[-1] if timestamps else TIMESTAMPS[-1]
    from datetime import datetime, timedelta, timezone
    current = datetime.fromisoformat(last_time.replace("Z", "+00:00"))
    residual_std = max(standard_deviation(data["load_residual_mw"][-48:]), 1.0)
    flow_std = max(standard_deviation(flow_history), 1.0)
    future = []
    load_working = list(load_history)
    for step in range(1, horizon + 1):
        node_prediction = dcrnn_predict(np.transpose(feature_window, (1, 0, 2)))
        flow_prediction = float(node_prediction[country_index])
        next_rows = feature_window[:, -1, :].copy()
        next_rows[:, 0] = node_prediction
        next_rows[:, 4] = float(np.mean(node_prediction))
        next_rows[:, 5] = float(np.mean(next_rows[:, 1]))
        next_rows[:, 6] = float(np.mean(np.abs(next_rows[:, 2])))
        next_rows[:, 7] = float(np.mean(np.abs(next_rows[:, 3])))
        feature_window = np.concatenate([feature_window[:, 1:, :], next_rows[:, None, :]], axis=1).astype(np.float32)
        load_prediction = model_predict(load_working, "persistence")
        load_working.append(load_prediction)
        current += timedelta(hours=1)
        band_scale = math.sqrt(step)
        future.append({
            "timestamp": current.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "load_mw": load_prediction,
            "flow_mw": flow_prediction,
            "load_lower_mw": load_prediction - residual_std * band_scale,
            "load_upper_mw": load_prediction + residual_std * band_scale,
            "flow_lower_mw": flow_prediction - flow_std * band_scale,
            "flow_upper_mw": flow_prediction + flow_std * band_scale,
        })
    return {
        "country": country,
        "model": "dcrnn",
        "model_label": "DCRNN · PyTorch checkpoint",
        "engine": "trained_checkpoint",
        "checkpoint": runtime["dcrnn"]["checkpoint"],
        "exogenous_policy": "latest observed non-flow features held; graph-wide net flow updated recursively",
        "horizon_hours": horizon,
        "history": [{"timestamp": timestamp, "load_mw": load, "flow_mw": flow} for timestamp, load, flow in zip(timestamps, load_history, flow_history)],
        "forecast": future,
        "uncertainty": "adaptive residual bands; not a calibrated probability interval",
    }


def forecast(country: str, model: str | None, horizon: int) -> dict:
    country = country.upper()
    if country not in SERIES["countries"]:
        raise ValueError(f"Unknown country: {country}")
    model = model or MODEL_DATA["selected_model"]
    available_models = {item["model"] for item in MODEL_DATA["metrics"]} | {"fusion_gru", "dcrnn"}
    if model not in available_models:
        model = MODEL_DATA["selected_model"]
    horizon = int(clamp(horizon, 1, 48))
    if model == "fusion_gru":
        return fusion_gru_forecast(country, horizon)
    if model == "dcrnn":
        return dcrnn_forecast(country, horizon)
    data = SERIES["countries"][country]
    timestamps = data["timestamps"][-48:]
    load_history = [float(value) for value in data["load_mw"][-48:]]
    flow_history = [float(value) for value in data["net_flow_mw"][-48:]]
    load_working = list(load_history)
    flow_working = list(flow_history)
    last_time = timestamps[-1] if timestamps else TIMESTAMPS[-1]
    from datetime import datetime, timedelta, timezone
    current = datetime.fromisoformat(last_time.replace("Z", "+00:00"))
    residual_std = max(standard_deviation(data["load_residual_mw"][-48:]), 1.0)
    flow_std = max(standard_deviation(flow_history), 1.0)
    future = []
    for step in range(1, horizon + 1):
        load_prediction = model_predict(load_working, model)
        flow_prediction = model_predict(flow_working, model)
        load_working.append(load_prediction)
        flow_working.append(flow_prediction)
        current += timedelta(hours=1)
        band_scale = math.sqrt(step)
        future.append({
            "timestamp": current.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "load_mw": load_prediction,
            "flow_mw": flow_prediction,
            "load_lower_mw": load_prediction - residual_std * band_scale,
            "load_upper_mw": load_prediction + residual_std * band_scale,
            "flow_lower_mw": flow_prediction - flow_std * band_scale,
            "flow_upper_mw": flow_prediction + flow_std * band_scale,
        })
    return {
        "country": country,
        "model": model,
        "model_label": next(item["label"] for item in MODEL_DATA["metrics"] if item["model"] == model),
        "engine": "deterministic_baseline",
        "horizon_hours": horizon,
        "history": [{"timestamp": timestamp, "load_mw": load, "flow_mw": flow} for timestamp, load, flow in zip(timestamps, load_history, flow_history)],
        "forecast": future,
        "uncertainty": "adaptive residual bands; not a calibrated probability interval",
    }


def recommendations(snapshot: dict) -> list[dict]:
    recommendations = []
    confidence_base = 0.84 if MANIFEST["quality"]["country_timestamp_gap_total"] else 0.92
    for edge in sorted(snapshot["edges"], key=lambda item: item["risk_score"], reverse=True)[:4]:
        if edge["risk_class"] == "Normal":
            continue
        priority = "P1" if edge["risk_class"] == "Critical" else "P2"
        headroom = max(edge["capacity_proxy_mw"] - edge["magnitude_mw"], 0.0)
        recommendations.append({
            "priority": priority,
            "target": edge["id"],
            "target_type": "interconnector",
            "action": "Test a transfer reduction and evaluate an alternate route.",
            "expected_effect": f"Screening scenario: {headroom:,.0f} MW proxy headroom before the observed envelope is reached.",
            "reason": f"{edge['direction']} is at {edge['utilization'] * 100:.0f}% of its observed-flow proxy envelope.",
            "confidence": round(confidence_base * (0.92 if edge["risk_class"] == "Critical" else 0.82), 2),
            "required_validation_checks": ["Confirm thermal rating", "Run N-1 study", "Validate sign convention", "Check alternate-route headroom"],
        })
    for node in sorted(snapshot["nodes"], key=lambda item: item["risk_score"], reverse=True)[:3]:
        if node["risk_class"] == "Normal":
            continue
        recommendations.append({
            "priority": "P1" if node["risk_class"] == "Critical" else "P2",
            "target": node["country"],
            "target_type": "country node",
            "action": "Review the node and its connected interconnectors before the next dispatch window.",
            "expected_effect": "Reduce uncertainty around a concentrated flow or load-residual signal.",
            "reason": f"Node screening score is {node['risk_score']:.0f}/100 with {node['load_mw']:,.0f} MW load.",
            "confidence": round(confidence_base * 0.8, 2),
            "required_validation_checks": ["Confirm missing-hour coverage", "Check neighboring forecasts", "Review renewable availability"],
        })
    if not recommendations:
        recommendations.append({
            "priority": "P3",
            "target": "Network",
            "target_type": "network",
            "action": "Collect engineering line parameters and keep the replay under observation.",
            "expected_effect": "Replace the flow proxy with defensible physical loading and loss calculations.",
            "reason": "No node or link crossed the dashboard screening thresholds at this time.",
            "confidence": 0.78,
            "required_validation_checks": ["Add voltage", "Add resistance", "Add line length", "Add power factor", "Add thermal capacity"],
        })
    return recommendations[:6]


def what_if(payload: dict) -> dict:
    edge_id = str(payload.get("edge_id", "")).upper().replace("_", "-")
    reduction = clamp(float(payload.get("reduction_pct", 10)), 0, 60)
    snapshot = snapshot_at()
    edge = next((item for item in snapshot["edges"] if item["id"] == edge_id), None)
    if edge is None:
        raise ValueError(f"Unknown edge: {edge_id}")
    projected_magnitude = edge["magnitude_mw"] * (1 - reduction / 100)
    projected_utilization = projected_magnitude / max(edge["capacity_proxy_mw"], 1.0)
    projected_class = edge_class(projected_utilization)
    route_plan = plan_reroute(snapshot["edges"], edge_id, reduction)
    impacted = []
    for node in snapshot["nodes"]:
        if node["country"] in (edge["source"], edge["target"]):
            projected_score = clamp(node["risk_score"] - reduction * 0.35, 0, 100)
            impacted.append({"country": node["country"], "baseline_score": node["risk_score"], "projected_score": projected_score, "projected_class": risk_class(projected_score)})
    alternate = []
    for candidate in snapshot["edges"]:
        if candidate["id"] == edge_id:
            continue
        if candidate["source"] in (edge["source"], edge["target"]) or candidate["target"] in (edge["source"], edge["target"]):
            alternate.append({"edge_id": candidate["id"], "headroom_mw": max(candidate["capacity_proxy_mw"] - candidate["magnitude_mw"], 0.0), "risk_class": candidate["risk_class"]})
    alternate.sort(key=lambda item: item["headroom_mw"], reverse=True)
    return {
        "edge_id": edge_id,
        "reduction_pct": reduction,
        "baseline": {"magnitude_mw": edge["magnitude_mw"], "utilization": edge["utilization"], "risk_class": edge["risk_class"]},
        "projected": {"magnitude_mw": projected_magnitude, "utilization": projected_utilization, "risk_class": projected_class},
        "proxy_flow_magnitude_delta_mw": projected_magnitude - edge["magnitude_mw"],
        "impacted_nodes": impacted,
        "alternate_route_candidates": alternate[:4],
        "route_plan": route_plan,
        "loss_status": MANIFEST["quality"]["physical_loss"],
        "guardrail": "Recommendation only. Validate with engineering limits and an N-1 study before operational use.",
    }


class Handler(SimpleHTTPRequestHandler):
    server_version = "GridPulse/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, payload: dict, status: int = 200):
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        try:
            if path == "/api/health":
                with STREAM_LOCK:
                    cursor = STREAM_STATE["cursor"]
                self.send_json({"status": "ok", "service": "gridpulse-api", "version": "1.0.0", "replay_cursor": cursor, "replay_timestamp": TIMESTAMPS[cursor] if TIMESTAMPS else None, "generated_at": MANIFEST["generated_at"]})
                return
            if path == "/api/metadata":
                self.send_json(MANIFEST)
                return
            if path == "/api/topology":
                self.send_json(snapshot_at(int(query.get("index", [STREAM_STATE["cursor"]])[0])))
                return
            if path == "/api/snapshot":
                self.send_json(snapshot_at(int(query.get("index", [STREAM_STATE["cursor"]])[0])))
                return
            if path == "/api/metrics":
                self.send_json({
                    **MODEL_DATA,
                    "research_models": RESEARCH_DATA.get("models", []),
                    "research_winner": RESEARCH_DATA.get("research_winner"),
                    "research_selection_rule": RESEARCH_DATA.get("selection_rule"),
                    "runtime_models": [model_name for model_name, available in (("fusion_gru", RESEARCH_RUNTIME.get("available")), ("dcrnn", bool(RESEARCH_RUNTIME.get("dcrnn")))) if available],
                })
                return
            if path == "/api/validation":
                self.send_json({"quality": MANIFEST["quality"], "dataset": MANIFEST["dataset"], "assumptions": MANIFEST["quality"]["assumptions"]})
                return
            if path == "/api/physical-loss":
                # The browser can call this endpoint once engineering parameters
                # are supplied. Missing inputs remain an explicit unavailable state.
                payload = {key: query.get(key, [None])[0] for key in ("power_flow_mw", "line_voltage_kv", "resistance_ohm", "line_length_km", "power_factor")}
                if any(value is None for value in payload.values()):
                    self.send_json({"status": "unavailable", "missing_parameters": [key for key, value in payload.items() if value is None], "label": "engineering-grade physical loss unavailable"})
                    return
                values = {key: float(value) for key, value in payload.items()}
                self.send_json(calculate_three_phase_loss(**values))
                return
            if path == "/api/route-plan":
                edge_id = str(query.get("edge_id", [""])[0]).upper().replace("_", "-")
                reduction = float(query.get("reduction_pct", [25])[0])
                self.send_json(plan_reroute(snapshot_at()["edges"], edge_id, reduction))
                return
            if path == "/api/forecast":
                self.send_json(forecast(query.get("country", ["DE"])[0], query.get("model", [None])[0], int(query.get("horizon", [12])[0])))
                return
            if path == "/api/recommendations":
                self.send_json({"timestamp": snapshot_at()["timestamp"], "items": recommendations(snapshot_at())})
                return
            if path == "/api/stream":
                self.stream_events()
                return
            super().do_GET()
        except (ValueError, FileNotFoundError) as error:
            self.send_json({"error": str(error)}, 400)
        except Exception as error:  # Keep a JSON error for the browser while logging server detail.
            print(f"[api-error] {path}: {error}")
            self.send_json({"error": "Unexpected server error"}, 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/what-if":
                self.send_json(what_if(self.read_json()))
                return
            self.send_json({"error": "Not found"}, 404)
        except (ValueError, KeyError) as error:
            self.send_json({"error": str(error)}, 400)

    def stream_events(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        for _ in range(60):
            try:
                with STREAM_LOCK:
                    STREAM_STATE["cursor"] = (STREAM_STATE["cursor"] + 1) % max(len(TIMESTAMPS), 1)
                    cursor = STREAM_STATE["cursor"]
                payload = snapshot_at(cursor)
                self.wfile.write(f"event: snapshot\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n".encode("utf-8"))
                self.wfile.flush()
                time.sleep(2)
            except (BrokenPipeError, ConnectionResetError):
                break


def main() -> None:
    if not FRONTEND_DIR.exists():
        raise FileNotFoundError(f"Missing frontend directory: {FRONTEND_DIR}")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"GridPulse running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping GridPulse")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
