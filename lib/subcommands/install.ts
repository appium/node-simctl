import type { Simctl } from '../simctl';

/**
 * Install the particular application package on Simulator.
 * It is required that Simulator is in _booted_ state.
 *
 * @param appPath - Full path to .app package, which is
 *                           going to be installed.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function installApp (this: Simctl, appPath: string): Promise<void> {
  await this.exec('install', {
    args: [this.requireUdid('install'), appPath],
  });
}

