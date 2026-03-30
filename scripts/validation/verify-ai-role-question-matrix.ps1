param(
  [switch]$Smoke,
  [switch]$Strict
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

  try {
    $r = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/auth/login' -WebSession $s -ContentType 'application/json; charset=utf-8' -Body $body
  } catch {
    $detail = Read-ErrorBody $_.Exception
    throw "Login failed for '$u'. $detail"
  }

  $authCookie = ($s.Cookies.GetCookies('http://localhost:3001') | Where-Object { $_.Name -eq 'budget-app-token' } | Select-Object -First 1)
  if (-not $authCookie) {
    throw "Login did not issue budget-app-token cookie for '$u'"
  }

  return @{ session = $s; token = $authCookie.Value; user = $r.data.user; role = $role }
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

function UploadKnowledgeDocument($token, $filePath) {
  $headers = @("-H", "Cookie: budget-app-token=$token")
  $args = @(
    '-s',
    '-X', 'POST',
    'http://localhost:3001/api/ai/knowledge/documents',
    '-F', "file=@$filePath"
  ) + $headers

  $raw = & curl.exe @args

  try {
    $payload = $raw | ConvertFrom-Json
  } catch {
    return [pscustomobject]@{
      ok = $false
      status = 0
      raw = $raw
      payload = $null
    }
  }

  if ($payload.error) {
    $statusCode = if ($payload.error.code) {
      switch ($payload.error.code) {
        'FORBIDDEN' { 403 }
        'UNAUTHORIZED' { 401 }
        default { 400 }
      }
    } else { 400 }

    return [pscustomobject]@{
      ok = $false
      status = $statusCode
      raw = $raw
      payload = $payload
    }
  }

  return [pscustomobject]@{
    ok = $true
    status = 201
    raw = $raw
    payload = $payload
  }
}

function Merge-ExpectedByRole($question, $role) {
  $star = $null
  $specific = $null

  if ($question.expectedByRole.PSObject.Properties.Name -contains '*') {
    $star = $question.expectedByRole.'*'
  }
  if ($question.expectedByRole.PSObject.Properties.Name -contains $role) {
    $specific = $question.expectedByRole.$role
  }

  $merged = [ordered]@{}

  if ($null -ne $star) {
    foreach ($p in $star.PSObject.Properties) {
      $merged[$p.Name] = $p.Value
    }
  }
  if ($null -ne $specific) {
    foreach ($p in $specific.PSObject.Properties) {
      $merged[$p.Name] = $p.Value
    }
  }

  return [pscustomobject]$merged
}

function Replace-Tokens([string]$text, $map) {
  $result = $text
  foreach ($k in $map.Keys) {
    $result = $result.Replace($k, [string]$map[$k])
  }
  return $result
}

function To-StringArray($value) {
  if ($null -eq $value) { return @() }
  if ($value -is [System.Array]) {
    return @($value | ForEach-Object { [string]$_ })
  }
  return @([string]$value)
}

$strictMode = $Strict.IsPresent

$questionBankPath = Join-Path $PSScriptRoot 'ai-question-bank.json'
if (-not (Test-Path $questionBankPath)) {
  throw "Question bank not found: $questionBankPath"
}

$bank = Get-Content -Path $questionBankPath -Raw | ConvertFrom-Json

$roles = @($bank.roles | ForEach-Object { [string]$_ })
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$sessionPrefix = "ai-role-matrix-$ts"

$outDir = Join-Path $PSScriptRoot '.tmp'
if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$kbToken = "KB-$ts"
$kbFileName = "kb-role-matrix-$ts.txt"
$kbFilePath = Join-Path $outDir $kbFileName
$kbDocContent = @"
TÀI LIỆU QUY TRÌNH NỘI BỘ TOKEN: $kbToken
Bước 1: Nhân viên tạo đề xuất chi phí và đính kèm chứng từ.
Bước 2: Quản lý kiểm tra và phê duyệt đề xuất nếu hợp lệ.
Bước 3: Kế toán thực hiện hạch toán và theo dõi số liệu.
"@
$kbDocContent | Set-Content -Path $kbFilePath -Encoding UTF8

$roleSessions = [ordered]@{}
$credentials = [ordered]@{
  EMPLOYEE = @{ u = 'employee'; p = 'employee123' }
  MANAGER = @{ u = 'manager'; p = 'manager123' }
  ACCOUNTANT = @{ u = 'accountant'; p = 'accountant123' }
  FINANCE_ADMIN = @{ u = 'admin'; p = 'admin123' }
  AUDITOR = @{ u = 'auditor'; p = 'auditor123' }
}

foreach ($role in $roles) {
  $cred = $credentials[$role]
  if ($null -eq $cred) {
    throw "Missing credential mapping for role: $role"
  }
  $roleSessions[$role] = Login $cred.u $cred.p $role
}

$adminSession = $roleSessions['FINANCE_ADMIN']

$kbUploadByAdmin = UploadKnowledgeDocument $adminSession.token $kbFilePath
if (-not $kbUploadByAdmin.ok) {
  throw "KB upload by FINANCE_ADMIN failed. $($kbUploadByAdmin.raw)"
}

$kbDocumentId = $kbUploadByAdmin.payload.data.document.id

$kbUploadChecks = @()
$kbUploadChecks += [pscustomobject]@{
  role = 'FINANCE_ADMIN'
  expected = 'ALLOW'
  actual = if ($kbUploadByAdmin.ok) { 'ALLOW' } else { 'DENY' }
  status = $kbUploadByAdmin.status
  pass = $kbUploadByAdmin.ok
}

foreach ($role in @('EMPLOYEE', 'MANAGER', 'ACCOUNTANT', 'AUDITOR')) {
  $attempt = UploadKnowledgeDocument $roleSessions[$role].token $kbFilePath
  $isDenied = (-not $attempt.ok) -and ($attempt.status -eq 403)
  $kbUploadChecks += [pscustomobject]@{
    role = $role
    expected = 'DENY_403'
    actual = if ($attempt.ok) { 'ALLOW' } else { "DENY_$($attempt.status)" }
    status = $attempt.status
    pass = $isDenied
  }
}

$enforceKbAdminOnly = $false

$filteredQuestions = @($bank.questions)
if ($Smoke.IsPresent) {
  $filteredQuestions = @($filteredQuestions | Where-Object { $_.smoke -eq $true })
}

$results = @()

foreach ($question in $filteredQuestions) {
  $appliesToRoles = @($question.appliesToRoles | ForEach-Object { [string]$_ })

  foreach ($role in $roles) {
    if ($appliesToRoles -notcontains $role) {
      continue
    }

    $tokenMap = @{
      '{{TS_TOKEN}}' = $ts
      '{{KB_TOKEN}}' = $kbToken
      '{{KB_FILENAME}}' = $kbFileName
    }

    $resolvedPrompt = Replace-Tokens ([string]$question.prompt) $tokenMap
    $expected = Merge-ExpectedByRole $question $role
    $resp = AskAi $roleSessions[$role].session "$sessionPrefix-$role" $resolvedPrompt

    $data = $resp.data
    $routeUsed = [string]$data.routeUsed
    $policyKey = [string]$data.policyKey
    $dataDomain = [string]$data.dataDomain
    $scopeApplied = [string]$data.scopeApplied
    $answer = [string]$data.answer
    $sql = if ($null -ne $data.relatedData) { [string]$data.relatedData.sql } else { $null }

    $citationSources = @()
    if ($null -ne $data.citations) {
      $citationSources = @($data.citations | ForEach-Object { [string]$_.source })
    }

    $failureReasons = @()

    $allowedRoutes = To-StringArray $expected.allowedRoutes
    if ($allowedRoutes.Count -gt 0 -and ($allowedRoutes -notcontains $routeUsed)) {
      $failureReasons += "routeUsed '$routeUsed' not in expected allowedRoutes [$($allowedRoutes -join ', ')]"
    }

    if ($expected.PSObject.Properties.Name -contains 'policyKey') {
      $expectedPolicy = [string]$expected.policyKey
      if ($expectedPolicy -and $policyKey -ne $expectedPolicy) {
        $failureReasons += "policyKey '$policyKey' != expected '$expectedPolicy'"
      }
    }

    if ($expected.PSObject.Properties.Name -contains 'dataDomain') {
      $expectedDomain = [string]$expected.dataDomain
      if ($expectedDomain -and $dataDomain -ne $expectedDomain) {
        $failureReasons += "dataDomain '$dataDomain' != expected '$expectedDomain'"
      }
    }

    if ($expected.PSObject.Properties.Name -contains 'scopeApplied') {
      $expectedScope = [string]$expected.scopeApplied
      if ($expectedScope -and $scopeApplied -ne $expectedScope) {
        $failureReasons += "scopeApplied '$scopeApplied' != expected '$expectedScope'"
      }
    }

    if ($question.assertions.requireNonEmptyAnswer -eq $true -and [string]::IsNullOrWhiteSpace($answer)) {
      $failureReasons += 'answer is empty'
    }

    if ($question.assertions.requireCitations -eq $true -and $citationSources.Count -eq 0) {
      $failureReasons += 'citations are empty'
    }

    $requiredSqlRoles = To-StringArray $question.assertions.requireSqlSelectForRoles
    if ($requiredSqlRoles -contains $role) {
      if ([string]::IsNullOrWhiteSpace($sql)) {
        $failureReasons += 'relatedData.sql is missing'
      } elseif ($sql -notmatch '(?i)^\s*select\s') {
        $failureReasons += "relatedData.sql is not SELECT: $sql"
      }
    }

    $answerContainsAny = To-StringArray $question.assertions.answerContainsAny
    if ($answerContainsAny.Count -gt 0) {
      $matched = $false
      foreach ($needle in $answerContainsAny) {
        if (-not [string]::IsNullOrWhiteSpace($needle) -and $answer -match [regex]::Escape($needle)) {
          $matched = $true
          break
        }
      }
      if (-not $matched) {
        $failureReasons += "answer does not contain any expected keywords [$($answerContainsAny -join ', ')]"
      }
    }

    $citationContainsAny = To-StringArray $question.assertions.citationSourceIncludesAny
    if ($citationContainsAny.Count -gt 0) {
      $resolvedCitationChecks = @($citationContainsAny | ForEach-Object { Replace-Tokens ([string]$_) $tokenMap })
      $matchedCitation = $false
      foreach ($source in $citationSources) {
        foreach ($needle in $resolvedCitationChecks) {
          if ($source -like "*$needle*") {
            $matchedCitation = $true
            break
          }
        }
        if ($matchedCitation) { break }
      }
      if (-not $matchedCitation) {
        $failureReasons += "citation source does not include expected tokens [$($resolvedCitationChecks -join ', ')]"
      }
    }

    $pass = ($failureReasons.Count -eq 0)

    $results += [pscustomobject]@{
      id = [string]$question.id
      category = [string]$question.category
      severity = [string]$question.severity
      role = $role
      prompt = $resolvedPrompt
      expected = $expected
      actual = [ordered]@{
        routeUsed = $routeUsed
        policyKey = $policyKey
        dataDomain = $dataDomain
        scopeApplied = $scopeApplied
        answer = $answer
        sql = $sql
        citationSources = $citationSources
        text2sqlError = if ($null -ne $data.relatedData) { $data.relatedData.text2sqlError } else { $null }
        text2sqlErrorCode = if ($null -ne $data.relatedData) { $data.relatedData.text2sqlErrorCode } else { $null }
      }
      pass = $pass
      failureReasons = $failureReasons
    }
  }
}

$requiredFailures = @($results | Where-Object { $_.severity -eq 'required' -and -not $_.pass })
$informationalFailures = @($results | Where-Object { $_.severity -eq 'informational' -and -not $_.pass })

$roleStats = [ordered]@{}
foreach ($role in $roles) {
  $roleRows = @($results | Where-Object { $_.role -eq $role })
  $roleStats[$role] = [ordered]@{
    total = $roleRows.Count
    passed = (@($roleRows | Where-Object { $_.pass })).Count
    failed = (@($roleRows | Where-Object { -not $_.pass })).Count
  }
}

$categoryStats = [ordered]@{}
foreach ($cat in @($bank.categories | ForEach-Object { [string]$_ })) {
  $catRows = @($results | Where-Object { $_.category -eq $cat })
  $categoryStats[$cat] = [ordered]@{
    total = $catRows.Count
    passed = (@($catRows | Where-Object { $_.pass })).Count
    failed = (@($catRows | Where-Object { -not $_.pass })).Count
  }
}

$summary = [ordered]@{
  meta = [ordered]@{
    script = 'verify-ai-role-question-matrix.ps1'
    version = [string]$bank.version
    smoke = $Smoke.IsPresent
    strict = $strictMode
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
  }
  setup = [ordered]@{
    sessionPrefix = $sessionPrefix
    kbToken = $kbToken
    kbFileName = $kbFileName
    kbDocumentId = $kbDocumentId
  }
  uploadAuthChecks = $kbUploadChecks
  results = $results
  roleStats = $roleStats
  categoryStats = $categoryStats
  overall = [ordered]@{
    total = $results.Count
    passed = (@($results | Where-Object { $_.pass })).Count
    failed = (@($results | Where-Object { -not $_.pass })).Count
    requiredFailed = $requiredFailures.Count
    informationalFailed = $informationalFailures.Count
    pass = ($requiredFailures.Count -eq 0 -and (-not $strictMode -or $informationalFailures.Count -eq 0) -and (-not $enforceKbAdminOnly -or (@($kbUploadChecks | Where-Object { -not $_.pass })).Count -eq 0))
  }
}

$summaryPath = Join-Path $outDir "ai-role-question-matrix-summary-$ts.json"
$summary | ConvertTo-Json -Depth 12 | Tee-Object -FilePath $summaryPath

if (-not $summary.overall.pass) {
  throw "AI role question matrix verification failed. Summary: $summaryPath"
}
