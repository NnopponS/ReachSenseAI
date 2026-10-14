"""Local development server; images are processed in memory and never saved."""
import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

os.environ.setdefault('OPENCV_IO_MAX_IMAGE_PIXELS', '16000000')
import cv2
import numpy as np
from scripts.feasibility.markers import observe_markers

ROOT = Path(__file__).resolve().parent
ASSETS = {
    '/': ('index.html', 'text/html; charset=utf-8'),
    '/index.html': ('index.html', 'text/html; charset=utf-8'),
    '/app.js': ('app.js', 'text/javascript; charset=utf-8'),
    '/measurement.js': ('measurement.js', 'text/javascript; charset=utf-8'),
    '/style.css': ('style.css', 'text/css; charset=utf-8'),
    '/icon.svg': ('icon.svg', 'image/svg+xml'),
    '/manifest.webmanifest': ('manifest.webmanifest', 'application/manifest+json'),
    '/cad': ('cad.html', 'text/html; charset=utf-8'),
    '/cad/': ('cad.html', 'text/html; charset=utf-8'),
    '/cad/cad.js': ('cad.js', 'text/javascript; charset=utf-8'),
    '/cad/viewer.js': ('cad-viewer.js', 'text/javascript; charset=utf-8'),
    '/cad/model.js': ('cad-model.js', 'text/javascript; charset=utf-8'),
    '/cad/cad.css': ('cad.css', 'text/css; charset=utf-8'),
}
THREE_ASSETS = {'/cad/vendor/three.module.js':'build/three.module.js',
                '/cad/vendor/three.core.js':'build/three.core.js'}
MAX_UPLOAD = 8 * 1024 * 1024
RGB_ASSETS = {'index.html', 'style.css', 'app.js', 'core.js', 'engine.js', 'storage.js',
              'worker.js', 'vendor/opencv.js', 'vendor/runtime.json', 'examples/exploratory.json'}


def demonstration_image():
    """Digital detection fixture, not a participant or accuracy dataset."""
    image = np.full((720, 960, 3), 245, dtype=np.uint8)
    dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_100)
    positions = [(21, 330, 160), (22, 440, 210), (23, 550, 160),
                 (31, 330, 480), (32, 440, 430), (33, 550, 480)]
    for marker_id, x, y in positions:
        tag = cv2.aruco.generateImageMarker(dictionary, marker_id, 80)
        image[y:y+80, x:x+80] = cv2.cvtColor(tag, cv2.COLOR_GRAY2BGR)
        cv2.putText(image, str(marker_id), (x, y-12), cv2.FONT_HERSHEY_SIMPLEX, .7, (40, 40, 40), 2)
    cv2.putText(image, 'DIGITAL DETECTION DEMO - NOT A PHYSICAL MEASUREMENT',
                (30, 45), cv2.FONT_HERSHEY_SIMPLEX, .65, (40, 40, 40), 2)
    ok, encoded = cv2.imencode('.png', image)
    if not ok:
        raise RuntimeError('Could not encode demonstration')
    return encoded.tobytes()


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, payload, content_type='application/json; charset=utf-8'):
        if isinstance(payload, dict):
            payload = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        # The pinned OpenCV Emscripten bindings generate JS functions in their worker.
        # Keep this capability on the worker response; ordinary page scripts stay restricted.
        wasm = " 'wasm-unsafe-eval' 'unsafe-eval'" if urlsplit(self.path).path in ('/rgb-lab/worker.js','/marker-worker.js') else ''
        self.send_header('Content-Security-Policy', f"default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; script-src 'self'{wasm}; style-src 'self'; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/health':
            self.respond(200, {'status': 'ok', 'opencv_version': cv2.__version__,
                              'mode': 'research-workbench', 'measurement_valid': False})
        elif path in ('/api/demo.png','/demo.png'):
            self.respond(200, demonstration_image(), 'image/png')
        elif path == '/runtime/opencv.js':
            self.respond(200,(ROOT.parent/'web/vendor/opencv.js').read_bytes(),'text/javascript; charset=utf-8')
        elif path in ('/marker-worker.js','/detector.js'):
            self.respond(200,(ROOT/path[1:]).read_bytes(),'text/javascript; charset=utf-8')
        elif path == '/marker-sheet.svg':
            self.respond(200, (ROOT.parent/'hardware/prototypes/marker-sheet.svg').read_bytes(), 'image/svg+xml')
        elif path.startswith('/rgb-lab/') and (path[len('/rgb-lab/'):] or 'index.html') in RGB_ASSETS:
            name = path[len('/rgb-lab/'):] or 'index.html'
            mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'}[Path(name).suffix]
            self.respond(200, (ROOT.parent/'web'/name).read_bytes(), mime+'; charset=utf-8')
        elif path == '/cad/vendor/jszip.min.js':
            self.respond(200,(ROOT/'node_modules/jszip/dist/jszip.min.js').read_bytes(),'text/javascript; charset=utf-8')
        elif path.startswith('/cad/data/'):
            name=path[len('/cad/data/'):]
            directory=ROOT.parent/'hardware/printables/finger-wrap-catalog-v1'
            catalog=json.loads((directory/'catalog.json').read_text(encoding='utf-8'))
            allowed={'catalog.json','finger-wrap.scad','guide.th.md',catalog['strap']['file'],
                     *(entry['file'] for entry in catalog['meshes'].values())}
            if name not in allowed:
                self.respond(404,{'error':'CAD file not found'})
            else:
                mime={'.json':'application/json','.scad':'text/plain','.md':'text/markdown','.stl':'model/stl'}[Path(name).suffix]
                self.respond(200,(directory/name).read_bytes(),mime)
        elif path in THREE_ASSETS:
            self.respond(200,(ROOT/'node_modules'/'three'/THREE_ASSETS[path]).read_bytes(),'text/javascript; charset=utf-8')
        elif path in ASSETS:
            filename, mime = ASSETS[path]
            self.respond(200, (ROOT/filename).read_bytes(), mime)
        else:
            self.respond(404, {'error': 'Not found'})

    def do_POST(self):
        if urlsplit(self.path).path != '/api/observe':
            self.respond(404, {'error': 'Not found'})
            return
        # Browser clients must use this origin; no cross-origin upload endpoint.
        origin = self.headers.get('Origin')
        if origin and urlsplit(origin).netloc != self.headers.get('Host'):
            self.respond(403, {'error': 'Cross-origin request rejected'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_UPLOAD:
            self.respond(413, {'error': 'Upload must be between 1 byte and 8 MB'})
            self.close_connection = True
            return
        if self.headers.get('Content-Type', '').split(';')[0] not in ('image/jpeg', 'image/png'):
            self.respond(415, {'error': 'Use JPEG or PNG'})
            self.close_connection = True
            return
        self.connection.settimeout(15)
        try:
            data = self.rfile.read(length)
            if len(data) != length:
                raise ValueError('Incomplete image upload')
            if not (data.startswith(b'\x89PNG\r\n\x1a\n') or data.startswith(b'\xff\xd8\xff')):
                raise ValueError('Invalid PNG/JPEG signature')
            image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
            report = observe_markers(image, expected_ids=[21, 22, 23, 31, 32, 33])
            self.respond(200, report)
        except (ValueError, cv2.error):
            self.respond(400, {'error': 'Invalid image or image exceeds 16 megapixels'})
        except (TimeoutError, OSError):
            self.close_connection = True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'ReachSenseAI workbench listening on {args.host}:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
