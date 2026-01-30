# Test server connection
Write-Host "Testing server connection..." -ForegroundColor Cyan

Start-Sleep -Seconds 2

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -TimeoutSec 5
    Write-Host "`n✓ SUCCESS! Server is running and accessible!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json
    
} catch {
    Write-Host "`n✗ FAILED! Cannot connect to server" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "`nMake sure the server is running" -ForegroundColor Cyan
}
