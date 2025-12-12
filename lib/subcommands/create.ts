import _ from 'lodash';
import { log, LOG_PREFIX } from '../logger';
import { retryInterval } from 'asyncbox';
import { SIM_RUNTIME_NAME, normalizeVersion } from '../helpers';
import type { Simctl } from '../simctl';
import type { SimCreationOpts } from '../types';

const SIM_RUNTIME_NAME_SUFFIX_IOS = 'iOS';
const DEFAULT_CREATE_SIMULATOR_TIMEOUT = 10000;

/**
 * Create Simulator device with given name for the particular
 * platform type and version.
 *
 * @param name - The device name to be created.
 * @param deviceTypeId - Device type, for example 'iPhone 6'.
 * @param platformVersion - Platform version, for example '10.3'.
 * @param opts - Simulator options for creating devices.
 * @return The UDID of the newly created device.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
export async function createDevice (
  this: Simctl,
  name: string,
  deviceTypeId: string,
  platformVersion: string,
  opts: SimCreationOpts = {}
): Promise<string> {
  const {
    platform = SIM_RUNTIME_NAME_SUFFIX_IOS,
    timeout = DEFAULT_CREATE_SIMULATOR_TIMEOUT
  } = opts;

  const runtimeIds: string[] = [];

  // Try getting runtimeId using JSON flag
  try {
    runtimeIds.push(await this.getRuntimeForPlatformVersionViaJson(platformVersion, platform));
  } catch {}

  if (_.isEmpty(runtimeIds)) {
    // at first make sure that the runtime id is the right one
    // in some versions of Xcode it will be a patch version
    let runtimeId: string;
    try {
      runtimeId = await this.getRuntimeForPlatformVersion(platformVersion, platform);
    } catch {
      log.warn(`Unable to find runtime for iOS '${platformVersion}'. Continuing`);
      runtimeId = platformVersion;
    }

    // get the possible runtimes, which will be iterated over

    // start with major-minor version
    const potentialRuntimeIds = [normalizeVersion(runtimeId)];
    if (runtimeId.split('.').length === 3) {
      // add patch version if it exists
      potentialRuntimeIds.push(runtimeId);
    }

    // add modified versions, since modern Xcodes use this, then the bare
    // versions, to accomodate older Xcodes
    runtimeIds.push(
      ...(potentialRuntimeIds.map((id) => `${SIM_RUNTIME_NAME}${platform}-${id.replace(/\./g, '-')}`)),
      ...potentialRuntimeIds
    );
  }

  // go through the runtime ids and try to create a simulator with each
  let udid: string | undefined;
  for (const runtimeId of runtimeIds) {
    log.debug(LOG_PREFIX,
      `Creating simulator with name '${name}', device type id '${deviceTypeId}' and runtime id '${runtimeId}'`);
    try {
      const {stdout} = await this.exec('create', {
        args: [name, deviceTypeId, runtimeId]
      });
      udid = stdout.trim();
      break;
    } catch {
      // the error gets logged in `simExec`
    }
  }

  if (!udid) {
    throw new Error(`Could not create simulator with name '${name}', device ` +
      `type id '${deviceTypeId}', with runtime ids ` +
      `${runtimeIds.map((id) => `'${id}'`).join(', ')}`);
  }

  // make sure that it gets out of the "Creating" state
  const retries = parseInt(`${timeout / 1000}`, 10);
  await retryInterval(retries, 1000, async () => {
    const devices = _.flatMap(_.values(await this.getDevices()));
    for (const device of devices) {
      if (device.udid === udid) {
        if (device.state === 'Creating') {
          // need to retry
          throw new Error(`Device with udid '${udid}' still being created`);
        } else {
          // stop looking, we're done
          return;
        }
      }
    }
    throw new Error(`Device with udid '${udid}' not yet created`);
  });

  return udid;
}

