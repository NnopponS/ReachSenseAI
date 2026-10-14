# Web research workbench

This is the primary experiment path for ordinary webcams/phone cameras and the six-finger marker proposal. It uses the existing Python detector and coexists with the imported [automatic RGB Lab](../web/README.md), [native Android capture app](../android/README.md) and [native iOS prototype](../ios/README.md). Android/iOS can also access this workbench in a browser. The existing rigid-fixture RGB calibration is not compatible with the six-finger profile.

## Run from the repository root

Requires Python 3.10+ (tested 3.12), and Node 24 for JavaScript tests. The Web runtime itself needs no Node packages or build step.

```sh
python -m venv .venv
.venv/bin/python -m pip install -r scripts/feasibility/requirements.txt
.venv/bin/python -m workbench.server --host 127.0.0.1 --port 8000
```

On Windows use `.venv\Scripts\python.exe` instead. The default loopback server is for local development. Camera access on a phone requires an HTTPS deployment with the same-origin backend; plain HTTP on a LAN is insufficient. This stdlib development server is not a production hosting configuration.

The same server serves the preserved RGB Lab at `/rgb-lab/`, linked from the workbench. That mode processes images locally in its OpenCV.js worker; it requires its own physical calibration bundle and does not automatically use the workbench's manual ruler points.

Read [the Thai plan](../docs/web-first-plan.th.md) before collecting measurements. Upload a PNG/JPEG or explicitly open the camera, freeze a frame, click two ruler points and two visible anatomical middle fingertips, and acknowledge the image-plane assumptions. The result is a provisional signed image-plane projection, with lateral offset and straight distance reported separately. Marker detection now runs in the browser's OpenCV.js worker and no image is uploaded. The development server retains the original observation endpoint for Python tool tests; the application does not call it.

The CAD v2 page at `cad/` provides exact holder/removable-gauge STL previews, a labeled finger illustration and seating-gap demonstration, six adjustable openings, marker edge size, STL/OpenSCAD/SVG downloads, a 12-object millimeter 3MF, single-finger fit-pair plates and a complete browser-generated ZIP. It includes a ten-remount worksheet and requires gauge removal before measuring. A 10 mm marker has an 11 mm nominal longitudinal offset; full anatomical X/Z and real remount repeatability remain unverified. See [the printing guide](../hardware/finger-wrap-guide.th.md) and [static Pages build/deployment instructions](../docs/github-pages.md).

The digital demo validates software detection, not physical measurement accuracy. Exported JSON contains estimates/evidence but no image. Session memory disappears on reload. No real 3D, MediaPipe, automatic tips, stable-window acquisition, or validated score is supplied yet. User-provided reference categories are kept literally, including their unspecified boundary gaps.

## Checks

```sh
.venv/bin/python -m unittest discover -s python_tests -v
node --test workbench/tests/*.test.js
```

Optional Chromium UI check (server running):

```sh
npm --prefix workbench ci
# Use an existing system Chromium or install the Playwright browser:
# cd workbench && npx playwright install chromium
CHROMIUM_EXECUTABLE=/usr/bin/chromium node workbench/tests/browser-smoke.mjs
```

Without `CHROMIUM_EXECUTABLE`, the check uses Playwright's installed Chromium. `REACHSENSE_TEST_URL` optionally selects another local test origin. A Web manifest supports standalone presentation where supported; offline operation and mobile installability are not yet validated.

See [current-instance results and limitations](../docs/web-validation.md).
