# Test server connection
Write-Host "Testing server connection..." -ForegroundColor Cyan

Start-Sleep -Seconds 2

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -TimeoutSec 5
    Write-Host "`n✓ SUCCESS! Server is running and accessible!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json
    
    # Test registration endpoint
    Write-Host "`nTesting registration endpoint..." -ForegroundColor Cyan
    try {
        $regData = @{
            name = "Test User $(Get-Random)"
            phone = "98765$(Get-Random -Minimum 10000 -Maximum 99999)"
            password = "test123456"
            role = "passenger"
        } | ConvertTo-Json
        
        $regResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" `
            -Method Post `
            -Body $regData `
            -ContentType "application/json" `
            -TimeoutSec 5
            
        Write-Host "✓ Registration endpoint working!" -ForegroundColor Green
        Write-Host "User created with token" -ForegroundColor Cyan
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            Write-Host "✓ Registration endpoint accessible (got validation response)" -ForegroundColor Green
        } else {
            Write-Host "Registration test: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "`n✗ FAILED! Cannot connect to server" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "`nMake sure the server is running:" -ForegroundColor Cyan
    Write-Host "  cd c:\Users\divya\Documents\Saferide\Saferide-guardian" -ForegroundColor White
    Write-Host "  node server/index.js" -ForegroundColor White
}
