# Complete ReachSenseAI site on GitHub Pages

The user selected GitHub Actions in Pages settings and requested live publication. `pages.yml` now builds and deploys the **complete** site on main pushes or manual dispatch. `web.yml` retains RGB Lab software checks and no longer publishes a separate site over the main workbench.

The expected project URL is `https://nnoppons.github.io/ReachSenseAI/`; the CAD page is its `cad/` subpath and the calibrated original app is `rgb-lab/`. Final publication status must be determined from the actual Actions run and HTTP response, not this expected address.

## Static architecture

- Thai workbench at the root: camera/upload frames are processed in an OpenCV.js worker in the browser. It makes no image-upload or measurement-backend requests. Manual fingertip/ruler scoring remains provisional.
- CAD v2: Three.js displays the exact holder and removable-gauge STL bytes. The checked OpenSCAD library contains 493 offered size pairs (986 meshes): opening 12–26 mm and black edge 8–16 mm, in 0.5 mm increments. Browser exports include six holders, six gauges, a 12-object millimeter plate, one-finger fit plates, SCAD/SVG and a remount worksheet. A separately labeled finger illustration/gap slider explains seating without changing exports or claiming anatomical calibration.
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

The browser check covers six digital marker IDs, provisional manual scoring/export, synthetic camera lifecycle, actual 3D holder/gauge views, gauge visibility, simulated seating gaps, custom size changes, both STL hashes, actual twelve-part ZIP contents, per-file integrity metadata, 12-object and fit-pair 3MFs, invalid settings, mobile layout and the preserved RGB Lab. It asserts that no backend/API/image-upload requests are made.

## Printing and measurement limits

Follow [the printing guide](../hardware/finger-wrap-guide.th.md). The gauge abuts the deck at Y=-3 mm and its **inner fingertip contact face** defines Y=0. The deck remains 3 mm behind the tip after the gauge is removed. A 10 mm black edge yields an **11 mm** longitudinal marker-center-to-reference-plane offset. Gauge seating/removal, X/Z anatomical location, adhesive thickness, remount repeatability and test effects remain physically unverified. First fit/measure one middle-finger pair, then test at least ten independent remounts before considering offset reuse.

Browser/mesh tests do not prove printed fit, physical-camera accuracy, Android/iOS device support, or clinical norm equivalence. The new holder does not automatically enable accepted 3D scores; exported experiment metadata remains `measurement_valid=false`.
