import re, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                Preformatted, HRFlowable, KeepTogether, ListFlowable, ListItem)

F = "/System/Library/Fonts/Supplemental/"
pdfmetrics.registerFont(TTFont("Body", F + "Arial Unicode.ttf"))
pdfmetrics.registerFont(TTFont("BodyB", F + "Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("BodyI", F + "Arial Italic.ttf"))
pdfmetrics.registerFont(TTFont("BodyBI", F + "Arial Bold Italic.ttf"))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("Body", normal="Body", bold="BodyB", italic="BodyI", boldItalic="BodyBI")

GREEN = colors.HexColor("#0E3A34"); SAGE = colors.HexColor("#A6B9A6")
LIGHT = colors.HexColor("#E9EFE6"); WARM = colors.HexColor("#FAFAF7"); TEXT = colors.HexColor("#1F2A27")

base = ParagraphStyle("b", fontName="Body", fontSize=10, leading=14.5, textColor=TEXT, spaceAfter=6)
H1 = ParagraphStyle("h1", parent=base, fontName="BodyB", fontSize=22, leading=27, textColor=GREEN, spaceAfter=8)
H2 = ParagraphStyle("h2", parent=base, fontName="BodyB", fontSize=15, leading=19, textColor=GREEN, spaceBefore=10, spaceAfter=6)
H3 = ParagraphStyle("h3", parent=base, fontName="BodyB", fontSize=11.5, leading=15, textColor=GREEN, spaceBefore=8, spaceAfter=4)
CELL = ParagraphStyle("c", parent=base, fontSize=8.8, leading=11.5, spaceAfter=0)
CELLH = ParagraphStyle("ch", parent=CELL, fontName="BodyB", textColor=WARM)
QUOTE = ParagraphStyle("q", parent=base, fontSize=9.5, leading=13.5, textColor=GREEN, spaceAfter=0)
CODE = ParagraphStyle("code", fontName="Courier", fontSize=7.6, leading=9.6, textColor=TEXT)

def inline(s):
    s = s.replace("1️⃣", "1").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = re.sub(r"`([^`]+)`", r'<font name="Courier" color="#0E3A34" backColor="#EEF2EC">\1</font>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    return s

def table(lines, width):
    rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in lines]
    rows = [r for r in rows if not all(re.fullmatch(r":?-+:?", c) for c in r)]
    data = [[Paragraph(inline(c), CELLH if i == 0 else CELL) for c in r] for i, r in enumerate(rows)]
    n = len(rows[0])
    lens = [max(len(r[j]) for r in rows) for j in range(n)]
    tot = sum(min(l, 70) + 8 for l in lens)
    cw = [width * (min(l, 70) + 8) / tot for l in lens]
    t = Table(data, colWidths=cw, repeatRows=1)
    st = [("BACKGROUND", (0, 0), (-1, 0), GREEN), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("GRID", (0, 0), (-1, -1), 0.4, SAGE), ("TOPPADDING", (0, 0), (-1, -1), 4),
          ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5)]
    for i in range(1, len(data)):
        if i % 2 == 0: st.append(("BACKGROUND", (0, i), (-1, i), WARM))
    t.setStyle(TableStyle(st))
    return t

def build(md, out):
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm,
                            title="Prospección: cómo funciona el flujo", author="Carlos Arias")
    W = A4[0] - 36*mm
    story = []; lines = md.split("\n"); i = 0
    def lst(items, ordered):
        return ListFlowable([ListItem(Paragraph(inline(t), base), leftIndent=12 + 12*lvl) for lvl, t in items],
                            bulletType="1" if ordered else "bullet", start="1" if ordered else "•", leftIndent=14,
                            bulletFontName="Body", bulletFontSize=9, bulletColor=GREEN)
    while i < len(lines):
        l = lines[i]
        if l.startswith("```"):
            j = i + 1; buf = []
            while not lines[j].startswith("```"): buf.append(lines[j]); j += 1
            pre = Preformatted("\n".join(buf), CODE)
            box = Table([[pre]], colWidths=[W]); box.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F3F6F1")),
                ("BOX", (0,0), (-1,-1), 0.4, SAGE), ("LEFTPADDING", (0,0), (-1,-1), 8), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6)]))
            story += [box, Spacer(1, 8)]; i = j + 1; continue
        if l.startswith("|"):
            j = i; buf = []
            while j < len(lines) and lines[j].startswith("|"): buf.append(lines[j]); j += 1
            story += [table(buf, W), Spacer(1, 8)]; i = j; continue
        if l.startswith("> "):
            j = i; buf = []
            while j < len(lines) and lines[j].startswith(">"): buf.append(lines[j][1:].strip()); j += 1
            q = Table([[Paragraph(inline(" ".join(buf)), QUOTE)]], colWidths=[W])
            q.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), LIGHT), ("LINEBEFORE", (0,0), (0,-1), 3, GREEN),
                ("LEFTPADDING", (0,0), (-1,-1), 10), ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7)]))
            story += [q, Spacer(1, 8)]; i = j; continue
        m = re.match(r"^(\s*)(-|\d+\.) (.*)", l)
        if m:
            ordered = m.group(2) != "-"; items = []; j = i
            while j < len(lines):
                mm_ = re.match(r"^(\s*)(-|\d+\.) (.*)", lines[j])
                if not mm_: break
                items.append((len(mm_.group(1)) // 3, mm_.group(3))); j += 1
            if any(lv for lv, _ in items):
                for lv, t in items:
                    story.append(Paragraph(("• " if lv else "") + inline(t), ParagraphStyle("li", parent=base, leftIndent=14 + 14*lv, spaceAfter=2)))
                story.append(Spacer(1, 4))
            else:
                story += [lst(items, ordered), Spacer(1, 4)]
            i = j; continue
        if l.startswith("# "): story.append(Paragraph(inline(l[2:]), H1))
        elif l.startswith("## "): story.append(Paragraph(inline(l[3:]), H2))
        elif l.startswith("### "): story.append(Paragraph(inline(l[4:]), H3))
        elif l.strip() == "---": story.append(HRFlowable(width="100%", thickness=0.6, color=SAGE, spaceBefore=4, spaceAfter=6))
        elif l.strip(): story.append(Paragraph(inline(l), base))
        i += 1
    def footer(c, d):
        c.saveState(); c.setFont("Body", 8); c.setFillColor(colors.HexColor("#5B6B66"))
        c.drawString(18*mm, 10*mm, "Prospección · cómo funciona el flujo"); c.drawRightString(A4[0]-18*mm, 10*mm, f"Página {d.page}")
        c.restoreState()
    doc.build(story, onFirstPage=footer, onLaterPages=footer)

build(open(sys.argv[1], encoding="utf-8").read(), sys.argv[2])
print("ok")
