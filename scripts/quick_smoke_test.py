import requests
import time

BASE = "http://127.0.0.1:8000/api/v1"
r = requests.post(
    f"{BASE}/projects",
    json={"name": "quick-test", "product_info": "红色高跟鞋测试"},
    timeout=30,
)
pid = r.json()["data"]["id"]
print("project", pid)
t0 = time.time()
r2 = requests.post(f"{BASE}/scripts/generate", json={"project_id": pid}, timeout=120)
print("script", r2.json()["data"]["status"], f"{time.time()-t0:.1f}s")
sid = requests.get(f"{BASE}/scripts?project_id={pid}", timeout=30).json()["data"][0]["id"]
shots = requests.get(f"{BASE}/shots?script_id={sid}", timeout=30).json()["data"]
print("shots", len(shots))
t1 = time.time()
r3 = requests.post(f"{BASE}/agents/run/{pid}/video", timeout=600)
print("video", r3.json()["data"]["status"], f"{time.time()-t1:.1f}s", r3.json()["data"].get("error"))
videos = requests.get(f"{BASE}/videos?project_id={pid}", timeout=30).json()["data"]
print("videos", len(videos))
