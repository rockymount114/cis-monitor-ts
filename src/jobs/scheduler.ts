import cron from 'node-cron';
import { fetchJobDetails } from '../services/jobService.js';
import { checkNetwork } from '../services/networkCheck.js';
import { sendReport, sendTeams } from '../notifiers/email.js';
import { logger } from '../utils/logger.js';
import { config, CheckpointConfig } from '../config/index.js';

export async function runOnce(checkpoint?: CheckpointConfig | null) {
  logger.info('=== Running scheduled CIS check ===');
  if (checkpoint) {
    logger.info(`Checkpoint context: [${checkpoint.time}] expected ${checkpoint.expectedCount} jobs (${checkpoint.label || 'batch'})`);
  } else {
    logger.info('Running with dynamic checkpoint resolution based on current time');
  }

  try {
    const [jobs, network] = await Promise.all([
      fetchJobDetails(),
      checkNetwork()
    ]);
    await Promise.all([
      sendReport(jobs, network, checkpoint),
      sendTeams(jobs, network, checkpoint)
    ]);
    logger.info('Report sent');
    return { jobs, network };
  } catch (e: any) {
    logger.error(`Scheduled run failed: ${e.message} ${e.stack}`);
    throw e;
  }
}

export function startScheduler() {
  logger.info(`Starting scheduler with ${config.checkpoints.length} checkpoints (timezone: ${config.timeZone}):`);
  for (const cp of config.checkpoints) {
    logger.info(`  - [${cp.time}] expected jobs: ${cp.expectedCount}, cron: "${cp.cron}" (${cp.label || 'batch'})`);
    if (!cron.validate(cp.cron)) {
      logger.error(`Invalid cron expression for checkpoint ${cp.time}: ${cp.cron}`);
      continue;
    }
    cron.schedule(cp.cron, async () => {
      logger.info(`Cron triggered for checkpoint [${cp.time}] (expected: ${cp.expectedCount} jobs): ${cp.cron}`);
      await runOnce(cp).catch(() => {});
    }, { timezone: config.timeZone });
    logger.info(`Scheduled: ${cp.cron} -> ${cp.time} (expected ${cp.expectedCount} jobs) (${config.timeZone})`);
  }
}
