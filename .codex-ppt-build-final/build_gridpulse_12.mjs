import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:\\Users\\Krishna Karthik\\Desktop\\predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build-final");
const OUT = path.join(ROOT, ".codex-ppt-output-final");
const FIG = path.join(ROOT, "results", "figures");
const FINAL = path.join(OUT, "GridPulse_Complete_Predictive_Prescriptive_Analytics_12_Slides.pptx");
const W = 1280;
const H = 720;
const FONT = "Arial";

const C = {
  paper: "#F7F5EF", white: "#FFFFFF", navy: "#17324D", navy2: "#234A66",
  text: "#243444", muted: "#667685", line: "#D9E0E4", teal: "#168C8C",
  tealLight: "#DDF1EE", orange: "#D97B32", orangeLight: "#F8E8D7",
  purple: "#6B5BD6", purpleLight: "#ECE9FB", red: "#C6544A",
  green: "#3A8A65", greenLight: "#E3F0E8", greyLight: "#EEF2F4",
};

const IMAGE_BYTES = new Map();

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function shape(slide, geometry, left, top, width, height, fill = "none", lineFill = "none", lineWidth = 0) {
  return slide.shapes.add({ geometry, position: { left, top, width, height }, fill, line: { style: "solid", fill: lineFill, width: lineWidth } });
}

function text(slide, value, left, top, width, height, size = 18, color = C.text, options = {}) {
  const box = shape(slide, "textbox", left, top, width, height);
  box.text = value;
  box.text.style = { fontSize: size, color, fontFamily: FONT, bold: Boolean(options.bold), italic: Boolean(options.italic), alignment: options.alignment || "left", lineSpacing: options.lineSpacing || 1.12 };
  return box;
}

function box(slide, left, top, width, height, fill, lineFill = C.line) {
  return slide.shapes.add({ geometry: "roundRect", position: { left, top, width, height }, fill, line: { style: "solid", fill: lineFill, width: 1 }, borderRadius: "rounded-lg" });
}

function line(slide, left, top, width, color = C.line, thickness = 1) {
  return shape(slide, "line", left, top, width, thickness, "none", color, thickness);
}

function header(slide, title, kicker, number) {
  slide.background.fill = C.paper;
  shape(slide, "rect", 0, 0, W, 14, C.navy);
  text(slide, kicker.toUpperCase(), 62, 34, 520, 22, 11, C.teal, { bold: true });
  text(slide, title, 62, 56, 1130, 48, 31, C.navy, { bold: true, lineSpacing: 1.0 });
  line(slide, 62, 112, 1156, C.line, 1);
  text(slide, "GRIDPULSE  /  PREDICTIVE ANALYTICS", 62, 684, 390, 18, 10, C.muted, { bold: true });
  text(slide, String(number).padStart(2, "0"), 1180, 682, 36, 20, 11, C.navy, { bold: true, alignment: "right" });
}

function label(slide, value, left, top, width, color = C.muted) {
  return text(slide, value.toUpperCase(), left, top, width, 18, 10, color, { bold: true });
}

function note(slide, value) {
  slide.speakerNotes.text = value;
  slide.speakerNotes.setVisible(true);
}

function image(slide, fileName, left, top, width, height, alt) {
  const filePath = path.join(FIG, fileName);
  return slide.images.add({ blob: IMAGE_BYTES.get(filePath), contentType: "image/png", alt, fit: "contain", position: { left, top, width, height } });
}

function metric(slide, value, caption, left, top, width, accent = C.teal) {
  box(slide, left, top, width, 84, C.white, C.line);
  shape(slide, "rect", left, top, 6, 84, accent);
  text(slide, value, left + 18, top + 12, width - 24, 30, 24, C.navy, { bold: true });
  text(slide, caption, left + 18, top + 49, width - 24, 22, 11, C.muted);
}

function addTableStyles(table, rows, cols, fontSize = 13) {
  table.borders.assign({ style: "solid", fill: C.line, width: 1 });
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = table.getCell(r, c);
      cell.text.style = { fontSize, color: r === 0 ? C.white : C.text, fontFamily: FONT, bold: r === 0 };
      cell.fill = r === 0 ? C.navy : (r % 2 === 0 ? C.white : C.greyLight);
    }
  }
}

async function build() {
  await fs.mkdir(BUILD, { recursive: true });
  await fs.mkdir(OUT, { recursive: true });
  for (const fileName of await fs.readdir(FIG)) {
    if (!fileName.toLowerCase().endsWith(".png")) continue;
    const filePath = path.join(FIG, fileName);
    const bytes = await fs.readFile(filePath);
    IMAGE_BYTES.set(filePath, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  let slideNo = 0;
  const add = () => { slideNo += 1; return presentation.slides.add(); };

  // 1. Cover
  {
    const slide = add();
    slide.background.fill = C.paper;
    shape(slide, "rect", 0, 0, 460, H, C.navy);
    shape(slide, "rect", 460, 0, 9, H, C.orange);
    text(slide, "PREDICTIVE ANALYTICS COURSE PROJECT", 66, 64, 330, 24, 12, "#B8D6DB", { bold: true });
    text(slide, "GraphPulse", 66, 142, 340, 56, 43, C.white, { bold: true });
    text(slide, "Graph-based predictive and prescriptive analytics for cross-border power grids", 66, 218, 345, 122, 24, C.white, { lineSpacing: 1.12 });
    text(slide, "Data → Cleaning → Features → Forecasting → Evaluation → Graph reasoning → Scenario simulation → Recommendation", 66, 394, 345, 96, 16, "#D8E7EA", { lineSpacing: 1.2 });
    text(slide, "Complete 12-slide final review", 520, 112, 650, 42, 28, C.navy, { bold: true });
    line(slide, 520, 176, 650, C.teal, 3);
    text(slide, "Team", 520, 220, 120, 20, 12, C.teal, { bold: true });
    text(slide, "Prakki Krishna Karthik  ·  23BCE1294\nVasudev  ·  23BCE1496\nShubham Bhuyan  ·  23BCE1809", 520, 248, 430, 98, 18, C.text, { lineSpacing: 1.28 });
    text(slide, "Faculty: Pattabiraman V\nCourse: Predictive Analytics", 520, 404, 410, 58, 16, C.muted, { lineSpacing: 1.25 });
    text(slide, "Research model surfaced: Fusion GRU\nGraph model benchmarked: DCRNN\nOperational replay baseline: Persistence", 520, 520, 500, 72, 17, C.navy, { bold: true, lineSpacing: 1.22 });
    text(slide, "Final review deck  |  October 2026", 520, 630, 420, 22, 12, C.muted, { bold: true });
    note(slide, "Introduce the project as one auditable pipeline. Make the model distinction explicit: Fusion GRU is the research winner on the saved holdout, DCRNN is the graph benchmark, and Persistence remains the lightweight operational replay baseline.");
  }

  // 2. Problem and objectives
  {
    const slide = add();
    header(slide, "Problem definition and project objectives", "1. Problem", slideNo);
    text(slide, "Cross-border flow is a network problem, not a single-line problem. A local change can affect neighbouring countries and the routes available for recovery.", 62, 145, 1120, 56, 21, C.navy, { bold: true, lineSpacing: 1.12 });
    box(slide, 62, 230, 548, 220, C.white, C.teal);
    label(slide, "Predictive question", 88, 256, 240, C.teal);
    text(slide, "What is likely to happen in the next hour?", 88, 298, 450, 54, 25, C.navy, { bold: true });
    text(slide, "Use recent load and net-flow history, global network context, and graph centrality to forecast next-hour net flow.", 88, 370, 450, 58, 17, C.text, { lineSpacing: 1.18 });
    box(slide, 670, 230, 548, 220, C.white, C.orange);
    label(slide, "Prescriptive question", 696, 256, 260, C.orange);
    text(slide, "What can we test when a link becomes stressed?", 696, 298, 470, 54, 25, C.navy, { bold: true });
    text(slide, "Reduce a selected transfer, search connected alternate paths, check headroom and loss, and report the trade-off for human review.", 696, 370, 470, 58, 17, C.text, { lineSpacing: 1.18 });
    label(slide, "Project objectives", 62, 500, 180, C.teal);
    text(slide, "01  Build a canonical 12-node / 24-link graph from two supplied CSVs.\n02  Compare transparent baselines, Fusion GRU, and DCRNN using chronological evaluation.\n03  Add explainable graph-stress screening and recommendation-only rerouting.", 62, 530, 1110, 82, 16, C.text, { lineSpacing: 1.18 });
    note(slide, "Prediction estimates the next-hour condition. Prescription tests an action. The project never claims automatic switching or dispatch control.");
  }

  // 3. Data and preprocessing
  {
    const slide = add();
    header(slide, "Data, cleaning, features, and graph construction", "2. Data", slideNo);
    metric(slide, "315,598", "dynamic country records", 62, 142, 210, C.teal);
    metric(slide, "1,262,592", "directional flow records", 286, 142, 220, C.orange);
    metric(slide, "12", "country nodes", 530, 142, 170, C.purple);
    metric(slide, "24", "canonical links", 724, 142, 180, C.navy2);
    metric(slide, "11", "selected features", 928, 142, 190, C.green);
    const table = slide.tables.add({ rows: 5, columns: 4, left: 62, top: 270, width: 1156, height: 230, values: [
      ["Source", "One row represents", "Important variables", "System role"],
      ["dynamic_with_flows.csv", "One country at one hour", "Load, net flow, imbalance, residual, weather, renewables", "Node signals + forecast features"],
      ["power_flow.csv", "One directional interconnector", "Datetime, source, target, power_flow_mw", "Edge direction + rerouting"],
      ["Processed manifest", "Canonical graph definition", "Nodes, edges, aliases, quality flags", "Data contract + API metadata"],
      ["Results folder", "One evaluation artifact", "Metrics, curves, matrices, graphs", "Evidence for decisions"],
    ] });
    addTableStyles(table, 5, 4, 12);
    label(slide, "Processing contract", 62, 532, 180, C.teal);
    text(slide, "Parse UTC → validate missing/duplicate/gap records → canonicalize aliases → align hourly histories → select 11 explainable features → chronological split → training-only scaling.", 218, 530, 1000, 32, 16, C.text, { bold: true });
    text(slide, "11 features = local flow, load, imbalance, residual + global flow/load/imbalance/residual + degree, closeness, betweenness centrality.", 62, 585, 1150, 26, 15, C.muted, { italic: true });
    note(slide, "Explain that the raw data is larger than the model tensor. The deliberate 11-feature contract keeps the experiment auditable and prevents irrelevant columns from becoming hidden model inputs.");
  }

  // 4. Models and experimental design
  {
    const slide = add();
    header(slide, "Forecasting models and experimental design", "3. Forecasting", slideNo);
    const cards = [
      [62, "Operational baseline", C.teal, "Persistence\nŷₜ₊₁ = yₜ", "Fast and transparent. Kept for replay and comparison."],
      [424, "Research model", C.orange, "Fusion GRU\nlocal + global + centrality → GRU → flow", "24-hour lookback; hidden size 32; research winner by RMSE."],
      [786, "Graph research model", C.purple, "DCRNN\nforward/reverse diffusion → recurrent update", "12 nodes jointly; 2 diffusion steps; hidden size 24."],
    ];
    cards.forEach(([left, kicker, color, title, desc]) => {
      box(slide, left, 158, 332, 250, C.white, color);
      label(slide, kicker, left + 24, 184, 250, color);
      text(slide, title, left + 24, 226, 282, 70, 22, C.navy, { bold: true, lineSpacing: 1.16 });
      text(slide, desc, left + 24, 320, 282, 58, 16, C.text, { lineSpacing: 1.15 });
    });
    box(slide, 62, 454, 1156, 128, C.navy, C.navy);
    text(slide, "Lookback: 24 hours", 90, 480, 240, 22, 17, C.white, { bold: true });
    text(slide, "Chronological holdout: final 168 hours", 388, 480, 320, 22, 17, C.white, { bold: true });
    text(slide, "Scaling: x′ = (x − μtrain) / σtrain", 782, 480, 345, 22, 17, "#D8E7EA", { bold: true });
    text(slide, "No random shuffle crosses the time boundary. Model selection uses pooled RMSE; classification uses Normal / Warning / Critical labels.", 90, 530, 1040, 26, 16, "#D8E7EA");
    note(slide, "Persistence is not persistent storage. It is a valid forecasting baseline. Fusion GRU and DCRNN are the advanced research experiments trained with the same leakage-safe target and holdout.");
  }

  // 5. DCRNN internals and worked example
  {
    const slide = add();
    header(slide, "DCRNN: diffusion before recurrence", "4. Graph model", slideNo);
    text(slide, "DCRNN preserves the country axis. At every hour, neighbouring information is diffused through the graph before a GRU-style update produces the next flow.", 62, 140, 1150, 36, 18, C.navy, { bold: true });
    box(slide, 62, 198, 550, 330, C.white, C.teal);
    label(slide, "Tensor and diffusion", 88, 224, 240, C.teal);
    text(slide, "X ∈ Rᴮ×²⁴×¹²×¹¹\nXₜ ∈ Rᴮ×¹²×¹¹\nHₜ₋₁ ∈ Rᴮ×¹²×²⁴\n\nSupports: Xₜ, A_fXₜ, A_f²Xₜ, A_rXₜ, A_r²Xₜ", 88, 264, 470, 170, 19, C.navy, { lineSpacing: 1.12 });
    text(slide, "A_f and A_r are row-normalized forward/reverse transitions. Two steps expose one-hop and two-hop context.", 88, 456, 470, 46, 15, C.muted, { italic: true });
    box(slide, 648, 198, 570, 330, C.white, C.purple);
    label(slide, "Simple A → B → C example", 674, 224, 300, C.purple);
    text(slide, "A: high flow   →   B: neighbour   →   C: two-hop", 674, 272, 500, 28, 19, C.navy, { bold: true });
    text(slide, "zₜ, rₜ = σ(Θg *D [Xₜ, Hₜ₋₁])\nĈₜ = tanh(Θc *D [Xₜ, rₜ ⊙ Hₜ₋₁])\nHₜ = zₜ ⊙ Hₜ₋₁ + (1 − zₜ) ⊙ Ĉₜ", 674, 326, 500, 112, 17, C.text, { lineSpacing: 1.16 });
    text(slide, "The gates decide how much old memory and new graph-informed information to keep.", 674, 466, 500, 36, 15, C.muted, { italic: true });
    text(slide, "Fusion GRU: 570.5 MW RMSE · DCRNN: 634.0 MW RMSE · DCRNN is slower because graph diffusion adds computation.", 62, 570, 1156, 28, 16, C.navy, { bold: true });
    note(slide, "Use the A–B–C example for a non-specialist audience. DCRNN is valuable because it tests the graph hypothesis, but topology alone does not guarantee improvement when the graph lacks complete electrical information.");
  }

  // 6. Model comparison and equations
  {
    const slide = add();
    header(slide, "Model comparison: evidence before complexity", "5. Results", slideNo);
    box(slide, 62, 148, 680, 430, C.white, C.line);
    image(slide, "model_comparison.png", 78, 164, 648, 396, "Original model comparison result");
    box(slide, 776, 148, 442, 430, C.white, C.line);
    label(slide, "Saved holdout results", 802, 176, 260, C.teal);
    text(slide, "Fusion GRU\nRMSE 570.5 MW · MAE 400.3 MW\nF1 85.6% · 34.7 ms", 802, 222, 370, 78, 20, C.navy, { bold: true, lineSpacing: 1.18 });
    text(slide, "Persistence\nRMSE 580.3 MW · MAE 375.8 MW\nF1 81.2% · 0.45 ms", 802, 322, 370, 78, 18, C.teal, { bold: true, lineSpacing: 1.18 });
    text(slide, "DCRNN\nRMSE 634.0 MW · MAE 436.2 MW\nF1 83.8% · 63.6 ms", 802, 422, 370, 78, 18, C.purple, { bold: true, lineSpacing: 1.18 });
    text(slide, "MAE = (1/n) Σ|y − ŷ|\nRMSE = √[(1/n) Σ(y − ŷ)²]", 802, 522, 370, 44, 15, C.muted, { italic: true, lineSpacing: 1.2 });
    note(slide, "Fusion GRU is the research winner by RMSE, while Persistence has lower MAE and much lower inference time. This is why the interface distinguishes research model from operational baseline rather than hiding the baseline.");
  }

  // 7. Training curves
  {
    const slide = add();
    header(slide, "Training behaviour and generalization", "6. Evaluation", slideNo);
    box(slide, 62, 148, 558, 430, C.white, C.line);
    label(slide, "Fusion GRU training evidence", 88, 176, 300, C.teal);
    image(slide, "training_curves.png", 78, 204, 526, 300, "Original Fusion GRU training curves");
    text(slide, "Training loss and macro-F1 are tracked across epochs. The validation curves show whether the model continues to generalize.", 88, 522, 500, 34, 15, C.muted, { lineSpacing: 1.12 });
    box(slide, 660, 148, 558, 430, C.white, C.line);
    label(slide, "DCRNN training evidence", 686, 176, 300, C.purple);
    image(slide, "dcrnn_training_curves.png", 676, 204, 526, 300, "Original DCRNN training curves");
    text(slide, "DCRNN uses the same target and chronological protocol but keeps the node axis and applies diffusion at each recurrent update.", 686, 522, 500, 34, 15, C.muted, { lineSpacing: 1.12 });
    note(slide, "Do not claim that a falling training curve alone proves production readiness. The important evidence is the shared chronological holdout and the comparison of validation/test metrics.");
  }

  // 8. Classification and error analysis
  {
    const slide = add();
    header(slide, "Classification, thresholding, and error analysis", "7. Evaluation", slideNo);
    box(slide, 62, 148, 480, 260, C.white, C.line);
    label(slide, "Fusion GRU confusion matrix", 88, 174, 300, C.teal);
    const table = slide.tables.add({ rows: 4, columns: 4, left: 88, top: 208, width: 428, height: 160, values: [
      ["Actual \\ Pred.", "Normal", "Warning", "Critical"],
      ["Normal", "1490", "58", "0"],
      ["Warning", "37", "260", "25"],
      ["Critical", "0", "27", "119"],
    ] });
    addTableStyles(table, 4, 4, 12);
    text(slide, "Rows = actual class; columns = predicted class. Off-diagonal cells show misses and false alarms.", 88, 380, 425, 28, 14, C.muted);
    box(slide, 570, 148, 648, 260, C.white, C.line);
    label(slide, "Fusion GRU ROC and Precision–Recall", 596, 174, 360, C.orange);
    image(slide, "roc_pr_curves.png", 586, 202, 300, 180, "Original Fusion GRU ROC and PR curves");
    image(slide, "dcrnn_roc_pr_curves.png", 900, 202, 300, 180, "Original DCRNN ROC and PR curves");
    text(slide, "Fusion GRU", 620, 382, 180, 18, 13, C.teal, { bold: true });
    text(slide, "DCRNN", 1020, 382, 180, 18, 13, C.purple, { bold: true });
    box(slide, 62, 438, 1156, 140, C.white, C.line);
    label(slide, "Qualitative error distribution", 88, 464, 300, C.orange);
    image(slide, "error_distribution.png", 88, 486, 430, 78, "Original forecast error distribution");
    text(slide, "Thresholds are not random: Warning and Critical are absolute net-flow magnitudes at the 75th and 90th training quantiles. Critical events are rarer, so F1, recall, ROC-AUC, and Precision–Recall complement accuracy.", 560, 480, 620, 64, 16, C.text, { lineSpacing: 1.16 });
    note(slide, "Explain why accuracy alone is insufficient. A model can look accurate by predicting Normal frequently, while missing Warning or Critical cases. The saved confusion matrix exposes those errors.");
  }

  // 9. Feature interpretation
  {
    const slide = add();
    header(slide, "Feature interpretation and representation", "8. Explainability", slideNo);
    box(slide, 62, 148, 558, 390, C.white, C.line);
    label(slide, "Permutation / ablation importance", 88, 176, 340, C.teal);
    image(slide, "feature_importance.png", 78, 204, 526, 280, "Original feature importance result");
    text(slide, "The feature catalogue combines local time series, global network context, and static graph centrality.", 88, 498, 500, 32, 15, C.muted, { lineSpacing: 1.12 });
    box(slide, 660, 148, 558, 390, C.white, C.line);
    label(slide, "t-SNE hidden-state projection", 686, 176, 300, C.purple);
    image(slide, "tsne_projection.png", 676, 204, 526, 280, "Original t-SNE projection");
    text(slide, "Similar learned states should appear closer in the projected representation; overlap highlights difficult cases.", 686, 498, 500, 32, 15, C.muted, { lineSpacing: 1.12 });
    box(slide, 62, 568, 1156, 52, C.navy, C.navy);
    text(slide, "Interpretation principle: a model result is stronger when the audience can see which inputs, classes, and network structures shaped it.", 88, 582, 1100, 26, 16, C.white, { bold: true });
    note(slide, "Feature importance is evidence of sensitivity, not proof of causality. t-SNE is a visual diagnostic, not a performance metric.");
  }

  // 10. Graph reasoning
  {
    const slide = add();
    header(slide, "Graph reasoning: stress propagation and resilience", "9. Graph intelligence", slideNo);
    const items = [
      ["graph_stress_propagation.png", 62, 148, "Node stress after two-step propagation"],
      ["graph_node_influence.png", 660, 148, "Node influence ranking"],
      ["graph_resilience_ranking.png", 62, 408, "Counterfactual edge-removal ranking"],
      ["graph_stress_timeline.png", 660, 408, "Stress over recent replay hours"],
    ];
    items.forEach(([fileName, left, top, caption]) => {
      box(slide, left, top, 558, 228, C.white, C.line);
      label(slide, caption, left + 24, top + 20, 420, left < 500 ? C.teal : C.purple);
      image(slide, fileName, left + 16, top + 48, 526, 160, caption);
    });
    text(slide, "Dynamic stress = 0.45 utilization + 0.25 endpoint risk + 0.20 propagated risk + 0.10 loss proxy. Criticality also includes betweenness and the topology impact of removing an edge.", 62, 650, 1156, 24, 14, C.navy, { bold: true });
    note(slide, "These are transparent graph-screening artifacts. They explain influence and resilience, but they are not N-1 certification or AC power-flow validation.");
  }

  // 11. Physics and prescriptive routing
  {
    const slide = add();
    header(slide, "Physics lens, scenario simulation, and rerouting", "10. Prescription", slideNo);
    box(slide, 62, 148, 500, 430, C.white, C.orange);
    label(slide, "Distance-based loss proxy", 88, 176, 300, C.orange);
    text(slide, "R = ρL/A\nS = |P|/pf\nI = S/(√3V)\nP_loss = 3I²R", 88, 228, 330, 152, 28, C.navy, { bold: true, lineSpacing: 1.3 });
    text(slide, "Haversine centroid distance\nρ = 1.68 × 10⁻⁸ Ωm\nA = 2,000 mm²\nV = 400 kV · pf = 0.95", 88, 410, 360, 92, 16, C.text, { lineSpacing: 1.2 });
    text(slide, "Proxy only: replace assumptions with surveyed line geometry and engineering ratings before operational use.", 88, 526, 410, 30, 14, C.muted, { italic: true });
    box(slide, 620, 148, 598, 430, C.white, C.teal);
    label(slide, "What-if rerouting algorithm", 646, 176, 300, C.teal);
    text(slide, "1  Select a stressed edge\n2  Move a chosen share of transfer\n3  Remove the edge temporarily\n4  Search connected alternate paths\n5  Reject insufficient headroom / critical links\n6  Score distance, utilization, loss, and risk\n7  Report route, bottlenecks, and loss delta", 646, 218, 520, 214, 18, C.navy, { bold: true, lineSpacing: 1.25 });
    text(slide, "Recommendation only: the planner does not switch equipment or dispatch generation.", 646, 488, 520, 38, 16, C.orange, { bold: true });
    text(slide, "Example: CH–DE → CH–AT–DE; 25% moved; best-effort review because proxy loss increases.", 62, 610, 1156, 28, 16, C.navy, { bold: true });
    note(slide, "The prescription layer is a constrained what-if search. A route can relieve a stressed link while increasing estimated loss, so the UI exposes the trade-off rather than hiding it.");
  }

  // 12. Interface and conclusion
  {
    const slide = add();
    header(slide, "Interface, findings, limitations, and conclusion", "11. Integration", slideNo);
    box(slide, 62, 148, 520, 370, C.white, C.teal);
    label(slide, "How the browser receives the evidence", 88, 176, 360, C.teal);
    text(slide, "Processed CSV artifacts\n        ↓\nPython pipeline + graph analysis\n        ↓\nserver.py REST + SSE replay\n        ↓\nHTML + SVG + JavaScript\n        ↓\ntopology + forecast + graph + reroute", 88, 218, 440, 184, 18, C.navy, { lineSpacing: 1.08 });
    text(slide, "Fusion GRU is the research model; Persistence is the operational baseline. Moving particles show historical replay, not live SCADA telemetry.", 88, 442, 440, 48, 14, C.muted, { lineSpacing: 1.08 });
    box(slide, 620, 148, 598, 370, C.purpleLight, C.purple);
    label(slide, "What the project contributes", 646, 176, 300, C.purple);
    text(slide, "01  Auditable predictive + prescriptive workflow\n02  Fusion GRU and DCRNN compared on the same holdout\n03  Explicit DCRNN diffusion and graph-risk evidence\n04  Explainable feature, error, and resilience views\n05  Rerouting with visible headroom and loss guardrails", 646, 218, 520, 190, 17, C.text, { lineSpacing: 1.2 });
    text(slide, "Next: connect verified telemetry, thermal ratings, AC power flow, and N-1 validation.", 646, 448, 520, 40, 16, C.purple, { bold: true });
    box(slide, 62, 552, 1156, 66, C.navy, C.navy);
    text(slide, "Final takeaway: Fusion GRU is the research winner; Persistence remains a transparent baseline; DCRNN tests the graph hypothesis; the system recommends evidence for human review, not automatic operation.", 88, 570, 1100, 38, 16, C.white, { bold: true, lineSpacing: 1.1 });
    note(slide, "Close by stating the honest model hierarchy and the system limitation. Complexity is demonstrated through the trained Fusion GRU, DCRNN diffusion, evaluation evidence, and graph-prescriptive layer—not by hiding the baseline.");
  }

  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await writeBlob(path.join(BUILD, "GridPulse_12_review_montage.webp"), montage);
  for (const [index, slide] of presentation.slides.items.entries()) {
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(BUILD, `slide12-${String(index + 1).padStart(2, "0")}.png`), png);
  }
  const candidate = path.join(BUILD, "candidate_12.pptx");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(candidate);
  console.log(JSON.stringify({ candidate, final: FINAL, slides: presentation.slides.items.length, montage: path.join(BUILD, "GridPulse_12_review_montage.webp") }, null, 2));
}

build().catch((error) => { console.error(error); process.exitCode = 1; });
