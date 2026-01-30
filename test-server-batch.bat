@echo off
REM Test the minimal server
echo Testing Server...
timeout /t 2 /nobreak

powershell -NoProfile -Command ^
  "$r = Invoke-RestMethod 'http://localhost:5000/api/health' -TimeoutSec 5;" ^
  "Write-Host 'SUCCESS: Server is running!' -ForegroundColor Green;" ^
  "$r | ConvertTo-Json"

if %ERRORLEVEL% NEQ 0 (
  echo Failed to connect
  exit /b 1
)

pause
