import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from workbench.server import Handler, demonstration_image


class WebWorkbenchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=10)
        try:
            conn.request(method, path, body, headers or {})
            response = conn.getresponse()
            return response.status, response.read(), response.getheader('Content-Type')
        finally:
            conn.close()

    def test_actual_http_upload_detects_all_six_ids_without_valid_measurement(self):
        status, payload, _ = self.request('POST', '/api/observe', demonstration_image(), {'Content-Type': 'image/png'})
        self.assertEqual(status, 200)
        report = json.loads(payload)
        self.assertEqual([m['id'] for m in report['markers']], [21, 22, 23, 31, 32, 33])
        self.assertFalse(report['measurement_valid'])

    def test_corrupt_upload_and_cross_origin_request_are_rejected(self):
        self.assertEqual(self.request('POST', '/api/observe', b'bad', {'Content-Type': 'image/png'})[0], 400)
        self.assertEqual(self.request('POST', '/api/observe', b'bad', {'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.request('POST', '/api/observe', b'bad', {'Content-Type': 'image/png', 'Origin': 'https://other.example'})[0], 403)
        self.assertEqual(self.request('POST', '/api/observe', b'', {'Content-Type': 'image/png'})[0], 413)

    def test_only_workbench_assets_are_served_not_repository_or_credentials(self):
        self.assertEqual(self.request('GET', '/')[0], 200)
        self.assertEqual(self.request('GET', '/measurement.js')[0], 200)
        self.assertEqual(self.request('GET', '/rgb-lab/')[0], 200)
        self.assertEqual(self.request('GET', '/rgb-lab/core.js')[0], 200)
        self.assertEqual(self.request('GET', '/marker-sheet.svg')[0], 200)
        self.assertEqual(self.request('GET', '/cad/')[0], 200)
        self.assertEqual(self.request('GET', '/cad/data/catalog.json')[0], 200)
        self.assertEqual(self.request('GET', '/cad/data/../../.git/config')[0], 404)
        self.assertEqual(self.request('GET', '/../.git/config')[0], 404)
        self.assertEqual(self.request('GET', '/plan.md')[0], 404)
        self.assertEqual(self.request('GET', '/rgb-lab/../android/README.md')[0], 404)
