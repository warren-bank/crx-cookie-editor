@echo off

call "%~dp0.\prepare_new_manifest.bat"

call node "%~dpn0.js" "%ext_dir%\manifest.json"
