@echo off
cd /d "%~dp0apps\mobile"
echo Lovask Mobile Edge tarayicisinda baslatiliyor...
flutter run -d edge --dart-define-from-file=env.json
pause
