# Penalty Shooters 2 visual assets

The WebP sprite atlases and WebM sound files in this directory are original Penalty Shooters 2 assets by DParrot and the game's respective contributors, obtained from the publicly loaded browser game on 12 November 2026:

- Game: https://www.crazygames.com/game/penalty-shooters-2
- Asset origin: https://penalty-shooters-2.game-files.crazygames.com/penalty-shooters-2/12/images/
- Sound origin: https://penalty-shooters-2.game-files.crazygames.com/penalty-shooters-2/12/media/

Original artwork remains the property of its respective rights holders. It is not relicensed under this repository's AGPL licence. No open-source licence or redistribution grant was supplied with these assets. This implementation does not include the original game's Construct runtime or compiled game logic.

`sprites.json` contains only the atlas coordinates and animation frame descriptions needed to render the artwork. It was extracted from the publicly loaded game metadata. The original fictional team names, kit choices and colour palette are represented in `../../shared/teams.js`, except for the Turkey replacement described below. There are eleven national leagues with 32 teams each, and the Global Cup has 48 countries.

## Turkey roster

The `turkey` league replaces the original Mexico club league. Mexico's national team remains in the Global Cup. League and kit-pattern display labels use English; club names retain their Turkish spelling.

The roster uses the **2026-2027 season**, verified directly against the TFF standings on **12 November 2026**:

- [TFF Süper Lig standings](https://www.tff.org/default.aspx?pageID=198): all listed clubs except Amed Sportif Faaliyetler, which is excluded as requested. This supplies 17 clubs.
- [TFF 1. Lig standings](https://www.tff.org/default.aspx?pageID=142): the highest 15 remaining clubs in the published standings, without duplicates, complete the 32-team tournament. The cutoff is Bandırmaspor in 15th place.

The Süper Lig entries are Galatasaray, Trabzonspor, Beşiktaş, Kasımpaşa, Fenerbahçe, Kocaelispor, İstanbul Başakşehir, Çorum FK, Göztepe, Çaykur Rizespor, Erzurumspor FK, Alanyaspor, Gençlerbirliği, Konyaspor, Gaziantep FK, Samsunspor and Eyüpspor.

The 1. Lig entries, in the source standings order, are Bursaspor, Kayserispor, Iğdır FK, Mardin 1969 Spor, Batman Petrolspor, Ankara Keçiörengücü, Bodrum FK, Antalyaspor, Fatih Karagümrük, Esenler Erokspor, Muğlaspor, Ümraniyespor, Sarıyer, Van Spor FK and Bandırmaspor.

Sponsor prefixes and company suffixes are omitted from display names. Kit colours and patterns are recognizable approximations, not authenticated 2026-2027 kits; ratings are gameplay values, not official TFF ratings. This is a dated roster snapshot and does not update automatically with the live standings.

Each sprite entry is keyed by object name and animation name. Animation records have `fps`, `loop`, and `frames`. Each frame has:

| Field | Meaning |
| --- | --- |
| `file` | Atlas filename in this directory. |
| `x`, `y` | Top-left position in the atlas. |
| `w`, `h` | Unrotated frame width and height. |
| `rotated` | The packed atlas region is rotated and occupies `h` × `w` pixels. |
| `originX`, `originY` | Anchor fractions in the unrotated frame. These may lie outside the cropped frame. |

All shooter layers share the same world-space anchor. Draw their individual cropped frames relative to their own origins to keep the body, shirt, shorts and pattern aligned. Goalkeeper body and shirt animations use the same principle. The `Stripes` animations match the exported pattern IDs (`s01`–`s11`, `s13`, `s14`); `s03` is the plain shirt.

`../../shared/keeper-masks.js` contains collision silhouettes derived from the goalkeeper body and shirt artwork. Rebuild it with `python3 games/penaltyshooters/tools/build-keeper-masks.py` from the repository root (requires Pillow). The renderer and server use the same anchors and animation frames, so transparent gaps never count as contact.
