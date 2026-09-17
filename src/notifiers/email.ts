import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { JobDetail } from '../db/queries.js';
import { analyzeJobs } from '../services/jobService.js';
import { NetworkResult } from '../services/networkCheck.js';
import { logger } from '../utils/logger.js';

function buildHtmlReport(jobs: JobDetail[], network?: NetworkResult): string {
  const stats = analyzeJobs(jobs);
  const rows = jobs.map(j => `
    <tr style="background:${j.Success==='False' ? '#fee' : '#fff'}">
      <td>${j.I_RUNID}</td><td>${new Date(j.T_START).toLocaleString()}</td><td>${j.ProcessName}</td>
      <td>${j.C_PROCESS}</td><td>${j.C_USERID}</td><td>${j.Success}</td>
      <td>${j['Total records']||''}</td><td>${j['Successfully processed']||''}</td><td>${j.Failed||''}</td>
      <td>${(j.ResultDetails||'').substring(0,200)}</td>
    </tr>`).join('');

  return `
  <h2>CIS Daily Report - ${new Date().toLocaleString()}</h2>
  <h3>Summary</h3>
  <ul>
    <li>Total Jobs (last 2 days): ${stats.total}</li>
    <li>Total Records: ${stats.totalRecords} | Failed: ${stats.totalFailed}</li>
    <li>Failed Jobs: ${stats.failed.length}</li>
    <li>By Process: ${Object.entries(stats.byProcess).map(([k,v])=>`${k}: ${v}`).join(', ')}</li>
  </ul>
  ${network ? `<h3>Network Check ${network.host}</h3><p>Ping: ${network.pingOk ? 'OK' : 'FAIL'} ${network.avgMs}ms | DNS: ${network.dnsOk ? 'OK' : 'FAIL'}<br/>Ports: ${network.ports.map(p=>`${p.port}=${p.ok?'OK':'FAIL'}(${p.ms}ms)`).join(', ')}</p>` : ''}
  ${stats.failed.length ? `<h3 style="color:red">Failed Jobs Detail</h3><ul>${stats.failed.map(f=>`<li>${f.I_RUNID} ${f.ProcessName} Failed=${f.Failed} ${f.ResultDetails||''} ${f.Feedback||''}</li>`).join('')}</ul>` : '<p style="color:green">No failed jobs</p>'}
  <h3>All Jobs</h3>
  <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">
    <tr><th>RUNID</th><th>Start</th><th>ProcessName</th><th>C_PROCESS</th><th>User</th><th>Success</th><th>Total</th><th>OK</th><th>Failed</th><th>Details</th></tr>
    ${rows}
  </table>
  <p>Station: DXSCHEDULE02 | Server: ${stats.total>0 ? 'CIS PROD' : 'N/A'}</p>
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
  const subject = `[CIS] Job Report ${new Date().toLocaleDateString()} - Total:${stats.total} Failed:${stats.failed.length} Records:${stats.totalRecords}`;

  const html = buildHtmlReport(jobs, network);

  await transporter.sendMail({
    from: config.notify.from,
    to: config.notify.to.join(','),
    subject,
    html,
  });
  logger.info(`Email sent to ${config.notify.to.join(',')}`);
}

export async function sendTeams(jobs: JobDetail[], network?: NetworkResult) {
  if (!config.notify.teamsWebhook) return;
  const stats = analyzeJobs(jobs);
  const axios = (await import('axios')).default;
  const text = `CIS Report ${new Date().toLocaleString()} - Total:${stats.total} Failed:${stats.failed.length} Records:${stats.totalRecords}\n` +
               (stats.failed.length ? `Failed: ${stats.failed.map(f=>`${f.ProcessName}(${f.I_RUNID}) Failed=${f.Failed}`).join(', ')}` : 'All OK') +
               (network ? `\nNetwork ${network.host}: Ping ${network.avgMs}ms ${network.ports.map(p=>`${p.port}:${p.ok?'OK':'FAIL'}`).join(' ')}` : '');
  await axios.post(config.notify.teamsWebhook, { text });
}