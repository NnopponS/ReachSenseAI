import hashlib
import io
import json
from pathlib import Path
import struct
import unittest
import xml.etree.ElementTree as ET
import zipfile

import cv2
import numpy as np

from hardware.finger_wrap import DEFAULT_DIR, SOURCE, parameters, mesh_evidence, binary_mesh
from hardware.finger_wrap_catalog import CATALOG_DIR
from scripts.feasibility.markers import observe_markers


def raster_svg(data,scale=20):
    root=ET.fromstring(data)
    width,height=[float(x) for x in root.attrib['viewBox'].split()[2:]]
    image=np.full((round(height*scale),round(width*scale)),255,np.uint8)
    for rect in root.findall('{http://www.w3.org/2000/svg}rect'):
        if rect.attrib.get('fill')!='black':continue
        x,y=float(rect.attrib.get('x',0)),float(rect.attrib.get('y',0))
        w,h=float(rect.attrib['width']),float(rect.attrib['height'])
        image[round(y*scale):round((y+h)*scale),round(x*scale):round((x+w)*scale)]=0
    return image


class FingerWrapExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=json.loads((CATALOG_DIR/'catalog.json').read_text(encoding='utf-8'))

    def test_every_offered_static_size_has_an_integrity_checked_mesh(self):
        self.assertEqual(len(self.catalog['meshes']),493)
        self.assertEqual(hashlib.sha256(SOURCE.read_bytes()).hexdigest(),self.catalog['source_sha256'])
        for d in self.catalog['diameters_mm']:
            for e in self.catalog['edges_mm']:
                entry=self.catalog['meshes'][f'd{d:g}-e{e:g}']
                data=(CATALOG_DIR/entry['file']).read_bytes()
                self.assertEqual(len(data),entry['bytes'])
                self.assertEqual(hashlib.sha256(data).hexdigest(),entry['sha256'])

    def test_exported_minimum_maximum_and_custom_meshes_are_closed_and_have_real_tip_contact_plane(self):
        for key in ['d12-e8','d26-e16','d18.5-e12.5']:
            entry=self.catalog['meshes'][key]
            data=(CATALOG_DIR/entry['file']).read_bytes()
            evidence=mesh_evidence(data)
            self.assertTrue(evidence['closed']);self.assertEqual(evidence['connected_components'],1)
            self.assertGreater(evidence['volume_mm3'],0)
            self.assertAlmostEqual(evidence['bounds_mm'][1][1],1.2,places=4)
            self.assertAlmostEqual(evidence['bounds_mm'][0][1],-(entry['edge_mm']+14),places=4)
            contact=[f for f in binary_mesh(data) if all(abs(p[1])<1e-5 for p in f)
                     and max(p[2] for p in f)<entry['diameter_mm']/2+2
                     and np.cross(np.subtract(f[1],f[0]),np.subtract(f[2],f[0]))[1]<0]
            self.assertTrue(contact,'Inner fingertip stop must have a real proximal-facing surface at Y=0')

    def test_default_zip_contains_six_named_parts_decodable_artwork_and_no_claim_of_calibration(self):
        with zipfile.ZipFile(DEFAULT_DIR/'reachsense-six-finger-kit.zip') as archive:
            manifest=json.loads(archive.read('manifest.json'))
            self.assertEqual([m['id'] for m in manifest['models']],[21,22,23,31,32,33])
            self.assertFalse(manifest['measurement_valid'])
            for model in manifest['models']:
                self.assertIsNone(model['anatomical_tip_R_mm'])
                self.assertEqual(model['center_to_distal_plane_mm'],8)
                report=observe_markers(raster_svg(archive.read(model['marker_svg'])))
                self.assertEqual([m['id'] for m in report['markers']],[model['id']])
                self.assertEqual(archive.read(model['stl']), (DEFAULT_DIR/model['stl']).read_bytes())
            for name,metadata in manifest['files'].items():
                self.assertEqual(hashlib.sha256(archive.read(name)).hexdigest(),metadata['sha256'])

    def test_3mf_has_six_manifold_objects_and_millimeter_units(self):
        with zipfile.ZipFile(DEFAULT_DIR/'all-six-holders.3mf') as archive:
            model=ET.fromstring(archive.read('3D/3dmodel.model'))
        ns={'m':'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
        self.assertEqual(model.attrib['unit'],'millimeter')
        objects=model.findall('m:resources/m:object',ns);self.assertEqual(len(objects),6)
        self.assertEqual(len(model.findall('m:build/m:item',ns)),6)
        for obj in objects:
            edges={}
            for triangle in obj.findall('m:mesh/m:triangles/m:triangle',ns):
                a,b,c=(int(triangle.attrib[k]) for k in ['v1','v2','v3'])
                for edge in [(a,b),(b,c),(c,a)]:
                    key=tuple(sorted(edge));edges[key]=edges.get(key,0)+1
            self.assertTrue(edges);self.assertTrue(all(n==2 for n in edges.values()))

    def test_invalid_dimensions_are_rejected_before_cad_execution(self):
        for value in [float('nan'),float('inf'),True,11,27,17.1]:
            with self.assertRaises(ValueError):parameters({'d22':value})
        with self.assertRaises(ValueError):parameters({'edge':0})
        with self.assertRaises(ValueError):parameters({'unexpected':'file.scad'})
