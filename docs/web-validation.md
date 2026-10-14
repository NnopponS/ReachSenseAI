# Current-instance software validation

Validated on 2026-10-14 in the cloud Linux environment with Python 3.12.14, Node 24.19.0, OpenCV 4.13.0.92 and Playwright 1.64.0 using system Chromium.

| Check | Outcome | Scope |
| --- | --- | --- |
| Python unittest discovery | 14 passed | 11 inherited tool tests + 3 new HTTP-workbench tests |
| Node measurement tests | 5 passed | signed gap/overlap, lateral vs straight distance, rotation, invalid input and all four table rows/boundary gaps |
| Chromium desktop | Passed | six digital markers detected, 3–4–5 manual geometry, assumptions gate, undo, save and JSON download |
| Synthetic camera | Passed | start/freeze/stop and track release; not a physical camera |
| Mobile Chromium viewport | Passed | PNG upload, six marker detections, no horizontal overflow at 390 px |
| Browser errors | None in tested workflow | no uncaught browser exceptions or failed HTTP responses |
| Frozen npm install | Passed | `npm --prefix workbench ci` from the checked-in lockfile |
| Native Swift/iOS build | Unrun locally | no Swift/Xcode on this Linux machine; retained macOS CI must run in the destination repository |
| Physical marker/strap/accuracy | Unrun | requires real prints, known-distance references and remount experiments |
| Safari/physical Android/iOS | Unrun | responsive Chromium is not a mobile-device compatibility certification |

The UI check initially used exact floating-point equality for the exported −4 cm software case. It observed `−4.000000000000001`; the check now allows 1e-9 numerical tolerance while preserving the unrounded exported value. No geometry assertion was disabled.

New Web CI runs the software tests and Chromium workflow. Results in this document are local results, not a claim that destination GitHub Actions passed. Existing source CI links remain in the original implementation ledger.

No functional validation here establishes clinical validity, printed marker dimensions, camera metrology, repeatability, or reference-table equivalence. All experiment exports retain `measurement_valid=false`.
