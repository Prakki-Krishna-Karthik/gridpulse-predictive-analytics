from pathlib import Path
import json

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(r"C:\Users\Krishna Karthik\Desktop\predictive-proj")
OUT = ROOT / "speaker_documents"
OUT.mkdir(parents=True, exist_ok=True)

with open(ROOT / "results" / "model_comparison.json", encoding="utf-8") as f:
    comparison = json.load(f)
with open(ROOT / "data" / "processed" / "model_metrics.json", encoding="utf-8") as f:
    baseline = json.load(f)
with open(ROOT / "results" / "dataset_profile.json", encoding="utf-8") as f:
    profile = json.load(f)
with open(ROOT / "results" / "confusion_matrix.json", encoding="utf-8") as f:
    confusion = json.load(f)["matrix"]
with open(ROOT / "results" / "feature_importance.json", encoding="utf-8") as f:
    feature_importance = json.load(f)["features"]
with open(ROOT / "results" / "error_analysis.json", encoding="utf-8") as f:
    errors = json.load(f)

models = {row["model"]: row for row in comparison["models"]}

NAVY = "173746"
TEAL = "168FA6"
GREEN = "1C9A72"
PURPLE = "6C63B5"
AMBER = "C98A21"
LIGHT = "EEF4F7"
GRAY = "71838D"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color="D9D9D9", size="6"):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_run_font(run, name="Aptos", size=10.5, color="000000", bold=False, italic=False):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    run.bold = bold
    run.italic = italic


def setup_document(title):
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(0.65)
    section.bottom_margin = Inches(0.6)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)
    styles = doc.styles
    styles["Normal"].font.name = "Aptos"
    styles["Normal"]._element.rPr.rFonts.set(qn("w:ascii"), "Aptos")
    styles["Normal"]._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos")
    styles["Normal"].font.size = Pt(10.5)
    for style_name, size in (("Title", 22), ("Heading 1", 16), ("Heading 2", 13), ("Heading 3", 11)):
        style = styles[style_name]
        style.font.name = "Aptos Display" if style_name in ("Title", "Heading 1") else "Aptos"
        style._element.rPr.rFonts.set(qn("w:ascii"), style.font.name)
        style._element.rPr.rFonts.set(qn("w:hAnsi"), style.font.name)
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.font.bold = True
    p = doc.add_paragraph(style="Title")
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.add_run(title)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run("Purpose: study these notes before presenting the assigned slides. Explain the ideas in your own words and use the examples when the audience is unfamiliar with AI or power grids.")
    set_run_font(r, size=10.5, color=GRAY)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = footer.add_run("GridPulse · Predictive and Prescriptive Analytics · Presentation study notes")
    set_run_font(r, size=8, color=GRAY)
    return doc


def add_para(doc, text, bold_lead=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5)
    if bold_lead and text.startswith(bold_lead):
        r = p.add_run(bold_lead)
        set_run_font(r, size=10.5, bold=True, color=NAVY)
        r = p.add_run(text[len(bold_lead):])
        set_run_font(r, size=10.5)
    else:
        r = p.add_run(text)
        set_run_font(r, size=10.5)
    return p


def add_bullets(doc, items, level=0):
    for item in items:
        p = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(item)
        set_run_font(r, size=10.3)


def add_heading(doc, text, level=1):
    return doc.add_heading(text, level=level)


def add_formula(doc, formula, explanation):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(formula)
    set_run_font(r, name="Cambria Math", size=14, color=NAVY, bold=True)
    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_after = Pt(6)
    r2 = p2.add_run(explanation)
    set_run_font(r2, size=9.5, color=GRAY, italic=True)


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.autofit = False
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = header
        set_cell_shading(cell, NAVY)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        if widths:
            cell.width = Inches(widths[i])
        for p in cell.paragraphs:
            for r in p.runs:
                set_run_font(r, size=9, color="FFFFFF", bold=True)
        set_cell_border(cell)
    for row_idx, row in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = str(value)
            cells[i].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if widths:
                cells[i].width = Inches(widths[i])
            set_cell_shading(cells[i], "FFFFFF" if row_idx % 2 == 0 else LIGHT)
            for p in cells[i].paragraphs:
                p.paragraph_format.space_after = Pt(1)
                for r in p.runs:
                    set_run_font(r, size=9, color="000000")
            set_cell_border(cells[i])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def add_slide_section(doc, slide, title, purpose, points, say, questions=None):
    add_heading(doc, f"Slide {slide}  {title}", level=2)
    add_para(doc, f"Purpose: {purpose}")
    add_bullets(doc, points)
    add_para(doc, f"What to say: {say}", bold_lead="What to say:")
    if questions:
        add_para(doc, "If asked:", bold_lead="If asked:")
        add_bullets(doc, questions, level=1)


def save(doc, filename):
    doc.save(OUT / filename)


def make_person1():
    doc = setup_document("Person 1 Presentation Notes Data and Grid Foundation")
    add_heading(doc, "What this person must understand", level=1)
    add_para(doc, "This section explains the real-world problem, the two input datasets, the cleaning work, the extracted features, the country graph, and the assumptions behind the risk screen and loss estimate. The key idea is simple: the model cannot make a useful forecast until the raw rows are made consistent.")
    add_table(doc, ["Fact", "Project value"], [
        ["Dynamic records", f"{profile['dynamic_rows']:,}"],
        ["Power-flow records", f"{profile['power_flow_rows']:,}"],
        ["Countries / nodes", "12"],
        ["Canonical links / edges", "24"],
        ["Time coverage", "2022–2024 hourly replay"],
    ], widths=[2.4, 4.0])
    add_heading(doc, "Basic vocabulary", level=1)
    add_bullets(doc, [
        "A node is a country or grid location.",
        "An edge is an interconnector or power line between two nodes.",
        "Net flow is the signed overall flow value used by the dataset. The sign indicates direction according to the source convention.",
        "A feature is an input signal. The target is the future net flow the model must predict.",
        "A graph is a network representation that keeps countries and their connections together.",
    ])
    add_heading(doc, "Slide-by-slide explanation", level=1)
    add_slide_section(doc, 1, "Graph-Based Predictive and Prescriptive Analytics", "Introduce the project in one sentence.", [
        "The project combines forecasting, graph analysis, risk screening, and route testing.",
        "The dashboard uses a historical replay of supplied data, not live utility telemetry.",
    ], "We turn historical cross-border power-flow records into an explainable forecast and a recommendation about which route an engineer should investigate next.")
    add_slide_section(doc, 2, "The decision problem", "Explain why the grid is a network problem.", [
        "Power can move across several connected countries at the same time.",
        "A stressed line can make neighboring links relevant.",
        "Prediction asks what may happen next; prescription asks what could be investigated.",
    ], "Think of the grid as roads and power as traffic. If one road becomes crowded, we first predict the traffic and then test whether another connected road has space.")
    add_slide_section(doc, 3, "Data becomes a model-ready window", "Explain how raw CSV records become model inputs.", [
        "Parse timestamps and align countries by hour.",
        "Normalize country and interconnector aliases.",
        "Check duplicates, missing values, and timestamp gaps.",
        "Build a 24-hour input window and use the next hour as the target.",
    ], "The model does not read a raw CSV row directly. The pipeline creates a clean tensor containing recent local behavior, network context, and graph features.")
    add_slide_section(doc, 4, "Graph, risk screen, and loss assumptions", "Explain nodes, edges, risk, and the proxy physics.", [
        "Node colors show Normal, Warning, or Critical screening states.",
        "Risk pressure is mainly driven by utilization, with imbalance and load residual adding context.",
        "Coordinates estimate line distance, but the result is not a complete AC power-flow calculation.",
    ], "The graph tells us who is connected to whom. The risk score tells us where to look first. The loss estimate is transparent, but an engineer must replace the assumptions with verified line data before operational use.")
    add_heading(doc, "Equations to know", level=1)
    add_formula(doc, "R = ρL / A", "Resistance equals resistivity times line length divided by conductor area.")
    add_formula(doc, "P_loss = 3I²R", "Estimated three-phase resistive loss from current and resistance.")
    add_formula(doc, "risk score = 75 × utilization + 15 × |imbalance| + 10 × residual-to-load ratio", "The implementation caps the component ratios and clips the final score to 0–100.")
    add_heading(doc, "Questions you should be ready for", level=1)
    add_bullets(doc, [
        "Why use a graph? Because neighboring countries and alternate paths affect the decision.",
        "Is distance exact? No. It is derived from available coordinates.",
        "Is the loss engineering grade? No. It is a screening proxy using assumed constants.",
        "Is the data live? No. The visible movement is a replay of supplied historical records.",
    ])
    add_heading(doc, "Handoff sentence", level=1)
    add_para(doc, "The data and graph are now ready. The next section explains how the project forecasts the next hour, measures performance, and tests a possible route.")
    save(doc, "Person_1_Data_and_Grid_Foundation.docx")


def make_person2():
    doc = setup_document("Person 2 Presentation Notes Models Results and Routing")
    add_heading(doc, "What this person must understand", level=1)
    add_para(doc, "This section explains how the prepared data becomes a prediction, how the models are compared, what the evaluation numbers mean, and how the route planner turns a stressed link into a what-if recommendation.")
    add_heading(doc, "Important distinction", level=1)
    add_para(doc, "The current website forecast endpoint uses the selected operational baseline. The saved processed artifact selects Persistence because it produced the lowest pooled chronological RMSE. Fusion GRU and DCRNN are included in the research benchmark and results pack. Do not say that DCRNN currently drives the website unless the code is changed to load the checkpoint.")
    add_heading(doc, "Model comparison from the saved run", level=1)
    rows = []
    for key in ("persistence", "fusion_gru", "dcrnn"):
        row = models[key]
        rows.append([row["label"], f"{row['rmse']:.1f} MW", f"{row['mae']:.1f} MW", f"{row['accuracy']*100:.1f}%", f"{row['f1']*100:.1f}%"])
    add_table(doc, ["Model", "RMSE", "MAE", "Accuracy", "F1"], rows, widths=[2.1, 1.1, 1.1, 1.1, 1.0])
    add_heading(doc, "Slide-by-slide explanation", level=1)
    add_slide_section(doc, 5, "Forecasting models and system stack", "Introduce simple baselines, neural models, and the software integration.", [
        "Persistence copies the most recent flow.",
        "Moving average uses the recent 24-hour mean.",
        "Seasonal naive uses the same hour from the previous day.",
        "Linear trend extrapolates the recent 24-hour slope.",
        "Fusion GRU and DCRNN are trained research models.",
    ], "We test simple rules before trusting a more complex neural model. In this project, the website keeps Persistence as the operational baseline because it won the saved chronological comparison.")
    add_slide_section(doc, 6, "How the next-hour forecast is produced", "Give a numerical example and define the metrics.", [
        "If the latest flow is 720 MW, Persistence predicts 720 MW for the next hour.",
        "For multiple future hours, the system appends each prediction and continues the forecast.",
        "The same chronological holdout is used to compare models fairly.",
    ], "A baseline can be strong because hourly flow is often autocorrelated. A complex model has to earn its place by reducing error on unseen future-like data.")
    add_slide_section(doc, 7, "Performance evidence", "Explain the comparison chart and confusion matrix.", [
        f"Persistence RMSE: {models['persistence']['rmse']:.1f} MW.",
        f"Fusion GRU RMSE: {models['fusion_gru']['rmse']:.1f} MW.",
        f"DCRNN RMSE: {models['dcrnn']['rmse']:.1f} MW.",
        "The confusion matrix uses Normal, Warning, and Critical rows and columns.",
    ], "RMSE measures numeric flow error. The confusion matrix shows the type of stress-class mistake, which is more useful than accuracy alone.")
    add_slide_section(doc, 8, "Prescriptive routing", "Explain the road analogy and decision rules.", [
        "Move a chosen percentage of the selected line in a simulation.",
        "Search for connected paths between the same endpoints.",
        "Reject paths without enough headroom or containing a Critical link.",
        "Rank survivors using distance, utilization, and estimated loss.",
        "Show bottlenecks and required engineering checks.",
    ], "For 1,000 MW and a 25% test, the planner evaluates 250 MW on alternate paths. Purple means a candidate recommendation, not an automatic switching order.")
    add_heading(doc, "Equations to know", level=1)
    add_formula(doc, "MAE = (1/n) Σ |prediction − actual|", "Average absolute flow error in MW.")
    add_formula(doc, "RMSE = √[(1/n) Σ (prediction − actual)²]", "Large errors receive more weight.")
    add_formula(doc, "precision = TP / (TP + FP),   recall = TP / (TP + FN)", "Precision measures warning reliability; recall measures how many real warnings were caught.")
    add_formula(doc, "F1 = 2 × precision × recall / (precision + recall)", "One score that balances precision and recall.")
    add_formula(doc, "moved MW = current MW × reroute percentage / 100", "Example: 1,000 MW × 25% = 250 MW.")
    add_formula(doc, "headroom = proxy capacity − current flow", "Remaining screening capacity on a candidate link.")
    add_formula(doc, "route cost = distance × (1 + 2.2 × utilization + 6 × loss percentage)", "Lower cost is preferred after safety guardrails are applied.")
    add_heading(doc, "Questions you should be ready for", level=1)
    add_bullets(doc, [
        "Why did Persistence win? Short-horizon flow can be strongly related to the latest observed value.",
        "Why not rely only on accuracy? Accuracy hides which class is being confused.",
        "Does routing change the real grid? No. It is a what-if recommendation.",
        "Why is MAPE not emphasized? Near-zero or sign-changing net flows make percentage error unstable.",
    ])
    add_heading(doc, "Handoff sentence", level=1)
    add_para(doc, "The application can now forecast and test an action. The final section explains the advanced DCRNN evidence, the saved result figures, the novelty, and the project limits.")
    save(doc, "Person_2_Models_Results_and_Routing.docx")


def make_person3():
    doc = setup_document("Person 3 Presentation Notes DCRNN Evidence and Conclusion")
    add_heading(doc, "What this person must understand", level=1)
    add_para(doc, "This section explains the advanced research models, the original figures in the results folder, why DCRNN did not win this run, how the frontend and backend connect, and what the group can claim honestly.")
    add_heading(doc, "DCRNN in one paragraph", level=1)
    add_para(doc, "DCRNN means Diffusion Convolutional Recurrent Neural Network. It reads a sequence of previous hourly observations. Before the recurrent memory update, it passes information through the graph so a country can receive context from connected countries. It then predicts the next net flow for all graph nodes together. A road analogy is useful: before predicting traffic on one road, the model also checks nearby roads.")
    add_heading(doc, "Slide-by-slide explanation", level=1)
    add_slide_section(doc, 9, "DCRNN in simple terms", "Explain graph diffusion and compare the saved result.", [
        "Fusion GRU reads a sequence with local and global features.",
        "DCRNN preserves the node dimension and passes signals through forward and reverse graph transitions.",
        "DCRNN is a benchmark implementation, not a dispatch solver.",
    ], "Graph diffusion lets neighboring countries share information before the recurrent update. It tests whether network context adds predictive value beyond local history.")
    add_slide_section(doc, 10, "Saved results and interpretation", "Explain why each original figure matters.", [
        "Training curves show whether learning is stable and whether validation behavior follows training behavior.",
        "ROC and precision-recall curves show performance across classification thresholds.",
        "Feature importance shows how much validation error rises when a feature is shuffled.",
        "Error analysis shows both stable cases and abrupt failures.",
    ], "The figures are saved experiment outputs. Recent local net flow is the strongest signal in this run. Stable flow is easier to predict; abrupt changes and class-boundary changes are harder.")
    add_slide_section(doc, 11, "Saved results: feature interpretation and error analysis", "Explain what the model learned and where it fails.", [
        "Feature importance shows how much validation MAE increases when one feature is shuffled.",
        "Recent local net flow is the strongest saved signal; network centrality and residual features contribute less in this run.",
        "The error distribution shows many smaller errors and a long tail of difficult cases.",
        "These results explain model behavior; they do not prove causal relationships.",
    ], "The model is mainly using recent local flow to make its next-hour estimate. Sudden changes and unusual operating conditions create the larger errors.")
    add_slide_section(doc, 12, "Complete workflow, novelty, and limits", "Close the presentation with one honest end-to-end explanation.", [
        "CSV files feed the Python preprocessing and feature-engineering pipeline.",
        "The pipeline saves processed artifacts, model results, and figures for reproducibility.",
        "Backend services provide snapshots, forecasts, metrics, loss estimates, and route plans.",
        "The frontend presents the graph, replay animation, charts, and what-if routing result.",
        "The novelty is the auditable integration of data quality, graph features, model comparison, proxy physics, and route guardrails.",
        "The project still needs verified ratings, N-1 security analysis, calibrated uncertainty, and a real telemetry adapter before operational use.",
    ], "Prediction estimates what may happen. Routing suggests what should be investigated. Engineering validation decides whether any action is safe. We should not claim a brand-new neural architecture.")
    add_heading(doc, "How to explain the original figures", level=1)
    add_table(doc, ["Figure", "Meaning", "Safe conclusion"], [
        ["model_comparison.png", "RMSE and F1 across baselines and trained models", "Fusion GRU has the strongest saved trained RMSE; Persistence remains the operational selection artifact."],
        ["training_curves.png", "Fusion GRU learning and validation behavior", "Check the training-validation relationship, not only the final training value."],
        ["dcrnn_training_curves.png", "DCRNN loss and macro-F1 over epochs", "Graph training is measurable, but graph context did not win this run."],
        ["roc_pr_curves.png", "Threshold behavior for stress classes", "Useful for understanding false alarms and missed stress."],
        ["feature_importance.png", "Validation MAE increase after shuffling features", "Recent local flow dominates the saved model’s predictive signal."],
        ["tsne_projection.png", "Two-dimensional view of learned hidden states", "Similar learned states may group, but this does not prove causality."],
        ["error_distribution.png", "Distribution of prediction errors", "Large or asymmetric errors identify conditions needing more data or a stronger model."],
    ], widths=[1.65, 2.2, 2.55])
    add_heading(doc, "Questions you should be ready for", level=1)
    add_bullets(doc, [
        "Why include DCRNN if it did not win? A fair negative or weaker result is still evidence about this dataset and protocol.",
        "What is novel? Transparent integration and evidence-driven model selection, not an unsupported new architecture.",
        "Can DCRNN control the grid? No. It forecasts flow; it does not authorize switching or dispatch.",
        "What would make this deployable? Verified physical parameters, live telemetry, N-1 validation, calibrated uncertainty, and operator approval.",
    ])
    add_heading(doc, "Final answer to remember", level=1)
    add_para(doc, "GridPulse turns raw hourly records into a graph, creates a 24-hour model window, predicts next-hour net flow, classifies stress, estimates proxy loss, and tests whether an alternate path could reduce pressure. It is a transparent decision-support prototype with clear engineering limitations.")
    save(doc, "Person_3_DCRNN_Evidence_and_Conclusion.docx")


make_person1()
make_person2()
make_person3()
print("Created three speaker study documents")
