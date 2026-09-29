import urllib.request
import urllib.parse
import threading
import time
from codebase_analyzer import KnowledgeBaseServer
from http.server import HTTPServer

def run_server():
    server = HTTPServer(('localhost', 8089), KnowledgeBaseServer)
    server.serve_forever()

t = threading.Thread(target=run_server)
t.daemon = True
t.start()
time.sleep(2)

url = 'http://localhost:8089/api/git/tree?url=https://github.com/octocat/Hello-World&branch=master'
try:
    req = urllib.request.urlopen(url)
    print('Tree API Status:', req.status)
    data = req.read().decode('utf-8')
    print('Tree API data length:', len(data))
except Exception as e:
    print('Tree API error:', e)

url_raw = 'http://localhost:8089/api/git/raw?url=https://raw.githubusercontent.com/octocat/Hello-World/master/README'
try:
    req2 = urllib.request.urlopen(url_raw)
    print('Raw API Status:', req2.status)
    print('Raw API data length:', len(req2.read()))
except Exception as e:
    print('Raw API error:', e)
