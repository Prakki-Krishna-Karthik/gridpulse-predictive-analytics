import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:\\Users\\Krishna Karthik\\Desktop\\predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build-review2");
const OUT = path.join(ROOT, ".codex-ppt-output-review2");
const FIG = path.join(ROOT, "results", "figures");
const FINAL = path.join(OUT, "GridPulse_Review_2_Model_Evaluation_v3.pptx");
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
  red: "#C6544A",
  redLight: "#F7E1DF",
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
  text(slide, "GRIDPULSE  /  PROJECT REVIEW 2", 62, 684, 390, 18, 10, C.muted, { bold: true });
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

function numberRow(slide, number, title, detail, left, top, width, accent) {
  text(slide, number, left, top + 1, 28, 22, 13, accent, { bold: true });
  text(slide, title, left + 40, top, 210, 24, 18, C.navy, { bold: true });
  text(slide, detail, left + 40, top + 28, width - 40, 38, 14, C.text, { lineSpacing: 1.1 });
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
    shape(slide, "rect", 430, 0, 8, H, C.purple, "none", 0);
    label(slide, "Predictive analytics course project", 62, 64, 320, "#B8D6DB");
    text(slide, "GridPulse", 62, 142, 340, 58, 44, C.white, { bold: true });
    text(slide, "Graph-based predictive and prescriptive analytics for cross-border power grid flows", 62, 222, 315, 128, 24, C.white, { lineSpacing: 1.12 });
    text(slide, "Project Review 2\nModel implementation and evaluation", 62, 408, 320, 70, 17, "#D8E7EA", { lineSpacing: 1.2 });
    text(slide, "Project Review 2", 510, 104, 520, 38, 28, C.navy, { bold: true });
    line(slide, 510, 162, 650, C.purple, 3);
    label(slide, "Project team", 510, 204, 160, C.purple);
    text(slide, "Prakki Krishna Karthik  |  23BCE1294\nVasudev  |  23BCE1496\nShubham Bhuyan  |  23BCE1809", 510, 236, 460, 108, 19, C.text, { lineSpacing: 1.28 });
    label(slide, "Course and faculty", 510, 386, 220, C.purple);
    text(slide, "Predictive Analytics\nFaculty: Pattabiraman V", 510, 418, 460, 58, 18, C.text, { lineSpacing: 1.25 });
    box(slide, 510, 540, 620, 72, C.white, C.line);
    text(slide, "Review 2 presents the trained-model evidence behind the dashboard forecast.", 536, 559, 565, 32, 16, C.navy, { bold: true });
    text(slide, "01", 1160, 650, 48, 24, 12, C.navy, { bold: true, alignment: "right" });
    note(slide, "Opening: Review 1 defined the problem and data foundation. This review shows how the learned models were trained, measured, compared, and connected to the forecast output.");
  }

  // 2. Experiment design
  {
    const slide = add();
    header(slide, "Forecasting experiment design", "1. Experimental setup", slideNo);
    metric(slide, "24 h", "input lookback", 62, 142, 180, C.teal);
    metric(slide, "1 h", "forecast horizon", 262, 142, 180, C.orange);
    metric(slide, "40", "training epochs", 462, 142, 180, C.purple);
    metric(slide, "4 h", "window stride", 662, 142, 180, C.navy2);
    metric(slide, "42", "random seed", 862, 142, 180, C.green);
    metric(slide, "11", "features per node", 1062, 142, 156, C.red);
    box(slide, 62, 282, 520, 268, C.white, C.line);
    label(slide, "What the models receive", 88, 310, 280, C.teal);
    text(slide, "A 24-hour window for each country\n12 countries processed together\n11 features at every hour\nTarget: next-hour net flow in MW", 88, 356, 420, 132, 21, C.navy, { bold: true, lineSpacing: 1.3 });
    box(slide, 620, 282, 598, 268, C.white, C.line);
    label(slide, "Chronological split", 646, 310, 240, C.purple);
    const table = slide.tables.add({
      rows: 4,
      columns: 3,
      left: 646,
      top: 352,
      width: 520,
      height: 148,
      values: [
        ["Window", "Hours", "Fusion GRU samples"],
        ["Train", "600", "1,800"],
        ["Validation", "168", "504"],
        ["Test", "168", "2,016"],
      ],
    });
    addTableStyles(table, 4, 3, 1, 14);
    text(slide, "The split follows time order. Later observations never enter model fitting or scaling before the test is evaluated.", 62, 590, 1156, 26, 16, C.navy, { bold: true });
    note(slide, "Source: results/preprocessing_summary.json and results/run_metadata.json. Explain that the 2,016 Fusion GRU test samples come from the 168-hour test period across countries and rolling windows. DCRNN uses a smaller set because its graph-wide experiment uses a different stride and sample construction.");
  }

  // 3. Model implementation
  {
    const slide = add();
    header(slide, "Model implementation: two different ways to read the same grid", "2. Learned models", slideNo);
    const table = slide.tables.add({
      rows: 4,
      columns: 4,
      left: 62,
      top: 170,
      width: 1156,
      height: 250,
      values: [
        ["Model", "Input handling", "Main mechanism", "Output"],
        ["Persistence", "Latest observed flow", "Copies the last value", "Baseline next-hour flow"],
        ["Fusion GRU", "Local and global 24-hour features", "Gated recurrent updates", "Next-hour node flow"],
        ["DCRNN", "12-node graph sequence", "Forward and reverse diffusion with recurrence", "Next-hour flow for all nodes"],
      ],
    });
    addTableStyles(table, 4, 4, 1, 14);
    box(slide, 62, 468, 560, 132, C.tealLight, C.teal);
    label(slide, "Fusion GRU in plain language", 88, 494, 280, C.teal);
    text(slide, "The GRU keeps a memory of recent hours. Its gates decide which parts of the past and current feature set should influence the next prediction.", 88, 532, 480, 48, 17, C.navy, { bold: true, lineSpacing: 1.12 });
    box(slide, 676, 468, 542, 132, C.purpleLight, C.purple);
    label(slide, "DCRNN in plain language", 702, 494, 280, C.purple);
    text(slide, "The DCRNN passes information through neighbouring nodes before its recurrent update. It tests whether graph diffusion improves the next-hour estimate.", 702, 532, 466, 48, 17, C.navy, { bold: true, lineSpacing: 1.12 });
    text(slide, "Both trained checkpoints are saved under results/models and loaded by the live API for forecast requests.", 62, 632, 1156, 26, 16, C.navy, { bold: true });
    note(slide, "Source: backend/experiments.py, results/run_metadata.json, and results/models. Explain the difference without overclaiming: Fusion GRU uses the engineered feature tensor, while DCRNN explicitly propagates information across the canonical graph.");
  }

  // 4. Metrics and threshold equations
  {
    const slide = add();
    header(slide, "How the model scores are calculated", "3. Evaluation rules", slideNo);
    box(slide, 62, 150, 548, 410, C.white, C.line);
    label(slide, "Regression metrics", 88, 178, 260, C.teal);
    text(slide, "MAE = (1/n) Σ |y − ŷ|\n\nRMSE = √[(1/n) Σ (y − ŷ)²]\n\nMAPE = (100/n) Σ |(y − ŷ) / y|", 88, 226, 440, 202, 21, C.navy, { lineSpacing: 1.22 });
    text(slide, "MAE gives the average absolute error in MW. RMSE gives extra weight to large misses. MAPE is reported carefully because net flow can be near zero or change sign.", 88, 470, 440, 62, 15, C.text, { lineSpacing: 1.12 });
    box(slide, 670, 150, 548, 410, C.white, C.line);
    label(slide, "Stress classes", 696, 178, 240, C.orange);
    text(slide, "Precision = TP / (TP + FP)\nRecall = TP / (TP + FN)\nF1 = 2 × Precision × Recall / (Precision + Recall)", 696, 226, 450, 132, 20, C.navy, { lineSpacing: 1.25 });
    text(slide, "Warning threshold = 3,550.44 MW\nCritical threshold = 5,941.40 MW", 696, 394, 450, 60, 18, C.orange, { bold: true, lineSpacing: 1.2 });
    text(slide, "The thresholds come from the 75th and 90th percentiles of absolute net flow in the training window. This prevents the test period from defining its own labels.", 696, 478, 450, 56, 15, C.text, { lineSpacing: 1.12 });
    note(slide, "Source: results/preprocessing_summary.json, results/confusion_matrix.json, and results/model_comparison.json. Explain why the threshold rule is data-based rather than chosen randomly: the training distribution defines the two stress cut points, then the same values label validation and test predictions.");
  }

  // 5. Training curves
  {
    const slide = add();
    header(slide, "Training curves show how both models learned", "4. Training evidence", slideNo);
    box(slide, 62, 148, 556, 390, C.white, C.line);
    image(slide, path.join(FIG, "training_curves.png"), 78, 166, 524, 350, "Fusion GRU training loss and macro-F1 curves");
    label(slide, "Fusion GRU", 62, 558, 170, C.purple);
    text(slide, "Loss drops quickly and then stabilises. Validation F1 follows training F1 without a sustained collapse.", 182, 556, 420, 32, 15, C.text, { lineSpacing: 1.08 });
    box(slide, 662, 148, 556, 390, C.white, C.line);
    image(slide, path.join(FIG, "dcrnn_training_curves.png"), 678, 166, 524, 350, "DCRNN training loss and macro-F1 curves");
    label(slide, "DCRNN", 662, 558, 170, C.teal);
    text(slide, "DCRNN also converges, but its validation F1 remains below its training curve more often.", 782, 556, 420, 32, 15, C.text, { lineSpacing: 1.08 });
    text(slide, "Training curves are evidence of learning behaviour. Final model selection still uses the common chronological test comparison.", 62, 626, 1156, 24, 16, C.navy, { bold: true });
    note(slide, "Source: results/figures/training_curves.png and results/figures/dcrnn_training_curves.png. Point out the two panels in each image: normalized target loss on the left and macro-F1 on the right. Avoid saying the curves prove production readiness; they only show the training process and validation behaviour.");
  }

  // 6. Comparative performance
  {
    const slide = add();
    header(slide, "Comparative performance on the common holdout", "5. Model comparison", slideNo);
    box(slide, 62, 146, 730, 438, C.white, C.line);
    image(slide, path.join(FIG, "model_comparison.png"), 78, 164, 698, 402, "Saved model comparison figure");
    box(slide, 836, 146, 382, 438, C.white, C.line);
    label(slide, "Saved test results", 862, 174, 220, C.purple);
    const table = slide.tables.add({
      rows: 4,
      columns: 5,
      left: 862,
      top: 218,
      width: 330,
      height: 168,
      values: [
        ["Model", "RMSE", "MAE", "F1", "Time"],
        ["Persistence", "580.3", "375.8", "81.2%", "0.4 ms"],
        ["Fusion GRU", "570.5", "400.3", "85.6%", "34.7 ms"],
        ["DCRNN", "634.0", "436.2", "83.8%", "63.6 ms"],
      ],
    });
    addTableStyles(table, 4, 5, 1, 11);
    table.getCell(2, 0).fill = C.purpleLight;
    table.getCell(2, 1).fill = C.purpleLight;
    table.getCell(2, 2).fill = C.purpleLight;
    table.getCell(2, 3).fill = C.purpleLight;
    table.getCell(2, 4).fill = C.purpleLight;
    text(slide, "Fusion GRU has the lowest RMSE among the learned models and the highest F1 in this experiment. Persistence remains a strong low-cost comparator.", 862, 418, 320, 94, 16, C.text, { lineSpacing: 1.16 });
    text(slide, "The graph-aware DCRNN does not win on this dataset. That result is reported rather than hidden.", 862, 528, 320, 40, 15, C.orange, { bold: true, lineSpacing: 1.12 });
    note(slide, "Source: results/figures/model_comparison.png and results/model_comparison.json. Explain the trade-off: Fusion GRU improves RMSE over Persistence by a modest amount and improves F1 more clearly. DCRNN has a longer inference time and higher error in this benchmark.");
  }

  // 7. Confusion matrices
  {
    const slide = add();
    header(slide, "Confusion matrices show which stress classes are missed", "6. Classification detail", slideNo);
    text(slide, "Rows show the actual class. Columns show the predicted class. Diagonal cells are correct classifications.", 62, 142, 900, 32, 19, C.navy, { bold: true });
    label(slide, "Fusion GRU", 96, 204, 220, C.purple);
    const fusion = slide.tables.add({
      rows: 4,
      columns: 4,
      left: 62,
      top: 236,
      width: 530,
      height: 220,
      values: [
        ["Actual \\ Pred.", "Normal", "Warning", "Critical"],
        ["Normal", "1490", "58", "0"],
        ["Warning", "37", "260", "25"],
        ["Critical", "0", "27", "119"],
      ],
    });
    addTableStyles(fusion, 4, 4, 1, 16);
    fusion.getCell(1, 1).fill = C.greenLight;
    fusion.getCell(2, 2).fill = C.greenLight;
    fusion.getCell(3, 3).fill = C.greenLight;
    fusion.getCell(2, 1).fill = C.orangeLight;
    fusion.getCell(2, 3).fill = C.orangeLight;
    fusion.getCell(3, 2).fill = C.orangeLight;
    label(slide, "DCRNN", 686, 204, 220, C.teal);
    const dcrnn = slide.tables.add({
      rows: 4,
      columns: 4,
      left: 652,
      top: 236,
      width: 530,
      height: 220,
      values: [
        ["Actual \\ Pred.", "Normal", "Warning", "Critical"],
        ["Normal", "1504", "44", "0"],
        ["Warning", "45", "257", "20"],
        ["Critical", "1", "41", "104"],
      ],
    });
    addTableStyles(dcrnn, 4, 4, 1, 16);
    dcrnn.getCell(1, 1).fill = C.greenLight;
    dcrnn.getCell(2, 2).fill = C.greenLight;
    dcrnn.getCell(3, 3).fill = C.greenLight;
    dcrnn.getCell(2, 1).fill = C.orangeLight;
    dcrnn.getCell(2, 3).fill = C.orangeLight;
    dcrnn.getCell(3, 2).fill = C.orangeLight;
    box(slide, 62, 504, 1156, 104, C.white, C.line);
    label(slide, "Interpretation", 88, 530, 160, C.orange);
    text(slide, "Both models identify Normal cases well. The difficult boundary is Warning versus Critical. Fusion GRU catches 119 Critical cases and DCRNN catches 104, which helps explain the difference in macro-F1.", 248, 528, 930, 46, 17, C.text, { lineSpacing: 1.1 });
    text(slide, "Thresholds: Warning starts at 3,550.44 MW and Critical starts at 5,941.40 MW.", 62, 632, 1156, 24, 15, C.muted, { italic: true });
    note(slide, "Source: results/fusion_gru_confusion_matrix.json and results/confusion_matrix.json. This is a native editable table because the project does not contain a saved confusion-matrix image. Emphasize that a high overall accuracy can still hide missed Critical cases, which is why precision, recall, and F1 are included.");
  }

  // 8. ROC and PR
  {
    const slide = add();
    header(slide, "ROC and precision-recall curves", "7. Threshold behaviour", slideNo);
    box(slide, 62, 148, 760, 430, C.white, C.line);
    image(slide, path.join(FIG, "roc_pr_curves.png"), 78, 166, 728, 394, "Fusion GRU one-vs-rest ROC and precision-recall curves");
    box(slide, 858, 148, 360, 430, C.white, C.line);
    label(slide, "Fusion GRU curve summary", 884, 176, 260, C.purple);
    const table = slide.tables.add({
      rows: 4,
      columns: 3,
      left: 884,
      top: 222,
      width: 300,
      height: 148,
      values: [
        ["Class", "ROC-AUC", "PR-AUC"],
        ["Normal", "0.92", "0.04"],
        ["Warning", "0.89", "0.81"],
        ["Critical", "0.98", "0.13"],
      ],
    });
    addTableStyles(table, 4, 3, 1, 13);
    text(slide, "ROC-AUC shows ranking quality across thresholds. Precision-recall is more informative when a class is less common.", 884, 402, 300, 72, 16, C.text, { lineSpacing: 1.14 });
    text(slide, "High ROC-AUC does not guarantee high precision for rare classes. A more permissive threshold creates more false positives.", 884, 494, 300, 62, 15, C.orange, { bold: true, lineSpacing: 1.1 });
    note(slide, "Source: results/figures/roc_pr_curves.png and results/fusion_gru_roc_pr_curves.json. The image is the saved Fusion GRU curve artifact. Values are rounded from the JSON. The Normal PR-AUC is low because Normal is the majority class in this one-vs-rest setup.");
  }

  // 9. Feature interpretation and t-SNE
  {
    const slide = add();
    header(slide, "Feature interpretation and learned representation", "8. Explainability", slideNo);
    box(slide, 62, 148, 560, 390, C.white, C.line);
    image(slide, path.join(FIG, "feature_importance.png"), 78, 166, 528, 350, "Fusion GRU permutation feature importance");
    label(slide, "What changes validation MAE", 62, 558, 240, C.purple);
    text(slide, "Local net flow dominates the permutation result. Load, imbalance, and centrality features have smaller but visible effects.", 280, 556, 320, 34, 15, C.text, { lineSpacing: 1.08 });
    box(slide, 662, 148, 556, 390, C.white, C.line);
    image(slide, path.join(FIG, "tsne_projection.png"), 678, 166, 524, 350, "t-SNE projection of Fusion GRU hidden states");
    label(slide, "How hidden states group", 662, 558, 220, C.teal);
    text(slide, "The projection shows groups of Normal, Warning, and Critical examples, with overlap near the class boundaries.", 882, 556, 320, 34, 15, C.text, { lineSpacing: 1.08 });
    text(slide, "The model uses the signal that is closest to the target, while graph centrality adds context around the country’s position in the network.", 62, 626, 1156, 24, 16, C.navy, { bold: true });
    note(slide, "Source: results/figures/feature_importance.png, results/figures/tsne_projection.png, and results/feature_importance.json. Explain that permutation importance measures how validation MAE changes when a feature is shuffled. t-SNE is a visual diagnostic, not a performance metric.");
  }

  // 10. Error analysis and review conclusion
  {
    const slide = add();
    header(slide, "Error analysis and what Review 2 establishes", "9. Findings", slideNo);
    box(slide, 62, 148, 560, 396, C.white, C.line);
    image(slide, path.join(FIG, "error_distribution.png"), 78, 166, 528, 320, "Fusion GRU absolute error distribution");
    label(slide, "Error shape", 62, 500, 140, C.orange);
    text(slide, "Most errors are small, but a long tail remains. Large misses can cross a stress threshold.", 192, 500, 400, 34, 15, C.text, { lineSpacing: 1.0 });
    box(slide, 662, 148, 556, 380, C.white, C.line);
    label(slide, "Saved examples", 688, 176, 190, C.teal);
    text(slide, "Close prediction\nSE, 26 Dec 2024 20:00\nActual −5,067 MW | Predicted −5,067.17 MW\n\nMissed critical case\nDE, 28 Dec 2024 14:00\nActual 7,484.5 MW | Predicted 3,986.7 MW", 688, 224, 480, 190, 18, C.navy, { bold: true, lineSpacing: 1.22 });
    text(slide, "The error analysis keeps both success and failure examples visible instead of reporting only the average score.", 688, 454, 480, 42, 15, C.text, { lineSpacing: 1.12 });
    box(slide, 62, 566, 1156, 74, C.navy, C.navy);
    text(slide, "Review 2 takeaway: the saved checkpoints learn useful temporal patterns, Fusion GRU leads this benchmark, and the remaining errors show why graph stress and routing analysis matter in Review 3.", 88, 585, 1100, 38, 15, C.white, { bold: true, lineSpacing: 1.0 });
    note(slide, "Source: results/figures/error_distribution.png and results/error_analysis.json. Explain that the project reports a representative success and failure, then moves to the prescriptive layer: which nodes and edges are influential, and whether a stressed transfer can be rerouted with an explicit trade-off.");
  }

  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await writeBlob(path.join(BUILD, "GridPulse_Review_2_montage.webp"), montage);
  for (const [index, slide] of presentation.slides.items.entries()) {
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(BUILD, `slide-${String(index + 1).padStart(2, "0")}.png`), png);
  }
  const candidate = path.join(BUILD, "candidate.pptx");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(candidate);
  console.log(JSON.stringify({ candidate, final: FINAL, slides: presentation.slides.items.length, montage: path.join(BUILD, "GridPulse_Review_2_montage.webp") }, null, 2));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
