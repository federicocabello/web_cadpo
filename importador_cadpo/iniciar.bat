@echo off
cd /d "%~dp0"
py main.py
exit /b %errorlevel%
