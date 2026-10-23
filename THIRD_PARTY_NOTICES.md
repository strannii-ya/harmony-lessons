# VexFlow engraving

The application uses VexFlow 4.2.5 (MIT), specifically its Bravura vector-outline build. The npm archive is pinned by version and SHA-512 integrity in package-lock.json, installed without lifecycle scripts. The deployed library is served from this site's origin, not a remote CDN. Its MIT license is copied beside the library. No standalone font binaries are copied.

VexFlow: https://github.com/0xfe/vexflow
Bravura glyph designs: Copyright Steinberg Media Technologies GmbH, SIL Open Font License 1.1. Source and license: https://github.com/steinbergmedia/bravura

# Salamander Grand Piano V3 recordings

Piano recordings: **Alexander Holm — Salamander Grand Piano V3**, a Yamaha C5 concert grand. Licensed under **Creative Commons Attribution 3.0 Unported (CC BY 3.0)**.

- Original recordings and author: https://github.com/sfzinstruments/SalamanderGrandPiano
- Original distribution: https://archive.org/details/SalamanderGrandPianoV3
- License text: https://creativecommons.org/licenses/by/3.0/
- MP3 distribution: `@audio-samples/piano-mp3-velocity8@1.0.5` and `@audio-samples/piano-mp3-velocity15@1.0.5` from https://github.com/darosh/samples-piano-mp3

The site bundles 26 sampled pitches in each of two velocity layers. We preserved the original MP3 encoding, shortened each file to the first seven seconds, renamed sharps as `Ds`/`Fs` in filenames, and use playback-rate interpolation, gain envelopes and light compression to play other pitches. The recordings retain their CC BY 3.0 license; no endorsement by their author is implied.

# Legacy engraved clef illustrations

The two SVG illustrations in site/notation-glyphs.js were rendered from Noto Music 2.000, Copyright 2018 Google Inc. All Rights Reserved, SIL Open Font License 1.1.

Source: https://notofonts.github.io/noto-docs/specimen/NotoMusic/
License: https://openfontlicense.org/open-font-license-official-text/

The Noto-based renderer is retained independently in notation-legacy.js for rollback and baseline regression tests; it is not used by the application.

# Yandex sign-in logo

The red round Yandex logo in site/index.html uses the original vector artwork from Yandex ID's official sign-in button design guidelines (round 44 x 44 variant, scaled uniformly). Its geometry and brand colours are unmodified. It identifies the actual Yandex sign-in provider and does not imply endorsement.

Source: https://yandex.ru/dev/id/doc/ru/codes/buttons-design
Yandex and the Yandex logo are trademarks of their respective owner.
