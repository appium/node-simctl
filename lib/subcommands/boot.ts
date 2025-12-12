import _ from 'lodash';
import { log, LOG_PREFIX } from '../logger';
import type { Simctl } from '../simctl';

/**
 * Boot the particular Simulator if it is not running.
 *
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function bootDevice (this: Simctl): Promise<void> {
  try {
    await this.exec('boot', {
      args: [this.requireUdid('boot')]
    });
  } catch (e: any) {
    if (_.includes(e.message, 'Unable to boot device in current state: Booted')) {
      throw e;
    }
    log.debug(LOG_PREFIX, `Simulator already in 'Booted' state. Continuing`);
  }
}
