import time
import keyboard  # pip install keyboard

INTERVAL = 5  # 秒

print("每 5 秒发送 Enter。Ctrl+C 退出。建议以管理员运行。")
try:
    while True:
        time.sleep(INTERVAL)
        keyboard.send("enter")
        print("已发送 Enter")
except KeyboardInterrupt:
    print("已停止")