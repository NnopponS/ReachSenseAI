# CAD and static Pages software evidence

Local validation on 2026-10-14:

- Exported 493 size combinations using OpenSCAD 2021.01 and four workers within the cloud allocation of four CPUs. Every mesh passed closed-edge topology, connectedness, nondegenerate triangles and positive-volume checks. Source/asset hashes are recorded in the catalog.
- Exported the default six-holder ZIP, TPU strip and six-object millimeter 3MF plate. Reference metadata explicitly leaves anatomical X/Z unverified and does not declare an anatomical 3D endpoint.
- Python suite: 19 tests passed, including default-kit integrity, real ArUco decoding from the SVG artwork, all offered catalog hashes, representative min/max/custom mesh geometry, an actual inner stop face at Y=0, 3MF topology and invalid dimensions.
- JavaScript suite: 9 existing behavioral tests passed.
- Browser checks passed for the development server and a fully static site under `/ReachSenseAI/`. Actual selected STL bytes match the declared catalog hash after changing dimensions. The downloaded custom ZIP contains six STL/SCAD/marker exports with checked hashes and a six-object 3MF plate. No backend/API/image-upload request occurs in the static workflow.
- Desktop and mobile Chromium layouts and the actual WebGL view passed. Synthetic camera and digital artwork tests are software checks, not physical-camera acceptance.

The first static browser check clicked partly outside the visible canvas because the navigation increased page height; scrolling the canvas into view corrected the test. No measurement assertion was removed.

The previous integrated commit `c3510c9` has now been independently observed as successful in destination GitHub Actions: [workbench](https://github.com/NnopponS/ReachSenseAI/actions/runs/38508779160), [RGB Web](https://github.com/NnopponS/ReachSenseAI/actions/runs/38508779095), [Android APK](https://github.com/NnopponS/ReachSenseAI/actions/runs/38508779092), [Swift/iOS/IPA](https://github.com/NnopponS/ReachSenseAI/actions/runs/38508779090). Those runs precede the CAD/Pages change and are not evidence of this new deployment.

Physical print fit, surface quality, strap retention, remount drift, fingertip X/Z, occlusion, accuracy and actual phone compatibility remain untested. This is a printable experimental design, not metrologically validated hardware.
