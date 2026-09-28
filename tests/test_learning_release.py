"""Run the actual release script in a disposable root with loopback HTTP.

GitHub downloads and Docker are replaced with local fixtures. No host service,
production state or external network is used; the publication verifier is real.
"""
from contextlib import contextmanager
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
from threading import Thread
import unittest

ROOT = Path(__file__).resolve().parents[1]
SHA = "c" * 40


class ReleaseBoundary(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.work = Path(self.temp.name)
        self.deploy = self.work / "deploy"
        self.previous = self.deploy / "releases/previous"
        self.candidate = self.work / "candidate"
        self.bin = self.work / "bin"
        self.bin.mkdir()
        self.state = self.work / "state/last_commit"
        self.state.parent.mkdir()
        self.state.write_text("previous-commit\n")
        self.events = self.work / "events"
        self.events.touch()
        files = ("index.html", "wiki/index.html", "wiki/data.json", "SURFACE_MANIFEST.json",
                 "learn/index.html", "learn/data.json", "learn/graph.jsonld", "learn/usl.json", "learn/publication.json",
                 "services/index.html", "services/data.json", "services/graph.jsonld", "services/usl.json",
                 "developers/index.html", "mcp/index.html", "mcp/manifest.json", "mcp/llms.txt")
        for base in (self.previous / "html", self.candidate):
            for name in files:
                target = base / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / "dist" / name, target)
        # A distinct prior release catches rollback verification against the
        # candidate identity even though both contain the same semantic source.
        old_home = self.previous / "html/index.html"
        old_home.write_bytes(old_home.read_bytes() + b"\n<!-- prior publication -->\n")
        old_manifest = self.previous / "html/learn/publication.json"
        document = json.loads(old_manifest.read_bytes())
        document["files"]["index.html"] = hashlib.sha256(old_home.read_bytes()).hexdigest()
        old_manifest.write_text(json.dumps(document))
        (self.deploy / "current").symlink_to(self.previous, target_is_directory=True)
        self.write_tool("curl", '''#!/usr/bin/env python3
import os, shutil, sys
args = sys.argv[1:]
if "-o" in args:
    shutil.copyfile(os.environ["FIXTURE_ARCHIVE"], args[args.index("-o") + 1])
else:
    print("c" * 40)
''')
        self.write_tool("docker", '''#!/usr/bin/env python3
import os, sys
from pathlib import Path
events = Path(os.environ["FIXTURE_EVENTS"])
with events.open("a") as log:
    log.write("docker " + " ".join(sys.argv[1:]) + "\\n")
if os.environ.get("FIXTURE_FAIL_RESTART") == "1" and events.read_text().count("docker ") == 1:
    sys.exit(1)
''')
        self.live = self.write_tool("verify-live", "#!/usr/bin/env bash\nexit 0\n")

    def write_tool(self, name, content):
        path = self.bin / name
        path.write_text(content)
        path.chmod(0o755)
        return path

    @contextmanager
    def serving(self, stale_candidate=False):
        release_test = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                name = self.path.lstrip("/")
                if not name or name.endswith("/"):
                    name += "index.html"
                current = (release_test.deploy / "current").resolve()
                body = (current / "html" / name).read_bytes()
                if stale_candidate and current != release_test.previous and name == "learn/usl.json":
                    body = b'{"nodes":[],"relations":[]}'
                self.send_response(200)
                self.send_header("Content-Type", "text/html" if name.endswith(".html") else "application/ld+json" if name.endswith(".jsonld") else "application/json")
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}/"
        finally:
            server.shutdown()
            thread.join(timeout=2)
            server.server_close()

    def release(self, *, stale=False, fail_restart=False, local=False, wrong_hash=False):
        archive = self.work / "dist.tar.gz"
        with tarfile.open(archive, "w:gz") as output:
            for path in sorted(self.candidate.rglob("*")):
                if path.is_file():
                    output.add(path, arcname=path.relative_to(self.candidate))
        with self.serving(stale_candidate=stale) as origin:
            return subprocess.run(["bash", str(ROOT / "scripts/deploy/pve-release.sh")], env={
                **os.environ, "PATH": str(self.bin) + os.pathsep + os.environ["PATH"],
                "ROOT": str(self.deploy), "STATE": str(self.state), "CONTAINER": "fixture-only",
                "PROBE_URL": origin, "VERIFY_LIVE": str(self.live),
                "VERIFY_PUBLICATION": str(ROOT / "scripts/verify/learning_publication.py"),
                "VERIFY_ATTEMPTS": "1", "VERIFY_DELAY_SECONDS": "0",
                "FIXTURE_ARCHIVE": str(archive), "FIXTURE_EVENTS": str(self.events),
                "FIXTURE_FAIL_RESTART": "1" if fail_restart else "0",
                "LOCAL_ARTIFACT": str(archive) if local else "",
                "EXPECTED_ARTIFACT_SHA256": ("0" * 64 if wrong_hash else hashlib.sha256(archive.read_bytes()).hexdigest()) if local else "",
            }, capture_output=True, text=True, timeout=20)

    def assert_untouched(self):
        self.assertEqual((self.deploy / "current").resolve(), self.previous)
        self.assertEqual(self.state.read_text(), "previous-commit\n")

    def test_missing_hub_file_fails_before_activation(self):
        (self.candidate / "learn/usl.json").unlink()
        result = self.release()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("required artifact missing", result.stdout)
        self.assertEqual(self.events.read_text(), "")
        self.assert_untouched()

    def test_missing_service_directory_fails_before_activation(self):
        (self.candidate / "services/graph.jsonld").unlink()
        result = self.release()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("required artifact missing", result.stdout)
        self.assertEqual(self.events.read_text(), "")
        self.assert_untouched()

    def test_stale_static_mcp_manifest_fails_before_activation(self):
        (self.candidate / "mcp/manifest.json").write_text('{"servers": [{"name": "stale"}]}')
        result = self.release()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("static MCP manifest retirement marker is missing", result.stdout)
        self.assertEqual(self.events.read_text(), "")
        self.assert_untouched()

    def test_corrupt_publication_fails_before_activation(self):
        (self.candidate / "learn/usl.json").write_text('{"nodes":[],"relations":[]}')
        result = self.release()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("contract failed before activation", result.stdout)
        self.assertEqual(self.events.read_text(), "")
        self.assert_untouched()

    def test_stale_http_200_rolls_back_against_previous_identity(self):
        result = self.release(stale=True)
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("served artifact differs", result.stdout)
        self.assertIn("rollback verified", result.stdout)
        self.assertEqual(self.events.read_text().count("docker restart fixture-only"), 2)
        self.assert_untouched()

    def test_restart_failure_also_restores_previous_release(self):
        result = self.release(fail_restart=True)
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("rollback verified", result.stdout)
        self.assertEqual(self.events.read_text().count("docker restart fixture-only"), 2)
        self.assert_untouched()

    def test_state_advances_after_matching_readback(self):
        result = self.release()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('"scope": "read-only HTTP readback"', result.stdout)
        self.assertNotEqual((self.deploy / "current").resolve(), self.previous)
        self.assertEqual(self.state.read_text(), SHA + "\n")
        self.assertEqual(self.events.read_text().count("docker restart fixture-only"), 1)

    def test_local_artifact_is_pinned_and_preserves_the_last_consumed_git_commit(self):
        result = self.release(local=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.state.read_text(), "previous-commit\n")
        self.assertEqual((self.deploy / "manual-artifact").read_text().strip(),
                         hashlib.sha256((self.work / "dist.tar.gz").read_bytes()).hexdigest())
        self.assertNotEqual((self.deploy / "current").resolve(), self.previous)

    def test_unpinned_manual_artifact_never_activates(self):
        result = self.release(local=True, wrong_hash=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SHA-256 does not match", result.stdout)
        self.assertEqual(self.events.read_text(), "")
        self.assert_untouched()

    def test_manual_activation_also_rolls_back_on_stale_readback(self):
        result = self.release(local=True, stale=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("rollback verified", result.stdout)
        self.assertFalse((self.deploy / "manual-artifact").exists())
        self.assert_untouched()

    def test_missing_current_manifest_cannot_bypass_verification(self):
        self.state.write_text(SHA + "\n")
        (self.previous / "html/learn/publication.json").unlink()
        result = self.release()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("recorded deployment is unhealthy; replaying", result.stdout)
        self.assertNotEqual((self.deploy / "current").resolve(), self.previous)
        self.assertEqual(self.events.read_text().count("docker restart fixture-only"), 1)


if __name__ == "__main__":
    unittest.main()
