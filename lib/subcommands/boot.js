import _ from 'lodash';
import log, { LOG_PREFIX } from '../logger';


const commands = {};

/**
 * Boot the particular Simulator if it is not running.
 *
 * @this {import('../simctl').Simctl}
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.bootDevice = async function bootDevice () {
  try {
    await this.exec('boot', {
      args: [this.requireUdid('boot')]
    });
  } catch (e) {
    if (_.includes(e.message, 'Unable to boot device in current state: Booted')) {
      throw e;
    }
    log.debug(LOG_PREFIX, `Simulator already in 'Booted' state. Continuing`);
  }
};

export default commands;
