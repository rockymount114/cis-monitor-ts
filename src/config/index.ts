import 'dotenv/config';

export interface CheckpointConfig {
  time: string;           // "HH:mm" 24h format, e.g. "06:00"
  cron: string;           // cron expression, e.g. "0 6 * * *"
  expectedCount: number;  // expected cumulative jobs today
  label?: string;
}

export const DEFAULT_CHECKPOINTS: CheckpointConfig[] = [
  { time: '00:30', cron: '30 0 * * *', expectedCount: 1, label: 'Sensus Export (after 12:01 AM)' },
  { time: '06:00', cron: '0 6 * * *', expectedCount: 7, label: 'Morning batch (after 5:45 AM)' },
  { time: '11:00', cron: '0 11 * * *', expectedCount: 8, label: 'Mid-morning batch (after 10:35 AM)' },
  { time: '19:20', cron: '20 19 * * *', expectedCount: 9, label: 'Evening batch (after 7:00 PM)' },
  { time: '22:00', cron: '0 22 * * *', expectedCount: 10, label: 'Night batch (after 9:35 PM)' },
];

function parseCheckpoints(): CheckpointConfig[] {
  const envCheckpoints = process.env.SCHEDULE_CHECKPOINTS;
  if (envCheckpoints) {
    const parsed = envCheckpoints.split(',').map(item => {
      const parts = item.trim().split(':');
      const hr = parts[0].padStart(2, '0');
      const min = (parts[1] || '00').padStart(2, '0');
      const time = `${hr}:${min}`;
      const count = parseInt(parts[2], 10);
      const cronExpr = parts[3] ? parts.slice(3).join(':').trim() : `${parseInt(min, 10)} ${parseInt(hr, 10)} * * *`;
      return {
        time,
        cron: cronExpr,
        expectedCount: isNaN(count) ? 0 : count,
        label: `Checkpoint ${time}`,
      };
    }).filter(c => !isNaN(c.expectedCount));
    if (parsed.length > 0) return parsed;
  }

  const envExpectedCounts = process.env.EXPECTED_JOB_COUNTS;
  if (envExpectedCounts) {
    const counts = envExpectedCounts.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const crons = (process.env.CRON_TIMES || DEFAULT_CHECKPOINTS.map(c => c.cron).join(','))
      .split(',').map(s => s.trim());
    return crons.map((cron, idx) => {
      const parts = cron.split(' ');
      const min = (parts[0] || '0').padStart(2, '0');
      const hr = (parts[1] || '0').padStart(2, '0');
      const time = `${hr}:${min}`;
      const def = DEFAULT_CHECKPOINTS.find(d => d.time === time) ?? DEFAULT_CHECKPOINTS[idx];
      const expectedCount = counts[idx] !== undefined ? counts[idx] : (def?.expectedCount || 0);
      return {
        time,
        cron,
        expectedCount,
        label: def?.label || `Checkpoint ${time}`,
      };
    });
  }

  if (process.env.CRON_TIMES) {
    const crons = process.env.CRON_TIMES.split(',').map(s => s.trim());
    return crons.map((cron, idx) => {
      const parts = cron.split(' ');
      const min = (parts[0] || '0').padStart(2, '0');
      const hr = (parts[1] || '0').padStart(2, '0');
      const time = `${hr}:${min}`;
      const def = DEFAULT_CHECKPOINTS.find(d => d.time === time) ?? DEFAULT_CHECKPOINTS[idx];
      return {
        time,
        cron,
        expectedCount: def ? def.expectedCount : (idx + 6),
        label: def?.label || `Checkpoint ${time}`,
      };
    });
  }

  return DEFAULT_CHECKPOINTS;
}

const checkpoints = parseCheckpoints();

export const config = {
  timeZone: process.env.TIME_ZONE || 'America/New_York',
  checkpoints,
  db: {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    options: {
      encrypt: (process.env.DB_ENCRYPT || 'false') === 'true',
      trustServerCertificate: (process.env.DB_TRUST_CERT || 'true') === 'true',
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  },
  cisServer: process.env.CIS_SERVER,
  cisPorts: (process.env.CIS_PORTS || '3389,443,80,81,1433').split(',').map(n => parseInt(n.trim(),10)),
  cronTimes: checkpoints.map(c => c.cron),
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
