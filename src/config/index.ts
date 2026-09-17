import 'dotenv/config';

export const config = {
  db: {
    server: process.env.DB_SERVER || '172.20.80.12',
    database: process.env.DB_DATABASE || 'CIS4PROD',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    options: {
      encrypt: (process.env.DB_ENCRYPT || 'false') === 'true',
      trustServerCertificate: (process.env.DB_TRUST_CERT || 'true') === 'true',
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  },
  cisServer: process.env.CIS_SERVER || '172.20.80.12',
  cisPorts: (process.env.CIS_PORTS || '3389,443,80,81,1433').split(',').map(n => parseInt(n.trim(),10)),
  cronTimes: (process.env.CRON_TIMES || '0 6 * * *,0 11 * * *,20 19 * * *,0 22 * * *').split(',').map(s=>s.trim()),
  notify: {
    from: process.env.NOTIFY_FROM || 'cis-monitor@local',
    to: (process.env.NOTIFY_TO || '').split(',').map(s=>s.trim()).filter(Boolean),
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '25',10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    teamsWebhook: process.env.TEAMS_WEBHOOK_URL,
  }
};