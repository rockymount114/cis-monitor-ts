import { getPool } from '../db/mssql.js';
import { SYS024_JOB_QUERY, JobDetail } from '../db/queries.js';
import { logger } from '../utils/logger.js';

export async function fetchJobDetails(): Promise<JobDetail[]> {
  const pool = await getPool();
  const result = await pool.request().query(SYS024_JOB_QUERY);
  logger.info(`Fetched ${result.recordset.length} jobs from SYS024`);
  return result.recordset as JobDetail[];
}

export function analyzeJobs(jobs: JobDetail[]) {
  const failed = jobs.filter(j => j.Success === 'False' || (j.Failed && parseInt(j.Failed) > 0));
  const success = jobs.filter(j => j.Success === 'True');
  const byProcess = jobs.reduce((acc, j) => {
    acc[j.ProcessName] = (acc[j.ProcessName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalRecords = jobs.reduce((sum, j) => sum + (parseInt(j['Total records'] || '0') || 0), 0);
  const totalFailed = jobs.reduce((sum, j) => sum + (parseInt(j.Failed || '0') || 0), 0);

  return { total: jobs.length, failed, success, byProcess, totalRecords, totalFailed };
}