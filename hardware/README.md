# Finger-fixture feasibility gate

## Six-finger printable wrap (Web path)

The v2 [six-finger wrap source](finger_wrap.scad) and [Thai printing/seating guide](finger-wrap-guide.th.md) support separate thumb/middle/little markers on both hands. A **removable seating gauge** abuts the deck at Y=-3 and locates the fingertip against its inner face at Y=0. Lift the gauge off before measuring. The wearable deck stops 3 mm short of the tip reference; two dorsal bearing pads and separated strap pairs help locate the holder. Their physical fit and ability to resist slipping/rotation remain untested.

The Web CAD page offers 12–26 mm candidate openings and 8–16 mm marker black edges, both in 0.5 mm increments. Its 493 size pairs contain 986 holder/gauge meshes exported from this source, with checked closure, connectedness, volume and SHA-256. Both actual displayed meshes are also downloaded. The finger illustration and seating-gap slider are explanatory and are excluded from exports/calibration. Single-color holders use matte paper/sticker markers with full 2 mm white margins. The optional ladder strip is TPU-only and needs a fastener; two 6 mm hook-and-loop straps per finger are the alternative.

[Default v2 ZIP](printables/finger-wrap-v2/reachsense-six-finger-kit.zip) · [12-piece millimeter 3MF](printables/finger-wrap-v2/all-six-holders-and-gauges.3mf) · [middle-finger fit pair](printables/finger-wrap-v2/left-middle-22-fit-pair.3mf) · [A4 artwork](printables/finger-wrap-v2/markers-a4.svg) · [10-remount worksheet](finger-wrap-fit-check.csv). Browser custom kits include six holders, six matching gauges, both CAD presets per finger, individual fit-pair plates and integrity metadata. Begin with one middle-finger pair before a complete set. Archived v1 files are retained in the repository and are incompatible with v2 gauges.

With a 10 mm black edge, the nominal longitudinal marker-center-to-tip-reference-plane distance is **11 mm** (3 mm exposed tip + 1 mm frame + 2 mm white margin + 5 mm half-edge). It is not a complete 3D marker-to-anatomical-tip vector. Anatomical X/Z remain unspecified. Verify printed gauge seating, removal shift and repeated mounting with an independent reference before reusing an offset; repeat seating checks each time. Do not subtract a fixed scalar from two marker-center distances.

To rebuild without overwriting user outputs:

```sh
.venv/bin/python -m hardware.finger_wrap --output-dir hardware/generated/new-default-kit
.venv/bin/python -m hardware.finger_wrap_catalog --output-dir hardware/generated/new-catalog --jobs 4
```

OpenSCAD 2021.01+ is only needed to change/rebuild the CAD source, not to view or download published sizes. Rebuild the catalog with at most four workers in this cloud allocation. The original multi-face native jig design below is a different marker/calibration profile.

The next physical gate is a repeatable anatomical relationship between each middle fingertip and its multi-face rigid reference. This directory supplies an adjustable CAD candidate and nominal geometry for experiments, not a validated or participant-ready fixture.

## Candidate design

`finger_fixture.scad` has two separated dorsal half-ring supports, retention slots, a bridge, a gentle fingertip stop, and a three-face marker mount. Candidate defaults are an 8 mm finger radius, 18 mm support spacing, 10 mm marker edges with 2 mm quiet-zone margins, and 35-degree side faces. These dimensions must be adjusted after fit, visibility, mass, comfort, and overlap tests. The mesh has no claim of joint immobilization or anatomical rigidity.

The physical frame R has origin at the nominal tip stop, +Y toward the distal fingertip, +Z dorsal, and +X lateral. Nominal face transforms and canonical corners come from the same dimensions. Actual prints, adhesive thickness, marker orientation, liner/strap choices, and fingertip registration require measurement and calibration.

```sh
python -m hardware.fixture_layout --output-dir hardware/generated/upper-candidate
python -m hardware.fixture_layout --radius-mm 9 --ids 31 32 33 \
  --output-dir hardware/generated/lower-candidate --openscad /path/to/openscad
```

Use OpenSCAD 2021.01 or newer to inspect/adjust the source and generate STL. Generated layout JSON is explicitly marked `candidate-unmeasured-not-valid-for-scoring`; it must not be passed off as verified jig calibration. Print the [candidate marker sheet](prototypes/marker-sheet.svg) at 100% and independently measure its black edges. [Marker generation/detection tools](../scripts/feasibility/README.md) support alternate experimental dimensions and dictionaries. Canonical marker tops must point toward fixture +Y for this nominal layout; verify actual mounting transforms.

## Required experiments before expanded fusion work

1. Measure actual finger/contact dimensions and select retention/liner materials. Document which middle/distal regions the supports register and which motions can alter the endpoint.
2. Independently measure virtual endpoint drift under insertion, finger flexion/rotation, sliding, repeated remounting, and palm-to-palm overlap. Separate mechanical movement from optical pose error.
3. Check hand/finger reach and comfort against the intended test; the stop/supports may change posture or prevent bare-finger contact. Record that equipment effect rather than assuming equivalence.
4. Test tag image area, corner geometry, blur, incidence angle, depth coverage, and occlusion at candidate camera distances. Establish usable observations from conditioning/residuals/depth support.
5. Measure every face transform and the anatomical endpoint in the common frame for each physical jig. Version the verified calibration and record jig identity, marker IDs/dictionary, marker orientation, geometry and verification evidence.
6. Prototype/calibrate a repeatable upper-back harness or multi-contact mount, including board-to-body registration and remount/angular drift.

Only demonstrated registration, visibility, and comfort evidence advances the physical gate. CAD rendering or passing software tests alone does not satisfy it.

## Rendered candidate

![Nominal finger fixture candidate](prototypes/finger-fixture-candidate.png)

[STL mesh](prototypes/finger-fixture-candidate.stl) | [nominal face layout](prototypes/candidate-layout.json). Generated from the source with OpenSCAD 2021.01. The STL has 620 triangles, closed two-face edge topology, and nonzero volume. This is mesh evidence only; physical fit, seating rigidity and calibration remain untested.
