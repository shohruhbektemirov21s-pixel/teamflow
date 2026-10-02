@echo off
rem TeamFlow: Django serverini ishga tushiradi (frontend build'i ham shu orqali beriladi).
rem Windows ishga tushganda "Startup" papkasidagi TeamFlow.vbs shu faylni yashirin oynada chaqiradi.
rem Telegram bot (/start - akkauntni bog'lash) fonda alohida jarayon; token backend\.env da.
cd /d "%~dp0"
start "" /b ".venv\Scripts\python.exe" manage.py runbot >> bot.log 2>&1
".venv\Scripts\python.exe" manage.py runserver 0.0.0.0:8020 --noreload >> server.log 2>&1
