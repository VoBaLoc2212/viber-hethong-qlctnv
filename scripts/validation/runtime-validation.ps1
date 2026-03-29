$ErrorActionPreference = 'Stop'

$outDir = 'F:\viber-hethong-qlctnv\scripts\validation\.tmp'
if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$cleanupScript = 'npm --prefix "F:/viber-hethong-qlctnv" run validation:cleanup-runtime'
trap {
  Write-Host "Runtime validation error: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Failed at line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Red
  Invoke-Expression $cleanupScript | Out-Null
  throw
}

Invoke-Expression $cleanupScript | Out-Null

function Login($u, $p) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $body = @{ username = $u; password = $p } | ConvertTo-Json
  $r = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/auth/login' -WebSession $s -ContentType 'application/json' -Body $body

  $authCookie = ($s.Cookies.GetCookies('http://localhost:3001') | Where-Object { $_.Name -eq 'budget-app-token' } | Select-Object -First 1)
  if (-not $authCookie) {
    throw 'Login did not issue budget-app-token cookie'
  }

  return @{ session = $s; user = $r.data.user; token = $authCookie.Value }
}

function UploadAttachment($token, $filePath) {
  $cookieHeader = "budget-app-token=$token"
  $json = & curl.exe -s -X POST 'http://localhost:3001/api/transactions/attachments' -H "Cookie: $cookieHeader" -F "file=@$filePath;type=text/plain"

  try {
    $payload = $json | ConvertFrom-Json
  } catch {
    return [pscustomobject]@{
      ok = $false
      status = 'INVALID_RESPONSE'
      raw = $json
    }
  }

  if ($payload.error) {
    return [pscustomobject]@{
      ok = $false
      status = 'ERROR'
      raw = $json
    }
  }

  return [pscustomobject]@{
    ok = $true
    data = $payload.data
  }
}

function AskAi($session, $sessionId, $message) {
  try {
    return Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/ai' -WebSession $session -ContentType 'application/json' -Body (@{
      sessionId = $sessionId
      message = $message
    } | ConvertTo-Json)
  } catch {
    return [pscustomobject]@{
      data = [pscustomobject]@{
        routeUsed = 'ERROR'
        answer = $null
        relatedData = [pscustomobject]@{}
      }
      error = $_.Exception.Message
    }
  }
}

$admin = Login 'admin' 'admin123'
$manager = Login 'manager' 'manager123'
$accountant = Login 'accountant' 'accountant123'
$employee = Login 'employee' 'employee123'

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$deptCode = 'RV' + $ts

$dep = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/departments' -WebSession $admin.session -ContentType 'application/json' -Body (@{
  name = 'Runtime Validation Dept'
  code = $deptCode
  budgetAllocated = 10000000
} | ConvertTo-Json)
$depId = $dep.data.id

$b1 = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/budgets' -WebSession $admin.session -ContentType 'application/json' -Body (@{
  departmentId = $depId
  period = '2099-01'
  amount = '1000000.00'
} | ConvertTo-Json)
$b2 = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/budgets' -WebSession $admin.session -ContentType 'application/json' -Body (@{
  departmentId = $depId
  period = '2099-02'
  amount = '500000.00'
} | ConvertTo-Json)

$b1Id = $b1.data.id
$b2Id = $b2.data.id

$statusBefore = Invoke-RestMethod -Method Get -Uri ("http://localhost:3001/api/budgets/$b1Id/status") -WebSession $admin.session
$headers = @{ 'idempotency-key' = 'rv-transfer-1' }
$t1 = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/budgets/$b1Id/transfer") -WebSession $admin.session -Headers $headers -ContentType 'application/json' -Body (@{
  toBudgetId = $b2Id
  amount = '100000.00'
  reason = 'runtime-validation'
} | ConvertTo-Json)
$t2 = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/budgets/$b1Id/transfer") -WebSession $admin.session -Headers $headers -ContentType 'application/json' -Body (@{
  toBudgetId = $b2Id
  amount = '100000.00'
  reason = 'runtime-validation'
} | ConvertTo-Json)
$statusAfter = Invoke-RestMethod -Method Get -Uri ("http://localhost:3001/api/budgets/$b1Id/status") -WebSession $admin.session

$tx1 = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/transactions' -WebSession $employee.session -ContentType 'application/json' -Body (@{
  type = 'EXPENSE'
  amount = '200000.00'
  budgetId = $b1Id
  departmentId = $depId
  description = 'rv-approval-path-a'
} | ConvertTo-Json)

$approvals = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/approvals' -WebSession $manager.session
$ap1 = $approvals.data.approvals | Where-Object { $_.transactionId -eq $tx1.data.id } | Select-Object -First 1
if (-not $ap1) { throw 'Approval not found for tx1' }

$null = Invoke-RestMethod -Method Patch -Uri ("http://localhost:3001/api/approvals/$($ap1.id)") -WebSession $manager.session -ContentType 'application/json' -Body (@{ action = 'approve'; note = 'rv manager approve A' } | ConvertTo-Json)
$executeAHeaders = @{ 'idempotency-key' = 'rv-approval-execute-a-1' }
$executeAError = $null
$accExecuteA = $null
try {
  $accExecuteA = Invoke-RestMethod -Method Patch -Uri ("http://localhost:3001/api/approvals/$($ap1.id)") -WebSession $accountant.session -Headers $executeAHeaders -ContentType 'application/json' -Body (@{ action = 'execute'; note = 'rv accountant execute A' } | ConvertTo-Json)
} catch {
  $executeAError = $_.Exception.Message
}
$ledgerA = Invoke-RestMethod -Method Get -Uri ("http://localhost:3001/api/ledger?referenceType=TRANSACTION&referenceId=$($tx1.data.id)") -WebSession $accountant.session
$statusAfterA = Invoke-RestMethod -Method Get -Uri ("http://localhost:3001/api/budgets/$b1Id/status") -WebSession $admin.session

$tx2 = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/transactions' -WebSession $employee.session -ContentType 'application/json' -Body (@{
  type = 'EXPENSE'
  amount = '50000.00'
  budgetId = $b1Id
  departmentId = $depId
  description = 'rv-approval-path-b'
} | ConvertTo-Json)
$approvals2 = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/approvals' -WebSession $manager.session
$ap2 = $approvals2.data.approvals | Where-Object { $_.transactionId -eq $tx2.data.id } | Select-Object -First 1
if (-not $ap2) { throw 'Approval not found for tx2' }

$mgrApproveB = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/approvals/$($ap2.id)/action") -WebSession $manager.session -ContentType 'application/json' -Body (@{ action = 'approve'; note = 'rv manager approve B' } | ConvertTo-Json)
$executeBError = $null
$executeB = $null
$executeBReplay = $null
$executeBHeaders = @{ 'idempotency-key' = 'rv-approval-execute-b-1' }
try {
  $executeB = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/approvals/$($ap2.id)/action") -WebSession $accountant.session -Headers $executeBHeaders -ContentType 'application/json' -Body (@{ action = 'execute'; note = 'rv accountant execute B' } | ConvertTo-Json)
  $executeBReplay = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/approvals/$($ap2.id)/action") -WebSession $accountant.session -Headers $executeBHeaders -ContentType 'application/json' -Body (@{ action = 'execute'; note = 'rv accountant execute B replay' } | ConvertTo-Json)
} catch {
  $executeBError = $_.Exception.Message
}
$ledgerB = Invoke-RestMethod -Method Get -Uri ("http://localhost:3001/api/ledger?referenceType=TRANSACTION&referenceId=$($tx2.data.id)") -WebSession $accountant.session
$statusAfterB = Invoke-RestMethod -Method Get -Uri ("http://localhost:3001/api/budgets/$b1Id/status") -WebSession $admin.session

$rbBefore = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/transactions?page=1&limit=100' -WebSession $accountant.session
$rbReq = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/reimbursements' -WebSession $employee.session -ContentType 'application/json' -Body (@{
  purpose = 'rv reimbursement'
  advanceAmount = '300000.00'
} | ConvertTo-Json)
$rbId = $rbReq.data.id
$null = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/reimbursements/$rbId/approve") -WebSession $manager.session -ContentType 'application/json' -Body (@{ note = 'approve' } | ConvertTo-Json)
$rbPayHeaders = @{ 'idempotency-key' = 'rv-rb-pay-1' }
$rbCompleteHeaders = @{ 'idempotency-key' = 'rv-rb-complete-1' }
$null = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/reimbursements/$rbId/pay-advance") -WebSession $accountant.session -Headers $rbPayHeaders -ContentType 'application/json' -Body (@{ note = 'paid' } | ConvertTo-Json)
$null = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/reimbursements/$rbId/submit-settlement") -WebSession $employee.session -ContentType 'application/json' -Body (@{ actualAmount = '250000.00'; settlementNote = 'submit' } | ConvertTo-Json)
$null = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/reimbursements/$rbId/review-settlement") -WebSession $accountant.session -ContentType 'application/json' -Body (@{ note = 'review' } | ConvertTo-Json)
$rbComplete = Invoke-RestMethod -Method Post -Uri ("http://localhost:3001/api/reimbursements/$rbId/complete") -WebSession $accountant.session -Headers $rbCompleteHeaders -ContentType 'application/json' -Body (@{} | ConvertTo-Json)
$rbAfter = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/transactions?page=1&limit=100' -WebSession $accountant.session
$rbLedger = Invoke-RestMethod -Method Get -Uri ("http://localhost:3001/api/ledger?referenceType=REIMBURSEMENT&referenceId=$rbId") -WebSession $accountant.session

$txRef = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/transactions/reference-data' -WebSession $employee.session

$uploadTempFile = Join-Path $outDir 'rv-attachment.txt'
'Sample attachment for runtime validation' | Set-Content -Path $uploadTempFile -Encoding UTF8
$attachmentUpload = UploadAttachment $employee.token $uploadTempFile

$recurringCreate = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/transactions/recurring' -WebSession $accountant.session -ContentType 'application/json' -Body (@{
  name = 'rv recurring expense'
  type = 'EXPENSE'
  amount = '10000.00'
  frequency = 'MONTHLY'
  nextRunAt = (Get-Date).AddMinutes(-5).ToUniversalTime().ToString('o')
  budgetId = $b1Id
  departmentId = $depId
} | ConvertTo-Json)
$recurringList = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/transactions/recurring?page=1&limit=10' -WebSession $accountant.session
$recurringRun = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/transactions/recurring/run' -WebSession $accountant.session -ContentType 'application/json' -Body (@{} | ConvertTo-Json)

$cashbookBefore = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/cashbook?page=1&limit=30' -WebSession $accountant.session
$cashbookAccount = $cashbookBefore.data.accounts | Select-Object -First 1
if (-not $cashbookAccount) { throw 'Cashbook account not found' }
$reconcileHeaders = @{ 'idempotency-key' = "rv-cashbook-reconcile-$ts" }
$actualBalance = [decimal]::Parse($cashbookAccount.balance, [Globalization.CultureInfo]::InvariantCulture) + 1234
$actualBalanceText = $actualBalance.ToString('0.00', [Globalization.CultureInfo]::InvariantCulture)
$cashbookReconcile = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/cashbook/reconcile' -WebSession $accountant.session -Headers $reconcileHeaders -ContentType 'application/json' -Body (@{
  accountId = $cashbookAccount.id
  actualBalance = $actualBalanceText
  reason = 'runtime-validation'
} | ConvertTo-Json)
$cashbookReconcileReplay = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/cashbook/reconcile' -WebSession $accountant.session -Headers $reconcileHeaders -ContentType 'application/json' -Body (@{
  accountId = $cashbookAccount.id
  actualBalance = $actualBalanceText
  reason = 'runtime-validation replay'
} | ConvertTo-Json)
$cashbookAfter = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/cashbook?page=1&limit=30' -WebSession $accountant.session

$tx3 = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/transactions' -WebSession $employee.session -ContentType 'application/json' -Body (@{
  type = 'EXPENSE'
  amount = '40000.00'
  budgetId = $b1Id
  departmentId = $depId
  description = 'rv-approval-not-execute'
} | ConvertTo-Json)
$approvals3 = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/approvals' -WebSession $manager.session
$ap3 = $approvals3.data.approvals | Where-Object { $_.transactionId -eq $tx3.data.id } | Select-Object -First 1
if (-not $ap3) { throw 'Approval not found for tx3' }
$null = Invoke-RestMethod -Method Patch -Uri ("http://localhost:3001/api/approvals/$($ap3.id)") -WebSession $manager.session -ContentType 'application/json' -Body (@{ action = 'approve'; note = 'rv manager approve C' } | ConvertTo-Json)
$notExecute = Invoke-RestMethod -Method Patch -Uri ("http://localhost:3001/api/approvals/$($ap3.id)") -WebSession $accountant.session -ContentType 'application/json' -Body (@{ action = 'not-execute'; note = 'rv accountant reject execute C' } | ConvertTo-Json)
$statusAfterC = Invoke-RestMethod -Method Get -Uri ("http://localhost:3001/api/budgets/$b1Id/status") -WebSession $admin.session

$reports = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/reports' -WebSession $manager.session
$kpis = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/dashboard/kpis' -WebSession $manager.session

$aiSessionId = "rv-ai-$ts"
$aiBudgetCount = AskAi $manager.session $aiSessionId "Có bao nhiêu ngân sách phòng ban?"
$aiBudgetSummary = AskAi $manager.session $aiSessionId "Ngân sách còn bao nhiêu tiền?"
$aiTransactions = AskAi $manager.session $aiSessionId "Có bao nhiêu giao dịch gần đây?"
$aiApprovals = AskAi $manager.session $aiSessionId "Có bao nhiêu yêu cầu phê duyệt đang chờ xử lý?"
$aiReimbursements = AskAi $manager.session $aiSessionId "Tóm tắt hoàn ứng gần đây cho tôi"
$aiReports = AskAi $manager.session $aiSessionId "Tổng chi tổng thu số dư hiện tại"
$aiSecurityLogs = AskAi $manager.session $aiSessionId "Có bao nhiêu bản ghi nhật ký hệ thống gần nhất?"
$aiUsers = AskAi $manager.session $aiSessionId "Danh sách người dùng hiện tại có bao nhiêu?"
$aiFx = AskAi $manager.session $aiSessionId "Tỷ giá USD hiện tại là bao nhiêu?"
$aiDashboard = AskAi $manager.session $aiSessionId "Tổng ngân sách hiện tại là bao nhiêu?"

$aiUiCrossCheck = [ordered]@{
  overview = [ordered]@{
    routeUsed = $aiDashboard.data.routeUsed
    policyKey = $aiDashboard.data.policyKey
    dataDomain = $aiDashboard.data.dataDomain
    scopeApplied = $aiDashboard.data.scopeApplied
    pass = ($aiDashboard.data.routeUsed -eq 'SERVICE') -and ($null -ne $kpis.data.totalBudget) -and ($null -ne $aiDashboard.data.policyKey) -and ($null -ne $aiDashboard.data.scopeApplied)
  }
  transactions = [ordered]@{
    routeUsed = $aiTransactions.data.routeUsed
    policyKey = $aiTransactions.data.policyKey
    dataDomain = $aiTransactions.data.dataDomain
    scopeApplied = $aiTransactions.data.scopeApplied
    pass = ($aiTransactions.data.routeUsed -in @('SERVICE', 'RAG', 'TEXT2SQL')) -and (($aiTransactions.data.routeUsed -ne 'SERVICE') -or ($null -ne $aiTransactions.data.relatedData.transactions)) -and ($null -ne $aiTransactions.data.policyKey) -and ($null -ne $aiTransactions.data.scopeApplied)
  }
  budgetOrchestration = [ordered]@{
    routeUsed = $aiBudgetSummary.data.routeUsed
    policyKey = $aiBudgetSummary.data.policyKey
    dataDomain = $aiBudgetSummary.data.dataDomain
    scopeApplied = $aiBudgetSummary.data.scopeApplied
    totalReserved = $aiBudgetSummary.data.relatedData.totals.totalReserved
    totalAvailable = $aiBudgetSummary.data.relatedData.totals.totalAvailable
    pass = ($aiBudgetSummary.data.routeUsed -eq 'SERVICE') -and ($null -ne $aiBudgetSummary.data.relatedData.totals.totalReserved) -and ($null -ne $aiBudgetSummary.data.relatedData.totals.totalAvailable) -and ($null -ne $aiBudgetSummary.data.policyKey) -and ($null -ne $aiBudgetSummary.data.scopeApplied)
  }
  budgets = [ordered]@{
    routeUsed = $aiBudgetCount.data.routeUsed
    policyKey = $aiBudgetCount.data.policyKey
    dataDomain = $aiBudgetCount.data.dataDomain
    scopeApplied = $aiBudgetCount.data.scopeApplied
    expectedBudgetCount = ($txRef.data.budgets | Measure-Object).Count
    aiBudgetCount = $aiBudgetCount.data.relatedData.budgetCount
    pass = ($aiBudgetCount.data.routeUsed -eq 'SERVICE') -and ($aiBudgetCount.data.relatedData.budgetCount -eq ($txRef.data.budgets | Measure-Object).Count) -and ($null -ne $aiBudgetCount.data.policyKey) -and ($null -ne $aiBudgetCount.data.scopeApplied)
  }
  approvals = [ordered]@{
    routeUsed = $aiApprovals.data.routeUsed
    policyKey = $aiApprovals.data.policyKey
    dataDomain = $aiApprovals.data.dataDomain
    scopeApplied = $aiApprovals.data.scopeApplied
    pass = ($aiApprovals.data.routeUsed -in @('SERVICE', 'RAG', 'TEXT2SQL')) -and (($aiApprovals.data.routeUsed -ne 'SERVICE') -or ($null -ne $aiApprovals.data.relatedData.approvals)) -and ($null -ne $aiApprovals.data.policyKey) -and ($null -ne $aiApprovals.data.scopeApplied)
  }
  reimbursements = [ordered]@{
    routeUsed = $aiReimbursements.data.routeUsed
    policyKey = $aiReimbursements.data.policyKey
    dataDomain = $aiReimbursements.data.dataDomain
    scopeApplied = $aiReimbursements.data.scopeApplied
    pass = ($aiReimbursements.data.routeUsed -in @('SERVICE', 'RAG', 'TEXT2SQL')) -and ($null -ne $aiReimbursements.data.policyKey) -and ($null -ne $aiReimbursements.data.scopeApplied)
  }
  reports = [ordered]@{
    routeUsed = $aiReports.data.routeUsed
    policyKey = $aiReports.data.policyKey
    dataDomain = $aiReports.data.dataDomain
    scopeApplied = $aiReports.data.scopeApplied
    pass = ($aiReports.data.routeUsed -in @('SERVICE', 'RAG', 'TEXT2SQL')) -and ($null -ne $reports.data.kpis) -and ($null -ne $aiReports.data.policyKey) -and ($null -ne $aiReports.data.scopeApplied)
  }
  securityLogs = [ordered]@{
    routeUsed = $aiSecurityLogs.data.routeUsed
    policyKey = $aiSecurityLogs.data.policyKey
    dataDomain = $aiSecurityLogs.data.dataDomain
    scopeApplied = $aiSecurityLogs.data.scopeApplied
    pass = ($aiSecurityLogs.data.routeUsed -in @('SERVICE', 'RAG', 'TEXT2SQL')) -and ($null -ne $aiSecurityLogs.data.policyKey) -and ($null -ne $aiSecurityLogs.data.scopeApplied) -and (($aiSecurityLogs.data.routeUsed -ne 'SERVICE') -or ($null -ne $aiSecurityLogs.data.relatedData.logs) -or ($aiSecurityLogs.data.policyKey -eq 'security-logs'))
  }
  userManagement = [ordered]@{
    routeUsed = $aiUsers.data.routeUsed
    policyKey = $aiUsers.data.policyKey
    dataDomain = $aiUsers.data.dataDomain
    scopeApplied = $aiUsers.data.scopeApplied
    pass = ($aiUsers.data.routeUsed -in @('RAG', 'TEXT2SQL')) -and ($null -ne $aiUsers.data.policyKey) -and ($null -ne $aiUsers.data.scopeApplied)
  }
  fxManagement = [ordered]@{
    routeUsed = $aiFx.data.routeUsed
    policyKey = $aiFx.data.policyKey
    dataDomain = $aiFx.data.dataDomain
    scopeApplied = $aiFx.data.scopeApplied
    pass = ($aiFx.data.routeUsed -in @('SERVICE', 'RAG', 'TEXT2SQL')) -and ($null -ne $aiFx.data.policyKey) -and ($null -ne $aiFx.data.scopeApplied)
  }
}

$summary = [ordered]@{
  budgeting = [ordered]@{
    b1AvailableBefore = $statusBefore.data.available
    transfer1Replayed = $t1.data.replayed
    transfer2Replayed = $t2.data.replayed
    b1AvailableAfter = $statusAfter.data.available
  }
  transactionApprovalPathA = [ordered]@{
    tx1Id = $tx1.data.id
    tx1StatusAfterExecute = if ($accExecuteA) { $accExecuteA.data.transaction.status } else { $null }
    executePathAError = $executeAError
    ledgerEntriesForTx1 = ($ledgerA.data.entries | Measure-Object).Count
    budgetReservedAfterA = $statusAfterA.data.reserved
    budgetUsedAfterA = $statusAfterA.data.used
  }
  transactionApprovalPathB = [ordered]@{
    tx2Id = $tx2.data.id
    managerApprovePathBStatus = $mgrApproveB.data.status
    executePathBError = $executeBError
    executePathBStatus = if ($executeB) { $executeB.data.status } else { $null }
    executePathBReplayStatus = if ($executeBReplay) { $executeBReplay.data.status } else { $null }
    ledgerEntriesForTx2 = ($ledgerB.data.entries | Measure-Object).Count
    budgetReservedAfterB = $statusAfterB.data.reserved
    budgetUsedAfterB = $statusAfterB.data.used
  }
  reimbursement = [ordered]@{
    reimbursementId = $rbId
    finalStatus = $rbComplete.data.status
    netAmount = $rbComplete.data.netAmount
    settlementDirection = $rbComplete.data.settlementDirection
    transactionCountBefore = $rbBefore.data.total
    transactionCountAfter = $rbAfter.data.total
    ledgerEntriesForReimbursement = ($rbLedger.data.entries | Measure-Object).Count
  }
  transactionsAuxiliary = [ordered]@{
    referenceDataDepartments = ($txRef.data.departments | Measure-Object).Count
    referenceDataBudgets = ($txRef.data.budgets | Measure-Object).Count
    attachmentUploaded = $attachmentUpload.ok
    recurringTemplateId = $recurringCreate.data.id
    recurringListCount = ($recurringList.data.templates | Measure-Object).Count
    recurringRunScanned = $recurringRun.data.scanned
    recurringRunCreated = $recurringRun.data.created
  }
  cashbook = [ordered]@{
    accountCountBefore = ($cashbookBefore.data.accounts | Measure-Object).Count
    postingCountBefore = ($cashbookBefore.data.postings | Measure-Object).Count
    reconcileAdjusted = $cashbookReconcile.data.adjusted
    reconcileReplay = $cashbookReconcileReplay.data.replayed
    accountCountAfter = ($cashbookAfter.data.accounts | Measure-Object).Count
    postingCountAfter = ($cashbookAfter.data.postings | Measure-Object).Count
  }
  approvalNotExecute = [ordered]@{
    tx3Id = $tx3.data.id
    approvalStatusAfterNotExecute = $notExecute.data.status
    transactionStatusAfterNotExecute = $notExecute.data.transaction.status
    budgetReservedAfterNotExecute = $statusAfterC.data.reserved
    budgetUsedAfterNotExecute = $statusAfterC.data.used
  }
  reports = [ordered]@{
    reportsHasKpis = ($null -ne $reports.data.kpis)
    reportsHasBudgetVsActual = ($null -ne $reports.data.budgetVsActual)
    dashboardHasTotalBudget = ($null -ne $kpis.data.totalBudget)
    dashboardHasTotalSpent = ($null -ne $kpis.data.totalSpent)
    dashboardHasRemainingBalance = ($null -ne $kpis.data.remainingBalance)
    dashboardHasCurrency = ($null -ne $kpis.data.currency)
  }
  aiUiCrossCheck = $aiUiCrossCheck
}

$out = Join-Path $outDir 'runtime-validation-summary.json'
($summary | ConvertTo-Json -Depth 8) | Set-Content -Path $out -Encoding UTF8
Get-Content $out

Invoke-Expression $cleanupScript | Out-Null
