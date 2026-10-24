# Phase 0 precondition check for PropertyIQ AI Search
# Confirms: Web :3000, API :5000, AI (PropertyIQ FastAPI), Postgres :5433,
# published listings, rule-parser fallback intact, NL -> filters -> properties pipeline.
#
# Usage (from repo root):
#   .\scripts\verify-phase0.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $Root "services\ai\main.py"))) {
    $Root = $PSScriptRoot
    if (-not (Test-Path (Join-Path $Root "services\ai\main.py"))) {
        Write-Host "ERROR: Run from PropertyIQ repo (expected services\ai\main.py)." -ForegroundColor Red
        exit 1
    }
}

$pass = 0
$fail = 0
$warn = 0

function Write-Check([string]$Name, [string]$Status, [string]$Detail = "") {
    switch ($Status) {
        "PASS" { $script:pass++; $color = "Green" }
        "WARN" { $script:warn++; $color = "Yellow" }
        default { $script:fail++; $color = "Red"; $Status = "FAIL" }
    }
    $line = "[{0}] {1}" -f $Status, $Name
    if ($Detail) { $line = $line + " - " + $Detail }
    Write-Host $line -ForegroundColor $color
}

function Test-Port([int]$Port) {
    return (Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
}

function Find-PropertyIqAiPort {
    $portFile = Join-Path $Root ".ai-service.port"
    $candidates = @()
    if (Test-Path $portFile) {
        $fromFile = (Get-Content $portFile -Raw).Trim()
        if ($fromFile -match '^\d+$') { $candidates += [int]$fromFile }
    }
    $candidates += @(8001, 8000)
    foreach ($p in ($candidates | Select-Object -Unique)) {
        try {
            $h = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/health" -f $p) -TimeoutSec 3
            if ($h.service -like "*PropertyIQ*") { return $p }
        }
        catch {}
    }
    return $null
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PropertyIQ Phase 0 - AI Search Preconditions" -ForegroundColor Cyan
Write-Host ("  Root: {0}" -f $Root)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1) Services" -ForegroundColor White

if (Test-Port 3000) {
    try {
        $code = (Invoke-WebRequest "http://localhost:3000" -UseBasicParsing -TimeoutSec 8).StatusCode
        Write-Check "Web :3000" "PASS" ("HTTP {0}" -f $code)
    }
    catch {
        Write-Check "Web :3000" "FAIL" $_.Exception.Message
    }
}
else {
    Write-Check "Web :3000" "FAIL" "port not listening"
}

if (Test-Port 5000) {
    try {
        $null = Invoke-WebRequest "http://localhost:5000/swagger/index.html" -UseBasicParsing -TimeoutSec 8
        Write-Check "API :5000" "PASS" "swagger reachable"
    }
    catch {
        Write-Check "API :5000" "FAIL" $_.Exception.Message
    }
}
else {
    Write-Check "API :5000" "FAIL" "port not listening"
}

if (Test-Port 5433) {
    Write-Check "Postgres :5433" "PASS" "port listening"
}
else {
    Write-Check "Postgres :5433" "FAIL" "port not listening - start docker propertyiq-pg-dev or .\start-dev.ps1"
}

$aiPort = Find-PropertyIqAiPort
if ($null -ne $aiPort) {
    Write-Check "AI PropertyIQ FastAPI" "PASS" (":{0} /health OK" -f $aiPort)
}
else {
    $busy8000 = Test-Port 8000
    $hint = if ($busy8000) {
        "port 8000 is occupied by another app - run AI on 8001 via start-dev.ps1"
    }
    else {
        "start with .\start-dev.ps1 or uvicorn on 8000/8001"
    }
    Write-Check "AI PropertyIQ FastAPI" "FAIL" $hint
}

Write-Host ""
Write-Host "2) Rule parser kept (fallback)" -ForegroundColor White

$aiMain = Join-Path $Root "services\ai\main.py"
$aiClient = Join-Path $Root "services\api\src\PropertyIQ.Infrastructure\Services\AiServiceClient.cs"
if ((Test-Path $aiMain) -and (Select-String -Path $aiMain -Pattern "parse_natural_language_search|/ai/search-parser" -Quiet)) {
    Write-Check "Python rule parser in main.py" "PASS" "/ai/search-parser present"
}
else {
    Write-Check "Python rule parser in main.py" "FAIL" "endpoint missing"
}

if ((Test-Path $aiClient) -and (Select-String -Path $aiClient -Pattern "Resilient Fallback|rule parser fallback" -Quiet)) {
    Write-Check "C# AiServiceClient rule fallback" "PASS" "fallback block present"
}
else {
    Write-Check "C# AiServiceClient rule fallback" "FAIL" "fallback missing"
}

Write-Host ""
Write-Host "3) Published inventory" -ForegroundColor White

try {
    $props = Invoke-RestMethod "http://localhost:5000/api/properties?purpose=Sale&page=1&pageSize=1" -TimeoutSec 15
    $publishedTotal = if ($null -ne $props.total) { [int]$props.total } elseif ($null -ne $props.Total) { [int]$props.Total } else { 0 }
    if ($publishedTotal -gt 0) {
        Write-Check "Published Sale listings" "PASS" ("Total={0}" -f $publishedTotal)
    }
    else {
        Write-Check "Published Sale listings" "FAIL" "Total=0 - seed/API must publish listings"
    }
}
catch {
    Write-Check "Published Sale listings" "FAIL" $_.Exception.Message
}

try {
    $rentUrl = 'http://localhost:5000/api/properties?purpose=Rent&page=1&pageSize=1'
    $rent = Invoke-RestMethod $rentUrl -TimeoutSec 15
    $rentTotal = if ($null -ne $rent.total) { [int]$rent.total } elseif ($null -ne $rent.Total) { [int]$rent.Total } else { 0 }
    if ($rentTotal -gt 0) {
        Write-Check "Published Rent listings" "PASS" ("Total={0}" -f $rentTotal)
    }
    else {
        Write-Check "Published Rent listings" "WARN" "Total=0 - Rent search will look empty"
    }
}
catch {
    Write-Check "Published Rent listings" "WARN" $_.Exception.Message
}

Write-Host ""
Write-Host "4) Pipeline: NL parse -> structured filters -> properties" -ForegroundColor White

$query = "5 marla house in DHA Lahore under 3 crore"
$parsed = $null

if ($null -ne $aiPort) {
    try {
        $body = @{ query = $query; preferred_city = "Lahore" } | ConvertTo-Json
        $parsed = Invoke-RestMethod ("http://127.0.0.1:{0}/ai/search-parser" -f $aiPort) -Method POST -ContentType "application/json" -Body $body -TimeoutSec 20
        $parseOk = ($parsed.city -eq "Lahore") -and (($null -ne $parsed.max_price) -or ($null -ne $parsed.maxPrice))
        $detail = "city={0} max_price={1} land_area={2} conf={3}" -f $parsed.city, $parsed.max_price, $parsed.land_area, $parsed.confidence_score
        if ($parseOk) { Write-Check "Direct AI /ai/search-parser" "PASS" $detail }
        else { Write-Check "Direct AI /ai/search-parser" "FAIL" $detail }
    }
    catch {
        Write-Check "Direct AI /ai/search-parser" "FAIL" $_.Exception.Message
    }
}
else {
    Write-Check "Direct AI /ai/search-parser" "WARN" "skipped - AI not up; API fallback still usable"
}

try {
    $body2 = @{ query = $query; preferredCity = "Lahore" } | ConvertTo-Json
    $apiParsed = Invoke-RestMethod "http://localhost:5000/api/ai/parse-search" -Method POST -ContentType "application/json" -Body $body2 -TimeoutSec 25
    $city = if ($apiParsed.city) { $apiParsed.city } else { $apiParsed.City }
    $maxP = if ($null -ne $apiParsed.maxPrice) { $apiParsed.maxPrice } else { $apiParsed.MaxPrice }
    $conf = if ($null -ne $apiParsed.confidenceScore) { $apiParsed.confidenceScore } else { $apiParsed.ConfidenceScore }
    $viaFastapi = ($null -ne $aiPort) -and ([double]$conf -ge 0.90)
    $mode = if ($viaFastapi) { "FastAPI rules" } else { "C# fallback and/or FastAPI" }
    if ($city -eq "Lahore" -and $null -ne $maxP) {
        Write-Check "API /api/ai/parse-search" "PASS" ("city={0} maxPrice={1} conf={2} ({3})" -f $city, $maxP, $conf, $mode)
    }
    else {
        Write-Check "API /api/ai/parse-search" "FAIL" "unexpected payload"
    }
}
catch {
    Write-Check "API /api/ai/parse-search" "FAIL" $_.Exception.Message
}

try {
    $qs = 'purpose=Sale&city=Lahore&propertyType=House&maxPrice=30000000&page=1&pageSize=5'
    $filtered = Invoke-RestMethod ("http://localhost:5000/api/properties?{0}" -f $qs) -TimeoutSec 15
    $ft = if ($null -ne $filtered.total) { [int]$filtered.total } elseif ($null -ne $filtered.Total) { [int]$filtered.Total } else { 0 }
    Write-Check "Filtered GET /api/properties" "PASS" ("House Sale Lahore under 3Cr -> Total={0}" -f $ft)
}
catch {
    Write-Check "Filtered GET /api/properties" "FAIL" $_.Exception.Message
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase 0 READY - proceed to Phase 1 (Ollama + Qwen)." -ForegroundColor Green
    Write-Host "  Goal locked: NL query -> structured filters -> GET /api/properties" -ForegroundColor Green
}
else {
    Write-Host "  Phase 0 NOT ready - fix FAIL items, then re-run this script." -ForegroundColor Red
    Write-Host "  Tip: .\start-dev.ps1  (AI falls back to :8001 if :8000 is taken)" -ForegroundColor Yellow
}
Write-Host "==========================================================" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 } else { exit 0 }
