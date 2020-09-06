import npmlog from 'npmlog';

function getLogger () {
  const logger = global._global_npmlog || npmlog;
  logger.maxRecordSize = 3000;
  if (!logger.debug) {
    logger.addLevel('debug', 1000, { fg: 'blue', bg: 'black' }, 'dbug');
  }
  const originalLog = logger.log.bind(logger);
  logger.log = (level, prefix, ...args) => originalLog(level, 'simctl', prefix, ...args);
  return logger;
}

const log = getLogger();

export default log;
