"""Independent positive/negative release replays against real generated artifacts."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("publication", ROOT / "scripts/verify/learning_publication.py")
publication = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publication)


@contextmanager
def serving(blobs, wrong_mime=False):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            name = self.path.lstrip("/")
            if not name or name.endswith("/"):
                name += "index.html"
            body = blobs.get(name, b"missing")
            self.send_response(200 if name in blobs else 404)
            mime = "text/html" if name.endswith(".html") else "application/ld+json" if name.endswith(".jsonld") and not wrong_mime else "application/json"
            self.send_header("Content-Type", mime)
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join(timeout=2)
        server.server_close()


class PublicationReplay(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = {name: (ROOT / "dist" / name).read_bytes() for name in publication.FILES}
        cls.manifest = json.loads((ROOT / "dist/learn/publication.json").read_bytes())
        cls.source = json.loads((ROOT / "src/data/learning-hub.json").read_bytes())

    def test_current_publication_is_independently_read_back(self):
        result = publication.verify(self.original, self.manifest, self.source)
        self.assertEqual(result["nodes"], len(self.source["nodes"]))
        self.assertEqual(result["relations"], len(self.source["edges"]))
        self.assertEqual(result["surfaces"], 5)

    def reject(self, name, mutate, message):
        blobs, manifest = deepcopy(self.original), deepcopy(self.manifest)
        content = json.loads(blobs[name])
        mutate(content)
        blobs[name] = publication.canonical(content)
        # Recompute packaging hash so the semantic verifier itself must detect it.
        manifest["files"][name] = publication.sha(blobs[name])
        with self.assertRaisesRegex(ValueError, message):
            publication.verify(blobs, manifest)

    def test_reversed_usl_relationship_fails_even_with_a_new_packaging_hash(self):
        self.reject("learn/usl.json", lambda d: d["relations"][0].update(from_uid=d["relations"][0]["to_uid"]), "direction changed")

    def test_usl_meaning_drift_fails(self):
        self.reject("learn/usl.json", lambda d: d["relations"][0]["properties"].update(description='{"status":"ACTIVE"}'), "meaning/provenance changed")

    def test_jsonld_context_cannot_rebind_vocabulary(self):
        self.reject("learn/graph.jsonld", lambda d: d["@context"].update(rdf="https://untrusted.example/"), "context redefines")

    def test_active_rdf_claim_cannot_disappear(self):
        def remove(document):
            for node in document["@graph"]:
                if publication.predicate("DEFINES") in node:
                    del node[publication.predicate("DEFINES")]
                    return
            self.fail("fixture contains no active definition")
        self.reject("learn/graph.jsonld", remove, "active JSON-LD relationship changed")

    def test_reviewed_html_anchor_cannot_disappear(self):
        blobs, manifest = deepcopy(self.original), deepcopy(self.manifest)
        blobs["learn/index.html"] = blobs["learn/index.html"].replace(b'id="entity-usl"', b'id="missing-usl"')
        manifest["files"]["learn/index.html"] = publication.sha(blobs["learn/index.html"])
        with self.assertRaisesRegex(ValueError, "missing entity/path/vocabulary HTML anchor"):
            publication.verify(blobs, manifest)

    def test_stale_http_200_body_is_not_the_expected_release(self):
        blobs = deepcopy(self.original)
        blobs["index.html"] = b"<!doctype html><html><title>MetaHumotonic</title><body>old release</body></html>"
        with self.assertRaisesRegex(ValueError, "artifact digest mismatch"):
            publication.verify(blobs, self.manifest)

    def test_missing_surface_and_unbound_file_are_rejected(self):
        blobs = deepcopy(self.original)
        blobs["learn/usl.json"] = b""
        with self.assertRaisesRegex(ValueError, "missing or oversized"):
            publication.verify(blobs, self.manifest)
        manifest = deepcopy(self.manifest)
        del manifest["files"]["learn/graph.jsonld"]
        with self.assertRaisesRegex(ValueError, "bind all five"):
            publication.verify(self.original, manifest)

    def test_live_readback_requires_an_independent_expected_manifest(self):
        import subprocess
        result = subprocess.run(["python3", str(ROOT / "scripts/verify/learning_publication.py"), "--base-url", "http://127.0.0.1:1"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn("independently supplied expected publication", result.stdout)

    def test_real_http_readback_matches_the_five_expected_files(self):
        with serving(self.original) as origin:
            blobs = publication.readback(origin, self.manifest)
        self.assertEqual(publication.verify(blobs, self.manifest)["sourceDigest"], self.source["sourceDigest"])

    def test_real_http_200_with_stale_content_is_rejected(self):
        blobs = deepcopy(self.original)
        blobs["learn/usl.json"] = b'{"nodes":[],"relations":[]}'
        with serving(blobs) as origin, self.assertRaisesRegex(ValueError, "served artifact differs"):
            publication.readback(origin, self.manifest)

    def test_jsonld_mime_is_part_of_the_http_contract(self):
        with serving(self.original, wrong_mime=True) as origin, self.assertRaisesRegex(ValueError, "MIME"):
            publication.readback(origin, self.manifest)


if __name__ == "__main__":
    unittest.main()
