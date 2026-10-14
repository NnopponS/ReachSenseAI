# Complete ReachSenseAI site on GitHub Pages

The user selected GitHub Actions in Pages settings and requested live publication. `pages.yml` now builds and deploys the **complete** site on main pushes or manual dispatch. `web.yml` retains RGB Lab software checks and no longer publishes a separate site over the main workbench.

The expected project URL is `https://nnoppons.github.io/ReachSenseAI/`; the CAD page is its `cad/` subpath and the calibrated original app is `rgb-lab/`. Final publication status must be determined from the actual Actions run and HTTP response, not this expected address.

## Static architecture

- Thai workbench at the root: camera/upload frames are processed in an OpenCV.js worker in the browser. It makes no image-upload or measurement-backend requests. Manual fingertip/ruler scoring remains provisional.
- CAD: Three.js displays the actual selected binary STL. A finite, integrity-checked OpenSCAD library contains all 493 offered combinations: finger opening 12–26 mm and marker edge 8–16 mm, in 0.5 mm increments. Browser ZIP/3MF/SCAD/SVG exports use the same selected geometry and marker dimensions.
- RGB Lab remains at `rgb-lab/` with its existing browser solver, calibration and acceptance gates.
- All assets have project-relative paths. There is no Python/OpenSCAD service in the deployed site. OpenSCAD is required only to rebuild or expand the physical geometry library.
- Package license files and the checked OpenCV runtime are included. The builder verifies every mesh/source checksum before staging.

## Local build and checks

From the repository root:

```sh
npm --prefix workbench ci
.venv/bin/python -m scripts.build_pages --output-dir site
CHROMIUM_EXECUTABLE=/usr/bin/chromium node workbench/tests/pages-smoke.mjs
```

The builder refuses an existing output directory. Preserve any user content first; remove only a previously generated `site/` when refreshing it. Serve the staged directory using `python3 -m http.server 8000 --directory site` for local development. The test serves the site at `/ReachSenseAI/` to catch absolute paths and backend dependencies that would break Pages.

The browser check covers six digital marker IDs, provisional manual scoring/export, synthetic camera lifecycle, a real 3D view, changing one finger size and marker size, STL hash consistency, actual six-part ZIP contents, per-file integrity metadata, millimeter 3MF objects, invalid settings, mobile layout and the preserved RGB Lab. It asserts that no backend/API/image-upload requests are made.

## Printing and measurement limits

Follow [the printing guide](../hardware/finger-wrap-guide.th.md). The fingertip reference is the **inner stop face / deck edge** at Y=0, not the outer wall or a bounding-box edge. A 10 mm black edge yields an 8 mm longitudinal marker-center-to-reference-plane offset including frame/white margins. Its X/Z anatomical relationship, adhesion thickness, remount repeatability and effects on the test remain physically unverified.

Browser/mesh tests do not prove printed fit, physical-camera accuracy, Android/iOS device support, or clinical norm equivalence. The new holder does not automatically enable accepted 3D scores; exported experiment metadata remains `measurement_valid=false`.
