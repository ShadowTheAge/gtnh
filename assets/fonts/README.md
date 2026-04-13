Embedded UI font placement

If you want to use an embedded CJK UI font instead of relying on system fonts,
put one of these files in this folder:

- ui-font.woff2
- ui-font.ttf

The frontend CSS already looks for them via the ProjectUI font-family in:

- assets/styles/general.css

Recommended fonts:

- Noto Sans SC / Noto Sans CJK SC
- Source Han Sans SC

Prefer woff2 if you can subset the font, because full CJK fonts can be very large.
