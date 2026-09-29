#!/usr/bin/env python3
"""
Comprehensive Auth & GitHub OAuth Test Suite for Codebase Analyzer
"""

import sys
import os
import json
import time
import urllib.request
import urllib.error
import urllib.parse
import threading
from http.server import HTTPServer

# Set environment before imports
os.environ["SQLITE_DB_PATH"] = "test_analyzer.db"
os.environ["AUTH_SECRET"] = "test-secret-key-12345"

from db_manager import DatabaseManager
from auth_manager import hash_password, verify_password, create_jwt_token, decode_jwt_token
from codebase_analyzer import KnowledgeBaseServer

TEST_PORT = 8097

def start_test_server():
    server = HTTPServer(('127.0.0.1', TEST_PORT), KnowledgeBaseServer)
    server.serve_forever()

def run_tests():
    print("=== 1. Starting Test Server on port", TEST_PORT, "===")
    t = threading.Thread(target=start_test_server)
    t.daemon = True
    t.start()
    time.sleep(1.5)

    base_url = f"http://127.0.0.1:{TEST_PORT}"

    def make_req(path, method="GET", data=None, token=None):
        url = f"{base_url}{path}"
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req_data = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                body = resp.read().decode("utf-8")
                try:
                    return resp.status, json.loads(body)
                except Exception:
                    return resp.status, body
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            try:
                return e.code, json.loads(body)
            except Exception:
                return e.code, body

    print("\n=== 2. Testing Auth Config Endpoint ===")
    status, res = make_req("/api/auth/config")
    print(f"Status: {status}, Response: {res}")
    assert status == 200
    assert "github_oauth_enabled" in res

    print("\n=== 3. Testing User Registration ===")
    test_user = {
        "username": f"testdev_{int(time.time())}",
        "email": f"test_{int(time.time())}@example.com",
        "password": "securepassword123"
    }

    # Successful registration
    status, res = make_req("/api/auth/register", method="POST", data=test_user)
    print(f"Register Status: {status}, Response user: {res.get('user', {}).get('username')}")
    assert status == 201
    assert "token" in res
    assert res["user"]["username"] == test_user["username"]
    token = res["token"]

    # Duplicate registration error
    status, res = make_req("/api/auth/register", method="POST", data=test_user)
    print(f"Duplicate Register Status: {status}, Error: {res.get('error')}")
    assert status == 409

    # Password too short error
    status, res = make_req("/api/auth/register", method="POST", data={"username": "short_pw", "email": "short@test.com", "password": "123"})
    print(f"Short Password Status: {status}, Error: {res.get('error')}")
    assert status == 400

    print("\n=== 4. Testing User Login ===")
    # Login with username
    status, res = make_req("/api/auth/login", method="POST", data={"username": test_user["username"], "password": test_user["password"]})
    print(f"Login with username Status: {status}, User: {res.get('user', {}).get('username')}")
    assert status == 200
    assert "token" in res
    login_token = res["token"]

    # Login with email
    status, res = make_req("/api/auth/login", method="POST", data={"username": test_user["email"], "password": test_user["password"]})
    print(f"Login with email Status: {status}, User: {res.get('user', {}).get('username')}")
    assert status == 200

    # Login with wrong password
    status, res = make_req("/api/auth/login", method="POST", data={"username": test_user["username"], "password": "wrongpassword"})
    print(f"Wrong Password Login Status: {status}, Error: {res.get('error')}")
    assert status == 401

    print("\n=== 5. Testing /api/auth/me Profile ===")
    # Valid token
    status, res = make_req("/api/auth/me", method="GET", token=login_token)
    print(f"Me Status: {status}, User: {res.get('username')}, Role: {res.get('role')}")
    assert status == 200
    assert res["username"] == test_user["username"]

    # Invalid token
    status, res = make_req("/api/auth/me", method="GET", token="invalid.token.here")
    print(f"Invalid Token Status: {status}, Error: {res.get('error')}")
    assert status == 401

    # No token
    status, res = make_req("/api/auth/me", method="GET")
    print(f"No Token Status: {status}")
    assert status == 401

    print("\n=== 6. Testing /api/auth/logout ===")
    status, res = make_req("/api/auth/logout", method="POST")
    print(f"Logout Status: {status}, Message: {res.get('message')}")
    assert status == 200

    print("\n=== 7. Testing GitHub OAuth Upsert & Flow Handling ===")
    db = KnowledgeBaseServer.db
    gh_id = f"gh_{int(time.time())}"
    gh_user = db.upsert_github_user(
        github_id=gh_id,
        username="octo_developer",
        email="octo@github.com",
        avatar_url="https://avatars.githubusercontent.com/u/999"
    )
    print(f"GitHub Upsert Result: {gh_user}")
    assert gh_user is not None
    assert gh_user["github_id"] == gh_id

    # Test /api/auth/github without CLIENT_ID (returns clear 400 error message)
    status, res = make_req("/api/auth/github")
    print(f"Unconfigured GitHub OAuth Status: {status}, Error: {res.get('error') if isinstance(res, dict) else res[:80]}")
    assert status == 400

    print("\n==========================================")
    print(">>> ALL AUTH TESTS PASSED SUCCESSFULLY! <<<")
    print("==========================================")

if __name__ == "__main__":
    run_tests()
