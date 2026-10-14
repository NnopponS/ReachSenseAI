"""Printable six-finger kit. CAD, Web preview and exports share this one model."""
import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import threading
import zipfile
import xml.etree.ElementTree as ET

import cv2
import numpy as np
from scripts.feasibility.markers import marker_sheet

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT/'finger_wrap.scad'
DEFAULT_DIR = ROOT/'printables'/'finger-wrap-v1'
CACHE_DIR = ROOT/'generated'/'finger-wrap-v1'
VERSION = 'finger-wrap-v1'
FINGERS = [
    (21, 'left-thumb', 'ซ้าย · นิ้วโป้ง', 20),
    (22, 'left-middle', 'ซ้าย · นิ้วกลาง', 17),
    (23, 'left-little', 'ซ้าย · นิ้วก้อย', 14),
    (31, 'right-thumb', 'ขวา · นิ้วโป้ง', 20),
    (32, 'right-middle', 'ขวา · นิ้วกลาง', 17),
    (33, 'right-little', 'ขวา · นิ้วก้อย', 14),
]
DEFAULTS = {'edge': 10.0, **{f'd{i}': float(d) for i, _, _, d in FINGERS}}
_build_lock = threading.Lock()


def recipe_hash():
    return hashlib.sha256(SOURCE.read_bytes()+Path(__file__).read_bytes()+(ROOT/'finger-wrap-guide.th.md').read_bytes()).hexdigest()


def parameters(values=None):
    supplied = {} if values is None else values
    if set(supplied)-set(DEFAULTS):
        raise ValueError('Unknown CAD setting')
    result = {}
    for name, default in DEFAULTS.items():
        value = supplied.get(name, default)
        if isinstance(value, bool):
            raise ValueError('CAD dimensions must be numbers')
        try:
            value = float(value)
        except (ValueError, TypeError):
            raise ValueError('CAD dimensions must be finite numbers') from None
        limits = (8, 16) if name == 'edge' else (12, 26)
        if not math.isfinite(value) or not limits[0] <= value <= limits[1]:
            raise ValueError(f'{name} must be within {limits[0]}–{limits[1]} mm')
        if abs(value*2-round(value*2)) > 1e-6:
            raise ValueError('Choose dimensions in 0.5 mm increments')
        result[name] = round(value, 1)
    return result


def binary_mesh(data):
    if len(data) < 84:
        raise ValueError('Invalid STL')
    count = struct.unpack_from('<I', data, 80)[0]
    if len(data) != 84 + count*50 or count > 100_000:
        raise ValueError('Expected bounded binary STL')
    faces = []
    for index in range(count):
        values = struct.unpack_from('<12fH', data, 84+index*50)
        faces.append([tuple(values[j:j+3]) for j in (3, 6, 9)])
    return faces


def mesh_evidence(data):
    """Independent topology/volume check of the exported mesh, not physical validation."""
    faces = binary_mesh(data)
    edges, adjacency, volume = {}, {}, 0.0
    for face in faces:
        a, b, c = [tuple(round(v, 5) for v in p) for p in face]
        cross = np.cross(np.subtract(b, a), np.subtract(c, a))
        if np.linalg.norm(cross) < 1e-7:
            raise ValueError('Degenerate STL triangle')
        volume += float(np.dot(a, np.cross(b, c)))/6
        for p, q in ((a,b), (b,c), (c,a)):
            edge = tuple(sorted((p,q)))
            edges[edge] = edges.get(edge, 0)+1
            adjacency.setdefault(p, set()).add(q)
            adjacency.setdefault(q, set()).add(p)
    if not faces or any(count != 2 for count in edges.values()) or volume <= 0:
        raise ValueError('Mesh must be closed, consistently outward-facing and nonzero-volume')
    unseen, components = set(adjacency), 0
    while unseen:
        components += 1
        todo = [unseen.pop()]
        while todo:
            neighbors = adjacency[todo.pop()] & unseen
            unseen.difference_update(neighbors)
            todo.extend(neighbors)
    if components != 1:
        raise ValueError('A printed part must be connected')
    points = np.array(list(adjacency))
    return {'triangles':len(faces), 'closed':True, 'connected_components':components,
            'volume_mm3':round(volume, 3), 'bounds_mm':[points.min(axis=0).tolist(), points.max(axis=0).tolist()]}


def marker_svg(marker_id, edge):
    tile = edge+4
    root = ET.Element('svg', xmlns='http://www.w3.org/2000/svg', width=f'{tile:g}mm',
                      height=f'{tile:g}mm', viewBox=f'0 0 {tile:g} {tile:g}')
    ET.SubElement(root, 'rect', width=f'{tile:g}', height=f'{tile:g}', fill='white')
    bits = cv2.aruco.generateImageMarker(cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_100), marker_id, 120)[::20,::20]
    cell = edge/6
    for row, col in np.argwhere(bits==0):
        ET.SubElement(root, 'rect', x=f'{2+col*cell:.8f}', y=f'{2+row*cell:.8f}',
                      width=f'{cell:.8f}', height=f'{cell:.8f}', fill='black')
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


def plate_3mf(parts):
    """One printable build plate with explicit millimeter units and all six holders."""
    ns = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
    ET.register_namespace('', ns)
    tag = lambda n: f'{{{ns}}}{n}'
    model = ET.Element(tag('model'), unit='millimeter', **{'{http://www.w3.org/XML/1998/namespace}lang':'en-US'})
    resources = ET.SubElement(model, tag('resources'))
    build = ET.SubElement(model, tag('build'))
    for index, (name, data) in enumerate(parts):
        vertices, triangles, lookup = [], [], {}
        for face in binary_mesh(data):
            triangle = []
            for point in face:
                key = tuple(round(v,5) for v in point)
                if key not in lookup:
                    lookup[key] = len(vertices); vertices.append(key)
                triangle.append(lookup[key])
            triangles.append(triangle)
        obj = ET.SubElement(resources, tag('object'), id=str(index+1), type='model', name=name)
        mesh = ET.SubElement(obj, tag('mesh'))
        v = ET.SubElement(mesh, tag('vertices')); t = ET.SubElement(mesh, tag('triangles'))
        for x,y,z in vertices:
            ET.SubElement(v, tag('vertex'), x=f'{x:g}', y=f'{y:g}', z=f'{z:g}')
        for a,b,c in triangles:
            ET.SubElement(t, tag('triangle'), v1=str(a), v2=str(b), v3=str(c))
        ET.SubElement(build, tag('item'), objectid=str(index+1),
                      transform=f'1 0 0 0 1 0 0 0 1 {30+55*(index%3)} {40+55*(index//3)} 0')
    output = io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
        archive.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        archive.writestr('3D/3dmodel.model', ET.tostring(model, encoding='utf-8', xml_declaration=True))
    return output.getvalue()


def build_kit(values, output, executable=None):
    p = parameters(values)
    executable = executable or shutil.which('openscad')
    if not executable:
        raise RuntimeError('OpenSCAD is needed for custom CAD export')
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    files, models = {}, []
    edge, tile = p['edge'], p['edge']+4
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    for marker_id, role, label, _ in FINGERS:
        diameter = p[f'd{marker_id}']
        name = f'{role}-{marker_id}.stl'
        command = [str(executable),'--export-format','binstl','-o',str(output/name),
                   '-D',f'marker_id={marker_id}','-D',f'finger_diameter_mm={diameter}',
                   '-D',f'marker_edge_mm={edge}',str(SOURCE)]
        result = subprocess.run(command, capture_output=True, timeout=60,
                                env={**os.environ,'QT_QPA_PLATFORM':'offscreen'})
        if result.returncode or not (output/name).exists():
            raise RuntimeError('OpenSCAD could not export the holder')
        data = (output/name).read_bytes()
        evidence = mesh_evidence(data)
        files[name] = data
        preset = SOURCE.read_text().replace('marker_id = 22;',f'marker_id = {marker_id};').replace(
            'finger_diameter_mm = 17;',f'finger_diameter_mm = {diameter:g};').replace(
            'marker_edge_mm = 10;',f'marker_edge_mm = {edge:g};')
        files[f'{role}-{marker_id}.scad'] = preset.encode('utf-8')
        files[f'marker-{marker_id}.svg'] = marker_svg(marker_id,edge)
        models.append({'id':marker_id,'role':role,'label':label,'diameter_mm':diameter,
            'stl':name,'scad':f'{role}-{marker_id}.scad','marker_svg':f'marker-{marker_id}.svg', 'marker_edge_mm':edge,
            'white_margin_mm':2,'tile_edge_mm':tile,
            'marker_center_R_mm':[0,-(1+2+edge/2),diameter/2+2-0.8+2-0.2+0.15],
            'center_to_distal_plane_mm':1+2+edge/2,
            'deck_width_mm':tile+2,'length_mm':tile+10,
            'registration_plane_y_mm':0,'outer_stop_y_mm':1.2,
            'anatomical_tip_R_mm':None,'registration_status':'longitudinal-stop-only-xz-unverified',
            'mesh':evidence})
    strap = output/'tpu-ladder-strip.stl'
    result = subprocess.run([str(executable),'--export-format','binstl','-o',str(strap),'-D','part="strap"',str(SOURCE)],
                            capture_output=True,timeout=60,env={**os.environ,'QT_QPA_PLATFORM':'offscreen'})
    if result.returncode:
        raise RuntimeError('OpenSCAD could not export the TPU strip')
    files[strap.name] = strap.read_bytes()
    strap_evidence = mesh_evidence(files[strap.name])
    files['markers-a4.svg'] = marker_sheet([i for i,_,_,_ in FINGERS],edge_mm=edge,quiet_mm=2).encode('utf-8')
    files['all-six-holders.3mf'] = plate_3mf([(m['stl'],files[m['stl']]) for m in models])
    files['finger-wrap.scad'] = SOURCE.read_bytes()
    guide = (ROOT/'finger-wrap-guide.th.md').read_bytes()
    files['วิธีพิมพ์และสวม.th.md'] = guide
    manifest = {'schema_version':1,'design_version':VERSION,'units':'mm','dictionary':'DICT_4X4_100',
        'parameters':p,'source_sha256':source_hash,'recipe_sha256':recipe_hash(),'opencv_version':cv2.__version__,
        'status':'experimental-unprinted-not-valid-for-scoring',
        'measurement_valid':False,'calibration_required':'Physical marker dimensions, remount drift and anatomical X/Z remain unverified',
        'models':models,'strap_mesh':strap_evidence,
        'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in files.items()}}
    files['manifest.json'] = json.dumps(manifest,ensure_ascii=False,indent=2,allow_nan=False).encode('utf-8')
    # Per-part files and the downloadable ZIP have identical bytes.
    for name,data in files.items():
        (output/name).write_bytes(data)
    with zipfile.ZipFile(output/'reachsense-six-finger-kit.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for name,data in files.items(): archive.writestr(name,data)
    return manifest


def ensure_kit(values=None):
    p = parameters(values)
    if p == DEFAULTS and (DEFAULT_DIR/'manifest.json').exists():
        directory = DEFAULT_DIR
    else:
        digest = hashlib.sha256(recipe_hash().encode()+json.dumps(p,sort_keys=True).encode()).hexdigest()[:16]
        directory = CACHE_DIR/digest
        if not (directory/'manifest.json').exists():
            if not _build_lock.acquire(blocking=False):
                raise RuntimeError('Another CAD kit is building; try again shortly')
            temporary = directory.with_name(directory.name+'.building')
            try:
                if temporary.exists(): shutil.rmtree(temporary)
                build_kit(p,temporary)
                if directory.exists(): shutil.rmtree(directory)
                temporary.rename(directory)
            except Exception:
                if temporary.exists(): shutil.rmtree(temporary)
                raise
            finally:
                _build_lock.release()
    manifest = json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
    if manifest['parameters'] != p or manifest['recipe_sha256'] != recipe_hash():
        raise RuntimeError('CAD assets do not match source/parameters; regenerate the printable kit')
    return directory,manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',type=Path,required=True)
    args = parser.parse_args()
    manifest = build_kit(DEFAULTS,args.output_dir)
    print(f"Exported {len(manifest['models'])} connected holder meshes, TPU strip and printable artwork")


if __name__ == '__main__': main()
