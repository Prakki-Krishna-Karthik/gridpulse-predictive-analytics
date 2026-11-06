from __future__ import annotations

import json
import math
from hashlib import sha256
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "results"
FIGURES = RESULTS / "figures"
OUT_DIR = ROOT / "report_output"
OUT_DIR.mkdir(exist_ok=True)
OUT_DOCX = OUT_DIR / "GridPulse_Project_Report_40_Pages.docx"
LOGO = OUT_DIR / "vit_logo.jpg"
EQUATIONS_DIR = OUT_DIR / "equations"


def load_json(name: str) -> dict:
    return json.loads((RESULTS / name).read_text(encoding="utf-8"))


profile = load_json("dataset_profile.json")
preprocess = load_json("preprocessing_summary.json")
comparison = load_json("model_comparison.json")
feature_catalog = load_json("feature_catalog.json")
feature_importance = load_json("feature_importance.json")
errors = load_json("error_analysis.json")
confusion = load_json("confusion_matrix.json")
fusion_analysis = load_json("fusion_gru_analysis.json")
dcrnn_analysis = load_json("dcrnn_analysis.json")
run_meta = load_json("run_metadata.json")


NAVY = "000000"
BLUE = "000000"
TEAL = "000000"
LIGHT_BLUE = "EAF2F6"
LIGHT_GRAY = "F3F5F7"
MID_GRAY = "D9E0E5"
DARK_GRAY = "000000"
PAGE_BREAK_COUNT = 0


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_borders(cell, color: str = "000000", sz: str = "6") -> None:
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
        element.set(qn("w:sz"), sz)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_cell_margin(cell, top=100, start=120, bottom=100, end=120) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for side, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn("w:" + side))
        if node is None:
            node = OxmlElement("w:" + side)
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_run_font(run, name="Times New Roman", size=10.5, bold=False, italic=False, color="000000") -> None:
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)


def set_para(paragraph, align=None, before=0, after=6, line=1.08, keep=False) -> None:
    if align is not None:
        paragraph.alignment = align
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line
    fmt.keep_with_next = keep


def add_field(paragraph, instruction: str) -> None:
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " " + instruction + " "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run = OxmlElement("w:r")
    run.append(begin)
    run.append(instr)
    run.append(separate)
    run.append(text)
    run.append(end)
    paragraph._p.append(run)


def add_toc_field(doc: Document) -> None:
    p = doc.add_paragraph()
    set_para(p, after=0)
    add_field(p, 'TOC \\o "1-3" \\h \\z \\u')
    settings = doc.settings._element
    update = settings.find(qn("w:updateFields"))
    if update is None:
        update = OxmlElement("w:updateFields")
        settings.append(update)
    update.set(qn("w:val"), "true")


def add_page_number_footer(section) -> None:
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_para(p, after=0, line=1.0)
    r = p.add_run("")
    set_run_font(r, size=10, color="000000")
    add_field(p, "PAGE")


def add_header(section) -> None:
    header = section.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_para(p, after=0, line=1.0)
    r = p.add_run("Graph Based Predictive and Prescriptive Analytics")
    set_run_font(r, size=8.5, color="667784")


def add_para(doc, text: str, bold_lead: str | None = None, italic=False, after=6, align=None) -> None:
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.JUSTIFY if align is None else align, after=after)
    if bold_lead and text.startswith(bold_lead):
        r = p.add_run(bold_lead)
        set_run_font(r, bold=True, color=NAVY)
        r2 = p.add_run(text[len(bold_lead):])
        set_run_font(r2, italic=italic)
    else:
        r = p.add_run(text)
        set_run_font(r, italic=italic)
    return p


def add_bullets(doc, items: list[str], level=0, after=2) -> None:
    for item in items:
        p = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
        set_para(p, after=after, line=1.04)
        r = p.add_run(item)
        set_run_font(r, size=10.1)


def add_numbered(doc, items: list[str], after=2) -> None:
    # Use explicit numbering so independent lists always restart at 1.
    # Word's built-in List Number style can continue numbering from a
    # previous list elsewhere in the document.
    for idx, item in enumerate(items, start=1):
        p = doc.add_paragraph()
        set_para(p, after=after, line=1.04)
        p.paragraph_format.left_indent = Inches(0.24)
        p.paragraph_format.first_line_indent = Inches(-0.18)
        r = p.add_run(f"{idx}. ")
        set_run_font(r, size=10.1)
        r2 = p.add_run(item)
        set_run_font(r2, size=10.1)


def add_heading(doc, text: str, level=1, page_break=False) -> None:
    if page_break:
        doc.add_page_break()
    # Academic reports conventionally begin each main chapter on a fresh page.
    # Keep subsection headings flowing naturally so the document does not gain
    # artificial blank pages between short sections.
    if level == 1 and text.lower().startswith("chapter "):
        doc.add_page_break()
    display = text.upper() if level == 1 else text
    p = doc.add_heading(display, level=level)
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER if level == 1 else WD_ALIGN_PARAGRAPH.LEFT, before=8 if level == 1 else 4, after=6, line=1.0, keep=True)
    for run in p.runs:
        set_run_font(run, name="Times New Roman", size=15 if level == 1 else 12, bold=True, color="000000")


def add_table(doc, headers: list[str], rows: list[list[str]], widths: list[float] | None = None, font_size=8.8) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    # Keep the header attached to the first body row and repeat it when a
    # table continues onto another page. This prevents orphaned table headers
    # at the bottom of a page and keeps split tables readable in the PDF.
    header_row = table.rows[0]
    header_pr = header_row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    header_pr.append(tbl_header)
    hdr = table.rows[0].cells
    for idx, header in enumerate(headers):
        hdr[idx].text = header
        set_cell_shading(hdr[idx], NAVY)
        set_cell_borders(hdr[idx])
        set_cell_margin(hdr[idx])
        hdr[idx].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        for p in hdr[idx].paragraphs:
            set_para(p, after=0, line=1.0, keep=True)
            for run in p.runs:
                set_run_font(run, size=font_size, bold=True, color="FFFFFF")
    for ridx, row in enumerate(rows):
        cells = table.add_row().cells
        row_pr = table.rows[-1]._tr.get_or_add_trPr()
        row_pr.append(OxmlElement("w:cantSplit"))
        for cidx, value in enumerate(row):
            cells[cidx].text = str(value)
            # Keep body rows monochrome to match the supplied academic template.
            set_cell_shading(cells[cidx], "FFFFFF")
            set_cell_borders(cells[cidx])
            set_cell_margin(cells[cidx])
            cells[cidx].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for p in cells[cidx].paragraphs:
                set_para(p, after=0, line=1.0)
                p.paragraph_format.keep_together = True
                for run in p.runs:
                    set_run_font(run, size=font_size)
    if widths:
        for row in table.rows:
            for idx, width in enumerate(widths):
                row.cells[idx].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def add_caption(doc, text: str) -> None:
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=2, after=8, line=1.0)
    r = p.add_run(text)
    set_run_font(r, size=9, italic=True, color=DARK_GRAY)


def add_figure(doc, filename: str, caption: str, width=6.25) -> None:
    path = FIGURES / filename
    if path.exists():
        p = doc.add_paragraph()
        set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=4, after=2, line=1.0)
        run = p.add_run()
        run.add_picture(str(path), width=Inches(width))
        add_caption(doc, caption)
    else:
        add_para(doc, f"Figure unavailable: {filename}", italic=True)


def latex_to_linear_math(latex: str) -> str:
    """Convert the small LaTeX subset used in this report to readable math text.

    The resulting text is placed inside a native Word math run, so the equation
    remains an equation object and exports reliably to PDF even without a TeX
    compiler in the runtime.
    """
    import re

    text = latex
    replacements = {
        r"\hat{y}": "ŷ", r"\tilde{h}": "h̃",
        r"\mathrm{": "", r"\text{": "", r"\right": "", r"\left": "",
        r"\quad": "   ", r"\,": " ", r"\ldots": "…", r"\Vert": "∥",
        r"\odot": "⊙", r"\times": "×", r"\cdot": "·", r"\pm": "±",
        r"\le": "≤", r"\ge": "≥", r"\rho": "ρ", r"\phi": "φ",
        r"\Delta": "Δ", r"\lambda": "λ", r"\theta": "θ", r"\sigma": "σ",
        r"\tanh": "tanh", r"\sin": "sin", r"\cos": "cos", r"\arcsin": "arcsin",
        r"\sum": "Σ", r"\sqrt": "√",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)

    # Remove simple formatting groups while retaining their contents.
    text = re.sub(r"\\[a-zA-Z]+", "", text)
    text = re.sub(r"\{([^{}]*)\}", r"\1", text)
    text = text.replace("^", "^ ").replace("_", "_ ")
    text = text.replace("/", " / ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def add_equation(doc, latex: str, label: str | None = None) -> None:
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=3, after=2, line=1.0)
    equation_file = EQUATIONS_DIR / (sha256(latex.encode("utf-8")).hexdigest()[:16] + ".png")
    if equation_file.exists():
        # Keep equations prominent but compact enough that the surrounding
        # explanation remains the visual focus of the report.
        if len(latex) > 100:
            width = 4.2
        elif len(latex) > 70:
            width = 3.8
        elif len(latex) > 40:
            width = 3.3
        else:
            width = 2.5
        p.add_run().add_picture(str(equation_file), width=Inches(width))
    else:
        # Fallback for a clean build before equation assets are generated.
        omath = OxmlElement("m:oMath")
        mr = OxmlElement("m:r")
        mt = OxmlElement("m:t")
        mt.text = latex_to_linear_math(latex)
        mr.append(mt)
        omath.append(mr)
        p._p.append(omath)
    if label:
        p2 = doc.add_paragraph()
        set_para(p2, align=WD_ALIGN_PARAGRAPH.CENTER, after=6, line=1.0)
        r2 = p2.add_run(label)
        set_run_font(r2, size=8.8, italic=True, color=DARK_GRAY)


def add_callout_paragraph(doc, lead: str, text: str) -> None:
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.JUSTIFY, before=2, after=6, line=1.05)
    r = p.add_run(lead + " ")
    set_run_font(r, bold=True, color=TEAL)
    r2 = p.add_run(text)
    set_run_font(r2)


def page_break(doc, force=False):
    global PAGE_BREAK_COUNT
    PAGE_BREAK_COUNT += 1
    # Keep front matter and the references boundary on separate pages. Let the
    # chapters flow naturally so short sections do not create large blank gaps.
    if force or PAGE_BREAK_COUNT <= 5:
        doc.add_page_break()


def setup_document() -> Document:
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.50)
    section.page_height = Inches(11.00)
    section.top_margin = Inches(0.96)
    section.bottom_margin = Inches(0.45)
    section.left_margin = Inches(0.68)
    section.right_margin = Inches(0.69)
    add_page_number_footer(section)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Times New Roman"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
    normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.0
    for name, size, color in (("Title", 20, NAVY), ("Heading 1", 15, NAVY), ("Heading 2", 12, BLUE), ("Heading 3", 11, TEAL)):
        style = styles[name]
        style.font.name = "Times New Roman"
        style._element.rPr.rFonts.set(qn("w:ascii"), style.font.name)
        style._element.rPr.rFonts.set(qn("w:hAnsi"), style.font.name)
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
    return doc


def page_title(doc, label: str, subtitle: str | None = None):
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=8, after=12, line=1.0)
    r = p.add_run(label.upper())
    set_run_font(r, name="Times New Roman", size=14, bold=True, color="000000")
    if subtitle:
        p2 = doc.add_paragraph()
        set_para(p2, align=WD_ALIGN_PARAGRAPH.CENTER, after=10, line=1.0)
        r2 = p2.add_run(subtitle)
        set_run_font(r2, name="Times New Roman", size=12, color="000000")


def build_report() -> None:
    doc = setup_document()

    # Page 1 title page in the supplied academic template style
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=35, after=8, line=1.0)
    r = p.add_run("A project report on")
    set_run_font(r, name="Times New Roman", size=12, italic=True)
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, after=12, line=1.0)
    r = p.add_run("GRAPH BASED PREDICTIVE AND PRESCRIPTIVE ANALYTICS FOR CROSS BORDER POWER GRID NETWORKS")
    set_run_font(r, name="Times New Roman", size=20, bold=True)
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, after=10, line=1.0)
    r = p.add_run("Submitted as part of the Predictive Analytics course")
    set_run_font(r, name="Times New Roman", size=14, italic=True)
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, after=10, line=1.0)
    r = p.add_run("Bachelor of Technology in Computer Science and Engineering")
    set_run_font(r, name="Times New Roman", size=22, bold=True)
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=28, after=8, line=1.0)
    r = p.add_run("by")
    set_run_font(r, name="Times New Roman", size=14, italic=True)
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, after=3, line=1.0)
    r = p.add_run("Prakki Krishna Karthik (23BCE1294)\nVasudev (23BCE1496)\nShubham Bhuyan (23BCE1809)")
    set_run_font(r, name="Times New Roman", size=16, bold=True)
    if LOGO.exists():
        p = doc.add_paragraph()
        set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=18, after=8, line=1.0)
        p.add_run().add_picture(str(LOGO), width=Inches(2.6))
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=8, after=3, line=1.0)
    r = p.add_run("SCHOOL OF COMPUTER SCIENCE AND ENGINEERING")
    set_run_font(r, name="Times New Roman", size=16, bold=True)
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, after=3, line=1.0)
    r = p.add_run("Faculty: Pattabiraman V")
    set_run_font(r, name="Times New Roman", size=12, bold=True)
    p = doc.add_paragraph()
    set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER, after=0, line=1.0)
    r = p.add_run("October 2026")
    set_run_font(r, name="Times New Roman", size=12)
    page_break(doc)

    # Page 2 acknowledgement
    page_title(doc, "Acknowledgement")
    add_para(doc, "We express our sincere gratitude to Pattabiraman V, faculty for the Predictive Analytics course, for the guidance and evaluation framework that shaped this project. The course topics on preprocessing, model comparison, time-series forecasting, classification metrics, class imbalance, and decision support were used to design the complete workflow.")
    add_para(doc, "We thank the project data providers represented by the supplied dynamic_with_flows.csv and power_flow.csv files. These files allowed us to construct a country-interconnector graph, replay historical hourly observations, compare forecasting models, and study the relationship between prediction and recommended action.")
    add_para(doc, "We also acknowledge the research community whose work on gated recurrent units, diffusion convolutional recurrent neural networks, graph time-series forecasting, and power-system graph learning informed the design. The report distinguishes ideas adopted from prior work from the applied integration implemented in GridPulse.")
    add_para(doc, "Finally, we acknowledge the importance of stating limitations clearly. The project is a research and course prototype. It does not replace a power-flow solver, protection study, N-1 security analysis, or the decisions of a qualified grid operator.")
    page_break(doc)

    # Page 4 abstract
    page_title(doc, "Abstract")
    add_para(doc, "Cross-border power grids are naturally represented as networks: countries or grid areas form nodes, while interconnectors form edges over which power moves. This project develops GridPulse, an explainable predictive and prescriptive analytics prototype that uses two supplied datasets to forecast next-hour country net flow, classify stress, estimate a transparent distance-based loss proxy, and test whether a stressed connection has a lower-risk alternate route.")
    add_para(doc, "The pipeline processes 315,598 dynamic country records and 1,262,592 directional power-flow records covering 12 countries and 24 canonical links from 2022 to 2024. It validates missing values, duplicates, aliases, and timestamp gaps; creates a common hourly history; builds local, global, and graph features; and evaluates models using chronological holdout data. The saved comparison reports Persistence RMSE of 580.3 MW, Fusion GRU RMSE of 570.5 MW, and DCRNN RMSE of 634.0 MW. Fusion GRU is the research winner by RMSE, while the operational dashboard keeps Persistence as the selected baseline because its production artifact uses the lowest pooled chronological RMSE and is simpler to audit.")
    add_para(doc, "The prescriptive module does not switch the grid. It estimates moved megawatts, searches alternate paths, rejects links with insufficient proxy headroom or Critical screening state, ranks feasible candidates by distance, utilization, risk, and proxy loss, and reports best-effort bottlenecks when a fully feasible path does not exist. The main contribution is an auditable integration of data quality, graph features, predictive evaluation, distance-loss assumptions, and recommendation guardrails rather than an unsupported claim of a new neural architecture.")
    add_heading(doc, "Keywords", level=1)
    add_para(doc, "Predictive analytics; prescriptive analytics; cross-border power flow; graph time series; Fusion GRU; DCRNN; rerouting; physical-loss proxy; explainable decision support; model evaluation.")
    page_break(doc)

    # Page 5 contents
    page_title(doc, "Contents")
    add_toc_field(doc)
    page_break(doc)

    # Page 6 lists
    page_title(doc, "Lists and abbreviations")
    add_heading(doc, "List of figures", level=1)
    add_bullets(doc, [
        "Figure 1 Project end-to-end workflow",
        "Figure 2 Original model comparison figure",
        "Figure 3 Fusion GRU training curves",
        "Figure 4 DCRNN training curves",
        "Figure 5 ROC and precision-recall curves",
        "Figure 6 DCRNN ROC and precision-recall curves",
        "Figure 7 Feature importance and ablation evidence",
        "Figure 8 Fusion GRU test-error distribution",
        "Figure 9 t-SNE projection of learned states",
    ])
    add_heading(doc, "List of tables", level=1)
    add_bullets(doc, [
        "Table 1 Dataset profile",
        "Table 2 Preprocessing and split configuration",
        "Table 3 Engineered feature catalog",
        "Table 4 Forecasting model comparison",
        "Table 5 Confusion matrix values",
        "Table 6 Technology stack and uses",
    ])
    add_heading(doc, "Abbreviations", level=1)
    add_table(doc, ["Abbreviation", "Meaning"], [
        ["AI", "Artificial intelligence"], ["API", "Application programming interface"], ["DCRNN", "Diffusion Convolutional Recurrent Neural Network"], ["F1", "Harmonic mean of precision and recall"], ["GRU", "Gated Recurrent Unit"], ["MAE", "Mean absolute error"], ["MAPE", "Mean absolute percentage error"], ["RMSE", "Root mean square error"], ["SSE", "Server-sent events"], ["t-SNE", "t-distributed stochastic neighbor embedding"],
    ], widths=[1.35, 4.8], font_size=8.5)
    # Chapter 1 starts on a fresh page through add_heading's chapter rule.
    # Avoid an additional manual break here, which would create a blank page.

    # Page 7 chapter 1
    add_heading(doc, "Chapter 1 Introduction", level=1)
    add_heading(doc, "1.1 Background", level=2)
    add_para(doc, "Modern electricity systems are not isolated time series. Power is generated, consumed, and exchanged over interconnected networks. A change in one country can alter flows in neighboring countries, and a stressed transfer can make alternate paths important. This motivates a graph-based view in which the node state contains recent load and net flow while the edge state contains interconnector direction, magnitude, utilization, and distance.")
    add_para(doc, "Predictive analytics asks what may happen in the next period. Prescriptive analytics follows with a constrained question: if the predicted condition is undesirable, what action should an operator investigate? These questions are related but not identical. A model can forecast a high flow without proving that a switch or dispatch action is safe. GridPulse therefore separates prediction from recommendation and places engineering validation checks beside every route result.")
    add_heading(doc, "1.2 Motivation", level=2)
    add_para(doc, "Graph neural-network research shows why topology can matter for spatio-temporal forecasting. DCRNN models diffusion on a directed graph and combines it with recurrent temporal dynamics [4]. Graph WaveNet shows an alternative in which hidden spatial dependencies are learned alongside temporal convolutions [5]. Power-system surveys identify forecasting, state estimation, fault diagnosis, and topology management as important graph-learning applications while also emphasizing robustness and domain knowledge [7, 8].")
    add_callout_paragraph(doc, "Project motivation.", "Create a transparent course-scale system that shows how the data, graph, model, evaluation evidence, physical assumptions, and recommended route connect end to end.")
    page_break(doc)

    # Page 8 chapter 1 continued
    add_heading(doc, "1.3 Objectives", level=2)
    add_numbered(doc, [
        "Build a reproducible preprocessing pipeline for the supplied country and interconnector CSV files.",
        "Represent the cross-border network as canonical nodes and edges while preserving alias information.",
        "Create time-series and graph features for next-hour net-flow forecasting.",
        "Compare transparent classical baselines with Fusion GRU and DCRNN under the same chronological protocol.",
        "Evaluate both continuous prediction error and Normal, Warning, and Critical stress classes.",
        "Calculate a clearly labeled distance-based resistance and I²R loss proxy using constant assumptions.",
        "Provide a recommendation-only rerouting studio with headroom and risk guardrails.",
        "Expose results through a browser dashboard with live historical replay and explainable values.",
    ])
    add_heading(doc, "1.4 Scope", level=2)
    add_para(doc, "The scope includes historical replay, model training artifacts, a lightweight Python backend, a browser frontend, evaluation figures, and what-if route search. The scope excludes automatic generation dispatch, automatic switching, protection coordination, guaranteed thermal limits, real-time utility telemetry, market optimization, and engineering-grade AC power-flow validation.")
    add_heading(doc, "1.5 Research questions", level=2)
    add_bullets(doc, [
        "Does a trained temporal model improve on a persistence baseline for next-hour net flow?",
        "Does preserving the country graph through diffusion improve forecasting on this dataset?",
        "Which features most influence the saved validation error?",
        "Can a stressed link be mapped to a candidate route without hiding infeasible or unsafe conditions?",
    ])
    page_break(doc)

    # Page 9 chapter 2
    add_heading(doc, "Chapter 2 Domain and Problem Formulation", level=1)
    add_heading(doc, "2.1 Cross-border power-flow domain", level=2)
    add_para(doc, "The project treats each country code as a node. Each power-flow record contains a timestamp, interconnector label, source, target, and power flow in megawatts. Multiple directional records can refer to one physical connection. The pipeline converts them into a sorted canonical edge such as DE-FR while retaining the raw alias mapping for audit. At each time point, forward and reverse values are combined into a signed net value and an observed magnitude used for screening.")
    add_heading(doc, "2.2 Predictive formulation", level=2)
    add_para(doc, "For a country i and time t, let xᵢ,t contain recent net flow, load, imbalance, load residual, shared network context, and static graph properties. The model receives a 24-hour window and predicts the next-hour net flow ŷᵢ,t+1. The output is continuous in megawatts and is also converted to a screening class by comparing absolute flow magnitude with training-derived warning and critical thresholds.")
    add_equation(doc, r"\hat{y}_{i,t+1}=f_\theta(x_{i,t-23},\ldots,x_{i,t};G)", "The graph G is used explicitly by DCRNN and indirectly through engineered centrality features in Fusion GRU.")
    add_heading(doc, "2.3 Prescriptive formulation", level=2)
    add_para(doc, "If the selected edge e is stressed, the what-if module chooses a reduction percentage p and computes the amount of flow to investigate. It then removes the selected edge from the visible graph, searches connected paths between the same endpoints, applies hard proxy guardrails, and ranks surviving paths. The output is a recommendation with status, route nodes, route edges, bottlenecks, loss comparison, reason, and required engineering checks.")

    # Page 10 chapter 2 continued
    add_heading(doc, "2.4 User and system requirements", level=2)
    add_table(doc, ["Requirement group", "Implemented behavior"], [
        ["Graph representation", "Country nodes, canonical interconnector edges, direction, magnitude, coordinates, and risk colors"],
        ["Data validation", "Missing cells, duplicates, country codes, timestamp gaps, aliases, and engineering assumptions are recorded"],
        ["Prediction", "Classical baselines plus Fusion GRU and DCRNN research artifacts"],
        ["Risk classification", "Normal, Warning, and Critical states from training quantiles and screening utilization"],
        ["Prescriptive analysis", "Alternate-path search, headroom checks, critical-link rejection, cost ranking, and best-effort bottlenecks"],
        ["Interface", "Animated topology, replay stream, forecast, metrics, physical-loss lens, and reroute studio"],
    ], widths=[1.75, 4.4], font_size=8.2)
    add_heading(doc, "2.5 Assumptions", level=2)
    add_bullets(doc, [
        "All timestamps are parsed as UTC and aligned on an hourly basis.",
        "Country centroids approximate interconnector distance when surveyed line geometry is absent.",
        "Observed 95th percentile flow magnitude acts as a capacity proxy for screening only.",
        "Warning and Critical thresholds are the 75th and 90th training quantiles of absolute net flow.",
        "The stream is a historical replay that demonstrates the interface without claiming live telemetry.",
    ])
    page_break(doc)

    # Page 11 chapter 3 literature
    add_heading(doc, "Chapter 3 Literature Review", level=1)
    add_heading(doc, "3.1 Recurrent neural forecasting", level=2)
    add_para(doc, "The gated recurrent unit was introduced as part of an RNN encoder-decoder framework that learns sequence representations through update and reset gates [6]. A GRU is useful for this project because hourly load and flow exhibit temporal dependence, while the gated state can retain recent information without requiring a large architecture. GridPulse uses a compact Fusion GRU over engineered local, global, and static features.")
    add_heading(doc, "3.2 Diffusion convolutional recurrent networks", level=2)
    add_para(doc, "DCRNN was proposed for traffic forecasting as a model that represents spatial dependence as diffusion on a directed graph and temporal dependence through a recurrent architecture [4]. The central idea transfers naturally to the project graph: information from neighboring countries can influence the next-hour estimate. The implementation uses forward and reverse row-normalized transition matrices and two diffusion steps before each recurrent update.")
    add_heading(doc, "3.3 Adaptive graph forecasting", level=2)
    add_para(doc, "Graph WaveNet argues that a known topology may not capture every dependency and proposes an adaptive dependency matrix together with dilated temporal convolutions [5]. This is relevant as future work. The current project deliberately keeps the topology inspectable and fixed so that the route planner, graph visualization, and physical assumptions remain understandable to a non-specialist audience.")
    add_heading(doc, "3.4 Power-system graph learning", level=2)
    add_para(doc, "Recent reviews describe applications of graph computing and GNNs in power-system forecasting, state estimation, fault diagnosis, topology identification, and decision support [7, 8]. These reviews support using a graph representation but also motivate transparent validation, robustness analysis, and incorporation of engineering constraints rather than reporting accuracy alone.")

    # Page 12 chapter 3 gap
    add_heading(doc, "3.5 Comparison of existing approaches", level=2)
    add_table(doc, ["Approach", "Strength", "Limitation for this project"], [
        ["Classical persistence", "Very fast, strong for autocorrelated short-horizon flow, easy to audit", "Does not use graph or exogenous context"],
        ["Moving average and seasonal naive", "Simple reference rules for time-series behavior", "Smooth or lag abrupt changes and may fail near sign changes"],
        ["Fusion GRU", "Learns nonlinear temporal relationships from engineered local and global inputs", "Does not directly diffuse hidden state over graph edges"],
        ["DCRNN", "Combines directed graph diffusion with recurrent temporal memory", "More compute and may not improve when local history dominates"],
        ["Graph WaveNet style models", "Can learn hidden dependencies and long temporal receptive fields", "More complex; requires stronger audit and ablation evidence"],
    ], widths=[1.55, 2.55, 2.1], font_size=8.2)
    add_heading(doc, "3.6 Identified gap", level=2)
    add_para(doc, "Many forecasting papers optimize prediction error on curated benchmarks. A deployable-looking course prototype must also answer less glamorous questions: were directional aliases normalized, are the timestamps complete, which outputs are measured versus estimated, what happens when physical line parameters are missing, and does a complex graph model actually beat a simple baseline on this dataset? GridPulse addresses this gap by making data quality, assumptions, model selection, failure cases, and route guardrails visible.")
    add_callout_paragraph(doc, "Novelty position.", "The defensible novelty is the auditable integration of data quality, graph features, evidence-driven model selection, proxy physics, and stress-aware counterfactual routing. It is not a claim of a new neural layer.")
    page_break(doc)

    # Page 13 data
    add_heading(doc, "Chapter 4 Dataset and Preprocessing", level=1)
    add_heading(doc, "4.1 Data sources", level=2)
    add_para(doc, "The project uses two supplied CSV files. The dynamic file contains country-level hourly variables such as actual load, day-ahead load forecast, net flow, flow imbalance, renewable generation, weather variables, socio-economic variables, and graph centralities. The power-flow file contains timestamped directional interconnector records. The two datasets are joined by time and network identifiers after validation and canonicalization.")
    add_table(doc, ["Dataset property", "Value"], [
        ["Dynamic records", f"{profile['dynamic_rows']:,}"],
        ["Dynamic columns", str(profile['dynamic_column_count'])],
        ["Power-flow records", f"{profile['power_flow_rows']:,}"],
        ["Power-flow columns", str(profile['power_flow_column_count'])],
        ["Countries or nodes", str(profile['node_count'])],
        ["Canonical links or edges", str(profile['edge_count'])],
        ["Time range", f"{profile['date_min']} to {profile['date_max']}"],
        ["Retained history per country", f"{profile['processed_history_points_per_country']} points"],
    ], widths=[2.7, 3.3], font_size=8.8)
    add_heading(doc, "4.2 Dataset schema", level=2)
    add_para(doc, "The principal dynamic fields are datetime, country, Actual_Total_Load_MW, Day_ahead_Total_Load_Forecast_MW, load_residual, net_flow, flow_imbalance_ratio, renewable generation fields, calendar encodings, weather fields, location, socio-economic fields, and graph centralities. The power-flow schema is datetime, interconnector, source, target, and power_flow_mw. The complete column inventory is retained in results/dataset_profile.json and is summarized in Appendix A.")

    # Page 14 preprocessing
    add_heading(doc, "4.3 Preprocessing workflow", level=2)
    add_table(doc, ["Step", "Operation", "Purpose"], [
        ["1", "Parse", "Read UTF-8 BOM-safe CSV files and parse UTC timestamps"],
        ["2", "Validate", "Count missing cells, duplicates, invalid codes, and hourly gaps"],
        ["3", "Canonicalize", "Map raw interconnector labels to sorted endpoint IDs while retaining aliases"],
        ["4", "Align", "Retain common recent history and align country features by hourly timestamp"],
        ["5", "Scale", "Fit means and standard deviations on training data only"],
        ["6", "Split", "Hold out the final 168 hours chronologically without random leakage"],
        ["7", "Evaluate", "Compare baselines, Fusion GRU, and DCRNN on the same target and horizon"],
    ], widths=[0.55, 1.35, 4.1], font_size=8.5)
    add_heading(doc, "4.4 Data quality results", level=2)
    add_bullets(doc, [
        f"Dynamic missing cells: {profile['quality_checks']['dynamic_missing_cells']}; power-flow missing cells: {profile['quality_checks']['power_missing_cells']}.",
        f"Dynamic duplicate keys: {profile['quality_checks']['dynamic_duplicate_keys']}; power-flow duplicate keys: {profile['quality_checks']['power_duplicate_keys']}.",
        f"Country timestamp gaps: {profile['quality_checks']['country_timestamp_gap_total']} hours across several countries.",
        f"Interconnector aliases normalized: {profile['quality_checks']['normalized_interconnector_alias_count']}.",
    ])
    add_callout_paragraph(doc, "Why chronological splitting matters.", "Randomly mixing future and past rows would allow future operating patterns to influence training. The project uses a final 168-hour chronological holdout so the evaluation resembles forecasting unseen future hours.")

    # Page 15 preprocessing details
    add_heading(doc, "4.5 Samples and labels", level=2)
    add_table(doc, ["Configuration", "Value"], [
        ["Sequence length", f"{preprocess['sequence_length_hours']} hours"],
        ["Window stride", f"{preprocess['window_stride_hours']} hours"],
        ["Test horizon", f"{preprocess['test_horizon_hours']} hours"],
        ["Fusion GRU train samples", f"{preprocess['train_samples_fusion_gru']:,}"],
        ["Fusion GRU validation samples", f"{preprocess['validation_samples_fusion_gru']:,}"],
        ["Fusion GRU test samples", f"{preprocess['test_samples_fusion_gru']:,}"],
        ["Warning threshold", f"{preprocess['warning_threshold_mw']:.2f} MW"],
        ["Critical threshold", f"{preprocess['critical_threshold_mw']:.2f} MW"],
    ], widths=[2.8, 3.0], font_size=8.7)
    add_para(doc, "The label is not an externally certified protection state. It is a three-class screening label derived from the absolute net-flow magnitude. Values below the 75th training quantile are Normal, values between the 75th and 90th quantiles are Warning, and values at or above the 90th quantile are Critical. This makes the class metrics useful for model comparison while preserving the distinction between analytics and engineering certification.")
    add_heading(doc, "4.6 Leakage controls", level=2)
    add_bullets(doc, [
        "Feature and target scalers are fit on the training window only.",
        "Validation and test values are transformed using training statistics.",
        "The final 168 hours are never used to construct training windows.",
        "The same chronological test horizon is used for the trained model comparison.",
    ])
    page_break(doc)

    # Page 16 graph features
    add_heading(doc, "Chapter 5 Feature Engineering and Graph Construction", level=1)
    add_heading(doc, "5.1 Graph construction", level=2)
    add_para(doc, "The graph G = (V, E) contains 12 country nodes and 24 canonical interconnector edges. Country centroids from the dynamic file supply latitude and longitude. Each raw direction is stored for audit, while the canonical edge is built by sorting its endpoints. This prevents the system from treating DE-FR and FR-DE as unrelated physical assets.")
    add_heading(doc, "5.2 Feature groups", level=2)
    add_table(doc, ["Feature group", "Features", "Role"], [
        ["Local time series", "local net flow, local load, local imbalance, local load residual", "Recent behavior and country-specific operating pressure"],
        ["Network context", "global net flow, global load, global imbalance, global residual", "Shared system conditions across countries"],
        ["Static graph", "degree, closeness, betweenness centrality", "Connectivity and bridge-node context"],
    ], widths=[1.45, 2.65, 1.7], font_size=8.2)
    add_heading(doc, "5.3 Feature catalog", level=2)
    rows = []
    for item in feature_catalog["features"]:
        rows.append([item["name"], item["formula"], item["reason"]])
    add_table(doc, ["Feature", "Construction", "Why it is used"], rows, widths=[1.55, 2.25, 2.0], font_size=7.8)
    page_break(doc)

    # Page 17 physical equations
    add_heading(doc, "5.4 Distance and physical loss proxy", level=2)
    add_para(doc, "The datasets do not provide surveyed line corridors, conductor material, conductor cross-section, actual voltage, power factor, or thermal capacity. The project therefore calculates a transparent scenario proxy. Haversine distance is applied between country centroids. Resistance is derived from assumed resistivity, length, and area. Apparent power and current are then estimated from observed active power, power factor, and line voltage.")
    add_equation(doc, r"a=\sin^2(\Delta\phi/2)+\cos(\phi_1)\cos(\phi_2)\sin^2(\Delta\lambda/2)")
    add_equation(doc, r"d=2R_e\arcsin(\sqrt{a})", "Haversine distance in kilometres after unit conversion.")
    add_equation(doc, r"R=\frac{\rho L}{A}", "Resistance in ohms, where ρ is resistivity, L is length, and A is conductor area.")
    add_equation(doc, r"S=\frac{|P|}{pf},\quad I=\frac{S}{\sqrt{3}V}")
    add_equation(doc, r"P_{\mathrm{loss}}=3I^2R", "Simplified three-phase resistive loss estimate.")
    add_table(doc, ["Assumption", "Value"], [
        ["Line voltage", "400 kV"], ["Power factor", "0.95"], ["Copper resistivity", "1.68 × 10⁻⁸ Ω m"], ["Cross-sectional area", "2,000 mm²"], ["Length", "Haversine centroid-to-centroid distance"],
    ], widths=[2.7, 3.0], font_size=8.8)
    add_callout_paragraph(doc, "Interpretation.", "This output is a distance-based flow-loss estimate, not a substitute for an AC power-flow solver. The report keeps the assumptions visible so they can be replaced when engineering data becomes available.")
    page_break(doc)

    # Page 18 methodology overview
    add_heading(doc, "Chapter 6 Predictive Methodology", level=1)
    add_heading(doc, "6.1 End-to-end analytical workflow", level=2)
    add_table(doc, ["Stage", "Input", "Output"], [
        ["Ingest", "Two CSV files", "Parsed dynamic and directional rows"],
        ["Validate", "Rows and keys", "Quality counts, aliases, gaps, and limitations"],
        ["Graph", "Countries and interconnectors", "12-node, 24-edge canonical graph"],
        ["Features", "History and graph metadata", "12 × 960 × 11 feature tensor"],
        ["Forecast", "24-hour windows", "Next-hour net-flow prediction"],
        ["Classify", "Actual and predicted flow", "Normal, Warning, or Critical"],
        ["Prescribe", "Selected stressed edge", "Route candidates and guardrails"],
        ["Present", "Saved artifacts and APIs", "Animated browser dashboard"],
    ], widths=[1.1, 2.2, 2.4], font_size=8.2)
    add_heading(doc, "6.2 Model families", level=2)
    add_para(doc, "The study deliberately compares models of increasing complexity. Persistence provides an autoregressive baseline. Moving average and seasonal naive provide transparent alternatives. Linear trend tests whether a recent slope is enough. Fusion GRU learns temporal relationships from the engineered tensor. DCRNN adds directed graph diffusion before recurrent memory updates. This design prevents the project from assuming that the most complex model must win.")
    add_heading(doc, "6.3 Training protocol", level=2)
    add_bullets(doc, [
        f"Random seed: {run_meta['seed']}.",
        f"Epochs: {run_meta['epochs']} for trained research models.",
        "Training-only standardization and chronological train, validation, and test windows.",
        "The same 24-hour lookback and 168-hour test horizon for Fusion GRU and DCRNN.",
        "Saved JSON, CSV, PNG, and checkpoint artifacts for reproducibility.",
    ])
    page_break(doc)

    # Page 19 classical models
    add_heading(doc, "6.4 Classical forecasting models", level=2)
    add_heading(doc, "Persistence", level=3)
    add_equation(doc, r"\hat{y}_{t+1}=y_t", "The next hour is predicted as the latest observed flow.")
    add_heading(doc, "Twenty four hour moving average", level=3)
    add_equation(doc, r"\hat{y}_{t+1}=\frac{1}{24}\sum_{i=0}^{23}y_{t-i}")
    add_heading(doc, "Seasonal naive", level=3)
    add_equation(doc, r"\hat{y}_{t+1}=y_{t-24}", "The same hour from the previous day is used when available.")
    add_heading(doc, "Clamped linear trend", level=3)
    add_para(doc, "A least-squares line is fitted over the recent 24 observations. The extrapolated value is clamped to a margin around the observed window so a short data gap cannot create a runaway recommendation.")
    add_heading(doc, "Why baselines matter", level=2)
    add_para(doc, "The selected dashboard baseline is Persistence because the production selection artifact chooses the lowest pooled chronological RMSE and because the rule is fast and easy to audit. Fusion GRU is still the research winner among the saved trained models by RMSE. Reporting both avoids conflating operational simplicity with research-model performance.")
    page_break(doc)

    # Page 20 Fusion GRU
    add_heading(doc, "6.5 Fusion GRU", level=2)
    add_para(doc, "The Fusion GRU receives a 24-hour sequence for each country. At every hour the input combines four local signals, four global signals, and three static centrality values. The GRU updates a hidden state through gates, and a normalized linear head maps the final hidden state to the next-hour flow estimate. The model is called Fusion because local time-series information, global network context, and static graph information are concatenated before the recurrent layer.")
    add_equation(doc, r"z_t=\sigma(W_zx_t+U_zh_{t-1}+b_z)")
    add_equation(doc, r"r_t=\sigma(W_rx_t+U_rh_{t-1}+b_r)")
    add_equation(doc, r"\tilde{h}_t=\tanh(W_hx_t+U_h(r_t\odot h_{t-1})+b_h)")
    add_equation(doc, r"h_t=(1-z_t)\odot h_{t-1}+z_t\odot\tilde{h}_t", "Simplified GRU gate notation; the implementation uses PyTorch GRU cells.")
    add_para(doc, "The update gate controls how much new information is used. The reset gate controls how much previous state contributes to the candidate state. This lets the model preserve stable flow patterns while adapting when load, imbalance, or network context changes.")
    page_break(doc)

    # Page 21 DCRNN
    add_heading(doc, "6.6 Diffusion Convolutional Recurrent Neural Network", level=2)
    add_para(doc, "DCRNN keeps the node axis intact. Instead of flattening the 12 countries into one vector, the model stores a hidden state for every country. Before the recurrent update, the graph convolution propagates each node's features through forward and reverse row-normalized transitions. Two diffusion steps allow information from immediate and second-order neighbors to influence the node representation.")
    add_equation(doc, r"X^{(0)}=X,\quad X^{(k)}=PX^{(k-1)}")
    add_equation(doc, r"H=[X^{(0)}\Vert X_f^{(1)}\Vert X_f^{(2)}\Vert X_r^{(1)}\Vert X_r^{(2)}]W+b", "Forward and reverse diffusion features are concatenated before the recurrent gates.")
    add_para(doc, "In simple terms, Fusion GRU asks: what happened recently at this country and in the overall system? DCRNN asks the same question while also passing information along the known country-interconnector graph. The project uses DCRNN as a fair benchmark, not as a dispatch solver or a replacement for physical power-flow equations [4].")
    add_heading(doc, "6.7 Why DCRNN can lag", level=2)
    add_bullets(doc, [
        "Recent local net flow is overwhelmingly the strongest saved feature, so additional diffusion can add noise rather than useful signal.",
        "The graph is a canonical country-interconnector topology, not a complete electrical admittance model.",
        "The dataset lacks validated line ratings, dispatch constraints, voltage states, and market shocks.",
        "DCRNN has higher inference time and more moving parts than Persistence or Fusion GRU.",
        "A weaker score is useful evidence: topology alone did not guarantee an advantage under this protocol.",
    ])
    page_break(doc)

    # Page 22 metrics
    add_heading(doc, "6.8 Evaluation metrics", level=2)
    add_para(doc, "The report uses regression metrics for MW error and classification metrics for stress-state behavior. Because net flow can approach zero or change sign, MAPE is reported for course completeness but is not treated as the primary decision metric.")
    add_equation(doc, r"\mathrm{MAE}=\frac{1}{n}\sum|\hat{y}_i-y_i|")
    add_equation(doc, r"\mathrm{RMSE}=\sqrt{\frac{1}{n}\sum(\hat{y}_i-y_i)^2}", "RMSE penalizes large errors more heavily than MAE.")
    add_equation(doc, r"\mathrm{MAPE}=\frac{100}{n}\sum\left|\frac{\hat{y}_i-y_i}{y_i}\right|", "Unstable when actual values are near zero.")
    add_equation(doc, r"\mathrm{Accuracy}=\frac{TP+TN}{N}")
    add_equation(doc, r"\mathrm{Precision}=\frac{TP}{TP+FP},\quad\mathrm{Recall}=\frac{TP}{TP+FN}")
    add_equation(doc, r"F_1=\frac{2\,\mathrm{Precision}\,\mathrm{Recall}}{\mathrm{Precision}+\mathrm{Recall}}")
    add_para(doc, "The classification metrics are macro-averaged across Normal, Warning, and Critical classes. The confusion matrix is retained because a single accuracy value can hide whether Warning or Critical states are being confused with Normal. This follows the practical emphasis on class-aware evaluation in the course syllabus and the standard metric definitions used by machine-learning tooling [9].")
    page_break(doc)

    # Page 23 architecture stack
    add_heading(doc, "Chapter 7 System Architecture and Technology Stack", level=1)
    add_heading(doc, "7.1 Architecture", level=2)
    add_para(doc, "The project is organized into four layers. The data layer stores the supplied CSV files and compact processed artifacts. The analytical layer contains the standard-library preprocessing pipeline and the optional research experiment runner. The service layer exposes REST-style JSON endpoints and a server-sent event replay stream. The presentation layer uses HTML, CSS, and JavaScript to render the graph, animations, charts, metrics, and route what-if result.")
    add_para(doc, "The architecture intentionally keeps the production dashboard independent of the optional heavy experiment dependencies. This makes the dashboard runnable with the Python standard library while allowing NumPy, PyTorch, scikit-learn, and Matplotlib to be used for training and research artifact generation.")
    add_heading(doc, "7.2 Technology stack", level=2)
    add_table(doc, ["Technology", "Use in the project"], [
        ["Python", "Data ingestion, preprocessing, model evaluation, physics proxy, routing, and HTTP backend"],
        ["NumPy", "Tensor preparation, numerical calculations, and experiment arrays"],
        ["PyTorch", "Fusion GRU, DCRNN, training loop, checkpoints, and hidden-state extraction"],
        ["scikit-learn", "t-SNE projection and evaluation utilities"],
        ["Matplotlib", "Saved result figures for the report and presentation"],
        ["HTML and CSS", "Responsive dashboard structure and visual design"],
        ["JavaScript", "API polling, SSE replay, charts, network animation, and reroute interactions"],
        ["JSON and CSV", "Reproducible artifacts, API payloads, input data, and evaluation outputs"],
    ], widths=[1.65, 4.3], font_size=8.3)
    page_break(doc)

    # Page 24 integration
    add_heading(doc, "7.3 Backend and frontend integration", level=2)
    add_table(doc, ["API route", "Purpose"], [
        ["/api/health", "Check service availability"],
        ["/api/metadata", "Return dataset, model, assumptions, and limitation metadata"],
        ["/api/topology", "Return nodes, edges, aliases, coordinates, and graph properties"],
        ["/api/snapshot", "Return a historical replay state at the selected time"],
        ["/api/forecast", "Return next-hour or multi-hour forecast values"],
        ["/api/metrics and /api/validation", "Return saved comparison and validation evidence"],
        ["/api/physical-loss", "Return distance, resistance, current, and proxy loss values"],
        ["/api/route-plan and /api/what-if", "Return alternate paths, bottlenecks, and loss comparison"],
        ["/api/stream", "Replay historical observations as a live-looking stream"],
    ], widths=[2.25, 3.7], font_size=8.2)
    add_heading(doc, "7.4 Live replay behavior", level=2)
    add_para(doc, "The dashboard updates the visible snapshot, graph edge colors, flow particles, current metrics, and recommendation queue as replay time advances. The values change because the frontend requests different historical timestamps from the backend or consumes the replay stream. This is a real-time interface demonstration, not a live connection to a transmission system. The interface surfaces Fusion GRU as the research model and labels Persistence as the lightweight operational baseline; this distinction prevents a presentation label from misrepresenting which endpoint is executing.")
    add_heading(doc, "7.5 Security and validation posture", level=2)
    add_bullets(doc, [
        "What-if percentages are clamped before route calculation.",
        "Unknown edge identifiers are rejected.",
        "Route output is labeled recommendation-only.",
        "The interface exposes engineering checks instead of hiding missing parameters.",
    ])
    page_break(doc)

    # Page 25 implementation pipeline
    add_heading(doc, "Chapter 8 Implementation and Experimental Design", level=1)
    add_heading(doc, "8.1 Pipeline implementation", level=2)
    add_para(doc, "backend/pipeline.py performs two CSV passes. The first builds country histories and metadata. The second groups directional power-flow records by timestamp and canonical edge, computes forward, reverse, net, and magnitude values, and stores compact edge histories. It then derives the observed 95th percentile capacity proxy, distance, resistance, loss, utilization, and screening class.")
    add_heading(doc, "8.2 Experiment implementation", level=2)
    add_para(doc, "backend/experiments.py loads processed artifacts, constructs the 12-node feature tensor, makes chronological samples, trains Fusion GRU and DCRNN, computes regression and classification metrics, produces ROC/PR curves, saves confusion matrices, runs permutation and ablation analysis, creates a t-SNE projection, and exports the light-background PNG figures used in this report.")
    add_heading(doc, "8.3 Reproducibility", level=2)
    add_bullets(doc, [
        f"Seed: {run_meta['seed']}.",
        "Configuration and feature names are saved in results/run_metadata.json.",
        "Every figure has a corresponding JSON or CSV source artifact.",
        "The saved model checkpoints are stored in results/models.",
        "Unit and smoke tests cover pipeline, routing, and API behavior.",
    ])
    add_callout_paragraph(doc, "Reproducibility rule.", "The report does not invent graph values in the document. The result figures and numerical tables are based on the saved artifacts produced by the project experiment layer.")
    page_break(doc)

    # Page 26 frontend implementation
    add_heading(doc, "8.4 Frontend implementation", level=2)
    add_para(doc, "The frontend is organized as a dashboard with overview, forecast, model evidence, physical-loss, and rerouting views. The graph view draws nodes and links, colors them by screening state, and animates moving particles to communicate direction. The forecast view plots recent history and future values. The model evidence view explains the saved metrics rather than treating a single accuracy value as sufficient. The physics view exposes the assumed voltage, power factor, resistivity, area, and derived distance. The reroute studio accepts a selected edge and reduction percentage, then displays the route status and bottlenecks returned by the backend.")
    add_heading(doc, "8.5 Explainability principles", level=2)
    add_bullets(doc, [
        "Every major value is accompanied by a unit or interpretation.",
        "Measured, estimated, and proxy values are distinguished.",
        "A recommendation includes a reason and validation checks.",
        "The user can trace a route from selected edge to candidate path and bottleneck.",
        "Model comparison includes both simple baselines and neural models.",
    ])
    add_heading(doc, "8.6 Testing", level=2)
    add_table(doc, ["Test file", "Coverage"], [
        ["tests/test_pipeline.py", "Distance-loss calculation, thresholds, preprocessing and artifact behavior"],
        ["tests/test_routing.py", "Path search, guardrails, no-change, feasible, and best-effort cases"],
        ["tests/test_api.py", "Endpoint smoke tests and response structure"],
    ], widths=[2.0, 3.95], font_size=8.7)
    page_break(doc)

    # Page 27 results model comparison
    add_heading(doc, "Chapter 9 Results and Evaluation", level=1)
    add_heading(doc, "9.1 Model comparison", level=2)
    add_figure(doc, "model_comparison.png", "Figure 2 Original saved model comparison figure showing RMSE and macro F1.", width=6.1)
    rows = []
    for item in comparison["models"]:
        rows.append([
            item["label"], f"{item['rmse']:.1f}", f"{item['mae']:.1f}", f"{item['accuracy'] * 100:.1f}%", f"{item['precision'] * 100:.1f}%", f"{item['recall'] * 100:.1f}%", f"{item['f1'] * 100:.1f}%", f"{item['inference_time_ms']:.1f}",
        ])
    add_table(doc, ["Model", "RMSE MW", "MAE MW", "Accuracy", "Precision", "Recall", "F1", "Time ms"], rows, widths=[1.25, 0.65, 0.65, 0.7, 0.72, 0.65, 0.55, 0.65], font_size=7.3)
    add_para(doc, "Fusion GRU has the lowest saved RMSE among the trained research models at 570.5 MW and the highest F1 at 85.6%. Persistence has a slightly higher RMSE at 580.3 MW but is much faster and simpler. DCRNN has RMSE 634.0 MW and F1 83.8%, so graph diffusion did not improve this run. The dashboard selection artifact keeps Persistence as the operational baseline while the research comparison identifies Fusion GRU as the trained-model winner.")
    page_break(doc)

    # Page 28 learning curves
    add_heading(doc, "9.2 Training and validation curves", level=2)
    add_figure(doc, "training_curves.png", "Figure 3 Original Fusion GRU training and validation loss and macro F1 curves.", width=6.15)
    add_figure(doc, "dcrnn_training_curves.png", "Figure 4 Original DCRNN training and validation loss and macro F1 curves.", width=6.15)
    add_para(doc, "The curves show that both trained models learn rapidly during the early epochs. Loss falls sharply, while macro F1 rises. The validation curves remain broadly aligned with training behavior, which is evidence against a severe training collapse in this run. The final test comparison is still more important than a visually good training curve because the holdout is chronological and represents unseen future-like hours.")
    add_callout_paragraph(doc, "Interpretation.", "A learning curve explains how the model learned; it does not prove that the model is engineering-safe. The saved test metrics and failure examples must be considered together.")
    page_break(doc)

    # Page 29 ROC PR
    add_heading(doc, "9.3 ROC AUC and precision recall analysis", level=2)
    add_figure(doc, "roc_pr_curves.png", "Figure 5 Original Fusion GRU ROC and precision-recall curves.", width=6.15)
    add_figure(doc, "dcrnn_roc_pr_curves.png", "Figure 6 Original DCRNN ROC and precision-recall curves.", width=6.15)
    add_para(doc, "The ROC curves show the trade-off between true-positive rate and false-positive rate as the threshold changes. Precision-recall curves are particularly useful for Warning and Critical classes because those states are less frequent than Normal. A high area under a curve suggests good separability across thresholds, but the operating threshold still depends on the cost of missed stress versus false alarms. The dashboard therefore keeps the class thresholds explicit and includes a confusion matrix.")
    page_break(doc)

    # Page 30 feature and error figures
    add_heading(doc, "9.4 Feature interpretation and error analysis", level=2)
    add_figure(doc, "feature_importance.png", "Figure 7 Original permutation-importance figure. Larger delta MAE means the model depends more on that feature.", width=6.1)
    add_para(doc, f"The saved baseline validation MAE for the feature study is {feature_importance['features'][0]['baseline_validation_mae']:.1f} MW. Shuffling local net flow increases MAE by {feature_importance['features'][0]['permutation_delta_mae']:.1f} MW, far more than any other feature. This supports the interpretation that recent local flow is the dominant predictive signal in this run. Centrality features contribute smaller but positive permutation deltas, while some global context features do not improve the validation MAE when shuffled. These results are model-specific evidence, not causal proof.")
    add_figure(doc, "error_distribution.png", "Figure 8 Original Fusion GRU test error distribution.", width=6.1)
    add_para(doc, "The error distribution is concentrated at smaller absolute errors with a long tail. The saved qualitative failures include a German Critical flow of 7,484.5 MW predicted as 3,986.7 MW, and a French Normal flow of -1,662.5 MW predicted as -5,030.8 MW. Sudden movements and class-boundary changes are therefore important failure cases.")
    page_break(doc)

    # Page 31 tsne and confusion
    add_heading(doc, "9.5 Learned-state projection and confusion matrix", level=2)
    add_figure(doc, "tsne_projection.png", "Figure 9 Original t-SNE projection of learned hidden states.", width=5.85)
    add_para(doc, "The t-SNE projection provides a two-dimensional view of hidden states and can show whether similar operating conditions form neighborhoods. It is exploratory: distance in a t-SNE plot does not prove physical similarity or causality. Its value is qualitative inspection alongside the numeric metrics and error examples.")
    add_heading(doc, "DCRNN confusion matrix", level=2)
    labels = confusion["labels"]
    matrix = confusion["matrix"]
    rows = [["Actual / Predicted"] + labels]
    for label in labels:
        rows.append([label] + [str(matrix[label][pred]) for pred in labels])
    add_table(doc, rows[0], rows[1:], widths=[2.0, 1.2, 1.2, 1.2], font_size=8.7)
    add_para(doc, "For DCRNN, most Normal cases are correctly identified: 1,504 of 1,548 Normal examples. Critical cases are correctly identified 104 times, but 41 are predicted as Warning. This is a more informative view than accuracy alone because it shows the severity of the confusion. Fusion GRU has a similar pattern but captures more Critical cases in the saved matrix.")
    page_break(doc)

    # Page 32 metrics interpretation
    add_heading(doc, "9.6 Metric interpretation", level=2)
    add_table(doc, ["Metric", "What it answers", "Project reading"], [
        ["RMSE", "How large are errors, with large mistakes emphasized?", "Fusion GRU is lowest among trained models; Persistence is close and simpler"],
        ["MAE", "What is the average absolute MW error?", "Persistence is 375.8 MW; Fusion GRU is 400.3 MW"],
        ["Accuracy", "What fraction of stress labels are correct?", "Fusion GRU 92.7%, DCRNN 92.5%, Persistence 91.4%"],
        ["Precision", "When the model predicts a class, how reliable is it?", "Macro precision is around 85% for trained models"],
        ["Recall", "How many actual class cases were found?", "Fusion GRU recall is 86.2%; DCRNN recall is 82.7%"],
        ["F1", "What is the balanced class score?", "Fusion GRU has the best saved F1 at 85.6%"],
        ["Inference time", "How quickly can one prediction be produced?", "Persistence is fastest; DCRNN is slower at 63.6 ms"],
    ], widths=[1.15, 2.55, 2.55], font_size=8.1)
    add_heading(doc, "9.7 Results summary", level=2)
    add_para(doc, "The results answer the research questions with a nuanced conclusion. A trained temporal model can improve RMSE and class metrics over Persistence, but the gain is small in RMSE and comes with additional complexity. Graph diffusion is measurable and reproducible but does not win here. Feature importance indicates that local recent history dominates. The prescriptive layer is therefore valuable mainly because it connects forecast evidence to a transparent what-if action, not because the model has proven operational control.")
    page_break(doc)

    # Page 33 prescriptive
    add_heading(doc, "Chapter 10 Prescriptive Analytics and Rerouting", level=1)
    add_heading(doc, "10.1 Decision sequence", level=2)
    add_numbered(doc, [
        "Select a visible interconnector and inspect its current flow, utilization, risk class, distance, and proxy loss.",
        "Choose a reduction percentage p, clamped between 0% and 60%.",
        "Compute the amount of flow to investigate moving.",
        "Remove the selected link from the working graph and search paths between the same endpoints.",
        "Reject or penalize links that lack enough proxy headroom or are Critical.",
        "Rank candidates using distance, utilization, warning/critical penalties, and estimated loss.",
        "Return route status, route nodes, route edges, bottlenecks, baseline loss, rerouted loss, and validation requirements.",
    ])
    add_equation(doc, r"\mathrm{moved\ MW}=\frac{\mathrm{current\ MW}\times\mathrm{reroute\ percentage}}{100}")
    add_equation(doc, r"\mathrm{headroom}=\mathrm{proxy\ capacity}-\mathrm{current\ flow}")
    add_equation(doc, r"\mathrm{route\ cost}=\mathrm{distance}\times(1+2.2\,\mathrm{utilization}+6\,\mathrm{loss\ percentage})")
    add_heading(doc, "10.2 Why this is prescriptive", level=2)
    add_para(doc, "Forecasting reports a likely future value. The route planner evaluates a possible intervention under constraints. It is prescriptive because it compares alternatives and explains the preferred candidate, but it remains a recommendation because it does not know verified thermal ratings, voltage stability, N-1 contingencies, protection settings, or operator priorities.")
    page_break(doc)

    # Page 34 discussion limitations
    add_heading(doc, "Chapter 11 Discussion Novelty Limitations and Ethics", level=1)
    add_heading(doc, "11.1 What is new in this project", level=2)
    add_bullets(doc, [
        "Canonical edge audit that exposes directional aliases instead of hiding them.",
        "Data-quality-aware risk screen combining utilization, imbalance, and load residual.",
        "Evidence-driven model router that compares simple and neural approaches under chronological validation.",
        "Explicit separation of measured flow, estimated capacity, and distance-based loss proxy.",
        "Counterfactual headroom and stress-aware route search with best-effort bottlenecks.",
        "Action queue that includes reasons, confidence, and validation checks.",
    ])
    add_heading(doc, "11.2 Technical limitations", level=2)
    add_bullets(doc, [
        "The physical-loss calculation uses centroid distance and assumed voltage, power factor, resistivity, and area.",
        "The capacity proxy is derived from observed flow and is not a thermal rating.",
        "The historical replay is not live telemetry.",
        "The graph does not contain full electrical admittance, phase, voltage, or reactive-power information.",
        "The model comparison has one supplied network and one evaluation protocol.",
        "Uncertainty bands are not calibrated probability intervals.",
        "No automatic dispatch or switching action is permitted.",
    ])
    add_heading(doc, "11.3 Ethical and operational safeguards", level=2)
    add_para(doc, "The main ethical risk is overtrust: a polished dashboard may be mistaken for an operational authority. The system counters this by labeling proxy values, naming missing parameters, showing failure cases, retaining baseline comparisons, and displaying engineering checks beside routes. A future operational version would require asset validation, secure telemetry, access control, audit logs, calibrated uncertainty, N-1 analysis, and approval by qualified grid personnel.")
    page_break(doc)

    # Page 35 conclusion and future work
    add_heading(doc, "Chapter 12 Conclusion and Future Work", level=1)
    add_heading(doc, "12.1 Conclusion", level=2)
    add_para(doc, "GridPulse demonstrates a complete predictive and prescriptive analytics workflow for cross-border power-flow data. It begins with two raw CSV datasets, validates and canonicalizes them, builds a 12-node and 24-edge graph, extracts local, global, and graph features, constructs 24-hour windows, forecasts next-hour country net flow, evaluates continuous and class-aware performance, estimates a transparent distance-based loss proxy, and tests alternate routes under visible guardrails.")
    add_para(doc, "The saved results show that Fusion GRU is the strongest trained research model by RMSE and F1, while Persistence remains a competitive and simpler operational baseline. DCRNN is successfully implemented and measured but lags the other trained model on this dataset, which is an informative result rather than a failure of the project. The project contribution is an auditable system integration that helps a new user understand not only what the model predicts but also how the recommendation is formed and where engineering validation is still required.")
    add_heading(doc, "12.2 Team contribution", level=2)
    add_table(doc, ["Member", "Explanation responsibility"], [
        ["Prakki Krishna Karthik", "Problem, datasets, preprocessing, graph and feature engineering, physical assumptions"],
        ["Vasudev", "Forecasting models, evaluation equations, APIs, loss calculation, and route decision logic"],
        ["Shubham Bhuyan", "DCRNN, saved figures, comparative interpretation, frontend integration, novelty, and limitations"],
    ], widths=[2.2, 4.0], font_size=8.5)
    add_heading(doc, "12.3 Future work", level=2)
    add_numbered(doc, [
        "Add verified voltage, conductor, route geometry, thermal rating, reactive power, and N-1 security data.",
        "Compare GCN, GAT, GraphSAGE, Graph WaveNet, and stronger spatio-temporal baselines under the same split.",
        "Add calibrated conformal or quantile prediction intervals and evaluate coverage and width.",
        "Add weather, market, outage, and renewable forecast scenarios without leakage.",
        "Validate route recommendations against an engineering power-flow solver and operator constraints.",
        "Replace historical replay with a secure Kafka, MQTT, or utility API adapter after governance review.",
    ])
    page_break(doc, force=True)

    # References and appendices start after a deliberate section break.
    add_heading(doc, "References", level=1)
    references = [
        "[1] Supplied project dataset, dynamic_with_flows.csv, hourly country-level dynamic records, 2022–2024.",
        "[2] Supplied project dataset, power_flow.csv, directional interconnector flow records, 2022–2024.",
        "[3] GridPulse Software Requirements Specification, project artifact, docs/SRS.md.",
        "[4] Y. Li, R. Yu, C. Shahabi, and Y. Liu, Diffusion Convolutional Recurrent Neural Network Data Driven Traffic Forecasting, ICLR 2018. https://arxiv.org/abs/1707.01926.",
        "[5] Z. Wu, S. Pan, G. Long, J. Jiang, and C. Zhang, Graph WaveNet for Deep Spatial Temporal Graph Modeling, Proceedings of IJCAI 2019, pp. 1907–1913. https://arxiv.org/abs/1906.00121.",
        "[6] K. Cho et al., Learning Phrase Representations using RNN Encoder Decoder for Statistical Machine Translation, EMNLP 2014, pp. 1724–1734. https://arxiv.org/abs/1406.1078.",
        "[7] J. Lu, H. Tan, R. Zhao, W. Guo et al., Applications of Graph Computing and Graph Neural Networks in Power Systems A Survey, CICED 2024, DOI 10.1109/CICED63421.2024.10754312.",
        "[8] A Survey on Graph Neural Networks for Time Series Forecasting Classification Imputation and Anomaly Detection, IEEE TPAMI, 2024, DOI 10.1109/TPAMI.2024.3443141.",
        "[9] scikit-learn User Guide, Classification metrics and model evaluation. https://scikit-learn.org/stable/modules/model_evaluation.html.",
        "[10] PyTorch Documentation, Recurrent layers and neural-network modules. https://pytorch.org/docs/stable/nn.html.",
        "[11] GridPulse research review and novelty rationale, project artifact, docs/RESEARCH_NOTES.md.",
    ]
    for ref in references:
        add_para(doc, ref, after=5)
    add_heading(doc, "Appendix A Complete feature inventory", level=1)
    add_table(doc, ["Name", "Group", "Source or construction"], [[item["name"], item["group"], item["source"]] for item in feature_catalog["features"]], widths=[1.75, 1.55, 2.9], font_size=8.2)
    add_heading(doc, "Appendix B Project artifact map", level=1)
    add_table(doc, ["Artifact", "Purpose"], [
        ["backend/pipeline.py", "Standard-library preprocessing, canonicalization, baseline evaluation, graph and physical-loss artifacts"],
        ["backend/experiments.py", "Fusion GRU and DCRNN training, evaluation, figures, and checkpoints"],
        ["backend/server.py", "REST and SSE services for the dashboard"],
        ["backend/physics.py", "Haversine, resistance, current, and loss-proxy calculations"],
        ["backend/routing.py", "Alternate-path search, headroom checks, cost ranking, and bottlenecks"],
        ["frontend/app.js", "Dashboard state, charts, replay animation, and what-if interaction"],
        ["results/figures", "Saved original result figures used in this report and presentation"],
        ["results/models", "Saved Fusion GRU and DCRNN checkpoints"],
    ], widths=[2.0, 4.0], font_size=8.4)

    page_break(doc, force=True)
    add_heading(doc, "Appendix C DCRNN Training Output", level=1)
    add_para(doc, "The DCRNN experiment was trained for 40 epochs using a 24-hour lookback, 12 country nodes, 11 engineered features, two diffusion steps, and a hidden size of 24. The training and validation records below are read from the saved experiment artifact rather than reconstructed for this report.")
    add_equation(doc, r"X\in\mathbb{R}^{B\times24\times12\times11}", "DCRNN input tensor: batch, lookback, nodes, and features.")
    add_equation(doc, r"H_t=z_t\odot H_{t-1}+(1-z_t)\odot\tilde{H}_t", "Graph-informed recurrent update.")
    add_table(doc, ["Training output", "Value"], [
        ["Epochs", "40"],
        ["Final training loss", "0.01998"],
        ["Final validation loss", "0.02712"],
        ["Final training accuracy", "93.06%"],
        ["Final validation accuracy", "90.67%"],
        ["Final training macro F1", "87.60%"],
        ["Final validation macro F1", "83.99%"],
        ["Test RMSE", "633.96 MW"],
        ["Test MAE", "436.22 MW"],
        ["Test inference time", "63.63 ms"],
    ], widths=[3.1, 2.8], font_size=9.0)
    add_figure(doc, "dcrnn_training_curves.png", "Figure 10 Original saved DCRNN training output with loss and macro F1 traces.", width=5.9)
    add_para(doc, "The final DCRNN result is useful even though it does not beat Fusion GRU on this dataset. It demonstrates a complete graph-recurrent implementation, produces a saved checkpoint at results/models/dcrnn.pt, and provides evidence about the current topology and feature contract. Its lower score is interpreted as a dataset and topology finding, not as evidence that graph learning is universally ineffective.")

    page_break(doc, force=True)
    add_heading(doc, "Appendix D Dataset Schema and Provenance", level=1)
    add_para(doc, "The project separates provenance from derived analytics. The two supplied CSV files remain the source observations. The processed JSON files are deterministic contracts generated by the pipeline and are used by the API, dashboard, and experiment runner. This separation makes it possible to reproduce a result and identify whether a number was measured, derived, or assumed.")
    add_table(doc, ["Dataset element", "Meaning", "Used by"], [
        ["Country record", "One country observation at one UTC hour", "Node snapshot, feature tensor, forecast target"],
        ["Directional flow record", "One source-to-target interconnector observation", "Edge direction, magnitude, utilization"],
        ["Canonical edge", "Sorted endpoint identity after alias normalization", "Graph topology and route search"],
        ["Processed series", "Aligned arrays for load, net flow, imbalance, residual, and timestamps", "Server replay and model windows"],
        ["Manifest", "Counts, quality flags, assumptions, centrality, and graph metadata", "Validation and frontend data contract"],
    ], widths=[1.55, 2.8, 2.2], font_size=8.6)
    add_heading(doc, "Provenance rules", level=2)
    add_bullets(doc, [
        "Raw row counts are not changed silently; preprocessing records duplicate, missing, and gap counts.",
        "Country and interconnector aliases are retained as audit metadata while the model uses canonical labels.",
        "The replay cursor selects an existing timestamp; the stream does not generate random synthetic observations.",
        "Figures are exported from saved JSON or CSV result artifacts and are not redrawn inside the report.",
        "The physical-loss result is explicitly labelled a proxy because the source data lacks surveyed conductor parameters.",
    ])
    add_para(doc, "This provenance design is important for a predictive analytics course project because the same model score can be misleading if the data split, target definition, or preprocessing operation changes. GridPulse therefore stores the configuration and data-quality evidence beside the model outputs.")

    page_break(doc, force=True)
    add_heading(doc, "Appendix E Complete Feature Engineering Details", level=1)
    add_para(doc, "The feature tensor is deliberately compact. Each country receives four local signals, four system-wide summary signals, and three static graph descriptors. The construction gives Fusion GRU enough context to model temporal behaviour while allowing DCRNN to preserve the country dimension and exchange information through transitions.")
    add_table(doc, ["Feature", "Construction", "Reason for inclusion"], [
        ["Local net flow", "Observed country net flow at t", "Autoregressive anchor for the target"],
        ["Local load", "Observed country load at t", "Demand pressure changes transfer requirement"],
        ["Local imbalance", "Inflow/outflow imbalance ratio", "Separates stable transfer from directional stress"],
        ["Local load residual", "Actual load minus day-ahead forecast", "Captures unexpected demand error"],
        ["Global net flow", "Mean net flow across countries", "Represents system-wide transfer state"],
        ["Global load", "Mean load across countries", "Represents shared demand conditions"],
        ["Global imbalance", "Mean absolute imbalance", "Measures collective directional pressure"],
        ["Global residual", "Mean absolute load residual", "Signals a difficult operating period"],
        ["Degree centrality", "degree(node)/(N−1)", "Counts local connectivity"],
        ["Closeness centrality", "Inverse mean shortest-path distance", "Measures graph proximity"],
        ["Betweenness centrality", "Fraction of shortest paths through node", "Identifies bridge nodes"],
    ], widths=[1.55, 2.55, 2.45], font_size=7.9)
    add_equation(doc, r"x'=(x-\mu_{train})/\sigma_{train}", "Training-only standardization; validation and test data never determine the scaling statistics.")
    add_para(doc, "The target is next-hour country net flow. A 24-hour window is used so the model can observe one complete daily cycle while remaining small enough for the supplied data. Samples are generated separately for training, validation, and the final chronological test horizon. This avoids leakage from later hours into earlier training windows.")

    page_break(doc, force=True)
    add_heading(doc, "Appendix F DCRNN Computation Walkthrough", level=1)
    add_para(doc, "The DCRNN implementation in backend/experiments.py is compact enough to audit line by line. It first builds forward and reverse row-normalized transition matrices from the canonical graph. Self-loops are added so that a node retains its own signal while receiving information from connected nodes.")
    add_equation(doc, r"X^{(0)}=X,\quad X^{(k)}=PX^{(k-1)}", "Repeated transition multiplication propagates a signal k graph steps.")
    add_equation(doc, r"H=[X^{(0)}\Vert X_f^{(1)}\Vert X_f^{(2)}\Vert X_r^{(1)}\Vert X_r^{(2)}]W+b", "The local, forward, and reverse supports are concatenated before the graph convolution output.")
    add_numbered(doc, [
        "Receive the 24-hour window containing all 12 countries and all 11 features.",
        "At each hour, concatenate the current node input with the previous hidden state.",
        "Apply diffusion convolution to create update and reset gate values.",
        "Use the reset gate to form a candidate hidden state from current input and prior memory.",
        "Combine old memory and candidate memory using the update gate.",
        "After the final hour, apply LayerNorm and a linear head to predict one flow value per country.",
    ])
    add_para(doc, "The important difference from Fusion GRU is not that DCRNN has a recurrent unit; both models have temporal memory. The difference is that DCRNN performs explicit graph propagation before the recurrent update, whereas Fusion GRU receives graph information through engineered global summaries and centrality features. This makes DCRNN a direct test of the graph hypothesis.")

    page_break(doc, force=True)
    add_heading(doc, "Appendix G Backend API and Live Replay Data Flow", level=1)
    add_para(doc, "The backend is intentionally lightweight. server.py loads the processed artifacts at startup and exposes JSON endpoints. The frontend requests static evidence once, then receives replay snapshots through Server-Sent Events. The backend does not require a database for the course demonstration because the processed series and result files are versioned project artifacts.")
    add_table(doc, ["Endpoint", "Input", "Calculation or response"], [
        ["/api/metadata", "None", "Manifest, quality, graph, model and assumption metadata"],
        ["/api/snapshot", "Timestamp index", "Nodes, edges, risk classes, loss proxy, graph analysis"],
        ["/api/forecast", "Country, model, horizon", "History plus deterministic forecast and adaptive band"],
        ["/api/metrics", "None", "Baseline metrics and offline Fusion GRU/DCRNN evidence"],
        ["/api/stream", "SSE connection", "Next historical snapshot approximately every two seconds"],
        ["/api/what-if", "Edge ID and reduction percent", "Projected flow, route plan, bottlenecks and loss delta"],
    ], widths=[1.55, 1.75, 3.25], font_size=8.3)
    add_heading(doc, "Snapshot calculation", level=2)
    add_para(doc, "For a selected replay index, server.py reads country arrays and edge arrays at the same timestamp. It derives utilization, direction, loss, node score, and class labels, then calls graph_analysis.py for propagated influence and edge criticality. The complete snapshot is serialized as JSON and rendered by frontend/app.js.")
    add_heading(doc, "Interface honesty", level=2)
    add_para(doc, "The browser now surfaces Fusion GRU as the research model while labelling Persistence as the operational baseline. The moving particles are an animation of historical observed transfer. This distinction is important because the advanced models are trained research artifacts, while the current replay endpoint is designed for speed and transparency.")

    page_break(doc, force=True)
    add_heading(doc, "Appendix H Worked Rerouting Calculation", level=1)
    add_para(doc, "The what-if planner is a recommendation engine, not an automatic control loop. The example below shows how a selected link is evaluated. Suppose the CH–DE link carries 1,414.75 MW and the operator tests a 25% reduction. The amount to investigate moving is calculated before path search.")
    add_equation(doc, r"\mathrm{moved\ MW}=\frac{\mathrm{current\ MW}\times\mathrm{reroute\ percentage}}{100}")
    add_table(doc, ["Scenario item", "Value", "Interpretation"], [
        ["Selected edge", "CH–DE", "Edge temporarily removed from the working graph"],
        ["Current magnitude", "1,414.75 MW", "Observed replay value"],
        ["Reduction", "25%", "User-selected scenario share"],
        ["Moved transfer", "353.69 MW", "Flow investigated on alternate path"],
        ["Candidate path", "CH → AT → DE", "Connected best-effort route"],
        ["Loss change", "+37.00 MW", "Higher proxy loss; requires review"],
    ], widths=[1.65, 1.45, 3.45], font_size=8.5)
    add_heading(doc, "Path ranking", level=2)
    add_para(doc, "The route search uses a Dijkstra-style traversal. Strict search rejects an edge when its proxy headroom is less than the moved transfer or when its screening class is Critical. Surviving edges receive a cost based on distance, utilization, and loss. Warning and Critical links receive additional penalties. If no strict route exists, the planner returns a best-effort route with bottlenecks so that infeasibility is visible rather than hidden.")
    add_equation(doc, r"\mathrm{route\ cost}=\mathrm{distance}\times(1+2.2\,\mathrm{utilization}+6\,\mathrm{loss\ percentage})")

    page_break(doc, force=True)
    add_heading(doc, "Appendix I Evaluation Metric Interpretation", level=1)
    add_para(doc, "The project reports both regression and classification metrics because next-hour flow is numeric while operational screening is categorical. A model can have a strong average error and still miss Critical conditions. The report therefore combines continuous error, class balance, threshold curves, and confusion matrices.")
    add_table(doc, ["Metric", "Formula or meaning", "Interpretation in this project"], [
        ["MAE", "Mean absolute MW error", "Persistence 375.8 MW; Fusion GRU 400.3 MW"],
        ["RMSE", "Square root of mean squared error", "Fusion GRU 570.5 MW; lower is better for large mistakes"],
        ["Accuracy", "Correct labels / all labels", "Fusion GRU 92.7%; DCRNN 92.5%"],
        ["Precision", "TP/(TP+FP)", "Reliability when a risk class is predicted"],
        ["Recall", "TP/(TP+FN)", "Ability to find actual risk cases"],
        ["F1", "Harmonic mean of precision and recall", "Fusion GRU 85.6%; balances false alarms and misses"],
        ["Inference time", "Time to produce predictions", "DCRNN 63.6 ms; graph diffusion costs more"],
    ], widths=[1.15, 2.55, 2.85], font_size=8.1)
    add_equation(doc, r"F_1=\frac{2\,\mathrm{Precision}\,\mathrm{Recall}}{\mathrm{Precision}+\mathrm{Recall}}")
    add_heading(doc, "Why thresholds are based on the training data", level=2)
    add_para(doc, "The classification experiment uses absolute net-flow magnitudes at the 75th and 90th training quantiles for Warning and Critical. This makes the boundary data-derived rather than arbitrary. The dashboard node screen also uses a 0–100 composite score with Normal below 65, Warning from 65 to 84, and Critical at 85 or above. These are two different layers: the first labels model targets; the second summarizes live graph-screening pressure.")

    page_break(doc, force=True)
    add_heading(doc, "Appendix J Testing and Validation Matrix", level=1)
    add_para(doc, "Testing covers both numerical behavior and service integration. Unit tests do not prove engineering validity, but they reduce the chance that a route, loss, threshold, or API response is wrong because of a software defect.")
    add_table(doc, ["Test area", "Evidence", "What it protects"], [
        ["Pipeline", "tests/test_pipeline.py", "Distance-loss, preprocessing, threshold and artifact behavior"],
        ["Routing", "tests/test_routing.py", "Feasible, no-change, best-effort and bottleneck cases"],
        ["API", "tests/test_api.py", "Endpoint availability and response structure"],
        ["Layout", "Rendered report pages and figure inspection", "Clipping, overlap, equations and page geometry"],
        ["Model evaluation", "Chronological holdout and saved JSON metrics", "Leakage control and reproducibility"],
        ["Data quality", "Manifest missing, duplicate and gap counts", "Visibility of incomplete observations"],
    ], widths=[1.4, 2.25, 2.9], font_size=8.4)
    add_heading(doc, "Validation boundaries", level=2)
    add_bullets(doc, [
        "The capacity proxy is not a verified thermal rating.",
        "The loss estimate is not a surveyed line-loss study.",
        "The graph topology is not a complete electrical admittance matrix.",
        "The recommendation is not an N-1 security assessment.",
        "The historical stream is not connected to live utility telemetry.",
    ])
    add_para(doc, "These boundaries are part of the validation result. A technically responsible analytics system must describe what its evidence supports and what remains outside the experiment.")

    page_break(doc, force=True)
    add_heading(doc, "Appendix K Reproducibility and Artifact Map", level=1)
    add_para(doc, "A new user can reproduce the dashboard and research artifacts using the following sequence from the project root. The pipeline step is needed when the source data or preprocessing code changes; the server step is sufficient for replaying existing processed artifacts.")
    add_table(doc, ["Command", "Purpose"], [
        ["python backend/pipeline.py", "Read CSVs, validate, canonicalize, build processed JSON and baseline metrics"],
        ["python backend/experiments.py", "Train Fusion GRU and DCRNN, save checkpoints, metrics and figures"],
        ["python backend/server.py", "Start the local REST and SSE dashboard service"],
        ["Open http://localhost:8000", "Use the browser interface for replay, forecast and what-if routing"],
    ], widths=[2.7, 3.85], font_size=8.7)
    add_heading(doc, "Saved evidence", level=2)
    add_bullets(doc, [
        "results/model_comparison.json stores the common-holdout metrics.",
        "results/dcrnn_training_curves.json stores epoch-level training output.",
        "results/models/fusion_gru.pt and results/models/dcrnn.pt store trained checkpoints.",
        "results/figures contains the original exported charts used in the report and presentation.",
        "data/processed/manifest.json records graph structure, quality flags, and physical assumptions.",
    ])
    add_para(doc, "The final implementation therefore has two reproducible modes. The research mode trains and evaluates neural models with PyTorch. The dashboard mode loads compact artifacts and runs a lightweight local replay service. The report keeps the modes distinct so a reader can understand both the research result and the practical interface behavior.")

    doc.save(OUT_DOCX)
    print(OUT_DOCX)


if __name__ == "__main__":
    build_report()
