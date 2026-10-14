"""Stage the complete static application, verifying every printable asset first."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
from hardware.finger_wrap import recipe_hash

ROOT=Path(__file__).resolve().parents[1]
WORKBENCH=ROOT/'workbench'
CATALOG=ROOT/'hardware/printables/finger-wrap-catalog-v2'


def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def build(output):
    output=Path(output).resolve()
    if output.exists():
        raise ValueError('Use a new output directory; existing files are preserved')
    manifest=json.loads((CATALOG/'catalog.json').read_text(encoding='utf-8'))
    if manifest['source_sha256']!=digest(ROOT/'hardware/finger_wrap.scad'):
        raise ValueError('Printable catalog is stale; rebuild it from the CAD source')
    if manifest['recipe_sha256']!=recipe_hash():
        raise ValueError('Printable catalog recipe/guide/worksheet is stale; rebuild it')
    for entry in [*manifest['meshes'].values(),*(m['gauge'] for m in manifest['meshes'].values()),manifest['strap']]:
        path=CATALOG/entry['file']
        if len(path.read_bytes())!=entry['bytes'] or digest(path)!=entry['sha256']:
            raise ValueError('Printable mesh checksum mismatch')
    for name,entry in manifest['assets'].items():
        if digest(CATALOG/name)!=entry['sha256']:raise ValueError('Printable source/guide checksum mismatch')
    runtime=json.loads((ROOT/'web/vendor/runtime.json').read_text())
    opencv=ROOT/'web/vendor/opencv.js'
    if digest(opencv)!=runtime['sha256'] or opencv.stat().st_size!=runtime['bytes']:
        raise ValueError('OpenCV runtime integrity check failed')
    output.mkdir(parents=True)
    for name in ['index.html','app.js','measurement.js','detector.js','marker-worker.js','style.css','icon.svg','manifest.webmanifest']:
        shutil.copy2(WORKBENCH/name,output/name)
    shutil.copy2(ROOT/'hardware/prototypes/marker-sheet.svg',output/'marker-sheet.svg')
    # Purely digital input for the software demonstration, not an accuracy dataset.
    from workbench.server import demonstration_image
    (output/'demo.png').write_bytes(demonstration_image())
    (output/'runtime').mkdir()
    shutil.copy2(opencv,output/'runtime/opencv.js')
    shutil.copy2(ROOT/'web/vendor/LICENSE.opencv.txt',output/'runtime/LICENSE.opencv.txt')
    cad=output/'cad';cad.mkdir()
    for src,dest in [('cad.html','index.html'),('cad.js','cad.js'),('cad-model.js','model.js'),('cad-viewer.js','viewer.js'),('cad.css','cad.css')]:
        shutil.copy2(WORKBENCH/src,cad/dest)
    vendor=cad/'vendor';vendor.mkdir()
    for name in ['three.module.js','three.core.js']:
        shutil.copy2(WORKBENCH/'node_modules/three/build'/name,vendor/name)
    shutil.copy2(WORKBENCH/'node_modules/three/LICENSE',vendor/'LICENSE.three.txt')
    shutil.copy2(WORKBENCH/'node_modules/jszip/dist/jszip.min.js',vendor/'jszip.min.js')
    shutil.copy2(WORKBENCH/'node_modules/jszip/LICENSE.markdown',vendor/'LICENSE.jszip.md')
    shutil.copytree(CATALOG,cad/'data-v2')
    rgb=output/'rgb-lab';rgb.mkdir()
    for path in (ROOT/'web').iterdir():
        if path.suffix in ['.html','.css','.js']:shutil.copy2(path,rgb/path.name)
    for name in ['vendor','examples']:shutil.copytree(ROOT/'web'/name,rgb/name)
    (output/'.nojekyll').write_text('')
    (output/'build-info.json').write_text(json.dumps({'app':'ReachSenseAI','static':True,'cad_sizes':len(manifest['meshes']),
        'cad_version':manifest['design_version'],'cad_source_sha256':manifest['source_sha256']}))
    print(f'Staged static workbench, RGB Lab and {len(manifest["meshes"])} checked printable sizes')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',type=Path,required=True)
    args=parser.parse_args()
    build(args.output_dir)
