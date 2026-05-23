import sys
import traceback

sys.stderr = open('err.log', 'w', buffering=1)
sys.stdout = open('out.log', 'w', buffering=1)

try:
    import uvicorn
    from app.main import app
    print('Starting uvicorn...', flush=True)
    uvicorn.run(app, host='127.0.0.1', port=8000, log_level='debug')
except Exception as e:
    traceback.print_exc()
    print(f'ERROR: {e}', flush=True)
