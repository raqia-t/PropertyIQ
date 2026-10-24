# Phase 8: Dev runner & ops (Ollama-first start, health, structured parse logs)
#
# Usage:
#   .\scripts\verify-phase8.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent
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

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PropertyIQ Phase 8 - Dev runner & ops" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$startDev = Join-Path $Root "start-dev.ps1"
$mainPy = Join-Path $Root "services\ai\main.py"
$parseLog = Join-Path $Root "services\ai\parse_logging.py"
$readme = Join-Path $Root "README.md"

# --- Static checks ---
if ((Test-Path $startDev) -and (Select-String -Path $startDev -Pattern "\[2/5\].*Ollama|Ensuring Ollama" -Quiet) -and (Select-String -Path $startDev -Pattern "\[3/5\].*AI|FastAPI AI" -Quiet)) {
    Write-Check "start-dev Ollama before AI" "PASS"
} else {
    Write-Check "start-dev Ollama before AI" "FAIL" "expected [2/5] Ollama then [3/5] AI"
}

if ((Test-Path $startDev) -and (Select-String -Path $startDev -Pattern "ollama serve|Find-OllamaExe|Test-OllamaReady" -Quiet)) {
    Write-Check "start-dev can start Ollama" "PASS"
} else {
    Write-Check "start-dev can start Ollama" "FAIL"
}

if ((Test-Path $startDev) -and (Select-String -Path $startDev -Pattern "search-parser\.jsonl" -Quiet)) {
    Write-Check "start-dev banner mentions parse logs" "PASS"
} else {
    Write-Check "start-dev banner mentions parse logs" "WARN"
}

if ((Test-Path $parseLog) -and (Select-String -Path $parseLog -Pattern "log_parse_event|latency_ms|confidence_score" -Quiet)) {
    Write-Check "parse_logging.py structured events" "PASS"
} else {
    Write-Check "parse_logging.py structured events" "FAIL"
}

if ((Test-Path $mainPy) -and (Select-String -Path $mainPy -Pattern "log_parse_event" -Quiet) -and (Select-String -Path $mainPy -Pattern "health_ready|/health/ready" -Quiet)) {
    Write-Check "main.py wiring (log + /health/ready)" "PASS"
} else {
    Write-Check "main.py wiring (log + /health/ready)" "FAIL"
}

if ((Test-Path $mainPy) -and (Select-String -Path $mainPy -Pattern '"llm"|check_ollama_health|degraded' -Quiet)) {
    Write-Check "AI /health reports llm + degraded" "PASS"
} else {
    Write-Check "AI /health reports llm + degraded" "FAIL"
}

if ((Test-Path $readme) -and (Select-String -Path $readme -Pattern "Ollama" -Quiet)) {
    Write-Check "README Ollama ops note" "PASS"
} else {
    Write-Check "README Ollama ops note" "WARN"
}

# --- Live checks ---
$aiBase = $null
$portFile = Join-Path $Root ".ai-service.port"
$candidates = @()
if (Test-Path $portFile) {
    $p = (Get-Content $portFile -Raw).Trim()
    if ($p -match '^\d+$') { $candidates += [int]$p }
}
$candidates += @(8000, 8001, 8002)
$candidates = $candidates | Select-Object -Unique

foreach ($port in $candidates) {
    try {
        $h = Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 3
        if ($h.service -like "*PropertyIQ*") {
            $aiBase = "http://127.0.0.1:$port"
            break
        }
    }
    catch {}
}

if (-not $aiBase) {
    Write-Check "AI service live" "WARN" "not running - start .\start-dev.ps1 then re-run for live checks"
} else {
    Write-Check "AI service live" "PASS" $aiBase
    try {
        $health = Invoke-RestMethod "$aiBase/health" -TimeoutSec 5
        if ($health.llm -and $health.llm.status) {
            Write-Check "Live /health.llm" "PASS" $health.llm.status
        } else {
            Write-Check "Live /health.llm" "FAIL" "missing llm.status"
        }
        if ($health.ops -and $health.ops.parse_log_file) {
            Write-Check "Live /health.ops" "PASS"
        } else {
            Write-Check "Live /health.ops" "WARN" "ops block missing (restart AI)"
        }
        if ($health.status -in @("healthy", "degraded")) {
            Write-Check "Live /health.status" "PASS" $health.status
        } else {
            Write-Check "Live /health.status" "FAIL" "$($health.status)"
        }
    }
    catch {
        Write-Check "Live /health" "FAIL" $_.Exception.Message
    }

    try {
        $ready = Invoke-RestMethod "$aiBase/health/ready" -TimeoutSec 5
        if ($ready.ready -eq $true) {
            Write-Check "Live /health/ready" "PASS"
        } else {
            Write-Check "Live /health/ready" "WARN" "ready=$($ready.ready)"
        }
    }
    catch {
        Write-Check "Live /health/ready" "FAIL" "restart AI after Phase 8"
    }

    # Trigger one parse so jsonl gets a line
    try {
        $body = @{ query = "5 marla house DHA Lahore under 3 crore"; preferred_city = "Lahore" } | ConvertTo-Json
        $parsed = Invoke-RestMethod -Uri "$aiBase/ai/search-parser" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 180
        Write-Check "Live search-parser call" "PASS" ("conf={0:N2}" -f $parsed.confidence_score)
    }
    catch {
        Write-Check "Live search-parser call" "WARN" $_.Exception.Message
    }

    $logFile = Join-Path $Root "services\ai\logs\search-parser.jsonl"
    if (Test-Path $logFile) {
        $last = Get-Content $logFile -Tail 1 -ErrorAction SilentlyContinue
        if ($last -and ($last -match '"latency_ms"' -and $last -match '"source"' -and $last -match '"confidence_score"')) {
            Write-Check "Parse log JSONL line" "PASS" $logFile
        } else {
            Write-Check "Parse log JSONL line" "WARN" "file exists but last line incomplete"
        }
    } else {
        Write-Check "Parse log JSONL line" "WARN" "no log yet (parse may have failed before write)"
    }
}

# Ollama optional but reported
try {
    $tags = Invoke-RestMethod "http://127.0.0.1:11434/api/tags" -TimeoutSec 3
    $hasQwen = @($tags.models | ForEach-Object { $_.name }) | Where-Object { $_ -like "qwen2.5:7b*" }
    if ($hasQwen) {
        Write-Check "Ollama qwen2.5:7b" "PASS"
    } else {
        Write-Check "Ollama qwen2.5:7b" "WARN" "up but model missing - ollama pull qwen2.5:7b"
    }
}
catch {
    Write-Check "Ollama :11434" "WARN" "down - hybrid falls back to rules"
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase 8 READY - Ollama-first start-dev, health, parse logs." -ForegroundColor Green
} else {
    Write-Host "  Phase 8 NOT ready." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 } else { exit 0 }
