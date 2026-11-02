@echo off
set PATH=C:\Program Files\nodejs;C:\Users\V4Sched2\AppData\Roaming\npm;%PATH%
set PM2_HOME=C:\Users\V4Sched2\.pm2
cd /d C:\dev\cis-monitor-ts
echo ===== %date% %time% starting ===== >> C:\dev\cis-monitor-ts\pm2-boot.log
call pm2 resurrect --no-daemon >> C:\dev\cis-monitor-ts\pm2-boot.log 2>&1