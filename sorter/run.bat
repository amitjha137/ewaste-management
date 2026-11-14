@echo off
cd /d %~dp0
call venv\Scripts\activate
rem Change COM5 to your ESP32 port, and the token to match DEVICE_TOKENS in backend\.env
python main.py --port COM5 --backend http://localhost:5000 --token my-sorter-token
pause
