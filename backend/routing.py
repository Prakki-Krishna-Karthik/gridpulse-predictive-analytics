"""Stress-aware alternate-path planning for transparent what-if scenarios."""

from __future__ import annotations

import heapq
import math

try:
    from physics import calculate_distance_loss_proxy
except ImportError:
    from backend.physics import calculate_distance_loss_proxy


def _edge_loss(edge: dict, magnitude_mw: float) -> float:
    distance = float(edge.get("distance_km", 0.0))
    if distance <= 0 or magnitude_mw <= 0:
        return 0.0
    return float(calculate_distance_loss_proxy(magnitude_mw, distance)["loss_mw"])


def _path_search(edges: list[dict], source: str, target: str, reroute_mw: float, strict: bool, avoid_critical: bool) -> tuple[list[str], list[str], list[dict]]:
    adjacency: dict[str, list[tuple[str, dict]]] = {}
    for edge in edges:
        if edge.get("id") == "__selected__":
            continue
        risk = str(edge.get("risk_class", "Normal"))
        headroom = max(float(edge.get("capacity_proxy_mw", 0.0)) - float(edge.get("magnitude_mw", 0.0)), 0.0)
        if strict and (headroom < reroute_mw or (avoid_critical and risk == "Critical")):
            continue
        left, right = edge["source"], edge["target"]
        utilization = float(edge.get("utilization", 0.0))
        distance = float(edge.get("distance_km", 0.0))
        loss_pct = float(edge.get("loss_pct_of_flow", 0.0))
        # Distance is the physical cost; stress and loss act as soft penalties.
        weight = max(distance, 1.0) * (1 + 2.2 * utilization + 6 * loss_pct)
        if risk == "Warning":
            weight *= 1.35
        if risk == "Critical":
            weight *= 4.0
        adjacency.setdefault(left, []).append((right, {"edge": edge, "weight": weight, "headroom_mw": headroom}))
        adjacency.setdefault(right, []).append((left, {"edge": edge, "weight": weight, "headroom_mw": headroom}))

    queue = [(0.0, source, [source], [], [])]
    best: dict[str, float] = {}
    while queue:
        cost, node, nodes, edge_ids, used = heapq.heappop(queue)
        if node == target:
            return nodes, edge_ids, used
        if cost >= best.get(node, math.inf):
            continue
        best[node] = cost
        for next_node, item in adjacency.get(node, []):
            if next_node in nodes:
                continue
            next_cost = cost + item["weight"]
            if next_cost < best.get(next_node, math.inf):
                edge = item["edge"]
                heapq.heappush(queue, (next_cost, next_node, nodes + [next_node], edge_ids + [edge["id"]], used + [item]))
    return [], [], []


def plan_reroute(edges: list[dict], edge_id: str, reroute_pct: float = 25.0, avoid_critical: bool = True) -> dict:
    """Find a path between the selected link's endpoints with visible guardrails."""
    selected = next((edge for edge in edges if edge.get("id") == edge_id), None)
    if selected is None:
        raise ValueError(f"Unknown edge: {edge_id}")
    reroute_pct = max(0.0, min(float(reroute_pct), 60.0))
    current_mw = max(float(selected.get("magnitude_mw", 0.0)), 0.0)
    reroute_mw = current_mw * reroute_pct / 100.0
    source, target = selected["source"], selected["target"]
    working_edges = [edge for edge in edges if edge.get("id") != edge_id]

    if reroute_mw <= 0:
        return {
            "status": "no_change",
            "feasible": True,
            "edge_id": edge_id,
            "reroute_pct": reroute_pct,
            "reroute_mw": 0.0,
            "nodes": [source, target],
            "edge_ids": [],
            "baseline_loss_mw": _edge_loss(selected, current_mw),
            "rerouted_loss_mw": _edge_loss(selected, current_mw),
            "loss_delta_mw": 0.0,
            "bottlenecks": [],
            "route_reason": "No flow was moved because the scenario slider is at 0%.",
            "guardrail": "Screening proxy only. Validate with thermal limits, N-1 security, voltage stability, and operator constraints.",
        }

    strict_nodes, strict_edge_ids, strict_items = _path_search(working_edges, source, target, reroute_mw, True, avoid_critical)
    feasible = bool(strict_edge_ids)
    status = "route_found" if feasible else "best_effort_only"
    nodes, edge_ids, used = strict_nodes, strict_edge_ids, strict_items
    bottlenecks: list[dict] = []
    if not feasible:
        nodes, edge_ids, used = _path_search(working_edges, source, target, reroute_mw, False, avoid_critical)
        for item in used:
            edge = item["edge"]
            if item["headroom_mw"] < reroute_mw or edge.get("risk_class") == "Critical":
                bottlenecks.append({
                    "edge_id": edge["id"],
                    "headroom_mw": item["headroom_mw"],
                    "risk_class": edge.get("risk_class", "Normal"),
                    "reason": "not enough proxy headroom" if item["headroom_mw"] < reroute_mw else "critical screening state",
                })
        if not edge_ids:
            status = "no_alternate_path"
            nodes = [source, target]
        reason = "A complete route met the headroom and risk guardrails." if feasible else ("A shortest physical route exists, but it needs engineering review because one or more links cannot absorb the moved flow." if edge_ids else "No connected alternate path exists in the visible topology.")
    else:
        reason = "A complete route met the headroom and risk guardrails."

    baseline_loss = _edge_loss(selected, current_mw)
    rerouted_loss = _edge_loss(selected, current_mw - reroute_mw)
    for item in used:
        rerouted_loss += _edge_loss(item["edge"], float(item["edge"].get("magnitude_mw", 0.0)) + reroute_mw)
        baseline_loss += _edge_loss(item["edge"], float(item["edge"].get("magnitude_mw", 0.0)))
    return {
        "status": status,
        "feasible": feasible,
        "edge_id": edge_id,
        "reroute_pct": reroute_pct,
        "reroute_mw": reroute_mw,
        "nodes": nodes,
        "edge_ids": edge_ids,
        "baseline_loss_mw": baseline_loss,
        "rerouted_loss_mw": rerouted_loss,
        "loss_delta_mw": rerouted_loss - baseline_loss,
        "bottlenecks": bottlenecks,
        "route_reason": reason,
        "guardrail": "Screening proxy only. Validate with thermal limits, N-1 security, voltage stability, and operator constraints.",
    }
