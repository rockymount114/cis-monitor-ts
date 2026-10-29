import { getPool } from '../db/mssql.js';
import { SYS024_JOB_QUERY, JobDetail } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { config, CheckpointConfig } from '../config/index.js';
import { resolveCheckpointForTime } from '../utils/time.js';

export interface JobCountCheckResult {
  expected: number;
  actual: number;
  isMatch: boolean;
  diff: number; // actual - expected
  checkpointTime: string;
  checkpointLabel?: string;
  message: string;
}

export async function fetchJobDetails(): Promise<JobDetail[]> {
  const pool = await getPool();
  const result = await pool.request().query(SYS024_JOB_QUERY);
  logger.info(`Fetched ${result.recordset.length} jobs from SYS024`);
  return result.recordset as JobDetail[];
}

export function verifyJobCount(
  jobs: JobDetail[],
  checkpoint?: CheckpointConfig | null,
): JobCountCheckResult {
  const actual = jobs.length;
  const cp = checkpoint !== undefined && checkpoint !== null
    ? checkpoint
    : resolveCheckpointForTime(config.checkpoints, new Date(), config.timeZone);

  const expected = cp ? cp.expectedCount : 0;
  const checkpointTime = cp ? cp.time : 'N/A';
  const checkpointLabel = cp?.label;
  const diff = actual - expected;
  const isMatch = actual === expected;

  let message = '';
  if (isMatch) {
    message = `Job count matched: ${actual}/${expected} jobs completed as of ${checkpointTime}.`;
  } else if (actual < expected) {
    const missing = expected - actual;
    message = `Job count mismatch: Expected ${expected} jobs by ${checkpointTime}, but only found ${actual} (${missing} missing job${missing > 1 ? 's' : ''}).`;
  } else {
    const extra = actual - expected;
    message = `Job count mismatch: Expected ${expected} jobs by ${checkpointTime}, but found ${actual} (${extra} unexpected extra job${extra > 1 ? 's' : ''}).`;
  }

  return {
    expected,
    actual,
    isMatch,
    diff,
    checkpointTime,
    checkpointLabel,
    message,
  };
}

export function analyzeJobs(jobs: JobDetail[], checkpoint?: CheckpointConfig | null) {
  const failed = jobs.filter(j => j.Success === 'False' || (j.Failed && parseInt(j.Failed) > 0));
  const success = jobs.filter(j => j.Success === 'True');
  const byProcess = jobs.reduce((acc, j) => {
    acc[j.ProcessName] = (acc[j.ProcessName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalRecords = jobs.reduce((sum, j) => sum + (parseInt(j['Total records'] || '0') || 0), 0);
  const totalFailed = jobs.reduce((sum, j) => sum + (parseInt(j.Failed || '0') || 0), 0);
  const countCheck = verifyJobCount(jobs, checkpoint);

  return { total: jobs.length, failed, success, byProcess, totalRecords, totalFailed, countCheck };
}
