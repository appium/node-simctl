import appiumLogger from '@appium/logger';

const LOG_PREFIX = 'simctl';

function getLogger () {
  const logger = global._global_npmlog || appiumLogger;
  if (!logger.debug) {
    logger.addLevel('debug', 1000, { fg: 'blue', bg: 'black' }, 'dbug');
  }
  return logger;
}

const log = getLogger();

export { LOG_PREFIX };
export default log;
