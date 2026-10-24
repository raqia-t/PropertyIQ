# Phase 3 check: hybrid Ollama search parser
#
# Usage (from repo root):
#   .\scripts\verify-phase3.ps1

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

function Find-AiPort {
    $portFile = Join-Path $Root ".ai-service.port"
    $candidates = @()
    if (Test-Path $portFile) {
        $fromFile = (Get-Content $portFile -Raw).Trim()
        if ($fromFile -match '^\d+$') { $candidates += [int]$fromFile }
    }
    $candidates += @(8001, 8000)
    foreach ($p in ($candidates | Select-Object -Unique)) {
        try {
            $h = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/health" -f $p) -TimeoutSec 5
            if ($h.service -like "*PropertyIQ*") { return @{ Port = $p; Health = $h } }
        }
        catch {}
    }
    return $null
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PropertyIQ Phase 3 - Hybrid Ollama search parser" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$mods = @(
    (Join-Path $Root "services\ai\ollama_parser.py"),
    (Join-Path $Root "services\ai\rule_parser.py")
)
foreach ($m in $mods) {
    if (Test-Path $m) { Write-Check (Split-Path $m -Leaf) "PASS" "present" }
    else { Write-Check (Split-Path $m -Leaf) "FAIL" "missing" }
}

$info = Find-AiPort
if ($null -eq $info) {
    Write-Check "AI service" "FAIL" "not running on 8000/8001"
    Write-Host "Phase 3 NOT ready." -ForegroundColor Red
    exit 1
}

$aiPort = $info.Port
$health = $info.Health
Write-Check "AI service" "PASS" (":{0}" -f $aiPort)

$mode = $health.parser.mode
$llmStatus = $health.llm.status
Write-Check "Health parser.mode" $(if ($mode) { "PASS" } else { "FAIL" }) ("mode={0}" -f $mode)
if ($llmStatus -eq "up") {
    Write-Check "Health llm" "PASS" ("model={0}" -f $health.llm.model)
}
elseif ($llmStatus -eq "model_missing") {
    Write-Check "Health llm" "FAIL" "pull qwen2.5:7b"
}
else {
    Write-Check "Health llm" "FAIL" ("status={0}" -f $llmStatus)
}

Write-Host ""
Write-Host "Live parse (may take 30-90s on first LLM call)" -ForegroundColor White

$query = "7 marla kothi in DHA Phase 5 Lahore under 2.5 crore for sale near schools"
try {
    $py = Join-Path $Root "services\ai\.venv\Scripts\python.exe"
    $probe = Join-Path $Root "services\ai\_phase3_probe.py"
    $probeCode = @"
import json, time, httpx
url = "http://127.0.0.1:$aiPort/ai/search-parser"
body = {"query": """$query""", "preferred_city": "Lahore"}
t0 = time.time()
r = httpx.post(url, json=body, timeout=120.0)
print(json.dumps({
    "status": r.status_code,
    "parser": r.headers.get("x-propertyiq-parser"),
    "ms": int((time.time() - t0) * 1000),
    "data": r.json() if r.headers.get("content-type","").startswith("application/json") else {"raw": r.text[:500]},
}))
"@
    Set-Content -Path $probe -Value $probeCode -Encoding utf8
    $swOut = & $py $probe 2>&1 | Out-String
    Remove-Item $probe -Force -ErrorAction SilentlyContinue
    $payload = $swOut | ConvertFrom-Json
    $parsed = $payload.data
    $parserHdr = $payload.parser

    if ([int]$payload.status -ge 400) {
        Write-Check "POST /ai/search-parser" "FAIL" ("HTTP {0}" -f $payload.status)
    }
    else {
        $detail = "source={0} city={1} type={2} purpose={3} area={4} land={5}{6} max={7} conf={8} ms={9}" -f `
            $parserHdr, $parsed.city, $parsed.property_type, $parsed.purpose, $parsed.area, `
            $parsed.land_area, $parsed.land_area_unit, $parsed.max_price, $parsed.confidence_score, $payload.ms

        $okCore = ($parsed.city -eq "Lahore") -and ($parsed.property_type -eq "House") -and ($parsed.purpose -eq "Sale")
        if ($okCore) {
            Write-Check "POST /ai/search-parser core fields" "PASS" $detail
        }
        else {
            Write-Check "POST /ai/search-parser core fields" "FAIL" $detail
        }

        if ($parserHdr -like "ollama*") {
            Write-Check "Parser source Ollama" "PASS" $parserHdr
        }
        elseif ($mode -eq "rules") {
            Write-Check "Parser source Ollama" "WARN" "AI_PARSER_MODE=rules"
        }
        else {
            Write-Check "Parser source Ollama" "WARN" ("fell back to {0} - check Ollama logs" -f $parserHdr)
        }

        $hasSchool = $false
        if ($parsed.lifestyle_preferences) {
            foreach ($x in $parsed.lifestyle_preferences) {
                if ("$x" -match "school") { $hasSchool = $true }
            }
        }
        if ($hasSchool) {
            Write-Check "Lifestyle near schools" "PASS" ($parsed.lifestyle_preferences -join "; ")
        }
        else {
            Write-Check "Lifestyle near schools" "WARN" "not extracted (non-blocking)"
        }
    }
}
catch {
    Write-Check "POST /ai/search-parser" "FAIL" $_.Exception.Message
}

# API bridge (optional if API up)
try {
    $body2 = @{ query = $query; preferredCity = "Lahore" } | ConvertTo-Json
    $api = Invoke-RestMethod "http://localhost:5000/api/ai/parse-search" -Method POST -ContentType "application/json" -Body $body2 -TimeoutSec 120
    if ($api.city -eq "Lahore") {
        Write-Check "API /api/ai/parse-search bridge" "PASS" ("type={0} purpose={1} max={2}" -f $api.propertyType, $api.purpose, $api.maxPrice)
    }
    else {
        Write-Check "API /api/ai/parse-search bridge" "FAIL" "unexpected city"
    }
}
catch {
    Write-Check "API /api/ai/parse-search bridge" "WARN" $_.Exception.Message
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase 3 READY - hybrid Ollama parser is live." -ForegroundColor Green
}
else {
    Write-Host "  Phase 3 NOT ready - fix FAIL items." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 } else { exit 0 }
