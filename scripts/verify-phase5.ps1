# Phase 5: ASP.NET AI bridge (timeout, purpose, parserSource)
#
# Usage (from repo root):
#   .\scripts\verify-phase5.ps1

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
Write-Host "  PropertyIQ Phase 5 - ASP.NET AI bridge" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$di = Join-Path $Root "services\api\src\PropertyIQ.Infrastructure\DependencyInjection.cs"
$settings = Join-Path $Root "services\api\src\PropertyIQ.Api\appsettings.json"
$dto = Join-Path $Root "services\api\src\PropertyIQ.Application\Common\Interfaces\IAiServiceClient.cs"
$search = Join-Path $Root "apps\web\src\app\search\page.tsx"

if ((Test-Path $di) -and (Select-String -Path $di -Pattern "TimeoutSeconds|Timeout" -Quiet)) {
    Write-Check "HttpClient timeout config" "PASS" "DependencyInjection"
} else { Write-Check "HttpClient timeout config" "FAIL" "missing" }

if ((Test-Path $settings) -and (Select-String -Path $settings -Pattern "AiService" -Quiet) -and (Select-String -Path $settings -Pattern "TimeoutSeconds" -Quiet)) {
    Write-Check "appsettings AiService" "PASS" "BaseUrl + TimeoutSeconds"
} else { Write-Check "appsettings AiService" "FAIL" "missing section" }

if ((Test-Path $dto) -and (Select-String -Path $dto -Pattern "ParserSource" -Quiet) -and (Select-String -Path $dto -Pattern "Purpose" -Quiet)) {
    Write-Check "DTO Purpose + ParserSource" "PASS"
} else { Write-Check "DTO Purpose + ParserSource" "FAIL" }

if ((Test-Path $search) -and (Select-String -Path $search -Pattern "Understanding" -Quiet) -and (Select-String -Path $search -Pattern "parserSource|purposeNorm|landArea" -Quiet)) {
    Write-Check "Web search bridge UX" "PASS" "purpose + understanding state"
} else { Write-Check "Web search bridge UX" "FAIL" }

# Live API
$apiUp = $false
try {
    Invoke-WebRequest "http://localhost:5000/swagger/index.html" -UseBasicParsing -TimeoutSec 5 | Out-Null
    $apiUp = $true
    Write-Check "API :5000" "PASS"
} catch {
    Write-Check "API :5000" "FAIL" $_.Exception.Message
}

if ($apiUp) {
    $py = Join-Path $Root "services\ai\.venv\Scripts\python.exe"
    $probe = Join-Path $Root "services\ai\_phase5_probe.py"
    $code = @'
import json, time, httpx
url = "http://localhost:5000/api/ai/parse-search"
body = {
  "query": "5 marla house in DHA Lahore under 3 crore for sale near schools",
  "preferredCity": "Lahore",
}
t0 = time.time()
r = httpx.post(url, json=body, timeout=160.0)
ms = int((time.time()-t0)*1000)
data = r.json() if r.headers.get("content-type","").startswith("application/json") else {}
print(json.dumps({
  "status": r.status_code,
  "ms": ms,
  "header": r.headers.get("x-propertyiq-parser"),
  "city": data.get("city") or data.get("City"),
  "purpose": data.get("purpose") or data.get("Purpose"),
  "propertyType": data.get("propertyType") or data.get("PropertyType"),
  "maxPrice": data.get("maxPrice") if data.get("maxPrice") is not None else data.get("MaxPrice"),
  "parserSource": data.get("parserSource") or data.get("ParserSource"),
  "landArea": data.get("landArea") if data.get("landArea") is not None else data.get("LandArea"),
}))
'@
    Set-Content -Path $probe -Value $code -Encoding utf8
    try {
        if (-not (Test-Path $py)) { Write-Check "Live parse-search" "WARN" "AI venv python missing; skip probe" }
        else {
            $out = & $py $probe 2>&1 | Out-String
            $payload = $out | ConvertFrom-Json
            $detail = "status={0} ms={1} city={2} purpose={3} type={4} max={5} source={6} land={7}" -f `
                $payload.status, $payload.ms, $payload.city, $payload.purpose, $payload.propertyType, $payload.maxPrice, $payload.parserSource, $payload.landArea
            $ok = ([int]$payload.status -eq 200) -and ($payload.city -eq "Lahore") -and ($payload.purpose -eq "Sale") -and ($null -ne $payload.maxPrice)
            if ($ok) { Write-Check "Live /api/ai/parse-search" "PASS" $detail }
            else { Write-Check "Live /api/ai/parse-search" "FAIL" $detail }
            if ($payload.parserSource) { Write-Check "ParserSource on DTO" "PASS" $payload.parserSource }
            else { Write-Check "ParserSource on DTO" "WARN" "null - rebuild/restart API" }
        }
    }
    catch {
        Write-Check "Live /api/ai/parse-search" "FAIL" $_.Exception.Message
    }
    finally {
        Remove-Item $probe -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase 5 READY - ASP.NET bridge hardened for Ollama latency." -ForegroundColor Green
} else {
    Write-Host "  Phase 5 NOT ready." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 } else { exit 0 }
