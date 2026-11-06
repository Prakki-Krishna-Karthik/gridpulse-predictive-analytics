import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:/Users/Krishna Karthik/Desktop/predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build-10min");
const OUTPUT = path.join(ROOT, ".codex-ppt-output-10min");
const CANDIDATE = path.join(BUILD, "GridPulse_10_Minute_Three_Speakers_candidate.pptx");
const FINAL = path.join(OUTPUT, "GridPulse_10_Minute_Three_Speakers.pptx");
const FONT = "Aptos";
process.env.RUNTIME_NODE_MODULES = "C:/Users/Krishna Karthik/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
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

function fmt(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function pct(value, digits = 1) { return `${(Number(value) * 100).toFixed(digits)}%`; }
function avg(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

const datasetProfile = await readJson("results/dataset_profile.json");
const preprocessing = await readJson("results/preprocessing_summary.json");
const metrics = await readJson("results/model_comparison.json");
const baselineMetrics = await readJson("data/processed/model_metrics.json");
const snapshot = await readJson("data/processed/snapshot.json");
const manifest = await readJson("data/processed/manifest.json");
const fusionCurves = await readJson("results/training_curves.json");
const dcrnnCurves = await readJson("results/dcrnn_training_curves.json");
const featureImportance = await readJson("results/feature_importance.json");
const rocPr = await readJson("results/roc_pr_curves.json");
const errors = await readJson("results/error_analysis.json");

const models = metrics.models;
const persistence = models.find((m) => m.model === "persistence");
const fusion = models.find((m) => m.model === "fusion_gru");
const dcrnn = models.find((m) => m.model === "dcrnn");
const latestNodes = snapshot.nodes;
const latestEdges = snapshot.edges;

function addText(slide, text, x, y, width, height, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = String(text);
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
  return slide.shapes.add({
    geometry: "line",
    position: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.max(1, Math.abs(x2 - x1)), height: Math.max(1, Math.abs(y2 - y1)) },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function addHeader(slide, title, kicker, page, speaker, speakerColor) {
  addText(slide, kicker.toUpperCase(), SLIDE.left, 20, 540, 20, { size: 11, color: C.cyan, bold: true });
  addText(slide, title, SLIDE.left, 42, 900, 42, { size: 30, color: C.white, bold: true });
  addLine(slide, SLIDE.left, 94, W - SLIDE.right, 94, C.grid, 1);
  addRect(slide, W - 280, 18, 132, 25, `${speakerColor}18`, { geometry: "roundRect", line: `${speakerColor}66`, lineWidth: 1 });
  addText(slide, `${speaker.toUpperCase()} · 3:20`, W - 272, 23, 116, 15, { size: 9, color: speakerColor, bold: true, align: "center" });
  addText(slide, `GRID/PULSE  ·  ${String(page).padStart(2, "0")}`, W - 140, 23, 78, 15, { size: 9, color: C.muted, align: "right" });
}

function addFooter(slide, text = "Source: supplied CSVs and reproducible artifacts in data/processed") {
  addText(slide, text, SLIDE.left, H - 26, 920, 14, { size: 9, color: C.muted });
  addText(slide, "10-minute project review", W - 250, H - 26, 186, 14, { size: 9, color: C.muted, align: "right" });
}

function addSpeakerNotes(slide, text) {
  slide.speakerNotes.text = text;
  slide.speakerNotes.setVisible(true);
}

function addPanel(slide, x, y, width, height, title, subtitle = "") {
  addRect(slide, x, y, width, height, C.panel, { geometry: "roundRect", line: C.grid, lineWidth: 1 });
  addText(slide, title, x + 18, y + 15, width - 36, 22, { size: 16, color: C.white, bold: true });
  if (subtitle) addText(slide, subtitle, x + 18, y + 41, width - 36, 18, { size: 10, color: C.muted });
}

function addMetric(slide, x, y, width, label, value, accent = C.cyan, note = "") {
  addRect(slide, x, y, width, 86, C.panel, { geometry: "roundRect", line: accent, lineWidth: 1 });
  addText(slide, label.toUpperCase(), x + 13, y + 11, width - 26, 15, { size: 9, color: C.muted, bold: true });
  addText(slide, value, x + 13, y + 31, width - 26, 31, { size: 24, color: accent, bold: true });
  if (note) addText(slide, note, x + 13, y + 67, width - 26, 13, { size: 9, color: C.muted });
}

function addBullets(slide, items, x, y, width, lineHeight = 30, size = 16) {
  items.forEach((item, index) => {
    const color = item.color || C.cyan;
    addRect(slide, x, y + index * lineHeight + 7, 6, 6, color, { geometry: "ellipse" });
    addText(slide, item.text || item, x + 17, y + index * lineHeight, width - 17, lineHeight - 2, { size, color: item.colorText || C.text });
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
  return slide.charts.add(type, {
    position: config.position,
    categories: config.categories,
    series: (config.series || []).map((s) => ({ ...s, values: s.values.map((v) => Number(Number(v).toFixed(6))) })),
    hasLegend: config.hasLegend ?? true,
    legend: config.legend ?? { position: "bottom", textStyle: { fontSize: 9, fill: C.muted } },
    title: config.title || "",
    titlePlacement: config.title ? "aboveChart" : "none",
    titleTextStyle: { fontSize: 12, fill: C.white, bold: true },
    chartFill: C.panel,
    plotAreaFill: C.panel,
    chartLine: { style: "solid", fill: C.panel, width: 0 },
    plotAreaLine: { style: "solid", fill: C.grid, width: 1 },
    xAxis: config.xAxis ?? { majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 9, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
    yAxis: config.yAxis ?? { majorGridlines: { style: "solid", fill: C.grid, width: 1 }, textStyle: { fontSize: 9, fill: C.muted }, line: { style: "solid", fill: C.grid, width: 1 } },
    dataLabels: config.dataLabels,
    barOptions: config.barOptions,
    lineOptions: config.lineOptions,
  });
}

function newSlide(title, kicker, page, speaker, color) {
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  addHeader(slide, title, kicker, page, speaker, color);
  addFooter(slide);
  return slide;
}

function drawNetwork(slide, x, y, width, height) {
  const minLon = Math.min(...latestNodes.map((n) => n.longitude)) - 1;
  const maxLon = Math.max(...latestNodes.map((n) => n.longitude)) + 1;
  const minLat = Math.min(...latestNodes.map((n) => n.latitude)) - 1;
  const maxLat = Math.max(...latestNodes.map((n) => n.latitude)) + 1;
  const positions = Object.fromEntries(latestNodes.map((n) => [n.country, {
    x: x + ((n.longitude - minLon) / Math.max(maxLon - minLon, 1)) * width,
    y: y + (1 - (n.latitude - minLat) / Math.max(maxLat - minLat, 1)) * height,
  }]));
  latestEdges.forEach((edge) => {
    const a = positions[edge.source];
    const b = positions[edge.target];
    if (a && b) addLine(slide, a.x, a.y, b.x, b.y, C.grid, 2);
  });
  latestNodes.forEach((node) => {
    const p = positions[node.country];
    if (!p) return;
    const fill = node.risk_class === "Critical" ? C.coral : node.risk_class === "Warning" ? C.amber : C.mint;
    addRect(slide, p.x - 7, p.y - 7, 14, 14, fill, { geometry: "ellipse", line: C.bg, lineWidth: 2 });
    addText(slide, node.country, p.x + 10, p.y - 7, 36, 15, { size: 9, color: C.white, bold: true });
  });
}

function addFlowDiagram(slide, steps, x, y, width) {
  const gap = 14;
  const boxWidth = (width - gap * (steps.length - 1)) / steps.length;
  steps.forEach((step, index) => {
    const left = x + index * (boxWidth + gap);
    addRect(slide, left, y, boxWidth, 78, step.color, { geometry: "roundRect", line: step.color, lineWidth: 1 });
    addText(slide, String(index + 1).padStart(2, "0"), left + 12, y + 10, 36, 20, { size: 11, color: C.bg, bold: true });
    addText(slide, step.title, left + 12, y + 34, boxWidth - 24, 28, { size: 15, color: C.bg, bold: true, align: "center" });
    if (index < steps.length - 1) addLine(slide, left + boxWidth, y + 39, left + boxWidth + gap, y + 39, C.muted, 2);
  });
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

// Slide 1: cover and speaking split
{
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  for (let i = 0; i < 10; i += 1) addLine(slide, 790 + i * 30, 140 + (i % 3) * 110, 1180 - (i % 4) * 35, 520 - (i % 4) * 55, `${C.cyan}22`, 1);
  addText(slide, "GRID / PULSE", 70, 48, 260, 28, { size: 16, color: C.cyan, bold: true });
  addText(slide, "Cross-border power-flow\nprediction and routing", 70, 142, 660, 108, { size: 40, color: C.white, bold: true });
  addText(slide, "A 10-minute explanation of the complete predictive and prescriptive analytics workflow.", 74, 286, 620, 42, { size: 19, color: C.text });
  addMetric(slide, 74, 390, 170, "Speaker 1", "Slides 1–4", C.cyan, "data + foundation");
  addMetric(slide, 260, 390, 170, "Speaker 2", "Slides 5–8", C.mint, "models + routing");
  addMetric(slide, 446, 390, 170, "Speaker 3", "Slides 9–12", C.purple, "DCRNN + conclusion");
  addText(slide, "12 nodes  ·  24 canonical links  ·  1.59M source rows  ·  2022–2024 replay", 74, 548, 630, 24, { size: 13, color: C.muted });
  addText(slide, "The deck keeps the evidence, equations, limitations, and contribution split while removing repeated rubric slides.", 74, 588, 650, 36, { size: 15, color: C.text });
  addSpeakerNotes(slide, "Speaker 1, 25 seconds. Open with the project title and say that the group will cover the full workflow in three parts. Person 1 owns the foundation, Person 2 owns prediction and routing, and Person 3 owns DCRNN, research evidence, and the conclusion.");
}

// Slide 2: problem and workflow
{
  const slide = newSlide("The decision problem", "Speaker 1 · domain", 2, "Speaker 1", C.cyan);
  addPanel(slide, 64, 122, 490, 450, "Why the grid is difficult", "Countries are connected, so local stress can move through the network");
  addBullets(slide, [
    { text: "Power flow changes every hour and can reverse direction", color: C.cyan },
    { text: "A busy interconnector can make neighboring paths important", color: C.coral },
    { text: "The analyst needs both a forecast and an explainable action", color: C.amber },
    { text: "Exact engineering ratings are incomplete in the supplied data", color: C.purple },
  ], 88, 200, 420, 56, 17);
  addPanel(slide, 590, 122, 626, 450, "One end-to-end question", "What should be investigated before the next operating window?");
  addFlowDiagram(slide, [
    { title: "Observe\nflow", color: C.cyan },
    { title: "Forecast\nnext hour", color: C.blue },
    { title: "Screen\nstress", color: C.amber },
    { title: "Test\nroute", color: C.purple },
    { title: "Review\naction", color: C.mint },
  ], 628, 230, 548);
  addText(slide, "Predictive analytics estimates what may happen. Prescriptive analytics tests what could be done next.", 632, 382, 536, 54, { size: 21, color: C.white, bold: true, align: "center" });
  addText(slide, "Scope: recommendation-only screening. The prototype does not switch or dispatch a real grid.", 640, 500, 520, 34, { size: 15, color: C.amber, bold: true, align: "center" });
  addSpeakerNotes(slide, "Speaker 1, 55 seconds. Use the road analogy: countries are locations, interconnectors are roads, and power flow is traffic. The project asks what may happen next hour and which alternate route deserves engineering review. Emphasize that it is decision support, not automatic dispatch.");
}

// Slide 3: dataset and feature extraction
{
  const slide = newSlide("Data becomes a model-ready window", "Speaker 1 · data", 3, "Speaker 1", C.cyan);
  addMetric(slide, 64, 116, 190, "Dynamic rows", fmt(datasetProfile.dynamic_rows), C.cyan, "load + flow signals");
  addMetric(slide, 268, 116, 190, "Power rows", fmt(datasetProfile.power_flow_rows), C.mint, "directional links");
  addMetric(slide, 472, 116, 190, "Countries", "12", C.blue, "graph nodes");
  addMetric(slide, 676, 116, 190, "Canonical links", "24", C.purple, "graph edges");
  addMetric(slide, 880, 116, 190, "History", "2022–24", C.amber, "hourly replay");
  addPanel(slide, 64, 240, 530, 300, "Data quality checks", "The pipeline records what it changed");
  addBullets(slide, [
    { text: "Parse UTC timestamps and align country histories", color: C.cyan },
    { text: "Normalize country and interconnector aliases", color: C.mint },
    { text: "Check duplicates, missing cells, and timestamp gaps", color: C.amber },
    { text: "Save processed artifacts before any model is trained", color: C.purple },
  ], 88, 310, 460, 48, 16);
  addPanel(slide, 630, 240, 586, 300, "Feature extraction graph", "One target uses local, network, and static context");
  const nodes = [
    ["Raw hourly rows", C.cyan, 660, 316],
    ["Local signals\nflow · load · imbalance", C.blue, 820, 282],
    ["Network signals\nmeans across countries", C.mint, 820, 390],
    ["Graph features\ncentrality + neighbors", C.purple, 1000, 336],
    ["24-hour input\n→ next-hour target", C.amber, 1000, 448],
  ];
  nodes.forEach(([label, color, x, y]) => { addRect(slide, x, y, 150, 54, color, { geometry: "roundRect", line: color, lineWidth: 1 }); addText(slide, label, x + 8, y + 13, 134, 32, { size: 12, color: C.bg, bold: true, align: "center" }); });
  addLine(slide, 810, 343, 820, 309, C.muted, 2); addLine(slide, 810, 343, 820, 417, C.muted, 2); addLine(slide, 970, 309, 1000, 363, C.muted, 2); addLine(slide, 970, 417, 1000, 363, C.muted, 2); addLine(slide, 1075, 390, 1075, 448, C.muted, 2);
  addText(slide, "The model receives a tensor, not a raw CSV row.", 670, 514, 520, 20, { size: 15, color: C.white, bold: true, align: "center" });
  addSpeakerNotes(slide, "Speaker 1, 60 seconds. Explain the two sources and the checks. Then explain the feature graph: local flow, load, imbalance, and load residual describe one country; global summaries describe the network; centrality describes static position. The model uses the previous 24 aligned hours and predicts the next hour.");
}

// Slide 4: graph, physics and risk
{
  const slide = newSlide("Graph, risk screen, and loss assumptions", "Speaker 1 · graph", 4, "Speaker 1", C.cyan);
  addPanel(slide, 64, 120, 520, 450, "Country-interconnector graph", "Dots are nodes; lines are canonical links; colors are screening states");
  drawNetwork(slide, 92, 190, 456, 310);
  addText(slide, "Green = Normal   Amber = Warning   Red = Critical", 96, 520, 450, 20, { size: 12, color: C.muted, align: "center" });
  addPanel(slide, 620, 120, 596, 450, "Equations used for screening", "Transparent proxy calculations with explicit limitations");
  addText(slide, "Risk score", 650, 190, 180, 22, { size: 16, color: C.cyan, bold: true });
  addText(slide, "75 × utilization + 15 × imbalance + 10 × load-residual ratio", 650, 221, 500, 28, { size: 18, color: C.white, bold: true });
  addText(slide, "Resistance", 650, 286, 180, 22, { size: 16, color: C.purple, bold: true });
  addText(slide, "R = ρL / A", 650, 317, 300, 30, { size: 24, color: C.white, bold: true });
  addText(slide, "Power loss", 650, 382, 180, 22, { size: 16, color: C.amber, bold: true });
  addText(slide, "P_loss = 3I²R", 650, 413, 300, 30, { size: 24, color: C.white, bold: true });
  addBullets(slide, [
    { text: "Longer distance increases resistance when other assumptions stay fixed", color: C.cyan },
    { text: "Exact voltage, conductor area, and thermal ratings need engineering data", color: C.coral },
  ], 650, 480, 510, 30, 13);
  addSpeakerNotes(slide, "Speaker 1, 60 seconds. Explain that the graph gives topology and neighboring relationships. The risk screen combines flow pressure, imbalance, and load forecast error. The loss equations use distance-derived length and assumed constants, so the result is a proxy estimate, not a full AC power-flow calculation. Handoff to Person 2.");
}

// Slide 5: models and stack
{
  const slide = newSlide("Forecasting models and system stack", "Speaker 2 · prediction", 5, "Speaker 2", C.mint);
  addPanel(slide, 64, 120, 500, 454, "Four transparent baselines", "The website chooses from simple rules using chronological holdout error");
  addBullets(slide, [
    { text: "Persistence: next hour equals the latest observed flow", color: C.cyan },
    { text: "Moving average: mean of the latest 24 hours", color: C.blue },
    { text: "Seasonal naive: same hour on the previous day", color: C.mint },
    { text: "Linear trend: fit a line to the recent window", color: C.amber },
  ], 88, 198, 430, 54, 16);
  addText(slide, "Current website selection", 88, 438, 240, 22, { size: 14, color: C.muted, bold: true });
  addText(slide, "Persistence", 88, 466, 260, 32, { size: 24, color: C.cyan, bold: true });
  addText(slide, `RMSE ${fmt(baselineMetrics.metrics[0].rmse, 1)} MW on chronological holdout`, 88, 507, 430, 20, { size: 13, color: C.text });
  addPanel(slide, 596, 120, 620, 454, "Advanced research models", "Used in the saved experiment comparison");
  addFlowDiagram(slide, [
    { title: "CSV +\nprocessed data", color: C.cyan },
    { title: "PyTorch\nFusion GRU", color: C.blue },
    { title: "PyTorch\nDCRNN", color: C.purple },
    { title: "Metrics +\nfigures", color: C.mint },
  ], 630, 220, 548);
  addText(slide, "Python handles ingestion and APIs. NumPy supports arrays. PyTorch trains the neural models. Matplotlib and the saved JSON/CSV files support the evidence pack. HTML, CSS, and JavaScript render the dashboard.", 632, 360, 530, 86, { size: 17, color: C.white, bold: true, align: "center" });
  addText(slide, "Website forecast ≠ offline DCRNN benchmark", 650, 496, 510, 24, { size: 17, color: C.amber, bold: true, align: "center" });
  addSpeakerNotes(slide, "Speaker 2, 55 seconds. Explain the simple models first. State clearly that the live website currently uses the selected Persistence baseline. Fusion GRU and DCRNN are trained research comparisons in the results pack. Mention the library roles only at the level needed for the audience.");
}

// Slide 6: next-hour prediction and metrics
{
  const slide = newSlide("How the next-hour prediction is made", "Speaker 2 · model logic", 6, "Speaker 2", C.mint);
  addPanel(slide, 64, 122, 530, 454, "Website baseline example", "If the selected model is Persistence");
  addText(slide, "Observed hourly net flow", 94, 196, 430, 22, { size: 16, color: C.muted, bold: true });
  const values = [620, 680, 720, 720];
  const max = 800;
  values.forEach((value, i) => {
    const x = 100 + i * 95;
    const h = 190 * value / max;
    addRect(slide, x, 454 - h, 52, h, i === values.length - 1 ? C.cyan : C.panel2, { line: i === values.length - 1 ? C.cyan : C.grid, lineWidth: 1 });
    addText(slide, `${value}`, x - 3, 468, 60, 18, { size: 11, color: C.text, align: "center" });
    addText(slide, `${10 + i}:00`, x - 4, 492, 62, 18, { size: 10, color: C.muted, align: "center" });
  });
  addText(slide, "Next hour = latest value = 720 MW", 94, 528, 440, 28, { size: 21, color: C.cyan, bold: true, align: "center" });
  addPanel(slide, 624, 122, 592, 454, "How we judge the forecast", "The same chronological holdout is used for fair comparison");
  addText(slide, "MAE = average |prediction − actual|", 654, 196, 520, 24, { size: 19, color: C.white, bold: true });
  addText(slide, "RMSE = √ average (prediction − actual)²", 654, 242, 520, 24, { size: 19, color: C.white, bold: true });
  addText(slide, "Precision = TP / (TP + FP)", 654, 316, 450, 22, { size: 17, color: C.cyan, bold: true });
  addText(slide, "Recall = TP / (TP + FN)", 654, 352, 450, 22, { size: 17, color: C.mint, bold: true });
  addText(slide, "F1 = 2 × precision × recall / (precision + recall)", 654, 388, 520, 22, { size: 17, color: C.purple, bold: true });
  addText(slide, "A prediction is also classified as Normal, Warning, or Critical using historical thresholds. MAPE is reported for completeness but can be unstable near zero or when flow changes sign.", 654, 456, 520, 60, { size: 15, color: C.text });
  addSpeakerNotes(slide, "Speaker 2, 55 seconds. Use the numerical example. Explain that the website forecast can be simple because the latest hourly value is a strong short-horizon baseline. Then define the error metrics and stress classes. The model is selected by the lowest pooled RMSE on a chronological holdout.");
}

// Slide 7: performance results and confusion matrix
{
  const slide = newSlide("Performance evidence from the saved run", "Speaker 2 · evaluation", 7, "Speaker 2", C.mint);
  addPanel(slide, 64, 120, 580, 460, "Model comparison", "Lower RMSE is better; higher F1 is better");
  addChart(slide, "bar", {
    position: { left: 88, top: 196, width: 520, height: 260 },
    categories: ["Persistence", "Fusion GRU", "DCRNN"],
    series: [
      { name: "RMSE / 2,000", values: [persistence.rmse / 2000, fusion.rmse / 2000, dcrnn.rmse / 2000], fill: C.cyan },
      { name: "F1", values: [persistence.f1, fusion.f1, dcrnn.f1], fill: C.purple },
    ],
    title: "RMSE and F1 comparison",
    hasLegend: true,
    dataLabels: { showValue: false },
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 50 },
  });
  addText(slide, `Persistence RMSE ${fmt(persistence.rmse, 1)} MW · Fusion GRU ${fmt(fusion.rmse, 1)} MW · DCRNN ${fmt(dcrnn.rmse, 1)} MW`, 88, 480, 520, 42, { size: 13, color: C.text, align: "center" });
  addPanel(slide, 674, 120, 542, 460, "DCRNN confusion matrix", "Rows = actual class · columns = predicted class");
  const cm = (await readJson("results/confusion_matrix.json")).matrix;
  const cmTable = addTable(slide, [
    ["Actual / Pred.", "Normal", "Warning", "Critical"],
    ["Normal", cm.Normal.Normal, cm.Normal.Warning, cm.Normal.Critical],
    ["Warning", cm.Warning.Normal, cm.Warning.Warning, cm.Warning.Critical],
    ["Critical", cm.Critical.Normal, cm.Critical.Warning, cm.Critical.Critical],
  ], 720, 222, 450, 206, { fontSize: 13, columnWidths: [150, 100, 100, 100], headerFill: C.purple, boldFirst: true });
  [1, 2, 3].forEach((r) => [1, 2, 3].forEach((c) => { const cell = cmTable.getCell(r, c); if (r === c) cell.fill = `${C.mint}33`; }));
  addText(slide, `Accuracy: ${pct(dcrnn.accuracy, 1)} · Precision: ${pct(dcrnn.precision, 1)} · Recall: ${pct(dcrnn.recall, 1)} · F1: ${pct(dcrnn.f1, 1)}`, 704, 470, 485, 42, { size: 14, color: C.white, bold: true, align: "center" });
  addSpeakerNotes(slide, "Speaker 2, 60 seconds. Point out that Fusion GRU has the lowest RMSE among the saved trained models, while Persistence remains the operational selection in the website artifact. Explain that the confusion matrix reveals the type of stress-class mistakes. Do not call accuracy proof of safety.");
}

// Slide 8: routing and interface
{
  const slide = newSlide("Prescriptive routing: from stress to a reviewable option", "Speaker 2 · action", 8, "Speaker 2", C.mint);
  addPanel(slide, 64, 120, 548, 454, "Road-traffic analogy", "Power is treated as flow moving across connected lines");
  addLine(slide, 130, 270, 500, 270, C.coral, 8);
  addText(slide, "A", 104, 254, 24, 28, { size: 20, color: C.white, bold: true });
  addText(slide, "B", 510, 254, 24, 28, { size: 20, color: C.white, bold: true });
  addText(slide, "stressed line", 272, 238, 140, 24, { size: 16, color: C.coral, bold: true, align: "center" });
  addLine(slide, 130, 390, 280, 390, C.purple, 5);
  addLine(slide, 280, 390, 500, 390, C.purple, 5);
  addText(slide, "C", 104, 374, 24, 28, { size: 20, color: C.white, bold: true });
  addText(slide, "D", 266, 374, 24, 28, { size: 20, color: C.white, bold: true });
  addText(slide, "alternate path", 300, 358, 160, 24, { size: 16, color: C.purple, bold: true, align: "center" });
  addText(slide, "Move 25% of the selected flow, then test whether the alternate path has space.", 96, 488, 480, 42, { size: 17, color: C.text, align: "center" });
  addPanel(slide, 650, 120, 566, 454, "Routing decision sequence", "The planner explains accepted and rejected paths");
  addBullets(slide, [
    { text: "Moved MW = current flow × reroute percentage", color: C.cyan },
    { text: "Reject links with insufficient headroom or Critical risk", color: C.coral },
    { text: "Rank survivors by distance, utilization, and estimated loss", color: C.purple },
    { text: "Show before/after loading, loss delta, bottlenecks, and confidence", color: C.mint },
    { text: "Purple route means recommendation; engineer validates it", color: C.amber },
  ], 680, 208, 500, 56, 16);
  addText(slide, "Route Found · Best Effort Review · No Route", 678, 506, 500, 22, { size: 16, color: C.white, bold: true, align: "center" });
  addSpeakerNotes(slide, "Speaker 2, 60 seconds. Explain that routing is a what-if calculation. For 1,000 MW and a 25% reduction, the planner tests 250 MW on alternate paths. It rejects paths without enough proxy headroom or with Critical risk and ranks the survivors. It does not physically redirect electricity.");
}

// Slide 9: DCRNN simple explanation and why it did not win
{
  const slide = newSlide("DCRNN in simple terms", "Speaker 3 · research model", 9, "Speaker 3", C.purple);
  addPanel(slide, 64, 120, 540, 454, "What DCRNN adds", "It reads time and neighboring nodes together");
  addText(slide, "Previous 24 hours", 92, 190, 180, 24, { size: 17, color: C.cyan, bold: true, align: "center" });
  addText(slide, "Neighbour signals", 292, 190, 180, 24, { size: 17, color: C.purple, bold: true, align: "center" });
  addText(slide, "Next-hour flow", 192, 460, 180, 24, { size: 17, color: C.mint, bold: true, align: "center" });
  addFlowDiagram(slide, [
    { title: "Country\nhistory", color: C.cyan },
    { title: "Graph\ndiffusion", color: C.purple },
    { title: "Recurrent\nmemory", color: C.blue },
    { title: "Prediction\nfor all nodes", color: C.mint },
  ], 90, 280, 488);
  addText(slide, "Road analogy: before predicting traffic on one road, DCRNN also checks nearby roads.", 92, 508, 480, 36, { size: 15, color: C.text, align: "center" });
  addPanel(slide, 650, 120, 566, 454, "What the saved comparison says", "Graph context was tested honestly");
  addMetric(slide, 680, 202, 150, "Fusion GRU", `${fmt(fusion.rmse, 0)} MW`, C.mint, "RMSE");
  addMetric(slide, 850, 202, 150, "DCRNN", `${fmt(dcrnn.rmse, 0)} MW`, C.coral, "RMSE");
  addMetric(slide, 1020, 202, 150, "DCRNN F1", pct(dcrnn.f1, 1), C.purple, "classification");
  addBullets(slide, [
    { text: "DCRNN is more complex and slower in this saved run", color: C.coral },
    { text: "Local history already explains much of the short-horizon flow", color: C.amber },
    { text: "The supplied topology and features are proxies, not full grid state", color: C.purple },
    { text: "Keeping DCRNN in the comparison is still a valid research result", color: C.mint },
  ], 682, 330, 500, 45, 15);
  addSpeakerNotes(slide, "Speaker 3, 60 seconds. Explain DCRNN as a memory model that also passes information across neighboring countries. Then state the actual result: graph context did not win this run. The reasons are dataset size, proxy topology, missing physical state, and strong local autocorrelation. This is evidence about this experiment, not a claim that DCRNN is always weak.");
}

// Slide 10: evidence pack
{
  const slide = newSlide("Evidence pack: learning, classification, features, errors", "Speaker 3 · results", 10, "Speaker 3", C.purple);
  addPanel(slide, 64, 120, 542, 206, "Training curves", "Validation behavior matters more than training loss alone");
  const sampledEpochs = [0, 4, 9, 14, 19, 24, 29, 34, 39];
  addChart(slide, "line", {
    position: { left: 84, top: 166, width: 500, height: 132 },
    categories: sampledEpochs.map((i) => String(fusionCurves.epochs[i].epoch)),
    series: [
      { name: "Fusion train loss", values: sampledEpochs.map((i) => fusionCurves.epochs[i].train_loss), fill: C.cyan },
      { name: "Fusion validation loss", values: sampledEpochs.map((i) => fusionCurves.epochs[i].validation_loss), fill: C.amber },
    ],
    title: "Fusion GRU normalized loss",
    lineOptions: { smooth: false },
  });
  addPanel(slide, 634, 120, 582, 206, "ROC and precision-recall", "Thresholds change the balance between misses and false alarms");
  const critical = rocPr.curves.Critical;
  const rocSample = critical.roc.filter((_, i) => i % Math.max(1, Math.floor(critical.roc.length / 7)) === 0).slice(0, 8);
  const prSample = critical.pr.filter((_, i) => i % Math.max(1, Math.floor(critical.pr.length / 7)) === 0).slice(0, 8);
  addChart(slide, "line", { position: { left: 656, top: 166, width: 262, height: 132 }, categories: rocSample.map((p) => p.fpr.toFixed(2)), series: [{ name: "Critical ROC", values: rocSample.map((p) => p.tpr), fill: C.purple }], hasLegend: false, title: "ROC" });
  addChart(slide, "line", { position: { left: 932, top: 166, width: 262, height: 132 }, categories: prSample.map((p) => p.recall.toFixed(2)), series: [{ name: "Critical PR", values: prSample.map((p) => p.precision), fill: C.mint }], hasLegend: false, title: "Precision-recall" });
  addPanel(slide, 64, 350, 542, 224, "Feature importance", "Validation MAE increase after shuffling a feature");
  const topFeatures = featureImportance.features.slice(0, 5).reverse();
  addChart(slide, "bar", { position: { left: 84, top: 392, width: 500, height: 150 }, categories: topFeatures.map((f) => f.feature), series: [{ name: "Δ MAE", values: topFeatures.map((f) => f.permutation_delta_mae), fill: C.cyan }], hasLegend: false, title: "Permutation Δ MAE", barOptions: { direction: "bar", grouping: "clustered", gapWidth: 35 } });
  addPanel(slide, 634, 350, 582, 224, "Error analysis", "What the model handles well and where it breaks");
  const success = errors.successes[0];
  const failure = errors.failures[0];
  addText(slide, `Success · ${success.country} · error ${fmt(success.absolute_error_mw, 1)} MW`, 662, 414, 520, 22, { size: 16, color: C.mint, bold: true });
  addText(slide, `Failure · ${failure.country} · error ${fmt(failure.absolute_error_mw, 1)} MW`, 662, 454, 520, 22, { size: 16, color: C.coral, bold: true });
  addText(slide, "Stable recent flow is easier. Abrupt movement and class-boundary changes are harder.", 662, 500, 510, 36, { size: 15, color: C.text });
  addSpeakerNotes(slide, "Speaker 3, 60 seconds. Point to the four evidence types: training/validation behavior, threshold curves, feature importance, and qualitative errors. The feature chart shows that recent local net flow is the strongest signal in this run. The error examples demonstrate why a model can be accurate overall and still fail during abrupt changes.");
}

// Slide 11: integration, novelty, limitations
{
  const slide = newSlide("Integration, novelty, and limits", "Speaker 3 · implementation", 11, "Speaker 3", C.purple);
  addPanel(slide, 64, 120, 540, 454, "How the application works", "The browser receives evidence through backend services");
  addFlowDiagram(slide, [
    { title: "CSV", color: C.cyan },
    { title: "Pipeline", color: C.blue },
    { title: "Artifacts", color: C.mint },
    { title: "REST / SSE", color: C.purple },
    { title: "Dashboard", color: C.amber },
  ], 90, 216, 488);
  addBullets(slide, [
    { text: "Python backend serves forecast, metrics, snapshot, loss, and route-plan data", color: C.cyan },
    { text: "HTML, CSS, and JavaScript animate topology and charts", color: C.mint },
    { text: "Results folder stores the source of truth for the report", color: C.purple },
  ], 90, 348, 480, 48, 15);
  addPanel(slide, 650, 120, 566, 454, "What is genuinely novel here", "A defensible integration for a course-scale decision-support system");
  addBullets(slide, [
    { text: "Data-quality checks stay visible instead of disappearing behind a model", color: C.cyan },
    { text: "Model routing keeps the simplest winner when complexity does not help", color: C.mint },
    { text: "Distance and loss assumptions are shown beside the recommendation", color: C.purple },
    { text: "Rerouting exposes headroom and bottlenecks instead of hiding infeasibility", color: C.amber },
    { text: "Future work: verified ratings, N-1 analysis, calibrated uncertainty, telemetry", color: C.coral },
  ], 680, 210, 500, 54, 15);
  addSpeakerNotes(slide, "Speaker 3, 55 seconds. Explain the integration contract from CSV to browser. Then state the novelty carefully: transparent integration, model selection by evidence, explicit proxy physics, and route guardrails. Close with the real limitations: no certified engineering ratings, no N-1 security study, no real telemetry adapter, and no automatic control.");
}

// Slide 12: close and contribution split
{
  const slide = newSlide("Conclusion and group contributions", "Speaker 3 · close", 12, "Speaker 3", C.purple);
  addText(slide, "One workflow, three responsibilities", 64, 120, 700, 34, { size: 25, color: C.white, bold: true });
  addText(slide, "Raw records become a forecast, a risk explanation, and a reviewable routing scenario.", 64, 160, 900, 30, { size: 18, color: C.text });
  addMetric(slide, 64, 236, 350, "Person 1", "Data + graph", C.cyan, "domain, preprocessing, features, graph, assumptions");
  addMetric(slide, 464, 236, 350, "Person 2", "Models + routing", C.mint, "baselines, metrics, APIs, loss, what-if route");
  addMetric(slide, 864, 236, 350, "Person 3", "Research + evidence", C.purple, "Fusion GRU, DCRNN, graphs, limits, conclusion");
  addPanel(slide, 64, 370, 1150, 160, "Final takeaway", "The project earns trust by showing what it knows, what it assumes, and what an engineer still needs to validate");
  addText(slide, "Prediction answers: what may happen next?   Routing answers: what option should be investigated?   Validation answers: can we trust the result enough to review it?", 94, 438, 1080, 48, { size: 21, color: C.white, bold: true, align: "center" });
  addText(slide, "Thank you", 64, 574, 1150, 28, { size: 20, color: C.cyan, bold: true, align: "center" });
  addSpeakerNotes(slide, "Speaker 3, 45 seconds. Summarize the complete workflow in one sentence. State each person’s contribution using the three labels on the slide. End with the limitation that the prototype supports engineering review and does not authorize real-grid action. Invite questions.");
}

await fs.mkdir(BUILD, { recursive: true });
await fs.mkdir(OUTPUT, { recursive: true });
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(CANDIDATE);

for (const [index, slide] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(BUILD, `slide-${String(index + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}
const montage = await presentation.export({ format: "webp", montage: true });
await fs.writeFile(path.join(BUILD, "deck-montage.webp"), new Uint8Array(await montage.arrayBuffer()));

const { finalizePresentation } = await import("../.codex-ppt-build/node_modules/@oai/artifact-tool/dist/index.js").catch(() => ({ finalizePresentation: null }));
if (!finalizePresentation) {
  const finalizerModule = await import("file:///C:/Users/Krishna%20Karthik/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/artifact_tool_utils.mjs");
  const result = await finalizerModule.finalizePresentation({
    explicitTotalSlideCount: 12,
    candidatePath: CANDIDATE,
    finalPath: FINAL,
    workspaceDir: ROOT,
    pythonExecutable: "C:/Users/Krishna Karthik/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
    integrityValidatorPath: "C:/Users/Krishna Karthik/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/inspect_presentation_package_integrity.py",
    layoutValidatorPath: "C:/Users/Krishna Karthik/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/inspect_presentation_layout_geometry.py",
    layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit", "--require-native-table-slide", "7"],
    requiredNativeTableOwnerSlides: [7],
    requiredNativeChartOwnerSlides: [7, 10],
    fontPolicy: { basis: "design", families: [FONT] },
    verifyArtifactToolImport: true,
    materializeLiteralChartWorkbooks: true,
    receiptPath: path.join(BUILD, "GridPulse_10_Minute_Three_Speakers.validation.json"),
  });
  if (!result?.finalPath) process.exitCode = 1;
}

