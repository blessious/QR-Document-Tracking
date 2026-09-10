from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION_START
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "office-staff-guide" / "lgu-doctrack-staff-instruction-manual.docx"

NAVY = "173A74"
TEAL = "168D9C"
PALE_BLUE = "EAF3FB"
PALE_TEAL = "EAF8F8"
PALE_GRAY = "F5F7FA"
MID_GRAY = "D9D9D9"
INK = "1F2937"
MUTED = "5B687A"
WHITE = "FFFFFF"


def set_run_font(run, name="Arial", size=None, color=None, bold=None, italic=None):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = RGBColor.from_string(color)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120):
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


def set_cell_borders(cell, color=MID_GRAY, size="6"):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        node = borders.find(qn(tag))
        if node is None:
            node = OxmlElement(tag)
            borders.append(node)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), size)
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), color)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_cant_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    cant_split.set(qn("w:val"), "true")
    tr_pr.append(cant_split)


def set_table_widths(table, widths):
    table.autofit = False
    total_twips = int(sum(widths) * 1440)
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(total_twips))
    tbl_w.set(qn("w:type"), "dxa")
    for idx, width in enumerate(widths):
        width_twips = str(int(width * 1440))
        table.columns[idx].width = Inches(width)
        for row in table.rows:
            cell = row.cells[idx]
            cell.width = Inches(width)
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), width_twips)
            tc_w.set(qn("w:type"), "dxa")


def style_paragraph(paragraph, size=10.5, color=INK, space_after=6, line=1.12):
    paragraph.paragraph_format.space_after = Pt(space_after)
    paragraph.paragraph_format.line_spacing = line
    for run in paragraph.runs:
        set_run_font(run, size=size, color=color)


def add_text(doc, text="", style=None, size=10.5, color=INK, bold=False, italic=False,
             align=None, space_before=0, space_after=6, line=1.12):
    p = doc.add_paragraph(style=style)
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line
    run = p.add_run(text)
    set_run_font(run, size=size, color=color, bold=bold, italic=italic)
    return p


def add_rich_paragraph(doc, parts, style=None, size=10.5, space_after=6, line=1.12):
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line
    for part in parts:
        if isinstance(part, str):
            text, bold, italic, color = part, False, False, INK
        else:
            text = part.get("text", "")
            bold = part.get("bold", False)
            italic = part.get("italic", False)
            color = part.get("color", INK)
        run = p.add_run(text)
        set_run_font(run, size=size, color=color, bold=bold, italic=italic)
    return p


def add_heading(doc, text, level=1):
    if level == 1 and text[:1].isdigit():
        doc._manual_number = 0
    p = doc.add_paragraph(style=f"Heading {level}")
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(5)
    run = p.add_run(text)
    set_run_font(run, size=17 if level == 1 else 12.5, color="000000", bold=True)
    return p


def add_bullet(doc, text, level=0):
    style = "List Bullet" if level == 0 else "List Bullet 2"
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.08
    run = p.add_run(text)
    set_run_font(run, size=10.2, color=INK)
    return p


def add_number(doc, text):
    doc._manual_number = getattr(doc, "_manual_number", 0) + 1
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.28)
    p.paragraph_format.first_line_indent = Inches(-0.24)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.08
    run = p.add_run(f"{doc._manual_number}.  {text}")
    set_run_font(run, size=10.2, color=INK)
    return p


def add_label(doc, text, color=TEAL):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(3)
    run = p.add_run(text.upper())
    set_run_font(run, size=8.5, color=color, bold=True)
    return p


def add_table(doc, headers, rows, widths, header_fill=NAVY, alternating=True, font_size=9.2):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    set_table_widths(table, widths)
    header = table.rows[0]
    set_repeat_table_header(header)
    set_cant_split(header)
    for idx, value in enumerate(headers):
        cell = header.cells[idx]
        set_cell_shading(cell, header_fill)
        set_cell_borders(cell)
        set_cell_margins(cell, top=110, start=120, bottom=110, end=120)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(value)
        set_run_font(run, size=font_size, color=WHITE, bold=True)
    for row_idx, row_values in enumerate(rows):
        row = table.add_row()
        set_cant_split(row)
        fill = PALE_BLUE if alternating and row_idx % 2 == 1 else WHITE
        for idx, value in enumerate(row_values):
            cell = row.cells[idx]
            set_cell_shading(cell, fill)
            set_cell_borders(cell)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.08
            run = p.add_run(str(value))
            set_run_font(run, size=font_size, color=INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    return table


def add_screenshot_placeholder(doc, label, hint, height_lines=5):
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(3)
    run = p.add_run(f"Screenshot placeholder  {label}")
    set_run_font(run, size=9, color=TEAL, bold=True)
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    cell = table.cell(0, 0)
    cell.width = Inches(6.55)
    set_cell_shading(cell, PALE_GRAY)
    set_cell_borders(cell, color="B9C4D0", size="8")
    set_cell_margins(cell, top=130, start=160, bottom=130, end=160)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cant_split(table.rows[0])
    p1 = cell.paragraphs[0]
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p1.paragraph_format.space_after = Pt(5)
    r1 = p1.add_run("INSERT ACTUAL APP SCREENSHOT HERE")
    set_run_font(r1, size=11, color=MUTED, bold=True)
    p2 = cell.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_after = Pt(3)
    r2 = p2.add_run(hint)
    set_run_font(r2, size=9, color=MUTED, italic=True)
    for _ in range(height_lines):
        blank = cell.add_paragraph(" ")
        blank.paragraph_format.space_after = Pt(0)
        blank.paragraph_format.line_spacing = 1.0
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


def add_page_break(doc):
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


def add_footer(section):
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("LGU DocTrack  |  Staff Instruction Manual  |  ")
    set_run_font(r, size=8, color=MUTED)
    r2 = p.add_run()
    set_run_font(r2, size=8, color=MUTED)
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    r2._r.append(fld_char1)
    r2._r.append(instr_text)
    r2._r.append(fld_char2)


def build():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.65)
    section.left_margin = Inches(0.78)
    section.right_margin = Inches(0.78)
    add_footer(section)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Arial"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Arial")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Arial")
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(INK)
    for name, size in (("Title", 28), ("Heading 1", 17), ("Heading 2", 12.5), ("Heading 3", 10.8)):
        style = styles[name]
        style.font.name = "Arial"
        style._element.rPr.rFonts.set(qn("w:ascii"), "Arial")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Arial")
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string("000000")
    for name in ("List Bullet", "List Bullet 2", "List Number"):
        style = styles[name]
        style.font.name = "Arial"
        style._element.rPr.rFonts.set(qn("w:ascii"), "Arial")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Arial")
        style.font.size = Pt(10.2)
        style.font.color.rgb = RGBColor.from_string(INK)

    core = doc.core_properties
    core.title = "LGU DocTrack Staff Instruction Manual"
    core.subject = "Instructions for registering, routing, receiving, dispatching, completing and filing documents"
    core.author = "LGU DocTrack"
    core.keywords = "LGU DocTrack, QR, tracking slip, receive, dispatch, filing"

    # Cover
    add_text(doc, "LGU DOCTRACK", size=12, color=NAVY, bold=True, space_after=14)
    title = doc.add_paragraph(style="Title")
    title.paragraph_format.space_after = Pt(8)
    run = title.add_run("Staff Instruction Manual")
    set_run_font(run, size=28, color="000000", bold=True)
    add_text(doc, "Using the QR document tracking system", size=14, color=TEAL, space_after=22)
    add_text(
        doc,
        "This manual explains the full document journey inside LGU DocTrack: sign in, create a tracking slip, print and attach the QR label, receive the document, dispatch it to a selected office, complete it from the current custody office, and file the finished record.",
        size=12,
        color=INK,
        space_after=14,
        line=1.22,
    )
    add_text(
        doc,
        "For office staff, office heads and receiving personnel",
        size=10.5,
        color=MUTED,
        italic=True,
        space_after=4,
    )
    add_text(doc, "Version 1.0  |  09 September 2026", size=9.5, color=MUTED, space_after=20)
    add_screenshot_placeholder(
        doc,
        "Cover or sign in page",
        "Replace this area with a screenshot of the actual LGU DocTrack sign in page.",
        height_lines=7,
    )
    add_rich_paragraph(
        doc,
        [
            {"text": "Using the screenshot placeholders. ", "bold": True, "color": NAVY},
            "The boxes marked Screenshot placeholder are sized for later insertion of screenshots from the live application. Keep the caption so staff can match the screenshot to the instruction.",
        ],
        size=9.5,
        space_after=0,
    )

    add_page_break(doc)

    # Contents and operating model
    add_heading(doc, "How to use this manual", 1)
    add_text(
        doc,
        "Read Sections 1 through 5 once before handling documents. After that, use the quick reference sections for the specific action you are performing. The screen labels in this manual match the current application labels, including Create Tracking Slip, Expected incoming, Scan, Document registry, Filing & archives and the Confirm dispatch dialog.",
        space_after=9,
    )
    add_table(
        doc,
        ["Section", "What it covers"],
        [
            ("1  Know the workspace", "Main navigation, scanner station and the meaning of the document record."),
            ("2  Sign in", "Account access, mobile behavior and common sign in errors."),
            ("3  Create Tracking Slip", "Document details, priority deadline, optional attachments and QR generation."),
            ("4  Print and attach", "Printing, attaching and reprinting the routing slip."),
            ("5  Receive First Scan Dispatch Second Scan", "The normal custody cycle from one office to the next."),
            ("6  Select the office", "Default routing, manual destinations, optional checkpoints and detours."),
            ("7  Complete and file", "Last office completion and physical archive location."),
            ("8  Exceptions and recovery", "Wrong office, holds, returns, unknown QR labels and network errors."),
            ("9  Search and monitor", "Office queue, incoming queue, registry, detail record, notifications and public tracking."),
            ("10  Quick reference", "Status meanings and a printable handling checklist."),
        ],
        [2.35, 4.1],
        font_size=9.1,
    )
    add_heading(doc, "The document lifecycle", 1)
    add_text(
        doc,
        "LGU DocTrack records custody, not just document registration. The physical folder must travel with the printed QR routing slip. Every handoff updates the same record and adds an event to the custody timeline.",
        space_after=7,
    )
    add_table(
        doc,
        ["Stage", "Staff action", "System result"],
        [
            ("Register", "Create the tracking slip and save the record.", "Tracking code and QR reference are generated."),
            ("Print", "Print the routing slip and attach it to the physical folder.", "The same identifiers remain available for reprinting."),
            ("Receive", "At the expected destination, scan the QR label once.", "The receiving office becomes the current office."),
            ("Process", "Work on the document and use In process, Hold or Resume as needed.", "The status and remarks are logged."),
            ("Dispatch", "Scan the same label again and confirm the destination.", "The document becomes In transit and the next office is notified."),
            ("Complete", "At the office currently holding custody, mark the document complete.", "The record becomes Completed and is ready for filing."),
            ("File", "Enter a physical cabinet, drawer, shelf or folder location.", "The record becomes Filed and remains searchable in the archive index."),
        ],
        [1.0, 2.45, 3.0],
        header_fill=TEAL,
        font_size=8.9,
    )
    add_rich_paragraph(
        doc,
        [
            {"text": "Important. ", "bold": True, "color": NAVY},
            "At the office where the document is created, registration already places the document in that office's custody. The first scan there opens dispatch. At the next office, the first scan is the receive action. This is why the same QR label can produce different actions depending on the saved custody state.",
        ],
        size=10.2,
        space_after=0,
    )

    # Section 1
    add_heading(doc, "1  Know the workspace", 1)
    add_text(doc, "After sign in, desktop users see the main LGU DocTrack workspace. The left navigation is grouped by purpose. On a phone, the scanner uses a separate receiving station layout with bottom tabs.", space_after=7)
    add_table(
        doc,
        ["Area", "Screen label", "Use it for"],
        [
            ("Workspace", "My office", "See documents currently logged to your office and the actions available to your role."),
            ("Workspace", "Expected incoming", "See documents dispatched to your office and start receiving them when the physical copy arrives."),
            ("Documents", "Document registry", "Search all records available to your office, filter them and open a full record."),
            ("Documents", "Create tracking slip", "Register a new physical document and generate its QR routing slip."),
            ("Documents", "Filing & archives", "Complete the final filing step and search archived records by code, title or location."),
            ("Documents", "Public tracking", "Look up a tracking code or QR reference without signing in."),
            ("Insights", "Notifications", "Read alerts about registrations, dispatches, receipts, holds, returns, wrong-office scans and filing."),
            ("Scanner station", "Scan, Receive, Dispatch, Queue", "Perform mobile receiving and dispatching, see the receive queue and open the office queue."),
        ],
        [1.15, 1.65, 3.65],
        font_size=8.9,
    )
    add_heading(doc, "Desktop and mobile scanner views", 2)
    add_bullet(doc, "Desktop navigation can be collapsed. Use Search workspace if you need to find a screen quickly.")
    add_bullet(doc, "The mobile scanner header shows Receiving station and the signed in office. On smaller screens, use the bottom tabs: Scan, Receive, Dispatch and Queue.")
    add_bullet(doc, "Camera scanning requires HTTPS on a mobile device. If camera permission is unavailable, use Manual entry with the printed QR reference such as QR-000418.")
    add_bullet(doc, "The avatar and account menu identify the current user. Use Sign out when you finish using a shared receiving device.")
    add_screenshot_placeholder(doc, "Workspace navigation", "Show the left navigation, current office and the main worklist.", height_lines=5)

    add_heading(doc, "What one document record contains", 2)
    add_text(doc, "Open a record from the registry or from View full record on the scanner result. The document details page is the source of truth when staff need to confirm where the physical folder should be.", space_after=5)
    add_table(
        doc,
        ["Record area", "What to check"],
        [
            ("Current state", "Current office, next office, origin, priority, status, requester, registration time, target completion and remarks."),
            ("Custody timeline", "Every registered, dispatched, received, processed, held, returned, completed, filed or wrong-office event."),
            ("Attachments", "Scanned or digital reference copies attached to the tracking record."),
            ("Attachments", "Optional files uploaded during registration. Download only when your role and office need the reference copy."),
            ("QR reference", "The QR code and tracking code that must remain with the physical folder."),
            ("Routing actions", "The actions currently allowed from the saved status and custody office."),
        ],
        [1.55, 4.9],
        font_size=9.0,
    )

    # Section 2
    add_heading(doc, "2  Sign in", 1)
    add_text(doc, "Use your assigned LGU DocTrack account. Do not share an account because the system records the user who registered, received, dispatched, completed or filed a document.", space_after=7)
    add_number(doc, "Open the LGU DocTrack web address provided by your administrator.")
    add_number(doc, "Enter your Username in the first field.")
    add_number(doc, "Enter your Password in the second field. Use the eye icon if you need to show or hide the password while checking it.")
    add_number(doc, "Select Login. If either field is blank, the page asks you to enter both values. If the credentials are rejected, the page shows Invalid username or password.")
    add_number(doc, "After a successful sign in, desktop users are sent to the home screen for their role. On a phone, the app opens the scanner station so receiving staff can begin scanning immediately.")
    add_number(doc, "If you only need to look up a document, select Track document. Public tracking does not require sign in and uses the printed tracking code or QR reference.")
    add_screenshot_placeholder(doc, "Sign in screen", "Show the Username field, Password field, password visibility icon, Track document link and Login button.", height_lines=6)
    add_heading(doc, "Sign in checks", 2)
    add_table(
        doc,
        ["What you see", "What to do"],
        [
            ("Enter both your username and password", "Complete both fields and select Login again."),
            ("Invalid username or password", "Check the spelling, keyboard layout and password. If the problem continues, contact the system administrator."),
            ("Sign in to continue", "Your session has expired or you opened a protected page directly. Return to the sign in page."),
            ("Camera needs HTTPS on mobile", "Open the HTTPS application address and grant camera permission. Use manual entry if the camera still cannot start."),
        ],
        [2.2, 4.25],
        header_fill=TEAL,
        font_size=9.0,
    )

    # Section 3
    add_heading(doc, "3  Create Tracking Slip", 1)
    add_text(doc, "Create Tracking Slip is used at the office that registers the document. Complete the three steps in order. The document is not created until you select Register and generate QR on the last step.", space_after=7)
    add_heading(doc, "Step one document details", 2)
    add_text(doc, "Enter enough information for the next office to identify the folder without opening it. The title and document type are required before you can continue.", space_after=5)
    add_table(
        doc,
        ["Field or control", "What to enter or select", "Required"],
        [
            ("Document title", "A clear title that identifies the document, for example DV - Fuel and lubricants September 2026.", "Yes"),
            ("Subject / purpose", "A short explanation of what the document is for and why it is being routed.", "No"),
            ("Document type", "Select the closest active document type.", "Yes"),
            ("Priority", "Select Routine, Urgent or Rush. Choose the priority that matches the office handling instruction.", "Yes"),
            ("Upload Document", "Optional scanned or digital copies in PDF, Word, Excel, JPG or PNG format. Each file must be 10 MB or smaller.", "No"),
        ],
        [1.45, 4.2, 0.8],
        font_size=8.9,
    )
    add_number(doc, "Select the document type and priority. Priority determines the target completion deadline.")
    add_number(doc, "If you attach a file, confirm that it is the correct reference copy. Uploading a file does not replace the physical document or the printed QR slip.")
    add_number(doc, "Select Continue. If the title or document type is missing, the system stops you and displays an error.")
    add_screenshot_placeholder(doc, "Create Tracking Slip document details", "Show the title, subject or purpose, document type, priority and upload controls.", height_lines=5)

    add_heading(doc, "Step two routing", 2)
    add_text(doc, "The routing screen determines which offices should handle the physical document and the service-level hours for each step.", space_after=5)
    add_number(doc, "Review the document details and optional remarks before continuing.")
    add_number(doc, "Read the Preview route from top to bottom. Each line shows a step number, step name, responsible office and SLA hours.")
    add_number(doc, "If the default route is correct, leave it selected and continue.")
    add_number(doc, "Add any scanned or digital reference files if needed, then continue to QR generation.")
    add_number(doc, "Use Remarks optional for registration notes that the next office should see. Keep remarks factual and concise.")
    add_screenshot_placeholder(doc, "Document registration review", "Show the document details, priority, attachments and remarks before QR generation.", height_lines=5)

    add_heading(doc, "Review before registration", 2)
    add_table(
        doc,
        ["Choice", "When to use it", "What happens"],
        [
            ("Priority", "Choose routine, urgent or rush.", "The configured service-level hours become the document deadline."),
            ("Initial custody", "Registration keeps the document at the registering office.", "No destination is assigned until staff explicitly dispatch it."),
            ("Customize route", "Use only when the document needs a one-time route change and you are authorized to make it.", "You can edit step names, choose active offices, move steps up or down, remove a step or add a step. The customized route is saved with this document."),
        ],
        [1.45, 2.35, 2.65],
        header_fill=NAVY,
        font_size=8.7,
    )
    add_rich_paragraph(
        doc,
        [
            {"text": "Route carefully. ", "bold": True, "color": NAVY},
            "After registration, the current office selects any active destination office when the physical document is ready to leave its custody.",
        ],
        size=10.1,
        space_after=6,
    )

    add_heading(doc, "Step three QR label", 2)
    add_number(doc, "Review the summary. Confirm the title, priority and any uploaded documents.")
    add_number(doc, "Select Register and generate QR. Wait for the success confirmation before leaving the page.")
    add_number(doc, "The confirmation page shows the tracking code, QR reference, origin office and next office. The document is now registered and the same identifiers should be used for every later scan.")
    add_number(doc, "Select Print routing slip. If you need to print later, select Open document and use Reprint slip on the document details page.")
    add_number(doc, "Select Back to registry when finished, or Register another to start a new record.")
    add_screenshot_placeholder(doc, "Document registered confirmation", "Show the generated QR reference, tracking code, Print routing slip, Open document and Register another buttons.", height_lines=5)

    # Section 4
    add_heading(doc, "4  Print and attach", 1)
    add_text(doc, "The QR routing slip is the physical link between the folder and the electronic custody record. Print it as soon as the document is registered and attach it securely before dispatch.", space_after=7)
    add_number(doc, "From the Document registered confirmation page, select Print routing slip. A printable slip opens in a new browser tab or window.")
    add_number(doc, "Check that the QR image and the printed tracking code are clear and complete. Do not use a blurred, cropped or partly printed label.")
    add_number(doc, "Attach the slip to the front of the folder or to the routing cover where the receiving office can scan it without removing the physical papers.")
    add_number(doc, "Keep the physical folder and the label together during every handoff. Do not create a second slip for the same document.")
    add_number(doc, "If the slip is damaged or lost, open the record from Document registry and select Reprint slip. Reprinting does not create a new document and does not change the tracking code or QR reference.")
    add_screenshot_placeholder(doc, "Printable routing slip", "Replace this area with the actual printable slip, including the QR image and tracking code.", height_lines=7)
    add_rich_paragraph(
        doc,
        [
            {"text": "Before dispatch checklist. ", "bold": True, "color": NAVY},
            "The physical document is complete, the QR label is readable, the destination office matches the saved route, and any required supporting papers are attached.",
        ],
        size=10.1,
        space_after=0,
    )

    # Section 5
    add_heading(doc, "5  Receive First Scan Dispatch Second Scan", 1)
    add_text(doc, "The normal handoff uses the same QR label twice at each receiving office: the first scan records receipt, and the second scan starts dispatch after the office has finished its work. The action offered by the scanner is based on the saved custody state, not on a global scan counter.", space_after=7)
    add_heading(doc, "First scan receive", 2)
    add_number(doc, "When the physical document arrives, open Scan on the mobile receiving station or select Scan to receive from Expected incoming.")
    add_number(doc, "Allow camera access if prompted. Hold the QR label inside the square on the camera view and keep it steady until the system detects it.")
    add_number(doc, "If the camera is unavailable, type the QR reference printed on the slip into Manual entry, for example QR-000418, and select Go.")
    add_number(doc, "When the document is routed to your office, the result shows Document received. Receipt is saved automatically; do not look for a second Receive document confirmation button.")
    add_number(doc, "Confirm that the physical folder is now in your custody. The status becomes Received, the current office changes to your office and the document appears in the Office queue.")
    add_screenshot_placeholder(doc, "Receive scan result", "Show the camera frame, Manual entry field, Document received confirmation and View full record link.", height_lines=5)
    add_rich_paragraph(
        doc,
        [
            {"text": "Expected incoming. ", "bold": True, "color": NAVY},
            "This screen lists documents that another office has dispatched to you. Use its search field to find a tracking code or title, then select Details or Scan to receive. The queue refreshes periodically, so a newly dispatched document may take a short time to appear.",
        ],
        size=10.1,
        space_after=7,
    )

    add_heading(doc, "Process the document", 2)
    add_text(doc, "After receipt, open the record when you need to review the custody timeline or attachments. Use the Routing actions area to record the work state.", space_after=5)
    add_table(
        doc,
        ["Action", "When to use it", "Result"],
        [
            ("In process / resume", "Start work or resume after a hold.", "The record shows that processing is active and the hold is cleared."),
            ("Hold", "Work cannot continue temporarily.", "The document is placed On hold. Remarks are required."),
            ("Dispatch", "Work at this office is ready for the next office.", "Opens Confirm dispatch so you can review the destination and send the record In transit."),
            ("Return to origin", "The document must go back to the registering office.", "Requires a reason and sends the document In transit to the origin office."),
        ],
        [1.55, 2.75, 2.15],
        header_fill=TEAL,
        font_size=8.9,
    )

    add_heading(doc, "Second scan dispatch", 2)
    add_number(doc, "After your office finishes its work, scan the same QR label again. Because the record is already in your custody, the result shows Document ready to dispatch.")
    add_number(doc, "Review the Confirm dispatch dialog. It shows the tracking code and document title and states that custody remains unchanged until you confirm.")
    add_number(doc, "Select Destination office from the active offices listed. The current custody office is excluded.")
    add_number(doc, "Add dispatch remarks if the next office needs context. Remarks are especially important for manual transfers, returns or special handling.")
    add_number(doc, "Select Confirm dispatch. The system changes the status to In transit, records the sending and receiving offices and notifies the destination office.")
    add_number(doc, "Hand the physical folder to the destination office. The electronic record is not a substitute for the physical handoff.")
    add_screenshot_placeholder(doc, "Confirm dispatch dialog", "Show the destination office selector, remarks field, Cancel and Confirm dispatch buttons.", height_lines=6)
    add_rich_paragraph(
        doc,
        [
            {"text": "Camera behavior. ", "bold": True, "color": NAVY},
            "When the camera detects a label, it stops while the result or dispatch dialog is open. Wait for the result before moving on. Keeping the QR label in the camera frame does not create extra receipt or dispatch events.",
        ],
        size=10.1,
        space_after=0,
    )

    # Section 6
    add_heading(doc, "6  Select the office", 1)
    add_text(doc, "Office selection happens in two different places: the route selected during registration and the destination selected during dispatch. Use the default route whenever it matches the document's normal process.", space_after=7)
    add_heading(doc, "Registration and initial custody", 2)
    add_number(doc, "Register the document with its type and priority.")
    add_number(doc, "The document remains in the registering office's custody with no destination.")
    add_number(doc, "When it is ready to leave, scan the label and select the destination office.")

    add_heading(doc, "Selecting a destination during dispatch", 2)
    add_text(doc, "The Confirm dispatch destination list excludes the current office and includes active offices only.", space_after=5)
    add_table(
        doc,
        ["Control", "What it does", "Staff instruction"],
        [
            ("Destination office", "Shows the office that will receive the physical folder.", "Select the office that should receive custody next."),
            ("Active offices", "Lists every active office except the current custody office.", "Confirm the destination before dispatching."),
            ("All offices", "Expands the list to every active office.", "Use only for an approved detour or special transfer. Add clear remarks."),
            ("Confirm dispatch", "Saves the transfer and changes the record to In transit.", "Select only after checking the physical folder and destination."),
        ],
        [1.55, 2.65, 2.25],
        header_fill=NAVY,
        font_size=8.8,
    )
    add_rich_paragraph(
        doc,
        [
            {"text": "Required checkpoints. ", "bold": True, "color": NAVY},
            "A manual destination does not automatically cancel required offices. The system allows optional checkpoints to be bypassed when the route permits it, but it rejects a route that would skip a required checkpoint.",
        ],
        size=10.1,
        space_after=6,
    )

    add_heading(doc, "Normal three office example", 2)
    add_table(
        doc,
        ["Office", "First scan at that office", "Second scan at that office"],
        [
            ("Office A origin", "Registration already puts the record in custody. A scan shows Document ready to dispatch.", "Confirm dispatch to Office B."),
            ("Office B", "The first scan shows Document received. Receipt is automatic.", "After processing, scan again and confirm dispatch to Office C."),
            ("Office C final step", "The first scan shows Document received.", "After processing, scan again to review the completion action, then mark complete and file the record."),
        ],
        [1.55, 2.5, 2.4],
        header_fill=TEAL,
        font_size=8.9,
    )

    add_heading(doc, "Detours and returns", 2)
    add_bullet(doc, "Any office holding custody may dispatch the document to another active office after completing its work.")
    add_bullet(doc, "To send a document back to the origin, use Return to origin from Routing actions. Enter a reason. The origin office must scan it to receive it again.")
    add_bullet(doc, "A return transfers the document back to the origin office, which must scan to receive it.")

    # Section 7
    add_heading(doc, "7  Complete and file", 1)
    add_text(doc, "The office currently holding custody must complete the electronic record before it can be filed. Scanning alone does not complete the document, and filing is not allowed before completion.", space_after=7)
    add_heading(doc, "Mark the last office step complete", 2)
    add_number(doc, "Confirm that the document is in your office's custody and its status is Received or In process.")
    add_number(doc, "Finish the office's work. If the document is On hold, select In process / resume and resolve the issue before trying to complete it.")
    add_number(doc, "Scan the QR label again, or open the document details page and use Routing actions. The scanner should show Document ready to complete and the button Mark as complete.")
    add_number(doc, "Review the document details and custody timeline, then confirm the office's work is finished.")
    add_number(doc, "Select Mark as complete and confirm the prompt if shown. The status changes to Completed and the record moves to the filing worklist.")
    add_screenshot_placeholder(doc, "Final office completion", "Show the final-office scan result or Routing actions with Mark as complete.", height_lines=5)
    add_rich_paragraph(
        doc,
        [
            {"text": "If completion is blocked. ", "bold": True, "color": NAVY},
            "Read the message below the actions. Common causes are a document still On hold, in transit, or held by another office. Resolve the cause, refresh the record and try again.",
        ],
        size=10.1,
        space_after=7,
    )

    add_heading(doc, "File the completed document", 2)
    add_number(doc, "Open Filing & archives. The Awaiting filing area lists Completed documents that still need a physical location.")
    add_number(doc, "Find the document by title or tracking code. Open its actions if you need to review the record before filing.")
    add_number(doc, "Enter the physical File location, such as Cabinet B Drawer 2 Folder 14 or Records Room Shelf 3 Box 6. Use a specific location that another staff member can find.")
    add_number(doc, "Select File to archives. The status changes to Filed and the location is recorded in the archive index.")
    add_number(doc, "Confirm the archive index shows the tracking code, title, location, filed date and Filed status.")
    add_screenshot_placeholder(doc, "Filing and archive index", "Show Awaiting filing, File location, File to archives and the archive index.", height_lines=5)
    add_rich_paragraph(
        doc,
        [
            {"text": "After filing. ", "bold": True, "color": NAVY},
            "The record displays Archived at the saved location. Further scans do not offer a receive or dispatch action. If someone needs to verify the record, use Document registry, Filing & archives or Public tracking.",
        ],
        size=10.1,
        space_after=0,
    )

    # Section 8
    add_heading(doc, "8  Exceptions and recovery", 1)
    add_text(doc, "Use the system messages to decide what to do next. Do not accept a physical folder into your office when the scan says it is routed elsewhere unless the authorized process instructs you to report the misrouting.", space_after=7)
    add_table(
        doc,
        ["Situation", "What the screen shows", "Correct response"],
        [
            ("Wrong office", "Wrong office. The message names the office to which the document is routed.", "Do not accept it as received. Select Report misrouting so the event is recorded, then return the folder for correction."),
            ("Unknown QR label", "Unrecognised QR label.", "Check that the code was typed correctly. If the printed slip is not registered, ask the releasing office to reprint the routing slip and verify the record."),
            ("Already in transit or filed", "No scan action available.", "Do not scan repeatedly. Open View full record and check the current office, next office and status."),
            ("Document on hold", "Dispatch or completion is unavailable.", "Read the remarks, resolve the issue, enter any required remarks and select In process / resume."),
            ("Return needed", "Return to origin action is available.", "Enter a clear reason and confirm. The origin office must scan to receive the return."),
            ("Connection or session error", "The action fails or asks you to sign in again.", "Do not assume the action was saved. Sign in again if needed, refresh the record and verify the current status before retrying."),
            ("Document changed since you opened it", "The record reports a conflict and asks you to refresh.", "Cancel the old action, refresh the record and make the decision using the newest status."),
        ],
        [1.35, 2.35, 3.0],
        header_fill=NAVY,
        font_size=8.6,
    )
    add_heading(doc, "Hold a document", 2)
    add_number(doc, "Open the document while it is in your custody.")
    add_number(doc, "Enter the reason in Remarks / return reason. The hold action is disabled until the remarks field contains text.")
    add_number(doc, "Select Hold. The event and remarks are added to the custody timeline and the document becomes On hold.")
    add_number(doc, "When work can continue, select In process / resume. Check that dispatch or completion is available again before moving the document.")
    add_heading(doc, "Wrong office scans", 2)
    add_text(doc, "A wrong-office scan creates a warning event but does not transfer custody to the scanning office. The receiving office should not select a normal receive action for a document addressed to another office. Use Report misrouting and notify the sending or expected office according to local procedure.", space_after=5)
    add_screenshot_placeholder(doc, "Wrong office or unknown QR result", "Show the warning message, the routed office and Report misrouting action.", height_lines=5)
    add_heading(doc, "Safe retry rules", 2)
    add_bullet(doc, "If you do not see a success confirmation, check the document registry or full record before trying the action again.")
    add_bullet(doc, "If a registration page fails after you selected Register and generate QR, search by title or the confirmation information before creating another slip.")
    add_bullet(doc, "If camera detection stops unexpectedly, select the camera button to start again or use Manual entry.")
    add_bullet(doc, "If the browser session expires, sign in again and confirm the current status before continuing.")

    # Section 9
    add_heading(doc, "9  Search and monitor", 1)
    add_heading(doc, "My office", 2)
    add_text(doc, "Use My office as the daily worklist. It shows the records currently associated with your office and provides links to expected incoming, receive or dispatch work. Review the status badge and due date before acting.", space_after=5)
    add_heading(doc, "Expected incoming", 2)
    add_text(doc, "Expected incoming lists documents another office has dispatched to your office. Search by tracking code or title, check the From office and dispatch time, and use Scan to receive when the physical copy arrives. The receiving office selector is normally limited to your office; administrators may switch offices for support.", space_after=5)
    add_heading(doc, "Document registry", 2)
    add_text(doc, "Document registry is the searchable list of records available to your role. Search by tracking code, QR code, title or requester. You can also filter by status, office or document type.", space_after=5)
    add_table(
        doc,
        ["Registry control", "Use"],
        [
            ("Search code, title, requester", "Enter part of a tracking code, QR code, title or requester name."),
            ("Status", "Limit results to Registered, In transit, Received, In process, On hold, Returned, Completed or Filed."),
            ("Office", "Show records by current office."),
            ("Type", "Show records by document type."),
            ("Open", "Open the document details page for custody timeline, attachments, QR reference and routing actions."),
            ("Export CSV", "Download the filtered registry rows for authorized office reporting."),
        ],
        [2.25, 4.2],
        header_fill=TEAL,
        font_size=9.0,
    )
    add_heading(doc, "Document details", 2)
    add_text(doc, "Use the three tabs to understand the record before you act:", space_after=4)
    add_bullet(doc, "Custody timeline shows what happened, when it happened, the offices involved and any remarks.")
    add_bullet(doc, "Custody timeline shows each registration, dispatch, receipt and status action in chronological order.")
    add_bullet(doc, "Attachments shows files uploaded during registration and provides Download when available.")
    add_heading(doc, "Notifications and public tracking", 2)
    add_bullet(doc, "Notifications alerts the appropriate office or user when a document is registered, dispatched, received, placed on hold, returned, completed, filed or flagged as a wrong-office scan. Select the document link to open the record.")
    add_bullet(doc, "Public tracking accepts the printed tracking code or QR reference without sign in. It shows the current office, last update, status and a public custody timeline.")

    # Section 10
    add_heading(doc, "10  Quick reference", 1)
    add_heading(doc, "Status meanings", 2)
    add_table(
        doc,
        ["Status", "Meaning", "Next usual action"],
        [
            ("Registered", "Created and currently at the origin office.", "Dispatch to the first next office."),
            ("In transit", "Dispatched and waiting for the destination office to receive it.", "Destination office scans to receive."),
            ("Received", "The current office has received the physical document.", "Process, place on hold, or dispatch when ready."),
            ("In process", "The current office is actively working on the document.", "Continue work or dispatch when ready."),
            ("On hold", "Processing is paused and remarks explain why.", "Resolve the issue, then select In process / resume."),
            ("Returned", "A return event was recorded. The document is traveling to the origin office.", "Origin office scans to receive it."),
            ("Completed", "The current custody office marked the work complete.", "Enter a physical file location and file it."),
            ("Filed", "The completed record has a saved archive location.", "Search or track it; no further scan action is expected."),
        ],
        [1.05, 3.25, 2.15],
        header_fill=NAVY,
        font_size=8.8,
    )
    add_heading(doc, "Daily handling checklist", 2)
    add_table(
        doc,
        ["Check", "Before you finish"],
        [
            ("Registration", "The title, document type and priority are correct, and the document remains with the registering office."),
            ("Label", "The QR routing slip is readable, attached to the physical folder and uses the same tracking code shown in the record."),
            ("Receipt", "The receiving scan was accepted at the expected office and the status is Received."),
            ("Processing", "Any hold, return or special handling has clear remarks."),
            ("Dispatch", "The destination in Confirm dispatch matches the physical handoff and the status is In transit."),
            ("Completion", "The final office marked the document Completed only after required checkpoints were finished."),
            ("Filing", "The physical archive location is specific and the record shows Filed."),
        ],
        [1.2, 5.25],
        header_fill=TEAL,
        font_size=9.0,
    )
    add_heading(doc, "When to ask for help", 2)
    add_text(doc, "Contact your office head or system administrator when a destination office is missing, a document is routed to the wrong office, a user cannot sign in, the QR label is unreadable, or the system repeatedly rejects an action after you have refreshed the record. Include the tracking code, the screen message and the last successful action.", space_after=6)
    add_rich_paragraph(
        doc,
        [
            {"text": "Remember. ", "bold": True, "color": NAVY},
            "One document, one tracking code, one QR reference and one custody timeline. Use the saved status and current office as your guide at every handoff.",
        ],
        size=10.8,
        space_after=0,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    build()
