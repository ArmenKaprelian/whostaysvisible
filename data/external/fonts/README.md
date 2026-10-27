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

# External fonts: Tomorrow (Google Fonts build), fetched 2026-10-26T09:44:06Z

The data wire's face (round 15, the author's final choice of 26 October 2026: Tomorrow at 13.5 px with scanlines and a glow, on the wire's
track only). Fetched with curl from the google/fonts repository at the same commit as Plex, 01d5d9f05246fb7090a8403b81257535cb1a088b.
Untrusted data: parsed only by fontconfig and the browser, never executed.

| file | URL | bytes | sha256 |
|---|---|---|---|
| tomorrow/Tomorrow-Regular.ttf | https://raw.githubusercontent.com/google/fonts/01d5d9f05246fb7090a8403b81257535cb1a088b/ofl/tomorrow/Tomorrow-Regular.ttf | 59520 | 6bb5534178637f472be093b2df876d580e7cb50df53e1a4b2be9f94070ff1767 |
| tomorrow/Tomorrow-Medium.ttf | https://raw.githubusercontent.com/google/fonts/01d5d9f05246fb7090a8403b81257535cb1a088b/ofl/tomorrow/Tomorrow-Medium.ttf | 59020 | ed82147f4fdefa4a89cefdbeff0d6d0fc6af5a3fac073884918bfba846e5b88b |
| tomorrow/OFL.txt | https://raw.githubusercontent.com/google/fonts/01d5d9f05246fb7090a8403b81257535cb1a088b/ofl/tomorrow/OFL.txt | 4477 | 1dd4eaacd1da1bfb7e1d14dd5af0279c17d4503fde55abc628bdaccc63ae9eca |

Format: TrueType, static weights 400 (Regular) and 500 (Medium); the family name is "Tomorrow" (copyright 2019 The Tomorrow Project
Authors). Licence: SIL Open Font License 1.1 (OFL.txt beside the files). Pinned by `scripts/pin-sources.py` as `motion.font-tomorrow-400`,
`-500` and `motion.font-tomorrow-licence`. Used by: the lab's headless renders and audits (both weights installed into
~/.local/share/fonts/tomorrow/ on 26 October 2026) and, on the published page, the same family from Google Fonts
(css2?family=Tomorrow:wght@400;500).
