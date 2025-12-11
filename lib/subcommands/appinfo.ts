import type { Simctl } from '../simctl';

/**
 * Get information about an app installed on the simulator
 *
 * @param bundleId - Bundle identifier of the application
 * @return Promise resolving to app info object
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function appInfo (this: Simctl, bundleId: string): Promise<any> {
  const {stdout} = await this.exec('appinfo', {
    args: [this.requireUdid('appinfo'), bundleId],
  });
  return JSON.parse(stdout);
}
