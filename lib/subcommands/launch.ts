import _ from 'lodash';
import { retryInterval } from 'asyncbox';
import type { Simctl } from '../simctl';

/**
 * Execute the particular application package on Simulator.
 * It is required that Simulator is in _booted_ state and
 * the application with given bundle identifier is already installed.
 *
 * @param bundleId - Bundle identifier of the application,
 *                            which is going to be removed.
 * @param tries - The maximum number of retries before
 *                             throwing an exception.
 * @return the actual command output
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function launchApp (this: Simctl, bundleId: string, tries: number = 5): Promise<string> {
  const result = await retryInterval(tries, 1000, async () => {
    const {stdout} = await this.exec('launch', {
      args: [this.requireUdid('launch'), bundleId],
    });
    return _.trim(stdout) || '';
  });
  return result || '';
}

