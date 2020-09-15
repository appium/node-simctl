import _ from 'lodash';
import log, { LOG_PREFIX } from '../logger';

const commands = {};

/**
 * Shutdown the given Simulator if it is running.
 *
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.shutdownDevice = async function shutdownDevice () {
  try {
    await this.exec('shutdown', {
      args: [this.requireUdid('shutdown')],
    });
  } catch (e) {
    if (!_.includes(e.message, 'current state: Shutdown')) {
      throw e;
    }
    log.debug(LOG_PREFIX, `Simulator already in 'Shutdown' state. Continuing`);
  }
};

export default commands;
