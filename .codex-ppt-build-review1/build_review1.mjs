import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:\\Users\\Krishna Karthik\\Desktop\\predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build-review1");
const OUT = path.join(ROOT, ".codex-ppt-output-review1");
const FIG = path.join(ROOT, "results", "figures");
const FINAL = path.join(OUT, "GridPulse_Review_1_Project_Foundation_v2.pptx");
const W = 1280;
const H = 720;
const FONT = "Arial";

const C = {
  paper: "#F7F5EF",
  white: "#FFFFFF",
  navy: "#17324D",
  navy2: "#234A66",
  text: "#263746",
  muted: "#687988",
  line: "#D7E0E5",
  teal: "#168C8C",
  tealLight: "#E2F2EF",
  orange: "#D9782D",
  orangeLight: "#F9E9D9",
  purple: "#6557C9",
  purpleLight: "#ECEAFB",
  green: "#3A8A65",
  greenLight: "#E4F1E9",
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

function label(slide, value, left, top, width, color = C.muted) {
  return text(slide, value.toUpperCase(), left, top, width, 18, 10, color, { bold: true });
}

function header(slide, title, kicker, number) {
  slide.background.fill = C.paper;
  shape(slide, "rect", 0, 0, W, 14, C.navy, "none", 0);
  label(slide, kicker, 62, 34, 520, C.teal);
  text(slide, title, 62, 56, 1090, 48, 31, C.navy, { bold: true, lineSpacing: 1.0 });
  line(slide, 62, 112, 1156, C.line, 1);
  text(slide, "GRIDPULSE  /  PROJECT REVIEW 1", 62, 684, 390, 18, 10, C.muted, { bold: true });
  text(slide, String(number).padStart(2, "0"), 1180, 682, 36, 20, 11, C.navy, { bold: true, alignment: "right" });
}

function note(slide, value) {
  slide.speakerNotes.text = value;
  slide.speakerNotes.setVisible(true);
}

function metric(slide, value, caption, left, top, width, accent = C.teal) {
  box(slide, left, top, width, 96, C.white, C.line);
  shape(slide, "rect", left, top, 6, 96, accent, "none", 0);
  text(slide, value, left + 20, top + 14, width - 28, 34, 26, C.navy, { bold: true });
  text(slide, caption, left + 20, top + 56, width - 28, 28, 12, C.muted);
}

function addTableStyles(table, rows, cols, headerRows = 1, fontSize = 14) {
  table.borders.assign({ style: "solid", fill: C.line, width: 1 });
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = table.getCell(r, c);
      cell.text.style = {
        fontSize,
        color: r < headerRows ? C.white : C.text,
        fontFamily: FONT,
        bold: r < headerRows,
      };
      cell.fill = r < headerRows ? C.navy : (r % 2 === 0 ? C.white : C.greyLight);
    }
  }
}

function numberedRow(slide, number, title, detail, left, top, width, accent) {
  text(slide, number, left, top + 1, 30, 22, 13, accent, { bold: true });
  text(slide, title, left + 42, top, 220, 24, 18, C.navy, { bold: true });
  text(slide, detail, left + 42, top + 29, width - 42, 38, 14, C.text, { lineSpacing: 1.1 });
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
    shape(slide, "rect", 0, 0, 430, H, C.navy, "none", 0);
    shape(slide, "rect", 430, 0, 8, H, C.orange, "none", 0);
    label(slide, "Predictive analytics course project", 62, 64, 320, "#B8D6DB");
    text(slide, "GridPulse", 62, 142, 340, 58, 44, C.white, { bold: true });
    text(slide, "Graph-based predictive and prescriptive analytics for cross-border power grid flows", 62, 222, 315, 128, 24, C.white, { lineSpacing: 1.12 });
    text(slide, "Project Review 1\nProblem, data, methodology, and system design", 62, 408, 320, 70, 17, "#D8E7EA", { lineSpacing: 1.2 });
    text(slide, "Project Review 1", 510, 104, 520, 38, 28, C.navy, { bold: true });
    line(slide, 510, 162, 650, C.teal, 3);
    label(slide, "Project team", 510, 204, 160, C.teal);
    text(slide, "Prakki Krishna Karthik  |  23BCE1294\nVasudev  |  23BCE1496\nShubham Bhuyan  |  23BCE1809", 510, 236, 460, 108, 19, C.text, { lineSpacing: 1.28 });
    label(slide, "Course and faculty", 510, 386, 220, C.teal);
    text(slide, "Predictive Analytics\nFaculty: Pattabiraman V", 510, 418, 460, 58, 18, C.text, { lineSpacing: 1.25 });
    box(slide, 510, 540, 620, 72, C.white, C.line);
    text(slide, "Review 1 establishes the problem, data contract, model plan, and implementation boundary.", 536, 559, 565, 32, 16, C.navy, { bold: true });
    text(slide, "01", 1160, 650, 48, 24, 12, C.navy, { bold: true, alignment: "right" });
    note(slide, "Opening: introduce the project as a predictive analytics course project. Review 1 covers the foundation. The later reviews will cover trained-model evidence and prescriptive graph decisions.");
  }

  // 2. Problem and scope
  {
    const slide = add();
    header(slide, "Problem definition and project scope", "1. Project context", slideNo);
    text(slide, "Electricity does not move through one isolated line. A change at one country can change neighbouring flows and the alternatives available during stress.", 62, 142, 900, 60, 21, C.navy, { bold: true, lineSpacing: 1.12 });
    box(slide, 62, 240, 520, 278, C.white, C.teal);
    label(slide, "Predictive question", 88, 268, 220, C.teal);
    text(slide, "What is likely to happen in the next hour?", 88, 306, 430, 54, 25, C.navy, { bold: true });
    text(slide, "Estimate next-hour country net flow from recent history, demand signals, shared network context, and graph centrality.", 88, 384, 430, 78, 17, C.text, { lineSpacing: 1.18 });
    box(slide, 620, 240, 598, 278, C.white, C.orange);
    label(slide, "Prescriptive question", 646, 268, 250, C.orange);
    text(slide, "What action can we test when a link is stressed?", 646, 306, 500, 54, 25, C.navy, { bold: true });
    text(slide, "Reduce a selected transfer in a scenario, search alternate paths, check headroom and proxy loss, and present the trade-off for human review.", 646, 384, 500, 78, 17, C.text, { lineSpacing: 1.18 });
    text(slide, "The project scope ends at explainable decision support. It does not control a real transmission grid.", 62, 574, 1156, 28, 17, C.navy, { bold: true });
    note(slide, "Make the predictive and prescriptive distinction clear. The forecast estimates a future value. The routing module tests a hypothetical intervention and reports consequences. The dashboard recommends; an operator would still need verified engineering constraints.");
  }

  // 3. Review structure and gap
  {
    const slide = add();
    header(slide, "Why this project needs both time series and graph analysis", "2. Motivation", slideNo);
    text(slide, "A single model family does not answer every question in the project. The design combines complementary views of the same network.", 62, 142, 900, 42, 20, C.navy, { bold: true });
    const table = slide.tables.add({
      rows: 5,
      columns: 3,
      left: 62,
      top: 222,
      width: 1156,
      height: 250,
      values: [
        ["Approach", "What it captures", "Why this project adds another layer"],
        ["Classical time-series baseline", "Recent history and seasonality", "Useful comparator, but it does not see neighbouring nodes or alternate paths."],
        ["Fusion GRU", "Recent local and global signals", "Learns nonlinear temporal patterns while keeping the input features inspectable."],
        ["DCRNN", "Temporal behaviour plus graph diffusion", "Tests whether neighbouring countries improve the forecast through learned spatial propagation."],
        ["Rule-based routing screen", "Feasible alternate-path scenarios", "Explains the action and trade-off, but it does not replace power-flow certification."],
      ],
    });
    addTableStyles(table, 5, 3, 1, 14);
    text(slide, "Project contribution", 62, 516, 190, 22, 15, C.teal, { bold: true });
    text(slide, "One traceable workflow connects data quality, forecasting, graph stress reasoning, and scenario recommendations. Each layer exposes its inputs and limitations.", 248, 514, 970, 42, 17, C.text, { lineSpacing: 1.1 });
    note(slide, "This slide explains the project gap in original wording. The point is not to claim that one method is universally best. The project tests temporal and graph-aware models under the same chronological evaluation and then uses a separate transparent scenario layer for routing.");
  }

  // 4. Dataset
  {
    const slide = add();
    header(slide, "Dataset profile and graph ingredients", "3. Data", slideNo);
    metric(slide, "315,598", "country-hour records", 62, 142, 215, C.teal);
    metric(slide, "1,262,592", "directional flow records", 295, 142, 215, C.orange);
    metric(slide, "12", "country nodes", 528, 142, 180, C.purple);
    metric(slide, "24", "canonical links", 726, 142, 210, C.navy2);
    metric(slide, "960", "recent hourly points retained", 954, 142, 264, C.green);
    const table = slide.tables.add({
      rows: 5,
      columns: 4,
      left: 62,
      top: 280,
      width: 1156,
      height: 248,
      values: [
        ["Source", "One row represents", "Main fields", "System role"],
        ["dynamic_with_flows.csv", "One country at one hour", "Load, net flow, imbalance, residual, weather, renewables, coordinates, centrality", "Node signals and forecast features"],
        ["power_flow.csv", "One directional interconnector record", "Timestamp, source, target, power flow in MW", "Edge history and routing context"],
        ["Processed graph manifest", "One canonical graph definition", "Nodes, edges, aliases, quality flags, assumptions", "Data contract used by the API"],
        ["Research result files", "One evaluation artifact", "Metrics, curves, confusion matrices, graph plots", "Evidence for later reviews"],
      ],
    });
    addTableStyles(table, 5, 4, 1, 13);
    text(slide, "Coverage: hourly records from 1 January 2022 to 31 December 2024. The current replay keeps the latest 960 hours for a compact, reproducible dashboard view.", 62, 572, 1120, 34, 16, C.muted, { italic: true });
    note(slide, "Source: results/dataset_profile.json. The dynamic source contains 37 columns and the power-flow source contains 5 columns. Review 1 introduces the raw data contract; model results are intentionally reserved for Review 2.");
  }

  // 5. Preprocessing
  {
    const slide = add();
    header(slide, "Preprocessing turns raw files into a safe experiment", "4. Data preparation", slideNo);
    const items = [
      ["01", "Parse", "Read both CSV files and convert timestamps to UTC."],
      ["02", "Validate", "Check missing cells, duplicate keys, country codes, and hourly gaps."],
      ["03", "Canonicalize", "Map aliases to a stable endpoint pair such as CH-DE."],
      ["04", "Align", "Join node signals and edge history on the common hourly timeline."],
      ["05", "Scale", "Fit means and standard deviations only on the training window."],
      ["06", "Split", "Keep validation and test periods later in time. Do not shuffle across the boundary."],
    ];
    items.forEach(([n, title, detail], i) => {
      const x = i < 3 ? 62 : 650;
      const y = 154 + (i % 3) * 112;
      numberedRow(slide, n, title, detail, x, y, 520, i < 3 ? C.teal : C.orange);
      if (i < 5) line(slide, x + 42, y + 83, 490, C.line, 1);
    });
    box(slide, 62, 522, 1156, 82, C.navy, C.navy);
    text(slide, "Training-only scaling", 88, 544, 220, 22, 14, "#A9D7DA", { bold: true });
    text(slide, "x_scaled = (x − μ_train) / σ_train", 330, 537, 380, 34, 24, C.white, { bold: true });
    text(slide, "The same training statistics are applied to validation, test, and live replay inputs.", 746, 539, 430, 28, 15, "#D8E7EA", { lineSpacing: 1.08 });
    note(slide, "Source: results/preprocessing_summary.json. Explain why the chronological split matters: using future values while scaling or randomly shuffling would make the evaluation look better than the real forecasting situation.");
  }

  // 6. Features
  {
    const slide = add();
    header(slide, "Feature extraction keeps the forecast explainable", "5. Feature design", slideNo);
    text(slide, "The experiment uses 11 features per country and hour. They fall into three groups so the model has local evidence, system context, and graph structure.", 62, 142, 950, 44, 20, C.navy, { bold: true });
    box(slide, 62, 226, 350, 300, C.tealLight, C.teal);
    label(slide, "Local time series", 88, 254, 240, C.teal);
    text(slide, "Net flow\nActual load\nFlow imbalance\nLoad residual", 88, 298, 260, 132, 21, C.navy, { bold: true, lineSpacing: 1.25 });
    text(slide, "What is happening at the country now?", 88, 466, 260, 34, 15, C.text);
    box(slide, 465, 226, 350, 300, C.purpleLight, C.purple);
    label(slide, "Network context", 491, 254, 240, C.purple);
    text(slide, "Mean net flow across countries\nMean load\nMean imbalance\nMean load residual", 491, 298, 280, 132, 19, C.navy, { bold: true, lineSpacing: 1.25 });
    text(slide, "What pressure is shared across the system?", 491, 466, 280, 34, 15, C.text);
    box(slide, 868, 226, 350, 300, C.orangeLight, C.orange);
    label(slide, "Static graph", 894, 254, 240, C.orange);
    text(slide, "Degree centrality\nCloseness centrality\nBetweenness centrality", 894, 298, 280, 98, 21, C.navy, { bold: true, lineSpacing: 1.25 });
    text(slide, "Where does this country sit in the network?", 894, 466, 280, 34, 15, C.text);
    text(slide, "The tensor shape is 12 countries × 960 hours × 11 features. The target is next-hour net flow.", 62, 576, 1156, 28, 17, C.navy, { bold: true });
    note(slide, "Source: results/feature_catalog.json. Give one simple example: if German load rises while nearby countries also show pressure, the model sees both the local signal and the network context. Centrality does not prove physical causation; it gives the model a stable connectivity descriptor.");
  }

  // 7. Graph and loss proxy
  {
    const slide = add();
    header(slide, "Graph construction and distance-based loss proxy", "6. Graph representation", slideNo);
    box(slide, 62, 150, 560, 420, C.white, C.line);
    label(slide, "Graph definition", 88, 178, 220, C.teal);
    text(slide, "Nodes represent countries.\nEdges represent canonical cross-border interconnectors.\nCoordinates support distance and centrality features.\nDirectional flow history keeps source and target visible.", 88, 224, 440, 156, 21, C.navy, { bold: true, lineSpacing: 1.27 });
    text(slide, "The graph has 12 nodes and 24 canonical links. The same graph supports forecasting features, stress propagation, resilience ranking, and route search.", 88, 430, 440, 70, 17, C.text, { lineSpacing: 1.15 });
    box(slide, 676, 150, 542, 420, C.white, C.line);
    label(slide, "Loss estimate used in scenarios", 702, 178, 300, C.orange);
    text(slide, "R = ρL / A\n\nS = |P| / pf\n\nI = S / (√3 V)\n\nP_loss = 3I²R", 702, 224, 440, 226, 24, C.navy, { bold: true, lineSpacing: 1.18 });
    text(slide, "L comes from the Haversine distance between country-centroid coordinates. The project uses fixed assumptions for voltage, power factor, resistivity, and conductor area.", 702, 474, 440, 58, 15, C.text, { lineSpacing: 1.12 });
    text(slide, "This is a screening proxy, not an engineering-grade thermal or AC power-flow calculation.", 62, 604, 1156, 26, 16, C.navy, { bold: true });
    note(slide, "Source: results/dataset_profile.json and the engineering limitations recorded by the pipeline. Explain the purpose of the proxy: compare candidate scenarios consistently. Do not present it as a certified line-loss calculation because actual conductor, route, voltage, and thermal data are missing.");
  }

  // 8. Models and split
  {
    const slide = add();
    header(slide, "Model plan and chronological experiment design", "7. Forecasting setup", slideNo);
    box(slide, 62, 150, 350, 360, C.white, C.teal);
    label(slide, "Baselines", 88, 178, 180, C.teal);
    text(slide, "Persistence\n24-hour moving average\nLinear trend\nSeasonal naive", 88, 226, 250, 126, 23, C.navy, { bold: true, lineSpacing: 1.25 });
    text(slide, "These provide reference points before judging the learned models.", 88, 412, 260, 52, 15, C.text, { lineSpacing: 1.12 });
    box(slide, 465, 150, 350, 360, C.white, C.purple);
    label(slide, "Fusion GRU", 491, 178, 180, C.purple);
    text(slide, "A recurrent model reads the last 24 hourly steps. It fuses local and global features, then estimates the next-hour net flow.", 491, 226, 270, 126, 21, C.navy, { bold: true, lineSpacing: 1.2 });
    text(slide, "The checkpoint is trained in PyTorch and loaded by the live API.", 491, 412, 270, 52, 15, C.text, { lineSpacing: 1.12 });
    box(slide, 868, 150, 350, 360, C.white, C.orange);
    label(slide, "DCRNN", 894, 178, 180, C.orange);
    text(slide, "A graph recurrent model diffuses information through forward and reverse graph transitions while it processes time.", 894, 226, 270, 126, 21, C.navy, { bold: true, lineSpacing: 1.2 });
    text(slide, "It tests whether neighbouring countries improve the next-hour forecast.", 894, 412, 270, 52, 15, C.text, { lineSpacing: 1.12 });
    box(slide, 62, 552, 1156, 64, C.navy, C.navy);
    text(slide, "24-hour lookback   |   600 train hours   |   168 validation hours   |   168 test hours   |   chronological order", 88, 574, 1090, 24, 16, C.white, { bold: true, alignment: "center" });
    note(slide, "Source: results/preprocessing_summary.json and results/run_metadata.json. The current split is 600:168:168 hours, or 25:7:7 in time duration. The models use a 24-hour input window. Review 2 will present loss curves and model metrics.");
  }

  // 9. Architecture
  {
    const slide = add();
    header(slide, "System architecture from CSV files to browser decisions", "8. Implementation design", slideNo);
    text(slide, "The implementation keeps data preparation, model inference, graph reasoning, and presentation separate so each result can be inspected.", 62, 142, 950, 42, 20, C.navy, { bold: true });
    const workflowPath = path.join(FIG, "end_to_end_workflow_architecture.png");
    image(slide, workflowPath, 62, 214, 760, 382, "End-to-end project workflow architecture");
    box(slide, 868, 214, 350, 382, C.white, C.line);
    label(slide, "Implemented components", 894, 242, 270, C.teal);
    numberedRow(slide, "01", "Pipeline", "Parses, validates, aligns, and writes processed JSON artifacts.", 894, 286, 290, C.teal);
    numberedRow(slide, "02", "Experiments", "Trains Fusion GRU and DCRNN checkpoints and saves evaluation files.", 894, 378, 290, C.purple);
    numberedRow(slide, "03", "API", "Serves metrics, forecasts, graph status, and route-plan scenarios.", 894, 470, 290, C.orange);
    text(slide, "The browser displays evidence from the API. It does not retrain models in the interface.", 62, 626, 1156, 24, 16, C.navy, { bold: true });
    note(slide, "Source: results/figures/end_to_end_workflow_architecture.png and the current backend/frontend implementation. Explain this as the system design, not just a slide diagram: the model artifacts are trained offline, the API loads them for inference, and the browser visualizes the returned values.");
  }

  // 10. Review 1 outcome and review distribution
  {
    const slide = add();
    header(slide, "Review 1 outcome and the remaining project reviews", "9. Review plan", slideNo);
    box(slide, 62, 150, 350, 386, C.tealLight, C.teal);
    label(slide, "Review 1 foundation", 88, 178, 230, C.teal);
    text(slide, "Problem and scope\nDataset contract\nQuality checks\nFeature tensor\nGraph and loss assumptions\nModel plan\nSystem architecture", 88, 226, 270, 218, 21, C.navy, { bold: true, lineSpacing: 1.25 });
    box(slide, 465, 150, 350, 386, C.purpleLight, C.purple);
    label(slide, "Review 2 model evidence", 491, 178, 250, C.purple);
    text(slide, "Training curves\nValidation strategy\nConfusion matrix\nROC and precision-recall\nModel comparison\nDCRNN analysis\nError analysis", 491, 226, 270, 218, 21, C.navy, { bold: true, lineSpacing: 1.25 });
    box(slide, 868, 150, 350, 386, C.orangeLight, C.orange);
    label(slide, "Review 3 decision layer", 894, 178, 240, C.orange);
    text(slide, "Stress propagation\nEdge resilience\nLoss comparison\nAlternate-path search\nDashboard integration\nLimitations\nFinal conclusions", 894, 226, 270, 218, 21, C.navy, { bold: true, lineSpacing: 1.25 });
    box(slide, 62, 574, 1156, 70, C.navy, C.navy);
    text(slide, "Review 1 takeaway: the project has a defined data contract, a reproducible forecasting setup, and a clear boundary between learned prediction and explainable scenario analysis.", 88, 590, 1100, 42, 15, C.white, { bold: true, lineSpacing: 1.0 });
    note(slide, "Close by showing that Review 1 has a concrete outcome. The project is not only an interface idea; it now has a defined dataset, preprocessing contract, feature tensor, graph representation, model plan, and end-to-end architecture. Reviews 2 and 3 will add empirical evidence and decisions.");
  }

  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await writeBlob(path.join(BUILD, "GridPulse_Review_1_montage.webp"), montage);
  for (const [index, slide] of presentation.slides.items.entries()) {
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(BUILD, `slide-${String(index + 1).padStart(2, "0")}.png`), png);
  }
  const candidate = path.join(BUILD, "candidate.pptx");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(candidate);
  console.log(JSON.stringify({ candidate, final: FINAL, slides: presentation.slides.items.length, montage: path.join(BUILD, "GridPulse_Review_1_montage.webp") }, null, 2));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
