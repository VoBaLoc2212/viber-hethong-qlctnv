param(
  [switch]$Smoke
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Read-ErrorBody($ex) {
  try {
    if ($null -ne $ex.Response -and $null -ne $ex.Response.GetResponseStream()) {
      $reader = New-Object System.IO.StreamReader($ex.Response.GetResponseStream())
      return $reader.ReadToEnd()
    }
  } catch {}
  return $null
}

function SafeApiCall($scriptBlock, $label) {
  try {
    return & $scriptBlock
  } catch {
    $detail = Read-ErrorBody $_.Exception
    throw "$label failed. $detail"
  }
}

function Login($u, $p, $role) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $body = @{ username = $u; password = $p } | ConvertTo-Json

  $r = SafeApiCall {
    Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/auth/login' -WebSession $s -ContentType 'application/json; charset=utf-8' -Body $body
  } "Login '$u'"

  return @{ role = $role; session = $s; user = $r.data.user }
}

function AskAi($session, $sessionId, $message) {
  return SafeApiCall {
    Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/ai' -WebSession $session -ContentType 'application/json; charset=utf-8' -Body (@{
      sessionId = $sessionId
      message = $message
    } | ConvertTo-Json)
  } "AskAi"
}

function GetSessionMessages($session, $sessionId) {
  return SafeApiCall {
    Invoke-RestMethod -Method Get -Uri "http://localhost:3001/api/ai/sessions?id=$sessionId" -WebSession $session
  } "Get session messages"
}

function Ensure-Contract($payload, $requireSqlSelect) {
  $errors = @()

  if ($null -eq $payload -or $null -eq $payload.data) {
    $errors += 'response.data is missing'
    return $errors
  }

  $data = $payload.data

  if ([string]::IsNullOrWhiteSpace([string]$data.answer)) {
    $errors += 'data.answer is empty'
  }

  if ([string]::IsNullOrWhiteSpace([string]$data.routeUsed)) {
    $errors += 'data.routeUsed is empty'
  }

  if ([string]::IsNullOrWhiteSpace([string]$data.policyKey)) {
    $errors += 'data.policyKey is empty'
  }

  if ([string]::IsNullOrWhiteSpace([string]$data.dataDomain)) {
    $errors += 'data.dataDomain is empty'
  }

  if ([string]::IsNullOrWhiteSpace([string]$data.scopeApplied)) {
    $errors += 'data.scopeApplied is empty'
  }

  if ($requireSqlSelect) {
    $sql = [string]$data.relatedData.sql
    if ([string]::IsNullOrWhiteSpace($sql)) {
      $errors += 'required SQL is missing in relatedData.sql'
    } elseif ($sql -notmatch '(?i)^\s*select\s') {
      $errors += "relatedData.sql is not SELECT: $sql"
    }
  }

  return $errors
}

function Add-ScenarioResult([System.Collections.ArrayList]$results, [string]$name, [bool]$pass, $details, [string[]]$failureReasons) {
  $null = $results.Add([pscustomobject]@{
    name = $name
    pass = $pass
    failureReasons = $failureReasons
    details = $details
  })
}

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$sessionBase = "ctx-history-cache-$ts"

$employee = Login 'employee' 'employee123' 'EMPLOYEE'
$manager = Login 'manager' 'manager123' 'MANAGER'
$accountant = Login 'accountant' 'accountant123' 'ACCOUNTANT'
$admin = Login 'admin' 'admin123' 'FINANCE_ADMIN'

$results = New-Object System.Collections.ArrayList

# Scenario 1: Contract + route/policy stability for repeated TEXT2SQL-like prompt (cache consistency baseline)
$promptFx = "list latest usd vnd fx rate records from fxrate table context-token $ts"
$sidAdminInput = "$sessionBase-admin-cache"
$adminFirst = AskAi $admin.session $sidAdminInput $promptFx
$sidAdmin = [string]$adminFirst.data.sessionId
$adminSecond = AskAi $admin.session $sidAdmin $promptFx

$failures1 = @()
$failures1 += Ensure-Contract $adminFirst $true
$failures1 += Ensure-Contract $adminSecond $true

if ($adminFirst.data.routeUsed -ne $adminSecond.data.routeUsed) {
  $failures1 += "routeUsed changed between repeated calls: '$($adminFirst.data.routeUsed)' -> '$($adminSecond.data.routeUsed)'"
}
if ($adminFirst.data.policyKey -ne $adminSecond.data.policyKey) {
  $failures1 += "policyKey changed between repeated calls: '$($adminFirst.data.policyKey)' -> '$($adminSecond.data.policyKey)'"
}
if ($adminFirst.data.dataDomain -ne $adminSecond.data.dataDomain) {
  $failures1 += "dataDomain changed between repeated calls: '$($adminFirst.data.dataDomain)' -> '$($adminSecond.data.dataDomain)'"
}

$pass1 = ($failures1.Count -eq 0)
Add-ScenarioResult $results 'cache-consistency-text2sql-admin' $pass1 ([ordered]@{
  first = [ordered]@{
    routeUsed = $adminFirst.data.routeUsed
    policyKey = $adminFirst.data.policyKey
    dataDomain = $adminFirst.data.dataDomain
    scopeApplied = $adminFirst.data.scopeApplied
    sql = $adminFirst.data.relatedData.sql
  }
  second = [ordered]@{
    routeUsed = $adminSecond.data.routeUsed
    policyKey = $adminSecond.data.policyKey
    dataDomain = $adminSecond.data.dataDomain
    scopeApplied = $adminSecond.data.scopeApplied
    sql = $adminSecond.data.relatedData.sql
  }
}) $failures1

# Scenario 2: Role isolation on same prompt (admin vs manager)
$sidManagerInput = "$sessionBase-manager-role"
$managerFx = AskAi $manager.session $sidManagerInput $promptFx

$failures2 = @()
$failures2 += Ensure-Contract $managerFx $false

if ($adminFirst.data.routeUsed -eq 'TEXT2SQL' -and $managerFx.data.routeUsed -eq 'TEXT2SQL') {
  $failures2 += 'role isolation violated: manager unexpectedly reached TEXT2SQL for fx-management prompt'
}
if ($managerFx.data.policyKey -ne 'fx-management') {
  $failures2 += "unexpected manager policyKey for fx prompt: '$($managerFx.data.policyKey)'"
}

$pass2 = ($failures2.Count -eq 0)
Add-ScenarioResult $results 'role-isolation-fx-admin-vs-manager' $pass2 ([ordered]@{
  admin = [ordered]@{ routeUsed = $adminFirst.data.routeUsed; policyKey = $adminFirst.data.policyKey; dataDomain = $adminFirst.data.dataDomain }
  manager = [ordered]@{ routeUsed = $managerFx.data.routeUsed; policyKey = $managerFx.data.policyKey; dataDomain = $managerFx.data.dataDomain }
}) $failures2

# Scenario 3: Multi-turn history continuity in same session
$sidHistoryInput = "$sessionBase-history"
$h1 = AskAi $manager.session $sidHistoryInput "Có bao nhiêu giao dịch gần đây?"
$sidHistory = [string]$h1.data.sessionId
$h2 = AskAi $manager.session $sidHistory "Còn ngân sách thì sao?"
$msgs = GetSessionMessages $manager.session $sidHistory

$failures3 = @()
$failures3 += Ensure-Contract $h1 $false
$failures3 += Ensure-Contract $h2 $false

$historyContextWeak = ($h2.data.policyKey -eq 'generic')

$messageCount = if ($msgs.data.messages) { @($msgs.data.messages).Count } else { 0 }
if ($messageCount -lt 4) {
  $failures3 += "expected at least 4 messages persisted in history, got $messageCount"
}

$pass3 = ($failures3.Count -eq 0)
Add-ScenarioResult $results 'history-continuity-same-session' $pass3 ([ordered]@{
  first = [ordered]@{ routeUsed = $h1.data.routeUsed; policyKey = $h1.data.policyKey; answer = $h1.data.answer }
  followUp = [ordered]@{ routeUsed = $h2.data.routeUsed; policyKey = $h2.data.policyKey; answer = $h2.data.answer }
  messageCount = $messageCount
  warning = if ($historyContextWeak) { 'follow-up appears generic; possible context carry-over weakness' } else { $null }
}) $failures3

# Scenario 4: Cross-session isolation (same user, same follow-up text, different new session)
$sidAInput = "$sessionBase-isolation-a"
$sidBInput = "$sessionBase-isolation-b"

$seedA = AskAi $manager.session $sidAInput "Có bao nhiêu giao dịch gần đây?"
$sidA = [string]$seedA.data.sessionId
$isolatedFollowA = AskAi $manager.session $sidA "Còn ngân sách thì sao?"
$seedB = AskAi $manager.session $sidBInput "Câu này để khởi tạo session mới"
$sidB = [string]$seedB.data.sessionId
$isolatedFollowB = AskAi $manager.session $sidB "Còn ngân sách thì sao?"

$failures4 = @()
$failures4 += Ensure-Contract $isolatedFollowA $false
$failures4 += Ensure-Contract $isolatedFollowB $false

if ([string]::IsNullOrWhiteSpace([string]$isolatedFollowA.data.answer) -or [string]::IsNullOrWhiteSpace([string]$isolatedFollowB.data.answer)) {
  $failures4 += 'cross-session response contains empty answer'
}

$pass4 = ($failures4.Count -eq 0)
Add-ScenarioResult $results 'cross-session-isolation-followup' $pass4 ([ordered]@{
  sessionA = [ordered]@{ routeUsed = $isolatedFollowA.data.routeUsed; policyKey = $isolatedFollowA.data.policyKey; answer = $isolatedFollowA.data.answer }
  sessionB = [ordered]@{ routeUsed = $isolatedFollowB.data.routeUsed; policyKey = $isolatedFollowB.data.policyKey; answer = $isolatedFollowB.data.answer }
}) $failures4

# Scenario 5: Input/Output contract consistency across roles for same business question
$sharedQuestion = "Tổng chi tổng thu số dư hiện tại"
$rolesToCheck = @(
  @{ name = 'EMPLOYEE'; session = $employee.session },
  @{ name = 'MANAGER'; session = $manager.session },
  @{ name = 'ACCOUNTANT'; session = $accountant.session },
  @{ name = 'FINANCE_ADMIN'; session = $admin.session }
)

$roleContracts = @()
$failures5 = @()

foreach ($r in $rolesToCheck) {
  $sidContractInput = "$sessionBase-contract-$($r.name.ToLower())"
  $resp = AskAi $r.session $sidContractInput $sharedQuestion
  $errs = Ensure-Contract $resp $false
  if ($errs.Count -gt 0) {
    $failures5 += @($errs | ForEach-Object { "[$($r.name)] $_" })
  }

  $roleContracts += [pscustomobject]@{
    role = $r.name
    routeUsed = $resp.data.routeUsed
    policyKey = $resp.data.policyKey
    dataDomain = $resp.data.dataDomain
    scopeApplied = $resp.data.scopeApplied
    answer = $resp.data.answer
  }
}

$pass5 = ($failures5.Count -eq 0)
Add-ScenarioResult $results 'io-contract-cross-role' $pass5 $roleContracts $failures5

if ($Smoke.IsPresent) {
  $results = @($results | Where-Object { $_.name -in @(
    'cache-consistency-text2sql-admin',
    'role-isolation-fx-admin-vs-manager',
    'history-continuity-same-session'
  ) })
}

$failed = @($results | Where-Object { -not $_.pass })

$summary = [ordered]@{
  meta = [ordered]@{
    script = 'verify-ai-context-history-cache.ps1'
    smoke = $Smoke.IsPresent
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
    sessionBase = $sessionBase
  }
  scenarios = @($results | ForEach-Object { $_.name })
  results = $results
  overall = [ordered]@{
    total = $results.Count
    passed = (@($results | Where-Object { $_.pass })).Count
    failed = $failed.Count
    pass = ($failed.Count -eq 0)
  }
}

$outDir = Join-Path $PSScriptRoot '.tmp'
if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}
$summaryPath = Join-Path $outDir "ai-context-history-cache-summary-$ts.json"

$summary | ConvertTo-Json -Depth 12 | Tee-Object -FilePath $summaryPath

if (-not $summary.overall.pass) {
  throw "AI context/history/cache validation failed. Summary: $summaryPath"
}
