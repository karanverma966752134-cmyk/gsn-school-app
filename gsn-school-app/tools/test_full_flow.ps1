$base = 'http://127.0.0.1:3000'

Write-Output '1) Logging in as teacher (GSN-T-001)'
$creds = @{ staffId = 'GSN-T-001'; password = 'password123' }
try {
    $login = Invoke-RestMethod -Uri "$base/api/login" -Method Post -Body ($creds | ConvertTo-Json) -ContentType 'application/json'
    Write-Output "Login success. Token length: $($login.token.Length)"
} catch {
    Write-Output 'Login failed:'
    Write-Output $_.Exception.Response.Content.ReadAsStringAsync().Result
    exit 1
}
$token = $login.token

Write-Output '`n2) Adding a new student (unique adm_no)'
$timestamp = (Get-Date).ToString('yyyyMMddHHmmss')
$adm = "2025/TEST-$timestamp"
$student = @{ adm_no = $adm; name = "Test Student $timestamp"; class = '5'; section = 'A'; contact = '9999999999'; status = 'Active' }
try {
    $addResp = Invoke-RestMethod -Uri "$base/api/students" -Method Post -Body ($student | ConvertTo-Json) -ContentType 'application/json'
    Write-Output "Add student response: $($addResp | ConvertTo-Json)"
} catch {
    Write-Output 'Add student failed:'
    Write-Output $_.Exception.Response.Content.ReadAsStringAsync().Result
    exit 1
}

Write-Output '`n3) Fetching students to find the new student id'
$students = Invoke-RestMethod -Uri "$base/api/students" -Method Get
$new = $students | Where-Object { $_.adm_no -eq $adm }
if (-not $new) { Write-Output 'New student not found in students list.'; exit 1 }
$studentId = $new.id
Write-Output "Found student id: $studentId (adm_no: $adm)"

Write-Output '`n4) Saving attendance for today for the new student'
$date = (Get-Date).ToString('yyyy-MM-dd')
$records = @(@{ student_id = $studentId; status = 'Present'; remark = 'Auto test' })
$body = @{ date = $date; records = $records }
try {
    $attResp = Invoke-RestMethod -Uri "$base/api/attendance" -Method Post -Body ($body | ConvertTo-Json -Depth 4) -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" }
    Write-Output "Attendance save response: $($attResp | ConvertTo-Json)"
} catch {
    Write-Output 'Attendance save failed:'
    if ($_.Exception.Response -ne $null) { Write-Output $_.Exception.Response.Content.ReadAsStringAsync().Result } else { Write-Output $_ }
    exit 1
}

Write-Output '`n5) Verifying attendance via GET /api/attendance'
$attGet = Invoke-RestMethod -Uri "$base/api/attendance?date=$date&class=5&section=A" -Method Get
Write-Output ($attGet | ConvertTo-Json -Depth 6)

Write-Output '`nFull flow test completed successfully.'
