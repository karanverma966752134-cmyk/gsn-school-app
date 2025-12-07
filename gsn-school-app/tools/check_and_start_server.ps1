Write-Output 'Listing node processes...'
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, StartTime | Format-Table -AutoSize

Write-Output '---NETSTAT---'
netstat -ano | Select-String ':3000\s+LISTENING'

Write-Output '---NODE COMMAND LINES---'
try {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, CommandLine | Format-List
} catch {
    Write-Output 'Failed to enumerate command lines via CIM.'
}

if (-not (netstat -ano | Select-String ':3000\s+LISTENING')) {
    Write-Output 'Port 3000 not listening — starting server (detached)...'
    Start-Process -FilePath npm -ArgumentList 'run','start' -WorkingDirectory 'C:\Users\DELL\OneDrive\Desktop\my app\gsn-school-app'
} else {
    Write-Output 'Port 3000 already listening.'
}
