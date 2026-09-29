import threading
import time
import json
import urllib.request
from http.server import HTTPServer
from codebase_analyzer import KnowledgeBaseServer, LLMClient

def run_test_server(port):
    server = HTTPServer(('127.0.0.1', port), KnowledgeBaseServer)
    server.serve_forever()

def test_universal_llm():
    print("=== Testing Universal LLM Client & Server Endpoints ===")
    
    # 1. Direct LLMClient Provider Format Detection
    llm = LLMClient()
    
    # Test llamacpp format
    prov, url = llm._detect_provider_and_url("llamacpp", "")
    assert prov == "llamacpp" and "8080/completion" in url, f"Failed llamacpp detection: {prov}, {url}"
    
    # Test ollama format
    prov, url = llm._detect_provider_and_url("ollama", "")
    assert prov == "ollama" and "11434/api/generate" in url, f"Failed ollama detection: {prov}, {url}"
    
    # Test openai format
    prov, url = llm._detect_provider_and_url("openai", "")
    assert prov == "openai" and "11434/v1/chat/completions" in url, f"Failed openai detection: {prov}, {url}"
    print("[PASS] LLMClient endpoint auto-resolution works")

    # 2. Test Fallback Heuristics on Mock / Offline Environment
    batch_data = {
        "module_name": "AuthModule",
        "files": ["auth.py", "token.py"],
        "total_loc": 320,
        "intent_roles": ["Auth", "Security"]
    }
    batch_res = llm.analyze_module_batch(batch_data, "TestApp")
    assert batch_res.get("success") is True, "Batch analysis failed"
    assert "module_summary" in batch_res.get("analysis", {}), "Missing module_summary in analysis"
    print(f"[PASS] LLMClient analyze_module_batch resilient fallback: {batch_res['analysis']['module_summary'][:50]}...")

    # 3. HTTP Server Endpoints Testing
    port = 8095
    t = threading.Thread(target=run_test_server, args=(port,), daemon=True)
    t.start()
    time.sleep(1)

    base_url = f"http://127.0.0.1:{port}"

    # Test /api/llm/config
    req = urllib.request.Request(f"{base_url}/api/llm/config")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        cfg = json.loads(resp.read().decode("utf-8"))
        assert "provider" in cfg
        assert "endpoint_url" in cfg
        print(f"[PASS] /api/llm/config returned: {cfg}")

    # Test /api/llm/test-connection (offline fallback handled gracefully)
    req = urllib.request.Request(
        f"{base_url}/api/llm/test-connection",
        data=json.dumps({
            "provider": "ollama",
            "endpoint_url": "http://127.0.0.1:9999/dummy",
            "model": "qwen2.5-coder:7b"
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        # Expected 502 Bad Gateway when test ping cannot reach offline server
        assert e.code == 502, f"Expected 502, got {e.code}"
        res = json.loads(e.read().decode("utf-8"))
        assert res.get("success") is False
        print(f"[PASS] /api/llm/test-connection properly returned failure on unreachable endpoint: {res.get('message')}")

    print("\n=============================================")
    print(">>> ALL UNIVERSAL LLM TESTS PASSED 100%! <<<")
    print("=============================================")

if __name__ == "__main__":
    test_universal_llm()
