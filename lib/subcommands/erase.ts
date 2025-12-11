import { retryInterval } from 'asyncbox';
import type { Simctl } from '../simctl';

/**
 * Reset the content and settings of the particular Simulator.
 * It is required that Simulator is in _shutdown_ state.
 *
 * @param timeout - The maximum number of milliseconds to wait
 *                                   unit device reset is completed.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function eraseDevice (this: Simctl, timeout: number = 1000): Promise<void> {
  // retry erase with a sleep in between because it's flakey
  const retries = parseInt(`${timeout / 200}`, 10);
  await retryInterval(retries, 200,
    async () => await this.exec('erase', {
      args: [this.requireUdid('erase')]
    })
  );
}

