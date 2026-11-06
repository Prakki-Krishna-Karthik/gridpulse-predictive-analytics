import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:/Users/Krishna Karthik/Desktop/predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build");
const OUTPUT = path.join(ROOT, ".codex-ppt-output");
const FINAL = path.join(OUTPUT, "GridPulse_Deep_Research_Project_Deck_v4_dcrnn_light.pptx");
const FONT = "Aptos";
const W = 1280;
const H = 720;
const C = {
  bg: "#F7F9FC",
  bg2: "#EEF4F7",
  panel: "#FFFFFF",
  panel2: "#E8F0F3",
  white: "#173746",
  text: "#385563",
  muted: "#71838D",
  grid: "#D5E1E6",
  cyan: "#168FA6",
  mint: "#1C9A72",
  coral: "#D85A61",
  amber: "#C98A21",
  purple: "#6C63B5",
  blue: "#4C78A8",
};
const SLIDE = { left: 64, right: 64, top: 56, bottom: 48 };

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8"));
}

const manifest = await readJson("data/processed/manifest.json");
const series = await readJson("data/processed/series.json");
const metrics = await readJson("data/processed/model_metrics.json");
const snapshot = await readJson("data/processed/snapshot.json");
const resultComparison = await readJson("results/model_comparison.json");
const resultCurves = await readJson("results/training_curves.json");
const resultDcrnnCurves = await readJson("results/dcrnn_training_curves.json");
const resultRocPr = await readJson("results/roc_pr_curves.json");
const resultFusionConfusion = await readJson("results/confusion_matrix.json");
const resultFusionConfusionOnly = await readJson("results/fusion_gru_confusion_matrix.json");
const resultFeatures = await readJson("results/feature_importance.json");
const resultEmbedding = await readJson("results/embedding_projection.json");
const resultErrors = await readJson("results/error_analysis.json");
const resultFusionAnalysis = await readJson("results/fusion_gru_analysis.json");
const resultDcrnnAnalysis = await readJson("results/dcrnn_analysis.json");
const datasetProfile = await readJson("results/dataset_profile.json");
const preprocessingSummary = await readJson("results/preprocessing_summary.json");
const featureCatalog = await readJson("results/feature_catalog.json");
const resultModels = resultComparison.models;
const resultFusion = resultModels.find((item) => item.model === "fusion_gru");
const resultDcrnn = resultModels.find((item) => item.model === "dcrnn");
const researchWinner = resultComparison.research_winner;
function baselineMetricsValue(model, key) {
  return Number(resultModels.find((item) => item.model === model)?.[key] ?? 0);
}

function fmt(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function pct(value, digits = 1) { return `${(Number(value) * 100).toFixed(digits)}%`; }
function compact(value) {
  const n = Number(value);
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return fmt(n);
}
function q(values, quantile) {
  const clean = values.filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b);
  if (!clean.length) return 1;
  const pos = (clean.length - 1) * quantile;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? clean[lo] : clean[lo] + (clean[hi] - clean[lo]) * (pos - lo);
}
function avg(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function safeDiv(a, b) { return b ? a / b : 0; }
function riskClassForValue(value, warning, critical) {
  const magnitude = Math.abs(value);
  return magnitude >= critical ? "Critical" : magnitude >= warning ? "Warning" : "Normal";
}
function prettyLabel(text) { return String(text).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()); }

function computeConfusion(model = "persistence") {
  const labels = ["Normal", "Warning", "Critical"];
  const matrix = Object.fromEntries(labels.map((row) => [row, Object.fromEntries(labels.map((col) => [col, 0]))]));
  for (const country of Object.values(series.countries)) {
    const values = country.net_flow_mw;
    const split = values.length - 168;
    const warning = q(values.slice(0, split), 0.75);
    const critical = q(values.slice(0, split), 0.90);
    for (let index = split; index < values.length; index += 1) {
      const actual = values[index];
      const history = values.slice(0, index);
      let prediction = history.at(-1) ?? 0;
      if (model === "moving_average") prediction = avg(history.slice(-24));
      if (model === "seasonal_naive") prediction = history.length >= 24 ? history.at(-24) : prediction;
      if (model === "linear_trend") {
        const window = history.slice(-24);
        if (window.length >= 3) {
          const xm = (window.length - 1) / 2;
          const ym = avg(window);
          const den = window.reduce((sum, value, i) => sum + (i - xm) ** 2, 0);
          const slope = den ? window.reduce((sum, value, i) => sum + (i - xm) * (value - ym), 0) / den : 0;
          prediction = ym + slope * window.length;
          const low = Math.min(...window) - 0.15 * Math.max(Math.abs(Math.min(...window)), 1);
          const high = Math.max(...window) + 0.15 * Math.max(Math.abs(Math.max(...window)), 1);
          prediction = Math.max(low, Math.min(high, prediction));
        }
      }
      matrix[riskClassForValue(actual, warning, critical)][riskClassForValue(prediction, warning, critical)] += 1;
    }
  }
  return matrix;
}

const confusion = resultFusionConfusion.matrix;
const dcrnnPerClass = Object.fromEntries(["Normal", "Warning", "Critical"].map((label) => {
  const tp = confusion[label][label];
  const rowTotal = Object.values(confusion[label]).reduce((sum, value) => sum + Number(value), 0);
  const colTotal = Object.values(confusion).reduce((sum, row) => sum + Number(row[label]), 0);
  const precision = safeDiv(tp, colTotal);
  const recall = safeDiv(tp, rowTotal);
  return [label, { precision, recall, f1: safeDiv(2 * precision * recall, precision + recall) }];
}));
const fusionConfusion = resultFusionConfusionOnly.matrix;
const latestNodes = snapshot.nodes;
const latestEdges = snapshot.edges;
const countries = manifest.dataset.countries;

function addText(slide, text, x, y, width, height, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontFamily: FONT,
    fontSize: opts.size ?? 18,
    color: opts.color ?? C.text,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    alignment: opts.align ?? "left",
  };
  return shape;
}

function addRect(slide, x, y, width, height, fill, opts = {}) {
  return slide.shapes.add({
    geometry: opts.geometry || "rect",
    position: { left: x, top: y, width, height },
    fill,
    line: { style: "solid", fill: opts.line ?? fill, width: opts.lineWidth ?? 0 },
    borderRadius: opts.round ? "rounded-lg" : undefined,
  });
}

function addLine(slide, x1, y1, x2, y2, color = C.grid, width = 2) {
  return slide.shapes.add({ geometry: "line", position: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.max(1, Math.abs(x2 - x1)), height: Math.max(1, Math.abs(y2 - y1)) }, fill: "none", line: { style: "solid", fill: color, width } });
}

function addHeader(slide, title, kicker, page) {
  addText(slide, kicker.toUpperCase(), SLIDE.left, 20, 540, 20, { size: 11, color: C.cyan, bold: true });
  addText(slide, title, SLIDE.left, 42, 1010, 42, { size: 30, color: C.white, bold: true });
  addLine(slide, SLIDE.left, 94, W - SLIDE.right, 94, C.grid, 1);
  addText(slide, `GRID/PULSE  ·  ${String(page).padStart(2, "0")}`, W - 280, 20, 216, 20, { size: 11, color: C.muted, align: "right" });
}

function addFooter(slide, text = "Source: supplied CSVs and reproducible artifacts in data/processed") {
  addText(slide, text, SLIDE.left, H - 26, 960, 14, { size: 9, color: C.muted });
  addText(slide, "Predictive Analytics course project", W - 330, H - 26, 266, 14, { size: 9, color: C.muted, align: "right" });
}

function addPill(slide, text, x, y, width, color = C.cyan) {
  addRect(slide, x, y, width, 25, `${color}18`, { geometry: "roundRect", line: `${color}70`, lineWidth: 1 });
  addText(slide, text, x + 10, y + 5, width - 20, 15, { size: 10, color, bold: true, align: "center" });
}

function addPanel(slide, x, y, width, height, title, subtitle = "") {
  addRect(slide, x, y, width, height, C.panel, { geometry: "roundRect", line: C.grid, lineWidth: 1 });
  addText(slide, title, x + 18, y + 15, width - 36, 22, { size: 16, color: C.white, bold: true });
  if (subtitle) addText(slide, subtitle, x + 18, y + 40, width - 36, 18, { size: 10, color: C.muted });
}

function addMetric(slide, x, y, width, label, value, accent = C.cyan, note = "") {
  addRect(slide, x, y, width, 92, C.panel, { geometry: "roundRect", line: accent, lineWidth: 1 });
  addText(slide, label.toUpperCase(), x + 14, y + 12, width - 28, 15, { size: 10, color: C.muted, bold: true });
  addText(slide, value, x + 14, y + 33, width - 28, 34, { size: 27, color: accent, bold: true });
  if (note) addText(slide, note, x + 14, y + 70, width - 28, 14, { size: 9, color: C.muted });
}

function addBulletList(slide, items, x, y, width, lineHeight = 28, size = 15, color = C.text) {
  items.forEach((item, index) => {
    addRect(slide, x, y + index * lineHeight + 6, 6, 6, item.color || C.cyan, { geometry: "ellipse" });
    addText(slide, item.text || item, x + 18, y + index * lineHeight, width - 18, lineHeight - 2, { size, color: item.colorText || color });
  });
}

function addTable(slide, values, x, y, width, height, options = {}) {
  const table = slide.tables.add({ rows: values.length, columns: values[0].length, left: x, top: y, width, height, columnWidths: options.columnWidths });
  values.forEach((row, r) => row.forEach((value, c) => {
    const cell = table.getCell(r, c);
    cell.value = String(value);
    cell.text.style = { fontFamily: FONT, fontSize: options.fontSize ?? 13, color: r === 0 ? C.bg : C.text, bold: r === 0 || (options.boldFirst && c === 0) };
    cell.fill = r === 0 ? options.headerFill ?? C.cyan : (r % 2 ? C.bg2 : C.panel);
  }));
  table.borders.assign({ style: "solid", fill: C.grid, width: 1 });
  return table;
}

function addChart(slide, type, config) {
  const normalizeNumber = (value) => Number.isFinite(value) ? Number(value.toFixed(6)) : value;
  const normalizedSeries = (config.series || []).map((series) => ({
    ...series,
    values: series.values?.map(normalizeNumber),
    xValues: series.xValues?.map(normalizeNumber),
  }));
  return slide.charts.add(type, {
    position: config.position,
    categories: config.categories,
    series: normalizedSeries,
    hasLegend: config.hasLegend ?? true,
    legend: config.legend ?? { position: "bottom", textStyle: { fontSize: 11, fill: C.muted } },
    title: config.title || "Evidence chart",
    titlePlacement: config.title ? "aboveChart" : "none",
    titleTextStyle: { fontSize: 14, fill: C.white, bold: true },
    chartFill: C.panel,
    plotAreaFill: C.panel,
    chartLine: { style: "solid", fill: C.panel, width: 0 },
    plotAreaLine: { style: "solid", fill: C.grid, width: 1 },
    xAxis: config.xAxis ?? { majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 10, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
    yAxis: config.yAxis ?? { majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 10, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
    dataLabels: config.dataLabels,
    barOptions: config.barOptions,
    lineOptions: config.lineOptions,
    scatterOptions: config.scatterOptions,
  });
}

function note(slide, text) {
  slide.speakerNotes.text = text;
  slide.speakerNotes.setVisible(true);
}

function projectedPositions(nodes, x, y, width, height) {
  const minLon = Math.min(...nodes.map((n) => n.longitude)) - 1.5;
  const maxLon = Math.max(...nodes.map((n) => n.longitude)) + 1.5;
  const minLat = Math.min(...nodes.map((n) => n.latitude)) - 1.5;
  const maxLat = Math.max(...nodes.map((n) => n.latitude)) + 1.5;
  const lonSpan = Math.max(maxLon - minLon, 1);
  const latSpan = Math.max(maxLat - minLat, 1);
  return Object.fromEntries(nodes.map((n) => [n.country, { x: x + ((n.longitude - minLon) / lonSpan) * width, y: y + (1 - (n.latitude - minLat) / latSpan) * height }]));
}

function drawNetwork(slide, x, y, width, height, nodes = latestNodes, edges = latestEdges, options = {}) {
  const positions = projectedPositions(nodes, x, y, width, height);
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.country, n]));
  edges.forEach((edge) => {
    const a = positions[edge.source], b = positions[edge.target];
    if (!a || !b) return;
    addLine(slide, a.x, a.y, b.x, b.y, options.edgeColor || C.grid, options.edgeWidth || 2);
  });
  nodes.forEach((node) => {
    const p = positions[node.country];
    const color = node.risk_class === "Critical" ? C.coral : node.risk_class === "Warning" ? C.amber : C.mint;
    const r = options.nodeSize ? options.nodeSize(node) : 7 + Math.min(node.risk_score / 25, 7);
    addRect(slide, p.x - r, p.y - r, r * 2, r * 2, color, { geometry: "ellipse", line: C.bg, lineWidth: 2 });
    addText(slide, node.country, p.x + r + 5, p.y - 7, 46, 14, { size: options.labelSize || 10, color: C.white, bold: true });
  });
  return positions;
}

function riskComponents(node) {
  const utilization = Math.abs(node.net_flow_mw) / Math.max(node.flow_capacity_proxy_mw, 1);
  const imbalance = Math.min(1, Math.abs(node.flow_imbalance_ratio)) * 15;
  const residual = Math.min(1, Math.abs(node.load_residual_mw) / Math.max(Math.abs(node.load_mw), 1)) * 10;
  return { flow: utilization * 75, imbalance, residual };
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

function newSlide(title, kicker, page) {
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  addHeader(slide, title, kicker, page);
  addFooter(slide);
  return slide;
}

// 1. Cover
{
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  for (let i = 0; i < 12; i += 1) addLine(slide, 760 + i * 28, 120 + (i % 4) * 100, 1180 - (i % 3) * 50, 520 - (i % 5) * 40, `${C.cyan}22`, 1);
  addText(slide, "GRID / PULSE", 70, 52, 260, 28, { size: 16, color: C.cyan, bold: true });
  addText(slide, "Graph-Based Predictive and\nPrescriptive Analytics for\nCross-Border Power Grid Networks", 70, 148, 700, 190, { size: 40, color: C.white, bold: true });
  addText(slide, "A reproducible course project that turns messy grid-flow records into explainable forecasts, risk screening, distance-based loss estimates, and stress-aware rerouting scenarios.", 74, 370, 610, 72, { size: 18, color: C.text });
  addPill(slide, "PREDICTIVE ANALYTICS · B C S E 3 3 4 L", 74, 482, 300, C.cyan);
  addPill(slide, "2022–2024 DATA REPLAY", 390, 482, 190, C.mint);
  addText(slide, "Prepared for project review", 74, 600, 330, 20, { size: 14, color: C.muted });
  addText(slide, "12 nodes  ·  24 canonical links  ·  1,578,190 records processed", 74, 628, 550, 20, { size: 12, color: C.muted });
  addRect(slide, 952, 214, 14, 14, C.coral, { geometry: "ellipse" });
  addRect(slide, 1088, 332, 14, 14, C.mint, { geometry: "ellipse" });
  addRect(slide, 864, 472, 14, 14, C.amber, { geometry: "ellipse" });
  note(slide, "Opening: frame the project as an auditable decision-support system. The dashboard uses a historical replay of the supplied data. The deck distinguishes measured data, proxy estimates, and engineering validation requirements.");
}

// 2. Executive summary
{
  const slide = newSlide("Executive summary", "Project position", 2);
  addText(slide, "The project combines a graph view, time-series forecasting, risk classification, and prescriptive what-if analysis in one auditable workflow.", 64, 116, 820, 44, { size: 21, color: C.text });
  addMetric(slide, 64, 190, 214, "Network", "12 nodes", C.cyan, "countries / zones");
  addMetric(slide, 292, 190, 214, "Graph", "24 links", C.mint, "canonical interconnectors");
  addMetric(slide, 520, 190, 214, "Data", "1.59M rows", C.blue, "dynamic + power-flow");
  addMetric(slide, 748, 190, 214, "Selected model", "580.3 MW", C.amber, "Persistence RMSE");
  addPanel(slide, 64, 310, 548, 280, "What is novel here", "Integration and transparency rather than an unsupported new neural architecture");
  addBulletList(slide, [
    { text: "Canonical edge audit keeps aliases visible and reproducible", color: C.cyan },
    { text: "Risk score combines flow pressure, imbalance, and load residual", color: C.mint },
    { text: "Model router selects the best baseline by chronological RMSE", color: C.amber },
    { text: "Distance-to-loss bridge makes assumptions visible", color: C.purple },
    { text: "Stress-aware rerouting exposes bottlenecks instead of hiding infeasibility", color: C.coral },
  ], 86, 382, 490, 34, 16);
  addPanel(slide, 640, 310, 576, 280, "Evidence at a glance", "Results from the generated artifacts");
  addText(slide, `RMSE: ${fmt(metrics.metrics[0].rmse, 1)} MW`, 668, 380, 250, 26, { size: 22, color: C.cyan, bold: true });
  addText(slide, `MAE: ${fmt(metrics.metrics[0].mae, 1)} MW`, 668, 423, 250, 26, { size: 22, color: C.mint, bold: true });
  addText(slide, `Accuracy: ${pct(metrics.metrics[0].accuracy, 1)}`, 668, 466, 250, 26, { size: 22, color: C.amber, bold: true });
  addText(slide, `F1: ${pct(metrics.metrics[0].f1, 1)}`, 668, 509, 250, 26, { size: 22, color: C.purple, bold: true });
  addText(slide, "The winner is selected by evidence, not by model complexity.", 668, 550, 470, 24, { size: 14, color: C.text });
  note(slide, "Use this slide as the one-minute overview. The key result is not just the score. The result is the full evidence chain from raw records to a recommendation that retains assumptions and guardrails.");
}

// 3. Domain/problem
{
  const slide = newSlide("Domain and problem definition", "Rubric: domain understanding", 3);
  addPanel(slide, 64, 124, 500, 450, "Why cross-border grid flows are difficult", "Power moves across multiple connected areas at once");
  addBulletList(slide, [
    { text: "A single interconnector can become a bottleneck when neighboring links are also busy", color: C.coral },
    { text: "Directional records may use inconsistent labels for the same physical link", color: C.amber },
    { text: "Observed flow and load signals are time-dependent and can change sign", color: C.cyan },
    { text: "Physical loss needs voltage, resistance, route length, conductor data, and rating", color: C.purple },
    { text: "An operator needs an explanation of why the system flags a link", color: C.mint },
  ], 90, 198, 430, 58, 16);
  addPanel(slide, 594, 124, 622, 450, "Decision question", "What should the analyst investigate next?");
  addText(slide, "When observed flow or forecast pressure rises, which interconnector or alternate path deserves attention, and why?", 628, 190, 520, 72, { size: 26, color: C.white, bold: true });
  addRect(slide, 650, 302, 104, 60, C.coral, { geometry: "roundRect", line: C.coral, lineWidth: 1 });
  addText(slide, "STRESSED\nLINK", 665, 316, 74, 34, { size: 14, color: C.bg, bold: true, align: "center" });
  addRect(slide, 824, 302, 130, 60, C.purple, { geometry: "roundRect", line: C.purple, lineWidth: 1 });
  addText(slide, "ROUTE\nSEARCH", 840, 316, 98, 34, { size: 14, color: C.bg, bold: true, align: "center" });
  addRect(slide, 1020, 302, 130, 60, C.mint, { geometry: "roundRect", line: C.mint, lineWidth: 1 });
  addText(slide, "REVIEWABLE\nACTION", 1033, 316, 105, 34, { size: 14, color: C.bg, bold: true, align: "center" });
  addText(slide, "Observed data", 658, 392, 120, 20, { size: 13, color: C.muted, align: "center" });
  addText(slide, "Predictive signal", 826, 392, 130, 20, { size: 13, color: C.muted, align: "center" });
  addText(slide, "Prescriptive screen", 1014, 392, 148, 20, { size: 13, color: C.muted, align: "center" });
  addText(slide, "Scope: screening and decision support. Automatic dispatch and switching remain out of scope.", 630, 490, 520, 40, { size: 16, color: C.amber, bold: true });
  note(slide, "Define the operating problem before showing algorithms. The deck treats the system as a screening tool rather than a certified control system.");
}

// 4. Literature
{
  const slide = newSlide("Literature review and identified gap", "Rubric: literature and existing approaches", 4);
  addText(slide, "Research anchors the design choices. The project applies the useful ideas while avoiding unsupported claims of novelty.", 64, 112, 1060, 30, { size: 17, color: C.text });
  const rows = [
    ["Research direction", "What existing work contributes", "Gap addressed by GridPulse"],
    ["DCRNN / directed graph forecasting", "Directional graph diffusion with recurrent time dynamics", "Start with leakage-safe baselines before adding a GNN"],
    ["Graph WaveNet", "Adaptive spatial dependency learning", "Keep topology and assumptions visible to the analyst"],
    ["Power-system GNN surveys", "Forecasting, state estimation, faults, security", "Expose data-quality and domain-data limitations"],
    ["Multi-scale energy STGNNs", "Spatial attention plus temporal features", "Use feature groups and compare against simple models"],
    ["Conformal load forecasting", "Adaptive uncertainty intervals", "Label this project’s residual band as uncalibrated"],
  ];
  addTable(slide, rows, 64, 164, 1152, 310, { fontSize: 12, columnWidths: [220, 420, 512], headerFill: C.cyan });
  addPanel(slide, 64, 506, 1152, 92, "Gap statement", "The project’s contribution is an auditable integration of data quality, prediction, physics assumptions, and route testing.");
  addText(slide, "A model score alone does not answer which link to review, whether the inputs are trustworthy, or what a reroute would cost. GridPulse connects those questions in one workflow.", 86, 565, 1090, 22, { size: 16, color: C.white });
  addText(slide, "Sources: Li et al. (DCRNN), Wu et al. (Graph WaveNet), 2024 power-system GNN survey, MS-STGNN, 2025 grid-aware STGNN, conformalized load forecasting.", 64, 618, 1110, 18, { size: 10, color: C.muted });
  note(slide, "Literature sources are listed in docs/RESEARCH_NOTES.md. Explain that the project does not claim a publishable new neural architecture. It claims an auditable course-scale integration and identifies the experiments needed next.");
}

// 5. Objectives, scope, rubric
{
  const slide = newSlide("Objectives, scope, and assessment alignment", "Rubric mapping", 5);
  addPanel(slide, 64, 120, 520, 470, "Project objectives", "The project follows the predictive analytics syllabus");
  addBulletList(slide, [
    { text: "Prepare and validate two large CSV sources", color: C.cyan },
    { text: "Build a canonical graph of countries and interconnectors", color: C.mint },
    { text: "Compare four transparent time-series models", color: C.blue },
    { text: "Measure regression and classification performance", color: C.amber },
    { text: "Create a distance-based loss proxy with explicit assumptions", color: C.purple },
    { text: "Recommend and test alternate routes under stress", color: C.coral },
    { text: "Deliver a user-friendly, animated decision interface", color: C.cyan },
  ], 90, 194, 450, 45, 15);
  const rubric = [
    ["Rubric area", "Evidence in project"],
    ["Domain / problem", "Slides 3, 6, 7"],
    ["Literature / gap", "Slide 4 + research notes"],
    ["Methodology", "Slides 9–18"],
    ["Architecture / modules", "Slides 10, 11, 19"],
    ["Feasibility / risks", "Slide 20"],
    ["Implementation quality", "Slides 19–20 + tests"],
    ["Testing / validation", "Slides 13–16"],
    ["Results / interpretation", "Slides 13–18"],
    ["Limitations / future", "Slide 20"],
  ];
  addTable(slide, rubric, 624, 150, 592, 392, { fontSize: 13, columnWidths: [250, 342], headerFill: C.mint });
  addText(slide, "Scope boundary", 624, 570, 140, 20, { size: 13, color: C.amber, bold: true });
  addText(slide, "Recommendation-only screening. Engineering validation is required before operational use.", 756, 570, 420, 20, { size: 13, color: C.text });
  note(slide, "The attached images describe the evaluation rubric. This slide maps the requested deep analysis to those criteria so the evaluator can find evidence quickly.");
}

// 6. Dataset and quality
{
  const slide = newSlide("Dataset profile and data contract", "Rubric: data understanding and quality", 6);
  addMetric(slide, 64, 120, 210, "Dynamic rows", fmt(datasetProfile.dynamic_rows), C.cyan, "country + load + signals");
  addMetric(slide, 292, 120, 210, "Power rows", fmt(datasetProfile.power_flow_rows), C.mint, "directional flows");
  addMetric(slide, 520, 120, 210, "Time range", "2022–2024", C.blue, "3 years in source");
  addMetric(slide, 748, 120, 210, "History kept", fmt(datasetProfile.processed_history_points_per_country), C.purple, "aligned hourly points");
  addMetric(slide, 976, 120, 240, "Missing / duplicates", "0 / 0", C.amber, "record checks");
  const rowChart = addChart(slide, "bar", {
    position: { left: 64, top: 258, width: 530, height: 290 },
    categories: ["Dynamic CSV", "Power-flow CSV"],
    series: [{ name: "Rows", values: [manifest.dataset.dynamic_rows, manifest.dataset.power_rows], fill: C.cyan }],
    hasLegend: false,
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 12, fill: C.white } },
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 50 },
  });
  addPanel(slide, 640, 258, 576, 290, "Quality checks", "What the pipeline proves before modeling");
  addBulletList(slide, [
    { text: "0 missing cells in dynamic and power-flow inputs", color: C.mint },
    { text: "0 duplicate composite keys after ingestion", color: C.mint },
    { text: "38 country timestamp-gap hours are recorded", color: C.amber },
    { text: "7 interconnector aliases normalized", color: C.cyan },
    { text: "12 country codes retained, 24 canonical links", color: C.purple },
    { text: "Engineering-grade loss unavailable; proxy assumptions visible", color: C.coral },
  ], 666, 330, 510, 35, 15);
  addText(slide, "Data contract result: clean enough for a reproducible screening prototype, incomplete for certified grid operation.", 64, 586, 1120, 26, { size: 17, color: C.white, bold: true });
  note(slide, `Sources: ${datasetProfile.sources.dynamic_csv} and ${datasetProfile.sources.power_flow_csv}. The results profile records ${datasetProfile.dynamic_rows} dynamic rows, ${datasetProfile.power_flow_rows} power-flow rows, ${datasetProfile.quality_checks.country_timestamp_gap_total} gap hours, and ${datasetProfile.quality_checks.normalized_interconnector_alias_count} alias normalizations.`);
}

// 7. EDA time series
{
  const slide = newSlide("Exploratory time-series analysis", "Rubric: exploratory analysis", 7);
  const times = series.timestamps;
  const daily = [];
  for (let i = 0; i < times.length; i += 24) {
    const end = Math.min(i + 24, times.length);
    const load = countries.reduce((sum, country) => sum + avg(series.countries[country].load_mw.slice(i, end)), 0);
    const flow = countries.reduce((sum, country) => sum + avg(series.countries[country].net_flow_mw.slice(i, end)), 0);
    daily.push({ label: times[i].slice(5, 10), load, flow });
  }
  const sample = daily.slice(-40);
  addPanel(slide, 64, 116, 804, 460, "Network load and net-flow rhythm", "Daily mean across all 12 countries · last 40 replay days");
  addChart(slide, "line", {
    position: { left: 86, top: 170, width: 760, height: 360 },
    categories: sample.map((d) => d.label),
    series: [
      { name: "Total load (MW)", values: sample.map((d) => d.load), line: { fill: C.cyan, width: 3 }, marker: { symbol: "circle", size: 3, fill: C.cyan } },
      { name: "Net flow (MW)", values: sample.map((d) => d.flow), line: { fill: C.coral, width: 2 }, marker: { symbol: "circle", size: 3, fill: C.coral } },
    ],
    hasLegend: true,
    lineOptions: { grouping: "standard", smooth: true },
  });
  addPanel(slide, 902, 116, 314, 460, "What this reveals", "Signals used later");
  addBulletList(slide, [
    { text: "Load and net flow move on different scales", color: C.cyan },
    { text: "Net flow can change sign, so direction matters", color: C.coral },
    { text: "Seasonality exists, but the baseline comparison decides whether it helps", color: C.amber },
    { text: "The validation window uses the final 168 points chronologically", color: C.mint },
  ], 928, 206, 260, 75, 14);
  addText(slide, "Exploration informs features, thresholds, and the choice to compare simple baselines before graph neural models.", 928, 500, 250, 54, { size: 15, color: C.white, bold: true });
  note(slide, "This slide shows the first analytical question: what does the series look like before modeling? The project aggregates daily means only for visualization. Model evaluation uses the hourly values.");
}

// 8. Graph topology
{
  const slide = newSlide("Graph topology and network structure", "Rubric: system graph", 8);
  addPanel(slide, 64, 118, 720, 472, "Canonical country-interconnector graph", "Node color shows latest screening state; line weight shows topology only");
  drawNetwork(slide, 92, 184, 660, 346, latestNodes, latestEdges, { edgeColor: `${C.blue}70`, edgeWidth: 2, labelSize: 10 });
  addPanel(slide, 816, 118, 400, 472, "Centrality comparison", "Topological signals used for context");
  const topCentral = latestNodes.slice().sort((a, b) => b.degree_centrality - a.degree_centrality).slice(0, 8);
  addChart(slide, "bar", {
    position: { left: 840, top: 174, width: 350, height: 260 },
    categories: topCentral.map((n) => n.country),
    series: [{ name: "Degree centrality", values: topCentral.map((n) => n.degree_centrality), fill: C.blue }],
    hasLegend: false,
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 10, fill: C.white } },
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 30 },
  });
  addText(slide, "Centrality is context, not a risk score. The model uses observed flow and load signals for screening.", 842, 472, 330, 48, { size: 15, color: C.text });
  note(slide, "The graph is built from canonical source-target pairs. The node coordinates support the visual map and the Haversine distance proxy. Centrality is descriptive and does not by itself determine a dispatch decision.");
}

// 9. Preprocessing workflow
{
  const slide = newSlide("Preprocessing and canonicalization workflow", "Rubric: proposed methodology", 9);
  const steps = preprocessingSummary.steps.slice(0, 6).map((step) => [String(step.step).padStart(2, "0"), step.name, step.detail]);
  steps.forEach(([number, title, body], i) => {
    const x = 76 + (i % 3) * 392;
    const y = 140 + Math.floor(i / 3) * 180;
    addRect(slide, x, y, 352, 132, C.panel, { geometry: "roundRect", line: i < 3 ? C.cyan : C.purple, lineWidth: 1 });
    addText(slide, number, x + 18, y + 16, 52, 30, { size: 23, color: i < 3 ? C.cyan : C.purple, bold: true });
    addText(slide, title, x + 76, y + 16, 250, 24, { size: 19, color: C.white, bold: true });
    addText(slide, body, x + 76, y + 52, 246, 52, { size: 14, color: C.text });
    if (i === 0 || i === 1 || i === 3 || i === 4) addText(slide, "→", x + 356, y + 53, 26, 24, { size: 23, color: C.amber, bold: true, align: "center" });
  });
  addPanel(slide, 76, 530, 1120, 62, "Reproducibility rule", "The pipeline writes manifest.json, series.json, model_metrics.json, and snapshot.json. The browser never loads the raw 150 MB-scale source files directly.");
  note(slide, "This workflow is sourced from results/preprocessing_summary.json. The core preprocessing decision is canonicalization. It prevents DE_FR, DE-FR, and reverse directional labels from silently becoming separate graph edges. The saved summary also records the final evaluation and serving steps.");
}

// 10. Features and equations
{
  const slide = newSlide("Feature engineering and risk equations", "Rubric: methodology and explainability", 10);
  addPanel(slide, 64, 118, 548, 470, "Input signals", "Feature groups retained in the artifacts");
  const features = [
    ["Local signals", "Net flow, load, imbalance, load residual"],
    ["Network context", "Mean net flow, load, imbalance, residual across nodes"],
    ["Static graph", "Degree, closeness, and betweenness centrality"],
    ["Target", "Next-hour country net flow in MW"],
    ["Lookback", "24 hourly observations per prediction"],
    ["Scaling", "Training-window mean and standard deviation only"],
  ];
  addTable(slide, [["Feature group", "Purpose"], ...features], 88, 178, 500, 300, { fontSize: 13, columnWidths: [140, 360], headerFill: C.cyan });
  addPanel(slide, 650, 118, 566, 470, "Equations behind the dashboard", "Every displayed score has a traceable calculation");
  addText(slide, "Capacity proxy", 678, 176, 150, 20, { size: 14, color: C.cyan, bold: true });
  addText(slide, "C_e = quantile(|flow_e|, 0.95)", 840, 174, 320, 22, { size: 18, color: C.white, bold: true });
  addText(slide, "Link utilization", 678, 220, 150, 20, { size: 14, color: C.mint, bold: true });
  addText(slide, "U_e = |flow_e| / max(C_e, 1)", 840, 218, 320, 22, { size: 18, color: C.white, bold: true });
  addText(slide, "Node risk score", 678, 264, 150, 20, { size: 14, color: C.amber, bold: true });
  addText(slide, "R_n = 75U_n + 15I_n + 10E_n", 840, 262, 320, 22, { size: 18, color: C.white, bold: true });
  addText(slide, "Load residual", 678, 308, 150, 20, { size: 14, color: C.blue, bold: true });
  addText(slide, "E_n = |actual load − forecast load| / |load|", 840, 306, 320, 40, { size: 16, color: C.white, bold: true });
  addText(slide, "Distance-based loss proxy", 678, 370, 170, 20, { size: 14, color: C.purple, bold: true });
  addText(slide, "d = Haversine(lat₁, lon₁, lat₂, lon₂)\nR = ρL/A\nP_loss = 3I²R", 840, 356, 320, 84, { size: 18, color: C.white, bold: true });
  addText(slide, "All scores are capped to 0–100 for screening. They do not replace thermal, voltage, or N-1 studies.", 678, 502, 488, 38, { size: 14, color: C.coral });
  note(slide, `The feature table summarizes results/feature_catalog.json, which contains ${featureCatalog.feature_count} model inputs. For the loss proxy, the default assumptions are 400 kV, 0.95 PF, copper resistivity 1.68e-8 ohm-m, and 2,000 square millimetres. The dataset does not provide engineering-grade parameters.`);
}

// 11. Risk feature contribution chart
{
  const slide = newSlide("Risk composition: flow pressure dominates the screen", "Rubric: feature analysis", 11);
  const selectedNodes = latestNodes.slice().sort((a, b) => b.risk_score - a.risk_score).slice(0, 6);
  addPanel(slide, 64, 118, 800, 464, "Latest node score decomposition", "Stacked contributions from flow pressure, imbalance, and load residual");
  addChart(slide, "bar", {
    position: { left: 86, top: 172, width: 750, height: 360 },
    categories: selectedNodes.map((n) => n.country),
    series: [
      { name: "Flow pressure (75)", values: selectedNodes.map((n) => riskComponents(n).flow), fill: C.cyan },
      { name: "Imbalance (15)", values: selectedNodes.map((n) => riskComponents(n).imbalance), fill: C.amber },
      { name: "Load residual (10)", values: selectedNodes.map((n) => riskComponents(n).residual), fill: C.coral },
    ],
    hasLegend: true,
    barOptions: { direction: "column", grouping: "stacked", gapWidth: 35 },
  });
  addPanel(slide, 902, 118, 314, 464, "Interpretation", "How to read the stack");
  addText(slide, "75 / 15 / 10", 936, 194, 240, 52, { size: 31, color: C.cyan, bold: true, align: "center" });
  addText(slide, "The risk screen gives the largest weight to flow pressure because a stressed observed envelope deserves attention first.", 936, 280, 240, 72, { size: 16, color: C.text, align: "center" });
  addText(slide, "A high score can result from one dominant component or several moderate signals. The interface exposes the underlying node and link values.", 936, 400, 240, 74, { size: 15, color: C.muted, align: "center" });
  note(slide, "The project does not claim statistical feature importance for the baseline forecast models. This chart is the explicit contribution decomposition of the risk screen, which is the quantity used to prioritize attention.");
}

// 12. Architecture
{
  const slide = newSlide("System architecture and real-time replay", "Rubric: architecture and module design", 12);
  const layers = [
    ["SOURCE", "CSV datasets", C.cyan],
    ["PIPELINE", "Python standard library\nvalidation + features + models", C.mint],
    ["ARTIFACTS", "manifest · series · metrics · snapshot", C.blue],
    ["API", "REST endpoints + SSE stream", C.purple],
    ["FRONTEND", "SVG topology · charts · what-if studio", C.amber],
  ];
  layers.forEach(([label, body, color], i) => {
    const y = 122 + i * 86;
    addRect(slide, 84 + i * 46, y, 400, 62, C.panel, { geometry: "roundRect", line: color, lineWidth: 2 });
    addText(slide, label, 104 + i * 46, y + 12, 94, 16, { size: 11, color, bold: true });
    addText(slide, body, 210 + i * 46, y + 10, 242, 38, { size: 15, color: C.white, bold: true });
    if (i < layers.length - 1) addText(slide, "↓", 276 + i * 46, y + 63, 24, 22, { size: 19, color: C.amber, bold: true, align: "center" });
  });
  addPanel(slide, 690, 122, 526, 494, "Stream behavior", "How a browser pulse becomes a new screen");
  const timeline = ["cursor + 1", "snapshot_at()", "risk + loss", "SSE event", "renderAll()"];
  timeline.forEach((label, i) => {
    const x = 724 + (i % 3) * 152;
    const y = 210 + Math.floor(i / 3) * 120;
    addRect(slide, x, y, 120, 56, i === 2 ? `${C.coral}40` : C.bg2, { geometry: "roundRect", line: i === 2 ? C.coral : C.grid, lineWidth: 1 });
    addText(slide, label, x + 8, y + 18, 104, 20, { size: 14, color: i === 2 ? C.coral : C.text, bold: true, align: "center" });
  });
  addText(slide, "The prototype advances one historical hourly snapshot every 2 seconds. A production adapter can replace the replay source with Kafka, MQTT, or utility telemetry while keeping the API shape.", 724, 476, 446, 72, { size: 16, color: C.white });
  note(slide, "Architecture is intentionally modular. The data pipeline produces compact artifacts so the browser stays responsive. The stream is a historical replay for demonstration, not a utility telemetry connection.");
}

// 13. Technology stack
{
  const slide = newSlide("Technology stack and library responsibilities", "Rubric: implementation quality", 13);
  addPanel(slide, 64, 118, 550, 470, "Backend and data layer", "Python 3.x · production replay plus research experiments");
  addText(slide, "Runtime + ingestion", 88, 178, 210, 20, { size: 14, color: C.cyan, bold: true });
  addText(slide, "pathlib · csv · argparse · os\nResolve project paths, read the two CSVs, and accept CLI or environment overrides.", 88, 204, 476, 48, { size: 14, color: C.text });
  addText(slide, "Validation + feature engineering", 88, 278, 250, 20, { size: 14, color: C.mint, bold: true });
  addText(slide, "json · math · statistics · collections · datetime\nCanonicalize links, calculate rolling signals, risk classes, metrics, and reproducible artifacts.", 88, 304, 476, 56, { size: 14, color: C.text });
  addText(slide, "Server + concurrency", 88, 386, 220, 20, { size: 14, color: C.purple, bold: true });
  addText(slide, "http.server · urllib.parse · threading · time\nServe REST endpoints, parse query strings, and advance the historical replay without blocking requests.", 88, 412, 476, 56, { size: 14, color: C.text });
  addText(slide, "Research models + tests", 88, 494, 250, 20, { size: 14, color: C.amber, bold: true });
  addText(slide, "NumPy · PyTorch · scikit-learn · Matplotlib · unittest\nTrain Fusion GRU and DCRNN, generate metrics/figures, and verify the production modules.", 88, 520, 476, 42, { size: 14, color: C.text });

  addPanel(slide, 646, 118, 570, 470, "Browser layer and extension points", "HTML + CSS + vanilla JavaScript");
  addText(slide, "Current frontend", 672, 178, 190, 20, { size: 14, color: C.cyan, bold: true });
  addText(slide, "HTML + CSS + vanilla JavaScript use native SVG for the topology and charts. CSS provides status colors, pulses, and transitions. The interface does not need a React build step today.", 672, 204, 500, 54, { size: 14, color: C.text });
  addText(slide, "Browser APIs", 672, 286, 190, 20, { size: 14, color: C.mint, bold: true });
  addText(slide, "fetch() loads REST resources · EventSource subscribes to /api/stream · DOM events connect filters, sliders, and the what-if form.", 672, 312, 500, 48, { size: 14, color: C.text });
  addText(slide, "Why this stack", 672, 388, 190, 20, { size: 14, color: C.amber, bold: true });
  addText(slide, "The split keeps the production replay lightweight while the offline research layer can use PyTorch and scikit-learn. A React or TypeScript client can consume the same REST + SSE contract later.", 672, 414, 500, 48, { size: 14, color: C.text });
  addRect(slide, 672, 498, 500, 58, `${C.purple}20`, { geometry: "roundRect", line: `${C.purple}80`, lineWidth: 1 });
  addText(slide, "Framework status", 690, 510, 126, 18, { size: 12, color: C.purple, bold: true });
  addText(slide, "Production: standard library. Research: NumPy + PyTorch + scikit-learn + Matplotlib. Frontend: vanilla JS; React remains an optional client rewrite.", 824, 508, 330, 36, { size: 13, color: C.white, bold: true });
  note(slide, "The slide distinguishes the lightweight production service from the optional research experiment layer. The current DCRNN and Fusion GRU use PyTorch; the dashboard consumes saved artifacts and does not need to load the training framework in the browser.");
}

// 14. Integration contract
{
  const slide = newSlide("Integration contract: from CSV to animated decision", "Rubric: module integration", 14);
  addPanel(slide, 64, 118, 1152, 214, "End-to-end integration path", "Every stage passes a stable, inspectable contract to the next stage");
  const stages = [
    ["INPUT", "dynamic_with_flows.csv\npower_flow.csv", C.cyan],
    ["PIPELINE", "pipeline.py\nvalidate + model", C.mint],
    ["ARTIFACTS", "manifest.json\nseries · metrics · snapshot", C.blue],
    ["API", "server.py\nREST + SSE", C.purple],
    ["UI", "app.js\nSVG + controls", C.amber],
  ];
  stages.forEach(([label, body, color], i) => {
    const x = 88 + i * 218;
    addRect(slide, x, 194, 178, 82, C.bg2, { geometry: "roundRect", line: color, lineWidth: 2 });
    addText(slide, label, x + 12, 206, 154, 16, { size: 11, color, bold: true, align: "center" });
    addText(slide, body, x + 12, 224, 154, 48, { size: i === 0 ? 12 : (i === 2 ? 13 : 14), color: C.white, bold: true, align: "center" });
    if (i < stages.length - 1) addText(slide, "→", x + 184, 220, 32, 26, { size: 23, color: C.amber, bold: true, align: "center" });
  });

  addPanel(slide, 64, 366, 552, 220, "API contract", "The frontend does not read raw CSV files");
  addText(slide, "GET  /api/metadata     /api/topology     /api/snapshot\nGET  /api/forecast      /api/metrics      /api/validation\nGET  /api/physical-loss  /api/route-plan   /api/recommendations\nGET  /api/stream         → Server-Sent Events every 2 seconds\nPOST /api/what-if        → route plan + loss delta", 88, 424, 504, 118, { size: 14, color: C.text, bold: true });

  addPanel(slide, 646, 366, 570, 220, "Live decision loop", "One user action crosses physics, routing, and rendering");
  const loop = ["EventSource\nreceives snapshot", "app.js\nupdates state", "POST what-if\nwith reduction", "routing.py + physics.py\nscore alternate path", "UI\nshows path + loss delta"];
  loop.forEach((label, i) => {
    const x = 668 + (i % 3) * 174;
    const y = 426 + Math.floor(i / 3) * 62;
    addRect(slide, x, y, 146, 42, i === 3 ? `${C.coral}28` : C.bg2, { geometry: "roundRect", line: i === 3 ? C.coral : C.grid, lineWidth: 1 });
    addText(slide, label, x + 6, y + 8, 134, 28, { size: 11, color: i === 3 ? C.coral : C.text, bold: true, align: "center" });
  });
  addText(slide, "Shared identifiers such as country codes and canonical edge IDs keep the map, forecasts, loss proxy, and rerouting response aligned.", 668, 544, 520, 28, { size: 13, color: C.white, bold: true });
  note(slide, "The integration is contract-first. The pipeline writes compact JSON artifacts; server.py exposes them through stable endpoints; app.js consumes the same schema for initial load, SSE replay, forecasts, and what-if requests. The browser never recomputes the authoritative model metrics or routing result.");
}

// 15. Forecast method
{
  const slide = newSlide("Forecasting methodology and validation design", "Rubric: predictive modeling", 15);
  addPanel(slide, 64, 118, 520, 464, "Chronological evaluation", "Future data never leaks into the training window");
  addRect(slide, 96, 220, 210, 76, `${C.cyan}30`, { geometry: "roundRect", line: C.cyan, lineWidth: 1 });
  addText(slide, "TRAINING HISTORY\nfirst 792 points", 112, 240, 178, 34, { size: 16, color: C.cyan, bold: true, align: "center" });
  addRect(slide, 344, 220, 190, 76, `${C.amber}30`, { geometry: "roundRect", line: C.amber, lineWidth: 1 });
  addText(slide, "HOLDOUT\nlast 168 points", 360, 240, 158, 34, { size: 16, color: C.amber, bold: true, align: "center" });
  addText(slide, "walk forward one hour at a time", 192, 330, 286, 24, { size: 15, color: C.text, align: "center" });
  addText(slide, "Persistence: ŷₜ₊₁ = yₜ\nMoving average: ŷₜ₊₁ = mean(yₜ₋₂₃…yₜ)\nSeasonal naive: ŷₜ₊₁ = yₜ₋₂₄\nLinear trend: ŷ = β₀ + β₁t", 98, 390, 430, 126, { size: 16, color: C.white });
  addPanel(slide, 622, 118, 594, 464, "Forecast outputs", "Point estimate plus an adaptive residual band");
  addText(slide, "RMSE = √(1/n · Σ(yᵢ − ŷᵢ)²)", 660, 202, 490, 30, { size: 23, color: C.cyan, bold: true });
  addText(slide, "MAE = 1/n · Σ|yᵢ − ŷᵢ|", 660, 250, 490, 30, { size: 23, color: C.mint, bold: true });
  addText(slide, "MAPE = mean(|error| / |actual|)", 660, 298, 490, 30, { size: 23, color: C.amber, bold: true });
  addText(slide, "The selected model is the one with the lowest pooled RMSE. The dashboard adds a residual band that widens with √horizon.", 660, 372, 480, 60, { size: 17, color: C.text });
  addText(slide, "Important caveat", 660, 468, 180, 20, { size: 14, color: C.coral, bold: true });
  addText(slide, "MAPE becomes unstable near zero or when net flow changes sign. MAE, RMSE, and class metrics carry more weight.", 660, 498, 480, 48, { size: 15, color: C.white });
  note(slide, "The project compares four classical baselines first. That is methodologically defensible because it establishes a leakage-safe benchmark before adding a GNN. Metrics are computed over 2,016 predictions, 12 countries times 168 holdout hours.");
}

// 16. Regression performance
{
  const slide = newSlide("Model performance: regression comparison", "Rubric: results and interpretation", 16);
  addPanel(slide, 64, 118, 682, 464, "Error metrics", "Lower is better · pooled across 12 countries and 168 holdout hours");
  addChart(slide, "bar", {
    position: { left: 88, top: 178, width: 630, height: 342 },
    categories: resultModels.map((m) => m.label.replace("24h ", "")),
    series: [
      { name: "RMSE (MW)", values: resultModels.map((m) => m.rmse), fill: C.cyan },
      { name: "MAE (MW)", values: resultModels.map((m) => m.mae), fill: C.coral },
    ],
    hasLegend: true,
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 10, fill: C.white } },
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 35 },
  });
  addPanel(slide, 784, 118, 432, 464, "Saved experiment result", "Six approaches on one chronological holdout");
  const winner = researchWinner;
  addText(slide, winner.label, 820, 190, 360, 34, { size: 28, color: C.cyan, bold: true, align: "center" });
  addText(slide, `RMSE ${fmt(winner.rmse, 1)} MW`, 820, 250, 360, 28, { size: 21, color: C.white, bold: true, align: "center" });
  addText(slide, `MAE ${fmt(winner.mae, 1)} MW`, 820, 292, 360, 28, { size: 21, color: C.mint, bold: true, align: "center" });
  addText(slide, `The saved result pack ranks ${winner.label} first on RMSE. DCRNN keeps the node graph intact, while Fusion GRU uses a global summary context.`, 820, 360, 360, 84, { size: 16, color: C.text, align: "center" });
  addText(slide, "Persistence remains the audit baseline: it is cheaper, easier to explain, and useful for checking whether neural graph context adds real value.", 820, 472, 360, 54, { size: 15, color: C.amber, align: "center" });
  note(slide, "This chart reads results/model_comparison.json. The four classical rows come from the existing walk-forward artifact; Fusion GRU and DCRNN come from the same 40-epoch research run with the same 168-hour-per-country test horizon.");
}

// 17. Classification performance
{
  const slide = newSlide("Model performance: classification metrics", "Rubric: classification and class imbalance", 17);
  addPanel(slide, 64, 118, 762, 464, "Precision, recall, and F1", "Stress classes are Normal, Warning, and Critical");
  addChart(slide, "bar", {
    position: { left: 88, top: 176, width: 710, height: 354 },
    categories: resultModels.map((m) => m.label.replace("24h ", "")),
    series: [
      { name: "Accuracy", values: resultModels.map((m) => m.accuracy), fill: C.cyan },
      { name: "Precision", values: resultModels.map((m) => m.precision), fill: C.mint },
      { name: "Recall", values: resultModels.map((m) => m.recall), fill: C.amber },
      { name: "F1", values: resultModels.map((m) => m.f1), fill: C.purple },
    ],
    hasLegend: true,
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 9, fill: C.white } },
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 22 },
    yAxis: { numberFormatCode: "0%" },
  });
  addPanel(slide, 864, 118, 352, 464, "Metric formulas", "How the values are calculated");
  addText(slide, "Accuracy = (TP + TN) / N", 888, 184, 300, 28, { size: 17, color: C.cyan, bold: true });
  addText(slide, "Precision = TP / (TP + FP)", 888, 236, 300, 28, { size: 17, color: C.mint, bold: true });
  addText(slide, "Recall = TP / (TP + FN)", 888, 288, 300, 28, { size: 17, color: C.amber, bold: true });
  addText(slide, "F1 = 2PR / (P + R)", 888, 340, 300, 28, { size: 17, color: C.purple, bold: true });
  addText(slide, "Macro precision, recall, and F1 average the three class-specific values. This prevents the Normal majority class from hiding weak Warning detection.", 888, 416, 280, 82, { size: 15, color: C.text });
  note(slide, "These metrics classify actual and predicted net-flow magnitudes using country-specific 75th percentile Warning and 90th percentile Critical thresholds derived from the pre-holdout history.");
}

// 18. Confusion matrix
{
  const slide = newSlide("Confusion matrix: DCRNN test result", "Rubric: validation detail", 18);
  const labels = ["Actual \\ Predicted", "Normal", "Warning", "Critical"];
  const matrixRows = [labels, ...["Normal", "Warning", "Critical"].map((row) => [row, confusion[row].Normal, confusion[row].Warning, confusion[row].Critical])];
  addPanel(slide, 64, 124, 570, 430, "Holdout confusion matrix", "2,016 one-step classifications");
  const table = addTable(slide, matrixRows, 112, 222, 474, 220, { fontSize: 18, columnWidths: [160, 104, 104, 106], headerFill: C.cyan });
  [1, 2, 3].forEach((col) => {
    const cell = table.getCell(col, col);
    cell.fill = `${C.mint}66`;
    cell.text.style = { fontFamily: FONT, fontSize: 20, color: C.white, bold: true };
  });
  addText(slide, "Rows = actual class\nColumns = predicted class", 112, 468, 474, 44, { size: 13, color: C.muted, align: "center" });
  addPanel(slide, 684, 124, 532, 430, "Per-class interpretation", "Why accuracy alone is not enough");
  const per = dcrnnPerClass;
  addText(slide, `Normal · P ${pct(per.Normal.precision)}  R ${pct(per.Normal.recall)}  F1 ${pct(per.Normal.f1)}`, 718, 212, 460, 28, { size: 17, color: C.mint, bold: true });
  addText(slide, `Warning · P ${pct(per.Warning.precision)}  R ${pct(per.Warning.recall)}  F1 ${pct(per.Warning.f1)}`, 718, 262, 460, 28, { size: 17, color: C.amber, bold: true });
  addText(slide, `Critical · P ${pct(per.Critical.precision)}  R ${pct(per.Critical.recall)}  F1 ${pct(per.Critical.f1)}`, 718, 312, 460, 28, { size: 17, color: C.coral, bold: true });
  addText(slide, "The Warning class is the weakest class because its boundary is harder to separate from Normal behavior. The matrix shows whether the model misses warning episodes or over-alerts.", 718, 390, 450, 70, { size: 16, color: C.text });
  addText(slide, "Formula connection: the per-class values come from TP, FP, and FN counts in this matrix.", 718, 494, 450, 30, { size: 14, color: C.white, bold: true });
  note(slide, `This table reads results/confusion_matrix.json generated by the DCRNN experiment. Rows are actual classes and columns are predicted classes. Class thresholds use the 75th and 90th percentiles of the training magnitude.`);
}

// 19. Validation curve
{
  const slide = newSlide("Validation curve and error analysis", "Rubric: testing and validation", 19);
  const curve = metrics.validation_curve;
  addPanel(slide, 64, 118, 806, 464, "Training-window diagnostics", "This is a chronological window trace, not a neural training-loss curve");
  addChart(slide, "line", {
    position: { left: 88, top: 176, width: 760, height: 352 },
    categories: curve.map((p) => `${p.window_days}d`),
    series: [
      { name: "Train MAE", values: curve.map((p) => p.train_mae), line: { fill: C.cyan, width: 3 }, marker: { symbol: "circle", size: 4, fill: C.cyan } },
      { name: "Validation MAE", values: curve.map((p) => p.validation_mae), line: { fill: C.amber, width: 3 }, marker: { symbol: "circle", size: 4, fill: C.amber } },
    ],
    hasLegend: true,
    lineOptions: { grouping: "standard", smooth: false },
  });
  addPanel(slide, 908, 118, 308, 464, "Reading the gap", "Evidence, not decoration");
  addBulletList(slide, [
    { text: "Training and validation error remain visible together", color: C.cyan },
    { text: "A widening gap signals weaker transfer from history to the holdout", color: C.amber },
    { text: "The final model is still selected on pooled RMSE", color: C.mint },
    { text: "Future work should add rolling-origin and calibrated uncertainty checks", color: C.purple },
  ], 934, 205, 252, 78, 14);
  note(slide, "The pipeline builds this curve by increasing the historical window and measuring train and validation MAE for the selected model. It supports the narrative that validation is treated as an explicit experiment.");
}

// 20. Physical loss
{
  const slide = newSlide("Distance-based physical-loss proxy", "Rubric: equations and engineering assumptions", 20);
  addPanel(slide, 64, 118, 500, 464, "Equations", "A transparent bridge from coordinates to a screening estimate");
  addText(slide, "1. Distance", 94, 188, 180, 22, { size: 15, color: C.cyan, bold: true });
  addText(slide, "L = Haversine(node₁, node₂)", 94, 220, 380, 30, { size: 22, color: C.white, bold: true });
  addText(slide, "2. Resistance", 94, 274, 180, 22, { size: 15, color: C.mint, bold: true });
  addText(slide, "R = ρ · L / A", 94, 306, 380, 30, { size: 22, color: C.white, bold: true });
  addText(slide, "3. Current and loss", 94, 360, 180, 22, { size: 15, color: C.amber, bold: true });
  addText(slide, "S = |P| / pf\nI = S / (√3 · V)\nP_loss = 3 · I² · R", 94, 392, 380, 102, { size: 22, color: C.white, bold: true });
  addPanel(slide, 606, 118, 610, 464, "Edge distance versus estimated loss", "Latest snapshot · selected interconnector magnitudes");
  const edgesSorted = latestEdges.slice().sort((a, b) => a.distance_km - b.distance_km);
  addChart(slide, "scatter", {
    position: { left: 632, top: 182, width: 548, height: 300 },
    series: [{ name: "Links", xValues: edgesSorted.map((e) => e.distance_km), values: edgesSorted.map((e) => e.current_loss_mw ?? e.estimated_loss_mw), marker: { symbol: "circle", size: 7, fill: C.purple }, line: { fill: C.purple, width: 1 } }],
    hasLegend: false,
    scatterOptions: { style: "marker" },
  });
  addText(slide, "Assumptions: 400 kV · PF 0.95 · copper ρ = 1.68×10⁻⁸ Ω·m · A = 2,000 mm²", 632, 506, 540, 24, { size: 13, color: C.purple, bold: true });
  addText(slide, "Engineering-grade loss remains unavailable because the dataset lacks surveyed corridors, conductor construction, thermal ratings, reactive power, and actual voltage.", 632, 540, 540, 40, { size: 14, color: C.coral });
  note(slide, "This slide is intentionally explicit about the boundary between physics education and operational engineering. The proxy uses country-centroid distance and assumed constants. Replace the assumptions when verified line data becomes available.");
}

// 21. Rerouting example
{
  const slide = newSlide("Stress-aware rerouting mechanism", "Rubric: prescriptive analytics", 21);
  addPanel(slide, 64, 118, 710, 464, "Decision sequence", "The system explains why a path is accepted or rejected");
  const seq = [
    ["1", "Select stressed link", "Example: remove a chosen percentage from one interconnector", C.coral],
    ["2", "Build alternate graph", "Exclude the selected link and inspect connected candidates", C.cyan],
    ["3", "Apply guardrails", "Reject Critical links and candidates without enough headroom", C.amber],
    ["4", "Score paths", "Penalize utilization, distance, warnings, and estimated loss", C.purple],
    ["5", "Explain result", "Show route, moved MW, loss delta, and bottlenecks", C.mint],
  ];
  seq.forEach(([n, title, body, color], i) => {
    const y = 178 + i * 72;
    addRect(slide, 96, y, 40, 40, color, { geometry: "ellipse" });
    addText(slide, n, 96, y + 9, 40, 20, { size: 16, color: C.bg, bold: true, align: "center" });
    addText(slide, title, 160, y + 1, 220, 22, { size: 17, color: C.white, bold: true });
    addText(slide, body, 382, y + 2, 350, 36, { size: 14, color: C.text });
  });
  addPanel(slide, 816, 118, 400, 464, "Scenario evidence", "A route is a screening result, not an operating command");
  const selected = latestEdges.slice().sort((a, b) => b.risk_score - a.risk_score)[0];
  const fallbackRoute = selected ? [selected.source, selected.target] : ["A", "B"];
  addText(slide, selected ? selected.id : "Selected link", 850, 190, 330, 34, { size: 27, color: C.coral, bold: true, align: "center" });
  addText(slide, "baseline → projected", 850, 244, 330, 20, { size: 14, color: C.muted, align: "center" });
  addText(slide, selected ? `${pct(selected.utilization)} → ${pct(Math.max(selected.utilization * 0.75, 0))}` : "—", 850, 270, 330, 32, { size: 26, color: C.white, bold: true, align: "center" });
  addText(slide, "Example route", 850, 346, 330, 20, { size: 14, color: C.muted, align: "center" });
  addText(slide, fallbackRoute.join("  →  "), 850, 376, 330, 26, { size: 20, color: C.purple, bold: true, align: "center" });
  addText(slide, "If no complete path meets guardrails, the UI reports BEST EFFORT and names the bottleneck edges.", 850, 454, 330, 56, { size: 15, color: C.amber, align: "center" });
  note(slide, "The live interface computes a shortest path over the visible graph. Its hard conditions are proxy headroom and critical-state avoidance. The route planner can return route_found, best_effort_only, no_alternate_path, or no_change.");
}

// 22. Interface implementation
{
  const slide = newSlide("Implementation and interface walkthrough", "Rubric: functionality and integration", 22);
  addPanel(slide, 64, 118, 730, 464, "Operator-facing screen design", "Each UI region answers a different question");
  addRect(slide, 92, 176, 676, 68, C.bg2, { geometry: "roundRect", line: C.cyan, lineWidth: 1 });
  addText(slide, "Header + KPIs", 112, 198, 160, 22, { size: 16, color: C.cyan, bold: true });
  addText(slide, "What is happening right now?", 340, 198, 360, 22, { size: 16, color: C.text });
  addRect(slide, 92, 264, 430, 230, C.bg2, { geometry: "roundRect", line: C.mint, lineWidth: 1 });
  addText(slide, "Animated topology", 112, 284, 220, 22, { size: 17, color: C.mint, bold: true });
  drawNetwork(slide, 134, 330, 350, 120, latestNodes, latestEdges, { edgeColor: `${C.blue}70`, edgeWidth: 1, labelSize: 8, nodeSize: () => 5 });
  addRect(slide, 542, 264, 226, 230, C.bg2, { geometry: "roundRect", line: C.amber, lineWidth: 1 });
  addText(slide, "Live signals", 562, 284, 160, 22, { size: 17, color: C.amber, bold: true });
  addText(slide, "risk ring\npriority queue\nclass counts", 590, 340, 160, 82, { size: 18, color: C.text, align: "center" });
  addPanel(slide, 842, 118, 374, 464, "Decision workflow in the UI", "From screen to action");
  addBulletList(slide, [
    { text: "Read current timestamp and pressure", color: C.cyan },
    { text: "Click a node or line for a plain-language callout", color: C.mint },
    { text: "Inspect Physics Lens for distance and loss", color: C.purple },
    { text: "Run a reroute scenario with a flow share", color: C.amber },
    { text: "Review path, loss delta, and bottlenecks", color: C.coral },
    { text: "Validate with an engineer before use", color: C.white },
  ], 870, 210, 310, 55, 15);
  addText(slide, "The interface turns equations into an explanation a non-specialist can follow.", 870, 534, 300, 40, { size: 15, color: C.white, bold: true, align: "center" });
  note(slide, "This slide demonstrates integration. The dashboard uses native SVG for the network and charts, server-sent events for replay, and a scenario form for rerouting. It is intentionally recommendation-only.");
}

// 23. Results and limitations
{
  const slide = newSlide("Results, limitations, and future scope", "Rubric: feasibility, risks, refinement", 23);
  addPanel(slide, 64, 118, 360, 466, "Results", "What the current implementation establishes");
  addBulletList(slide, [
    { text: "Reproducible artifacts from 1.59M input rows", color: C.cyan },
    { text: "12-node, 24-link canonical graph", color: C.mint },
    { text: "Persistence selected with RMSE 580.3 MW", color: C.blue },
    { text: "91.4% holdout accuracy, 81.2% macro F1", color: C.amber },
    { text: "Distance and I²R proxy visible in the interface", color: C.purple },
    { text: "Route search returns an explainable path or bottleneck", color: C.coral },
  ], 90, 196, 310, 50, 15);
  addPanel(slide, 460, 118, 360, 466, "Limitations", "What the project must not overclaim");
  addBulletList(slide, [
    { text: "Historical replay, not live utility telemetry", color: C.coral },
    { text: "Capacity is an observed-flow proxy, not a thermal rating", color: C.amber },
    { text: "Loss uses centroid distance and assumed constants", color: C.purple },
    { text: "No voltage stability or N-1 power-flow solver", color: C.blue },
    { text: "DCRNN is a benchmark, not proof of engineering superiority", color: C.mint },
  ], 486, 196, 312, 55, 15);
  addPanel(slide, 856, 118, 360, 466, "Future scope", "Experiments that would strengthen the research");
  addBulletList(slide, [
    { text: "Add verified line geometry, conductor, voltage, and capacity data", color: C.cyan },
    { text: "Extend the completed DCRNN benchmark with GCN, GAT, and GraphSAGE", color: C.mint },
    { text: "Add conformal uncertainty with coverage evaluation", color: C.amber },
    { text: "Run ablations across topology, weather, and quality flags", color: C.purple },
    { text: "Validate route recommendations in an engineering solver", color: C.coral },
  ], 882, 196, 310, 55, 15);
  addText(slide, "Bottom line: the project delivers a credible, explainable prototype and a clear path to engineering-grade research.", 90, 610, 1110, 28, { size: 18, color: C.white, bold: true, align: "center" });
  note(slide, "Close with the boundary. The project is strong because it makes uncertainty and missing engineering data visible. The future work list turns those limitations into experiments.");
}

// 24. Fusion GRU training curves
{
  const slide = newSlide("Fusion GRU training curves", "Saved experiment results", 24);
  const epochs = resultCurves.epochs;
  addPanel(slide, 64, 118, 560, 464, "Loss over epochs", "Training and validation MSE on the normalized target");
  addChart(slide, "line", {
    position: { left: 88, top: 182, width: 512, height: 320 },
    categories: epochs.map((row) => String(row.epoch)),
    series: [
      { name: "Train loss", values: epochs.map((row) => row.train_loss), line: { fill: C.cyan, width: 3 }, marker: { symbol: "circle", size: 3, fill: C.cyan } },
      { name: "Validation loss", values: epochs.map((row) => row.validation_loss), line: { fill: C.amber, width: 3 }, marker: { symbol: "circle", size: 3, fill: C.amber } },
    ],
    hasLegend: true,
    lineOptions: { grouping: "standard", smooth: true },
  });
  addPanel(slide, 656, 118, 560, 464, "Macro-F1 over epochs", "The validation curve is the overfitting check");
  addChart(slide, "line", {
    position: { left: 680, top: 182, width: 512, height: 320 },
    categories: epochs.map((row) => String(row.epoch)),
    series: [
      { name: "Train F1", values: epochs.map((row) => row.train_f1), line: { fill: C.mint, width: 3 }, marker: { symbol: "circle", size: 3, fill: C.mint } },
      { name: "Validation F1", values: epochs.map((row) => row.validation_f1), line: { fill: C.coral, width: 3 }, marker: { symbol: "circle", size: 3, fill: C.coral } },
    ],
    hasLegend: true,
    lineOptions: { grouping: "standard", smooth: true },
    yAxis: { min: 0, max: 1, numberFormatCode: "0%", majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 10, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
  });
  const lastCurve = epochs.at(-1);
  addText(slide, `Final validation F1 ${pct(lastCurve.validation_f1)} · train/validation loss gap ${fmt(lastCurve.validation_loss - lastCurve.train_loss, 3)}`, 88, 526, 1104, 26, { size: 15, color: C.white, bold: true, align: "center" });
  note(slide, "This slide reads results/training_curves.json generated during the Fusion GRU run. The loss traces use normalized target MSE. The F1 traces use the same 75th and 90th percentile magnitude thresholds used for the holdout classification report.");
}

// 25. ROC and precision-recall
{
  const slide = newSlide("DCRNN ROC-AUC and precision-recall analysis", "Saved experiment results", 25);
  const thresholds = resultRocPr.curves[resultRocPr.classes[0]].roc.map((point, index) => String(index));
  addPanel(slide, 64, 118, 560, 464, "One-vs-rest ROC", "Threshold sweep across Normal, Warning, and Critical");
  addChart(slide, "line", {
    position: { left: 88, top: 182, width: 512, height: 300 },
    categories: thresholds,
    series: resultRocPr.classes.map((label, index) => ({ name: `${label} AUC ${fmt(resultRocPr.curves[label].roc_auc, 2)}`, values: resultRocPr.curves[label].roc.map((point) => point.tpr), line: { fill: [C.cyan, C.amber, C.coral][index], width: 2 }, marker: { symbol: "circle", size: 2, fill: [C.cyan, C.amber, C.coral][index] } })),
    hasLegend: true,
    lineOptions: { grouping: "standard", smooth: false },
    yAxis: { min: 0, max: 1, numberFormatCode: "0%", majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 10, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
  });
  addText(slide, "TPR = TP / (TP + FN) · FPR = FP / (FP + TN)", 88, 506, 512, 26, { size: 14, color: C.white, bold: true, align: "center" });
  addPanel(slide, 656, 118, 560, 464, "One-vs-rest precision-recall", "Useful when the Warning or Critical class is rare");
  addChart(slide, "line", {
    position: { left: 680, top: 182, width: 512, height: 300 },
    categories: thresholds,
    series: resultRocPr.classes.map((label, index) => ({ name: `${label} AUC ${fmt(resultRocPr.curves[label].pr_auc, 2)}`, values: resultRocPr.curves[label].pr.map((point) => point.precision), line: { fill: [C.cyan, C.amber, C.coral][index], width: 2 }, marker: { symbol: "circle", size: 2, fill: [C.cyan, C.amber, C.coral][index] } })),
    hasLegend: true,
    lineOptions: { grouping: "standard", smooth: false },
    yAxis: { min: 0, max: 1, numberFormatCode: "0%", majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 10, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
  });
  addText(slide, "Precision = TP / (TP + FP) · Recall = TP / (TP + FN)", 680, 506, 512, 26, { size: 14, color: C.white, bold: true, align: "center" });
  note(slide, "The curves come from results/roc_pr_curves.json generated for DCRNN. The experiment converts predicted magnitude into continuous one-vs-rest scores using the training Warning and Critical quantiles, then sweeps 101 thresholds. These are screening curves, not calibrated probabilities.");
}

// 26. Model comparison and GRU interpretation
{
  const slide = newSlide("Model comparison: Fusion GRU and DCRNN", "Saved experiment results", 26);
  addPanel(slide, 64, 118, 760, 464, "Classification metrics", "Four baselines plus two trained sequence models");
  addChart(slide, "bar", {
    position: { left: 88, top: 180, width: 712, height: 330 },
    categories: resultModels.map((item) => item.label.replace("24h ", "")),
    series: [
      { name: "Accuracy", values: resultModels.map((item) => item.accuracy), fill: C.cyan },
      { name: "Precision", values: resultModels.map((item) => item.precision), fill: C.mint },
      { name: "Recall", values: resultModels.map((item) => item.recall), fill: C.amber },
      { name: "F1", values: resultModels.map((item) => item.f1), fill: C.purple },
    ],
    hasLegend: true,
    dataLabels: { showValue: false },
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 18 },
    yAxis: { min: 0, max: 1, numberFormatCode: "0%", majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 10, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
  });
  addPanel(slide, 858, 118, 358, 464, "What the saved run says", "Interpretation of the comparison");
  const baseline = resultFusionAnalysis.selected_baseline;
  const rmseDelta = safeDiv(baseline.rmse - resultFusion.rmse, baseline.rmse);
  const dcrnnDelta = safeDiv(resultDcrnn.rmse - baseline.rmse, baseline.rmse);
  addText(slide, `Fusion GRU\nRMSE ${fmt(resultFusion.rmse, 1)} MW\nF1 ${pct(resultFusion.f1)}`, 884, 166, 306, 78, { size: 18, color: C.cyan, bold: true, align: "center" });
  addText(slide, `DCRNN\nRMSE ${fmt(resultDcrnn.rmse, 1)} MW\nF1 ${pct(resultDcrnn.f1)}`, 884, 256, 306, 78, { size: 18, color: C.purple, bold: true, align: "center" });
  addText(slide, `Against Persistence: GRU ${pct(rmseDelta)} lower RMSE · DCRNN ${pct(dcrnnDelta)} higher RMSE`, 884, 354, 306, 44, { size: 14, color: dcrnnDelta > 0 ? C.amber : C.mint, bold: true, align: "center" });
  addText(slide, `Inference for 2,016 node-hours\nPersistence ${fmt(baseline.inference_time_ms, 1)} ms · GRU ${fmt(resultFusion.inference_time_ms, 1)} ms · DCRNN ${fmt(resultDcrnn.inference_time_ms, 1)} ms`, 884, 414, 306, 52, { size: 12, color: C.text, align: "center" });
  addBulletList(slide, resultDcrnnAnalysis.diagnosis.slice(0, 2).map((text, index) => ({ text, color: [C.cyan, C.amber][index] || C.white })), 884, 490, 300, 36, 11);
  note(slide, "This slide embeds the saved model_comparison.json and dcrnn_analysis.json artifacts. Fusion GRU wins the current research comparison on RMSE and macro-F1; DCRNN is a genuine graph-aware benchmark but remains slower and weaker on this dataset. Persistence remains the operational audit baseline.");
}

// 27. Feature interpretation and embeddings
{
  const slide = newSlide("Feature interpretation and learned embeddings", "Saved experiment results", 27);
  addPanel(slide, 64, 118, 560, 464, "Permutation importance", "Validation MAE increase after shuffling one feature");
  const featureRows = resultFeatures.features.slice().sort((a, b) => b.permutation_delta_mae - a.permutation_delta_mae);
  addChart(slide, "bar", {
    position: { left: 88, top: 178, width: 512, height: 330 },
    categories: featureRows.map((row) => row.feature),
    series: [{ name: "Δ validation MAE (MW)", values: featureRows.map((row) => row.permutation_delta_mae), fill: C.purple }],
    hasLegend: false,
    dataLabels: { showValue: false },
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 26 },
  });
  addText(slide, "Ablation repeats the test after replacing one feature with its training mean. Positive Δ means the model used that signal.", 88, 526, 512, 28, { size: 13, color: C.white, align: "center" });
  addPanel(slide, 656, 118, 560, 464, "t-SNE of Fusion GRU hidden states", "Validation sequences colored by stress class");
  const embeddingSeries = resultRocPr.classes.map((label, index) => {
    const points = resultEmbedding.points.filter((point) => point.class === label);
    return { name: label, xValues: points.map((point) => point.x), values: points.map((point) => point.y), marker: { symbol: "circle", size: 5, fill: [C.cyan, C.amber, C.coral][index] } };
  });
  addChart(slide, "scatter", {
    position: { left: 680, top: 178, width: 512, height: 330 },
    series: embeddingSeries,
    hasLegend: true,
    scatterOptions: { style: "marker", varyColors: false },
  });
  addText(slide, "The projection is interpretive: nearby points share hidden-state geometry, but t-SNE does not prove causal feature separation.", 680, 526, 512, 28, { size: 13, color: C.white, align: "center" });
  note(slide, "Feature rows come from results/feature_importance.json. The importance score is a validation permutation delta, not a causal SHAP explanation. The t-SNE points come from the trained GRU hidden state for validation windows and are stored in embedding_projection.json.");
}

// 28. Error analysis
{
  const slide = newSlide("Error analysis: successful and failed examples", "Saved experiment results", 28);
  const successes = resultErrors.successes.slice(0, 3);
  const failures = resultErrors.failures.slice(0, 3);
  const cases = [
    ...successes.map((row, index) => ["Success", row.country, row.timestamp.slice(0, 16), `${row.actual_class} / ${row.predicted_class}`, fmt(row.absolute_error_mw, 1)]),
    ...failures.map((row, index) => ["Failure", row.country, row.timestamp.slice(0, 16), `${row.actual_class} / ${row.predicted_class}`, fmt(row.absolute_error_mw, 1)]),
  ];
  addPanel(slide, 64, 118, 720, 464, "Qualitative holdout examples", "Rows are saved from error_analysis.json, not selected for presentation aesthetics");
  addTable(slide, [["Case", "Country", "Timestamp", "Actual / predicted", "|error| MW"], ...cases], 88, 190, 672, 270, { fontSize: 12, columnWidths: [88, 92, 168, 174, 106], headerFill: C.cyan });
  addText(slide, "Successes show low-error persistence; failures expose class-boundary changes and abrupt flow movements that a one-step model cannot anticipate.", 88, 492, 672, 48, { size: 15, color: C.white, bold: true, align: "center" });
  addPanel(slide, 816, 118, 400, 464, "Failure magnitude", "Absolute error for the selected examples");
  const labels = [...successes.map((_, index) => `S${index + 1}`), ...failures.map((_, index) => `F${index + 1}`)];
  addChart(slide, "bar", {
    position: { left: 842, top: 188, width: 348, height: 250 },
    categories: labels,
    series: [
      { name: "Success", values: [...successes.map((row) => row.absolute_error_mw), ...failures.map(() => 0)], fill: C.mint },
      { name: "Failure", values: [...successes.map(() => 0), ...failures.map((row) => row.absolute_error_mw)], fill: C.coral },
    ],
    hasLegend: true,
    dataLabels: { showValue: false },
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 25 },
  });
  addText(slide, "Use these cases to guide the next experiment: add exogenous weather, market, dispatch, and engineering capacity signals before claiming generalization.", 842, 468, 348, 72, { size: 14, color: C.text, align: "center" });
  note(slide, "The examples are generated from the Fusion GRU test predictions. A success is a correctly classified low-error example; a failure is a misclassified example, ranked by absolute error. This provides a concrete qualitative audit trail for the metrics.");
}

// 29. Algorithm guide: classical baselines
{
  const slide = newSlide("Algorithm guide: four transparent baselines", "How each approach makes a forecast", 29);
  addPanel(slide, 64, 118, 1152, 392, "One toy example, four different rules", "Assume the recent net-flow history ends with 600, 700, 900, 800 MW. These numbers explain the rule; the reported scores come from the real holdout.");
  addTable(slide, [
    ["Approach", "What it does", "Toy next-hour example", "Why it is included"],
    ["Persistence", "Copies the latest observation", "ŷ = 800 MW", "Fastest audit baseline for an autocorrelated series"],
    ["24h moving average", "Averages the last 24 hourly values", "If the 24h mean is 720, then ŷ = 720 MW", "Smooths noise but can miss sharp changes"],
    ["Seasonal naive", "Copies the value from the same hour yesterday", "If y(t−23) = 650, then ŷ = 650 MW", "Tests whether daily repetition is useful"],
    ["Linear trend", "Fits ŷ = β₀ + β₁t to the recent window", "If the fitted slope is +50 MW/h, then ŷ ≈ 850 MW", "Tests whether a short trend extrapolates safely"],
  ], 88, 184, 1104, 276, { fontSize: 12, columnWidths: [150, 300, 330, 324], headerFill: C.cyan });
  addText(slide, "The model router compares these rules before it trusts a neural model. A more complex method has to earn its place on the same chronological test window.", 94, 536, 1092, 34, { size: 17, color: C.white, bold: true, align: "center" });
  note(slide, "This slide explains the four classical algorithms with a toy example so a reader does not need prior forecasting knowledge. The actual metrics are calculated on the supplied hourly dataset and stored in results/model_comparison.json.");
}

// 30. Algorithm guide: Fusion GRU
{
  const slide = newSlide("Algorithm guide: Fusion GRU", "How the first neural model makes a forecast", 30);
  addPanel(slide, 64, 118, 670, 464, "A single example at one country", "Fusion GRU receives 24 hourly steps and combines local, network, and static graph signals");
  const blocks = [
    ["24-hour local window", "flow · load\nimbalance · residual", C.cyan],
    ["Global context", "mean flow · load\nmean stress signals", C.mint],
    ["Static graph", "degree · closeness\nbetweenness", C.purple],
    ["GRU memory", "update gate\nreset gate", C.amber],
    ["Next flow", "ŷ(t+1) in MW", C.coral],
  ];
  blocks.forEach(([title, body, color], index) => {
    const x = 92 + index * 122;
    addRect(slide, x, 248, 104, 116, C.bg2, { geometry: "roundRect", line: color, lineWidth: 2 });
    addText(slide, title, x + 8, 264, 88, 30, { size: 12, color, bold: true, align: "center" });
    addText(slide, body, x + 8, 306, 88, 40, { size: 11, color: C.text, align: "center" });
    if (index < blocks.length - 1) addText(slide, "→", x + 106, 292, 18, 24, { size: 16, color: C.muted, bold: true, align: "center" });
  });
  addText(slide, "Example reading: if DE has a high recent flow but neighboring countries show stable load and imbalance, the GRU can retain the local pressure while using the network context to moderate the prediction.", 94, 430, 600, 66, { size: 16, color: C.text, align: "center" });
  addPanel(slide, 778, 118, 438, 464, "What the saved run found", "The neural model is judged by holdout evidence");
  addText(slide, `Fusion GRU\nRMSE ${fmt(resultFusion.rmse, 1)} MW\nMAE ${fmt(resultFusion.mae, 1)} MW`, 818, 190, 358, 92, { size: 24, color: C.cyan, bold: true, align: "center" });
  addText(slide, `Accuracy ${pct(resultFusion.accuracy)} · macro-F1 ${pct(resultFusion.f1)}`, 818, 306, 358, 28, { size: 16, color: C.mint, bold: true, align: "center" });
  addText(slide, "The gates do not make a forecast from a single feature. They learn when to keep recent memory and when to update it with a new graph-and-demand pattern.", 818, 382, 358, 76, { size: 16, color: C.text, align: "center" });
  addText(slide, "Training target: next-hour country net flow", 818, 500, 358, 24, { size: 14, color: C.amber, bold: true, align: "center" });
  note(slide, "Fusion GRU is the local-plus-global sequence model. The example is explanatory, while the displayed metrics come from the saved 40-epoch run. The model is not a dispatch controller.");
}

// 31. Algorithm guide: DCRNN
{
  const slide = newSlide("Algorithm guide: DCRNN", "How graph diffusion changes the forecast", 31);
  addPanel(slide, 64, 118, 560, 464, "The graph operation", "DCRNN passes a node's signal through neighboring interconnectors before the recurrent update");
  const graphNodes = [["DE", 154, 300, C.coral], ["NL", 310, 218, C.cyan], ["FR", 310, 382, C.mint], ["PL", 480, 300, C.amber]];
  addLine(slide, 169, 292, 295, 226, C.grid, 3); addLine(slide, 169, 308, 295, 374, C.grid, 3); addLine(slide, 325, 226, 465, 292, C.grid, 3); addLine(slide, 325, 374, 465, 308, C.grid, 3);
  graphNodes.forEach(([label, x, y, color]) => { addRect(slide, x - 28, y - 28, 56, 56, color, { geometry: "ellipse", line: C.white, lineWidth: 2 }); addText(slide, label, x - 22, y - 8, 44, 18, { size: 14, color: C.white, bold: true, align: "center" }); });
  addText(slide, "DE's input can receive\nforward and reverse\nneighbor context", 106, 470, 460, 54, { size: 16, color: C.text, align: "center" });
  addPanel(slide, 668, 118, 548, 464, "The equation in plain language", "The same 24-hour window is processed at each time step");
  addText(slide, "H⁽⁰⁾ₜ = Xₜ", 704, 182, 470, 28, { size: 22, color: C.cyan, bold: true });
  addText(slide, "Start with each country's current features", 704, 214, 470, 22, { size: 14, color: C.text });
  addText(slide, "H⁽ᵏ⁺¹⁾ₜ = P H⁽ᵏ⁾ₜ", 704, 262, 470, 28, { size: 22, color: C.mint, bold: true });
  addText(slide, "Move information one graph step at a time", 704, 294, 470, 22, { size: 14, color: C.text });
  addText(slide, "Dₜ = [Xₜ, P Xₜ, P² Xₜ, Pᵀ Xₜ, (Pᵀ)² Xₜ]", 704, 342, 470, 32, { size: 19, color: C.purple, bold: true });
  addText(slide, "Concatenate self, two forward steps, and two reverse steps", 704, 378, 470, 22, { size: 14, color: C.text });
  addText(slide, "ŷₜ₊₁ = W · DCRNNCell(Dₜ, hₜ₋₁) + b", 704, 430, 470, 32, { size: 19, color: C.coral, bold: true });
  addText(slide, `Saved DCRNN result: RMSE ${fmt(resultDcrnn.rmse, 1)} MW · macro-F1 ${pct(resultDcrnn.f1)}`, 704, 500, 470, 28, { size: 15, color: C.white, bold: true });
  note(slide, "DCRNN uses two row-normalized transition matrices: forward and reverse walks over the 24 canonical links. The model preserves the node dimension instead of replacing the graph with one global average. The displayed result is the actual run from results/dcrnn_analysis.json.");
}

// 32. DCRNN training traces
{
  const slide = newSlide("DCRNN training curves", "Saved experiment results", 32);
  const epochs = resultDcrnnCurves.epochs;
  addPanel(slide, 64, 118, 560, 464, "Loss over epochs", "DCRNN MSE on the standardized next-flow target");
  addChart(slide, "line", {
    position: { left: 88, top: 182, width: 512, height: 320 },
    categories: epochs.map((row) => String(row.epoch)),
    series: [
      { name: "Train loss", values: epochs.map((row) => row.train_loss), line: { fill: C.cyan, width: 3 }, marker: { symbol: "circle", size: 3, fill: C.cyan } },
      { name: "Validation loss", values: epochs.map((row) => row.validation_loss), line: { fill: C.amber, width: 3 }, marker: { symbol: "circle", size: 3, fill: C.amber } },
    ],
    hasLegend: true,
    lineOptions: { grouping: "standard", smooth: true },
  });
  addPanel(slide, 656, 118, 560, 464, "Macro-F1 over epochs", "The class metric checks whether stress labels improve with training");
  addChart(slide, "line", {
    position: { left: 680, top: 182, width: 512, height: 320 },
    categories: epochs.map((row) => String(row.epoch)),
    series: [
      { name: "Train F1", values: epochs.map((row) => row.train_f1), line: { fill: C.mint, width: 3 }, marker: { symbol: "circle", size: 3, fill: C.mint } },
      { name: "Validation F1", values: epochs.map((row) => row.validation_f1), line: { fill: C.coral, width: 3 }, marker: { symbol: "circle", size: 3, fill: C.coral } },
    ],
    hasLegend: true,
    lineOptions: { grouping: "standard", smooth: true },
    yAxis: { min: 0, max: 1, numberFormatCode: "0%", majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 10, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
  });
  const lastCurve = epochs.at(-1);
  addText(slide, `Final validation F1 ${pct(lastCurve.validation_f1)} · training/validation loss gap ${fmt(lastCurve.validation_loss - lastCurve.train_loss, 3)}`, 88, 526, 1104, 26, { size: 15, color: C.white, bold: true, align: "center" });
  note(slide, "This slide reads results/dcrnn_training_curves.json. The traces use the same chronological split as Fusion GRU. The curves show model learning behavior; the holdout metrics remain the decision evidence.");
}

// 33. DCRNN comparison and diagnosis
{
  const slide = newSlide("DCRNN comparison and diagnosis", "Why graph context did not win this run", 33);
  addPanel(slide, 64, 118, 704, 464, "The three important rows", "RMSE lower is better; macro-F1 higher is better");
  addChart(slide, "bar", {
    position: { left: 88, top: 178, width: 656, height: 332 },
    categories: ["Persistence", "Fusion GRU", "DCRNN"],
    series: [
      { name: "RMSE / 2,000", values: [baselineMetricsValue("persistence", "rmse") / 2000, resultFusion.rmse / 2000, resultDcrnn.rmse / 2000], fill: C.cyan },
      { name: "Macro-F1", values: [baselineMetricsValue("persistence", "f1"), resultFusion.f1, resultDcrnn.f1], fill: C.purple },
    ],
    hasLegend: true,
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 36 },
    yAxis: { min: 0, max: 1, numberFormatCode: "0.0", majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 10, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
  });
  addText(slide, "RMSE bars are divided by 2,000 only so both scales fit in one editable chart. The table and labels above retain the original units.", 92, 526, 650, 28, { size: 12, color: C.muted, align: "center" });
  addPanel(slide, 802, 118, 414, 464, "Why DCRNN trails Fusion GRU here", "A result is useful when it explains the boundary of the method");
  addBulletList(slide, [
    { text: `DCRNN RMSE is ${fmt(resultDcrnn.rmse, 1)} MW versus Fusion GRU ${fmt(resultFusion.rmse, 1)} MW`, color: C.coral },
    { text: "The graph is only 12 nodes and 24 links, so diffusion adds limited new information beyond global context", color: C.amber },
    { text: "The data has no verified ratings, dispatch constraints, market shocks, or route geometry", color: C.purple },
    { text: "Persistence remains hard to beat because hourly flow is strongly autocorrelated", color: C.cyan },
    { text: "The model is slower and more complex, so it needs more evidence before operational use", color: C.mint },
  ], 830, 196, 360, 56, 14);
  addText(slide, "Conclusion: graph diffusion is implemented and measured. It is not automatically the winner.", 830, 510, 360, 44, { size: 15, color: C.white, bold: true, align: "center" });
  note(slide, "This slide uses results/model_comparison.json and results/dcrnn_analysis.json. The conclusion is deliberately bounded: DCRNN is a real benchmark, but this dataset and feature set do not provide enough evidence to prefer it over Fusion GRU or the operational Persistence baseline.");
}

// 34. Evidence pack
{
  const slide = newSlide("Saved evidence pack", "Dataset, preprocessing, features, and reproducibility", 34);
  addPanel(slide, 64, 118, 520, 464, "What the project saves before the PPT", "The presentation reads files generated by the experiment runner");
  addTable(slide, [
    ["Artifact", "Purpose"],
    ["dataset_profile.json", "Rows, columns, countries, graph size, quality checks"],
    ["preprocessing_summary.json", "Parsing, validation, canonicalization, scaling, split"],
    ["feature_catalog.json", "11 extracted features with formulas and reasons"],
    ["model_comparison.json", "All six models and the selection rule"],
    ["dcrnn_training_curves.json", "Loss, accuracy, and macro-F1 by epoch"],
    ["confusion_matrix.json", "DCRNN class counts and thresholds"],
    ["results/models/*.pt", "Saved Fusion GRU and DCRNN checkpoints"],
  ], 88, 184, 472, 330, { fontSize: 12, columnWidths: [192, 280], headerFill: C.cyan });
  addPanel(slide, 624, 118, 592, 464, "The numbers behind this deck", "A reviewer can reproduce the full evidence chain");
  addText(slide, `${fmt(datasetProfile.dynamic_rows)} dynamic rows · ${fmt(datasetProfile.power_flow_rows)} power-flow rows`, 660, 186, 520, 28, { size: 21, color: C.cyan, bold: true, align: "center" });
  addText(slide, `${datasetProfile.node_count} countries · ${datasetProfile.edge_count} canonical links · ${datasetProfile.processed_history_points_per_country} aligned hourly points`, 660, 230, 520, 24, { size: 15, color: C.mint, bold: true, align: "center" });
  addText(slide, "python backend/pipeline.py\npython backend/experiments.py\npython backend/server.py", 690, 306, 460, 94, { size: 22, color: C.white, bold: true, align: "center" });
  addText(slide, "The browser remains a historical replay and decision-support interface. The PPT does not invent metrics in slide code; charts read the saved JSON and CSV artifacts.", 680, 460, 480, 64, { size: 16, color: C.text, align: "center" });
  note(slide, "This slide makes the evidence chain explicit. The dataset profile, preprocessing summary, feature catalog, model comparison, curves, confusion matrix, and checkpoints all live under results/ and are generated before the deck build.");
}

// 35. Feature extraction graph
{
  const slide = newSlide("Feature extraction graph", "From raw measurements to a model-ready decision window", 35);
  addPanel(slide, 64, 118, 1152, 468, "How the dataset becomes an input tensor", "Every box below corresponds to the saved feature catalog and preprocessing artifacts");

  const stage = (x, title, body, accent, width = 182) => {
    addRect(slide, x, 180, width, 132, C.panel2, { geometry: "roundRect", line: accent, lineWidth: 2 });
    addRect(slide, x, 180, width, 8, accent, { geometry: "roundRect", line: accent, lineWidth: 0 });
    addText(slide, title, x + 12, 200, width - 24, 22, { size: 15, color: C.white, bold: true, align: "center" });
    addText(slide, body, x + 12, 232, width - 24, 66, { size: 11, color: C.text, align: "center" });
  };
  const arrow = (x1, x2) => {
    addLine(slide, x1, 246, x2, 246, C.muted, 2);
    addText(slide, "→", x2 - 12, 230, 24, 32, { size: 22, color: C.cyan, bold: true, align: "center" });
  };

  stage(84, "1 · Observe", "dynamic_with_flows.csv\nloads · flows · imbalance\n\npower_flow.csv\nlinks · latitude/longitude", C.cyan, 188);
  stage(300, "2 · Prepare", "parse hourly timestamps\ncanonicalize country IDs\nvalidate links and gaps\ntrain-only scaling", C.mint, 188);
  stage(516, "3 · Extract", "LOCAL: 4 signals per node\nNETWORK: 4 system aggregates\nGRAPH: 3 centrality signals\n\n4 + 4 + 3 = 11 features", C.purple, 210);
  stage(752, "4 · Represent", "rolling lookback window\n\nX = 24 hours × 12 nodes × 11 features\ny = next-hour flow for 12 nodes", C.amber, 188);
  stage(968, "5 · Decide", "Fusion GRU + DCRNN\nforecast flow and risk\nNormal / Warning / Critical\nthen rank reroute actions", C.coral, 194);
  arrow(272, 300);
  arrow(488, 516);
  arrow(726, 752);
  arrow(940, 968);

  addRect(slide, 92, 350, 350, 176, C.bg2, { geometry: "roundRect", line: C.cyan, lineWidth: 1 });
  addText(slide, "Local feature vector for node i", 110, 368, 312, 22, { size: 14, color: C.cyan, bold: true, align: "center" });
  addText(slide, "localᵢ(t) = [flowᵢ, loadᵢ, imbalanceᵢ, residualᵢ]", 112, 408, 310, 30, { size: 14, color: C.white, bold: true, align: "center" });
  addText(slide, "Recent history anchors the forecast.\nLoad and forecast error explain demand pressure.\nImbalance indicates directional stress.", 120, 456, 294, 54, { size: 11, color: C.text, align: "center" });

  addRect(slide, 462, 350, 350, 176, C.bg2, { geometry: "roundRect", line: C.mint, lineWidth: 1 });
  addText(slide, "Network + topology context", 480, 368, 314, 22, { size: 14, color: C.mint, bold: true, align: "center" });
  addText(slide, "global(t) = meanᵢ(localᵢ(t))\nstaticᵢ = [degree, closeness, betweenness]", 480, 403, 314, 48, { size: 13, color: C.white, bold: true, align: "center" });
  addText(slide, "Global signals describe shared system pressure.\nCentrality describes how a node sits in the grid graph.", 488, 466, 298, 42, { size: 11, color: C.text, align: "center" });

  addRect(slide, 832, 350, 350, 176, C.bg2, { geometry: "roundRect", line: C.coral, lineWidth: 1 });
  addText(slide, "The learning target", 850, 368, 314, 22, { size: 14, color: C.coral, bold: true, align: "center" });
  addText(slide, "Xₜ₋₂₃:ₜ ∈ R²⁴×¹²×¹¹  →  ŷₜ₊₁ ∈ R¹²", 850, 403, 314, 30, { size: 15, color: C.white, bold: true, align: "center" });
  addText(slide, "The same window is evaluated by both models.\nA forecast becomes a risk class using the\ntraining-only 75th and 90th percentile thresholds.", 856, 456, 300, 54, { size: 11, color: C.text, align: "center" });

  addText(slide, "This is the dedicated feature-extraction graph missing from the earlier deck. It is tied to results/feature_catalog.json (11 features) and results/preprocessing_summary.json, not presentation-only numbers.", 94, 548, 1090, 24, { size: 11, color: C.muted, italic: true, align: "center" });
  note(slide, "This slide is the explicit raw-data → preprocessing → feature extraction → tensor → model decision graph. The feature names, formulas, and tensor shape are read from results/feature_catalog.json and the split/scaling rules from results/preprocessing_summary.json.");
}

// 36. References and reproducibility
{
  const slide = newSlide("References and reproducibility", "Project record", 36);
  addPanel(slide, 64, 118, 560, 468, "Research references", "Recorded in docs/RESEARCH_NOTES.md");
  addText(slide, "• DCRNN · arXiv:1707.01926\n• Graph WaveNet · arXiv:1906.00121\n• Power-system GNN survey · IEEE 2024\n• MS-STGNN · IEEE TSG 2023\n• Grid-aware STGNN · ACM 2025\n• Conformalized quantile regression for load forecasting", 96, 190, 492, 174, { size: 16, color: C.text });
  addText(slide, "The project’s own documentation keeps the literature review, SRS, validation report, user manual, and implementation assumptions together.", 96, 420, 484, 56, { size: 16, color: C.white });
  addPanel(slide, 660, 118, 556, 468, "Reproduce the result", "Run the same pipeline from the project folder");
  addText(slide, "python backend/pipeline.py\npython backend/server.py\nopen http://localhost:8000", 704, 210, 464, 104, { size: 24, color: C.cyan, bold: true });
  addText(slide, "Generated artifacts", 704, 376, 200, 22, { size: 15, color: C.mint, bold: true });
  addText(slide, "data/processed/manifest.json\ndata/processed/series.json\ndata/processed/model_metrics.json\ndata/processed/snapshot.json", 704, 408, 450, 100, { size: 16, color: C.text });
  addText(slide, "Questions", 64, 625, 1130, 30, { size: 26, color: C.white, bold: true, align: "center" });
  note(slide, "The final slide points the reviewer to the project record and reproducible commands. The literature links and assumptions are stored in the repository documents.");
}

await fs.mkdir(OUTPUT, { recursive: true });
for (const [index, slide] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(BUILD, `slide-${String(index + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}
const montage = await presentation.export({ format: "webp", montage: true });
await fs.writeFile(path.join(BUILD, "deck-montage.webp"), new Uint8Array(await montage.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(path.join(BUILD, "candidate.pptx"));
console.log(JSON.stringify({ slides: presentation.slides.items.length, candidate: path.join(BUILD, "candidate.pptx"), montage: path.join(BUILD, "deck-montage.webp") }));
