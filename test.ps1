Write-Host "Testing server..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
    $r = Invoke-RestMethod "http://localhost:5000/api/health" -TimeoutSec 5
    Write-Host "SUCCESS! Server is running" -ForegroundColor Green
    Write-Host ($r | ConvertTo-Json)
} catch {
    Write-Host "FAILED: Cannot connect" -ForegroundColor Red
}
