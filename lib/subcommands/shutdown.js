import _ from 'lodash';
import log from '../logger';


const commands = {};

/**
 * Shutdown the given Simulator if it is running.
 *
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
commands.shutdown = async function shutdown () {
  try {
    await this.exec('shutdown', {
      args: [this.requireUdid('shutdown')],
    });
  } catch (e) {
    if (!_.includes(e.message, 'current state: Shutdown')) {
      throw e;
    }
    log.debug(`Simulator already in 'Shutdown' state. Continuing`);
  }
};

export default commands;
