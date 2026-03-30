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

function Login($u, $p) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $body = @{ username = $u; password = $p } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/auth/login' -WebSession $s -ContentType 'application/json; charset=utf-8' -Body $body
  } catch {
    $detail = Read-ErrorBody $_.Exception
    throw "Login failed for '$u'. $detail"
  }
  return @{ session = $s; user = $r.data.user }
}

function AskAi($session, $sessionId, $message) {
  try {
    return Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/ai' -WebSession $session -ContentType 'application/json; charset=utf-8' -Body (@{
      sessionId = $sessionId
      message = $message
    } | ConvertTo-Json)
  } catch {
    $detail = Read-ErrorBody $_.Exception
    throw "AskAi failed. $detail"
  }
}

$manager = Login 'manager' 'manager123'
$admin = Login 'admin' 'admin123'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$sessionId = "verify-orchestrator-gemini-$ts"

$primaryQuery = "list latest usd vnd fx rate records from fxrate table token $ts"
$primary = AskAi $admin.session $sessionId $primaryQuery

$secondaryQuery = "show average usd vnd fx_rate in current month token $ts"
$secondary = AskAi $admin.session $sessionId $secondaryQuery

$citationSources1 = @()
if ($null -ne $primary.data.citations) { $citationSources1 = $primary.data.citations | ForEach-Object { $_.source } }
$citationSources2 = @()
if ($null -ne $secondary.data.citations) { $citationSources2 = $secondary.data.citations | ForEach-Object { $_.source } }

$primaryPass = ($primary.data.routeUsed -eq 'TEXT2SQL') -and ($null -ne $primary.data.relatedData.sql) -and ([string]$primary.data.relatedData.sql -match '(?i)^\s*select\s')
$secondaryPass = ($secondary.data.routeUsed -eq 'TEXT2SQL') -and ($null -ne $secondary.data.relatedData.sql) -and ([string]$secondary.data.relatedData.sql -match '(?i)^\s*select\s')

$summary = [ordered]@{
  primary = [ordered]@{
    routeUsed = $primary.data.routeUsed
    policyKey = $primary.data.policyKey
    answer = $primary.data.answer
    hasSql = ($null -ne $primary.data.relatedData.sql)
    sql = $primary.data.relatedData.sql
    sqlLooksSelect = if ($primary.data.relatedData.sql) { ([string]$primary.data.relatedData.sql -match '(?i)^\s*select\s') } else { $false }
    text2sqlError = $primary.data.relatedData.text2sqlError
    text2sqlErrorCode = $primary.data.relatedData.text2sqlErrorCode
    citationSources = $citationSources1
    pass = $primaryPass
  }
  secondary = [ordered]@{
    routeUsed = $secondary.data.routeUsed
    policyKey = $secondary.data.policyKey
    answer = $secondary.data.answer
    hasSql = ($null -ne $secondary.data.relatedData.sql)
    sql = $secondary.data.relatedData.sql
    sqlLooksSelect = if ($secondary.data.relatedData.sql) { ([string]$secondary.data.relatedData.sql -match '(?i)^\s*select\s') } else { $false }
    text2sqlError = $secondary.data.relatedData.text2sqlError
    text2sqlErrorCode = $secondary.data.relatedData.text2sqlErrorCode
    citationSources = $citationSources2
    pass = $secondaryPass
  }
  pass = ($primaryPass -or $secondaryPass)
}

$summary | ConvertTo-Json -Depth 8

if (-not $summary.pass) {
  throw 'Chat-orchestrator Gemini verification failed (no TEXT2SQL+SQL evidence from tested prompts).'
}
