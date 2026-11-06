import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:\\Users\\Krishna Karthik\\Desktop\\predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build-final");
const OUT = path.join(ROOT, ".codex-ppt-output-final");
const FIG = path.join(ROOT, "results", "figures");
const RESULTS = path.join(ROOT, "results");
const DATA = path.join(ROOT, "data", "processed");
const FINAL = path.join(OUT, "GridPulse_Complete_Predictive_Prescriptive_Analytics_Review_v3.pptx");
const W = 1280;
const H = 720;
const FONT = "Arial";

const C = {
  paper: "#F7F5EF",
  white: "#FFFFFF",
  navy: "#17324D",
  navy2: "#234A66",
  text: "#243444",
  muted: "#667685",
  line: "#D9E0E4",
  teal: "#168C8C",
  tealLight: "#DDF1EE",
  orange: "#D97B32",
  orangeLight: "#F8E8D7",
  purple: "#6B5BD6",
  purpleLight: "#ECE9FB",
  red: "#C6544A",
  redLight: "#F7E1DF",
  green: "#3A8A65",
  greenLight: "#E3F0E8",
  greyLight: "#EEF2F4",
};

const IMAGE_BYTES = new Map();

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function shape(slide, geometry, left, top, width, height, fill = "none", lineFill = "none", lineWidth = 0) {
  return slide.shapes.add({
    geometry,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function text(slide, value, left, top, width, height, size = 18, color = C.text, options = {}) {
  const box = shape(slide, "textbox", left, top, width, height, "none", "none", 0);
  box.text = value;
  box.text.style = {
    fontSize: size,
    color,
    fontFamily: FONT,
    bold: Boolean(options.bold),
    italic: Boolean(options.italic),
    alignment: options.alignment || "left",
    lineSpacing: options.lineSpacing || 1.12,
  };
  return box;
}

function box(slide, left, top, width, height, fill, lineFill = C.line, radius = "rounded-lg") {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: 1 },
    borderRadius: radius,
  });
}

function line(slide, left, top, width, color = C.line, thickness = 1) {
  return shape(slide, "line", left, top, width, thickness, "none", color, thickness);
}

function image(slide, filePath, left, top, width, height, alt) {
  return slide.images.add({
    blob: IMAGE_BYTES.get(filePath),
    contentType: "image/png",
    alt,
    fit: "contain",
    position: { left, top, width, height },
  });
}

function header(slide, title, kicker, number) {
  slide.background.fill = C.paper;
  shape(slide, "rect", 0, 0, W, 14, C.navy, "none", 0);
  text(slide, kicker.toUpperCase(), 62, 34, 480, 22, 11, C.teal, { bold: true });
  text(slide, title, 62, 56, 1050, 48, 31, C.navy, { bold: true, lineSpacing: 1.0 });
  line(slide, 62, 112, 1156, C.line, 1);
  text(slide, `GRIDPULSE  /  PREDICTIVE ANALYTICS`, 62, 684, 390, 18, 10, C.muted, { bold: true });
  text(slide, String(number).padStart(2, "0"), 1180, 682, 36, 20, 11, C.navy, { bold: true, alignment: "right" });
}

function note(slide, value) {
  slide.speakerNotes.text = value;
  slide.speakerNotes.setVisible(true);
}

function label(slide, value, left, top, width, color = C.muted) {
  return text(slide, value.toUpperCase(), left, top, width, 18, 10, color, { bold: true });
}

function smallCaption(slide, value, left, top, width) {
  return text(slide, value, left, top, width, 24, 11, C.muted, { italic: true });
}

function bulletLines(slide, lines, left, top, width, size = 17, gap = 28, color = C.text) {
  lines.forEach((item, index) => {
    text(slide, `${String(index + 1).padStart(2, "0")}  ${item}`, left, top + index * gap, width, gap + 8, size, color, { lineSpacing: 1.05 });
  });
}

function metric(slide, value, caption, left, top, width, accent = C.teal) {
  box(slide, left, top, width, 96, C.white, C.line);
  shape(slide, "rect", left, top, 6, 96, accent, "none", 0);
  text(slide, value, left + 20, top + 15, width - 28, 34, 26, C.navy, { bold: true });
  text(slide, caption, left + 20, top + 58, width - 28, 24, 12, C.muted);
}

function addTableStyles(table, rows, cols, headerRows = 1, fontSize = 14) {
  table.borders.assign({ style: "solid", fill: C.line, width: 1 });
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = table.getCell(r, c);
      cell.text.style = { fontSize, color: r < headerRows ? C.white : C.text, fontFamily: FONT, bold: r < headerRows };
      cell.fill = r < headerRows ? C.navy : (r % 2 === 0 ? C.white : C.greyLight);
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
    shape(slide, "rect", 0, 0, 460, H, C.navy, "none", 0);
    shape(slide, "rect", 460, 0, 9, H, C.orange, "none", 0);
    text(slide, "PREDICTIVE ANALYTICS COURSE PROJECT", 66, 64, 330, 24, 12, "#B8D6DB", { bold: true });
    text(slide, "GraphPulse", 66, 142, 340, 56, 43, C.white, { bold: true });
    text(slide, "Graph-based predictive and prescriptive analytics for cross-border power grids", 66, 218, 345, 122, 24, C.white, { bold: false, lineSpacing: 1.12 });
    text(slide, "Data → Cleaning → Features → Forecasting → Evaluation → Graph reasoning → Scenario simulation → Recommendation", 66, 394, 345, 96, 16, "#D8E7EA", { lineSpacing: 1.2 });
    text(slide, "A complete, auditable workflow from raw hourly records to an explainable rerouting scenario", 520, 112, 650, 64, 28, C.navy, { bold: true, lineSpacing: 1.05 });
    line(slide, 520, 200, 650, C.teal, 3);
    text(slide, "Team", 520, 242, 120, 20, 12, C.teal, { bold: true });
    text(slide, "Prakki Krishna Karthik  ·  23BCE1294\nVasudev  ·  23BCE1496\nShubham Bhuyan  ·  23BCE1809", 520, 270, 410, 98, 18, C.text, { lineSpacing: 1.28 });
    text(slide, "Faculty: Pattabiraman V\nCourse: Predictive Analytics", 520, 420, 410, 58, 16, C.muted, { lineSpacing: 1.25 });
    text(slide, "Final review deck  |  October 2026", 520, 630, 420, 22, 12, C.muted, { bold: true });
    text(slide, "01", 1160, 650, 48, 24, 12, C.navy, { bold: true, alignment: "right" });
    note(slide, "Opening: introduce the operational question. The project predicts the next-hour state of a cross-border network, explains which nodes and edges are under pressure, and tests a possible alternate route. Team members: Prakki Krishna Karthik, Vasudev, and Shubham Bhuyan. Faculty: Pattabiraman V.");
  }

  // 2. Problem and objectives
  {
    const slide = add();
    header(slide, "Problem definition and project objectives", "1. Context", slideNo);
    text(slide, "Cross-border flow is a network problem, not a single-line problem. A local change can affect neighbouring countries and the routes available for recovery.", 62, 142, 720, 60, 21, C.navy, { bold: true, lineSpacing: 1.12 });
    box(slide, 62, 240, 520, 280, C.white, C.line);
    label(slide, "Predictive question", 88, 268, 230, C.teal);
    text(slide, "What is likely to happen in the next hour?", 88, 306, 430, 48, 25, C.navy, { bold: true });
    text(slide, "Forecast country net flow and load from recent time-series behaviour, global network context, and graph centrality.", 88, 380, 430, 76, 17, C.text, { lineSpacing: 1.18 });
    box(slide, 620, 240, 598, 280, C.white, C.line);
    label(slide, "Prescriptive question", 646, 268, 250, C.orange);
    text(slide, "What can we test when a link becomes stressed?", 646, 306, 500, 48, 25, C.navy, { bold: true });
    text(slide, "Remove a selected share of transfer, search connected alternate paths, check headroom and stress, and report the loss trade-off.", 646, 380, 500, 76, 17, C.text, { lineSpacing: 1.18 });
    text(slide, "Course alignment", 62, 576, 160, 20, 11, C.teal, { bold: true });
    text(slide, "Data preprocessing  ·  time-series forecasting  ·  regression metrics  ·  classification metrics  ·  class imbalance  ·  model comparison  ·  decision support", 218, 574, 1000, 30, 15, C.muted);
    note(slide, "Explain the distinction: predictive analytics estimates the future; prescriptive analytics evaluates an action. The project deliberately stops at recommendation because it lacks engineering-grade operating constraints.");
  }

  // 3. Dataset
  {
    const slide = add();
    header(slide, "Dataset profile and signals", "2. Data", slideNo);
    metric(slide, "315,598", "dynamic country records", 62, 142, 215, C.teal);
    metric(slide, "1,262,592", "directional flow records", 295, 142, 215, C.orange);
    metric(slide, "12", "country nodes", 528, 142, 180, C.purple);
    metric(slide, "24", "canonical interconnectors", 726, 142, 210, C.navy2);
    metric(slide, "960", "recent points retained for replay", 954, 142, 264, C.green);
    const table = slide.tables.add({
      rows: 5,
      columns: 4,
      left: 62,
      top: 280,
      width: 1156,
      height: 250,
      values: [
        ["Source", "One row represents", "Important variables", "Role in the system"],
        ["dynamic_with_flows.csv", "One country at one hour", "Load, net_flow, imbalance, residual, weather, renewables, coordinates, centrality", "Node signals and forecasting features"],
        ["power_flow.csv", "One directional interconnector record", "datetime, source, target, power_flow_mw", "Edge history, direction, utilization, rerouting"],
        ["Processed manifest", "One canonical graph definition", "Nodes, edges, aliases, quality flags, assumptions", "Data contract and API metadata"],
        ["Research results", "One evaluation artifact", "Metrics, curves, confusion matrix, graphs", "Evidence for model and graph decisions"],
      ],
    });
    addTableStyles(table, 5, 4, 1, 13);
    text(slide, "The raw files contain more variables than the current experiment uses. The model keeps a deliberate 11-feature set so each prediction remains explainable.", 62, 570, 1100, 34, 16, C.muted, { italic: true });
    note(slide, "Source: docs/VALIDATION_REPORT.md, data/processed/manifest.json, and the two supplied CSV headers. Emphasize that the project preserves the broader dataset but selects an explainable feature set for the benchmark.");
  }

  // 4. Workflow
  {
    const slide = add();
    header(slide, "End-to-end predictive and prescriptive workflow", "3. Pipeline", slideNo);
    text(slide, "Every downstream decision is traceable to a specific transformation of the original records.", 62, 140, 820, 32, 20, C.navy, { bold: true });
    const steps = [
      ["01", "Data", "Two CSV sources"],
      ["02", "Cleaning", "UTC, aliases, gaps"],
      ["03", "Features", "11 model inputs"],
      ["04", "Forecasting", "Next-hour flow"],
      ["05", "Evaluation", "Error + classes"],
      ["06", "Graph reasoning", "Stress + criticality"],
      ["07", "Scenario", "Move selected MW"],
      ["08", "Recommendation", "Route with guardrails"],
    ];
    const x0 = 62; const y = 245; const bw = 136; const gap = 9;
    steps.forEach(([n, title, sub], i) => {
      const x = x0 + i * (bw + gap);
      const accent = i < 3 ? C.teal : i < 5 ? C.purple : i < 7 ? C.orange : C.green;
      box(slide, x, y, bw, 150, C.white, accent);
      text(slide, n, x + 14, y + 14, 36, 20, 12, accent, { bold: true });
      text(slide, title, x + 14, y + 52, bw - 24, 36, 18, C.navy, { bold: true });
      text(slide, sub, x + 14, y + 98, bw - 24, 34, 12, C.muted, { lineSpacing: 1.08 });
      if (i < steps.length - 1) text(slide, "→", x + bw + 1, y + 62, gap + 4, 30, 20, C.muted, { bold: true, alignment: "center" });
    });
    box(slide, 62, 470, 1156, 112, C.navy, C.navy);
    text(slide, "Decision boundary", 88, 495, 180, 20, 11, "#A9D7DA", { bold: true });
    text(slide, "The model predicts. The graph layer explains. The scenario planner tests. The interface recommends. The system never dispatches the real grid automatically.", 88, 527, 1080, 38, 19, C.white, { bold: true, lineSpacing: 1.05 });
    note(slide, "Walk through the workflow slowly. This slide is the presentation backbone. Each later slide expands one block, so the audience can always locate the current method in the full pipeline.");
  }

  // 5. Cleaning
  {
    const slide = add();
    header(slide, "Data cleaning and canonicalization", "4. Cleaning", slideNo);
    const left = 62; const top = 148;
    label(slide, "What the pipeline checks", left, top, 260, C.teal);
    bulletLines(slide, [
      "Convert timestamps into ordered UTC time points.",
      "Parse numeric values and count missing cells before safe defaults.",
      "Check duplicate country–timestamp and edge–timestamp keys.",
      "Normalize aliases such as DE-AT → AT-DE and NL_NO → NL-NO.",
      "Retain timestamp gaps as quality evidence instead of hiding them.",
    ], left, top + 36, 540, 16, 47);
    box(slide, 675, 148, 543, 280, C.white, C.line);
    label(slide, "Quality results", 704, 176, 220, C.orange);
    metric(slide, "0", "dynamic missing cells", 704, 216, 220, C.green);
    metric(slide, "0", "power-flow missing cells", 952, 216, 220, C.green);
    metric(slide, "0", "duplicate composite keys", 704, 328, 220, C.green);
    metric(slide, "38", "country timestamp-gap hours", 952, 328, 220, C.orange);
    box(slide, 62, 512, 1156, 94, C.tealLight, C.teal);
    text(slide, "Why canonicalization matters", 88, 533, 240, 22, 17, C.teal, { bold: true });
    text(slide, "Without it, the same physical interconnector could appear as multiple graph edges. The model would then learn a false topology and the rerouting planner could send flow through a duplicate line.", 350, 530, 820, 42, 16, C.text, { lineSpacing: 1.08 });
    note(slide, "Source: docs/VALIDATION_REPORT.md and data/processed/manifest.json. Explain that cleaning is part of the scientific contribution because labels and gaps affect graph structure and downstream decisions.");
  }

  // 6. Graph and physics
  {
    const slide = add();
    header(slide, "Graph construction and distance-based loss proxy", "5. Graph foundation", slideNo);
    text(slide, "The graph uses countries as nodes and canonical interconnectors as edges. Coordinates add a transparent distance and loss lens.", 62, 140, 970, 36, 19, C.navy, { bold: true });
    box(slide, 62, 208, 520, 330, C.white, C.line);
    label(slide, "Electrical proxy", 88, 234, 200, C.orange);
    text(slide, "R = ρL / A", 88, 278, 400, 42, 28, C.navy, { bold: true });
    text(slide, "S = |P| / PF\nI = S / (√3 V)\nP_loss = 3I²R", 88, 340, 420, 120, 23, C.navy, { lineSpacing: 1.22 });
    text(slide, "L comes from Haversine centroid distance. ρ and A stay constant in the scenario model.", 88, 482, 420, 36, 14, C.muted, { lineSpacing: 1.12 });
    box(slide, 622, 208, 596, 330, C.white, C.line);
    label(slide, "Visible assumptions", 648, 234, 230, C.teal);
    const assumptionRows = [
      ["Voltage", "400 kV"],
      ["Power factor", "0.95"],
      ["Resistivity", "1.68 × 10⁻⁸ Ω·m"],
      ["Cross-section", "2,000 mm²"],
      ["Distance", "Haversine centroid distance"],
      ["Capacity", "95th percentile observed flow"],
    ];
    assumptionRows.forEach(([a, b], i) => {
      const y = 276 + i * 38;
      text(slide, a, 648, y, 210, 22, 16, C.muted);
      text(slide, b, 892, y, 286, 22, 16, C.text, { bold: true });
      line(slide, 648, y + 28, 528, C.line, 1);
    });
    box(slide, 62, 570, 1156, 48, C.orangeLight, C.orange);
    text(slide, "Interpretation: this is a scenario proxy for comparing alternatives, not an engineering-grade line study.", 88, 584, 1080, 22, 16, C.orange, { bold: true });
    note(slide, "Source: backend/physics.py and data/processed/manifest.json. Make the limitation explicit: the data lacks surveyed route geometry, conductor parameters, actual voltage, and thermal ratings.");
  }

  // 7. Features
  {
    const slide = add();
    header(slide, "Feature extraction for next-hour prediction", "6. Features", slideNo);
    text(slide, "The model receives a compact, explainable representation of each country and its network context.", 62, 140, 820, 32, 20, C.navy, { bold: true });
    box(slide, 62, 210, 350, 330, C.tealLight, C.teal);
    label(slide, "Local time series", 88, 236, 220, C.teal);
    text(slide, "1  Local net flow\n2  Local load\n3  Flow imbalance\n4  Load residual", 88, 286, 270, 150, 20, C.navy, { lineSpacing: 1.28 });
    box(slide, 465, 210, 350, 330, C.purpleLight, C.purple);
    label(slide, "Global network context", 491, 236, 250, C.purple);
    text(slide, "5  Mean net flow\n6  Mean load\n7  Mean absolute imbalance\n8  Mean absolute residual", 491, 286, 280, 170, 20, C.navy, { lineSpacing: 1.25 });
    box(slide, 868, 210, 350, 330, C.orangeLight, C.orange);
    label(slide, "Static graph context", 894, 236, 230, C.orange);
    text(slide, "9  Degree centrality\n10  Closeness centrality\n11  Betweenness centrality", 894, 286, 280, 150, 20, C.navy, { lineSpacing: 1.35 });
    text(slide, "Target: next-hour country net flow", 62, 578, 460, 26, 20, C.navy, { bold: true });
    text(slide, "X_t = [local signals, global signals, graph signals] over the previous 24 hours", 555, 580, 663, 24, 16, C.muted, { italic: true });
    note(slide, "Source: results/feature_catalog.json and backend/experiments.py. Explain that the raw dataset includes weather, renewables, and calendar features, while the benchmark keeps these 11 inputs for a controlled and interpretable comparison.");
  }

  // 8. Target and split
  {
    const slide = add();
    header(slide, "Target construction and chronological validation", "7. Time series setup", slideNo);
    box(slide, 62, 150, 1156, 144, C.white, C.line);
    label(slide, "One training example", 88, 176, 230, C.teal);
    text(slide, "24-hour lookback", 88, 220, 180, 26, 18, C.navy, { bold: true });
    for (let i = 0; i < 7; i += 1) {
      const x = 300 + i * 86;
      box(slide, x, 214, 72, 42, i === 6 ? C.tealLight : C.greyLight, i === 6 ? C.teal : C.line);
      text(slide, i === 0 ? "t−23" : i === 6 ? "t" : `t−${23 - i * 4}`, x, 224, 72, 20, 14, i === 6 ? C.teal : C.text, { bold: true, alignment: "center" });
    }
    text(slide, "→", 930, 220, 44, 24, 21, C.orange, { bold: true, alignment: "center" });
    box(slide, 1000, 214, 150, 42, C.orangeLight, C.orange);
    text(slide, "target t+1", 1000, 224, 150, 20, 15, C.orange, { bold: true, alignment: "center" });
    text(slide, "No random shuffle", 62, 350, 220, 28, 21, C.navy, { bold: true });
    text(slide, "The split preserves time order so the model never sees future behaviour while learning the past.", 62, 394, 450, 70, 18, C.text, { lineSpacing: 1.16 });
    box(slide, 610, 342, 608, 210, C.white, C.line);
    const split = [
      ["Training", "Earlier observations", C.teal],
      ["Validation", "Next 168 hours", C.purple],
      ["Test", "Final 168 hours", C.orange],
    ];
    split.forEach(([a, b, col], i) => {
      const y = 370 + i * 52;
      shape(slide, "rect", 638, y, i === 0 ? 270 : i === 1 ? 142 : 142, 28, col, "none", 0);
      text(slide, a, 650, y + 5, 98, 18, 13, C.white, { bold: true });
      text(slide, b, 828, y + 5, 320, 18, 14, C.text);
    });
    text(slide, "Scaling uses training statistics only: x′ = (x − μ_train) / σ_train", 610, 552, 608, 28, 15, C.muted, { italic: true });
    note(slide, "Source: results/run_metadata.json and backend/experiments.py. Mention the 24-hour lookback, 168-hour validation and test horizons, and training-only standardization as the leakage controls.");
  }

  // 9. Models
  {
    const slide = add();
    header(slide, "Forecasting models and their roles", "8. Forecasting", slideNo);
    const models = [
      ["Persistence", "ŷₜ₊₁ = yₜ", "Transparent baseline. The next hour equals the current hour."],
      ["24h moving average", "ŷₜ₊₁ = mean(yₜ₋₂₃…yₜ)", "Smooths noise but reacts slowly to sudden changes."],
      ["Linear trend", "y = β₀ + β₁t", "Projects a recent slope inside a bounded window."],
      ["Seasonal naive", "ŷₜ₊₁ = yₜ₋₂₃", "Reuses the same hour from the previous day."],
    ];
    models.forEach(([name, formula, desc], i) => {
      const y = 150 + i * 104;
      const col = i === 0 ? C.teal : i === 1 ? C.purple : i === 2 ? C.orange : C.navy2;
      box(slide, 62, y, 1156, 82, C.white, C.line);
      shape(slide, "rect", 62, y, 8, 82, col, "none", 0);
      text(slide, name, 90, y + 14, 220, 22, 19, C.navy, { bold: true });
      text(slide, formula, 344, y + 14, 320, 22, 18, col, { bold: true });
      text(slide, desc, 700, y + 14, 480, 42, 16, C.text, { lineSpacing: 1.12 });
    });
    box(slide, 62, 590, 1156, 42, C.navy, C.navy);
    text(slide, "Live replay uses Persistence as a fast operational baseline; the research benchmark is led by Fusion GRU (570.5 MW RMSE), with DCRNN measured separately.", 88, 601, 1100, 22, 15, C.white, { bold: true });
    note(slide, "Source: data/processed/model_metrics.json and results/model_comparison.json. Explain the interface distinction honestly: Fusion GRU is surfaced as the research winner, while Persistence remains the lightweight baseline used by the current replay endpoint. Persistence is a forecasting method, not persistent storage.");
  }

  // 10. Fusion GRU and DCRNN
  {
    const slide = add();
    header(slide, "Fusion GRU and DCRNN architecture", "9. Research models", slideNo);
    box(slide, 62, 150, 545, 400, C.white, C.teal);
    label(slide, "Fusion GRU", 88, 176, 180, C.teal);
    text(slide, "Country sequence", 88, 230, 180, 22, 18, C.navy, { bold: true });
    text(slide, "local + global + centrality\n        ↓\n24-hour GRU\n        ↓\nLayerNorm + linear head\n        ↓\nnext-hour net flow", 88, 270, 370, 198, 20, C.text, { lineSpacing: 1.23 });
    text(slide, "Hidden size: 32", 88, 498, 200, 22, 14, C.muted, { italic: true });
    box(slide, 655, 150, 563, 400, C.white, C.purple);
    label(slide, "DCRNN", 681, 176, 160, C.purple);
    text(slide, "All 12 countries together", 681, 230, 260, 22, 18, C.navy, { bold: true });
    text(slide, "node features at t\n        ↓\nforward + reverse graph diffusion\n        ↓\nrecurrent graph update\n        ↓\nnext-hour flow for every node", 681, 270, 430, 198, 20, C.text, { lineSpacing: 1.23 });
    text(slide, "2 diffusion steps · hidden size: 24", 681, 498, 330, 22, 14, C.muted, { italic: true });
    text(slide, "DCRNN tests whether neighbouring-country information improves forecasting. It does not solve AC power-flow equations.", 62, 584, 1156, 32, 17, C.navy, { bold: true });
    note(slide, "Source: results/run_metadata.json and backend/experiments.py. Explain the difference in simple terms: Fusion GRU processes a country sequence with global context; DCRNN exchanges information through the graph at every recurrent step.");
  }

  // 11. DCRNN internals
  {
    const slide = add();
    header(slide, "DCRNN internals: diffusion before recurrence", "10. DCRNN method", slideNo);
    text(slide, "DCRNN keeps the node axis intact. At every hour, it diffuses information through the 12-country graph before applying a GRU-style update.", 62, 140, 1110, 34, 19, C.navy, { bold: true });
    box(slide, 62, 204, 330, 330, C.white, C.teal);
    label(slide, "Input and hidden state", 88, 230, 240, C.teal);
    text(slide, "X ∈ Rᴮ×²⁴×¹²×¹¹\n\nAt one hour:\nXₜ ∈ Rᴮ×¹²×¹¹\nHₜ₋₁ ∈ Rᴮ×¹²×²⁴\n\nJoined channels = 11 + 24 = 35", 88, 276, 270, 190, 19, C.navy, { lineSpacing: 1.22 });
    text(slide, "B = batch size · 24 = lookback · 12 = countries · 11 = features", 88, 486, 270, 30, 13, C.muted, { lineSpacing: 1.08 });
    box(slide, 430, 204, 350, 330, C.white, C.purple);
    label(slide, "Two-way diffusion", 456, 230, 220, C.purple);
    text(slide, "A_f and A_r are row-normalized transitions with self-loops.", 456, 276, 286, 42, 17, C.text, { lineSpacing: 1.12 });
    text(slide, "Supports used by the convolution:\n\nXₜ\nA_f Xₜ\nA_f² Xₜ\nA_r Xₜ\nA_r² Xₜ", 456, 326, 286, 184, 18, C.navy, { lineSpacing: 1.08 });
    box(slide, 818, 204, 400, 330, C.white, C.orange);
    label(slide, "Recurrent graph update", 844, 230, 260, C.orange);
    text(slide, "zₜ, rₜ = σ(Θg *D [Xₜ, Hₜ₋₁])\n\nĈₜ = tanh(Θc *D [Xₜ, rₜ ⊙ Hₜ₋₁])\n\nHₜ = zₜ ⊙ Hₜ₋₁ + (1 − zₜ) ⊙ Ĉₜ\n\nŷₜ₊₁ = Linear(LayerNorm(Hₜ))", 844, 276, 332, 190, 18, C.navy, { lineSpacing: 1.16 });
    text(slide, "*D means diffusion convolution. The gates decide how much old memory and new graph-informed information to keep.", 62, 576, 1156, 38, 16, C.muted, { italic: true, lineSpacing: 1.1 });
    note(slide, "Source: backend/experiments.py, especially DiffusionGraphConv, DCRNNCell, and DCRNN. The saved run uses input shape 150 × 24 × 12 × 11, hidden size 24, two diffusion steps, and forward/reverse row-normalized transitions.");
  }

  // 12. DCRNN example and interpretation
  {
    const slide = add();
    header(slide, "DCRNN worked example: how a neighbour affects a forecast", "11. DCRNN method", slideNo);
    text(slide, "Imagine three connected countries. The same mechanism runs on all 12 countries in the actual experiment.", 62, 140, 900, 32, 19, C.navy, { bold: true });
    box(slide, 62, 206, 570, 330, C.white, C.teal);
    label(slide, "One simplified graph step", 88, 232, 240, C.teal);
    box(slide, 100, 302, 120, 64, C.orangeLight, C.orange);
    text(slide, "A\nhigh flow", 100, 316, 120, 38, 17, C.orange, { bold: true, alignment: "center" });
    text(slide, "→", 235, 318, 50, 28, 24, C.muted, { bold: true, alignment: "center" });
    box(slide, 294, 302, 120, 64, C.purpleLight, C.purple);
    text(slide, "B\nneighbor", 294, 316, 120, 38, 17, C.purple, { bold: true, alignment: "center" });
    text(slide, "→", 429, 318, 50, 28, 24, C.muted, { bold: true, alignment: "center" });
    box(slide, 488, 302, 120, 64, C.tealLight, C.teal);
    text(slide, "C\n2-hop", 488, 316, 120, 38, 17, C.teal, { bold: true, alignment: "center" });
    text(slide, "A_f B and A_r B carry one-hop information. Applying them again carries a two-hop signal. The recurrent gates then decide whether that neighbour signal should change the hidden state.", 88, 402, 496, 88, 17, C.text, { lineSpacing: 1.15 });
    box(slide, 676, 206, 542, 330, C.white, C.line);
    label(slide, "Saved research comparison", 702, 232, 260, C.purple);
    const table = slide.tables.add({
      rows: 5,
      columns: 3,
      left: 702,
      top: 274,
      width: 490,
      height: 190,
      values: [
        ["Metric", "Fusion GRU", "DCRNN"],
        ["RMSE", "570.5 MW", "634.0 MW"],
        ["MAE", "400.3 MW", "436.2 MW"],
        ["F1", "85.6%", "83.8%"],
        ["Inference", "34.7 ms", "63.6 ms"],
      ],
    });
    addTableStyles(table, 5, 3, 1, 14);
    table.getCell(4, 2).fill = C.purpleLight;
    text(slide, "Interpretation", 62, 576, 150, 22, 15, C.orange, { bold: true });
    text(slide, "DCRNN is valuable because it tests the graph hypothesis. It lags here because topology is incomplete electrical information, neighbour signals can add noise, and the benchmark has limited engineering labels.", 218, 574, 1000, 32, 15, C.text, { lineSpacing: 1.1 });
    note(slide, "Source: results/model_comparison.json, results/dcrnn_analysis.json, and results/run_metadata.json. Use the three-node illustration only as a teaching example. The actual model processes 12 countries jointly and predicts the next net flow for every node.");
  }

  // 11. Evaluation strategy
  {
    const slide = add();
    header(slide, "Evaluation strategy and equations", "12. Evaluation", slideNo);
    box(slide, 62, 150, 548, 420, C.white, C.line);
    label(slide, "Regression evaluation", 88, 178, 240, C.teal);
    text(slide, "MAE = (1/n) Σ |y − ŷ|\n\nRMSE = √[(1/n) Σ (y − ŷ)²]\n\nMAPE = (100/n) Σ |(y − ŷ) / y|", 88, 228, 440, 206, 21, C.navy, { lineSpacing: 1.25 });
    text(slide, "RMSE drives model selection. MAPE is included for completeness but becomes unstable when net flow is near zero or changes sign.", 88, 474, 440, 60, 15, C.muted, { lineSpacing: 1.12 });
    box(slide, 670, 150, 548, 420, C.white, C.line);
    label(slide, "Stress-class evaluation", 696, 178, 260, C.orange);
    text(slide, "Precision = TP / (TP + FP)\n\nRecall = TP / (TP + FN)\n\nF1 = 2PR / (P + R)", 696, 228, 440, 154, 21, C.navy, { lineSpacing: 1.25 });
    text(slide, "The model converts continuous flow into Normal, Warning, and Critical classes using training-data thresholds. This exposes missed warnings, not only average MW error.", 696, 430, 440, 76, 15, C.muted, { lineSpacing: 1.12 });
    text(slide, "Evaluation includes regression metrics, confusion matrices, training curves, ROC/PR curves, feature importance, t-SNE representations, and error examples.", 62, 604, 1156, 26, 17, C.navy, { bold: true });
    note(slide, "Source: results/model_comparison.json, results/confusion_matrix.json, and backend/experiments.py. Explain why accuracy alone is insufficient when Normal cases outnumber Warning and Critical cases.");
  }

  // 12. Model comparison
  {
    const slide = add();
    header(slide, "Model comparison: Fusion GRU leads the research benchmark", "13. Results", slideNo);
    box(slide, 62, 142, 760, 480, C.white, C.line);
    image(slide, path.join(FIG, "model_comparison.png"), 78, 158, 728, 448, "Saved model comparison figure");
    box(slide, 858, 142, 360, 480, C.white, C.line);
    label(slide, "Findings", 884, 170, 160, C.teal);
    text(slide, "Fusion GRU\nRMSE 570.5 MW\nF1 85.6%", 884, 214, 280, 86, 23, C.navy, { bold: true, lineSpacing: 1.15 });
    text(slide, "It improves RMSE over Persistence in the saved research holdout, but the improvement is modest.", 884, 322, 280, 74, 16, C.text, { lineSpacing: 1.15 });
    text(slide, "DCRNN\nRMSE 634.0 MW\nF1 83.8%", 884, 424, 280, 78, 23, C.purple, { bold: true, lineSpacing: 1.15 });
    text(slide, "Graph context did not automatically improve this dataset. That is a result, not a failure of the experiment.", 884, 520, 280, 62, 15, C.muted, { lineSpacing: 1.12 });
    note(slide, "Source: results/figures/model_comparison.png and results/model_comparison.json. The saved comparison includes Persistence, moving average, linear trend, seasonal naive, Fusion GRU, and DCRNN. The chart is embedded directly from the results folder.");
  }

  // 13. Training curves
  {
    const slide = add();
    header(slide, "Training behaviour and overfitting checks", "14. Results", slideNo);
    box(slide, 62, 145, 560, 425, C.white, C.line);
    image(slide, path.join(FIG, "training_curves.png"), 78, 165, 528, 376, "Fusion GRU training curves");
    text(slide, "Fusion GRU", 88, 545, 200, 22, 15, C.teal, { bold: true });
    box(slide, 658, 145, 560, 425, C.white, C.line);
    image(slide, path.join(FIG, "dcrnn_training_curves.png"), 674, 165, 528, 376, "DCRNN training curves");
    text(slide, "DCRNN", 684, 545, 200, 22, 15, C.purple, { bold: true });
    box(slide, 62, 596, 1156, 42, C.tealLight, C.teal);
    text(slide, "Read the gap between training and validation: a growing gap suggests overfitting; both curves flattening at high error suggests underfitting or weak signal.", 88, 607, 1100, 22, 15, C.text, { bold: true });
    note(slide, "Source: results/figures/training_curves.png and results/figures/dcrnn_training_curves.png. These are the saved experiment figures. Do not confuse them with the classical baseline validation curve in data/processed/model_metrics.json.");
  }

  // 14. Confusion + ROC/PR
  {
    const slide = add();
    header(slide, "Classification evidence: confusion matrix and ROC/PR", "15. Results", slideNo);
    label(slide, "Fusion GRU confusion matrix", 62, 144, 300, C.teal);
    const table = slide.tables.add({
      rows: 4,
      columns: 4,
      left: 62,
      top: 184,
      width: 488,
      height: 250,
      values: [
        ["Actual \\ Predicted", "Normal", "Warning", "Critical"],
        ["Normal", "1490", "58", "0"],
        ["Warning", "37", "260", "25"],
        ["Critical", "0", "27", "119"],
      ],
    });
    addTableStyles(table, 4, 4, 1, 16);
    table.getCell(1, 1).fill = C.greenLight;
    table.getCell(2, 2).fill = C.tealLight;
    table.getCell(3, 3).fill = C.orangeLight;
    text(slide, "Rows are actual classes. Columns are predicted classes. Off-diagonal cells expose missed warnings and false alarms.", 62, 465, 488, 58, 15, C.muted, { lineSpacing: 1.12 });
    box(slide, 610, 144, 608, 430, C.white, C.line);
    image(slide, path.join(FIG, "roc_pr_curves.png"), 626, 162, 576, 390, "Fusion GRU ROC and precision-recall curves");
    text(slide, "ROC evaluates separability across thresholds. Precision–Recall is more informative when Critical cases are less frequent.", 62, 595, 1156, 28, 16, C.navy, { bold: true });
    note(slide, "Source: results/fusion_gru_confusion_matrix.json and results/figures/roc_pr_curves.png. The confusion matrix is rebuilt as an editable table from the saved JSON because no confusion-matrix image exists in results/figures.");
  }

  // 15. DCRNN classification
  {
    const slide = add();
    header(slide, "DCRNN classification evidence and interpretation", "16. Results", slideNo);
    box(slide, 62, 145, 710, 430, C.white, C.line);
    image(slide, path.join(FIG, "dcrnn_roc_pr_curves.png"), 78, 165, 678, 390, "DCRNN ROC and precision-recall curves");
    box(slide, 822, 145, 396, 430, C.white, C.line);
    label(slide, "Why the graph model lags", 848, 174, 280, C.purple);
    bulletLines(slide, [
      "Topology is a country graph, not a complete electrical model.",
      "The graph may spread noisy neighbour information.",
      "The dataset has limited verified engineering labels.",
      "DCRNN is slower: 63.6 ms versus Fusion GRU at 34.7 ms.",
      "The result prevents an unsupported claim that graph models always win.",
    ], 848, 218, 320, 15, 52);
    text(slide, "DCRNN still matters because it tests the graph hypothesis under the same lookback, split, scaling, and test horizon.", 62, 604, 1156, 26, 16, C.navy, { bold: true });
    note(slide, "Source: results/figures/dcrnn_roc_pr_curves.png, results/dcrnn_analysis.json, and results/model_comparison.json. The comparison is intentionally honest: DCRNN is implemented and measured, but topology alone does not guarantee improvement.");
  }

  // 16. Feature importance and t-SNE
  {
    const slide = add();
    header(slide, "Feature contribution and learned representations", "17. Explainability", slideNo);
    box(slide, 62, 145, 560, 430, C.white, C.line);
    image(slide, path.join(FIG, "feature_importance.png"), 78, 165, 528, 390, "Saved feature importance figure");
    box(slide, 658, 145, 560, 430, C.white, C.line);
    image(slide, path.join(FIG, "tsne_projection.png"), 674, 165, 528, 390, "Saved t-SNE projection figure");
    box(slide, 62, 596, 1156, 42, C.purpleLight, C.purple);
    text(slide, "Permutation importance asks: how much does validation MAE increase when one feature is shuffled? t-SNE asks: do similar hidden states form visible operating clusters?", 88, 607, 1100, 22, 15, C.text, { bold: true });
    note(slide, "Source: results/figures/feature_importance.png, results/figures/tsne_projection.png, results/feature_importance.json, and results/embedding_projection.json. Explain that feature importance supports model interpretation but does not prove causality.");
  }

  // 17. Error analysis
  {
    const slide = add();
    header(slide, "Error analysis: where predictions fail", "18. Results", slideNo);
    box(slide, 62, 145, 710, 430, C.white, C.line);
    image(slide, path.join(FIG, "error_distribution.png"), 78, 165, 678, 390, "Saved error distribution figure");
    box(slide, 822, 145, 396, 430, C.white, C.line);
    label(slide, "What to inspect", 848, 174, 200, C.orange);
    bulletLines(slide, [
      "Large absolute errors around flow reversals.",
      "Near-zero actual values make MAPE unstable.",
      "Critical cases are harder because they are less frequent.",
      "Timestamp gaps can weaken a local history window.",
      "A low average error can still hide a missed warning.",
    ], 848, 218, 320, 16, 52);
    text(slide, "The saved error-analysis JSON also records representative successes and failures for qualitative review.", 62, 604, 1156, 26, 16, C.navy, { bold: true });
    note(slide, "Source: results/figures/error_distribution.png and results/error_analysis.json. Connect the error distribution to the metric choice: RMSE and F1 are more useful than MAPE alone for signed flows.");
  }

  // 18. Graph intelligence
  {
    const slide = add();
    header(slide, "Graph intelligence: stress propagation and node influence", "19. Graph reasoning", slideNo);
    box(slide, 62, 145, 710, 430, C.white, C.line);
    image(slide, path.join(FIG, "graph_stress_propagation.png"), 78, 165, 678, 390, "Saved graph stress propagation figure");
    box(slide, 822, 145, 396, 430, C.white, C.line);
    image(slide, path.join(FIG, "graph_node_influence.png"), 838, 165, 364, 390, "Saved node influence ranking figure");
    box(slide, 62, 596, 1156, 42, C.tealLight, C.teal);
    text(slide, "Two-step propagation combines local node risk with utilization-weighted neighbouring risk. Influence also includes graph centrality, so a bridge node can matter even before it becomes the most loaded node.", 88, 607, 1100, 22, 15, C.text, { bold: true });
    note(slide, "Source: results/figures/graph_stress_propagation.png and results/figures/graph_node_influence.png. The graph analysis is a transparent screening layer, not an AC power-flow or N-1 security calculation.");
  }

  // 19. Resilience and timeline
  {
    const slide = add();
    header(slide, "Edge resilience and stress over time", "20. Graph reasoning", slideNo);
    box(slide, 62, 145, 560, 430, C.white, C.line);
    image(slide, path.join(FIG, "graph_resilience_ranking.png"), 78, 165, 528, 390, "Saved graph resilience ranking figure");
    box(slide, 658, 145, 560, 430, C.white, C.line);
    image(slide, path.join(FIG, "graph_stress_timeline.png"), 674, 165, 528, 390, "Saved graph stress timeline figure");
    box(slide, 62, 596, 1156, 42, C.orangeLight, C.orange);
    text(slide, "Criticality is more than current loading: it combines dynamic stress, edge betweenness, disconnected pairs after removal, and increased shortest-path length.", 88, 607, 1100, 22, 15, C.text, { bold: true });
    note(slide, "Source: results/figures/graph_resilience_ranking.png and results/figures/graph_stress_timeline.png. Explain that the ranking asks what the topology loses if an edge disappears, while the timeline shows how dynamic stress changes through replay.");
  }

  // 20. Prescriptive routing
  {
    const slide = add();
    header(slide, "Prescriptive routing: how the alternate path is chosen", "21. Scenario simulation", slideNo);
    const steps = [
      ["1", "Choose edge", "Select a stressed interconnector."],
      ["2", "Move MW", "Set a hypothetical reduction, capped at 60%."],
      ["3", "Remove edge", "Search between the same endpoints."],
      ["4", "Check guardrails", "Reject low-headroom or Critical links."],
      ["5", "Score paths", "Penalize distance, utilization, loss, and risk."],
      ["6", "Compare", "Show route, bottleneck, and loss delta."],
    ];
    steps.forEach(([n, title, desc], i) => {
      const x = 62 + (i % 3) * 388;
      const y = 150 + Math.floor(i / 3) * 130;
      box(slide, x, y, 350, 100, C.white, i < 3 ? C.teal : C.orange);
      text(slide, n, x + 18, y + 18, 30, 26, 18, i < 3 ? C.teal : C.orange, { bold: true });
      text(slide, title, x + 64, y + 17, 250, 23, 18, C.navy, { bold: true });
      text(slide, desc, x + 64, y + 48, 260, 36, 14, C.text, { lineSpacing: 1.1 });
    });
    box(slide, 62, 440, 1156, 128, C.navy, C.navy);
    text(slide, "Path cost", 88, 466, 160, 22, 13, "#A9D7DA", { bold: true });
    text(slide, "Costₑ = Lₑ × (1 + 2.2Uₑ + 6Loss%ₑ)", 88, 500, 580, 34, 26, C.white, { bold: true });
    text(slide, "Warning links receive a 1.35× penalty. Critical links receive a 4× penalty during soft scoring. Strict search first requires enough proxy headroom.", 700, 474, 460, 66, 16, "#D8E7EA", { lineSpacing: 1.15 });
    text(slide, "The result is a recommendation-only scenario. It never dispatches generation or switches a real line.", 62, 604, 1156, 26, 16, C.navy, { bold: true });
    note(slide, "Source: backend/routing.py and docs/USER_MANUAL.md. Explain the order: strict feasible path first, best-effort path only if strict search fails, and explicit bottlenecks when the route needs engineering review.");
  }

  // 21. Scenario example and UI integration
  {
    const slide = add();
    header(slide, "Scenario result and system integration", "22. Recommendation", slideNo);
    box(slide, 62, 145, 528, 430, C.white, C.line);
    label(slide, "Example replay scenario", 88, 174, 250, C.orange);
    text(slide, "Selected link: CH–DE\nCurrent flow: 1,414.75 MW\nScenario reduction: 25%\nMoved transfer: 353.69 MW\nCandidate route: CH → AT → DE", 88, 220, 420, 172, 23, C.navy, { bold: true, lineSpacing: 1.28 });
    text(slide, "Status: BEST EFFORT · REVIEW\nBaseline proxy loss: 204.25 MW\nRerouted proxy loss: 241.24 MW\nLoss change: +37.00 MW", 88, 416, 420, 116, 18, C.text, { lineSpacing: 1.35 });
    box(slide, 650, 145, 568, 430, C.white, C.line);
    label(slide, "How the browser receives it", 676, 174, 300, C.teal);
    text(slide, "Python pipeline\n        ↓\nprocessed JSON artifacts\n        ↓\nserver.py REST + SSE\n        ↓\nHTML + CSS + SVG + JavaScript\n        ↓\ntopology + forecast + graph + reroute", 676, 220, 470, 226, 18, C.navy, { lineSpacing: 1.16 });
    text(slide, "The browser surfaces the Fusion GRU research benchmark and labels Persistence as the operational baseline. Normal cyan particles stay muted; the selected reroute appears in purple with moving particles.", 676, 486, 470, 70, 14, C.muted, { lineSpacing: 1.12 });
    text(slide, "A route with higher proxy loss can still be useful for relieving a stressed link, but the UI shows the trade-off instead of hiding it.", 62, 604, 1156, 26, 16, C.navy, { bold: true });
    note(slide, "Source: live /api/route-plan example, backend/server.py, backend/routing.py, frontend/app.js, and frontend/styles.css. Explain that the exact numbers can change with the replay cursor, while the decision procedure remains the same.");
  }

  // 22. Findings and conclusion
  {
    const slide = add();
    header(slide, "Findings, novelty, limitations, and next step", "23. Conclusion", slideNo);
    box(slide, 62, 145, 360, 390, C.tealLight, C.teal);
    label(slide, "What the project proves", 88, 174, 240, C.teal);
    bulletLines(slide, [
      "A messy cross-border dataset can become a canonical graph.",
      "Chronological validation protects the forecast comparison.",
      "A simple baseline remains a useful operational comparator.",
      "Graph reasoning can explain node influence and edge resilience.",
      "Rerouting can be tested with visible guardrails and loss trade-offs.",
    ], 88, 218, 290, 15, 56);
    box(slide, 460, 145, 360, 390, C.purpleLight, C.purple);
    label(slide, "Project novelty", 486, 174, 200, C.purple);
    bulletLines(slide, [
      "One auditable workflow joins predictive and prescriptive analysis.",
      "Data quality, physical assumptions, and graph risk stay visible.",
      "Stress propagation and counterfactual resilience add graph evidence.",
      "The dashboard explains what the model can and cannot claim.",
    ], 486, 218, 290, 15, 62);
    box(slide, 858, 145, 360, 390, C.orangeLight, C.orange);
    label(slide, "What must improve", 884, 174, 200, C.orange);
    bulletLines(slide, [
      "Replace proxy capacity with verified thermal ratings.",
      "Add surveyed line geometry and actual electrical parameters.",
      "Calibrate thresholds using engineering events or quantiles.",
      "Connect the replay API to SCADA, Kafka, or MQTT telemetry.",
      "Validate recommendations with AC power flow and N-1 studies.",
    ], 884, 218, 290, 15, 56);
    box(slide, 62, 580, 1156, 52, C.navy, C.navy);
    text(slide, "Final takeaway: the model produces evidence for human review, not an automatic operating command.", 88, 596, 1100, 24, 16, C.white, { bold: true });
    note(slide, "Closing: return to the original question. The project connects data quality, predictive modelling, graph reasoning, and route simulation in one traceable workflow. The main contribution is the auditable integration and honest handling of missing engineering information.");
  }

  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await writeBlob(path.join(BUILD, "GridPulse_review_montage.webp"), montage);
  for (const [index, slide] of presentation.slides.items.entries()) {
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(BUILD, `slide-${String(index + 1).padStart(2, "0")}.png`), png);
  }
  const candidate = path.join(BUILD, "candidate.pptx");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(candidate);
  console.log(JSON.stringify({ candidate, final: FINAL, slides: presentation.slides.items.length, montage: path.join(BUILD, "GridPulse_review_montage.webp") }, null, 2));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

