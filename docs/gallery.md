# Gallery V1

Photos live in `public/gallery/`; add their records to `src/data/gallery.ts`.
Current selection: Hefei conference night scene, CNCC in Chengdu, and Yulin Road.
About teaser slots are curated as Hefei / Yulin Road / CNCC.

Each record requires a stable `id`, `/gallery/…` source, and separate localized
`alt` and `caption` objects (`en`, `zh-CN`, `de`). Alt describes visible content;
caption is one short sentence. Missing translations use the existing content
locale fallback. Supply intrinsic `width` and `height` where available.

Assign unique `aboutPreview` values 1, 2, and 3 to curate the About triptych.
Unassigned entries appear only in the archive. `previewPosition: { x: 50, y: 50 }`
sets the crop focal point in percentages; both default to 50. Missing slots show
decorative placeholders. Preview images have no captions. The archive preserves
source ratios and shows captions below each image. With exactly two landscape
images followed by one portrait, the archive uses a two-column composition:
landscapes stacked on the left, a larger portrait on the right. At 40rem and below,
it returns to a single column in source order. Other selections use CSS columns,
flowing top to bottom before moving to the next column.

Optional `date` and `location` fields are reserved and never rendered in V1.
Use web-sized derivatives when needed, preserving original files separately.

## Verification

Temporary, explicitly labeled SVG ratio fixtures were used for 16:9, 4:3, 1:1,
3:4, and 9:16 sources. Browser checks at 1440×900, 1024×768, 768×1024, 390×844,
and 320×568 confirmed 3/2/1 archive columns, natural image ratios, fixed preview
slots, cover cropping, custom focal points, and no horizontal overflow.
Chinese/German/English switching and English alt fallback were checked.
The temporary page was removed afterward. These fixture checks preceded the
three-photo composition; review the real-photo layout separately when changing
the selection.
