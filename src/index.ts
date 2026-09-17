import { startScheduler, runOnce } from './jobs/scheduler.js';
import { logger } from './utils/logger.js';
import { closePool } from './db/mssql.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--once')) {
    await runOnce();
    await closePool();
    process.exit(0);
  }

  logger.info('CIS Monitor TS starting...');
  startScheduler();
  // run once at startup for testing
  await runOnce().catch(e => logger.error(e.message));

  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await closePool();
    process.exit(0);
  });
}

main();