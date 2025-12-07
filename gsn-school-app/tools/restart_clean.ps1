Write-Output 'Stopping node processes running server.js...'
$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'server\\.js' -and $_.CommandLine -notmatch 'Adobe' }
foreach ($p in $procs) {
    Write-Output "Killing PID $($p.ProcessId)"
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch { Write-Output "Failed to stop PID $($p.ProcessId): $_" }
}
Start-Sleep -Seconds 1

$cwd = 'C:\Users\DELL\OneDrive\Desktop\my app\gsn-school-app'
Write-Output "Starting server in $cwd and logging to server_log.txt..."
Start-Process -FilePath cmd -ArgumentList '/c','node server.js > server_log.txt 2>&1' -WorkingDirectory $cwd
Start-Sleep -Seconds 3

Write-Output 'Checking netstat for :3000 LISTENING...'
netstat -ano | Select-String ':3000\\s+LISTENING'

Write-Output 'Last 50 lines of server_log.txt:'
Get-Content -Path (Join-Path $cwd 'server_log.txt') -Tail 50 -ErrorAction SilentlyContinue
