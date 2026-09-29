import threading
import time
import urllib.request
from http.server import HTTPServer
from codebase_analyzer import KnowledgeBaseServer

def run_test_server(port):
    server = HTTPServer(('127.0.0.1', port), KnowledgeBaseServer)
    server.serve_forever()

def test_static_routes():
    port = 8098
    t = threading.Thread(target=run_test_server, args=(port,), daemon=True)
    t.start()
    time.sleep(1)

    base_url = f"http://127.0.0.1:{port}"

    endpoints = [
        ("/", 200, "text/html"),
        ("/index.html", 200, "text/html"),
        ("/codebase_knowledge_base_app.html", 200, "text/html"),
        ("/static/css/style.css", 200, "text/css"),
        ("/static/js/auth.js", 200, "text/javascript"),
        ("/static/js/code-viewer.js", 200, "text/javascript"),
        ("/static/js/mindmap.js", 200, "text/javascript"),
        ("/static/js/city.js", 200, "text/javascript"),
        ("/static/js/git-importer.js", 200, "text/javascript"),
        ("/static/js/app.js", 200, "text/javascript"),
        ("/api/status", 200, "application/json"),
        ("/api/auth/config", 200, "application/json"),
        ("/static/non_existent_file.xyz", 404, None),
    ]

    print("=== Testing Static Routes and MIME Types ===")
    for path, expected_status, expected_mime_prefix in endpoints:
        url = f"{base_url}{path}"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as resp:
                status = resp.status
                content_type = resp.headers.get("Content-Type", "")
                data = resp.read()
                print(f"[PASS] {path} -> Status {status}, Content-Type: {content_type}, Length: {len(data)} bytes")
                assert status == expected_status, f"Expected {expected_status}, got {status}"
                if expected_mime_prefix:
                    assert expected_mime_prefix in content_type, f"Expected MIME prefix {expected_mime_prefix} in {content_type}"
        except urllib.error.HTTPError as e:
            if e.code == expected_status:
                print(f"[PASS] {path} -> Expected HTTPError Status {e.code}")
            else:
                raise AssertionError(f"Unexpected HTTPError on {path}: {e.code}")
        except Exception as e:
            print(f"[FAIL] {path} -> Exception: {e}")
            raise

    print("\n=============================================")
    print(">>> ALL STATIC ROUTE TESTS PASSED 100%! <<<")
    print("=============================================")

if __name__ == '__main__':
    test_static_routes()
