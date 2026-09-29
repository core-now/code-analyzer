import os
import sys
import json
import uuid
import time
import threading
import urllib.request
import urllib.error
from http.server import HTTPServer

from db_manager import DatabaseManager
from auth_manager import create_jwt_token, hash_password
from codebase_analyzer import KnowledgeBaseServer

TEST_PORT = 8192
TEST_DB = "test_project_analyzer.db"

def cleanup():
    if os.path.exists(TEST_DB):
        try:
            os.remove(TEST_DB)
        except Exception:
            pass

def run_tests():
    cleanup()
    print("=== 1. Direct DatabaseManager Project & Snapshot Testing ===")
    db = DatabaseManager(db_path=TEST_DB)

    # 1. Create a user
    user = db.create_user(username="project_tester", email="tester@example.com", password_hash=hash_password("Secret123!"))
    assert user is not None, "Failed to create user in test DB"
    user_id = user["id"]
    print(f"[+] Created test user: {user['username']} ({user_id})")

    # 2. Create a project
    sample_metrics = {
        "project_name": "TestCodebase",
        "summary": {"total_files": 42, "code_lines": 3500},
        "languages": {"Python": 2000, "JavaScript": 1500}
    }
    sample_tree = {"name": "root", "children": [{"name": "app.py", "size": 1200}]}

    project = db.create_project(
        user_id=user_id,
        name="TestCodebase",
        description="A sample test codebase",
        is_public=False,
        metrics=sample_metrics,
        file_tree=sample_tree
    )
    assert project is not None, f"Failed to create project: {db.last_error}"
    assert project["name"] == "TestCodebase"
    project_id = project["id"]
    print(f"[+] Project created successfully: {project_id}")

    # 3. List projects
    projects = db.list_projects(user_id=user_id)
    assert len(projects) == 1, f"Expected 1 project, got {len(projects)}"
    assert projects[0]["id"] == project_id
    print(f"[+] Project list retrieved ({len(projects)} projects)")

    # 4. Get project by ID
    fetched_proj = db.get_project_by_id(project_id, user_id=user_id)
    assert fetched_proj is not None, "Failed to fetch project by ID"
    assert "snapshot" in fetched_proj, "Snapshot missing from project detail"
    assert fetched_proj["snapshot"]["metrics"]["summary"]["total_files"] == 42
    print(f"[+] Project detail verified with snapshot metrics")

    # 5. Save a new snapshot
    new_metrics = {
        "project_name": "TestCodebase",
        "summary": {"total_files": 45, "code_lines": 3800}
    }
    snap_id = db.save_snapshot(project_id=project_id, user_id=user_id, metrics=new_metrics, version="1.1.0")
    assert snap_id is not None, f"Failed to save snapshot: {db.last_error}"
    print(f"[+] Saved second snapshot: {snap_id}")

    # Check updated project
    updated_proj = db.get_project_by_id(project_id, user_id=user_id)
    assert updated_proj["snapshot"]["version"] == "1.1.0"
    assert updated_proj["snapshot"]["metrics"]["summary"]["total_files"] == 45
    print(f"[+] Latest snapshot verification passed")

    # 6. Share token generation
    share_token = db.create_or_get_share_token(project_id, user_id)
    assert share_token is not None, f"Failed to create share token: {db.last_error}"
    print(f"[+] Share token created: {share_token}")

    # 7. Get project by share token (unauthenticated / public)
    shared_proj = db.get_project_by_share_token(share_token)
    assert shared_proj is not None, "Failed to get project by share token"
    assert shared_proj["id"] == project_id
    print(f"[+] Retrieved shared project anonymously")

    print("\n=== 2. HTTP Server API Testing for Projects ===")
    KnowledgeBaseServer.db = db
    server = HTTPServer(("127.0.0.1", TEST_PORT), KnowledgeBaseServer)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(1)

    auth_token = create_jwt_token({"user_id": user_id, "username": user["username"]})
    auth_headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

    # HTTP POST /api/projects
    req_body = json.dumps({
        "name": "HTTP Api Project",
        "description": "Created via HTTP API",
        "is_public": True,
        "metrics": {"total_files": 10, "code_lines": 500},
        "file_tree": {"name": "root"}
    }).encode("utf-8")

    req = urllib.request.Request(f"http://127.0.0.1:{TEST_PORT}/api/projects", data=req_body, headers=auth_headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201, f"Expected 201, got {resp.status}"
        resp_data = json.loads(resp.read().decode("utf-8"))
        api_project_id = resp_data["id"]
        assert resp_data["name"] == "HTTP Api Project"
    print(f"[+] HTTP POST /api/projects succeeded: {api_project_id}")

    # HTTP GET /api/projects
    req = urllib.request.Request(f"http://127.0.0.1:{TEST_PORT}/api/projects", headers=auth_headers)
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        p_list = json.loads(resp.read().decode("utf-8"))
        assert len(p_list["projects"]) >= 2
    print(f"[+] HTTP GET /api/projects returned {len(p_list['projects'])} projects")

    # HTTP GET /api/projects/{id}
    req = urllib.request.Request(f"http://127.0.0.1:{TEST_PORT}/api/projects/{api_project_id}", headers=auth_headers)
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        p_detail = json.loads(resp.read().decode("utf-8"))
        assert p_detail["id"] == api_project_id
        assert p_detail["snapshot"]["metrics"]["total_files"] == 10
    print(f"[+] HTTP GET /api/projects/{api_project_id} retrieved successfully")

    # HTTP POST /api/projects/{id}/snapshots
    snap_body = json.dumps({
        "metrics": {"total_files": 12, "code_lines": 650},
        "version": "1.0.1"
    }).encode("utf-8")
    req = urllib.request.Request(f"http://127.0.0.1:{TEST_PORT}/api/projects/{api_project_id}/snapshots", data=snap_body, headers=auth_headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201
        snap_resp = json.loads(resp.read().decode("utf-8"))
        assert snap_resp["success"] is True
    print(f"[+] HTTP POST /api/projects/{api_project_id}/snapshots succeeded: {snap_resp['snapshot_id']}")

    # HTTP POST /api/projects/{id}/share
    req = urllib.request.Request(f"http://127.0.0.1:{TEST_PORT}/api/projects/{api_project_id}/share", data=b"{}", headers=auth_headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        share_resp = json.loads(resp.read().decode("utf-8"))
        assert "share_token" in share_resp
        api_share_token = share_resp["share_token"]
    print(f"[+] HTTP POST /api/projects/{api_project_id}/share succeeded: {api_share_token}")

    # HTTP GET /api/share/{token}
    req = urllib.request.Request(f"http://127.0.0.1:{TEST_PORT}/api/share/{api_share_token}")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        shared_detail = json.loads(resp.read().decode("utf-8"))
        assert shared_detail["id"] == api_project_id
    print(f"[+] HTTP GET /api/share/{api_share_token} retrieved public snapshot")

    # HTTP POST /api/projects without Auth (should be 401)
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{TEST_PORT}/api/projects", data=req_body, headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req)
        assert False, "Expected 401 Unauthorized"
    except urllib.error.HTTPError as e:
        assert e.code == 401
    print(f"[+] Unauthenticated project creation properly rejected with 401")

    server.shutdown()
    cleanup()
    print("\n=============================================")
    print(">>> ALL PROJECT & SNAPSHOT TESTS PASSED! <<<")
    print("=============================================")

if __name__ == "__main__":
    run_tests()
