const state = {
  metadata: null,
  snapshot: null,
  metrics: null,
  forecast: null,
  recommendations: [],
  routePlan: null,
  selectedEdgeId: null,
  selectedCountry: "DE",
  selectedModel: null,
  stream: null,
  mode: "live",
  forecastRequest: 0,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function number(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value));
}

function compact(value) {
  if (!Number.isFinite(Number(value))) return "--";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value));
}

function percent(value, digits = 0) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function dateLabel(value, withTime = true) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(date);
}

function riskClass(value) {
  return String(value || "normal").toLowerCase();
}

function showToast(message) {
  let toast = $(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

function setText(selector, value) {
  const node = $(selector);
  if (!node) return;
  node.textContent = value;
  node.classList.remove("metric-pop");
  void node.offsetWidth;
  node.classList.add("metric-pop");
}

function updateHealth(ok, message = "") {
  const dot = $("#healthDot");
  dot.classList.toggle("ok", ok);
  $("#healthLabel").textContent = ok ? "Streaming" : "Reconnecting";
  $("#healthMeta").textContent = message || (ok ? "Local replay service connected" : "Waiting for local replay service");
}

function initializeSelectors() {
  const countries = state.metadata?.dataset?.countries || [];
  $("#countrySelect").innerHTML = countries.map((country) => `<option value="${escapeHtml(country)}" ${country === state.selectedCountry ? "selected" : ""}>${escapeHtml(country)}</option>`).join("");
  const runtimeModels = new Set(state.metrics.runtime_models || []);
  const researchOptions = (state.metrics.research_models || []).filter((metric) => runtimeModels.has(metric.model));
  const modelOptions = [...state.metrics.metrics, ...researchOptions];
  $("#modelSelect").innerHTML = modelOptions.map((metric) => `<option value="${escapeHtml(metric.model)}" ${metric.model === state.selectedModel ? "selected" : ""}>${escapeHtml(metric.label)}${runtimeModels.has(metric.model) ? " · live checkpoint" : ""}</option>`).join("");
  $("#modelSelect").value = state.selectedModel;
  const edges = state.snapshot?.edges || [];
  const edgeSelect = $("#edgeSelect");
  const previousEdge = state.selectedEdgeId || edgeSelect.value;
  edgeSelect.innerHTML = edges.slice().sort((a, b) => b.risk_score - a.risk_score).map((edge) => `<option value="${escapeHtml(edge.id)}">${escapeHtml(edge.id)} · ${number(edge.magnitude_mw)} MW</option>`).join("");
  state.selectedEdgeId = edges.some((edge) => edge.id === previousEdge) ? previousEdge : edges[0]?.id;
  edgeSelect.value = state.selectedEdgeId || "";
  renderPhysicsLens();
  const pointCount = state.metadata?.dataset?.history_points || 0;
  $("#replaySlider").max = Math.max(pointCount - 1, 0);
  $("#replaySlider").value = Math.max(pointCount - 1, 0);
  $("#graphPointCount").textContent = number(pointCount);
}

function updateHeader() {
  const dataset = state.metadata.dataset;
  $("#networkTag").textContent = `${dataset.countries.length} nodes · ${dataset.edge_count} canonical links`;
  const researchWinner = state.metrics.research_winner;
  if (researchWinner) {
    const liveCheckpoint = (state.metrics.runtime_models || []).includes(researchWinner.model);
    $("#selectedModel").textContent = `${researchWinner.label} · ${liveCheckpoint ? "live checkpoint" : "research"}`;
    $("#modelReason").textContent = liveCheckpoint ? `PyTorch checkpoint active · offline holdout: ${number(researchWinner.rmse, 1)} MW RMSE` : `Offline winner: ${number(researchWinner.rmse, 1)} MW RMSE · replay baseline: ${state.metrics.selected_label}`;
  } else {
    $("#selectedModel").textContent = state.metrics.selected_label;
    $("#modelReason").textContent = state.metrics.selection_rule;
  }
  $("#currentTimestamp").textContent = dateLabel(state.snapshot.timestamp);
  $("#timelineLabel").textContent = state.mode === "live" ? "Latest" : dateLabel(state.snapshot.timestamp, false);
}

function renderKpis() {
  const snapshot = state.snapshot;
  const nodesAtRisk = snapshot.nodes.filter((node) => node.risk_class !== "Normal").length;
  const linkPressure = Math.max(...snapshot.edges.map((edge) => edge.utilization), 0);
  const quality = state.metadata.quality;
  const penalty = Math.min(20, (quality.country_timestamp_gap_total || 0) / 4) + (quality.dynamic_missing_cells || 0 ? 10 : 0) + (quality.power_missing_cells || 0 ? 10 : 0);
  setText("#kpiTransfer", `${compact(snapshot.total_flow_mw)} MW`);
  setText("#kpiNodes", number(nodesAtRisk));
  setText("#kpiPressure", percent(linkPressure));
  setText("#kpiConfidence", `${Math.round(100 - penalty)}%`);
}

function renderSignals() {
  const nodes = state.snapshot.nodes;
  const counts = { Normal: 0, Warning: 0, Critical: 0 };
  nodes.forEach((node) => { counts[node.risk_class] = (counts[node.risk_class] || 0) + 1; });
  const averageRisk = nodes.reduce((sum, node) => sum + node.risk_score, 0) / Math.max(nodes.length, 1);
  $("#signalRingValue").textContent = Math.round(averageRisk);
  $("#signalSummaryTitle").textContent = counts.Critical ? `${counts.Critical} critical node${counts.Critical > 1 ? "s" : ""}` : counts.Warning ? `${counts.Warning} node${counts.Warning > 1 ? "s" : ""} in warning` : "Network in normal range";
  $("#signalSummaryCopy").textContent = counts.Critical ? "Prioritize the linked interconnectors before the next window." : "Screening score updates with every replay pulse.";
  $("#riskBars").innerHTML = ["Normal", "Warning", "Critical"].map((label) => `<div class="risk-row"><span>${label}</span><div class="risk-track"><div class="risk-fill ${riskClass(label)}" style="width:${(counts[label] / Math.max(nodes.length, 1)) * 100}%"></div></div><span class="risk-count">${counts[label]}</span></div>`).join("");
  const alerts = [...state.snapshot.edges.filter((edge) => edge.risk_class !== "Normal").map((edge) => ({ label: edge.id, sub: `${edge.direction} · ${percent(edge.utilization)}`, score: edge.risk_score, risk: edge.risk_class })), ...nodes.filter((node) => node.risk_class !== "Normal").map((node) => ({ label: node.country, sub: `${number(node.load_mw)} MW load · ${node.risk_class}`, score: node.risk_score, risk: node.risk_class }))].sort((a, b) => b.score - a.score).slice(0, 4);
  $("#miniAlertList").innerHTML = alerts.length ? alerts.map((alert) => `<div class="mini-alert"><span class="mini-alert-dot" style="background:var(--${riskClass(alert.risk) === "critical" ? "coral" : "amber"})"></span><div><div class="mini-alert-main">${escapeHtml(alert.label)}</div><div class="mini-alert-sub">${escapeHtml(alert.sub)}</div></div><span class="mini-alert-score">${Math.round(alert.score)}</span></div>`).join("") : `<div class="mini-alert"><span class="mini-alert-dot" style="background:var(--mint)"></span><div><div class="mini-alert-main">No active screening alerts</div><div class="mini-alert-sub">Keep monitoring the replay.</div></div><span class="mini-alert-score">OK</span></div>`;
}

function renderGraphIntelligence() {
  const analysis = state.snapshot?.graph_analysis;
  if (!analysis) return;
  const summary = analysis.summary || {};
  setText("#graphTopNode", summary.top_influence_node ? `${summary.top_influence_node} · ${number(summary.top_influence_score, 1)}` : "--");
  setText("#graphTopEdge", summary.top_critical_edge ? `${summary.top_critical_edge} · ${number(summary.top_criticality_score, 1)}` : "--");
  setText("#graphCriticalCount", `${number(summary.critical_edges)} critical · ${number(summary.warning_edges)} warning`);
  const nodeRows = (analysis.nodes || []).slice(0, 5);
  const edgeRows = (analysis.edges || []).slice(0, 5);
  $("#graphNodeInfluence").innerHTML = nodeRows.map((row) => `<div class="graph-ranking-row"><div class="graph-ranking-label"><span>${escapeHtml(row.country)}</span><strong>${number(row.influence_score, 1)}</strong></div><div class="graph-track"><span class="graph-fill ${riskClass(row.risk_class)}" style="width:${Math.min(row.influence_score, 100)}%"></span></div><div class="graph-ranking-meta">base ${number(row.base_risk_score, 1)} · propagated ${number(row.propagated_risk_score, 1)}</div></div>`).join("");
  $("#graphEdgeRanking").innerHTML = edgeRows.map((row) => `<div class="graph-ranking-row"><div class="graph-ranking-label"><span>${escapeHtml(row.edge_id)}</span><strong>${number(row.criticality_score, 1)}</strong></div><div class="graph-track"><span class="graph-fill ${riskClass(row.risk_class)}" style="width:${Math.min(row.criticality_score, 100)}%"></span></div><div class="graph-ranking-meta">${number(row.disconnected_pairs_if_removed)} pairs disconnected · ${number(row.alternate_shortest_paths)} alternate shortest paths</div></div>`).join("");
  $("#graphAnalysisNote").textContent = `Two-step propagation mixes local risk with neighboring stress. The resilience rank simulates removing each link and measures topology impact. ${analysis.method?.caveat || "Screening evidence only."}`;
}

function projectNodes(nodes) {
  const longitudes = nodes.map((node) => node.longitude);
  const latitudes = nodes.map((node) => node.latitude);
  const minLon = Math.min(...longitudes) - 2;
  const maxLon = Math.max(...longitudes) + 2;
  const minLat = Math.min(...latitudes) - 2;
  const maxLat = Math.max(...latitudes) + 2;
  const xSpan = Math.max(maxLon - minLon, 1);
  const ySpan = Math.max(maxLat - minLat, 1);
  return Object.fromEntries(nodes.map((node) => [node.country, { x: 80 + ((node.longitude - minLon) / xSpan) * 760, y: 62 + (1 - (node.latitude - minLat) / ySpan) * 390 }]));
}

function renderTopology() {
  const svg = $("#topologySvg");
  const nodes = state.snapshot.nodes;
  const positions = projectNodes(nodes);
  const nodeLookup = Object.fromEntries(nodes.map((node) => [node.country, node]));
  const routeEdgeIds = new Set(state.routePlan?.edge_ids || []);
  const routeNodes = state.routePlan?.nodes || [];
  const routePoints = routeNodes.map((country) => positions[country]).filter(Boolean);
  const routeD = routePoints.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const routeActive = routeEdgeIds.size > 0 && routePoints.length > 1;
  const defs = `<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#d2f8ff" opacity=".8" /></marker><marker id="routeArrow" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#d8ccff" /></marker><filter id="softGlow"><feGaussianBlur stdDeviation="5" /></filter><filter id="particleGlow"><feGaussianBlur stdDeviation="2" /></filter><filter id="routeGlow"><feGaussianBlur stdDeviation="4" /></filter></defs>`;
  const edgeMarkup = state.snapshot.edges.map((edge) => {
    const start = positions[edge.flow_mw >= 0 ? edge.source : edge.target];
    const end = positions[edge.flow_mw >= 0 ? edge.target : edge.source];
    const klass = riskClass(edge.risk_class);
    const width = 1.3 + Math.min(edge.utilization, 1.2) * 3.2;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const pathId = `flow-${edge.id.replace(/[^a-zA-Z0-9]/g, "")}`;
    const particleCount = routeActive && routeEdgeIds.has(edge.id) ? 0 : edge.magnitude_mw > 0 ? Math.min(3, Math.max(1, Math.round(edge.utilization * 3))) : 0;
    const particles = Array.from({ length: particleCount }, (_, index) => `<circle class="flow-particle" r="${1.4 + Math.min(edge.utilization, 1.0)}"><animateMotion dur="${2.2 + index * .5}s" repeatCount="indefinite" begin="-${index * .7}s"><mpath href="#${pathId}" /></animateMotion></circle>`).join("");
    return `<g class="edge-group ${routeEdgeIds.has(edge.id) ? "route-segment" : ""}" data-edge="${escapeHtml(edge.id)}"><path id="${pathId}" d="M ${start.x} ${start.y} L ${end.x} ${end.y}" fill="none" stroke="transparent" stroke-width="${Math.max(width + 12, 18)}"/><line class="flow-glow" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="var(--${klass === "critical" ? "coral" : klass === "warning" ? "amber" : "mint"})" stroke-width="${width + 8}" filter="url(#softGlow)"/><line class="flow-path ${klass}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke-width="${width}" marker-end="url(#arrow)"/><g>${particles}</g><text class="arrow-label" x="${midX + 4}" y="${midY - 6}">${number(edge.magnitude_mw)} MW</text></g>`;
  }).join("");
  const nodeMarkup = nodes.map((node) => {
    const position = positions[node.country];
    const klass = riskClass(node.risk_class);
    const color = klass === "critical" ? "var(--coral)" : klass === "warning" ? "var(--amber)" : "var(--mint)";
    const radius = 8 + Math.min(node.risk_score / 25, 5);
    return `<g class="node-group" data-country="${escapeHtml(node.country)}" transform="translate(${position.x} ${position.y})"><circle class="node-ring" r="${radius + 7}" stroke="${color}"/><circle class="node-core" r="${radius}" fill="${color}"/><text class="node-label" x="${radius + 10}" y="4">${escapeHtml(node.country)}</text><text class="node-value" x="${radius + 10}" y="17">${Math.round(node.risk_score)} / 100</text></g>`;
  }).join("");
  let routeMarkup = "";
  if (routeActive) {
    const labelPoint = routePoints[Math.floor(routePoints.length / 2)] || { x: 0, y: 0 };
    const routeParticleCount = Math.min(5, Math.max(2, Math.round((Number(state.routePlan.reroute_mw) || 100) / 900)));
    const routeParticles = Array.from({ length: routeParticleCount }, (_, index) => `<circle class="route-particle" r="${3.1 + (index % 2) * .5}"><animateMotion dur="${1.7 + index * .32}s" repeatCount="indefinite" begin="-${index * .42}s"><mpath href="#suggested-route-guide" /></animateMotion></circle>`).join("");
    routeMarkup = `<g class="route-layer"><path id="suggested-route-guide" d="${routeD}" fill="none" stroke="transparent" stroke-width="1"/><path class="route-path" d="${routeD}" marker-end="url(#routeArrow)"/><path class="route-path-core" d="${routeD}"/><g class="route-particles">${routeParticles}</g><text class="route-label" x="${labelPoint.x + 7}" y="${labelPoint.y - 10}">REROUTE ${number(state.routePlan.reroute_mw, 0)} MW</text></g>`;
  }
  svg.innerHTML = `${defs}<g class="edge-layer">${edgeMarkup}</g><g class="node-layer">${nodeMarkup}</g>${routeMarkup}`;
  $$(".node-group").forEach((group) => group.addEventListener("click", () => showTopologyCallout("country", nodeLookup[group.dataset.country])));
  $$(".edge-group").forEach((group) => group.addEventListener("click", () => showTopologyCallout("edge", state.snapshot.edges.find((edge) => edge.id === group.dataset.edge))));
}

function showTopologyCallout(type, item) {
  const callout = $("#topologyCallout");
  if (!item) return;
  const isEdge = type === "edge";
  callout.hidden = false;
  callout.innerHTML = `<button type="button" aria-label="Close">×</button><strong>${escapeHtml(isEdge ? item.id : item.country)}</strong><p>${isEdge ? `${escapeHtml(item.direction)}<br />${number(item.magnitude_mw)} MW · ${percent(item.utilization)} proxy utilization<br />${number(item.distance_km, 0)} km distance · ${number(item.current_loss_mw, 2)} MW estimated loss<br /><span class="${riskClass(item.risk_class)}">${escapeHtml(item.risk_class)} screening state</span>` : `${number(item.load_mw)} MW load<br />${number(item.net_flow_mw)} MW net flow<br /><span class="${riskClass(item.risk_class)}">${Math.round(item.risk_score)} / 100 screening score</span>`}</p>`;
  callout.querySelector("button").addEventListener("click", () => { callout.hidden = true; });
}

function chartPath(points, x, y) {
  return points.map((point, index) => `${index ? "L" : "M"}${x(index, point).toFixed(1)},${y(point).toFixed(1)}`).join(" ");
}

function renderForecastChart() {
  const svg = $("#forecastSvg");
  const forecast = state.forecast;
  if (!forecast) return;
  const history = forecast.history || [];
  const future = forecast.forecast || [];
  const all = [...history, ...future];
  const values = all.flatMap((point) => [point.load_mw, point.flow_mw, point.load_lower_mw ?? point.load_mw, point.load_upper_mw ?? point.load_mw, point.flow_lower_mw ?? point.flow_mw, point.flow_upper_mw ?? point.flow_mw]);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const padX = 56; const right = 818; const top = 22; const bottom = 278;
  const x = (index) => padX + (index / Math.max(all.length - 1, 1)) * (right - padX);
  const y = (value) => bottom - ((value - minValue) / Math.max(maxValue - minValue, 1)) * (bottom - top);
  const historyLoad = history.map((point) => point.load_mw);
  const historyFlow = history.map((point) => point.flow_mw);
  const forecastLoad = [history.at(-1)?.load_mw ?? 0, ...future.map((point) => point.load_mw)];
  const forecastBand = [history.at(-1) ? { load_lower_mw: history.at(-1).load_mw, load_upper_mw: history.at(-1).load_mw } : null, ...future].filter(Boolean);
  const historyStart = 0; const futureStart = history.length - 1;
  const loadHistoryPoints = history.map((point, index) => ({ value: point.load_mw, index }));
  const flowHistoryPoints = history.map((point, index) => ({ value: point.flow_mw, index }));
  const loadPath = chartPath(loadHistoryPoints, (index) => x(index), (point) => y(point.value));
  const flowPath = chartPath(flowHistoryPoints, (index) => x(index), (point) => y(point.value));
  const forecastLoadPath = chartPath(forecastLoad.map((value, index) => ({ value, index: futureStart + index })), (index, point) => x(point.index), (point) => y(point.value));
  const forecastFlow = [history.at(-1)?.flow_mw ?? 0, ...future.map((point) => point.flow_mw)];
  const forecastFlowPath = chartPath(forecastFlow.map((value, index) => ({ value, index: futureStart + index })), (index, point) => x(point.index), (point) => y(point.value));
  const upper = forecastBand.map((point, index) => ({ value: point.load_upper_mw, index: futureStart + index }));
  const lower = forecastBand.map((point, index) => ({ value: point.load_lower_mw, index: futureStart + index })).reverse();
  const bandPath = `${chartPath(upper, (index, point) => x(point.index), (point) => y(point.value))} ${chartPath(lower, (index, point) => x(point.index), (point) => y(point.value)).replace(/^M/, "L")} Z`;
  const grid = [0, 1, 2, 3, 4].map((index) => { const value = minValue + ((maxValue - minValue) * index) / 4; const yy = y(value); return `<line class="chart-grid" x1="${padX}" y1="${yy}" x2="${right}" y2="${yy}"/><text class="chart-axis" x="${padX - 8}" y="${yy + 3}" text-anchor="end">${compact(value)}</text>`; }).join("");
  const xLabels = [0, Math.floor(history.length / 2), history.length - 1, history.length + future.length - 1].map((index) => { const point = all[index]; return point ? `<text class="chart-axis" x="${x(index)}" y="310" text-anchor="middle">${dateLabel(point.timestamp, false).slice(0, 6)}</text>` : ""; }).join("");
  const splitX = x(futureStart);
  svg.innerHTML = `${grid}<line class="chart-grid" x1="${splitX}" y1="${top}" x2="${splitX}" y2="${bottom}" stroke-dasharray="3 4"/><text class="chart-axis" x="${splitX + 5}" y="${top + 9}">FORECAST →</text><path class="chart-area" d="${bandPath}"/><path class="chart-line-load" d="${loadPath}"/><path class="chart-line-flow" d="${flowPath}"/><path class="chart-line-forecast" d="${forecastLoadPath}"/><path class="chart-line-flow-forecast" d="${forecastFlowPath}"/><circle class="chart-point" cx="${x(futureStart)}" cy="${y(history.at(-1)?.load_mw || 0)}" r="4"/>${xLabels}`;
  $("#forecastModelCopy").textContent = forecast.engine === "trained_checkpoint" ? `${forecast.model_label} · recursive checkpoint inference` : `${forecast.model_label} · deterministic baseline with adaptive residual band`;
  const nextHour = future[0];
  $("#forecastUpdated").textContent = nextHour ? `next hour net flow ${number(nextHour.flow_mw)} MW · next ${forecast.horizon_hours} h` : `next ${forecast.horizon_hours} h`;
}

async function loadForecast() {
  const requestId = ++state.forecastRequest;
  const params = new URLSearchParams({ country: state.selectedCountry, model: state.selectedModel, horizon: "12" });
  try {
    const result = await api(`/api/forecast?${params}`);
    if (requestId !== state.forecastRequest) return;
    state.forecast = result;
    renderForecastChart();
  } catch (error) {
    showToast(error.message);
  }
}

function renderMetrics() {
  const metrics = state.metrics.metrics;
  $("#metricsBody").innerHTML = metrics.map((metric) => `<tr class="${metric.model === state.metrics.selected_model ? "selected" : ""}"><td>${escapeHtml(metric.label)}</td><td>${number(metric.rmse, 1)}</td><td>${number(metric.mae, 1)}</td><td>${percent(metric.mape, 1)}</td><td>${percent(metric.accuracy)}</td><td>${percent(metric.precision)}</td><td>${percent(metric.recall)}</td><td>${percent(metric.f1)}</td><td>${metric.model === state.metrics.selected_model ? `<span class="model-status">OPERATIONAL BASELINE</span>` : "—"}</td></tr>`).join("");
  const researchRows = (state.metrics.research_models || []).filter((metric) => ["fusion_gru", "dcrnn"].includes(metric.model));
  const researchWinner = state.metrics.research_winner;
  const fusionResearch = researchRows.find((row) => row.model === "fusion_gru");
  const dcrnnResearch = researchRows.find((row) => row.model === "dcrnn");
  $("#researchEvidence").innerHTML = researchRows.length ? `<span class="research-label">OFFLINE RESEARCH BENCHMARK</span><span>Fusion GRU ${number(fusionResearch?.rmse, 1)} MW RMSE</span><span>DCRNN ${number(dcrnnResearch?.rmse, 1)} MW RMSE</span><strong>${escapeHtml(researchWinner?.label || "Research comparison")} leads on the saved holdout</strong>` : "";
  const curve = state.metrics.validation_curve || [];
  if (!curve.length) return;
  const svg = $("#curveSvg");
  const w = 500; const h = 108; const px = 20; const py = 10;
  const max = Math.max(...curve.flatMap((point) => [point.train_mae, point.validation_mae]), 1);
  const x = (index) => px + (index / Math.max(curve.length - 1, 1)) * (w - px * 2);
  const y = (value) => h - py - (value / max) * (h - py * 2);
  const train = curve.map((point, index) => ({ x: x(index), y: y(point.train_mae) }));
  const validation = curve.map((point, index) => ({ x: x(index), y: y(point.validation_mae) }));
  const path = (points) => points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const grid = [0, 1, 2, 3].map((index) => { const yy = py + index * ((h - py * 2) / 3); return `<line class="chart-grid" x1="${px}" y1="${yy}" x2="${w - px}" y2="${yy}"/>`; }).join("");
  svg.innerHTML = `${grid}<path class="curve-train" d="${path(train)}"/><path class="curve-validation" d="${path(validation)}"/><text class="curve-legend" x="${px}" y="${h - 1}">train</text><text class="curve-legend" x="${px + 45}" y="${h - 1}" fill="var(--amber)">validation</text>`;
}

function renderPhysicsLens() {
  const container = $("#physicsLens");
  if (!container) return;
  const edge = state.snapshot?.edges?.find((item) => item.id === state.selectedEdgeId) || state.snapshot?.edges?.[0];
  if (!edge) {
    container.innerHTML = `<div class="physics-note">Waiting for a selected interconnector.</div>`;
    return;
  }
  const assumptions = edge.loss_assumptions || state.metadata?.quality?.physical_loss?.assumptions || {};
  container.innerHTML = `<div class="physics-line"><span>Selected line</span><strong class="accent">${escapeHtml(edge.id)}</strong></div><div class="physics-line"><span>Centroid distance</span><strong>${number(edge.distance_km, 0)} km</strong></div><div class="physics-line"><span>Derived resistance</span><strong>${number(edge.resistance_ohm, 4)} Ω</strong></div><div class="physics-line"><span>Current proxy loss</span><strong class="accent">${number(edge.current_loss_mw ?? edge.estimated_loss_mw, 2)} MW · ${percent(edge.current_loss_pct_of_flow ?? edge.loss_pct_of_flow, 2)}</strong></div><div class="physics-line"><span>Assumed constants</span><strong>${number(assumptions.line_voltage_kv, 0)} kV · ρ ${Number(assumptions.resistivity_ohm_m || 0).toExponential(2)} · A ${number(assumptions.cross_section_mm2, 0)} mm²</strong></div>`;
}

function renderQuality() {
  const quality = state.metadata.quality;
  const gapCount = quality.country_timestamp_gap_total || 0;
  const score = Math.max(0, Math.round(100 - Math.min(20, gapCount / 4) - (quality.dynamic_missing_cells ? 10 : 0) - (quality.power_missing_cells ? 10 : 0)));
  $("#qualityScore").textContent = `${score}/100`;
  const rows = [
    ["Dynamic missing cells", quality.dynamic_missing_cells, quality.dynamic_missing_cells ? "warn" : "good"],
    ["Duplicate records", quality.dynamic_duplicate_keys + quality.power_duplicate_keys, quality.dynamic_duplicate_keys + quality.power_duplicate_keys ? "bad" : "good"],
    ["Timestamp gap hours", gapCount, gapCount ? "warn" : "good"],
    ["Alias labels normalized", quality.normalized_interconnector_aliases.length, "good"],
    ["Loss model", quality.physical_loss?.status === "proxy_estimate" ? "Proxy" : "Unavailable", quality.physical_loss?.status === "proxy_estimate" ? "warn" : "bad"],
  ];
  $("#qualityList").innerHTML = rows.map(([label, value, klass]) => `<div class="quality-row"><span>${escapeHtml(label)}</span><span class="quality-value ${klass}">${typeof value === "number" ? number(value) : escapeHtml(value)}</span></div>`).join("");
}

function renderRecommendations() {
  const items = state.recommendations;
  $("#recommendationList").innerHTML = items.map((item) => `<div class="recommendation-card"><div class="rec-top"><span class="priority">${escapeHtml(item.priority)}</span><span class="rec-target">${escapeHtml(item.target)}</span><span class="rec-confidence">${percent(item.confidence)}</span></div><div class="rec-action">${escapeHtml(item.action)}</div><div class="rec-reason">${escapeHtml(item.reason)}</div><div class="rec-foot">Validate: ${escapeHtml(item.required_validation_checks.slice(0, 2).join(" · "))}</div></div>`).join("");
}

function renderAll() {
  updateHeader();
  renderKpis();
  renderSignals();
  renderGraphIntelligence();
  renderTopology();
  renderMetrics();
  renderQuality();
  renderRecommendations();
  initializeSelectors();
}

async function runWhatIf(event) {
  event.preventDefault();
  const button = $("#whatIfForm .primary-button");
  button.disabled = true;
  button.innerHTML = "Simulating…";
  try {
    const result = await api("/api/what-if", { method: "POST", body: JSON.stringify({ edge_id: $("#edgeSelect").value, reduction_pct: Number($("#reductionSlider").value) }) });
    const baseline = result.baseline;
    const projected = result.projected;
    state.selectedEdgeId = result.edge_id;
    state.routePlan = result.route_plan;
    renderTopology();
    $("#whatIfResult").classList.remove("empty");
    const route = result.route_plan || {};
    const routeCopy = route.nodes?.length > 1 ? route.nodes.join(" → ") : "No connected alternate path";
    const bottleneckCopy = route.bottlenecks?.length ? `<div class="route-bottleneck">Review: ${escapeHtml(route.bottlenecks.map((item) => `${item.edge_id} (${item.reason})`).join(" · "))}</div>` : "";
    $("#whatIfResult").innerHTML = `<div class="scenario-header"><strong>${escapeHtml(result.edge_id)}</strong><span class="scenario-arrow">→</span><strong class="${riskClass(projected.risk_class)}">${escapeHtml(projected.risk_class)}</strong></div><div class="scenario-stats"><div class="scenario-stat"><span>baseline</span><strong>${percent(baseline.utilization)}</strong></div><div class="scenario-stat"><span>projected</span><strong>${percent(projected.utilization)}</strong></div><div class="scenario-stat"><span>moved</span><strong>${number(route.reroute_mw, 0)} MW</strong></div></div><span class="route-status ${route.feasible ? "" : "warn"}">${route.feasible ? "ROUTE FOUND" : route.status === "no_alternate_path" ? "NO ROUTE" : "BEST EFFORT · REVIEW"}</span><p class="route-path-copy">${escapeHtml(routeCopy)}</p><p class="scenario-copy">${escapeHtml(route.route_reason || "The planner is waiting for a scenario.")} Loss change: ${number(route.loss_delta_mw, 2)} MW.</p>${bottleneckCopy}`;
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = "Simulate reroute <span>→</span>";
  }
}

async function loadSnapshot(index) {
  try {
    state.snapshot = await api(`/api/snapshot?index=${encodeURIComponent(index)}`);
    renderAll();
    await loadForecast();
  } catch (error) {
    showToast(error.message);
  }
}

function connectStream() {
  if (state.stream) state.stream.close();
  state.mode = "live";
  $("#liveModeButton").classList.add("active");
  $("#historyModeButton").classList.remove("active");
  $("#streamLabel").textContent = "LIVE REPLAY";
  state.stream = new EventSource("/api/stream");
  state.stream.addEventListener("open", () => updateHealth(true, "Local replay service connected"));
  state.stream.addEventListener("snapshot", (event) => {
    state.snapshot = JSON.parse(event.data);
    renderAll();
    if (state.snapshot.index % 8 === 0) loadForecast();
  });
  state.stream.onerror = () => updateHealth(false, "Stream reconnecting automatically");
}

function enterHistory() {
  if (state.stream) state.stream.close();
  state.mode = "history";
  $("#liveModeButton").classList.remove("active");
  $("#historyModeButton").classList.add("active");
  $("#streamLabel").textContent = "HISTORY REPLAY";
  updateHealth(true, "Historical replay paused at selected time");
}

async function initialize() {
  try {
    const [metadata, snapshot, metrics, recs, health] = await Promise.all([api("/api/metadata"), api("/api/snapshot"), api("/api/metrics"), api("/api/recommendations"), api("/api/health")]);
    state.metadata = metadata;
    state.snapshot = snapshot;
    state.metrics = metrics;
    state.selectedModel = (metrics.runtime_models || []).includes(metrics.research_winner?.model) ? metrics.research_winner.model : metrics.selected_model;
    state.recommendations = recs.items;
    updateHealth(true, `Generated ${dateLabel(health.generated_at)}`);
    renderAll();
    await loadForecast();
    connectStream();
  } catch (error) {
    updateHealth(false, "Run python backend/server.py, then reload");
    showToast(error.message);
  }
}

$("#countrySelect").addEventListener("change", (event) => { state.selectedCountry = event.target.value; loadForecast(); });
$("#modelSelect").addEventListener("change", (event) => { state.selectedModel = event.target.value; loadForecast(); });
$("#edgeSelect").addEventListener("change", (event) => { state.selectedEdgeId = event.target.value; state.routePlan = null; renderPhysicsLens(); renderTopology(); });
$("#whatIfForm").addEventListener("submit", runWhatIf);
$("#reductionSlider").addEventListener("input", (event) => { $("#reductionValue").textContent = `${event.target.value}%`; });
$("#liveModeButton").addEventListener("click", connectStream);
$("#historyModeButton").addEventListener("click", enterHistory);
$("#replaySlider").addEventListener("input", async (event) => { enterHistory(); await loadSnapshot(event.target.value); });
$("#refreshButton").addEventListener("click", () => { showToast("Refreshing replay artifacts…"); initialize(); });
$("#jumpRecommendations").addEventListener("click", () => $("#recommendations").scrollIntoView({ behavior: "smooth", block: "start" }));
$("#fitNetworkButton").addEventListener("click", () => { $("#topologyStage").animate([{ transform: "scale(.985)" }, { transform: "scale(1)" }], { duration: 350 }); });

initialize();
