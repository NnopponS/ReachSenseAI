# Web research workbench

This is the primary development path for ordinary webcams/phone cameras. It retains the native iOS feasibility project and uses the existing Python OpenCV detector. Android and iOS access this Web app in a browser; there is no native Android implementation.

## Run from the repository root

Requires Python 3.10+ (tested 3.12), and Node 24 for JavaScript tests. The Web runtime itself needs no Node packages or build step.

```sh
python -m venv .venv
.venv/bin/python -m pip install -r scripts/feasibility/requirements.txt
.venv/bin/python -m workbench.server --host 127.0.0.1 --port 8000
```

On Windows use `.venv\Scripts\python.exe` instead. The default loopback server is for local development. Camera access on a phone requires an HTTPS deployment with the same-origin backend; plain HTTP on a LAN is insufficient. This stdlib development server is not a production hosting configuration.

Read [the Thai plan](../docs/web-first-plan.th.md) before collecting measurements. Upload a PNG/JPEG or explicitly open the camera, freeze a frame, click two ruler points and two visible anatomical middle fingertips, and acknowledge the image-plane assumptions. The result is a provisional signed image-plane projection, with lateral offset and straight distance reported separately. Marker detection does not automatically supply a fingertip measurement. No images are written to disk. Images are sent to this app's server for in-memory processing; this is not browser-only vision processing.

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
