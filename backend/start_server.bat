@echo off
rem TeamFlow: Django serverini ishga tushiradi (frontend build'i ham shu orqali beriladi).
rem Windows ishga tushganda "Startup" papkasidagi TeamFlow.vbs shu faylni yashirin oynada chaqiradi.
cd /d "%~dp0"
".venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8020 --noreload >> server.log 2>&1
