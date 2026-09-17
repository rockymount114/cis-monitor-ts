# CIS Monitor TS

TypeScript version of your PS1 project. Queries `advanced.SYS024` on DXSCHEDULE02 and checks network to CIS server.

## Features
- Query job details with your provided SQL (parsed + pivoted)
- Scheduled at 6am, 11am, 7:20pm, 10pm (cron configurable)
- Network check ported from PS1 (TCP 3389,443,80,81,1433)
- Email + Teams webhook notifications
- Sample data compatible with your sample

## Project Structure
```
src/
  config/index.ts      # env & db config
  db/
    mssql.ts           # connection pool
    queries.ts         # your SYS024 query + type JobDetail
  services/
    jobService.ts      # fetch + analyze
    networkCheck.ts    # TCP port check (user PC side)
  notifiers/
    email.ts           # HTML report builder + email/teams
  jobs/
    scheduler.ts       # cron 6,11,19:20,22
  utils/logger.ts
  index.ts             # entry
```

## Setup
1. npm install
2. copy .env.example to .env and fill DB_USER/DB_PASSWORD/NOTIFY_TO
3. npm run dev  (watch)
4. npm run build && npm start

## Run once
```
npx tsx src/index.ts --once
# or just network check
npx tsx src/services/networkCheck.ts
```

## Deploy on Windows Server DXSCHEDULE02
Use PM2 or NSSM:
```
npm run build
pm2 start dist/index.js --name cis-monitor
pm2 save
```

## Notification Sample
Subject: [CIS] Job Report 2026-09-17 - Total:15 Failed:1 Records:1200
Body includes summary, failed jobs (e.g. eBill 381914 SMTP failure), table of all runs like your sample.