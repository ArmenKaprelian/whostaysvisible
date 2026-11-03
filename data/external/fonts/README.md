# External fonts: Geist Mono (Vercel's release), fetched 2026-11-03T04:37:32Z

The pages' and the renders' one typeface since round 36 (the author's decision of 2 November 2026, in place of IBM Plex Mono). Fetched with
curl from the npm registry: the `geist` package 1.9.0, tarball https://registry.npmjs.org/geist/-/geist-1.9.0.tgz (5,240,746 bytes, sha256
80c7cd136d43444d26a3d6aa425e0b957d1962993e76d97716731e7dc32f14c6), unpacked into an empty folder under motion/build/ and these five files
copied out of it. Untrusted data: parsed only by fontconfig and the browser, never executed.

| file | path in the package | bytes | sha256 |
|---|---|---|---|
| geist-mono/GeistMono-Regular.ttf | dist/fonts/geist-mono/GeistMono-Regular.ttf | 148516 | bbc6e86aec043518fe50a981f452a027b195cf95a9b3bfe21b88560dc7240023 |
| geist-mono/GeistMono-Medium.ttf | dist/fonts/geist-mono/GeistMono-Medium.ttf | 149328 | 5fac27efaa3bcf330d7d402a12d1db1607aa820ab71e5d63153e9a009a4c4fd1 |
| geist-mono/GeistMono-Bold.ttf | dist/fonts/geist-mono/GeistMono-Bold.ttf | 150492 | 4dfd7f9b146984efb6f7ccb9f84938faa37d854bdeee56cd9836c8f578e54b93 |
| geist-mono/GeistMono-Variable.woff2 | dist/fonts/geist-mono/GeistMono-Variable.woff2 | 71272 | cf5bf55f69e043b1ecf04b0719119b7298e94add67ebcaa709a925b945b46b25 |
| geist-mono/OFL.txt | LICENSE.txt | 4368 | 930853ee1daa68554d9e35c8a9175affb74f699fad9a5da6ee5ebe76379d9137 |

Format: the three TrueType static faces at 400 (Regular), 500 (Medium) and 700 (Bold), and the variable WOFF2 (weight axis 100 to 900,
upright); the family name is "Geist Mono" (the Medium's own name is "Geist Mono Medium" with "Geist Mono" as its typographic family, as Plex's
was). Metrics: 1,000 units per em, cap height 710, x-height 530 to 536, ascent 1,005 and descent 295 (a 1.3 em line box, as Plex's), advance
600 (0.6 em, as Plex's). Licence: SIL Open Font License 1.1 (OFL.txt beside the files; copyright 2023 Vercel, in collaboration with
basement.studio). Pinned by `scripts/pin-sources.py` as `motion.font.geist-mono-400`, `-500`, `-700`, `-variable-woff2` and
`motion.font.geist-mono-licence` (`--only motion.font`). Used by: the lab's headless renders and audits (the three static faces installed
into ~/.local/share/fonts/geist-mono/ on 2 November 2026, round 36) and the published pages (the variable file, served from each page's own
fonts/ folder; no Google Fonts link since round 36). Glyphs the pages draw that Geist Mono lacks (Armenian, U+2011, U+036F) fall to
"DejaVu Sans Mono", the second family of the stack.

# IBM Plex Mono (history)

The lab's typeface from round 10 (25 October 2026) to round 35: Google's build from the google/fonts repository at commit 01d5d9f05246fb7090a8403b81257535cb1a088b, the Regular, Medium and Bold faces and the licence, pinned as `motion.font-plex-mono-*` and installed in ~/.local/share/fonts/ibm-plex-mono/. Replaced by Geist Mono in round 36 (the author's decision of 2 November 2026); the files, the install and the pins were removed on 3 November 2026 once the film was re-rendered, so no render can fall back to Plex unnoticed. The sizes and hashes stay in the git history of this file (commit 9b44dcb and before).

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
