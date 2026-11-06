"""Explainable graph-stress propagation and resilience analysis.

The project graph is a country/interconnector screening graph rather than a
complete electrical admittance model. This module therefore keeps every
derived value explicitly labelled as a graph-analysis proxy. It provides the
live dashboard with node influence and edge criticality, and it can generate
reproducible result artifacts and figures from the processed history.
"""

from __future__ import annotations

import csv
import json
import math
from collections import defaultdict, deque
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
RESULTS = ROOT / "results"
FIGURES = RESULTS / "figures"


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def safe_mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _edge_key(left: str, right: str) -> tuple[str, str]:
    return tuple(sorted((left, right)))


def _adjacency(edges: list[dict], excluded: str | None = None) -> dict[str, set[str]]:
    adjacency: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        if edge.get("id") == excluded:
            continue
        left, right = edge["source"], edge["target"]
        adjacency[left].add(right)
        adjacency[right].add(left)
    return adjacency


def _shortest_path(source: str, target: str, adjacency: dict[str, set[str]]) -> tuple[int | None, int]:
    """Return shortest-hop distance and number of shortest paths."""
    if source == target:
        return 0, 1
    distances = {source: 0}
    counts = {source: 1}
    queue = deque([source])
    while queue:
        node = queue.popleft()
        for neighbor in adjacency.get(node, ()):
            if neighbor not in distances:
                distances[neighbor] = distances[node] + 1
                counts[neighbor] = counts[node]
                queue.append(neighbor)
            elif distances[neighbor] == distances[node] + 1:
                counts[neighbor] += counts[node]
    return distances.get(target), counts.get(target, 0)


def _edge_betweenness(countries: list[str], edges: list[dict]) -> dict[tuple[str, str], float]:
    """Brandes-style edge betweenness for the undirected topology."""
    adjacency = _adjacency(edges)
    score: dict[tuple[str, str], float] = defaultdict(float)
    for source in countries:
        stack: list[str] = []
        predecessors: dict[str, list[str]] = defaultdict(list)
        sigma = defaultdict(float)
        sigma[source] = 1.0
        distance = {source: 0}
        queue = deque([source])
        while queue:
            node = queue.popleft()
            stack.append(node)
            for neighbor in adjacency.get(node, ()):
                if neighbor not in distance:
                    distance[neighbor] = distance[node] + 1
                    queue.append(neighbor)
                if distance.get(neighbor) == distance[node] + 1:
                    sigma[neighbor] += sigma[node]
                    predecessors[neighbor].append(node)
        dependency = defaultdict(float)
        while stack:
            node = stack.pop()
            for predecessor in predecessors[node]:
                contribution = (sigma[predecessor] / max(sigma[node], 1.0)) * (1.0 + dependency[node])
                score[_edge_key(predecessor, node)] += contribution
                dependency[predecessor] += contribution
    return {key: value / 2.0 for key, value in score.items()}


def build_graph_context(graph: dict) -> dict:
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    countries = [node["country"] for node in nodes]
    raw_betweenness = _edge_betweenness(countries, edges)
    max_betweenness = max(raw_betweenness.values(), default=1.0)
    pair_count = max(len(countries) * (len(countries) - 1) / 2, 1.0)
    base_adjacency = _adjacency(edges)
    base_distances = []
    for index, source in enumerate(countries):
        for target in countries[index + 1:]:
            distance, _ = _shortest_path(source, target, base_adjacency)
            if distance is not None:
                base_distances.append(float(distance))
    base_average_distance = safe_mean(base_distances) or 1.0
    edge_static = {}
    for edge in edges:
        key = _edge_key(edge["source"], edge["target"])
        removed_adjacency = _adjacency(edges, edge.get("id"))
        disconnected = 0
        distance_increases = []
        for index, source in enumerate(countries):
            for target in countries[index + 1:]:
                before, _ = _shortest_path(source, target, base_adjacency)
                after, _ = _shortest_path(source, target, removed_adjacency)
                if before is not None and after is None:
                    disconnected += 1
                elif before is not None and after is not None:
                    distance_increases.append(max(after - before, 0))
        _, alternate_path_count = _shortest_path(edge["source"], edge["target"], removed_adjacency)
        edge_static[edge["id"]] = {
            "edge_betweenness": raw_betweenness.get(key, 0.0),
            "edge_betweenness_normalized": clamp(raw_betweenness.get(key, 0.0) / max_betweenness),
            "disconnected_pairs_if_removed": disconnected,
            "disconnection_rate_if_removed": disconnected / pair_count,
            "average_hop_increase_if_removed": safe_mean([float(value) for value in distance_increases]),
            "alternate_shortest_paths": alternate_path_count,
        }
    return {
        "countries": countries,
        "edge_static": edge_static,
        "pair_count": pair_count,
        "base_average_hops": base_average_distance,
        "method": {
            "name": "uncertainty-aware graph stress propagation and counterfactual resilience screening",
            "propagation_steps": 2,
            "stress_formula": "0.45 utilization + 0.25 endpoint risk + 0.20 propagated node risk + 0.10 loss proxy",
            "criticality_formula": "0.55 dynamic stress + 0.25 edge betweenness + 0.15 disconnection rate + 0.05 hop increase",
            "caveat": "screening proxy; not a substitute for AC power flow, thermal limits, or N-1 certification",
        },
    }


def _propagate_node_stress(nodes: list[dict], edges: list[dict], context: dict) -> dict[str, float]:
    node_map = {node["country"]: node for node in nodes}
    neighbors: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for edge in edges:
        weight = 0.55 + 0.45 * clamp(float(edge.get("utilization", 0.0)) / 1.25)
        neighbors[edge["source"]].append((edge["target"], weight))
        neighbors[edge["target"]].append((edge["source"], weight))
    seed = {country: clamp(float(node_map.get(country, {}).get("risk_score", 0.0)) / 100.0) for country in context["countries"]}
    propagated = dict(seed)
    for _ in range(2):
        updated = {}
        for country in context["countries"]:
            nearby = neighbors.get(country, [])
            neighbor_total = sum(weight for _, weight in nearby)
            neighbor_risk = sum(propagated.get(neighbor, 0.0) * weight for neighbor, weight in nearby) / max(neighbor_total, 1.0)
            updated[country] = clamp(0.58 * seed[country] + 0.42 * neighbor_risk)
        propagated = updated
    return propagated


def analyze_snapshot(nodes: list[dict], edges: list[dict], context: dict) -> dict:
    propagated = _propagate_node_stress(nodes, edges, context)
    node_map = {node["country"]: node for node in nodes}
    max_loss_pct = max((float(edge.get("loss_pct_of_flow", 0.0)) for edge in edges), default=1.0)
    node_rows = []
    for country in context["countries"]:
        node = node_map.get(country, {})
        base_risk = clamp(float(node.get("risk_score", 0.0)) / 100.0)
        centrality = (
            0.45 * float(node.get("degree_centrality", 0.0))
            + 0.25 * float(node.get("closeness_centrality", 0.0))
            + 0.30 * float(node.get("betweenness_centrality", 0.0))
        )
        influence = clamp(0.55 * propagated[country] + 0.30 * base_risk + 0.15 * centrality)
        node_rows.append({
            "country": country,
            "base_risk_score": round(base_risk * 100.0, 2),
            "propagated_risk_score": round(propagated[country] * 100.0, 2),
            "influence_score": round(influence * 100.0, 2),
            "risk_class": "Critical" if influence >= 0.75 else "Warning" if influence >= 0.48 else "Normal",
            "degree_centrality": float(node.get("degree_centrality", 0.0)),
            "betweenness_centrality": float(node.get("betweenness_centrality", 0.0)),
        })
    node_rows.sort(key=lambda item: item["influence_score"], reverse=True)
    node_rank = {item["country"]: rank for rank, item in enumerate(node_rows, start=1)}
    edge_rows = []
    for edge in edges:
        source = node_map.get(edge["source"], {})
        target = node_map.get(edge["target"], {})
        utilization = clamp(float(edge.get("utilization", 0.0)) / 1.25)
        endpoint_risk = safe_mean([
            clamp(float(source.get("risk_score", 0.0)) / 100.0),
            clamp(float(target.get("risk_score", 0.0)) / 100.0),
        ])
        propagated_endpoint_risk = safe_mean([propagated.get(edge["source"], 0.0), propagated.get(edge["target"], 0.0)])
        loss_proxy = clamp(float(edge.get("loss_pct_of_flow", 0.0)) / max(max_loss_pct, 0.0001))
        dynamic_stress = clamp(0.45 * utilization + 0.25 * endpoint_risk + 0.20 * propagated_endpoint_risk + 0.10 * loss_proxy)
        static = context["edge_static"].get(edge["id"], {})
        criticality = clamp(
            0.55 * dynamic_stress
            + 0.25 * float(static.get("edge_betweenness_normalized", 0.0))
            + 0.15 * float(static.get("disconnection_rate_if_removed", 0.0))
            + 0.05 * clamp(float(static.get("average_hop_increase_if_removed", 0.0)) / max(context.get("base_average_hops", 1.0), 1.0))
        )
        edge_rows.append({
            "edge_id": edge["id"],
            "source": edge["source"],
            "target": edge["target"],
            "dynamic_stress_score": round(dynamic_stress * 100.0, 2),
            "criticality_score": round(criticality * 100.0, 2),
            "risk_class": "Critical" if criticality >= 0.75 else "Warning" if criticality >= 0.48 else "Normal",
            "utilization": float(edge.get("utilization", 0.0)),
            "edge_betweenness": float(static.get("edge_betweenness", 0.0)),
            "disconnected_pairs_if_removed": int(static.get("disconnected_pairs_if_removed", 0)),
            "disconnection_rate_if_removed": float(static.get("disconnection_rate_if_removed", 0.0)),
            "average_hop_increase_if_removed": float(static.get("average_hop_increase_if_removed", 0.0)),
            "alternate_shortest_paths": int(static.get("alternate_shortest_paths", 0)),
        })
    edge_rows.sort(key=lambda item: item["criticality_score"], reverse=True)
    return {
        "method": context["method"],
        "nodes": [{**item, "rank": node_rank[item["country"]]} for item in node_rows],
        "edges": edge_rows,
        "summary": {
            "top_influence_node": node_rows[0]["country"] if node_rows else None,
            "top_influence_score": node_rows[0]["influence_score"] if node_rows else 0.0,
            "top_critical_edge": edge_rows[0]["edge_id"] if edge_rows else None,
            "top_criticality_score": edge_rows[0]["criticality_score"] if edge_rows else 0.0,
            "critical_edges": sum(item["risk_class"] == "Critical" for item in edge_rows),
            "warning_edges": sum(item["risk_class"] == "Warning" for item in edge_rows),
        },
    }


def _load_processed() -> tuple[dict, dict]:
    manifest = json.loads((PROCESSED / "manifest.json").read_text(encoding="utf-8"))
    series = json.loads((PROCESSED / "series.json").read_text(encoding="utf-8"))
    return manifest, series


def generate_result_artifacts() -> dict:
    """Generate JSON/CSV/PNG artifacts for the graph-based analysis."""
    manifest, series = _load_processed()
    FIGURES.mkdir(parents=True, exist_ok=True)
    context = build_graph_context(manifest["graph"])
    timestamps = series["timestamps"]
    edge_history = {edge["id"]: [] for edge in manifest["graph"]["edges"]}
    node_history = {country: [] for country in context["countries"]}
    snapshots = []
    for index, timestamp in enumerate(timestamps):
        nodes = []
        for base in manifest["graph"]["nodes"]:
            country = base["country"]
            data = series["countries"][country]
            point = min(index, len(data["net_flow_mw"]) - 1)
            load = float(data["load_mw"][point])
            flow = float(data["net_flow_mw"][point])
            imbalance = float(data["flow_imbalance_ratio"][point])
            residual = float(data["load_residual_mw"][point])
            capacity = max(float(base.get("flow_capacity_proxy_mw", 1.0)), 1.0)
            score = clamp(abs(flow) / capacity * 0.75 + min(1.0, abs(imbalance)) * 0.15 + min(1.0, abs(residual) / max(abs(load), 1.0)) * 0.10) * 100.0
            nodes.append({**base, "risk_score": score})
        edges = []
        for base in manifest["graph"]["edges"]:
            point = series["edges"].get(base["id"], [{}])[min(index, len(series["edges"].get(base["id"], [{}])) - 1)]
            magnitude = float(point.get("magnitude_mw", 0.0))
            utilization = magnitude / max(float(base.get("capacity_proxy_mw", 1.0)), 1.0)
            edges.append({**base, "magnitude_mw": magnitude, "utilization": utilization})
        analysis = analyze_snapshot(nodes, edges, context)
        snapshots.append({"timestamp": timestamp, "summary": analysis["summary"]})
        for row in analysis["edges"]:
            edge_history[row["edge_id"]].append({"timestamp": timestamp, "dynamic_stress_score": row["dynamic_stress_score"], "criticality_score": row["criticality_score"]})
        for row in analysis["nodes"]:
            node_history[row["country"]].append({"timestamp": timestamp, "propagated_risk_score": row["propagated_risk_score"], "influence_score": row["influence_score"]})
    latest_nodes = []
    latest_edges = []
    latest_index = max(len(timestamps) - 1, 0)
    for base in manifest["graph"]["nodes"]:
        country = base["country"]
        data = series["countries"][country]
        point = min(latest_index, len(data["net_flow_mw"]) - 1)
        load = float(data["load_mw"][point])
        flow = float(data["net_flow_mw"][point])
        imbalance = float(data["flow_imbalance_ratio"][point])
        residual = float(data["load_residual_mw"][point])
        capacity = max(float(base.get("flow_capacity_proxy_mw", 1.0)), 1.0)
        score = clamp(abs(flow) / capacity * 0.75 + min(1.0, abs(imbalance)) * 0.15 + min(1.0, abs(residual) / max(abs(load), 1.0)) * 0.10) * 100.0
        latest_nodes.append({**base, "risk_score": score})
    for base in manifest["graph"]["edges"]:
        point = series["edges"].get(base["id"], [{}])[min(latest_index, len(series["edges"].get(base["id"], [{}])) - 1)]
        magnitude = float(point.get("magnitude_mw", 0.0))
        latest_edges.append({**base, "magnitude_mw": magnitude, "utilization": magnitude / max(float(base.get("capacity_proxy_mw", 1.0)), 1.0)})
    latest_analysis = analyze_snapshot(latest_nodes, latest_edges, context)
    output = {
        "generated_at": manifest.get("generated_at"),
        "timestamps": timestamps,
        "method": context["method"],
        "static_edge_metrics": context["edge_static"],
        "latest": {"timestamp": timestamps[-1] if timestamps else None, **latest_analysis},
        "edge_history": edge_history,
        "node_history": node_history,
        "timeline_summary": snapshots,
    }
    (RESULTS / "graph_stress_analysis.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    with (RESULTS / "graph_stress_timeline.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["timestamp", "edge_id", "dynamic_stress_score", "criticality_score"])
        for edge_id, rows in edge_history.items():
            for row in rows:
                writer.writerow([row["timestamp"], edge_id, row["dynamic_stress_score"], row["criticality_score"]])
    with (RESULTS / "graph_resilience_ranking.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["edge_id", "criticality_score", "edge_betweenness", "disconnected_pairs_if_removed", "average_hop_increase_if_removed", "alternate_shortest_paths"])
        for row in latest_analysis["edges"]:
            writer.writerow([row["edge_id"], row["criticality_score"], row["edge_betweenness"], row["disconnected_pairs_if_removed"], row["average_hop_increase_if_removed"], row["alternate_shortest_paths"]])
    _save_figures(manifest, output)
    return {"results_dir": str(RESULTS), "latest": latest_analysis["summary"], "figures": ["graph_stress_propagation.png", "graph_resilience_ranking.png", "graph_stress_timeline.png", "graph_node_influence.png"]}


def _save_figures(manifest: dict, output: dict) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.colors import Normalize
        from matplotlib.cm import ScalarMappable
    except ImportError:
        return

    latest = output["latest"]
    node_lookup = {node["country"]: node for node in manifest["graph"]["nodes"]}
    analysis_nodes = {node["country"]: node for node in latest["nodes"]}
    analysis_edges = {edge["edge_id"]: edge for edge in latest["edges"]}
    x = [node["longitude"] for node in manifest["graph"]["nodes"]]
    y = [node["latitude"] for node in manifest["graph"]["nodes"]]
    positions = {node["country"]: (node["longitude"], node["latitude"]) for node in manifest["graph"]["nodes"]}

    plt.style.use("default")
    fig, ax = plt.subplots(figsize=(10.5, 6.5))
    ax.set_facecolor("#f7fafc")
    norm = Normalize(vmin=0, vmax=100)
    for edge in manifest["graph"]["edges"]:
        left, right = positions[edge["source"]], positions[edge["target"]]
        score = analysis_edges[edge["id"]]["dynamic_stress_score"]
        color = plt.cm.plasma(norm(score))
        ax.plot([left[0], right[0]], [left[1], right[1]], color=color, linewidth=1.3 + score / 42, alpha=.65, zorder=1)
    node_values = [analysis_nodes[country]["propagated_risk_score"] for country in positions]
    scatter = ax.scatter(x, y, c=node_values, cmap="plasma", norm=norm, s=[85 + 3 * value for value in node_values], edgecolor="#ffffff", linewidth=.8, zorder=3)
    for country, (lon, lat) in positions.items():
        ax.text(lon + .25, lat + .12, country, fontsize=8, weight="bold", zorder=4)
    ax.set_title("Graph stress propagation at latest replay point", loc="left", weight="bold")
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.grid(alpha=.16)
    fig.colorbar(ScalarMappable(norm=norm, cmap="plasma"), ax=ax, label="Propagated risk score")
    fig.tight_layout()
    fig.savefig(FIGURES / "graph_stress_propagation.png", dpi=160, bbox_inches="tight")
    plt.close(fig)

    top_edges = sorted(latest["edges"], key=lambda row: row["criticality_score"], reverse=True)[:10][::-1]
    fig, ax = plt.subplots(figsize=(9.5, 5.8))
    labels = [row["edge_id"] for row in top_edges]
    values = [row["criticality_score"] for row in top_edges]
    bars = ax.barh(labels, values, color=[plt.cm.plasma(norm(value)) for value in values])
    ax.set_xlim(0, 100)
    ax.set_xlabel("Composite criticality score (0–100)")
    ax.set_title("Counterfactual edge resilience ranking", loc="left", weight="bold")
    ax.grid(axis="x", alpha=.16)
    for bar, value in zip(bars, values):
        ax.text(min(value + 1, 96), bar.get_y() + bar.get_height() / 2, f"{value:.1f}", va="center", fontsize=8)
    fig.tight_layout()
    fig.savefig(FIGURES / "graph_resilience_ranking.png", dpi=160, bbox_inches="tight")
    plt.close(fig)

    timestamps = output["timestamps"]
    recent_start = max(0, len(timestamps) - 240)
    top_ids = [row["edge_id"] for row in sorted(latest["edges"], key=lambda row: row["criticality_score"], reverse=True)[:5]]
    fig, ax = plt.subplots(figsize=(11, 5.4))
    for index, edge_id in enumerate(top_ids):
        rows = output["edge_history"][edge_id][recent_start:]
        ax.plot(range(len(rows)), [row["dynamic_stress_score"] for row in rows], label=edge_id, linewidth=1.6, color=plt.cm.viridis((index + 1) / (len(top_ids) + 1)))
    ax.axhline(75, color="#d95f59", linestyle="--", linewidth=1, label="critical screening guide")
    ax.axhline(48, color="#e6a23c", linestyle=":", linewidth=1, label="warning screening guide")
    ax.set_ylim(0, 100)
    ax.set_xlabel("Recent replay hour")
    ax.set_ylabel("Dynamic graph stress score")
    ax.set_title("Stress propagation over the recent replay window", loc="left", weight="bold")
    ax.grid(alpha=.16)
    ax.legend(ncol=3, fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(FIGURES / "graph_stress_timeline.png", dpi=160, bbox_inches="tight")
    plt.close(fig)

    top_nodes = sorted(latest["nodes"], key=lambda row: row["influence_score"], reverse=True)[::-1]
    fig, ax = plt.subplots(figsize=(8.8, 5.8))
    labels = [row["country"] for row in top_nodes]
    values = [row["influence_score"] for row in top_nodes]
    bars = ax.barh(labels, values, color="#6b5bd6")
    ax.set_xlim(0, 100)
    ax.set_xlabel("Influence score (0–100)")
    ax.set_title("Node influence after two-step stress propagation", loc="left", weight="bold")
    ax.grid(axis="x", alpha=.16)
    for bar, value in zip(bars, values):
        ax.text(min(value + 1, 96), bar.get_y() + bar.get_height() / 2, f"{value:.1f}", va="center", fontsize=8)
    fig.tight_layout()
    fig.savefig(FIGURES / "graph_node_influence.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    print(json.dumps(generate_result_artifacts(), indent=2))
