# USV-0 license audit

The repository is **mixed-license**. Only application source is covered by the
root MIT license. Preserve `LICENSE`, `THIRD_PARTY_NOTICES.md`, embedded GLB
metadata and `site/assets/audio/LICENSES.md` when redistributing.

## Actually used by the USV baseline

| Component | Origin / author | License |
|---|---|---|
| Open Water source | bob6664569, copyright 2026 | MIT |
| Vendored Three.js r170 | Three.js Authors | MIT, `site/vendor/LICENSE` |
| `assets/boats/zodiac_boat.glb` | [Zodiac boat](https://sketchfab.com/3d-models/zodiac-boat-a10b7997f1514bd7829ece74f68c681c), RedC130 | CC BY 4.0 |
| `sky_clear_4k.hdr` / constrained-device `sky_clear_1k.hdr` | Poly Haven Qwantani Pure Sky, Greg Zaal / Jarod Guest | CC0 1.0 |
| Zodiac engine audio (`zefiro-low/high.mp3`) | kyles, Freesound 454197 | CC0 1.0 |
| Sea loops | Nox_Sound 829629, kyles 451630, chris_dagorne 426076 | CC0 1.0 |
| Rain loops | _lynks 595717, Rubaoliva 624645 | CC0 1.0 |
| Thunder recordings | SholeColtis, Emulius, elmoustachio, LukaCafuka, AyaDrevis, saha213131 | CC0 1.0; exact URLs in audio notices |

Zodiac geometry, materials, profile and original two-motor animation rig are
unchanged. The new inline favicon is simple project-authored vector geometry.

## Retained in repository but NOT requested at runtime

Other fleet GLBs and wildlife assets are intentionally retained for a later
asset cleanup commit, per USV-0 scope. **Wildlife assets not used by USV baseline.**
No fauna module is imported by `main.js`; there are no animal render objects,
fauna updates, bird calls or animal audio requests. The audio prefetch list is
limited to the Zodiac engine bank and sea/weather recordings.

Restricted inactive assets remain restricted even when not loaded:

- Frickie's Yacht: **CC BY-NC 4.0**.
- Dolphin and turtle: **CC BY-NC 4.0**.
- Manta ray: **CC BY-NC-SA 4.0**.
- Flying seagull: **CC BY-SA 4.0**.
- Racer engine recording: separate SFX Engine project-use license, no standalone redistribution.
- Megayacht horn: separate terms in audio notices; not invoked here.

Other boats are generally CC BY 4.0; wildlife include CC BY, CC0 and the above
restricted licenses. The full per-file author/source/license inventory remains
in `THIRD_PARTY_NOTICES.md`. A commercial distribution must still remove/replace
NC files in the distributed bundle; disabling their runtime use does not
relicense the repository or its history.
