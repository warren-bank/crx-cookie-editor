@echo off

call "%~dp0.\validate_env.bat"

if NOT "%ERRORLEVEL%"=="0" exit /b %ERRORLEVEL%

rem :: -------------------------------------------------------------------------

if exist "%ext_dir%\manifest.json" del "%ext_dir%\manifest.json"

copy "%ext_dir%\manifest.json.tpl" "%ext_dir%\manifest.json"
