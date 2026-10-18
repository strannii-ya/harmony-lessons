# VexFlow engraving

The application uses VexFlow 4.2.5 (MIT), specifically its Bravura vector-outline build. The npm archive is pinned by version and SHA-512 integrity in package-lock.json, installed without lifecycle scripts. The deployed library is served from this site's origin, not a remote CDN. Its MIT license is copied beside the library. No standalone font binaries are copied.

VexFlow: https://github.com/0xfe/vexflow
Bravura glyph designs: Copyright Steinberg Media Technologies GmbH, SIL Open Font License 1.1. Source and license: https://github.com/steinbergmedia/bravura

# Legacy engraved clef illustrations

The two SVG illustrations in site/notation-glyphs.js were rendered from Noto Music 2.000, Copyright 2018 Google Inc. All Rights Reserved, SIL Open Font License 1.1.

Source: https://notofonts.github.io/noto-docs/specimen/NotoMusic/
License: https://openfontlicense.org/open-font-license-official-text/

The Noto-based renderer is retained independently in notation-legacy.js for rollback and baseline regression tests; it is not used by the application.
