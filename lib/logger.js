import npmlog from 'npmlog';

function getLogger () {
  const logger = global._global_npmlog || npmlog;
  logger.maxRecordSize = 3000;
  if (!logger.debug) {
    logger.addLevel('debug', 1000, { fg: 'blue', bg: 'black' }, 'dbug');
  }
  return logger;
}

const log = getLogger('simctl');

export default log;
