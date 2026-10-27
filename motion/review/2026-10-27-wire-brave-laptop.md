# The wire's check in the author's Brave, laptop screen (27 October 2026)

Five recordings in the author's Brave (device ratio 1.333, window 2,359 by 1,427 CSS px), under the author's protocol: a banner set twice, visibility and focus logged on every frame, none lost. The sweep is `tools/wire-sweep.py`'s, dispatched inside the page. Raw figures: `2026-10-27-wire-brave-laptop.json`.

| Page | View | Sweep frames | Median frame | Holds | Held | Longest hold | Jumps | Restarts | Slot changes |
|---|---|---|---|---|---|---|---|---|---|
| before | Firms | 442 | 24.2 ms | 126 | 4164 ms | 91 ms | 20 | 61 | 59 |
| before | Cells | 423 | 24.2 ms | 117 | 4478 ms | 97 ms | 36 | 61 | 57 |
| after-wsB | Firms | 438 | 24.2 ms | 0 | 0 ms | 0 ms | 0 | 0 | 8 |
| after-wsB | Cells | 394 | 24.3 ms | 0 | 0 ms | 0 ms | 0 | 0 | 7 |
| after-wsA | Firms | 378 | 24.3 ms | 0 | 0 ms | 0 ms | 0 | 0 | 52 |

Before the fix the wire held still for 4.2 s (Firms) and 4.5 s (Cells) of the 12 s sweep, with every region change restarting its animation. After the fix there is no hold, jump or restart in either view. With wsB the first slot changed 7 or 8 times as the queue played; with wsA it changed 52 times, at each region crossed. The median frame of 24 ms is this Brave's own pace on Wayland (see the lab's measurement note), the same before and after.
