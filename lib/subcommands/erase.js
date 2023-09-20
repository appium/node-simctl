import { retryInterval } from 'asyncbox';

const commands = {};

/**
 * Reset the content and settings of the particular Simulator.
 * It is required that Simulator is in _shutdown_ state.
 *
 * @this {import('../simctl').Simctl}
 * @param {number} [timeout=10000] - The maximum number of milliseconds to wait
 *                                   unit device reset is completed.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.eraseDevice = async function eraseDevice (timeout = 1000) {
  // retry erase with a sleep in between because it's flakey
  const retries = parseInt(`${timeout / 200}`, 10);
  await retryInterval(retries, 200,
    async () => await this.exec('erase', {
      args: [this.requireUdid('erase')]
    })
  );
};

export default commands;
