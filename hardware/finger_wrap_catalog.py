"""Build a finite STL library so all offered Web sizes also work on static Pages."""
from concurrent.futures import ThreadPoolExecutor
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

import cv2
from hardware.finger_wrap import SOURCE, ROOT, FINGERS, DEFAULTS, VERSION, recipe_hash, mesh_evidence

CATALOG_DIR = ROOT/'printables'/'finger-wrap-catalog-v1'
DIAMETERS = [12+i*.5 for i in range(29)]
EDGES = [8+i*.5 for i in range(17)]


def build_catalog(directory, jobs=4):
    directory = Path(directory)
    directory.mkdir(parents=True,exist_ok=False)
    (directory/'meshes').mkdir()
    source = SOURCE.read_bytes()
    guide = (ROOT/'finger-wrap-guide.th.md').read_bytes()
    entries = {}
    executable = shutil.which('openscad')
    if not executable: raise RuntimeError('Install OpenSCAD to rebuild the printable catalog')
    tasks = [(d,e) for d in DIAMETERS for e in EDGES]
    def export(task):
        d,e = task
        key = f'd{d:g}-e{e:g}'
        name = f'meshes/{key}.stl'
        result = subprocess.run([executable,'--export-format','binstl','-o',str(directory/name),
                                 '-D',f'finger_diameter_mm={d}','-D',f'marker_edge_mm={e}',str(SOURCE)],
                                capture_output=True,timeout=60,env={**os.environ,'QT_QPA_PLATFORM':'offscreen'})
        if result.returncode: raise RuntimeError(f'OpenSCAD export failed for {key}')
        data = (directory/name).read_bytes()
        return key,{'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
                    'diameter_mm':d,'edge_mm':e,'mesh':mesh_evidence(data)}
    with ThreadPoolExecutor(max_workers=jobs) as pool:
        for index,(key,entry) in enumerate(pool.map(export,tasks),1):
            entries[key]=entry
            if index%25==0 or index==len(tasks): print(f'Validated {index}/{len(tasks)} printable sizes',flush=True)
    strap = directory/'tpu-ladder-strip.stl'
    result = subprocess.run([executable,'--export-format','binstl','-o',str(strap),'-D','part="strap"',str(SOURCE)],
                            capture_output=True,timeout=60,env={**os.environ,'QT_QPA_PLATFORM':'offscreen'})
    if result.returncode: raise RuntimeError('TPU strip export failed')
    strap_data=strap.read_bytes()
    marker_bits={str(i):cv2.aruco.generateImageMarker(cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_100),i,120)[::20,::20].astype(int).tolist() for i,_,_,_ in FINGERS}
    catalog={'schema_version':1,'design_version':VERSION,'units':'mm','dictionary':'DICT_4X4_100',
             'source_sha256':hashlib.sha256(source).hexdigest(),'recipe_sha256':recipe_hash(),
             'defaults':DEFAULTS,'diameters_mm':DIAMETERS,'edges_mm':EDGES,
             'fingers':[{'id':i,'role':role,'label':label} for i,role,label,_ in FINGERS],
             'marker_bits':marker_bits,'meshes':entries,
             'strap':{'file':strap.name,'bytes':len(strap_data),'sha256':hashlib.sha256(strap_data).hexdigest(),'mesh':mesh_evidence(strap_data)},
             'assets':{'finger-wrap.scad':{'sha256':hashlib.sha256(source).hexdigest()},
                       'guide.th.md':{'sha256':hashlib.sha256(guide).hexdigest()}},
             'status':'experimental-unprinted-not-valid-for-scoring','measurement_valid':False}
    (directory/'finger-wrap.scad').write_bytes(source)
    (directory/'guide.th.md').write_bytes(guide)
    (directory/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    return catalog


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',type=Path,required=True)
    parser.add_argument('--jobs',type=int,choices=range(1,5),default=4)
    args=parser.parse_args()
    build_catalog(args.output_dir,args.jobs)
