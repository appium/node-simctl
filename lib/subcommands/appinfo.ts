import type { Simctl } from '../simctl';
import type { AppInfo } from '../types';
import { convertPlistToJson } from '../helpers';
import _ from 'lodash';

/**
 * Get information about an app installed on the simulator
 *
 * @param bundleId - Bundle identifier of the application
 * @return App info object
 * @throws {Error} If the app is not found
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function appInfo (this: Simctl, bundleId: string): Promise<AppInfo> {
  const {stdout} = await this.exec('appinfo', {
    args: [this.requireUdid('appinfo'), bundleId],
  });
  let result: any;
  try {
    result = JSON.parse(stdout);
  } catch {
    // If JSON parsing fails, use plutil to convert plist-style output to JSON
    try {
      result = await convertPlistToJson(stdout);
    } catch (err) {
      throw new Error(
        `Cannot retrieve app info for ${bundleId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (!_.isPlainObject(result) || !('ApplicationType' in result)) {
    throw new Error(`App with bundle identifier "${bundleId}" not found. Is it installed?`);
  }

  return result as AppInfo;
}
