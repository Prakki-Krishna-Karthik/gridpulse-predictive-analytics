import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:\\Users\\Krishna Karthik\\Desktop\\predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build-review3");
const OUT = path.join(ROOT, ".codex-ppt-output-review3");
const FIG = path.join(ROOT, "results", "figures");
const FINAL = path.join(OUT, "GridPulse_Review_3_Graph_Routing.pptx");
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

function box(slide, left, top, width, height, fill, lineFill = C.line) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: 1 },
    borderRadius: "rounded-lg",
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
  label(slide, kicker, 62, 34, 560, C.teal);
  text(slide, title, 62, 56, 1110, 48, 31, C.navy, { bold: true, lineSpacing: 1.0 });
  line(slide, 62, 112, 1156, C.line, 1);
  text(slide, "GRIDPULSE  /  PROJECT REVIEW 3", 62, 684, 390, 18, 10, C.muted, { bold: true });
  text(slide, String(number).padStart(2, "0"), 1180, 682, 36, 20, 11, C.navy, { bold: true, alignment: "right" });
}

function note(slide, value) {
  slide.speakerNotes.text = value;
  slide.speakerNotes.setVisible(true);
}

function metric(slide, value, caption, left, top, width, accent = C.teal) {
  box(slide, left, top, width, 92, C.white, C.line);
  shape(slide, "rect", left, top, 6, 92, accent, "none", 0);
  text(slide, value, left + 20, top + 12, width - 28, 32, 25, C.navy, { bold: true });
  text(slide, caption, left + 20, top + 54, width - 28, 28, 12, C.muted);
}

function numberedStep(slide, number, title, detail, left, top, width, accent) {
  box(slide, left, top, width, 86, C.white, C.line);
  shape(slide, "ellipse", left + 16, top + 19, 44, 44, accent, "none", 0);
  text(slide, number, left + 16, top + 29, 44, 20, 14, C.white, { bold: true, alignment: "center" });
  text(slide, title, left + 78, top + 14, width - 94, 24, 17, C.navy, { bold: true });
  text(slide, detail, left + 78, top + 43, width - 94, 32, 13, C.text, { lineSpacing: 1.05 });
}

function row(slide, left, top, width, title, value, detail, accent = C.teal) {
  line(slide, left, top + 46, width, C.line, 1);
  text(slide, title, left, top, 220, 20, 15, C.navy, { bold: true });
  text(slide, value, left + 220, top, 110, 20, 15, accent, { bold: true, alignment: "right" });
  text(slide, detail, left, top + 23, width, 18, 12, C.muted);
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
    shape(slide, "rect", 430, 0, 8, H, C.teal, "none", 0);
    label(slide, "Predictive analytics course project", 62, 64, 330, "#B8D6DB");
    text(slide, "GridPulse", 62, 142, 340, 58, 44, C.white, { bold: true });
    text(slide, "Graph-based predictive and prescriptive analytics for cross-border power grid flows", 62, 222, 315, 128, 24, C.white, { lineSpacing: 1.12 });
    text(slide, "Project Review 3\nGraph intelligence and prescriptive routing", 62, 408, 320, 72, 17, "#D8E7EA", { lineSpacing: 1.2 });
    text(slide, "Project Review 3", 510, 104, 520, 38, 28, C.navy, { bold: true });
    line(slide, 510, 162, 650, C.teal, 3);
    label(slide, "Project team", 510, 204, 160, C.teal);
    text(slide, "Prakki Krishna Karthik  |  23BCE1294\nVasudev  |  23BCE1496\nShubham Bhuyan  |  23BCE1809", 510, 236, 500, 108, 19, C.text, { lineSpacing: 1.28 });
    label(slide, "Course and faculty", 510, 386, 220, C.teal);
    text(slide, "Predictive Analytics\nFaculty: Pattabiraman V", 510, 418, 460, 58, 18, C.text, { lineSpacing: 1.25 });
    box(slide, 510, 540, 620, 72, C.white, C.line);
    text(slide, "Review 3 turns forecasts into an auditable graph decision.", 536, 559, 565, 32, 17, C.navy, { bold: true });
    text(slide, "01", 1160, 650, 48, 24, 12, C.navy, { bold: true, alignment: "right" });
    note(slide, "Opening: Reviews 1 and 2 established the data, models, and evaluation evidence. This review explains the graph intelligence layer and the recommendation workflow that follows a forecast.");
  }

  // 2. Graph intelligence overview
  {
    const slide = add();
    header(slide, "From a forecast to a network decision", "1. Graph intelligence", slideNo);
    text(slide, "A country can look safe in isolation while its neighbouring links are losing headroom. The graph layer makes that dependency visible.", 62, 140, 1080, 30, 19, C.navy, { bold: true });
    numberedStep(slide, "1", "Forecast", "Fusion GRU or DCRNN estimates next-hour net flow for each country.", 62, 206, 360, C.teal);
    numberedStep(slide, "2", "Propagate stress", "Risk is shared across adjacent nodes using the canonical 12-node topology.", 460, 206, 360, C.orange);
    numberedStep(slide, "3", "Test removal", "Each edge is removed in a counterfactual check to measure structural impact.", 858, 206, 360, C.purple);
    box(slide, 62, 338, 1156, 220, C.white, C.line);
    label(slide, "What this adds to predictive analytics", 88, 366, 330, C.teal);
    text(slide, "Prediction answers: What is likely next hour?\n\nGraph reasoning answers: Where can that pressure travel, which link is influential, and what happens if we reduce a stressed transfer?", 88, 410, 520, 110, 20, C.navy, { bold: true, lineSpacing: 1.18 });
    box(slide, 674, 378, 500, 128, C.tealLight, C.teal);
    text(slide, "The output is a ranked, explainable screening result. It does not replace a power-system operator or an AC load-flow study.", 704, 406, 440, 70, 18, C.navy, { bold: true, lineSpacing: 1.15 });
    text(slide, "Inputs: observed flows, forecasted stress, node connectivity, proxy loss, edge history", 62, 612, 1156, 24, 15, C.muted, { italic: true });
    note(slide, "Explain the hand-off from Review 2. The learned forecast supplies a likely next-hour condition. The graph layer then asks how local stress can affect neighbouring countries and whether the network still has alternate routes.");
  }

  // 3. Stress propagation equations
  {
    const slide = add();
    header(slide, "How stress is propagated through the graph", "2. Stress propagation method", slideNo);
    box(slide, 62, 148, 520, 410, C.white, C.line);
    label(slide, "Step 1: link stress", 88, 178, 240, C.orange);
    text(slide, "sₑ = 0.45uₑ + 0.25rₑ + 0.20pₑ + 0.10ℓₑ", 88, 224, 450, 42, 22, C.navy, { bold: true });
    text(slide, "uₑ  utilization of the link\nrₑ  endpoint risk\npₑ  risk propagated from neighbouring nodes\nℓₑ  loss proxy", 88, 292, 430, 110, 17, C.text, { lineSpacing: 1.18 });
    text(slide, "The weights make utilization the strongest signal, while still preserving endpoint and neighbourhood context.", 88, 454, 430, 54, 15, C.muted, { lineSpacing: 1.1 });
    box(slide, 638, 148, 580, 410, C.white, C.line);
    label(slide, "Step 2: edge criticality", 664, 178, 280, C.purple);
    text(slide, "cₑ = 0.55sₑ + 0.25bₑ + 0.15dₑ + 0.05hₑ", 664, 224, 500, 42, 22, C.navy, { bold: true });
    text(slide, "bₑ  edge betweenness\ndₑ  disconnected-pair rate after removal\nhₑ  average hop increase after removal", 664, 292, 480, 92, 17, C.text, { lineSpacing: 1.18 });
    text(slide, "Two checks are combined: dynamic pressure now, and structural importance if the edge disappears.", 664, 454, 480, 54, 15, C.muted, { lineSpacing: 1.1 });
    box(slide, 62, 588, 1156, 52, C.orangeLight, C.orange);
    text(slide, "Important scope: these are screening proxies, not AC power flow, thermal limits, voltage stability, or N-1 certification.", 88, 605, 1100, 20, 15, C.orange, { bold: true });
    note(slide, "The formulas are implemented in the saved graph stress analysis. Stress is normalized before the weighted combination. Criticality adds topology evidence from counterfactual edge removal. The result is designed to be inspectable, not to pretend that the project has utility-grade engineering data.");
  }

  // 4. Stress results
  {
    const slide = add();
    header(slide, "Latest replay: where pressure concentrates", "3. Graph stress results", slideNo);
    box(slide, 62, 148, 700, 430, C.white, C.line);
    image(slide, path.join(FIG, "graph_stress_propagation.png"), 78, 166, 668, 394, "Saved graph stress propagation figure");
    box(slide, 796, 148, 422, 430, C.white, C.line);
    label(slide, "Latest screening snapshot", 822, 176, 260, C.teal);
    metric(slide, "NO · 73.68", "top node influence score", 822, 214, 344, C.orange);
    metric(slide, "CH-DE · 66.4", "top critical edge score", 822, 322, 344, C.purple);
    row(slide, 822, 446, 344, "NO", "75.58", "propagated node risk", C.orange);
    row(slide, 822, 500, 344, "CH", "73.86", "propagated node risk", C.orange);
    text(slide, "The graph does not only highlight the largest flow. It also highlights the node or edge whose position makes the network more sensitive.", 62, 612, 1156, 24, 15, C.navy, { bold: true });
    note(slide, "Source: results/figures/graph_stress_propagation.png and results/graph_stress_analysis.json. The latest saved snapshot ranks NO as the most influential node at 73.68 and CH-DE as the most critical edge at 66.4. These numbers are screening scores on a 0 to 100 scale, not megawatts or a physical thermal rating.");
  }

  // 5. Resilience ranking
  {
    const slide = add();
    header(slide, "Edge resilience: what changes when a link is removed", "4. Counterfactual analysis", slideNo);
    box(slide, 62, 148, 700, 430, C.white, C.line);
    image(slide, path.join(FIG, "graph_resilience_ranking.png"), 78, 166, 668, 394, "Saved graph resilience ranking figure");
    box(slide, 796, 148, 422, 430, C.white, C.line);
    label(slide, "Top removal checks", 822, 176, 240, C.purple);
    row(slide, 822, 216, 344, "CH-DE", "66.4", "2 alternate shortest paths", C.purple);
    row(slide, 822, 270, 344, "AT-DE", "65.7", "2 alternate shortest paths", C.purple);
    row(slide, 822, 324, 344, "DE-PL", "56.66", "2 alternate shortest paths", C.purple);
    row(slide, 822, 378, 344, "DE-LU", "50.8", "1 alternate shortest path", C.purple);
    box(slide, 822, 456, 344, 88, C.purpleLight, C.purple);
    text(slide, "No top-ranked removal disconnects a country pair in this snapshot. A high score means reduced structural slack or longer recovery paths.", 842, 480, 304, 46, 14, C.navy, { bold: true, lineSpacing: 1.08 });
    text(slide, "Betweenness + disconnection count + hop increase are recalculated for each counterfactual edge removal.", 62, 612, 1156, 24, 15, C.muted, { italic: true });
    note(slide, "Source: results/figures/graph_resilience_ranking.png and results/graph_resilience_ranking.csv. Clarify that resilience is not binary. The network can remain connected while a key link removal makes alternate paths longer or more expensive.");
  }

  // 6. Timeline
  {
    const slide = add();
    header(slide, "Risk moves with the replay, not just with the topology", "5. Time-varying graph analysis", slideNo);
    box(slide, 62, 148, 760, 430, C.white, C.line);
    image(slide, path.join(FIG, "graph_stress_timeline.png"), 78, 166, 728, 394, "Saved graph stress timeline figure");
    box(slide, 858, 148, 360, 430, C.white, C.line);
    label(slide, "CH-DE peak window", 884, 176, 260, C.orange);
    text(slide, "16 Dec 2024\n01:00 UTC", 884, 224, 300, 62, 27, C.navy, { bold: true, lineSpacing: 1.0 });
    metric(slide, "97.10", "dynamic stress", 884, 316, 290, C.orange);
    metric(slide, "75.95", "criticality", 884, 424, 290, C.purple);
    text(slide, "The same edge can move from warning to a higher screening state as observed transfer and endpoint risk change.", 884, 540, 290, 42, 14, C.text, { lineSpacing: 1.08 });
    note(slide, "Source: results/figures/graph_stress_timeline.png and results/graph_stress_analysis.json. The CH-DE series peaks at 97.10 dynamic stress and 75.95 criticality at 16 Dec 2024 01:00 UTC. This is why the dashboard shows a replay cursor and changing values instead of one static graph.");
  }

  // 7. Routing logic
  {
    const slide = add();
    header(slide, "How prescriptive routing is chosen", "6. Recommendation logic", slideNo);
    numberedStep(slide, "1", "Select", "Choose a stressed link and a reduction percentage, capped at 60%.", 62, 160, 360, C.orange);
    numberedStep(slide, "2", "Search", "Find a connected path between the same endpoints, first requiring proxy headroom.", 460, 160, 360, C.teal);
    numberedStep(slide, "3", "Guard", "Avoid Critical links in the strict search and record any bottlenecks.", 858, 160, 360, C.purple);
    box(slide, 62, 278, 560, 280, C.white, C.line);
    label(slide, "Path cost", 88, 306, 180, C.teal);
    text(slide, "Costₑ = Lₑ × (1 + 2.2Uₑ + 6Loss%ₑ)", 88, 354, 500, 40, 22, C.navy, { bold: true });
    text(slide, "Lₑ  distance proxy\nUₑ  current utilization\nLoss%ₑ  distance-based loss proxy", 88, 420, 450, 84, 17, C.text, { lineSpacing: 1.18 });
    box(slide, 676, 278, 542, 280, C.white, C.line);
    label(slide, "Decision status", 702, 306, 180, C.purple);
    text(slide, "ROUTE FOUND", 702, 354, 440, 24, 19, C.green, { bold: true });
    text(slide, "All guardrails pass.\n\nBEST EFFORT", 702, 402, 440, 52, 19, C.orange, { bold: true, lineSpacing: 1.05 });
    text(slide, "A physical path exists, but headroom or risk guardrails need review.\n\nNO ALTERNATE PATH", 702, 468, 440, 70, 15, C.text, { bold: true, lineSpacing: 1.08 });
    text(slide, "The API returns a recommendation and a trade-off. It does not dispatch power automatically.", 62, 612, 1156, 24, 15, C.navy, { bold: true });
    note(slide, "The route planner in backend/routing.py uses Dijkstra-style path search. It first tries strict constraints: enough proxy headroom and no Critical links. If that fails, it returns the best physical path with bottlenecks, clearly labelling the result as best effort for human review.");
  }

  // 8. Scenario example
  {
    const slide = add();
    header(slide, "Scenario example: relieving CH-DE has a visible trade-off", "7. What-if simulation", slideNo);
    text(slide, "The planner tests a 25% reduction on CH-DE, then compares the original proxy loss with the candidate alternate route.", 62, 140, 1120, 28, 18, C.navy, { bold: true });
    metric(slide, "1,414.75 MW", "selected transfer", 62, 204, 250, C.orange);
    metric(slide, "353.69 MW", "flow moved at 25%", 332, 204, 250, C.teal);
    metric(slide, "CH to AT to DE", "candidate route", 602, 204, 250, C.purple);
    metric(slide, "BEST EFFORT", "review status", 872, 204, 250, C.orange);
    box(slide, 62, 338, 560, 220, C.white, C.line);
    label(slide, "Loss comparison", 88, 366, 220, C.teal);
    text(slide, "Baseline proxy loss", 88, 414, 250, 22, 17, C.text, { bold: true });
    text(slide, "204.25 MW", 380, 410, 180, 28, 23, C.navy, { bold: true, alignment: "right" });
    text(slide, "Rerouted proxy loss", 88, 462, 250, 22, 17, C.text, { bold: true });
    text(slide, "241.24 MW", 380, 458, 180, 28, 23, C.orange, { bold: true, alignment: "right" });
    line(slide, 88, 502, 472, C.line, 1);
    text(slide, "Loss delta", 88, 520, 250, 22, 17, C.navy, { bold: true });
    text(slide, "+37.00 MW", 380, 516, 180, 28, 23, C.orange, { bold: true, alignment: "right" });
    box(slide, 676, 338, 542, 220, C.orangeLight, C.orange);
    label(slide, "How to interpret it", 702, 366, 220, C.orange);
    text(slide, "The scenario reduces pressure on the selected edge, but the alternate path is longer or more stressed, so the proxy loss increases.", 702, 410, 470, 76, 19, C.navy, { bold: true, lineSpacing: 1.15 });
    text(slide, "That is not a failed prediction. It is the cost of the proposed recovery and the reason an operator must review the recommendation.", 702, 500, 470, 38, 15, C.text, { lineSpacing: 1.08 });
    text(slide, "Recommendation only. Validate with engineering limits and an N-1 study before operational use.", 62, 612, 1156, 24, 15, C.muted, { italic: true });
    note(slide, "This saved scenario illustrates the project’s prescriptive behaviour. A route can relieve the selected transfer but add distance-based proxy loss. The system presents that trade-off rather than hiding it. The values shown are the project’s stored scenario example.");
  }

  // 9. Integration architecture
  {
    const slide = add();
    header(slide, "How the decision layer reaches the interface", "8. System integration", slideNo);
    box(slide, 62, 148, 760, 430, C.white, C.line);
    image(slide, path.join(FIG, "backend_system_architecture.png"), 78, 166, 728, 394, "Saved backend system architecture figure");
    box(slide, 858, 148, 360, 430, C.white, C.line);
    label(slide, "Runtime path", 884, 176, 180, C.teal);
    numberedStep(slide, "A", "Replay snapshot", "server.py serves the selected timestamp and topology.", 884, 218, 290, C.teal);
    numberedStep(slide, "B", "Forecast", "saved Fusion GRU or DCRNN checkpoint supplies next-hour values.", 884, 316, 290, C.purple);
    numberedStep(slide, "C", "Recommend", "routing.py returns a route, status, and loss trade-off.", 884, 414, 290, C.orange);
    text(slide, "The browser redraws the SVG network and overlays the recommendation. Live-style replay is API-backed, but it is not SCADA telemetry.", 884, 528, 290, 44, 14, C.text, { lineSpacing: 1.08 });
    note(slide, "Source: results/figures/backend_system_architecture.png. Explain the interfaces: the Python API exposes topology, forecast, graph analysis, and route-plan endpoints. The frontend requests those results and redraws the graph, metrics, and route overlay. The current project uses replay data rather than a live utility feed.");
  }

  // 10. Final findings
  {
    const slide = add();
    header(slide, "What Review 3 establishes", "9. Findings and next steps", slideNo);
    box(slide, 62, 148, 360, 390, C.white, C.line);
    label(slide, "Project contribution", 88, 176, 230, C.teal);
    text(slide, "Forecast → graph explanation → counterfactual test → recommendation", 88, 222, 300, 88, 22, C.navy, { bold: true, lineSpacing: 1.1 });
    text(slide, "The novelty is the auditable chain. A learned forecast is connected to stress propagation and a loss-aware route scenario with visible guardrails.", 88, 344, 300, 96, 16, C.text, { lineSpacing: 1.12 });
    box(slide, 460, 148, 360, 390, C.white, C.line);
    label(slide, "Current limitations", 486, 176, 230, C.orange);
    text(slide, "• Proxy distance and loss\n• No measured thermal or voltage limits\n• No AC load-flow or N-1 certification\n• Route is a recommendation, not dispatch\n• Replay data, not live SCADA", 486, 224, 300, 170, 17, C.text, { lineSpacing: 1.28 });
    box(slide, 858, 148, 360, 390, C.white, C.line);
    label(slide, "Next engineering step", 884, 176, 240, C.purple);
    text(slide, "Connect verified line parameters and telemetry, then validate each scenario with AC load flow, thermal limits, voltage stability, uncertainty calibration, and an N-1 study.", 884, 224, 300, 118, 17, C.navy, { bold: true, lineSpacing: 1.16 });
    text(slide, "Final takeaway", 884, 386, 220, 20, 15, C.purple, { bold: true });
    text(slide, "The model predicts. The graph explains. The scenario planner tests. The operator decides.", 884, 420, 300, 64, 20, C.navy, { bold: true, lineSpacing: 1.12 });
    box(slide, 62, 574, 1156, 66, C.navy, C.navy);
    text(slide, "Review 3 takeaway: graph reasoning turns a next-hour forecast into a transparent decision-support workflow.", 88, 596, 1100, 24, 16, C.white, { bold: true });
    note(slide, "Closing: The project is intentionally transparent about what the ML model does and what the graph layer does. The learned model forecasts the next hour. The graph analysis identifies sensitive nodes and edges. The route planner tests a what-if. The result is a recommendation for review, not an automatic operational action.");
  }

  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await writeBlob(path.join(BUILD, "GridPulse_Review_3_montage.webp"), montage);
  for (const [index, slide] of presentation.slides.items.entries()) {
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(BUILD, `slide-${String(index + 1).padStart(2, "0")}.png`), png);
  }
  const candidate = path.join(BUILD, "candidate.pptx");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(candidate);
  console.log(JSON.stringify({ candidate, final: FINAL, slides: presentation.slides.items.length, montage: path.join(BUILD, "GridPulse_Review_3_montage.webp") }, null, 2));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
