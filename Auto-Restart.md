# CIS Monitor: Auto-Restart After PC Reboot

Runbook for making `cis-monitor` (PM2) start by itself at boot, with no user logged in, using a Windows scheduled task named `cis-notifications`.

**How it works:** PM2 has no `startup` command on Windows. Instead, a scheduled task runs at system startup, calls a `.bat` file, and the `.bat` runs `pm2 resurrect`, which restores the process list saved earlier with `pm2 save`.

| Item | Value |
| --- | --- |
| Project folder | `C:\dev\cis-monitor-ts` |
| PM2 app name | `cis-monitor` |
| Run-as account | `CRMMASTER\V4Sched2` |
| PM2 home (dump location) | `C:\Users\V4Sched2\.pm2` |
| Batch file | `C:\dev\cis-monitor-ts\start-pm2.bat` |
| Boot log | `C:\dev\cis-monitor-ts\pm2-boot.log` |
| Task name | `cis-notifications` |

---

## Prerequisites

- Node.js and PM2 installed (`C:\Program Files\nodejs`, `C:\Users\V4Sched2\AppData\Roaming\npm\pm2.cmd`).
- Project built: `npm run build` (creates `dist\index.js`).
- `.env` filled in at the project root.
- You can open an **elevated** PowerShell (Run as administrator).
- `V4Sched2` has the **Log on as a batch job** right (`secpol.msc` → Local Policies → User Rights Assignment).
- `V4Sched2` has read access to `C:\dev\cis-monitor-ts` and write access to `pm2-boot.log`.

---

## Step 1: Start the app and save the PM2 process list

Do this **as `V4Sched2`** (or with `PM2_HOME` set to that account's folder), so the dump lands where the task will look.

```powershell
$env:PM2_HOME = "C:\Users\V4Sched2\.pm2"
cd C:\dev\cis-monitor-ts
npm run build
pm2 start dist/index.js --name cis-monitor
pm2 save
```

Verify the dump exists:

```powershell
Test-Path C:\Users\V4Sched2\.pm2\dump.pm2   # must be True
```

> Re-run `pm2 save` whenever you add, remove, or change a PM2 app. The dump is what gets restored at boot.

---

## Step 2: Create `start-pm2.bat`

Save as `C:\dev\cis-monitor-ts\start-pm2.bat`:

```bat
@echo off
chcp 65001 >nul
set PATH=C:\Program Files\nodejs;C:\Users\V4Sched2\AppData\Roaming\npm;%PATH%
set PM2_HOME=C:\Users\V4Sched2\.pm2
cd /d C:\dev\cis-monitor-ts
echo ===== %date% %time% starting ===== >> C:\dev\cis-monitor-ts\pm2-boot.log
call pm2 resurrect --no-daemon >> C:\dev\cis-monitor-ts\pm2-boot.log 2>&1
```

What each line does:

| Line | Purpose |
| --- | --- |
| `chcp 65001` | Writes the log as UTF-8 so PM2's table characters display correctly |
| `set PATH=...` | Boot-time tasks don't get your interactive PATH; this makes `node` and `pm2` findable |
| `set PM2_HOME=...` | Points PM2 at the folder holding `dump.pm2` |
| `cd /d ...` | Ensures the app finds its `.env` and relative paths |
| `echo ... >> log` | Timestamps each start in the boot log |
| `pm2 resurrect --no-daemon` | Restores saved processes; PM2 stays attached, so the task shows "Running" |

---

## Step 3: Register the scheduled task

Open **PowerShell as Administrator** and run. `Get-Credential` prompts for the password so it never appears in your command history.

```powershell
$cred = Get-Credential "CRMMASTER\V4Sched2"

$action   = New-ScheduledTaskAction -Execute "C:\dev\cis-monitor-ts\start-pm2.bat"
$trigger  = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = "PT1M"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
            -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
            -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "cis-notifications" -Action $action -Trigger $trigger `
  -Settings $settings -User $cred.UserName -Password $cred.GetNetworkCredential().Password `
  -RunLevel Highest -Force
```

Settings explained:

- `-AtStartup` with `Delay PT1M`: fires one minute after boot so networking and SQL Server have time to come up. Raise to `PT2M` if the first run fails.
- `-ExecutionTimeLimit ([TimeSpan]::Zero)`: removes the default 72-hour limit that would otherwise kill the long-running task.
- `-RestartCount 3 -RestartInterval 1 min`: retries if the task fails to start.
- Using `-User` and `-Password` makes it **Run whether user is logged on or not**.

If you get `Access is denied (0x80070005)`, your PowerShell window is not elevated. Confirm with:

```powershell
([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
```

---

## Step 4: Test without rebooting

```powershell
$env:PM2_HOME = "C:\Users\V4Sched2\.pm2"
pm2 kill
Start-ScheduledTask -TaskName "cis-notifications"
Start-Sleep 20
Get-ScheduledTaskInfo -TaskName "cis-notifications" | Select LastRunTime, LastTaskResult
Get-Content C:\dev\cis-monitor-ts\pm2-boot.log -Tail 30 -Encoding UTF8
pm2 list
```

Expected result:

- Log shows `Restoring processes located in C:\Users\V4Sched2\.pm2\dump.pm2` and `cis-monitor ... online`.
- `pm2 list` shows `cis-monitor` as `online`, user `v4sched2`.
- Task state is **Running** (normal with `--no-daemon`).

---

## Step 5: Final test, real reboot

1. Restart the server.
2. Wait 2 to 3 minutes **without logging in**.
3. Log in and run:

```powershell
$env:PM2_HOME = "C:\Users\V4Sched2\.pm2"
pm2 list
Get-Content C:\dev\cis-monitor-ts\pm2-boot.log -Tail 30 -Encoding UTF8
```

A fresh `===== ... starting =====` entry with a boot-time timestamp and `cis-monitor` online means it works.

---

## Day-to-day management

Your own login uses a different PM2 home than the task. Always set `PM2_HOME` first:

```powershell
$env:PM2_HOME = "C:\Users\V4Sched2\.pm2"
pm2 list
pm2 logs cis-monitor
pm2 restart cis-monitor
```

**After deploying new code:**

```powershell
cd C:\dev\cis-monitor-ts
git pull
npm install
npm run build
$env:PM2_HOME = "C:\Users\V4Sched2\.pm2"
pm2 restart cis-monitor
pm2 save
```

**Disable or remove the task:**

```powershell
Disable-ScheduledTask    -TaskName "cis-notifications"
Unregister-ScheduledTask -TaskName "cis-notifications" -Confirm:$false
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Task never runs at boot | Missing "Log on as a batch job" right, or trigger is not "At system startup" | Grant the right in `secpol.msc`; check trigger in Task Scheduler |
| `LastTaskResult` nonzero, log empty | Task could not start (bad password, path, or permissions) | Re-register with correct credentials; check file permissions |
| `'pm2' is not recognized` | Wrong npm path in `PATH` | Confirm `C:\Users\V4Sched2\AppData\Roaming\npm\pm2.cmd` exists and fix the `set PATH` line |
| Log shows nothing restored | No `dump.pm2` for this account | Run `pm2 save` with `PM2_HOME` set to `C:\Users\V4Sched2\.pm2` |
| `pm2 list` empty in your session | Different PM2 home | Set `$env:PM2_HOME` as shown above |
| App starts but DB or email fails at boot | Network or SQL Server not ready yet | Increase delay to `PT2M` or more |
| Garbled characters in log | PowerShell 5.1 reads as ANSI | Use `-Encoding UTF8`; keep `chcp 65001` in the bat |
| Duplicate emails | Two copies running (e.g. another PM2 home or a service) | Check `pm2 list` under each account; keep only one |

---

## Security notes

- Never put the account password in a script, chat, or command history. Use `Get-Credential`.
- If a password was ever typed in plain text anywhere, change it.
- Use a dedicated service account with only the rights it needs.

---

## Alternative: run as a real Windows service (NSSM)

For a single always-on app on a server, NSSM avoids the scheduled task and PM2 dump entirely:

```cmd
nssm install cis-monitor "C:\Program Files\nodejs\node.exe" "dist\index.js"
nssm set cis-monitor AppDirectory C:\dev\cis-monitor-ts
nssm set cis-monitor Start SERVICE_AUTO_START
nssm set cis-monitor ObjectName CRMMASTER\V4Sched2
nssm start cis-monitor
```

If you switch to this, remove the PM2 process (`pm2 delete cis-monitor`, then `pm2 save`) and disable the `cis-notifications` task so you don't run two copies.