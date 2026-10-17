@echo off
cd /d "%~dp0"
echo ============================================
echo  TextRec Web - yerel sunucu (port: 8000)
echo  Tarayici 2 saniye icinde acilir.
echo  Test bitince bu pencereyi kapatabilirsiniz.
echo ============================================
start "" /min cmd /c "timeout /t 2 /nobreak >nul && explorer http://localhost:8000"
if exist "C:\Python314\python.exe" (
  "C:\Python314\python.exe" -m http.server 8000
) else (
  python -m http.server 8000
)
