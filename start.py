import subprocess
import sys
import time
import os

base = os.path.dirname(os.path.abspath(__file__))

print("Starting ShopShot backend...")
backend_proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    cwd=os.path.join(base, "backend")
)
time.sleep(2)

print("Starting ShopShot frontend...")
# On Windows npm is a .cmd file, so shell=True is required
frontend_proc = subprocess.Popen(
    "npm run dev",
    cwd=os.path.join(base, "frontend"),
    shell=True
)

try:
    print("ShopShot is running.")
    print("  Backend: http://localhost:8000")
    print("  Frontend: http://localhost:5173")
    print("Press Ctrl+C to stop.")
    backend_proc.wait()
except KeyboardInterrupt:
    print("\nShutting down...")
    backend_proc.terminate()
    frontend_proc.terminate()
    backend_proc.wait()
    frontend_proc.wait()
    print("Stopped.")
