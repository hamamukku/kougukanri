param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AdminLoginId = "admin",
  [string]$AdminPassword = "admin123",
  [string]$UserPassword = "user12345"
)

$ErrorActionPreference = "Stop"

function Step([string]$Message) {
  Write-Host "[STEP] $Message"
}

function Login([string]$LoginId, [string]$Password) {
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType "application/json" -Body (
    @{ loginId = $LoginId; password = $Password } | ConvertTo-Json
  )
}

Step "Base URL: $BaseUrl"

$runId = Get-Date -Format "yyyyMMddHHmmss"
$today = Get-Date -Format "yyyy-MM-dd"

$warehouseName = "e2e-wh-$runId"
$toolAAsset = "E2E-$runId-A"
$toolBAsset = "E2E-$runId-B"
$toolAName = "E2E Tool A $runId"
$toolBName = "E2E Tool B $runId"
$userName = "e2e_user_$runId"
$userEmail = "e2e_$runId@example.com"

Step "admin login"
$adminLogin = Login -LoginId $AdminLoginId -Password $AdminPassword
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.token)" }

Step "create warehouse"
$warehouse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/admin/warehouses" -Headers $adminHeaders -ContentType "application/json" -Body (
  @{ name = $warehouseName } | ConvertTo-Json
)

Step "create tool A"
$toolA = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/admin/tools" -Headers $adminHeaders -ContentType "application/json" -Body (
  @{ assetNo = $toolAAsset; name = $toolAName; warehouseId = $warehouse.id; baseStatus = "AVAILABLE" } | ConvertTo-Json
)

Step "create tool B"
$toolB = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/admin/tools" -Headers $adminHeaders -ContentType "application/json" -Body (
  @{ assetNo = $toolBAsset; name = $toolBName; warehouseId = $warehouse.id; baseStatus = "AVAILABLE" } | ConvertTo-Json
)

Step "create user"
$user = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/admin/users" -Headers $adminHeaders -ContentType "application/json" -Body (
  @{ department = "e2e"; username = $userName; email = $userEmail; password = $UserPassword; role = "user" } | ConvertTo-Json
)

Step "user login"
$userLogin = Login -LoginId $userName -Password $UserPassword
$userHeaders = @{ Authorization = "Bearer $($userLogin.token)" }

Step "loan-box A (approve-box flow)"
$loanA = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/loan-boxes" -Headers $userHeaders -ContentType "application/json" -Body (
  @{ startDate = $today; dueDate = $today; toolIds = @($toolA.id); itemDueOverrides = @{} } | ConvertTo-Json -Depth 4
)
$myLoansA = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/my/loans" -Headers $userHeaders
$loanItemA = $myLoansA | Where-Object { $_.boxId -eq $loanA.boxId -and $_.toolId -eq $toolA.id } | Select-Object -First 1
if (-not $loanItemA) { throw "loan item A not found in /api/my/loans" }

Step "request return A"
$null = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/my/loans/$($loanItemA.loanItemId)/return-request" -Headers $userHeaders -ContentType "application/json" -Body "{}"

Step "approve-box A"
$approveBox = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/admin/returns/approve-box" -Headers $adminHeaders -ContentType "application/json" -Body (
  @{ boxId = $loanA.boxId } | ConvertTo-Json
)

Step "loan-box B (approve-items flow)"
$loanB = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/loan-boxes" -Headers $userHeaders -ContentType "application/json" -Body (
  @{ startDate = $today; dueDate = $today; toolIds = @($toolB.id); itemDueOverrides = @{} } | ConvertTo-Json -Depth 4
)
$myLoansB = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/my/loans" -Headers $userHeaders
$loanItemB = $myLoansB | Where-Object { $_.boxId -eq $loanB.boxId -and $_.toolId -eq $toolB.id } | Select-Object -First 1
if (-not $loanItemB) { throw "loan item B not found in /api/my/loans" }

Step "request return B"
$null = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/my/loans/$($loanItemB.loanItemId)/return-request" -Headers $userHeaders -ContentType "application/json" -Body "{}"

Step "approve-items B"
$approveItems = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/admin/returns/approve-items" -Headers $adminHeaders -ContentType "application/json" -Body (
  @{ boxId = $loanB.boxId; loanItemIds = @($loanItemB.loanItemId) } | ConvertTo-Json -Depth 4
)

Step "verify AVAILABLE status"
$toolsA = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/tools?q=$toolAAsset&mode=exact&page=1&pageSize=25" -Headers $userHeaders
$toolsB = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/tools?q=$toolBAsset&mode=exact&page=1&pageSize=25" -Headers $userHeaders
$statusA = ($toolsA.items | Select-Object -First 1).status
$statusB = ($toolsB.items | Select-Object -First 1).status

if ($statusA -ne "AVAILABLE") { throw "tool A status is not AVAILABLE: $statusA" }
if ($statusB -ne "AVAILABLE") { throw "tool B status is not AVAILABLE: $statusB" }

Step "E2E complete"
[pscustomobject]@{
  runId = $runId
  baseUrl = $BaseUrl
  warehouseId = $warehouse.id
  user = [pscustomobject]@{ id = $user.id; username = $user.username }
  toolA = [pscustomobject]@{ id = $toolA.id; assetNo = $toolAAsset; status = $statusA }
  toolB = [pscustomobject]@{ id = $toolB.id; assetNo = $toolBAsset; status = $statusB }
  flowA = [pscustomobject]@{ boxId = $loanA.boxId; loanItemId = $loanItemA.loanItemId; approved = $approveBox.approvedCount }
  flowB = [pscustomobject]@{ boxId = $loanB.boxId; loanItemId = $loanItemB.loanItemId; approved = $approveItems.approvedCount }
} | ConvertTo-Json -Depth 6

