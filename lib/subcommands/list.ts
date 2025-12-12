import _ from 'lodash';
import { SIM_RUNTIME_NAME, normalizeVersion } from '../helpers';
import { log, LOG_PREFIX } from '../logger';
import type { Simctl } from '../simctl';
import type { DeviceInfo } from '../types';

/**
 * Parse the list of existing Simulator devices to represent
 * it as convenient mapping.
 *
 * @param platform - The platform name, for example 'watchOS'.
 * @return The resulting mapping. Each key is platform version,
 *                  for example '10.3' and the corresponding value is an
 *                  array of the matching DeviceInfo instances.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
export async function getDevicesByParsing (
  this: Simctl,
  platform?: string | null
): Promise<Record<string, DeviceInfo[]>> {
  const {stdout} = await this.exec('list', {
    args: ['devices'],
  });

  // expect to get a listing like
  // -- iOS 8.1 --
  //     iPhone 4s (3CA6E7DD-220E-45E5-B716-1E992B3A429C) (Shutdown)
  //     ...
  // -- iOS 8.2 --
  //     iPhone 4s (A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E) (Shutdown)
  //     ...
  // so, get the `-- iOS X.X --` line to find the sdk (X.X)
  // and the rest of the listing in order to later find the devices
  const deviceSectionRe = _.isEmpty(platform) || !platform
    ? new RegExp(`\\-\\-\\s+(\\S+)\\s+(\\S+)\\s+\\-\\-(\\n\\s{4}.+)*`, 'mgi')
    : new RegExp(`\\-\\-\\s+${_.escapeRegExp(platform)}\\s+(\\S+)\\s+\\-\\-(\\n\\s{4}.+)*`, 'mgi');
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  // make an entry for each sdk version
  while ((match = deviceSectionRe.exec(stdout))) {
    matches.push(match);
  }
  if (_.isEmpty(matches)) {
    throw new Error('Could not find device section');
  }

  const lineRe = /([^\s].+) \((\w+-.+\w+)\) \((\w+\s?\w+)\)/; // https://regex101.com/r/lG7mK6/3
  // get all the devices for each sdk
  const devices: Record<string, DeviceInfo[]> = {};
  for (match of matches) {
    const sdk = platform ? match[1] : match[2];
    devices[sdk] = devices[sdk] || [];
    // split the full match into lines and remove the first
    for (const line of match[0].split('\n').slice(1)) {
      if (line.includes('(unavailable, ')) {
        continue;
      }
      // a line is something like
      //    iPhone 4s (A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E) (Shutdown)
      // retrieve:
      //   iPhone 4s
      //   A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E
      //   Shutdown
      const lineMatch = lineRe.exec(line);
      if (!lineMatch) {
        throw new Error(`Could not match line: ${line}`);
      }
      // save the whole thing as ab object in the list for this sdk
      devices[sdk].push({
        name: lineMatch[1],
        udid: lineMatch[2],
        state: lineMatch[3],
        sdk,
        platform: platform || match[1],
      });
    }
  }
  return devices;
}

/**
 * Parse the list of existing Simulator devices to represent
 * it as convenient mapping for the particular platform version.
 *
 * @param forSdk - The sdk version,
 *                           for which the devices list should be parsed,
 *                           for example '10.3'.
 * @param platform - The platform name, for example 'watchOS'.
 * @return If _forSdk_ is set then the list
 *                                    of devices for the particular platform version.
 *                                    Otherwise the same result as for getDevicesByParsing
 *                                    function.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code or if no matching
 *                 platform version is found in the system.
 */
export async function getDevices (
  this: Simctl,
  forSdk: string,
  platform?: string | null
): Promise<DeviceInfo[]>;
export async function getDevices (
  this: Simctl,
  forSdk?: undefined | null,
  platform?: string | null
): Promise<Record<string, DeviceInfo[]>>;
export async function getDevices (
  this: Simctl,
  forSdk?: string | null,
  platform?: string | null
): Promise<Record<string, DeviceInfo[]> | DeviceInfo[]> {
  let devices: Record<string, DeviceInfo[]> = {};
  try {
    const {stdout} = await this.exec('list', {
      args: ['devices', '-j'],
    });
    /* JSON should be
     * {
     *   "devices" : {
     *     "iOS <sdk>" : [ // or
     *     "com.apple.CoreSimulator.SimRuntime.iOS-<sdk> : [
     *       {
     *         "state" : "Booted",
     *         "availability" : "(available)",
     *         "isAvailable" : true,
     *         "name" : "iPhone 6",
     *         "udid" : "75E34140-18E8-4D1A-9F45-AAC735DF75DF"
     *       }
     *     ]
     *   }
     * }
     */
    const versionMatchRe = _.isEmpty(platform) || !platform
      ? new RegExp(`^([^\\s-]+)[\\s-](\\S+)`, 'i')
      : new RegExp(`^${_.escapeRegExp(platform)}[\\s-](\\S+)`, 'i');
    for (const [sdkNameRaw, entries] of _.toPairs(JSON.parse(stdout).devices)) {
      // there could be a longer name, so remove it
      const sdkName = sdkNameRaw.replace(SIM_RUNTIME_NAME, '');
      const versionMatch = versionMatchRe.exec(sdkName);
      if (!versionMatch) {
        continue;
      }

      // the sdk can have dashes (`12-2`) or dots (`12.1`)
      const sdk = (platform ? versionMatch[1] : versionMatch[2]).replace('-', '.');
      devices[sdk] = devices[sdk] || [];
      devices[sdk].push(...(entries as any[]).filter((el) => _.isUndefined(el.isAvailable) || el.isAvailable)
        .map((el: any) => {
          delete el.availability;
          return {
            sdk,
            ...el,
            platform: platform || versionMatch[1],
          };
        })
      );
    }
  } catch (err: any) {
    log.debug(LOG_PREFIX, `Unable to get JSON device list: ${err.stack}`);
    log.debug(LOG_PREFIX, 'Falling back to manual parsing');
    devices = await this.getDevicesByParsing(platform);
  }

  if (!forSdk) {
    return devices;
  }
  // if a `forSdk` was passed in, return only the corresponding list
  if (devices[forSdk]) {
    return devices[forSdk];
  }

  let errMsg = `'${forSdk}' does not exist in the list of simctl SDKs.`;
  const availableSDKs = _.keys(devices);
  errMsg += availableSDKs.length
    ? ` Only the following Simulator SDK versions are available on your system: ${availableSDKs.join(', ')}`
    : ` No Simulator SDK versions are available on your system. Please install some via Xcode preferences.`;
  throw new Error(errMsg);
}

/**
 * Get the runtime for the particular platform version using --json flag
 *
 * @param platformVersion - The platform version name,
 *                                   for example '10.3'.
 * @param platform - The platform name, for example 'watchOS'.
 * @return The corresponding runtime name for the given
 *                  platform version.
 */
export async function getRuntimeForPlatformVersionViaJson (
  this: Simctl,
  platformVersion: string,
  platform: string = 'iOS'
): Promise<string> {
  const {stdout} = await this.exec('list', {
    args: ['runtimes', '--json'],
  });
  for (const {version, identifier, name} of JSON.parse(stdout).runtimes) {
    if (normalizeVersion(version) === normalizeVersion(platformVersion)
      && name.toLowerCase().startsWith(platform.toLowerCase())) {
      return identifier;
    }
  }
  throw new Error(`Could not use --json flag to parse platform version`);
}

/**
 * Get the runtime for the particular platform version.
 *
 * @param platformVersion - The platform version name,
 *                                   for example '10.3'.
 * @param platform - The platform name, for example 'watchOS'.
 * @return The corresponding runtime name for the given
 *                  platform version.
 */
export async function getRuntimeForPlatformVersion (
  this: Simctl,
  platformVersion: string,
  platform: string = 'iOS'
): Promise<string> {
  // Try with parsing
  try {
    const {stdout} = await this.exec('list', {
      args: ['runtimes'],
    });
    // https://regex101.com/r/UykjQZ/1
    const runtimeRe =
      new RegExp(`${_.escapeRegExp(platform)}\\s+(\\d+\\.\\d+)\\s+\\((\\d+\\.\\d+\\.*\\d*)`, 'i');
    for (const line of stdout.split('\n')) {
      const match = runtimeRe.exec(line);
      if (match && match[1] === platformVersion) {
        return match[2];
      }
    }
  } catch {}

  // if nothing was found, pass platform version back
  return platformVersion;
}

/**
 * Get the list of device types available in the current Xcode installation
 *
 * @return List of the types of devices available
 * @throws {Error} If the corresponding simctl command fails
 */
export async function getDeviceTypes (this: Simctl): Promise<string[]> {
  const {stdout} = await this.exec('list', {
    args: ['devicetypes', '-j'],
  });
  /*
   * JSON will be like:
   *   {
   *     "devicetypes" : [
   *       {
   *         "name" : "iPhone 4s",
   *         "identifier" : "com.apple.CoreSimulator.SimDeviceType.iPhone-4s"
   *       },
   *       ...
   *   }
   */
  try {
    const deviceTypes = JSON.parse(stdout.trim());
    return deviceTypes.devicetypes.map((type: any) => type.name);
  } catch (err: any) {
    throw new Error(`Unable to get list of device types: ${err.message}`);
  }
}

/**
 * Get the full list of runtimes, devicetypes, devices and pairs as Object
 *
 * @return Object containing device types, runtimes devices and pairs.
 * The resulting JSON will be like:
 *   {
 *     "devicetypes" : [
 *       {
 *         "name" : "iPhone 4s",
 *         "identifier" : "com.apple.CoreSimulator.SimDeviceType.iPhone-4s"
 *       },
 *       ...
 *      ],
 *     "runtimes" : [
 *       {
 *         "version" : '13.0',
 *         "bundlePath" : '/Applications/Xcode11beta4.app/Contents/Developer/Platforms/iPhoneOS.platform/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS.simruntime',
 *         "isAvailable" : true,
 *         "name" : 'iOS 13.0',
 *         "identifier" : 'com.apple.CoreSimulator.SimRuntime.iOS-13-0',
 *         "buildversion" : '17A5534d'
 *       },
 *       ...
 *      },
 *     "devices" :
 *       {
 *         'com.apple.CoreSimulator.SimRuntime.iOS-13-0': [ [Object], [Object] ] },
 *         ...
 *       },
 *     "pairs" : {} }
 *
 *   }
 * @throws {Error} If the corresponding simctl command fails
 */
export async function list (this: Simctl): Promise<any> {
  const {stdout} = await this.exec('list', {
    args: ['-j'],
  });
  try {
    return JSON.parse(stdout.trim());
  } catch (e: any) {
    throw new Error(`Unable to parse simctl list: ${e.message}`);
  }
}

