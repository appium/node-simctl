import type { Simctl } from '../simctl';

/**
 * Terminate the given running application on Simulator.
 * It is required that Simulator is in _booted_ state.
 *
 * @param bundleId - Bundle identifier of the application,
 *                            which is going to be terminated.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function terminateApp (this: Simctl, bundleId: string): Promise<void> {
  await this.exec('terminate', {
    args: [this.requireUdid('terminate'), bundleId],
  });
}

