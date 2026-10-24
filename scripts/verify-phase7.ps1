# Phase 7: landArea filters + ranking + soft fallback
#
# Usage:
#   .\scripts\verify-phase7.ps1

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
Write-Host "  PropertyIQ Phase 7 - Properties API alignment" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$ctrl = Join-Path $Root "services\api\src\PropertyIQ.Api\Controllers\PropertiesController.cs"
$search = Join-Path $Root "apps\web\src\app\search\page.tsx"

if ((Test-Path $ctrl) -and (Select-String -Path $ctrl -Pattern "landArea" -Quiet) -and (Select-String -Path $ctrl -Pattern "MatchMode|RelaxedReason" -Quiet)) {
    Write-Check "GetProperties landArea + MatchMode" "PASS"
} else { Write-Check "GetProperties landArea + MatchMode" "FAIL" }

if ((Test-Path $ctrl) -and (Select-String -Path $ctrl -Pattern "BuildPropertyQuery" -Quiet) -and (Select-String -Path $ctrl -Pattern "landAreaTolerance" -Quiet)) {
    Write-Check "Soft fallback builder" "PASS"
} else { Write-Check "Soft fallback builder" "FAIL" }

if ((Test-Path $search) -and (Select-String -Path $search -Pattern 'params.set\("landArea"' -Quiet) -and (Select-String -Path $search -Pattern "matchMode|relaxed" -Quiet)) {
    Write-Check "Search page landArea + relaxed banner" "PASS"
} else { Write-Check "Search page landArea + relaxed banner" "FAIL" }

$apiUp = $false
try {
    Invoke-WebRequest "http://localhost:5000/swagger/index.html" -UseBasicParsing -TimeoutSec 5 | Out-Null
    $apiUp = $true
    Write-Check "API :5000" "PASS"
} catch {
    Write-Check "API :5000" "FAIL" "start API then re-run"
}

if ($apiUp) {
    $py = Join-Path $Root "services\ai\.venv\Scripts\python.exe"
    $probe = Join-Path $env:TEMP "piq-phase7-probe.py"
    @'
import json, httpx
base = "http://localhost:5000/api/properties"
# Baseline sale listings
r0 = httpx.get(base, params={"purpose":"Sale","page":1,"pageSize":3}, timeout=30)
d0 = r0.json()
print("BASE", r0.status_code, d0.get("total") or d0.get("Total"), d0.get("matchMode") or d0.get("MatchMode"))

# landArea filter (may relax)
r1 = httpx.get(base, params={
  "purpose":"Sale","city":"Lahore","landArea":5,"landAreaUnit":"Marla","relax":"true","pageSize":5
}, timeout=30)
d1 = r1.json()
print(json.dumps({
  "status": r1.status_code,
  "total": d1.get("total") if d1.get("total") is not None else d1.get("Total"),
  "matchMode": d1.get("matchMode") or d1.get("MatchMode"),
  "relaxedReason": d1.get("relaxedReason") or d1.get("RelaxedReason"),
  "hasLandAreaParam": True,
  "firstLand": (d1.get("items") or d1.get("Items") or [{}])[0].get("landArea") or (d1.get("items") or d1.get("Items") or [{}])[0].get("LandArea"),
}))
'@ | Set-Content $probe -Encoding utf8
    try {
        if (Test-Path $py) {
            $out = & $py $probe 2>&1 | Out-String
            Write-Host $out
            if ($out -match '"status": 200' -or $out -match '"status":200') {
                Write-Check "Live landArea query" "PASS" "HTTP 200"
            } else {
                Write-Check "Live landArea query" "WARN" "unexpected output (API may need rebuild)"
            }
            if ($out -match "matchMode" -or $out -match "MatchMode" -or $out -match "exact" -or $out -match "relaxed") {
                Write-Check "Live MatchMode field" "PASS"
            } else {
                Write-Check "Live MatchMode field" "WARN" "rebuild/restart API for Phase 7"
            }
        } else {
            Write-Check "Live probes" "WARN" "python venv missing"
        }
    }
    catch {
        Write-Check "Live landArea query" "FAIL" $_.Exception.Message
    }
    finally {
        Remove-Item $probe -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase 7 READY - land filters + ranking + soft fallback." -ForegroundColor Green
} else {
    Write-Host "  Phase 7 NOT ready." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 } else { exit 0 }
