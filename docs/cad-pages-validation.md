# CAD and static Pages software evidence

Local validation on 2026-10-14:

- Exported 493 size combinations using OpenSCAD 2021.01 and four workers within the cloud allocation of four CPUs. Every mesh passed closed-edge topology, connectedness, nondegenerate triangles and positive-volume checks. Source/asset hashes are recorded in the catalog.
- Exported the default six-holder ZIP, TPU strip and six-object millimeter 3MF plate. Reference metadata explicitly leaves anatomical X/Z unverified and does not declare an anatomical 3D endpoint.
- Python suite: 19 tests passed, including default-kit integrity, real ArUco decoding from the SVG artwork, all offered catalog hashes, representative min/max/custom mesh geometry, an actual inner stop face at Y=0, 3MF topology and invalid dimensions.
- JavaScript suite: 9 existing behavioral tests passed.
- Browser checks passed for the development server and a fully static site under `/ReachSenseAI/`. Actual selected STL bytes match the declared catalog hash after changing dimensions. The downloaded custom ZIP contains six STL/SCAD/marker exports with checked hashes and a six-object 3MF plate. No backend/API/image-upload request occurs in the static workflow.
- Desktop and mobile Chromium layouts and the actual WebGL view passed. Synthetic camera and digital artwork tests are software checks, not physical-camera acceptance.

The first static browser check clicked partly outside the visible canvas because the navigation increased page height; scrolling the canvas into view corrected the test. No measurement assertion was removed.

The first two Pages CI runs reached the browser check but failed the known-distance click fixture (Chrome reported −4.11 cm for the intended −4 cm case). The test now uses integer CSS coordinates with an independent 100-pixel ruler and 30/40-pixel tip delta; it retains the same exact displayed-score assertion. Canvas focus also avoids scrolling between mouse-down and click. [Pages run 38515012224](https://github.com/NnopponS/ReachSenseAI/actions/runs/38515012224) passed build/deploy. The live root, `cad/` and `rgb-lab/` returned HTTP 200, and a live custom-size STL matched its declared SHA-256.

The native workflow for that commit passed Swift core tests, iOS/IPA build and Linux research tools, but its Windows research-tool job failed. A temporary export with `core.autocrlf=true` reproduced the CAD source hash mismatch. `.gitattributes` now pins LF for fingerprinted CAD sources/artwork and preserves binary STL/3MF/ZIP bytes. Recorded hashes and assertions were retained unchanged.

The previous integrated commit `c3510c9` has now been independently observed as successful in destination GitHub Actions: [workbench](https://github.com/NnopponS/ReachSenseAI/actions/runs/38508779160), [RGB Web](https://github.com/NnopponS/ReachSenseAI/actions/runs/38508779095), [Android APK](https://github.com/NnopponS/ReachSenseAI/actions/runs/38508779092), [Swift/iOS/IPA](https://github.com/NnopponS/ReachSenseAI/actions/runs/38508779090). Those runs precede the CAD/Pages change and are not evidence of this new deployment.

Physical print fit, surface quality, strap retention, remount drift, fingertip X/Z, occlusion, accuracy and actual phone compatibility remain untested. This is a printable experimental design, not metrologically validated hardware.

## Removable-gauge v2 revision

The v2 design adds a hand-held seating gauge and two exposed flat dorsal bearing pads. Its gauge abuts the deck at Y=-3 mm and sets the fingertip-contact plane at Y=0. The deck stays 3 mm behind that reference after the gauge is lifted off. The nominal longitudinal offset for a 10 mm marker is now 11 mm. Anatomical X/Z remain unspecified; exports still set `measurement_valid=false`.

Validation of this revision on 2026-10-14:

- Exported and independently checked 493 size pairs (986 holder/gauge meshes), plus the TPU strip. All are closed, connected, nondegenerate and have positive volume. The catalog fingerprints each mesh and shares nominal geometry metadata with Python/browser exports.
- A real geometry assertion caught the initial bearing pads being absorbed by the existing curved shell. The final pads extend 0.6 mm into the nominal curved opening and have exposed downward-facing flat surfaces at both strap positions. The complete library was rebuilt from that corrected source; the assertion was retained.
- OpenSCAD solid intersections for minimum, maximum, default and custom sizes at gauge lifts of 0, 1, 5 and 20 mm found zero volumetric interference in all 16 cases. Nominal mating surfaces may touch. This checks ideal CAD geometry, not printer tolerances or removal-induced motion on skin.
- All 21 Python tests and 9 JavaScript tests passed. They cover the actual gauge contact at Y=0, deck abutment at Y=-3, exposed pads, all library hashes, default ZIP artwork, fit-pair contents and manifold twelve-part 3MFs positioned on Z=0 without overlap.
- Development browser checks passed for detection, provisional measurements/export, synthetic camera lifecycle, RGB Lab's real WASM worker and mobile upload/layout.
- Static browser checks under `/ReachSenseAI/` passed for actual holder/gauge meshes, gauge visibility, simulated seating gaps, custom dimensions, both downloadable STL hashes, complete twelve-part ZIP/3MF and single-finger fit pair, desktop/mobile layouts and zero backend requests. The downloaded browser-generated custom 3MF was also checked independently with Python: twelve distinct objects, lowest vertices on Z=0 and nonoverlapping placements within a 220 mm bed.
- The finger illustration/gap slider is excluded from print files and calibration. Versioned `data-v2/` and script URLs prevent an older cached client from combining its old 8 mm metadata with v2 geometry.

The first physical step is a single middle-finger holder/gauge fit pair. The included worksheet records ten remounts and independent longitudinal measurements before/after gauge removal, observed rotation and posture changes. Fit, gauge clearance, removal drift, skin compression, three-dimensional anatomical registration and measurement accuracy remain untested. Offset reuse is conditional on those physical results; each attempt still requires a seating check.
