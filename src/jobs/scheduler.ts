import cron from 'node-cron';
import { fetchJobDetails } from '../services/jobService.js';
import { checkNetwork } from '../services/networkCheck.js';
import { sendReport, sendTeams } from '../notifiers/email.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export async function runOnce() {
  logger.info('=== Running scheduled CIS check ===');
  try {
    const [jobs, network] = await Promise.all([
      fetchJobDetails(),
      checkNetwork()
    ]);
    await Promise.all([sendReport(jobs, network), sendTeams(jobs, network)]);
    logger.info('Report sent');
    return { jobs, network };
  } catch (e: any) {
    logger.error(`Scheduled run failed: ${e.message} ${e.stack}`);
    throw e;
  }
}

export function startScheduler() {
  logger.info(`Starting scheduler with crons: ${config.cronTimes.join(', ')} (timezone: ${config.timeZone})`);
  for (const cronExpr of config.cronTimes) {
    if (!cron.validate(cronExpr)) {
      logger.error(`Invalid cron: ${cronExpr}`);
      continue;
    }
    cron.schedule(cronExpr, async () => {
      logger.info(`Cron triggered: ${cronExpr}`);
      await runOnce().catch(()=>{});
    }, { timezone: config.timeZone });
    logger.info(`Scheduled: ${cronExpr} (${config.timeZone})`);
  }
}