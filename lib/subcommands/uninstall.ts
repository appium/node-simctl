import type { Simctl } from '../simctl';

/**
 * Remove the particular application package from Simulator.
 * It is required that Simulator is in _booted_ state and
 * the application with given bundle identifier is already installed.
 *
 * @param bundleId - Bundle identifier of the application,
 *                            which is going to be removed.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function removeApp (this: Simctl, bundleId: string): Promise<void> {
  await this.exec('uninstall', {
    args: [this.requireUdid('uninstall'), bundleId],
  });
}

