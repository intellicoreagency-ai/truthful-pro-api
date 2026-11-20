"""Render bilingual banner lettering with Pillow built with libraqm."""
import json
from math import ceil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
copy = json.loads((root / 'src/companyBannerCopy.json').read_text())
fonts = root / 'node_modules/@expo-google-fonts'
scale = 2
cell_width = 285 * scale
cell_height = 219 * scale
columns = 2
lettering_fonts = {
    'ar': (
        'ibm-plex-sans-arabic/700Bold/IBMPlexSansArabic_700Bold.ttf',
        'ibm-plex-sans-arabic/500Medium/IBMPlexSansArabic_500Medium.ttf',
    ),
    'en': (
        'plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf',
        'plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf',
    ),
}


def fit(draw, text, font_path, starting_size, direction, stroke):
    available = cell_width - 14 * scale
    for size in range(starting_size, 16, -1):
        font = ImageFont.truetype(str(fonts / font_path), size * scale)
        words = text.split()
        lines = [words[0]]
        for word in words[1:]:
            candidate = lines[-1] + ' ' + word
            if draw.textlength(candidate, font=font, direction=direction) <= available:
                lines[-1] = candidate
            else:
                lines.append(word)
        boxes = [draw.textbbox((0, 0), line, font=font, direction=direction,
                               stroke_width=stroke) for line in lines]
        if len(lines) <= 2 and all(right - left <= available for left, _, right, _ in boxes):
            return font, list(zip(lines, boxes)), round(size * scale * 1.12)
    raise ValueError(f'Banner text does not fit: {text}')


for locale, (title_font, subtitle_font) in lettering_fonts.items():
    atlas = Image.new('RGBA', (columns * cell_width, ceil(len(copy) / columns) * cell_height))
    draw = ImageDraw.Draw(atlas)
    rtl = locale == 'ar'
    direction = 'rtl' if rtl else 'ltr'
    for index, (service_id, item) in enumerate(copy.items()):
        x = index % columns * cell_width
        y = index // columns * cell_height
        title_stroke = 0 if rtl else 1
        title = fit(draw, item[locale]['title'], title_font, 37 if rtl else 38, direction, title_stroke)
        subtitle = fit(draw, item[locale]['subtitle'], subtitle_font, 24, direction, 0 if rtl else 1)
        gap = 8 * scale
        height = len(title[1]) * title[2] + gap + len(subtitle[1]) * subtitle[2]
        line_top = y + (cell_height - height) / 2 - 2 * scale
        blocks = [(title, '#100D0B', title_stroke), (subtitle, '#241A14', 0 if rtl else 1)]
        if rtl and service_id == 'trade-licenses':
            blocks = [blocks[1]]
            line_top = y + cell_height * .52
        for (font, lines, line_height), colour, stroke in blocks:
            for line, (left, top, right, bottom) in lines:
                margin = (cell_width - (right - left)) / 2 if rtl else 7 * scale
                position = (x + margin - left, line_top + (line_height - (bottom - top)) / 2 - top)
                draw.text(position, line, font=font, fill=colour, direction=direction, stroke_width=stroke)
                line_top += line_height
            line_top += gap
    atlas.save(root / f'assets/approved_banners/company-lettering-{locale}.webp', lossless=True, method=6)

