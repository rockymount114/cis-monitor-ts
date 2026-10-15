import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { JobDetail } from '../db/queries.js';
import { analyzeJobs } from '../services/jobService.js';
import { NetworkResult } from '../services/networkCheck.js';
import { logger } from '../utils/logger.js';
import { formatDate, formatDateTime, formatDbWallClock } from '../utils/time.js';

const COLORS = {
  failBg: '#ffd6d6',
  failBorder: '#d32f2f',
  failText: '#b71c1c',
  okBg: '#e6f4ea',
  okBorder: '#2e7d32',
  okText: '#1b5e20',
  headerBg: '#37474f',
  headerText: '#ffffff',
  rowAlt: '#f7f7f7',
};

function buildHtmlReport(jobs: JobDetail[], network?: NetworkResult): string {
  const stats = analyzeJobs(jobs);
  const hasFailed = stats.failed.length > 0;

  // A job counts as failed if analyzeJobs flagged it or its Success column is 'False'
  const failedRunIds = new Set(stats.failed.map(f => String(f.I_RUNID)));
  const isFailedJob = (j: JobDetail) =>
    j.Success === 'False' || failedRunIds.has(String(j.I_RUNID));

  // ---- Banner ----
  const banner = hasFailed
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
        <tr><td style="background:${COLORS.failBorder};color:#fff;padding:14px 18px;font-size:18px;font-weight:bold;border-radius:4px">
          &#9888; ${stats.failed.length} FAILED JOB${stats.failed.length > 1 ? 'S' : ''} DETECTED &mdash; ACTION REQUIRED
        </td></tr>
      </table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
        <tr><td style="background:${COLORS.okBorder};color:#fff;padding:14px 18px;font-size:18px;font-weight:bold;border-radius:4px">
          &#10004; All jobs completed successfully
        </td></tr>
      </table>`;

  // ---- Rows ----
  const rows = jobs.map((j, i) => {
    const failed = isFailedJob(j);
    const rowStyle = failed
      ? `background:${COLORS.failBg};color:${COLORS.failText};font-weight:bold;border-left:6px solid ${COLORS.failBorder}`
      : `background:${i % 2 ? COLORS.rowAlt : '#fff'};border-left:6px solid transparent`;
    const badge = failed
      ? `<span style="background:${COLORS.failBorder};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">FAILED</span>`
      : `<span style="background:${COLORS.okBorder};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">OK</span>`;
    const failedCount = Number(j.Failed) > 0
      ? `<span style="color:${COLORS.failBorder};font-weight:bold">${j.Failed}</span>`
      : `${j.Failed || ''}`;

    return `
    <tr style="${rowStyle}">
      <td>${j.I_RUNID}</td><td>${formatDbWallClock(j.T_START)}</td><td>${j.ProcessName}</td>
      <td>${j.C_PROCESS}</td><td>${j.C_USERID}</td><td>${badge}</td>
      <td>${j['Total records'] || ''}</td><td>${j['Successfully processed'] || ''}</td><td>${failedCount}</td>
      <td>${(j.ResultDetails || '').substring(0, 200)}</td>
    </tr>`;
  }).join('');

  // ---- Failed detail box ----
  const failedDetail = hasFailed
    ? `<div style="border:2px solid ${COLORS.failBorder};background:${COLORS.failBg};padding:10px 16px;border-radius:4px;margin:12px 0">
        <h3 style="color:${COLORS.failText};margin:0 0 8px 0">&#10060; Failed Jobs Detail</h3>
        <ul style="margin:0;padding-left:20px;color:${COLORS.failText}">
          ${stats.failed.map(f => `<li><b>${f.I_RUNID}</b> ${f.ProcessName} &mdash; Failed=<b>${f.Failed}</b> ${f.ResultDetails || ''} ${f.Feedback || ''}</li>`).join('')}
        </ul>
      </div>`
    : `<p style="color:${COLORS.okText};font-weight:bold">&#10004; No failed jobs</p>`;

  // ---- Network ----
  const networkHtml = network
    ? (() => {
        const netBad = !network.pingOk || !network.dnsOk || network.ports.some(p => !p.ok);
        const c = netBad ? COLORS.failText : COLORS.okText;
        const st = (ok: boolean) =>
          ok ? `<span style="color:${COLORS.okText}">OK</span>` : `<b style="color:${COLORS.failBorder}">FAIL</b>`;
        return `<h3 style="color:${c}">Network Check ${network.host}</h3>
          <p>Ping: ${st(network.pingOk)} ${network.avgMs}ms | DNS: ${st(network.dnsOk)}<br/>
          Ports: ${network.ports.map(p => `${p.port}=${st(p.ok)}(${p.ms}ms)`).join(', ')}</p>`;
      })()
    : '';

  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222">
  ${banner}
  <h2>CIS Daily Report - ${formatDateTime(new Date(), config.timeZone)}</h2>
  <h3>Summary</h3>
  <ul>
    <li>Total Jobs (last 2 days): ${stats.total}</li>
    <li>Total Records: ${stats.totalRecords} | Failed Records:
      <b style="color:${stats.totalFailed > 0 ? COLORS.failBorder : COLORS.okText}">${stats.totalFailed}</b></li>
    <li>Failed Jobs:
      <b style="color:${hasFailed ? COLORS.failBorder : COLORS.okText};${hasFailed ? 'font-size:16px' : ''}">${stats.failed.length}</b></li>
    <li>By Process: ${Object.entries(stats.byProcess).map(([k, v]) => `${k}: ${v}`).join(', ')}</li>
  </ul>
  ${networkHtml}
  ${failedDetail}
  <h3>All Jobs</h3>
  <table border="0" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:12px;border:1px solid #ccc">
    <tr style="background:${COLORS.headerBg};color:${COLORS.headerText}">
      <th>RUNID</th><th>Start</th><th>ProcessName</th><th>C_PROCESS</th><th>User</th>
      <th>Success</th><th>Total</th><th>OK</th><th>Failed</th><th>Details</th>
    </tr>
    ${rows}
  </table>
  <p>Station: DXSCHEDULE02 | Server: ${stats.total > 0 ? 'CIS PROD' : 'N/A'}</p>
  </div>
  `;
}

export async function sendReport(jobs: JobDetail[], network?: NetworkResult) {
  if (!config.notify.to.length) { logger.warn('No NOTIFY_TO set, skipping email'); return; }
  if (!config.notify.smtp.host) { logger.warn('No SMTP_HOST set, skipping email'); return; }

  const transporter = nodemailer.createTransport({
    host: config.notify.smtp.host,
    port: config.notify.smtp.port,
    secure: config.notify.smtp.port === 465,
    auth: config.notify.smtp.user ? { user: config.notify.smtp.user, pass: config.notify.smtp.pass } : undefined,
  } as any);

  const stats = analyzeJobs(jobs);
  const statusIcon = stats.failed.length ? '🔴 FAILED' : '🟢 OK';
  const subject = `${statusIcon} [CIS] Job Report ${formatDate(new Date(), config.timeZone)} - Total:${stats.total} Failed:${stats.failed.length} Records:${stats.totalRecords}`;

  const html = buildHtmlReport(jobs, network);

  await transporter.sendMail({
    from: config.notify.from,
    to: config.notify.to.join(','),
    subject,
    html,
    // Mark failures as high priority in Outlook
    ...(stats.failed.length ? { priority: 'high' as const } : {}),
  });
  logger.info(`Email sent to ${config.notify.to.join(',')}`);
}

export async function sendTeams(jobs: JobDetail[], network?: NetworkResult) {
  if (!config.notify.teamsWebhook) return;
  const stats = analyzeJobs(jobs);
  const axios = (await import('axios')).default;
  const icon = stats.failed.length ? '🔴' : '🟢';
  const text = `${icon} CIS Report ${formatDateTime(new Date(), config.timeZone)} - Total:${stats.total} Failed:${stats.failed.length} Records:${stats.totalRecords}\n` +
               (stats.failed.length ? `❌ Failed: ${stats.failed.map(f=>`${f.ProcessName}(${f.I_RUNID}) Failed=${f.Failed}`).join(', ')}` : '✅ All OK') +
               (network ? `\nNetwork ${network.host}: Ping ${network.avgMs}ms ${network.ports.map(p=>`${p.port}:${p.ok?'OK':'FAIL'}`).join(' ')}` : '');
  await axios.post(config.notify.teamsWebhook, { text });
}