import type { Simctl } from '../simctl';

/**
 * Get the full path to the particular application container
 * on the local file system. Note, that this subcommand throws
 * an error if bundle id of a system application is provided,
 * like 'com.apple.springboard'.
 * It is required that Simulator is in _booted_ state.
 *
 * @param bundleId - Bundle identifier of an application.
 * @param containerType - Which container type to return. Possible values
 *                                  are 'app', 'data', 'groups', '<A specific App Group container>'.
 *                                  The default value is 'app'.
 * @return Full path to the given application container on the local
 *                  file system.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function getAppContainer (
  this: Simctl,
  bundleId: string,
  containerType: string | null = null
): Promise<string> {
  const args = [this.requireUdid('get_app_container'), bundleId];
  if (containerType) {
    args.push(containerType);
  }
  const {stdout} = await this.exec('get_app_container', {args});
  return (stdout || '').trim();
}

