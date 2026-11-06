from pathlib import Path
import json
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(r"C:\Users\Krishna Karthik\Desktop\predictive-proj")
OUT = ROOT / "docs" / "GridPulse_30_Minute_Study_Notes.docx"
FIGURE = ROOT / ".codex-ppt-build" / "slide-35.png"


def load_json(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


profile = load_json("results/dataset_profile.json")
prep = load_json("results/preprocessing_summary.json")
comparison = load_json("results/model_comparison.json")
features = load_json("results/feature_catalog.json")
importance = load_json("results/feature_importance.json")
fusion_cm = load_json("results/fusion_gru_confusion_matrix.json")
errors = load_json("results/error_analysis.json")


def rgb(hex_value):
    return RGBColor.from_string(hex_value.replace("#", ""))


NAVY = "173746"
TEAL = "168FA6"
GREEN = "1C9A72"
CORAL = "D85A61"
AMBER = "C98A21"
PURPLE = "6C63B5"
TEXT = "334E5B"
MUTED = "6F818C"
LIGHT_BLUE = "EAF3F6"
LIGHT_GRAY = "F4F7F8"
GRID = "D6E0E4"
WHITE = "FFFFFF"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=90, start=110, bottom=90, end=110):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color=GRID, size="6"):
    tbl = table._tbl
    tbl_pr = tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_cell_text(cell, text, bold=False, color=TEXT, size=9.4, align=None):
    cell.text = ""
    p = cell.paragraphs[0]
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(str(text))
    run.font.name = "Aptos"
    run.font.size = Pt(size)
    run.font.color.rgb = rgb(color)
    run.bold = bold
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell)


def repeat_header_row(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def remove_paragraph_borders(paragraph):
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = p_pr.find(qn("w:pBdr"))
    if p_bdr is None:
        p_bdr = OxmlElement("w:pBdr")
        p_pr.append(p_bdr)
    for edge in ("top", "left", "bottom", "right", "between"):
        node = p_bdr.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            p_bdr.append(node)
        node.set(qn("w:val"), "nil")


def add_table(doc, headers, rows, widths=None, header_fill=TEAL, font_size=9.4):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    set_table_borders(table)
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        set_cell_text(cell, header, bold=True, color=WHITE, size=font_size, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_shading(cell, header_fill)
    repeat_header_row(table.rows[0])
    for r_index, row in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(row):
            align = WD_ALIGN_PARAGRAPH.CENTER if i == 0 and len(row) > 2 else WD_ALIGN_PARAGRAPH.LEFT
            set_cell_text(cells[i], value, color=TEXT, size=font_size, align=align)
            set_cell_shading(cells[i], WHITE if r_index % 2 == 0 else LIGHT_GRAY)
    if widths:
        for row in table.rows:
            for cell, width in zip(row.cells, widths):
                cell.width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


def add_run_text(paragraph, text, bold=False, italic=False, color=TEXT, size=10.5, font="Aptos"):
    run = paragraph.add_run(text)
    run.font.name = font
    run.font.size = Pt(size)
    run.font.color.rgb = rgb(color)
    run.bold = bold
    run.italic = italic
    return run


def add_body(doc, text, bold_lead=None):
    p = doc.add_paragraph()
    p.style = doc.styles["Normal"]
    if bold_lead and text.startswith(bold_lead):
        add_run_text(p, bold_lead, bold=True, color=NAVY)
        add_run_text(p, text[len(bold_lead):])
    else:
        add_run_text(p, text)
    return p


def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
    p.paragraph_format.left_indent = Inches(0.25 + level * 0.22)
    p.paragraph_format.first_line_indent = Inches(-0.15)
    add_run_text(p, text)
    return p


def add_number(doc, text, number=None):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.25)
    p.paragraph_format.first_line_indent = Inches(-0.18)
    if number is not None:
        add_run_text(p, f"{number}.  ", bold=True, color=NAVY)
    add_run_text(p, text)
    return p


def add_section(doc, title, time_label=None):
    p = doc.add_paragraph(style="Heading 1")
    p.paragraph_format.keep_with_next = True
    add_run_text(p, title, bold=True, color="000000", size=17)
    if time_label:
        add_run_text(p, f"  ({time_label})", italic=True, color=MUTED, size=10)
    return p


def add_subsection(doc, title):
    p = doc.add_paragraph(style="Heading 2")
    p.paragraph_format.keep_with_next = True
    add_run_text(p, title, bold=True, color="000000", size=12.5)
    return p


def add_equation(doc, text, explanation=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    run.font.name = "Cambria Math"
    run.font.size = Pt(13)
    run.font.color.rgb = rgb(NAVY)
    if explanation:
        q = doc.add_paragraph()
        q.alignment = WD_ALIGN_PARAGRAPH.CENTER
        q.paragraph_format.space_after = Pt(6)
        add_run_text(q, explanation, italic=True, color=MUTED, size=9.2)


def add_figure(doc, path, caption, width=6.75):
    if not path.exists():
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(str(path), width=Inches(width))
    inline = run._r.xpath(".//wp:inline")[0]
    docPr = inline.find(qn("wp:docPr"))
    if docPr is not None:
        docPr.set("descr", caption)
    c = doc.add_paragraph()
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run_text(c, caption, italic=True, color=MUTED, size=9)


def add_page_number(paragraph):
    run = paragraph.add_run()
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def add_source_line(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(6)
    add_run_text(p, f"Source in project: {text}", italic=True, color=MUTED, size=8.5)


doc = Document()
section = doc.sections[0]
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(0.65)
section.bottom_margin = Inches(0.6)
section.left_margin = Inches(0.7)
section.right_margin = Inches(0.7)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Aptos"
normal.font.size = Pt(10.5)
normal.font.color.rgb = rgb(TEXT)
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.line_spacing = 1.08
for style_name, size in (("Heading 1", 17), ("Heading 2", 12.5), ("Title", 28)):
    style = styles[style_name]
    style.font.name = "Aptos Display" if style_name in ("Title", "Heading 1") else "Aptos"
    style.font.size = Pt(size)
    style.font.color.rgb = rgb("000000")
    style.font.bold = True
    style.paragraph_format.space_before = Pt(10 if style_name == "Heading 1" else 6)
    style.paragraph_format.space_after = Pt(5)
    style.paragraph_format.keep_with_next = True

header = section.header.paragraphs[0]
header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
add_run_text(header, "GRIDPULSE  |  30 MINUTE STUDY NOTES", bold=True, color=MUTED, size=8.5)
footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_run_text(footer, "Predictive Analytics course project  |  Page ", color=MUTED, size=8.5)
add_page_number(footer)

# Cover and study map
title = doc.add_paragraph(style="Title")
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.paragraph_format.space_before = Pt(64)
title.paragraph_format.space_after = Pt(10)
remove_paragraph_borders(title)
add_run_text(title, "GridPulse Project Study Notes", bold=True, color="000000", size=28, font="Aptos Display")
subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_run_text(subtitle, "A beginner guide to predictive and prescriptive analytics for cross-border power grids", color=TEAL, size=14)
meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
meta.paragraph_format.space_before = Pt(12)
add_run_text(meta, "Designed to be studied in approximately 30 minutes", italic=True, color=MUTED, size=10.5)

add_body(doc, "This guide explains the complete project in plain language. You do not need prior knowledge of artificial intelligence, machine learning, power systems, or predictive analytics. By the end, you should be able to explain what the project receives, what it calculates, how it makes a forecast, how it detects stress, how it proposes a reroute, and how the models are evaluated.")

add_subsection(doc, "The one sentence answer")
add_body(doc, "GridPulse reads hourly electricity loads and cross-border flows, turns them into a clean network time series, predicts the next hour's flow for each country, labels possible stress, and ranks a safer alternate route using data quality, headroom, distance, and estimated loss.")

add_subsection(doc, "Thirty minute reading plan")
add_table(doc, ["Minutes", "Read this section", "What you should know afterwards"], [
    ["0-3", "The problem in plain language", "What a node, link, load, flow, and stress mean"],
    ["3-7", "The data", "Why there are two CSV files and what they contain"],
    ["7-12", "End-to-end workflow", "How raw files become a model input"],
    ["12-16", "Feature extraction", "Why 11 features are created"],
    ["16-22", "Models and training", "How baselines, Fusion GRU, and DCRNN learn"],
    ["22-26", "Risk, rerouting, and loss", "How a prediction becomes a recommendation"],
    ["26-29", "Results and evaluation", "What the metrics really say"],
    ["29-30", "Recap and viva questions", "How to explain the project confidently"],
], widths=[0.8, 2.0, 4.0], header_fill=NAVY, font_size=9.3)

add_body(doc, "Important conclusion: this is a decision-support system and a research benchmark. It does not switch equipment, dispatch generators, or claim engineering-grade line losses because the supplied data does not contain surveyed line parameters.", bold_lead="Important conclusion: ")
doc.add_page_break()

# 1
add_section(doc, "1 The problem in plain language", "3 minutes")
add_body(doc, "Electricity must be balanced every hour. If demand rises in one country, generation falls in another, or a transfer corridor becomes heavily used, the pattern of power moving between countries changes. An operator needs two answers: what is likely to happen next, and what action should be investigated before the situation becomes unsafe.")
add_subsection(doc, "The basic vocabulary")
add_table(doc, ["Term", "Plain meaning", "How GridPulse uses it"], [
    ["Node", "A country or grid area represented as a point in the network.", "The 12 countries are the nodes."],
    ["Edge or link", "A connection through which power can move between two nodes.", "The canonical graph contains 24 links."],
    ["Load", "Electricity being consumed at a time.", "Load pressure helps explain future transfers."],
    ["Flow", "Power moving from one country to another.", "The target is each country's net flow in MW."],
    ["Net flow", "A signed summary of incoming and outgoing transfer.", "The sign tells direction; magnitude tells scale."],
    ["Stress", "A screening label showing unusually large flow magnitude.", "Normal, Warning, or Critical."],
    ["Forecast", "A numerical estimate of what comes next.", "Next-hour net flow for all 12 nodes."],
    ["Recommendation", "A suggested action for a human to investigate.", "A possible alternate route with checks."],
], widths=[1.15, 3.2, 2.45], header_fill=TEAL, font_size=9.1)

add_subsection(doc, "Predictive versus prescriptive analytics")
add_body(doc, "Predictive analytics answers: What is likely to happen? In this project, the model estimates next-hour net flow. Prescriptive analytics answers: What could we do about it? In this project, the routing layer searches connected alternate paths, rejects paths with insufficient headroom or critical links, estimates the change in proxy loss, and ranks the remaining options. The recommendation is not an automatic command.")
add_body(doc, "A simple analogy is weather forecasting. Predictive analytics says there is a high chance of rain. Prescriptive analytics says carry an umbrella and avoid the flooded road. GridPulse applies the same separation to power-flow monitoring.")

# 2
add_section(doc, "2 What the data contains", "4 minutes")
add_body(doc, "The project uses two complementary files. The first describes what each country is experiencing over time. The second describes how countries are connected by interconnectors. Using both makes it possible to combine time-series behavior with network structure.")
add_table(doc, ["File", "What one row means", "Important fields", "Role"], [
    ["dynamic_with_flows.csv", "One country at one hourly timestamp", "datetime, country, load, net_flow, imbalance, residual, centrality", "Time-varying measurements and engineered signals"],
    ["power_flow.csv", "One directional transfer record at one timestamp", "datetime, interconnector, source, target, power_flow_mw", "Physical connection and transfer evidence"],
], widths=[1.7, 2.15, 2.35, 1.5], header_fill=NAVY, font_size=8.5)

add_subsection(doc, "Dataset facts from this run")
add_table(doc, ["Item", "Observed value", "Why it matters"], [
    ["Dynamic data", f"{profile['dynamic_rows']:,} rows and {profile['dynamic_column_count']} columns", "Large hourly country-level history"],
    ["Power-flow data", f"{profile['power_flow_rows']:,} rows and {profile['power_flow_column_count']} columns", "Directional interconnector records"],
    ["Network", f"{profile['node_count']} countries and {profile['edge_count']} canonical links", "The graph is small enough to audit visually"],
    ["Period", f"{profile['date_min'][:10]} to {profile['date_max'][:10]}", "Historical study window"],
    ["Aligned history", f"{profile['processed_history_points_per_country']} hourly points per country", "Common input length after alignment"],
    ["Data checks", "0 missing cells and 0 duplicate keys in both source tables", "No obvious null or duplicate-row defect"],
    ["Gaps and aliases", f"{profile['quality_checks']['country_timestamp_gap_total']} country timestamp gaps; {profile['quality_checks']['normalized_interconnector_alias_count']} aliases normalized", "Quality signals are retained, not hidden"],
], widths=[1.35, 2.55, 3.8], header_fill=TEAL, font_size=8.8)

add_subsection(doc, "Why cleaning is essential")
add_number(doc, "Parse timestamps as UTC so the same hour means the same thing in every country.", 1)
add_number(doc, "Check missing cells, duplicate keys, invalid country codes, and hourly gaps.", 2)
add_number(doc, "Canonicalize interconnector names so several labels for the same endpoint pair do not create fake edges.", 3)
add_number(doc, "Align the common recent history so every node has comparable time positions.", 4)
add_source_line(doc, "results/dataset_profile.json and results/preprocessing_summary.json")

# 3
doc.add_page_break()
add_section(doc, "3 The complete end-to-end workflow", "5 minutes")
add_body(doc, "The workflow is a chain. Each stage has one job and produces an artifact that the next stage can inspect. This is important because a prediction is only trustworthy when the path from raw data to result is understandable.")
add_figure(doc, FIGURE, "Figure 1. The project workflow from the two CSV files to the model decision.", width=6.75)
add_table(doc, ["Stage", "What happens", "Output"], [
    ["1 Observe", "Read country measurements and interconnector records.", "Raw dynamic and network tables"],
    ["2 Prepare", "Parse, validate, canonicalize, align, and scale.", "Clean hourly node and edge data"],
    ["3 Extract", "Create local, network, and static topology features.", "11 numerical features per node and hour"],
    ["4 Represent", "Build rolling sequences of the previous 24 hours.", "X window with shape 24 x 12 x 11"],
    ["5 Predict", "Fusion GRU and DCRNN estimate next-hour flows.", "12 predicted net-flow values"],
    ["6 Classify", "Compare absolute flow magnitude with training thresholds.", "Normal, Warning, or Critical"],
    ["7 Prescribe", "Check headroom, loss proxy, and alternate paths.", "Ranked recommendation for review"],
    ["8 Display", "Serve the result through API endpoints and the dashboard.", "Human-readable live replay and charts"],
], widths=[1.05, 3.85, 2.8], header_fill=PURPLE, font_size=8.9)
add_body(doc, "The browser's live view is a historical replay of the supplied timeline, not a connection to a utility control center. The API shape is ready for a future telemetry connector, but the current evidence comes from the saved dataset.")

# 4
doc.add_page_break()
add_section(doc, "4 Feature extraction in simple terms", "4 minutes")
add_body(doc, "A model cannot reason directly from a spreadsheet row in the same way a person does. Feature extraction converts raw fields into a compact set of numerical signals that describe recent behavior, system-wide context, and where each country sits in the network.")
add_table(doc, ["Feature group", "Count", "Examples", "Why it helps"], [
    ["Local time series", "4", "Local net flow, local load, local imbalance, local load residual", "Describes what is happening at that country now"],
    ["Network context", "4", "Global mean net flow, global mean load, global imbalance, global residual", "Describes shared system pressure"],
    ["Static graph", "3", "Degree, closeness, betweenness centrality", "Describes connectivity and bridge-like importance"],
    ["Total", "11", "4 + 4 + 3", "The model input feature count"],
], widths=[1.45, 0.75, 3.0, 2.15], header_fill=TEAL, font_size=8.8)

add_subsection(doc, "The most important calculations")
add_equation(doc, "local_i(t) = [flow_i(t), load_i(t), imbalance_i(t), residual_i(t)]", "A four-number summary of node i at hour t")
add_equation(doc, "global(t) = mean over all nodes of local signals", "A compact view of the wider system")
add_equation(doc, "X window = 24 hours x 12 nodes x 11 features", "The model receives one day of history for every country")
add_body(doc, "The target is the next-hour net flow vector for all 12 nodes. In other words, the model reads 24 hourly snapshots and predicts the next snapshot. The feature catalog is saved so a reviewer can see the name, source, formula, and reason for every feature.")

add_subsection(doc, "What the feature study found")
top = sorted(importance["features"], key=lambda x: x["permutation_delta_mae"], reverse=True)[:6]
rows = [[item["feature"], f"+{item['permutation_delta_mae']:.1f} MW", f"{item['ablation_delta_mae']:+.1f} MW"] for item in top]
add_table(doc, ["Feature", "Permutation MAE increase", "Ablation MAE change"], rows, widths=[3.0, 2.0, 1.8], header_fill=PURPLE, font_size=8.8)
add_body(doc, "Local net flow is the strongest signal in the permutation study: if its values are shuffled, validation error rises sharply. This is sensible because recent flow is an autoregressive anchor. Centrality features also help, but the current run does not prove that every global feature is useful; some have near-zero or negative ablation changes. That is exactly why ablation studies are included.")
add_source_line(doc, "results/feature_catalog.json and results/feature_importance.json")

# 5
add_section(doc, "5 The prediction models", "6 minutes")
add_body(doc, "The project does not trust one algorithm automatically. It compares simple baselines with two trained neural models. A baseline is a reference point: if a complicated model cannot beat a simple rule, the extra complexity is not justified for this dataset.")
add_table(doc, ["Model", "Beginner explanation", "What it tests"], [
    ["Persistence", "Predict that the next value will be the most recent value.", "Is the flow so stable that no learning is needed?"],
    ["24 hour moving average", "Average the previous 24 hours.", "Does smoothing remove noise and help?"],
    ["Seasonal naive", "Use the value from the same hour yesterday.", "Is a daily repeating pattern enough?"],
    ["Linear trend", "Fit a straight line to recent values and extend it.", "Is a simple upward or downward trend enough?"],
    ["Fusion GRU", "A gated memory network reads the 24-hour sequence plus context features.", "Can learned time patterns improve the forecast?"],
    ["DCRNN", "A recurrent model that also diffuses information across connected countries.", "Does graph neighborhood context improve the forecast?"],
], widths=[1.45, 3.65, 2.05], header_fill=NAVY, font_size=8.8)

add_subsection(doc, "How Fusion GRU works")
add_body(doc, "A GRU is a recurrent neural network with gates. Think of it as a notebook that reads one hour at a time. At each hour it decides what old information to keep, what new information to add, and what information to pass to the next hour. The final hidden state summarizes the 24-hour window, and a final layer converts that summary into 12 next-hour flow predictions.")
add_equation(doc, "hidden state at time t = GRU(current features at t, previous hidden state)", "The memory is updated one hourly snapshot at a time")

add_subsection(doc, "How DCRNN works")
add_body(doc, "DCRNN keeps the country axis instead of flattening the grid into one list. At each recurrent step, it applies two-step forward and reverse diffusion over the canonical graph. Forward diffusion asks what information can arrive along outgoing connections. Reverse diffusion asks what information can arrive from the opposite direction. The recurrent update then uses that graph-aware information.")
add_body(doc, "In this project DCRNN uses the same 24-hour lookback, training-only scaling, chronological split, and target as Fusion GRU. That makes the comparison fair. It does not solve a full power-flow equation and it does not automatically know voltage, thermal limits, or dispatch constraints.")

add_subsection(doc, "Why DCRNN can lose even though it knows the graph")
add_bullet(doc, "The graph has only 12 nodes and 24 links, so global features may already capture much of the useful shared context.")
add_bullet(doc, "The data does not contain surveyed line geometry, ratings, voltage, or dispatch constraints, so the graph is informative but incomplete.")
add_bullet(doc, "Graph diffusion adds parameters and computation. If the extra information is weak, the model can overfit or add noise.")
add_bullet(doc, "A weaker DCRNN score is still valuable evidence: it tells us not to claim that graph structure always wins.")

# 6
add_section(doc, "6 How training and validation work", "4 minutes")
add_body(doc, "Training means showing historical examples to a model and adjusting its internal weights so its predictions become closer to the observed next-hour flows. Validation is a separate time period used to monitor learning and tune choices. The final test holdout is kept for the honest end check.")
add_subsection(doc, "The leakage-safe split")
add_table(doc, ["Partition", "Samples", "Purpose"], [
    ["Training", f"{prep['train_samples_fusion_gru']:,}", "Fit model weights"],
    ["Validation", f"{prep['validation_samples_fusion_gru']:,}", "Monitor generalization and compare choices"],
    ["Test holdout", f"{prep['test_samples_fusion_gru']:,}", "Final chronological evaluation"],
], widths=[1.7, 1.2, 4.25], header_fill=TEAL, font_size=9.1)
add_body(doc, f"The model looks back {prep['sequence_length_hours']} hours and moves the window by {prep['window_stride_hours']} hours. The final test horizon is {prep['test_horizon_hours']} hours. Scaling means converting large and small fields to comparable ranges, but the mean and standard deviation are fitted only on the training window. If test information were used to scale training, the result would leak future knowledge into the past.")

add_subsection(doc, "What the training curves mean")
add_bullet(doc, "Training loss falling means the model is fitting the examples it sees.")
add_bullet(doc, "Validation loss falling with training loss means the model is learning patterns that transfer to unseen time periods.")
add_bullet(doc, "Training loss falling while validation loss rises suggests overfitting: the model memorizes the training period.")
add_bullet(doc, "Both curves staying high suggests underfitting, weak features, insufficient training, or a difficult dataset.")
add_equation(doc, "MSE = average of (actual - predicted)^2; RMSE = square root of MSE", "The squared error penalizes large mistakes more strongly")
add_equation(doc, "MAE = average of absolute(actual - predicted)", "The average error in the original MW scale")

# 7
add_section(doc, "7 How a prediction becomes a risk decision", "4 minutes")
add_body(doc, "The model produces a continuous number in megawatts. Operators also need a simple status. GridPulse converts the absolute net-flow magnitude into three screening classes using thresholds calculated from the training period, not from the future test period.")
add_table(doc, ["Class", "Rule in this run", "Meaning"], [
    ["Normal", f"absolute flow < {prep['warning_threshold_mw']:.2f} MW", "Within the usual training envelope"],
    ["Warning", f"{prep['warning_threshold_mw']:.2f} to {prep['critical_threshold_mw']:.2f} MW", "Needs attention and monitoring"],
    ["Critical", f"absolute flow >= {prep['critical_threshold_mw']:.2f} MW", "High-magnitude condition needing investigation"],
], widths=[1.3, 2.8, 3.05], header_fill=CORAL, font_size=9.0)
add_body(doc, "This is a risk screen, not a physical safety certificate. The thresholds describe unusual flow magnitude in this dataset. They do not replace official line ratings or operating rules.")

add_subsection(doc, "How to read the confusion matrix")
add_body(doc, "A confusion matrix compares the actual class with the predicted class. Rows are actual conditions; columns are predicted conditions. Values on the diagonal are correct. Off-diagonal values show exactly which mistakes occurred.")
matrix = fusion_cm["matrix"]
add_table(doc, ["Actual / Predicted", "Normal", "Warning", "Critical"], [
    ["Normal", matrix["Normal"]["Normal"], matrix["Normal"]["Warning"], matrix["Normal"]["Critical"]],
    ["Warning", matrix["Warning"]["Normal"], matrix["Warning"]["Warning"], matrix["Warning"]["Critical"]],
    ["Critical", matrix["Critical"]["Normal"], matrix["Critical"]["Warning"], matrix["Critical"]["Critical"]],
], widths=[2.2, 1.45, 1.45, 1.45], header_fill=PURPLE, font_size=9.2)
add_body(doc, "For example, Fusion GRU correctly identified 1,490 Normal cases, 260 Warning cases, and 119 Critical cases. It missed 27 Critical cases as Warning, which is more useful to inspect than a single overall accuracy number because missing a high-risk case is not the same as confusing two normal cases.")

add_subsection(doc, "The main classification metrics")
add_table(doc, ["Metric", "Plain meaning", "Formula idea"], [
    ["Accuracy", "Share of all classes predicted correctly.", "correct predictions / all predictions"],
    ["Precision", "When the model raises a class, how often is it right?", "true positives / predicted positives"],
    ["Recall", "Of the real cases in a class, how many did it find?", "true positives / actual positives"],
    ["F1", "Balance between precision and recall.", "2 x precision x recall / (precision + recall)"],
    ["ROC AUC", "How well a score separates positive and negative cases over thresholds.", "area under true-positive-rate vs false-positive-rate"],
    ["PR AUC", "How useful the score is when positive cases are less common.", "area under precision vs recall"],
], widths=[1.2, 3.25, 2.7], header_fill=TEAL, font_size=8.7)

# 8
add_section(doc, "8 How prescriptive rerouting works", "4 minutes")
add_body(doc, "The prescriptive layer starts only after a forecast or observed condition indicates stress. It does not claim to operate the grid. It creates a transparent what-if scenario for a human reviewer.")
add_subsection(doc, "The rerouting sequence")
add_number(doc, "Identify the stressed node or link and record the reason: high predicted magnitude, high utilization, imbalance, or data-quality warning.", 1)
add_number(doc, "Build candidate paths through the canonical graph. A path must be connected from the source to the target.", 2)
add_number(doc, "Reject a candidate if it contains a Critical link, lacks enough headroom, or violates a hard guardrail.", 3)
add_number(doc, "Estimate the flow moved onto the candidate path and compute before-and-after screening values.", 4)
add_number(doc, "Rank feasible candidates by a combined score involving headroom, estimated loss, risk, distance, and data quality.", 5)
add_number(doc, "Show the best available option and any bottleneck, even when every option is imperfect. The user decides what to investigate.", 6)

add_subsection(doc, "Distance and power-loss proxy")
add_body(doc, "Latitude and longitude are used to estimate the straight-line distance between country centroids. The result is intentionally labeled a proxy because the real conductor route and electrical parameters are not in the supplied data.")
add_equation(doc, "R = ρ × L / A", "Resistance estimate: resistivity × length / conductor area")
add_equation(doc, "S = |P| / power factor;  I = S / (√3 × V)", "Apparent power and three-phase current estimate")
add_equation(doc, "P_loss = 3 × I² × R", "Three-phase I-squared-R loss proxy")
add_table(doc, ["Assumption", "Value in this run", "Why it must be replaced for engineering use"], [
    ["Line voltage", "400 kV", "Actual voltage may differ by line and operating condition"],
    ["Power factor", "0.95", "Actual reactive power is not provided"],
    ["Resistivity", "1.68e-8 ohm m", "Conductor material and temperature are not provided"],
    ["Cross-sectional area", "2,000 mm2", "Actual conductor bundle is not provided"],
    ["Length", "Haversine centroid distance", "Actual route geometry is not a straight line"],
], widths=[1.55, 2.3, 3.3], header_fill=AMBER, font_size=8.7)
add_body(doc, "The project deliberately separates a useful scenario estimate from an engineering-grade calculation. A future version would require surveyed route length, conductor configuration, resistance at temperature, voltage, power factor, thermal ratings, and validation against a power-flow solver.")

# 9
add_section(doc, "9 Results and what they mean", "4 minutes")
add_body(doc, "The final comparison uses a common chronological holdout. RMSE and MAE measure continuous flow error in MW. Accuracy, precision, recall, and F1 measure the three risk classes. Inference time shows the cost of producing one prediction in the recorded experiment environment.")
model_rows = []
for item in comparison["models"]:
    model_rows.append([
        item["label"],
        f"{item['rmse']:.1f}",
        f"{item['mae']:.1f}",
        f"{item['accuracy']*100:.1f}%",
        f"{item['f1']:.3f}",
        f"{item['inference_time_ms']:.2f}",
    ])
add_table(doc, ["Model", "RMSE MW", "MAE MW", "Accuracy", "F1", "Time ms"], model_rows, widths=[1.65, 1.0, 0.95, 1.0, 0.75, 0.85], header_fill=NAVY, font_size=8.5)
add_body(doc, "Research selection rule: the saved experiment chooses the lowest pooled RMSE on the common chronological holdout. Under that rule, Fusion GRU wins with RMSE 570.5 MW. Persistence remains the operational baseline because it is extremely fast and easy to audit, and it has lower MAE in this run. The two statements can both be true: one model is the best research forecast by RMSE, while a simpler rule remains attractive for operations.")
add_body(doc, "DCRNN records RMSE 634.0 MW and F1 0.838, below Fusion GRU on this dataset. The result is not a failure of the idea; it is a boundary finding. The graph model was implemented and measured under the same protocol, but the available features and small topology do not provide enough evidence that diffusion improves the forecast here.")

add_subsection(doc, "Error analysis: what worked and what failed")
success = errors["successes"][0]
failure = errors["failures"][0]
add_table(doc, ["Case", "Observed", "Predicted", "Interpretation"], [
    ["Success", f"{success['country']} at {success['timestamp'][:16]}: {success['actual_net_flow_mw']:.1f} MW", f"{success['predicted_net_flow_mw']:.1f} MW", "The model preserved the Warning class with almost no numerical error."],
    ["Failure", f"{failure['country']} at {failure['timestamp'][:16]}: {failure['actual_net_flow_mw']:.1f} MW", f"{failure['predicted_net_flow_mw']:.1f} MW", "The sudden Critical jump was underestimated as Warning; this is an important edge case."],
], widths=[0.9, 2.15, 1.65, 2.55], header_fill=CORAL, font_size=8.5)
add_body(doc, "The right response to a failure is not to hide it. A reviewer should ask whether the event was caused by a sudden market change, missing external variables, a data gap, or a physical constraint absent from the dataset. Error analysis turns a score into a research question.")

add_subsection(doc, "The nine most useful result visuals")
add_bullet(doc, "Dataset profile chart: shows the scale and shape of the source data.")
add_bullet(doc, "Preprocessing and feature catalog: shows what was cleaned and what was extracted.")
add_bullet(doc, "Training versus validation curves: checks learning, overfitting, and underfitting.")
add_bullet(doc, "Confusion matrix: shows which risk classes are confused.")
add_bullet(doc, "ROC and precision-recall curves: show threshold behavior, especially for rare Critical cases.")
add_bullet(doc, "Model comparison bars: compare RMSE, F1, accuracy, and inference time.")
add_bullet(doc, "Feature permutation and ablation chart: shows which inputs affect validation error.")
add_bullet(doc, "t-SNE embedding plot: shows whether hidden representations organize risk classes.")
add_bullet(doc, "Error-analysis examples: show concrete successes and failures instead of only averages.")

# 10
add_section(doc, "10 How the software is integrated", "2 minutes")
add_body(doc, "The project is organized as a small local application. The experiment runner creates evidence files, the backend exposes those files and operational calculations through API routes, and the browser renders an animated historical replay with charts and recommendations.")
add_table(doc, ["Layer", "Technology", "Use"], [
    ["Data and experiments", "Python, pandas, NumPy", "Read CSVs, align data, create features and artifacts"],
    ["Machine learning", "PyTorch", "Train Fusion GRU and DCRNN checkpoints"],
    ["Metrics and analysis", "scikit-learn", "Metrics, confusion matrices, ROC/PR, t-SNE"],
    ["Figures", "Matplotlib", "Save light-background review figures"],
    ["Backend", "Python standard library HTTP server", "Serve REST endpoints and the historical stream"],
    ["Frontend", "HTML, CSS, JavaScript", "Animate the grid, charts, route plans, and explanations"],
    ["Artifacts", "JSON, CSV, PNG, PT checkpoints", "Keep results inspectable and reproducible"],
], widths=[1.45, 2.35, 3.45], header_fill=TEAL, font_size=8.8)
add_body(doc, "The current frontend is intentionally lightweight HTML, CSS, and JavaScript rather than React. It keeps the project easy to run locally and makes the data flow visible. The backend exposes health, metadata, topology, snapshot, forecast, metrics, validation, physical-loss, route-plan, recommendations, what-if, and stream endpoints.")
add_body(doc, "The live-looking values change because the browser advances through stored hourly observations and calls the backend for derived risk, forecast, loss, and routing information. It is a replay designed for demonstration, not live utility telemetry.")

# 11
add_section(doc, "11 What is novel, and what are the limitations", "2 minutes")
add_subsection(doc, "The practical novelty")
add_body(doc, "The novelty is the integration and auditability of the workflow, not a claim of a brand-new neural layer. The project combines a canonical edge audit, data-quality-aware risk, evidence-driven model selection, explicit separation of proxy calculations from engineering facts, distance-to-loss bridging, stress-aware path search, and an explainable action queue.")
add_bullet(doc, "The model router does not assume DCRNN must win; it selects from evidence.")
add_bullet(doc, "The interface shows assumptions and failure modes instead of only showing a score.")
add_bullet(doc, "The rerouting mechanism exposes bottlenecks and infeasibility rather than hiding them.")
add_bullet(doc, "Every important result is saved under results/ before the presentation or notes are built.")

add_subsection(doc, "Limitations to say openly")
add_bullet(doc, "The data is historical and the dashboard is a replay, not a live utility connector.")
add_bullet(doc, "The line-loss calculation is a distance-based three-phase proxy, not engineering-grade power-flow analysis.")
add_bullet(doc, "The dataset lacks actual line ratings, voltage, conductor details, reactive power, dispatch constraints, weather shocks, and market information.")
add_bullet(doc, "The stress labels are quantile-based screening labels, not official operating limits.")
add_bullet(doc, "Recommendations are for investigation and planning; they do not authorize switching or dispatch.")
add_bullet(doc, "Generalization requires testing on a documented benchmark or new time period and validating physical parameters.")

# 12
add_section(doc, "12 One minute recap and viva questions", "2 minutes")
add_subsection(doc, "Remember these eight points")
for text in [
    "The project studies hourly cross-border power transfers across 12 countries and 24 canonical links.",
    "The dynamic CSV describes country conditions; the power-flow CSV describes interconnector movement.",
    "Preprocessing parses, validates, canonicalizes, aligns, scales, and splits the data chronologically.",
    "Feature extraction creates 11 signals: 4 local, 4 global, and 3 topology features.",
    "A 24-hour window becomes a 24 x 12 x 11 model input and the target is the next-hour 12-node flow vector.",
    "Fusion GRU and DCRNN are compared with simple baselines, so complexity must earn its place.",
    "The forecast becomes Normal, Warning, or Critical using training-only flow-magnitude thresholds.",
    "Rerouting is a guarded what-if recommendation based on headroom, risk, distance, proxy loss, and data quality.",
]:
    add_bullet(doc, text)

add_subsection(doc, "Likely questions and short answers")
qa = [
    ["Why not use only accuracy?", "Because accuracy can hide Critical-class mistakes. RMSE, MAE, precision, recall, F1, confusion matrices, and error examples give a fuller view."],
    ["Why is Fusion GRU the winner if Persistence is simpler?", "Fusion GRU has the lowest RMSE in this run, but Persistence is faster, easier to audit, and has lower MAE. The right choice depends on the operational objective."],
    ["Why did DCRNN lag?", "The graph is small and the available data lacks physical constraints and richer spatial signals. Graph context was tested rather than assumed to help."],
    ["Is the loss value real?", "It is a distance-based scenario proxy using stated assumptions. Engineering-grade loss needs surveyed line and electrical parameters."],
    ["Does rerouting operate the grid?", "No. It screens alternate paths and produces a human-review recommendation with guardrails."],
    ["Where are the reproducible results?", "Under results/: dataset profile, preprocessing summary, feature catalog, model comparison, curves, confusion matrices, ROC/PR, embeddings, importance, errors, figures, and checkpoints."],
]
add_table(doc, ["Question", "Answer"], qa, widths=[2.1, 5.15], header_fill=NAVY, font_size=8.8)

add_subsection(doc, "Where to look next in the project")
add_table(doc, ["Need to understand", "Open this"], [
    ["Project purpose and run commands", "README.md"],
    ["Data and pipeline design", "docs/SRS.md and backend/pipeline.py"],
    ["Research gap and novelty", "docs/RESEARCH_NOTES.md"],
    ["Experiment implementation", "backend/experiments.py"],
    ["Dashboard behavior", "docs/USER_MANUAL.md and frontend/app.js"],
    ["Saved evidence", "results/"],
], widths=[2.75, 4.5], header_fill=TEAL, font_size=9.0)

add_source_line(doc, "This guide is grounded in the generated results/ artifacts, the project README, the research notes, and the implemented pipeline and experiment code.")

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(OUT)
