import _ from 'lodash';
import { retryInterval } from 'asyncbox';

const commands = {};

/**
 * Execute the particular application package on Simulator.
 * It is required that Simulator is in _booted_ state and
 * the application with given bundle identifier is already installed.
 *
 * @this {import('../simctl').Simctl}
 * @param {string} bundleId - Bundle identifier of the application,
 *                            which is going to be removed.
 * @param {number} [tries=5] - The maximum number of retries before
 *                             throwing an exception.
 * @return {Promise<string>} the actual command output
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.launchApp = async function launchApp (bundleId, tries = 5) {
  // @ts-ignore A string will always be returned
  return await retryInterval(tries, 1000, async () => {
    const {stdout} = await this.exec('launch', {
      args: [this.requireUdid('launch'), bundleId],
    });
    return _.trim(stdout);
  });
};

export default commands;
