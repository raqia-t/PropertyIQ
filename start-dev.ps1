# PropertyIQ AI Pakistan - Local Development Runner
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Starting PropertyIQ AI (Pakistan) Platform Services" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

$Root = $PSScriptRoot
$ErrorActionPreference = "Continue"

# Resolve tool paths
$PgRootCandidates = @(
    "C:\Program Files\PostgreSQL\18",
    "C:\Program Files\PostgreSQL\17",
    "C:\Program Files\PostgreSQL\16"
)
$PgRoot = $PgRootCandidates | Where-Object { Test-Path (Join-Path $_ "bin\postgres.exe") } | Select-Object -First 1
if ($PgRoot) {
    $PgBin = Join-Path $PgRoot "bin"
} else {
    $PgBin = $null
}

$ApiProj = Join-Path $Root "services\api\src\PropertyIQ.Api\PropertyIQ.Api.csproj"
$WebDir = Join-Path $Root "apps\web"
$AiDir = Join-Path $Root "services\ai"
$AiPython = Join-Path $AiDir ".venv\Scripts\python.exe"

if (-not (Test-Path $ApiProj)) {
    Write-Host "ERROR: API project not found at $ApiProj" -ForegroundColor Red
    Write-Host "Run this script from the repo root: d:\PropertyIQ\PropertyIQ" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path (Join-Path $WebDir "package.json"))) {
    Write-Host "ERROR: Web app not found at $WebDir" -ForegroundColor Red
    exit 1
}

# 1. PostgreSQL on 5433 (local install OR Docker fallback)
Write-Host ""
Write-Host "[1/5] Starting PostgreSQL on port 5433..." -ForegroundColor Cyan
$pgListening = (Test-NetConnection -ComputerName localhost -Port 5433 -WarningAction SilentlyContinue).TcpTestSucceeded

if (-not $pgListening) {
    if ($PgBin) {
        $PgData = Join-Path $Root ".db\data"
        if (-not (Test-Path $PgData)) {
            & (Join-Path $PgBin "initdb.exe") -D $PgData -U postgres -A trust -E UTF8
        }
        $pgExe = Join-Path $PgBin "postgres.exe"
        Start-Process -FilePath $pgExe -ArgumentList "-D `"$PgData`" -p 5433" -WindowStyle Minimized
        Write-Host "  Local PostgreSQL started from $PgBin" -ForegroundColor DarkGray
    }
    else {
        Write-Host "  Local PostgreSQL not installed - using Docker on 5433..." -ForegroundColor Yellow
        $existing = docker ps -a --filter "name=propertyiq-pg-dev" --format "{{.Names}}" 2>$null
        if ($existing -eq "propertyiq-pg-dev") {
            docker start propertyiq-pg-dev | Out-Null
        }
        else {
            docker run -d --name propertyiq-pg-dev `
                -e POSTGRES_PASSWORD=postgres `
                -e POSTGRES_USER=postgres `
                -e POSTGRES_DB=propertyiq_db `
                -p 5433:5432 `
                pgvector/pgvector:pg16 | Out-Null
        }
        Write-Host "  Waiting for Docker Postgres to become ready..." -ForegroundColor DarkGray
        $ready = $false
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 2
            docker exec propertyiq-pg-dev pg_isready -U postgres -d propertyiq_db 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $ready = $true
                break
            }
        }
        if (-not $ready) {
            Write-Host "  WARNING: Postgres may not be ready yet." -ForegroundColor Yellow
        }
        else {
            Write-Host "  Docker Postgres is ready." -ForegroundColor DarkGray
        }
    }
}
else {
    Write-Host "  Port 5433 already in use - reusing existing Postgres." -ForegroundColor DarkGray
}

# Phase 8 defaults (override before running if needed)
if (-not $env:AI_PARSER_MODE) { $env:AI_PARSER_MODE = "hybrid" }
if (-not $env:AI_LISTING_DRAFT_MODE) { $env:AI_LISTING_DRAFT_MODE = "hybrid" }
if (-not $env:AI_SCENARIO_EXPLAIN) { $env:AI_SCENARIO_EXPLAIN = "hybrid" }
if (-not $env:AI_SCENARIO_EXPLAIN_TIMEOUT_SEC) { $env:AI_SCENARIO_EXPLAIN_TIMEOUT_SEC = "8" }
if (-not $env:AI_IMAGE_CLASSIFY_MODE) { $env:AI_IMAGE_CLASSIFY_MODE = "hybrid" }
if (-not $env:AI_IMAGE_CLASSIFY_TIMEOUT_SEC) { $env:AI_IMAGE_CLASSIFY_TIMEOUT_SEC = "18" }
if (-not $env:OLLAMA_VISION_MODEL) { $env:OLLAMA_VISION_MODEL = "llava:7b" }
if (-not $env:OLLAMA_VISION_TIMEOUT_SEC) { $env:OLLAMA_VISION_TIMEOUT_SEC = "180" }
if (-not $env:AI_AGENT_OPS_MODE) { $env:AI_AGENT_OPS_MODE = "hybrid" }
if (-not $env:AI_AGENT_OPS_TIMEOUT_SEC) { $env:AI_AGENT_OPS_TIMEOUT_SEC = "2.5" }
if (-not $env:OLLAMA_BASE_URL) { $env:OLLAMA_BASE_URL = "http://127.0.0.1:11434" }
if (-not $env:OLLAMA_MODEL) { $env:OLLAMA_MODEL = "qwen2.5:7b" }
if (-not $env:OLLAMA_TIMEOUT_SEC) { $env:OLLAMA_TIMEOUT_SEC = "150" }

function Test-OllamaReady {
    try {
        $tags = Invoke-RestMethod -Uri "$($env:OLLAMA_BASE_URL)/api/tags" -TimeoutSec 3
        $names = @($tags.models | ForEach-Object { $_.name })
        $hasModel = $names | Where-Object {
            $_ -eq $env:OLLAMA_MODEL -or $_ -like "$($env:OLLAMA_MODEL)*" -or $_ -like "qwen2.5:7b*"
        }
        return @{ Up = $true; HasModel = [bool]$hasModel; Names = $names }
    }
    catch {
        return @{ Up = $false; HasModel = $false; Names = @() }
    }
}

function Find-OllamaExe {
    $cmd = Get-Command ollama -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
        "C:\Program Files\Ollama\ollama.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

# 2. Ollama (before AI so hybrid parser can use LLM on first request)
Write-Host ""
Write-Host "[2/5] Ensuring Ollama on :11434..." -ForegroundColor Cyan
$ollamaState = Test-OllamaReady
if ($ollamaState.Up) {
    if ($ollamaState.HasModel) {
        Write-Host "  Ollama READY ($($env:OLLAMA_MODEL))" -ForegroundColor DarkGray
    }
    else {
        Write-Host "  Ollama up but model missing - run: ollama pull $($env:OLLAMA_MODEL)" -ForegroundColor Yellow
    }
}
else {
    $ollamaExe = Find-OllamaExe
    if ($ollamaExe) {
        Write-Host "  Starting Ollama serve..." -ForegroundColor DarkGray
        Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Minimized
        $started = $false
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1
            $ollamaState = Test-OllamaReady
            if ($ollamaState.Up) {
                $started = $true
                break
            }
        }
        if ($started) {
            if ($ollamaState.HasModel) {
                Write-Host "  Ollama READY ($($env:OLLAMA_MODEL))" -ForegroundColor DarkGray
            }
            else {
                Write-Host "  Ollama up but model missing - run: ollama pull $($env:OLLAMA_MODEL)" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "  WARNING: Ollama did not become ready - AI will use rules fallback." -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "  Ollama not installed - AI hybrid parser will use rules fallback." -ForegroundColor Yellow
        Write-Host "  Install from https://ollama.com then: ollama pull $($env:OLLAMA_MODEL)" -ForegroundColor DarkGray
    }
}

# 3. AI microservice (optional - skip if venv missing)
# Prefer :8000; if occupied by another app (e.g. ecom_api), fall back to :8001/:8002
Write-Host ""
Write-Host "[3/5] Starting FastAPI AI Service..." -ForegroundColor Cyan
$AiPortFile = Join-Path $Root ".ai-service.port"
$AiBaseUrl = $null
$AiPort = $null
$AiHealth = $null

function Test-PropertyIqAi([int]$Port) {
    try {
        $h = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3
        if ($h.service -like "*PropertyIQ*") { return $h }
        return $null
    }
    catch {
        return $null
    }
}

foreach ($candidate in @(8000, 8001, 8002)) {
    $h = Test-PropertyIqAi -Port $candidate
    if ($h) {
        $AiPort = $candidate
        $AiBaseUrl = "http://127.0.0.1:$candidate"
        $AiHealth = $h
        Write-Host "  PropertyIQ AI already healthy on :$candidate (status=$($h.status))" -ForegroundColor DarkGray
        break
    }
}

if (-not $AiBaseUrl) {
    if (-not (Test-Path $AiPython)) {
        Write-Host "  AI venv not found at $AiPython - skipping (API will use rule-parser fallback)." -ForegroundColor Yellow
    }
    else {
        $chosen = $null
        foreach ($candidate in @(8000, 8001, 8002)) {
            $busy = (Test-NetConnection -ComputerName localhost -Port $candidate -WarningAction SilentlyContinue).TcpTestSucceeded
            if (-not $busy) {
                $chosen = $candidate
                break
            }
            Write-Host "  Port $candidate busy (not PropertyIQ AI) - trying next..." -ForegroundColor Yellow
        }
        if ($null -eq $chosen) {
            Write-Host "  Ports 8000-8002 busy - AI not started (rule fallback active)." -ForegroundColor Yellow
        }
        else {
            Start-Process -FilePath $AiPython -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port $chosen --reload" -WorkingDirectory $AiDir -WindowStyle Minimized
            $AiPort = $chosen
            Write-Host "  AI service starting on :$chosen (waiting for /health)..." -ForegroundColor DarkGray
            for ($i = 0; $i -lt 45; $i++) {
                Start-Sleep -Seconds 1
                $h = Test-PropertyIqAi -Port $chosen
                if ($h) {
                    $AiBaseUrl = "http://127.0.0.1:$chosen"
                    $AiHealth = $h
                    Write-Host "  AI READY on :$chosen (status=$($h.status))" -ForegroundColor DarkGray
                    break
                }
            }
            if (-not $AiBaseUrl) {
                Write-Host "  WARNING: AI started but /health not ready yet." -ForegroundColor Yellow
                $AiBaseUrl = "http://127.0.0.1:$chosen"
            }
        }
    }
}

if ($AiBaseUrl) {
    Set-Content -Path $AiPortFile -Value $AiPort -Encoding ascii
    $env:AiService__BaseUrl = $AiBaseUrl
    if ($AiHealth -and $AiHealth.llm) {
        Write-Host "  LLM: $($AiHealth.llm.status)  parser: $($env:AI_PARSER_MODE)" -ForegroundColor DarkGray
    }
}
elseif (Test-Path $AiPortFile) {
    Remove-Item $AiPortFile -Force -ErrorAction SilentlyContinue
}

# 4. ASP.NET Core API
Write-Host ""
Write-Host "[4/5] Starting ASP.NET Core Web API on port 5000..." -ForegroundColor Cyan
$apiBusy = (Test-NetConnection -ComputerName localhost -Port 5000 -WarningAction SilentlyContinue).TcpTestSucceeded
if ($apiBusy) {
    Write-Host "  Port 5000 already in use - stopping existing PropertyIQ.Api so DB can re-seed..." -ForegroundColor Yellow
    Get-Process PropertyIQ.Api -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}
# AiService__BaseUrl inherited from this process when set above
Start-Process -FilePath "dotnet" -ArgumentList "run --project `"$ApiProj`" --urls http://localhost:5000" -WorkingDirectory $Root -WindowStyle Minimized
Write-Host "  API starting (seed runs on boot)..." -ForegroundColor DarkGray
if ($AiBaseUrl) {
    Write-Host "  AiService:BaseUrl=$AiBaseUrl" -ForegroundColor DarkGray
}

# 5. Next.js Web
Write-Host ""
Write-Host "[5/5] Starting Next.js Web App on port 3000..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $WebDir "node_modules"))) {
    Write-Host "  Installing npm dependencies..." -ForegroundColor Yellow
    Push-Location $WebDir
    npm.cmd install
    Pop-Location
}
$webBusy = (Test-NetConnection -ComputerName localhost -Port 3000 -WarningAction SilentlyContinue).TcpTestSucceeded
if ($webBusy) {
    Write-Host "  Port 3000 already in use - open http://localhost:3000" -ForegroundColor Yellow
}
else {
    Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $WebDir -WindowStyle Minimized
    Write-Host "  Web starting..." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Waiting for web + API..." -ForegroundColor Cyan
$webReady = $false
$apiReady = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    if (-not $apiReady) {
        try {
            Invoke-WebRequest -Uri "http://localhost:5000/swagger/index.html" -UseBasicParsing -TimeoutSec 2 | Out-Null
            $apiReady = $true
        }
        catch {}
    }
    if (-not $webReady) {
        try {
            Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 | Out-Null
            $webReady = $true
        }
        catch {}
    }
    if ($apiReady -and $webReady) {
        break
    }
}

$apiStatus = if ($apiReady) { "READY" } else { "starting..." }
$webStatus = if ($webReady) { "READY" } else { "starting..." }

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Repo root:  $Root"
Write-Host "  API:        http://localhost:5000/swagger   ($apiStatus)"
Write-Host "  Web app:    http://localhost:3000           ($webStatus)"
$aiBanner = if ($AiBaseUrl) { "$AiBaseUrl/docs" } else { "not running (API rule-parser fallback)" }
Write-Host "  AI:         $aiBanner"
$finalOllama = Test-OllamaReady
if ($finalOllama.Up -and $finalOllama.HasModel) {
    $ollamaBanner = "READY ($($env:OLLAMA_MODEL))"
}
elseif ($finalOllama.Up) {
    $ollamaBanner = "up (pull $($env:OLLAMA_MODEL))"
}
else {
    $ollamaBanner = "down - install/start Ollama for hybrid NL search"
}
Write-Host "  Ollama:     $($env:OLLAMA_BASE_URL)   ($ollamaBanner)"
Write-Host "  Parser:     mode=$($env:AI_PARSER_MODE)"
Write-Host "  Parse logs: services\ai\logs\search-parser.jsonl"
Write-Host "----------------------------------------------------------"
Write-Host "  IMPORTANT: Always run from:  d:\PropertyIQ\PropertyIQ"
Write-Host "  (Not from parent folder d:\PropertyIQ)"
Write-Host "----------------------------------------------------------"
Write-Host "Demo logins:"
Write-Host "  Buyer:      buyer@gmail.com           / Buyer@12345"
Write-Host "  Agent:      agent@lahoreproperties.pk / Agent@12345"
Write-Host "  Developer:  developer@skylinedev.pk   / Developer@12345"
Write-Host "  Specialist: specialist@propertyiq.pk  / Specialist@12345"
Write-Host "==========================================================" -ForegroundColor Green

if ($webReady) {
    Start-Process "http://localhost:3000"
}
