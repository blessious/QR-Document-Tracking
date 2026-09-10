from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "public" / "help" / "office-staff"
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "lgu-doctrack-office-staff-quick-guide.pdf"

PAGE_W, PAGE_H = A4
MARGIN = 14 * mm
NAVY = colors.HexColor("#173A74")
TEAL = colors.HexColor("#168D9C")
BLUE = colors.HexColor("#2E78C7")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#5B687A")
PALE = colors.HexColor("#F3F7FC")
PALE_TEAL = colors.HexColor("#EAF8F8")
PALE_AMBER = colors.HexColor("#FFF6DC")
GREEN = colors.HexColor("#2B9850")
AMBER = colors.HexColor("#B37400")
RED = colors.HexColor("#B33A3A")
WHITE = colors.white


styles = getSampleStyleSheet()
BODY = ParagraphStyle(
    "GuideBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.3,
    leading=10.2, textColor=INK, spaceAfter=1.5 * mm,
)
SMALL = ParagraphStyle(
    "GuideSmall", parent=BODY, fontSize=7.2, leading=8.8, textColor=MUTED,
)
CAPTION = ParagraphStyle(
    "GuideCaption", parent=BODY, fontSize=7.8, leading=9.5, textColor=INK,
)
CARD_TITLE = ParagraphStyle(
    "CardTitle", parent=BODY, fontName="Helvetica-Bold", fontSize=10.5,
    leading=12, textColor=NAVY,
)
PAGE_TITLE = ParagraphStyle(
    "PageTitle", parent=BODY, fontName="Helvetica-Bold", fontSize=20,
    leading=22, textColor=NAVY, alignment=TA_LEFT,
)
CENTER_SMALL = ParagraphStyle(
    "CenterSmall", parent=SMALL, alignment=TA_CENTER,
)


def para(c, text, x, y_top, w, style=BODY):
    p = Paragraph(text, style)
    _, h = p.wrap(w, PAGE_H)
    p.drawOn(c, x, y_top - h)
    return h


def rounded_card(c, x, y, w, h, fill=WHITE, stroke=colors.HexColor("#D9E4F0"), radius=4 * mm):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.6)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def section_label(c, text, x, y, fill=TEAL, w=None):
    if w is None:
        w = max(24 * mm, stringWidth(text, "Helvetica-Bold", 7.2) + 9 * mm)
    c.setFillColor(fill)
    c.roundRect(x, y, w, 6.5 * mm, 3.2 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawCentredString(x + w / 2, y + 2.25 * mm, text.upper())


def draw_step_band(c, y):
    labels = ["Register", "Print QR", "Receive", "Process", "Dispatch", "Complete", "File"]
    x = MARGIN
    usable = PAGE_W - 2 * MARGIN
    gap = 4 * mm
    step_w = (usable - gap * (len(labels) - 1)) / len(labels)
    for i, label in enumerate(labels):
        c.setFillColor([NAVY, BLUE, TEAL, BLUE, NAVY, GREEN, TEAL][i])
        c.roundRect(x, y, step_w, 9 * mm, 3 * mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 6.8)
        c.drawCentredString(x + step_w / 2, y + 5.4 * mm, f"{i + 1}")
        c.setFont("Helvetica", 6.2)
        c.drawCentredString(x + step_w / 2, y + 2.1 * mm, label)
        x += step_w + gap


def draw_image(c, filename, x, y, w, h, crop=False):
    path = ASSET_DIR / filename
    if not path.exists():
        c.setFillColor(PALE)
        c.rect(x, y, w, h, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7)
        c.drawCentredString(x + w / 2, y + h / 2, filename)
        return
    img = ImageReader(str(path))
    iw, ih = img.getSize()
    scale = max(w / iw, h / ih) if crop else min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    c.saveState()
    c.setFillColor(PALE)
    c.roundRect(x, y, w, h, 3 * mm, fill=1, stroke=0)
    c.clipPath(c.beginPath(), stroke=0, fill=0) if False else None
    c.drawImage(img, dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def draw_ui_preview(c, x, y, w, h, active="Document registry"):
    rounded_card(c, x, y, w, h, fill=colors.HexColor("#FBFDFF"), stroke=colors.HexColor("#C8D8EA"), radius=2.5 * mm)
    side_w = w * 0.27
    c.setFillColor(NAVY)
    c.roundRect(x, y, side_w, h, 2.5 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x + 3 * mm, y + h - 6 * mm, "LGU DocTrack")
    c.setFont("Helvetica", 5.8)
    items = ["My office", "Expected incoming", "Document registry", "Scan", "Filing & archives", "Notifications"]
    iy = y + h - 13 * mm
    for item in items:
        if item == active:
            c.setFillColor(colors.HexColor("#2E78C7"))
            c.roundRect(x + 1.5 * mm, iy - 1.4 * mm, side_w - 3 * mm, 5.4 * mm, 1.2 * mm, fill=1, stroke=0)
            c.setFillColor(WHITE)
        else:
            c.setFillColor(colors.HexColor("#D9E8FA"))
        c.drawString(x + 3 * mm, iy, item)
        iy -= 7 * mm
    mx = x + side_w + 4 * mm
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 8.2)
    c.drawString(mx, y + h - 7 * mm, active)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.8)
    c.drawString(mx, y + h - 11 * mm, "Search, filter, open, and act on your office documents")
    c.setFillColor(colors.HexColor("#E7F3FA"))
    c.roundRect(mx, y + h - 23 * mm, w - side_w - 8 * mm, 7 * mm, 1.5 * mm, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.7)
    c.drawString(mx + 2 * mm, y + h - 20.4 * mm, "Search code, title, requester")
    row_y = y + h - 33 * mm
    for i in range(3):
        c.setStrokeColor(colors.HexColor("#D9E4F0"))
        c.line(mx, row_y - i * 10 * mm, x + w - 4 * mm, row_y - i * 10 * mm)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 5.7)
        c.drawString(mx, row_y - 4 * mm - i * 10 * mm, f"LGU-2026-00000{i + 1}")
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 5.4)
        c.drawString(mx + 29 * mm, row_y - 4 * mm - i * 10 * mm, "Document title")
        c.setFillColor(GREEN if i < 2 else AMBER)
        c.roundRect(x + w - 28 * mm, row_y - 6 * mm - i * 10 * mm, 20 * mm, 4.5 * mm, 2 * mm, fill=1, stroke=0)


def draw_qr_slip(c, x, y, size):
    c.setFillColor(WHITE)
    c.setStrokeColor(NAVY)
    c.roundRect(x, y, size, size * 1.18, 2 * mm, fill=1, stroke=1)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", size * 0.12)
    c.drawCentredString(x + size / 2, y + size * 1.02, "LGU DocTrack")
    c.setFillColor(INK)
    c.setFont("Courier-Bold", size * 0.09)
    c.drawCentredString(x + size / 2, y + size * 0.12, "LGU-2026-000001")
    c.setStrokeColor(INK)
    c.setLineWidth(size * 0.018)
    qx, qy, q = x + size * 0.17, y + size * 0.34, size * 0.66
    c.rect(qx, qy, q, q, fill=0, stroke=1)
    for row in range(7):
        for col in range(7):
            if (row * 5 + col * 3 + row + col) % 4 in (0, 1):
                c.rect(qx + col * q / 7, qy + row * q / 7, q / 7, q / 7, fill=1, stroke=0)
    for fx, fy in [(qx, qy), (qx + q * 0.72, qy), (qx, qy + q * 0.72)]:
        c.setLineWidth(size * 0.012)
        c.rect(fx, fy, q * 0.28, q * 0.28, fill=0, stroke=1)
        c.rect(fx + q * 0.08, fy + q * 0.08, q * 0.12, q * 0.12, fill=1, stroke=0)


def draw_footer(c, page):
    c.setStrokeColor(colors.HexColor("#D9E4F0"))
    c.line(MARGIN, 10 * mm, PAGE_W - MARGIN, 10 * mm)
    c.setFont("Helvetica", 6.7)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 6.6 * mm, "LGU DocTrack - Office staff and receiving quick guide")
    c.drawRightString(PAGE_W - MARGIN, 6.6 * mm, f"Page {page} of 2")


def page_one(c):
    c.setFillColor(PALE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 42 * mm, PAGE_W, 42 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 21)
    c.drawString(MARGIN, PAGE_H - 17 * mm, "LGU DocTrack")
    c.setFont("Helvetica", 9.5)
    c.drawString(MARGIN, PAGE_H - 24 * mm, "Office Staff Quick Guide")
    c.setFillColor(colors.HexColor("#D7F5F5"))
    para(c, "Keep every physical document moving - from registration to archive.", MARGIN, PAGE_H - 30 * mm, PAGE_W - 2 * MARGIN, ParagraphStyle("hero", parent=BODY, fontSize=8.8, leading=10.8, textColor=colors.HexColor("#D7F5F5")))
    draw_step_band(c, PAGE_H - 50 * mm)
    y = PAGE_H - 58 * mm
    col_gap = 5 * mm
    col_w = (PAGE_W - 2 * MARGIN - col_gap) / 2

    rounded_card(c, MARGIN, y - 64 * mm, col_w, 61 * mm)
    section_label(c, "1. Start here", MARGIN + 5 * mm, y - 10 * mm, NAVY)
    para(c, "<b>Sign in</b> with your office account. Staff open <b>Document registry</b>; receiving clerks open <b>Scan</b>.", MARGIN + 5 * mm, y - 15 * mm, col_w - 10 * mm)
    draw_ui_preview(c, MARGIN + 5 * mm, y - 59 * mm, col_w - 10 * mm, 35 * mm, active="Document registry")
    para(c, "Use <b>My office</b> to see what is in custody, arriving, outgoing, or released.", MARGIN + 5 * mm, y - 61 * mm, col_w - 10 * mm, SMALL)

    x2 = MARGIN + col_w + col_gap
    rounded_card(c, x2, y - 64 * mm, col_w, 61 * mm)
    section_label(c, "2. Register", x2 + 5 * mm, y - 10 * mm, TEAL)
    para(c, "Choose <b>Create Tracking Slip</b>. Enter the document details and priority. The document stays in your office until dispatch.", x2 + 5 * mm, y - 15 * mm, col_w - 10 * mm)
    draw_image(c, "03-register-qr.png", x2 + 5 * mm, y - 59 * mm, col_w - 10 * mm, 35 * mm)
    para(c, "Select <b>Register &amp; generate QR</b>. The code identifies the physical folder.", x2 + 5 * mm, y - 61 * mm, col_w - 10 * mm, SMALL)

    y2 = y - 69 * mm
    rounded_card(c, MARGIN, y2 - 73 * mm, PAGE_W - 2 * MARGIN, 70 * mm, fill=PALE_TEAL, stroke=colors.HexColor("#BEE5E5"))
    section_label(c, "3. Print and attach", MARGIN + 5 * mm, y2 - 10 * mm, BLUE)
    para(c, "Print the routing slip, attach the QR label to the folder, and keep the tracking code visible. Reprinting keeps the same identifiers.", MARGIN + 5 * mm, y2 - 15 * mm, PAGE_W - 2 * MARGIN - 10 * mm)
    draw_image(c, "01-overview.png", MARGIN + 5 * mm, y2 - 65 * mm, 84 * mm, 44 * mm)
    draw_qr_slip(c, MARGIN + 99 * mm, y2 - 60 * mm, 28 * mm)
    para(c, "Attach the printed QR slip to the physical folder.", MARGIN + 132 * mm, y2 - 32 * mm, PAGE_W - MARGIN - (MARGIN + 132 * mm), CAPTION)
    para(c, "The system tracks physical custody. Optional uploaded copies remain attached to the tracking record for reference.", MARGIN + 132 * mm, y2 - 48 * mm, PAGE_W - MARGIN - (MARGIN + 132 * mm), SMALL)
    draw_footer(c, 1)
    c.showPage()


def page_two(c):
    c.setFillColor(PALE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 28 * mm, PAGE_W, 28 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(MARGIN, PAGE_H - 13 * mm, "Receive, move, finish")
    c.setFont("Helvetica", 8.5)
    c.drawString(MARGIN, PAGE_H - 20 * mm, "Use the QR scan at every handoff so custody and status stay accurate.")
    draw_step_band(c, PAGE_H - 36 * mm)
    y = PAGE_H - 43 * mm
    col_gap = 5 * mm
    col_w = (PAGE_W - 2 * MARGIN - col_gap) / 2

    rounded_card(c, MARGIN, y - 66 * mm, col_w, 63 * mm)
    section_label(c, "4. Receive", MARGIN + 5 * mm, y - 10 * mm, TEAL)
    para(c, "When the folder arrives, open <b>Scan</b> and scan the QR label before accepting it. At the correct office, receipt is recorded automatically.", MARGIN + 5 * mm, y - 15 * mm, col_w - 10 * mm)
    draw_image(c, "04-scan-receive.png", MARGIN + 5 * mm, y - 61 * mm, col_w - 10 * mm, 35 * mm)
    para(c, "If the camera is unavailable, use the manual code entry. Check that the destination matches your office.", MARGIN + 5 * mm, y - 63 * mm, col_w - 10 * mm, SMALL)

    x2 = MARGIN + col_w + col_gap
    rounded_card(c, x2, y - 66 * mm, col_w, 63 * mm)
    section_label(c, "5. Process + dispatch", x2 + 5 * mm, y - 10 * mm, NAVY)
    para(c, "Open the document from <b>My office</b> or the scanner queue. Use <b>In process / resume</b>, then choose <b>Dispatch</b> when ready.", x2 + 5 * mm, y - 15 * mm, col_w - 10 * mm)
    draw_image(c, "05-process-dispatch.png", x2 + 5 * mm, y - 61 * mm, col_w - 10 * mm, 35 * mm)
    para(c, "Confirm the next office. Add remarks for a hold or return. A hold blocks dispatch until processing resumes.", x2 + 5 * mm, y - 63 * mm, col_w - 10 * mm, SMALL)

    y2 = y - 71 * mm
    rounded_card(c, MARGIN, y2 - 60 * mm, col_w, 57 * mm, fill=PALE_TEAL, stroke=colors.HexColor("#BEE5E5"))
    section_label(c, "6. Complete + file", MARGIN + 5 * mm, y2 - 10 * mm, GREEN)
    para(c, "The office currently holding the document may select <b>Mark completed</b>, then enter the shelf, cabinet, or folder location and select <b>File to archives</b>.", MARGIN + 5 * mm, y2 - 15 * mm, col_w - 10 * mm)
    draw_image(c, "06-complete-file-track.png", MARGIN + 5 * mm, y2 - 54 * mm, col_w - 10 * mm, 29 * mm)

    rounded_card(c, x2, y2 - 60 * mm, col_w, 57 * mm)
    section_label(c, "7. Search + track", x2 + 5 * mm, y2 - 10 * mm, BLUE)
    para(c, "Use <b>Document registry</b> to search by code, title, requester, status, office, or type. Use <b>Notifications</b> for incoming and exception alerts.", x2 + 5 * mm, y2 - 15 * mm, col_w - 10 * mm)
    draw_ui_preview(c, x2 + 5 * mm, y2 - 54 * mm, col_w - 10 * mm, 29 * mm, active="Document registry")

    y3 = y2 - 65 * mm
    rounded_card(c, MARGIN, y3 - 65 * mm, PAGE_W - 2 * MARGIN, 62 * mm, fill=PALE_AMBER, stroke=colors.HexColor("#F0D99C"))
    section_label(c, "Safe handling rules", MARGIN + 5 * mm, y3 - 10 * mm, AMBER)
    draw_image(c, "07-exceptions.png", MARGIN + 5 * mm, y3 - 58 * mm, 72 * mm, 40 * mm)
    rules_x = MARGIN + 82 * mm
    para(c, "<b>Wrong office:</b> stop and report the scan. Custody does not transfer.", rules_x, y3 - 14 * mm, PAGE_W - MARGIN - rules_x, CAPTION)
    para(c, "<b>Unknown QR:</b> do not invent a record. Check the printed code and retry.", rules_x, y3 - 27 * mm, PAGE_W - MARGIN - rules_x, CAPTION)
    para(c, "<b>Network failure:</b> retry only after the connection returns; reload to confirm the saved state.", rules_x, y3 - 40 * mm, PAGE_W - MARGIN - rules_x, CAPTION)
    para(c, "<b>Duplicate scan:</b> keeping the QR in view does not create another action. Scan again only for the next handoff.", rules_x, y3 - 53 * mm, PAGE_W - MARGIN - rules_x, CAPTION)

    y4 = y3 - 70 * mm
    rounded_card(c, MARGIN, y4 - 29 * mm, PAGE_W - 2 * MARGIN, 26 * mm, fill=WHITE, stroke=colors.HexColor("#C8D8EA"))
    section_label(c, "Role reminder", MARGIN + 5 * mm, y4 - 9 * mm, NAVY)
    para(c, "<b>Receiving clerk:</b> scan, receive, dispatch, and flag wrong-office scans. &nbsp;&nbsp; <b>Office staff:</b> register, receive, process, hold, return, complete, file, and track documents assigned to your office.", MARGIN + 5 * mm, y4 - 14 * mm, PAGE_W - 2 * MARGIN - 10 * mm, CAPTION)
    draw_footer(c, 2)
    c.showPage()


def main():
    c = canvas.Canvas(str(OUT), pagesize=A4)
    c.setTitle("LGU DocTrack Office Staff Quick Guide")
    c.setAuthor("LGU DocTrack")
    page_one(c)
    page_two(c)
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
