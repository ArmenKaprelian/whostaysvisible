# External fonts: IBM Plex Mono (Google Fonts build), fetched 2026-10-25T10:56:39Z

Fetched with curl from the google/fonts repository at commit 01d5d9f05246fb7090a8403b81257535cb1a088b (the build Google Fonts serves, so the
lab's renders and the published pages use the same files). Untrusted data: parsed only by fontconfig and the browser, never executed.

| file | URL | bytes | sha256 |
|---|---|---|---|
| ibm-plex-mono/IBMPlexMono-Regular.ttf | https://raw.githubusercontent.com/google/fonts/01d5d9f05246fb7090a8403b81257535cb1a088b/ofl/ibmplexmono/IBMPlexMono-Regular.ttf | 135580 | 6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46 |
| ibm-plex-mono/IBMPlexMono-Medium.ttf | https://raw.githubusercontent.com/google/fonts/01d5d9f05246fb7090a8403b81257535cb1a088b/ofl/ibmplexmono/IBMPlexMono-Medium.ttf | 136704 | a9b4c49bb299e05b5f6c481e7fb5e78943d2793249a0c8874ab574a2d1ea6755 |
| ibm-plex-mono/IBMPlexMono-Bold.ttf | https://raw.githubusercontent.com/google/fonts/01d5d9f05246fb7090a8403b81257535cb1a088b/ofl/ibmplexmono/IBMPlexMono-Bold.ttf | 137784 | ac27abd6450a64dd94467580a02fe6235156d5b92f2926ebbc8e7489df64e0be |
| ibm-plex-mono/OFL.txt | https://raw.githubusercontent.com/google/fonts/01d5d9f05246fb7090a8403b81257535cb1a088b/ofl/ibmplexmono/OFL.txt | 4456 | 7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da |

Format: TrueType, static weights 400 (Regular), 500 (Medium) and 700 (Bold); the family name is "IBM Plex Mono". Licence: SIL Open Font
License 1.1 (OFL.txt beside the files; copyright IBM Corp. 2017 with the reserved font name "Plex"). Pinned by `scripts/pin-sources.py` as
`motion.font-plex-mono-400`, `-500`, `-700` and `motion.font-plex-mono-licence`. Used by: the lab's headless renders and audits (the three
weights installed into ~/.local/share/fonts/ibm-plex-mono/ on 25 October 2026, round 10; fontconfig resolves "IBM Plex Mono" at weights 80,
100 and 200 to the three files) and, on the published pages, the same family from Google Fonts (css2?family=IBM+Plex+Mono:wght@400;500;700).
Glyphs the pages draw that Plex Mono lacks (U+25B8 and U+25BE triangles, U+2011, Greek) fall to "DejaVu Sans Mono", the second family of the stack.
