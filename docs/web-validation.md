# Current-instance software validation

Validated on 2026-10-14 in the cloud Linux environment with Python 3.12.14, Node 24.19.0, OpenCV 4.13.0.92 and Playwright 1.64.0 using system Chromium.

| Check | Outcome | Scope |
| --- | --- | --- |
| Python unittest discovery | 14 passed | 11 inherited tool tests + 3 new HTTP-workbench tests |
| Node measurement tests | 9 passed | 5 workbench tests + 4 imported RGB Lab tests: projection, calibration, stable-window/trial protocol, invalid input and table boundaries |
| Imported RGB browser suite | 8 groups passed | real OpenCV runtime/PnP/detection, missing-reference rejection, protocol/storage/consent/lifecycle and responsive navigation |
| Chromium desktop | Passed | six digital markers detected, 3–4–5 manual geometry, assumptions gate, undo, save and JSON download |
| Synthetic camera | Passed | start/freeze/stop and track release; not a physical camera |
| Combined Web server | Passed | RGB Lab served at `/rgb-lab/`; actual worker configures OpenCV and rejects missing references |
| Mobile Chromium viewport | Passed | PNG upload, six marker detections, no horizontal overflow at 390 px |
| Browser errors | None in tested workflow | no uncaught browser exceptions or failed HTTP responses |
| Frozen npm install | Passed | `npm --prefix workbench ci` from the checked-in lockfile |
| RGB Lab frozen npm install | Passed | `npm --prefix web ci` from its original lockfile |
| Android standalone assertions | Both check programs passed | timing association and report persistence; Java 21 compiler module, source/target 17, checksum-verified JSON dependency |
| OpenCV.js artifact | Passed | bytes and SHA-256 match original pinned runtime manifest |
| Native Android APK/lint | Unrun locally | Android SDK/Gradle toolchain not installed; destination Android CI retained and enabled on main |
| Native Swift/iOS build | Unrun locally | no Swift/Xcode on this Linux machine; retained macOS CI must run in the destination repository |
| Physical marker/strap/accuracy | Unrun | requires real prints, known-distance references and remount experiments |
| Safari/physical Android/iOS | Unrun | responsive Chromium is not a mobile-device compatibility certification |

The UI check initially used exact floating-point equality for the exported −4 cm software case. It observed `−4.000000000000001`; the check now allows 1e-9 numerical tolerance while preserving the unrounded exported value. No geometry assertion was disabled.

The cloud Java runtime includes the compiler module but no `javac` launcher or release-17 symbol archive. `--release 17` was unavailable; the standalone checks were compiled using `java --module jdk.compiler/com.sun.tools.javac.Main -source 17 -target 17` and executed with assertions enabled. This checks JVM behavior, not Android API compatibility; Android CI still uses JDK 17 and the pinned SDK.

New Web CI runs the software tests and Chromium workflow. Results in this document are local results, not a claim that destination GitHub Actions passed. Existing source CI links remain in the original implementation ledger.

The exact reusable install script was executed again after merging all platforms. Both frozen npm installations and the pinned OpenCV.js integrity check passed; Python dependencies were already satisfied. The owned development server was stopped/restarted from `workbench.server`, then exercised using real HTTP requests and the combined browser check.

GitHub API requests from this cloud environment returned `Forbidden` at `api.github.com`. Native Git access is a separate route. Destination Actions results therefore remain unverified here; API access is not required for the tested local Web workflow.

No functional validation here establishes clinical validity, printed marker dimensions, camera metrology, repeatability, or reference-table equivalence. All experiment exports retain `measurement_valid=false`.
