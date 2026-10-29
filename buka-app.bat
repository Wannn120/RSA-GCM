@echo off
setlocal
cd /d "%~dp0"

set URL=http://127.0.0.1:8000/src/index.html

powershell -NoProfile -Command "$socket = [System.Net.Sockets.TcpClient]::new(); try { $socket.Connect('127.0.0.1', 8000); Write-Output 'RUNNING' } catch { Write-Output 'STOPPED' } finally { $socket.Dispose() }" > "%TEMP%\rsa_gcm_status.txt"
set /p STATUS=<"%TEMP%\rsa_gcm_status.txt"

del "%TEMP%\rsa_gcm_status.txt" 2>nul

if /I "%STATUS%"=="STOPPED" (
    echo Menjalankan server lokal MATDIS RSA Lab...
    start "" /b cmd /c "npm start"
    timeout /t 2 >nul
)

start "" "%URL%"
exit /b 0
