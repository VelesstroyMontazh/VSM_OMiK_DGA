# Регистрация ежедневного ETL в Планировщике Windows (без прав администратора).
# Запуск: powershell -ExecutionPolicy Bypass -File register_etl_task.ps1

$ErrorActionPreference = "Stop"

$ProjectDir = "C:\My_Project\Project_X"
$BatPath = Join-Path $ProjectDir "run_etl.bat"
$TaskName = "VSM_ETL_Daily"
$RunAt = "06:00"

if (-not (Test-Path $BatPath)) {
    Write-Error "run_etl.bat not found: $BatPath"
}

$Action = New-ScheduledTaskAction `
    -Execute $BatPath `
    -WorkingDirectory $ProjectDir

$Trigger = New-ScheduledTaskTrigger -Daily -At $RunAt

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4)

$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Force | Out-Null

Write-Host "[OK] Task registered: $TaskName"
Write-Host "     Daily at $RunAt"
Write-Host "     Script: $BatPath"
Write-Host "     Logs:   $ProjectDir\db\logs"
Write-Host ""
Write-Host "Test run now:"
Write-Host "  schtasks /Run /TN `"$TaskName`""
