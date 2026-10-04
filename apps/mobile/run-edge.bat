@echo off
cd /d "%~dp0"
echo Lovask Mobile Edge tarayicisinda baslatiliyor...
flutter run -d edge --dart-define-from-file=env.json
pause
