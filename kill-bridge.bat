@echo off
echo Stopping Spooly NFC Bridge...
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*nfc-bridge*' -and ($_.Name -eq 'electron.exe' -or $_.Name -eq 'node.exe') } | Stop-Process -Force"
echo Done.
