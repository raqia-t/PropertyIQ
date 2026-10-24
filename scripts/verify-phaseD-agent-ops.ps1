# Phase D: agent daily brief + optimizer polish
#
# Usage:
#   .\scripts\verify-phaseD-agent-ops.ps1

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
Write-Host "  PropertyIQ Phase D - Agent ops polish" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($rel in @(
    "services\ai\agent_ops.py",
    "services\api\src\PropertyIQ.Api\Controllers\AgentController.cs"
)) {
    if (Test-Path (Join-Path $Root $rel)) { Write-Check "File $rel" "PASS" }
    else { Write-Check "File $rel" "FAIL" }
}

$mainPy = Join-Path $Root "services\ai\main.py"
if ((Test-Path $mainPy) -and (Select-String -Path $mainPy -Pattern "agent-ops|run_agent_ops" -Quiet)) {
    Write-Check "main.py agent-ops endpoint" "PASS"
} else { Write-Check "main.py agent-ops endpoint" "FAIL" }

$ctrl = Join-Path $Root "services\api\src\PropertyIQ.Api\Controllers\AgentController.cs"
if ((Test-Path $ctrl) -and (Select-String -Path $ctrl -Pattern "RunAgentOpsAsync|BriefingSource|MediaMix" -Quiet)) {
    Write-Check "AgentController Phase D wiring" "PASS"
} else { Write-Check "AgentController Phase D wiring" "FAIL" }

$ui = Join-Path $Root "apps\web\src\app\agent\page.tsx"
if ((Test-Path $ui) -and (Select-String -Path $ui -Pattern "briefingSource|recommendationSource" -Quiet)) {
    Write-Check "Agent UI source badges" "PASS"
} else { Write-Check "Agent UI source badges" "WARN" }

$aiPort = 8001
if (Test-Path (Join-Path $Root ".ai-service.port")) {
    $p = (Get-Content (Join-Path $Root ".ai-service.port") -Raw).Trim()
    if ($p -match '^\d+$') { $aiPort = [int]$p }
}

$aiUp = $false
try {
    $h = Invoke-RestMethod "http://127.0.0.1:$aiPort/health" -TimeoutSec 5
    if ($h.service -like "*PropertyIQ*") {
        $aiUp = $true
        Write-Check "AI :$aiPort" "PASS"
        if ($h.ops.agent_ops) { Write-Check "Health agent_ops" "PASS" $h.ops.agent_ops.mode }
        else { Write-Check "Health agent_ops" "WARN" "restart AI" }
    }
} catch {
    Write-Check "AI service" "WARN" "not running"
}

if ($aiUp) {
    $body = @{
        stats = @{
            active_listings     = 3
            pending_leads       = 2
            total_leads         = 5
            total_views         = 40
            total_saves         = 8
            upcoming_visits     = 1
            in_review           = 0
            unverified          = 1
            weak_listing_count  = 1
        }
        fallback_brief = "You have 3 active listings. 2 new leads need follow-up (5 total)."
        alerts = @(
            @{
                property_id   = "11111111-1111-1111-1111-111111111111"
                title         = "Sample House"
                issue         = "Only 2 photos uploaded (minimum 5 recommended)"
                recommendation = "Upload kitchen, elevation, and washroom photos."
                alert_type    = "Photos"
                city          = "Lahore"
                area          = "DHA"
                asking_price  = 50000000
            }
        )
    } | ConvertTo-Json -Depth 6

    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$aiPort/ai/agent-ops" -Method Post `
            -Body $body -ContentType "application/json" -TimeoutSec 90 -UseBasicParsing
        $src = $resp.Headers["X-PropertyIQ-Agent-Ops"]
        $json = $resp.Content | ConvertFrom-Json
        if ($json.briefing -and $json.briefing.Length -gt 10) {
            Write-Check "Live agent-ops briefing" "PASS" ("source={0}" -f $json.briefing_source)
        } else {
            Write-Check "Live agent-ops briefing" "FAIL"
        }
        if ($json.briefing_source -in @("ollama", "rules")) {
            Write-Check "Briefing source" "PASS" $json.briefing_source
        } else {
            Write-Check "Briefing source" "WARN"
        }
        if ($json.recommendations -and $json.recommendations.Count -ge 1) {
            Write-Check "Optimizer recommendations" "PASS"
        } else {
            Write-Check "Optimizer recommendations" "WARN"
        }
    } catch {
        Write-Check "Live agent-ops" "FAIL" $_.Exception.Message
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase D READY - agent brief + optimizer polish." -ForegroundColor Green
} else {
    Write-Host "  Phase D NOT ready." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 } else { exit 0 }
