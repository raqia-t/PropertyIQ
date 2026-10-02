# PropertyIQ AI Pakistan - Local Development Runner
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Starting PropertyIQ AI (Pakistan) Platform Services      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

$Root = $PSScriptRoot

# 1. Start Local PostgreSQL on Port 5433
Write-Host "`n[1/3] Starting Local PostgreSQL on port 5433..." -ForegroundColor Cyan
$PgData = Join-Path $Root ".db\data"
$PgLog = Join-Path $Root ".db\postgres.log"
if (-not (Test-Path $PgData)) {
    & "C:\Program Files\PostgreSQL\18\bin\initdb.exe" -D $PgData -U postgres -A trust -E UTF8
}
Start-Process -FilePath "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -ArgumentList "-D `"$PgData`" -p 5433" -WindowStyle Minimized

# 2. Start Python FastAPI AI Microservice on Port 8000
Write-Host "[2/3] Starting FastAPI AI Service on port 8000..." -ForegroundColor Cyan
$AiDir = Join-Path $Root "services\ai"
$AiPython = Join-Path $AiDir ".venv\Scripts\python.exe"
Start-Process -FilePath $AiPython -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory $AiDir -WindowStyle Minimized

# 3. Start ASP.NET Core API on Port 5000
Write-Host "[3/3] Starting ASP.NET Core Web API on port 5000..." -ForegroundColor Cyan
$ApiProj = Join-Path $Root "services\api\src\PropertyIQ.Api\PropertyIQ.Api.csproj"
Start-Process -FilePath "dotnet" -ArgumentList "run --project `"$ApiProj`" --urls http://localhost:5000" -WorkingDirectory $Root -WindowStyle Minimized

# 4. Start Next.js Web Frontend on Port 3000
Write-Host "[4/4] Starting Next.js Web App on port 3000..." -ForegroundColor Cyan
$WebDir = Join-Path $Root "apps\web"
Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory $WebDir -WindowStyle Minimized

Write-Host "`nAll PropertyIQ services launched successfully!" -ForegroundColor Green
Write-Host "----------------------------------------------------------"
Write-Host "Web Frontend:       http://localhost:3000"
Write-Host "Backend API Docs:   http://localhost:5000/swagger"
Write-Host "AI Microservice:    http://localhost:8000/docs"
Write-Host "----------------------------------------------------------"
Write-Host "Default Test Credentials:"
Write-Host "Admin:       admin@propertyiq.pk       / Admin@12345"
Write-Host "Developer:   developer@skylinedev.pk   / Developer@12345"
Write-Host "Agent:       agent@lahoreproperties.pk / Agent@12345"
Write-Host "Specialist:  specialist@propertyiq.pk  / Specialist@12345"
Write-Host "Buyer:       buyer@gmail.com           / Buyer@12345"
Write-Host "=========================================================="
