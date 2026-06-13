# FitjAIo - uruchamianie aplikacji
# Wymaga Node.js >= 18

$root = $PSScriptRoot

# Sprawdz .env
if (-not (Test-Path "$root\backend\.env")) {
    Write-Host "Brak backend\.env! Skopiuj .env.example i dodaj klucz API." -ForegroundColor Red
    exit 1
}

Write-Host "Uruchamianie backendu..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm start" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Uruchamianie frontendu..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "Aplikacja dostepna: http://localhost:5173" -ForegroundColor Green
Write-Host "Backend API: http://localhost:8000" -ForegroundColor Green
