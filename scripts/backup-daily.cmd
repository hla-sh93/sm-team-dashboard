@echo off
REM النسخة الاحتياطية اليومية — ١٢ ظهراً (قرار القائدة ٢/٩/٢٠٢٦).
REM بيشغّله Windows Task Scheduler؛ الملف موجود مشان الأمر يضل سطر واحد بسيط
REM بدل اقتباسات متشابكة جوّا schtasks.
REM
REM التسجيل مرة وحدة:
REM   schtasks /create /sc daily /st 12:00 /tn "SM Dashboard Backup" /tr "%~f0"

cd /d "%~dp0.."
echo ==== %DATE% %TIME% ====>> "backups\backup-task.log"
call npm run backup:daily >> "backups\backup-task.log" 2>&1
exit /b %ERRORLEVEL%
