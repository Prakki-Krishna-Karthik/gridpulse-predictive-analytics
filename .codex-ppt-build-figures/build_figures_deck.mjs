import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:/Users/Krishna Karthik/Desktop/predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build-figures");
const OUTPUT = path.join(ROOT, ".codex-ppt-output-figures");
const CANDIDATE = path.join(BUILD, "GridPulse_10_Minute_Original_Figures_v2_candidate.pptx");
const FINAL = path.join(OUTPUT, "GridPulse_10_Minute_Original_Figures_v2.pptx");
const FONT = "Aptos";
const W = 1280;
const H = 720;
const C = {
  bg: "#F7F9FC",
  bg2: "#EEF4F7",
  panel: "#FFFFFF",
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
const SLIDE = { left: 64, right: 64 };
process.env.RUNTIME_NODE_MODULES = "C:/Users/Krishna Karthik/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8"));
}

const profile = await readJson("results/dataset_profile.json");
const comparison = await readJson("results/model_comparison.json");
const confusion = await readJson("results/confusion_matrix.json");
const snapshot = await readJson("data/processed/snapshot.json");
const featureCatalog = await readJson("results/feature_catalog.json");

const models = Object.fromEntries(comparison.models.map((row) => [row.model, row]));
const figures = (name) => path.join(ROOT, "results", "figures", name);
const figureNames = [
  "model_comparison.png",
  "dcrnn_training_curves.png",
  "training_curves.png",
  "roc_pr_curves.png",
  "feature_importance.png",
  "error_distribution.png",
];
const figureBlobs = Object.fromEntries(await Promise.all(figureNames.map(async (name) => [name, await fs.readFile(figures(name))])));

function addText(slide, text, x, y, width, height, opts = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", position: { left: x, top: y, width, height }, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = String(text);
  shape.text.style = { fontFamily: FONT, fontSize: opts.size ?? 18, color: opts.color ?? C.text, bold: opts.bold ?? false, italic: opts.italic ?? false, alignment: opts.align ?? "left" };
  return shape;
}

function addRect(slide, x, y, width, height, fill, opts = {}) {
  return slide.shapes.add({ geometry: opts.geometry || "rect", position: { left: x, top: y, width, height }, fill, line: { style: "solid", fill: opts.line ?? fill, width: opts.lineWidth ?? 0 }, borderRadius: opts.round ? "rounded-lg" : undefined });
}

function addLine(slide, x1, y1, x2, y2, color = C.grid, width = 2) {
  return slide.shapes.add({ geometry: "line", position: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.max(1, Math.abs(x2 - x1)), height: Math.max(1, Math.abs(y2 - y1)) }, fill: "none", line: { style: "solid", fill: color, width } });
}

function addHeader(slide, title, kicker, page) {
  addText(slide, kicker.toUpperCase(), SLIDE.left, 20, 540, 20, { size: 11, color: C.cyan, bold: true });
  addText(slide, title, SLIDE.left, 42, 1000, 42, { size: 30, color: C.white, bold: true });
  addLine(slide, SLIDE.left, 94, W - SLIDE.right, 94, C.grid, 1);
  addText(slide, `GRID/PULSE  ·  ${String(page).padStart(2, "0")}`, W - 160, 23, 96, 15, { size: 9, color: C.muted, align: "right" });
}

function addFooter(slide, text = "Source: supplied CSVs and saved results in results/figures") {
  addText(slide, text, SLIDE.left, H - 26, 920, 14, { size: 9, color: C.muted });
  addText(slide, "Predictive Analytics course project", W - 300, H - 26, 236, 14, { size: 9, color: C.muted, align: "right" });
}

function addNotes(slide, text) {
  slide.speakerNotes.text = text;
  slide.speakerNotes.setVisible(true);
}

function newSlide(title, kicker, page) {
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  addHeader(slide, title, kicker, page);
  addFooter(slide);
  return slide;
}

function addPanel(slide, x, y, width, height, title, subtitle = "") {
  addRect(slide, x, y, width, height, C.panel, { geometry: "roundRect", line: C.grid, lineWidth: 1 });
  addText(slide, title, x + 18, y + 15, width - 36, 22, { size: 16, color: C.white, bold: true });
  if (subtitle) addText(slide, subtitle, x + 18, y + 41, width - 36, 18, { size: 10, color: C.muted });
}

function addBullets(slide, items, x, y, width, lineHeight = 32, size = 16) {
  items.forEach((item, index) => {
    const color = item.color || C.cyan;
    addRect(slide, x, y + index * lineHeight + 7, 6, 6, color, { geometry: "ellipse" });
    addText(slide, item.text || item, x + 17, y + index * lineHeight, width - 17, lineHeight - 2, { size, color: item.colorText || C.text });
  });
}

function addMetric(slide, x, y, width, label, value, accent = C.cyan, note = "") {
  addRect(slide, x, y, width, 86, C.panel, { geometry: "roundRect", line: accent, lineWidth: 1 });
  addText(slide, label.toUpperCase(), x + 13, y + 11, width - 26, 15, { size: 9, color: C.muted, bold: true });
  addText(slide, value, x + 13, y + 31, width - 26, 31, { size: 24, color: accent, bold: true });
  if (note) addText(slide, note, x + 13, y + 67, width - 26, 13, { size: 9, color: C.muted });
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

function addFigure(slide, name, x, y, width, height, title, caption = "") {
  addPanel(slide, x, y, width, height, title, caption);
  slide.images.add({ blob: figureBlobs[name], contentType: "image/png", alt: title, fit: "contain", position: { left: x + 12, top: y + 62, width: width - 24, height: height - 78 } });
}

function addFlow(slide, steps, x, y, width) {
  const gap = 14;
  const boxWidth = (width - gap * (steps.length - 1)) / steps.length;
  steps.forEach((step, index) => {
    const left = x + index * (boxWidth + gap);
    addRect(slide, left, y, boxWidth, 72, step.color, { geometry: "roundRect", line: step.color, lineWidth: 1 });
    addText(slide, String(index + 1).padStart(2, "0"), left + 10, y + 9, 28, 18, { size: 10, color: C.bg, bold: true });
    addText(slide, step.title, left + 9, y + 31, boxWidth - 18, 30, { size: 14, color: C.bg, bold: true, align: "center" });
    if (index < steps.length - 1) addLine(slide, left + boxWidth, y + 36, left + boxWidth + gap, y + 36, C.muted, 2);
  });
}

function latexToSvg(latex) {
  const known = new Map([
    [String.raw`R=\frac{\rho L}{A}`, "R = ρL / A"],
    [String.raw`P_{loss}=3I^2R`, "Pₗₒₛₛ = 3I²R"],
    [String.raw`S=75u+15|b|+10\frac{|r|}{|load|}`, "S = 75u + 15|b| + 10|r| / |load|"],
    [String.raw`\hat{F}_{t+1}=F_t`, "F̂ₜ₊₁ = Fₜ"],
    [String.raw`MAE=\frac{1}{n}\sum|\hat{y}-y|`, "MAE = (1/n) Σ|ŷ − y|"],
    [String.raw`RMSE=\sqrt{\frac{1}{n}\sum(\hat{y}-y)^2}`, "RMSE = √[(1/n) Σ(ŷ − y)²]"],
    [String.raw`precision=\frac{TP}{TP+FP}`, "precision = TP / (TP + FP)"],
    [String.raw`recall=\frac{TP}{TP+FN}`, "recall = TP / (TP + FN)"],
    [String.raw`F1=\frac{2PR}{P+R}`, "F1 = 2PR / (P + R)"],
    [String.raw`moved\ MW=\frac{current\ MW\times reroute\%}{100}`, "moved MW = current MW × reroute% / 100"],
    [String.raw`headroom=proxy\ capacity-current\ flow`, "headroom = proxy capacity − current flow"],
    [String.raw`cost=distance(1+2.2u+6\ell)`, "cost = distance × (1 + 2.2u + 6ℓ)"],
  ]);
  const text = known.get(latex) || latex;
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 120"><rect width="900" height="120" fill="#EEF4F7"/><text x="450" y="75" text-anchor="middle" font-family="Cambria Math, Times New Roman, serif" font-size="38" fill="#173746">${escaped}</text></svg>`;
}

function addEquation(slide, latex, x, y, width, height, caption) {
  addRect(slide, x, y, width, height, C.bg2, { geometry: "roundRect", line: C.grid, lineWidth: 1 });
  slide.images.add({ svg: latexToSvg(latex), alt: caption, fit: "contain", position: { left: x + 14, top: y + 12, width: width - 28, height: height - 34 } });
  addText(slide, caption, x + 10, y + height - 19, width - 20, 14, { size: 9, color: C.muted, align: "center" });
}

function addSimpleNetwork(slide, x, y, width, height) {
  const positions = { DE: [0.18, 0.40], FR: [0.05, 0.70], BE: [0.34, 0.62], NL: [0.30, 0.25], DK: [0.50, 0.08], SE: [0.72, 0.05], NO: [0.92, 0.12], CH: [0.40, 0.88], AT: [0.61, 0.80], IT: [0.75, 0.94], ES: [0.02, 0.98], PL: [0.83, 0.48] };
  const edges = [["DE", "FR"], ["DE", "BE"], ["DE", "NL"], ["DE", "DK"], ["DE", "PL"], ["FR", "BE"], ["FR", "ES"], ["FR", "CH"], ["BE", "NL"], ["BE", "UK"], ["CH", "IT"], ["CH", "AT"], ["AT", "IT"], ["AT", "PL"], ["DK", "SE"], ["SE", "NO"]].filter(([a, b]) => positions[a] && positions[b]);
  const p = (code) => ({ x: x + positions[code][0] * width, y: y + positions[code][1] * height });
  edges.forEach(([a, b]) => { const pa = p(a); const pb = p(b); addLine(slide, pa.x, pa.y, pb.x, pb.y, C.grid, 2); });
  Object.entries(positions).forEach(([code, pos]) => { const point = p(code); const color = code === "DE" ? C.coral : code === "BE" || code === "AT" ? C.amber : C.mint; addRect(slide, point.x - 6, point.y - 6, 12, 12, color, { geometry: "ellipse", line: C.bg, lineWidth: 2 }); addText(slide, code, point.x + 8, point.y - 7, 28, 14, { size: 9, color: C.white, bold: true }); });
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

// 1. Cover
{
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  for (let i = 0; i < 10; i += 1) addLine(slide, 790 + i * 30, 140 + (i % 3) * 110, 1180 - (i % 4) * 35, 520 - (i % 4) * 55, `${C.cyan}22`, 1);
  addText(slide, "GRID / PULSE", 70, 48, 260, 28, { size: 16, color: C.cyan, bold: true });
  addText(slide, "Graph-Based Predictive and\nPrescriptive Analytics for\nCross-Border Power Grid Networks", 70, 142, 690, 150, { size: 38, color: C.white, bold: true });
  addText(slide, "From raw hourly records to next-hour forecasts, risk screening, loss estimates, and stress-aware routing scenarios.", 74, 330, 620, 60, { size: 18, color: C.text });
  addText(slide, "Predictive Analytics course project", 74, 510, 350, 20, { size: 14, color: C.muted });
  addText(slide, "12 nodes  ·  24 links  ·  1.59M source rows  ·  2022–2024 replay", 74, 548, 640, 24, { size: 13, color: C.muted });
  addText(slide, "Decision-support prototype", 74, 600, 300, 24, { size: 16, color: C.cyan, bold: true });
  addNotes(slide, "Introduce the project as an explainable decision-support prototype. The presentation covers the complete path from supplied data to forecasting, evaluation, and prescriptive route testing.");
}

// 2. Problem and workflow
{
  const slide = newSlide("Problem and project workflow", "Domain and objectives", 2);
  addPanel(slide, 64, 122, 490, 448, "Why cross-border flows are difficult", "Power moves through a connected network");
  addBullets(slide, [
    { text: "Flow changes hourly and can reverse direction", color: C.cyan },
    { text: "A stressed interconnector can affect neighboring paths", color: C.coral },
    { text: "The analyst needs a forecast and an explainable next step", color: C.amber },
    { text: "The supplied data lacks all engineering ratings and telemetry", color: C.purple },
  ], 90, 202, 420, 58, 17);
  addPanel(slide, 592, 122, 624, 448, "End-to-end workflow", "Predictive analytics feeds prescriptive screening");
  addFlow(slide, [
    { title: "Observe\nCSV data", color: C.cyan },
    { title: "Prepare\nfeatures", color: C.blue },
    { title: "Forecast\nnext hour", color: C.mint },
    { title: "Screen\nstress", color: C.amber },
    { title: "Test\nroute", color: C.purple },
  ], 626, 218, 556);
  addText(slide, "Prediction asks what may happen. Prescription tests what should be investigated.", 634, 360, 540, 48, { size: 22, color: C.white, bold: true, align: "center" });
  addText(slide, "The output is a reviewable recommendation, not a switching command.", 656, 492, 500, 28, { size: 16, color: C.amber, bold: true, align: "center" });
  addNotes(slide, "Explain the road analogy. Countries are locations, interconnectors are roads, and power flow is traffic. The project combines data preparation, forecasting, risk screening, and what-if routing.");
}

// 3. Dataset and preprocessing
{
  const slide = newSlide("Dataset, preprocessing, and feature extraction", "Data preparation", 3);
  addMetric(slide, 64, 116, 190, "Dynamic rows", profile.dynamic_rows.toLocaleString(), C.cyan, "load and flow signals");
  addMetric(slide, 268, 116, 190, "Power rows", profile.power_flow_rows.toLocaleString(), C.mint, "directional records");
  addMetric(slide, 472, 116, 190, "Countries", "12", C.blue, "graph nodes");
  addMetric(slide, 676, 116, 190, "Links", "24", C.purple, "canonical edges");
  addMetric(slide, 880, 116, 190, "Coverage", "2022–24", C.amber, "hourly replay");
  addPanel(slide, 64, 238, 530, 320, "Preprocessing", "The pipeline makes the sources consistent");
  addBullets(slide, [
    { text: "Parse UTC timestamps and align country histories", color: C.cyan },
    { text: "Normalize country and interconnector aliases", color: C.mint },
    { text: "Check duplicates, missing cells, and timestamp gaps", color: C.amber },
    { text: "Save processed data and metadata before training", color: C.purple },
  ], 90, 306, 460, 50, 16);
  addPanel(slide, 630, 238, 586, 320, "Feature extraction", "Local signals, network context, and static graph information");
  addFlow(slide, [
    { title: "Net flow\nload\nimbalance", color: C.cyan },
    { title: "Load\nresidual", color: C.blue },
    { title: "Network\nmeans", color: C.mint },
    { title: "Centrality\nfeatures", color: C.purple },
    { title: "24-hour\nwindow", color: C.amber },
  ], 650, 340, 548);
  addText(slide, "The model receives a structured tensor, not a raw CSV row.", 666, 472, 520, 24, { size: 16, color: C.white, bold: true, align: "center" });
  addNotes(slide, "Explain the two source tables and the cleaning steps. Feature groups include local net flow, load, imbalance, load residual, system-wide summaries, and centrality. The model uses a 24-hour window and predicts the following hour.");
}

// 4. Graph and equations
{
  const slide = newSlide("Network graph, risk screen, and physical-loss proxy", "Graph representation", 4);
  addPanel(slide, 64, 120, 510, 452, "Country-interconnector graph", "Topology comes from canonical links");
  addSimpleNetwork(slide, 92, 190, 450, 310);
  addText(slide, "Green = Normal   Amber = Warning   Red = Critical", 96, 526, 440, 20, { size: 12, color: C.muted, align: "center" });
  addPanel(slide, 610, 120, 606, 452, "Equations behind the screen", "Rendered as mathematical notation");
  addEquation(slide, String.raw`R=\frac{\rho L}{A}`, 646, 190, 250, 102, "wire resistance");
  addEquation(slide, String.raw`P_{loss}=3I^2R`, 930, 190, 250, 102, "estimated three-phase loss");
  addEquation(slide, String.raw`S=75u+15|b|+10\frac{|r|}{|load|}`, 646, 332, 534, 102, "risk screen components");
  addBullets(slide, [
    { text: "Longer length increases resistance when other assumptions stay fixed", color: C.cyan },
    { text: "The loss result is a distance-based proxy, not a full AC power-flow solution", color: C.coral },
    { text: "Engineering validation still needs voltage, ratings, protection, and N-1 checks", color: C.amber },
  ], 650, 470, 520, 27, 13);
  addNotes(slide, "Explain nodes and edges. Define rho as resistivity, L as length, A as conductor area, and I as current. Explain that the risk score uses utilization, imbalance, and load residual. The current physics result is a transparent proxy because exact engineering parameters are unavailable.");
}

// 5. System and model stack
{
  const slide = newSlide("System architecture and forecasting models", "Implementation", 5);
  addPanel(slide, 64, 120, 530, 452, "Technology roles", "Each layer has a focused responsibility");
  addBullets(slide, [
    { text: "Python: ingestion, preprocessing, APIs, physics proxy, routing", color: C.cyan },
    { text: "NumPy and CSV tooling: arrays and tabular data", color: C.blue },
    { text: "PyTorch: Fusion GRU and DCRNN research models", color: C.purple },
    { text: "Saved JSON and CSV artifacts: metrics and reproducibility", color: C.mint },
    { text: "HTML, CSS, JavaScript: dashboard, charts, topology animation", color: C.amber },
  ], 90, 198, 470, 52, 15);
  addPanel(slide, 626, 120, 590, 452, "Model stack", "The website keeps the best operational baseline");
  addFlow(slide, [
    { title: "Persistence", color: C.cyan },
    { title: "Moving\naverage", color: C.blue },
    { title: "Seasonal\nnaive", color: C.mint },
    { title: "Linear\ntrend", color: C.amber },
  ], 656, 210, 530);
  addText(slide, "Research benchmark", 670, 326, 220, 20, { size: 14, color: C.muted, bold: true });
  addFlow(slide, [
    { title: "Fusion\nGRU", color: C.blue },
    { title: "DCRNN", color: C.purple },
    { title: "Saved\nresults", color: C.mint },
  ], 656, 362, 530);
  addText(slide, "Current website selection: Persistence, selected by chronological holdout RMSE.", 662, 480, 520, 30, { size: 15, color: C.amber, bold: true, align: "center" });
  addNotes(slide, "Explain the software layers and the important distinction between the website forecast and the research benchmark. Persistence is currently selected in the processed model artifact. Fusion GRU and DCRNN remain important because they are trained and evaluated in the saved experiment.");
}

// 6. Forecast and metrics equations
{
  const slide = newSlide("How the next-hour forecast is produced", "Prediction and evaluation", 6);
  addPanel(slide, 64, 120, 500, 452, "Simple baseline example", "Persistence uses the latest observed flow");
  const values = [620, 680, 720, 720];
  values.forEach((value, index) => { const x = 110 + index * 92; const height = 195 * value / 800; addRect(slide, x, 454 - height, 52, height, index === 3 ? C.cyan : C.panel2, { line: index === 3 ? C.cyan : C.grid, lineWidth: 1 }); addText(slide, String(value), x - 3, 468, 58, 18, { size: 11, color: C.text, align: "center" }); addText(slide, `${10 + index}:00`, x - 3, 492, 58, 18, { size: 10, color: C.muted, align: "center" }); });
  addEquation(slide, String.raw`\hat{F}_{t+1}=F_t`, 114, 208, 392, 102, "Persistence rule");
  addText(slide, "If the latest flow is 720 MW, the next-hour point forecast is 720 MW.", 100, 350, 420, 58, { size: 18, color: C.white, bold: true, align: "center" });
  addPanel(slide, 602, 120, 614, 452, "Metrics used in the saved comparison", "Regression error and stress-class behavior");
  addEquation(slide, String.raw`MAE=\frac{1}{n}\sum|\hat{y}-y|`, 634, 186, 260, 90, "average absolute error");
  addEquation(slide, String.raw`RMSE=\sqrt{\frac{1}{n}\sum(\hat{y}-y)^2}`, 918, 186, 260, 90, "large errors matter more");
  addEquation(slide, String.raw`precision=\frac{TP}{TP+FP}`, 634, 320, 260, 90, "warning reliability");
  addEquation(slide, String.raw`recall=\frac{TP}{TP+FN}`, 918, 320, 260, 90, "warning coverage");
  addEquation(slide, String.raw`F1=\frac{2PR}{P+R}`, 776, 454, 260, 90, "balance of precision and recall");
  addNotes(slide, "Explain the 720 MW example. Then state that all models are tested against unseen future-like periods in chronological order. MAE and RMSE measure numeric flow error. Precision, recall, and F1 measure the Normal, Warning, and Critical classifications.");
}

// 7. Original model comparison and confusion matrix table
{
  const slide = newSlide("Model performance and confusion matrix", "Saved evaluation results", 7);
  addFigure(slide, "model_comparison.png", 64, 120, 650, 452, "Original model comparison figure", "Saved figure from results/figures");
  addPanel(slide, 748, 120, 468, 452, "DCRNN confusion matrix", "Saved matrix values from the experiment");
  const cm = confusion.matrix;
  const table = addTable(slide, [["Actual / Predicted", "Normal", "Warning", "Critical"], ["Normal", cm.Normal.Normal, cm.Normal.Warning, cm.Normal.Critical], ["Warning", cm.Warning.Normal, cm.Warning.Warning, cm.Warning.Critical], ["Critical", cm.Critical.Normal, cm.Critical.Warning, cm.Critical.Critical]], 776, 214, 412, 206, { fontSize: 12, columnWidths: [136, 92, 92, 92], headerFill: C.purple, boldFirst: true });
  [1, 2, 3].forEach((r) => { const cell = table.getCell(r, r); cell.fill = `${C.mint}33`; });
  addText(slide, `DCRNN: accuracy ${(models.dcrnn.accuracy * 100).toFixed(1)}% · precision ${(models.dcrnn.precision * 100).toFixed(1)}% · recall ${(models.dcrnn.recall * 100).toFixed(1)}% · F1 ${(models.dcrnn.f1 * 100).toFixed(1)}%`, 776, 472, 408, 48, { size: 13, color: C.white, bold: true, align: "center" });
  addNotes(slide, "Use the original model_comparison.png without redrawing it. State the saved values: Persistence RMSE 580.3 MW, Fusion GRU 570.5 MW, and DCRNN 634.0 MW. Read the confusion matrix as actual classes in rows and predicted classes in columns. The figures folder did not include a confusion-matrix image, so the saved matrix is shown as an editable table.");
}

// 8. Routing and equations
{
  const slide = newSlide("Prescriptive routing and what-if analysis", "Decision support", 8);
  addPanel(slide, 64, 120, 500, 452, "Traffic analogy", "A stressed line is treated like a crowded road");
  addLine(slide, 120, 260, 500, 260, C.coral, 8); addText(slide, "A", 96, 244, 28, 24, { size: 20, color: C.white, bold: true }); addText(slide, "B", 510, 244, 28, 24, { size: 20, color: C.white, bold: true }); addText(slide, "stressed line", 264, 226, 150, 22, { size: 16, color: C.coral, bold: true, align: "center" });
  addLine(slide, 120, 390, 290, 390, C.purple, 5); addLine(slide, 290, 390, 500, 390, C.purple, 5); addText(slide, "C", 96, 374, 28, 24, { size: 20, color: C.white, bold: true }); addText(slide, "D", 276, 374, 28, 24, { size: 20, color: C.white, bold: true }); addText(slide, "alternate path", 300, 356, 150, 22, { size: 16, color: C.purple, bold: true, align: "center" });
  addText(slide, "The planner tests whether some flow can move from A to B through another connected path.", 96, 486, 440, 48, { size: 16, color: C.text, align: "center" });
  addPanel(slide, 602, 120, 614, 452, "Decision equations and guardrails", "The route is ranked only after unsafe paths are rejected");
  addEquation(slide, String.raw`moved\ MW=\frac{current\ MW\times reroute\%}{100}`, 634, 180, 548, 88, "amount tested in the what-if");
  addEquation(slide, String.raw`headroom=proxy\ capacity-current\ flow`, 634, 292, 548, 88, "remaining screening capacity");
  addEquation(slide, String.raw`cost=distance(1+2.2u+6\ell)`, 634, 404, 548, 88, "distance, utilization u, loss percentage ℓ");
  addText(slide, "Reject: insufficient headroom or Critical risk. Show: before/after loading, loss delta, bottlenecks, and required engineering checks.", 648, 520, 520, 36, { size: 13, color: C.amber, bold: true, align: "center" });
  addNotes(slide, "Explain the route as a simulation. If a selected line carries 1,000 MW and the user tests 25%, the planner evaluates 250 MW on alternate paths. It rejects paths with insufficient proxy headroom or Critical risk, then ranks survivors using distance, utilization, and estimated loss. The purple route is only a recommendation.");
}

// 9. DCRNN and original training figure
{
  const slide = newSlide("DCRNN and graph diffusion", "Advanced research model", 9);
  addPanel(slide, 64, 120, 508, 452, "DCRNN in simple terms", "Memory over time plus information from neighbors");
  addFlow(slide, [
    { title: "Previous\n24 hours", color: C.cyan },
    { title: "Graph\ndiffusion", color: C.purple },
    { title: "Recurrent\nmemory", color: C.blue },
    { title: "Next-hour\nflow", color: C.mint },
  ], 90, 236, 456);
  addText(slide, "If Germany changes, connected countries can provide context before the next prediction.", 92, 382, 450, 44, { size: 18, color: C.white, bold: true, align: "center" });
  addText(slide, "DCRNN is a forecasting benchmark, not a dispatch solver.", 96, 494, 440, 24, { size: 15, color: C.amber, bold: true, align: "center" });
  addFigure(slide, "dcrnn_training_curves.png", 610, 120, 606, 452, "Original DCRNN training curves", "Saved figure from results/figures");
  addNotes(slide, "Explain DCRNN with the road analogy. It receives a sequence for all nodes, passes signals through graph transitions, and then updates recurrent memory. The original DCRNN training figure shows the saved loss and macro-F1 behavior over epochs.");
}

// 10. Original results gallery 1
{
  const slide = newSlide("Saved results: learning and classification", "Original figures", 10);
  addFigure(slide, "training_curves.png", 64, 120, 554, 452, "Original Fusion GRU training curves", "Saved figure from results/figures");
  addFigure(slide, "roc_pr_curves.png", 646, 120, 554, 452, "Original ROC and precision-recall curves", "Saved figure from results/figures");
  addNotes(slide, "Use the original training_curves.png and roc_pr_curves.png. Training and validation behavior helps identify overfitting. ROC and precision-recall curves show how stress classification changes as the threshold moves.");
}

// 11. Original results gallery 2 and interpretation
{
  const slide = newSlide("Saved results: feature interpretation and error analysis", "Original figures", 11);
  addFigure(slide, "feature_importance.png", 64, 120, 554, 452, "Original feature importance figure", "Saved figure from results/figures");
  addFigure(slide, "error_distribution.png", 646, 120, 554, 452, "Original error distribution figure", "Saved figure from results/figures");
  addText(slide, "Recent local net flow is the strongest saved predictive signal. Abrupt movements create the most difficult errors.", 170, 582, 940, 22, { size: 15, color: C.white, bold: true, align: "center" });
  addNotes(slide, "Use the original feature_importance.png and error_distribution.png. A larger permutation delta means the model depended more on that feature in validation. The error distribution shows how failures are spread and why abrupt changes need better future data or a stronger model.");
}

// 12. Integration and conclusion
{
  const slide = newSlide("Complete workflow, novelty, and limits", "Conclusion", 12);
  addPanel(slide, 64, 120, 590, 452, "Complete implementation path", "Every stage leaves an inspectable artifact");
  addFlow(slide, [
    { title: "CSV", color: C.cyan },
    { title: "Pipeline", color: C.blue },
    { title: "Features\nand graph", color: C.mint },
    { title: "Forecast\nand risk", color: C.amber },
    { title: "Route\nwhat-if", color: C.purple },
  ], 94, 220, 530);
  addBullets(slide, [
    { text: "Novelty: transparent integration of data quality, prediction, proxy physics, and routing", color: C.cyan },
    { text: "The website shows a historical replay and deterministic forecast", color: C.mint },
    { text: "Real deployment needs verified ratings, N-1 analysis, live telemetry, and operator approval", color: C.coral },
  ], 94, 350, 520, 52, 15);
  addPanel(slide, 690, 120, 526, 452, "Final interpretation", "What the project can claim honestly");
  addText(slide, "Prediction answers:\nwhat may happen next?", 730, 212, 450, 58, { size: 22, color: C.cyan, bold: true, align: "center" });
  addText(slide, "Routing answers:\nwhat option should be investigated?", 730, 322, 450, 58, { size: 22, color: C.purple, bold: true, align: "center" });
  addText(slide, "Engineering validation answers:\ncan any action be considered safe?", 730, 432, 450, 58, { size: 20, color: C.amber, bold: true, align: "center" });
  addNotes(slide, "Close with the complete workflow. State that the project is strongest as an auditable decision-support prototype. The model predicts, the route planner tests a counterfactual, and an engineer remains responsible for operational validation.");
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

const finalizer = await import("file:///C:/Users/Krishna%20Karthik/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/artifact_tool_utils.mjs");
await finalizer.finalizePresentation({
  explicitTotalSlideCount: 12,
  candidatePath: CANDIDATE,
  finalPath: FINAL,
  workspaceDir: ROOT,
  pythonExecutable: "C:/Users/ Krishna Karthik/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe".replace("/ Krishna", "/Krishna"),
  integrityValidatorPath: "C:/Users/Krishna Karthik/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/inspect_presentation_package_integrity.py",
  layoutValidatorPath: "C:/Users/Krishna Karthik/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/inspect_presentation_layout_geometry.py",
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit", "--require-native-table-slide", "7"],
  requiredNativeTableOwnerSlides: [7],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: "design", families: [FONT] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(BUILD, "GridPulse_10_Minute_Original_Figures_v2.validation.json"),
});

