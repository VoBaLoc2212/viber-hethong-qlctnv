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

function SafeApiCall($scriptBlock, $label) {
  try {
    return & $scriptBlock
  } catch {
    $detail = Read-ErrorBody $_.Exception
    throw "$label failed. $detail"
  }
}

$admin = Login 'admin' 'admin123'
$employee = Login 'employee' 'employee123'
$manager = Login 'manager' 'manager123'

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$sessionId = "verify-ai-routes-$ts"
$deptCode = "VR$ts"

$department = SafeApiCall {
  Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/departments' -WebSession $admin.session -ContentType 'application/json; charset=utf-8' -Body (@{
    name = "Verify Routes $ts"
    code = $deptCode
    budgetAllocated = 5000000
  } | ConvertTo-Json)
} 'Create department'

$period = (Get-Date).ToUniversalTime().ToString('yyyy-MM')
$budget = SafeApiCall {
  Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/budgets' -WebSession $admin.session -ContentType 'application/json; charset=utf-8' -Body (@{
    departmentId = $department.data.id
    period = $period
    amount = '3000000.00'
  } | ConvertTo-Json)
} 'Create budget'

$null = SafeApiCall {
  Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/transactions' -WebSession $employee.session -ContentType 'application/json; charset=utf-8' -Body (@{
    type = 'EXPENSE'
    amount = '250000.00'
    budgetId = $budget.data.id
    departmentId = $department.data.id
    description = "verify-ai-routes-expense-$ts"
  } | ConvertTo-Json)
} 'Create transaction #1'

$null = SafeApiCall {
  Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/transactions' -WebSession $employee.session -ContentType 'application/json; charset=utf-8' -Body (@{
    type = 'EXPENSE'
    amount = '180000.00'
    budgetId = $budget.data.id
    departmentId = $department.data.id
    description = "verify-ai-routes-expense-2-$ts"
  } | ConvertTo-Json)
} 'Create transaction #2'

$ragQuestion = 'Quy trình phê duyệt chi phí gồm những bước nào?'
$text2SqlQuestion = "list latest usd vnd fx rate records from fxrate table token $ts"
$altText2SqlQuestion = "show average usd vnd fx_rate in current month token $ts"

$rag = AskAi $manager.session $sessionId $ragQuestion
$text2sql = AskAi $admin.session $sessionId $text2SqlQuestion
$altText2sql = AskAi $admin.session $sessionId $altText2SqlQuestion

$ragPass = ($rag.data.routeUsed -eq 'RAG') -and (($rag.data.citations | Measure-Object).Count -gt 0)
$text2sqlPass = ($text2sql.data.routeUsed -eq 'TEXT2SQL') -and ($null -ne $text2sql.data.relatedData.sql) -and ([string]$text2sql.data.relatedData.sql -match '(?i)^\s*select\s')
$altText2sqlPass = ($altText2sql.data.routeUsed -eq 'TEXT2SQL') -and ($null -ne $altText2sql.data.relatedData.sql) -and ([string]$altText2sql.data.relatedData.sql -match '(?i)^\s*select\s')

$summary = [ordered]@{
  setup = [ordered]@{
    departmentId = $department.data.id
    budgetId = $budget.data.id
    period = $period
    departmentCode = $deptCode
  }
  rag = [ordered]@{
    routeUsed = $rag.data.routeUsed
    policyKey = $rag.data.policyKey
    citationCount = ($rag.data.citations | Measure-Object).Count
    pass = $ragPass
  }
  text2sqlPrimary = [ordered]@{
    routeUsed = $text2sql.data.routeUsed
    policyKey = $text2sql.data.policyKey
    hasSql = ($null -ne $text2sql.data.relatedData.sql)
    sqlPreview = if ($text2sql.data.relatedData.sql) { [string]$text2sql.data.relatedData.sql } else { $null }
    rowCount = if ($null -ne $text2sql.data.relatedData.rows) { ($text2sql.data.relatedData.rows | Measure-Object).Count } else { 0 }
    text2sqlError = $text2sql.data.relatedData.text2sqlError
    text2sqlErrorCode = $text2sql.data.relatedData.text2sqlErrorCode
    pass = $text2sqlPass
  }
  text2sqlAlternative = [ordered]@{
    routeUsed = $altText2sql.data.routeUsed
    policyKey = $altText2sql.data.policyKey
    hasSql = ($null -ne $altText2sql.data.relatedData.sql)
    sqlPreview = if ($altText2sql.data.relatedData.sql) { [string]$altText2sql.data.relatedData.sql } else { $null }
    rowCount = if ($null -ne $altText2sql.data.relatedData.rows) { ($altText2sql.data.relatedData.rows | Measure-Object).Count } else { 0 }
    text2sqlError = $altText2sql.data.relatedData.text2sqlError
    text2sqlErrorCode = $altText2sql.data.relatedData.text2sqlErrorCode
    pass = $altText2sqlPass
  }
  pass = ($ragPass -and ($text2sqlPass -or $altText2sqlPass))
}

$summary | ConvertTo-Json -Depth 10

if (-not $summary.pass) {
  throw 'RAG/TEXT2SQL route verification failed (RAG failed or no TEXT2SQL+SQL evidence from tested prompts).'
}
