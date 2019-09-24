import { exec, SubProcess } from 'teen_process';
import { retryInterval, waitForCondition } from 'asyncbox';
import { logger, fs, tempDir, util } from 'appium-support';
import _ from 'lodash';
import { getClangVersion, getVersion } from 'appium-xcode';


const log = logger.getLogger('simctl');

// command line tools and xcode version can be different
const CMDLINE_TOOLS_CLANG_FORMAT_CHANGED_VERSION = '1001.0.46';
const XCODE_FORMAT_CHANGED_VERSION = '10.2';

const SIM_RUNTIME_NAME = 'com.apple.CoreSimulator.SimRuntime.';
const SIM_RUNTIME_NAME_SUFFIX_IOS = 'iOS';
const DEFAULT_CREATE_SIMULATOR_TIMEOUT = 10000;

/**
 * Execute the particular simctl command and return the output.
 *
 * @param {string} command - One of available simctl subcommands.
 *                           Execute `xcrun simctl` in Terminal to see the full list
 *                           of available subcommands.
 * @param {number} timeout - Command execution timeout in milliseconds.
 *                           Set it to zero to skip waiting for command
 *                           execution.
 * @param {Array.<string>} args [[]] - The list of additional subcommand arguments.
 *                                     It's empty by default.
 * @param {Object} env [{}] - Environment variables mapping. All these variables
 *                            will be passed Simulator and used in _executingFunction_.
 * @param {Function} executingFunction - Executing function object. Equals to teen_process's
 *                                       _exec_ by default.
 * @param {boolean} logErrors [true] - Set it to _false_ to throw execution errors
 *                                     immediately without logging any additional information.
 * @return {Object} The result of _executingFunction_.
 * @throws {Error} If the simctl subcommand command executed by _executingFunction_
 *                 returns non-zero return code.
 */
async function simCommand (command, timeout, args = [], env = {}, executingFunction = exec, logErrors = true) {
  // run a particular simctl command
  args = ['simctl', command, ...args];
  // Prefix all passed in environment variables with 'SIMCTL_CHILD_', simctl
  // will then pass these to the child (spawned) process.
  env = _.defaults(_.mapKeys(env, (value, key) => {
    return `SIMCTL_CHILD_${key}`;
  }), process.env);

  try {
    return await executingFunction('xcrun', args, {timeout, env});
  } catch (e) {
    if (!logErrors) {
      // if we don't want to see the errors, just throw and allow the calling
      // code do what it wants
      throw e;
    } else if (e.stderr) {
      log.errorAndThrow(`simctl error running '${command}': ${e.stderr.trim()}`);
    } else {
      log.errorAndThrow(e);
    }
  }
}

/**
 * @typedef {Object} ExecResult
 * @property {?string} stdout - Process stdout.
 * @property {?string} stderr - Process stderr.
 * @property {number} code - Process exit code.
 */

/**
 * Execute the particular simctl subcommand synchronously and
 * wait for the output.
 *
 * @param {string} command - See {@link simCommand} parameters.
 * @param {number} timeout - See {@link simCommand} parameters.
 * @param {Array.<string>} args [[]] - See {@link simCommand} parameters.
 * @param {Object} env [{}] - See {@link simCommand} parameters.
 * @param {boolean} logErrors [true] - See {@link simCommand} parameters.
 * @return {ExecResult} The result of _exec_ function.
 * @throws {Error} If the simctl subcommand command executed by exec
 *                 returns non-zero return code.
 */
async function simExec (command, timeout, args = [], env = {}, logErrors = true) {
  return await simCommand(command, timeout, args, env, async (c, a, ob) => {
    return await exec(c, a, ob);
  }, logErrors);
}

/**
 * Crate a teen_process's SubProcess instance for the particular
 * simctl subcommand execution. This might be needed to gain better
 * control over the execution process.
 *
 * @param {string} command - See {@link simCommand} parameters.
 * @param {number} timeout - See {@link simCommand} parameters.
 * @param {Array.<string>} args [[]] - See {@link simCommand} parameters.
 * @param {Object} env [{}] - See {@link simCommand} parameters.
 * @return {SubProcess} The instance of teen_process's SubProcess class.
 */
async function simSubProcess (command, timeout, args = [], env = {}) {
  return await simCommand(command, timeout, args, env, (c, a, ob) => {
    return new SubProcess(c, a, ob);
  });
}

/**
 * Install the particular application package on Simulator.
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string} appPath - Full path to .app package, which is
 *                           going to be installed.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function installApp (udid, appPath) {
  await simExec('install', 0, [udid, appPath]);
}

/**
 * Boot the particular Simulator if it is not running.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function bootDevice (udid) {
  try {
    await simExec('boot', 0, [udid]);
  } catch (err) {
    if ((err.message || '').indexOf('Unable to boot device in current state: Booted') === -1) {
      throw err;
    }
    log.debug(`Simulator already in 'Booted' state. Continuing`);
  }
}

/**
 * Remove the particular application package from Simulator.
 * It is required that Simulator is in _booted_ state and
 * the application with given bundle identifier is already installed.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string} bundleId - Bundle identifier of the application,
 *                            which is going to be removed.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function removeApp (udid, bundleId) {
  await simExec('uninstall', 0, [udid, bundleId]);
}

/**
 * Execute the particular application package on Simulator.
 * It is required that Simulator is in _booted_ state and
 * the application with given bundle identifier is already installed.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string} bundleId - Bundle identifier of the application,
 *                            which is going to be removed.
 * @param {number} tries [5] - The maximum number of retries before
 *                             throwing an exception.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function launch (udid, bundleId, tries = 5) {
  await retryInterval(tries, 1000, async () => {
    await simExec('launch', 0, [udid, bundleId]);
  });
}

/**
 * Spawn the particular process on Simulator.
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string|Array<string>} args - Spawn arguments
 * @param {object} env [{}] - Additional environment variables mapping.
 * @return {ExecResult} Command execution result.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function spawn (udid, args, env = {}) {
  return await simExec('spawn', 0, [udid, ...(_.isArray(args) ? args : [args])], env);
}

/**
 * Prepare SubProcess instance for a new process, which is going to be spawned
 * on Simulator.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string|Array<string>} args - Spawn arguments
 * @param {object} env [{}] - Additional environment variables mapping.
 * @return {SubProcess} The instance of the process to be spawned.
 */
async function spawnSubProcess (udid, args, env = {}) {
  return await simSubProcess('spawn', 0, [udid, ...(_.isArray(args) ? args : [args])], env);
}

/**
 * Open URL scheme on Simulator. iOS will automatically try
 * to find a matching application, which supports the given scheme.
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string} url - The URL scheme to open, for example http://appiom.io
 *                       will be opened by the built-in mobile browser.
 * @return {ExecResult} Command execution result.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function openUrl (udid, url) {
  return await simExec('openurl', 0, [udid, url]);
}

/**
 * Invoke hidden appinfo subcommand to get the information
 * about applications installed on Simulator, including
 * system applications ({@link getAppContainer} does not "see" such apps).
 * Simulator server should be in 'booted' state for this call to work properly.
 * The tool is only available since Xcode SDK 8.1
 *
 * @param {string} udid - UDID of the target Simulator.
 * @param {string} bundleId - The bundle identifier of the target application.
 * @return {string} The information about installed application.
 *
 * Example output for non-existing application container:
 * <pre>
 * {
 *   CFBundleIdentifier = "com.apple.MobileSafari";
 *   GroupContainers =     {
 *   };
 *   SBAppTags =     (
 *   );
 * }
 * </pre>
 *
 * Example output for an existing system application container:
 * <pre>
 * {
 *   ApplicationType = Hidden;
 *   Bundle = "file:///Applications/Xcode-beta.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/CoreSimulator/Profiles/Runtimes/iOS.simruntime/Contents/Resources/RuntimeRoot/System/Library/CoreServices/SpringBoard.app";
 *   CFBundleDisplayName = SpringBoard;
 *   CFBundleExecutable = SpringBoard;
 *   CFBundleIdentifier = "com.apple.springboard";
 *   CFBundleName = SpringBoard;
 *   CFBundleVersion = 50;
 *   GroupContainers =     {
 *   };
 *   Path = "/Applications/Xcode-beta.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/CoreSimulator/Profiles/Runtimes/iOS.simruntime/Contents/Resources/RuntimeRoot/System/Library/CoreServices/SpringBoard.app";
 *   SBAppTags =     (
 *   );
 * }
 * </pre>
 */
async function appInfo (udid, bundleId) {
  const {stdout} = await simExec('appinfo', 0, [udid, bundleId]);
  return (stdout || '').trim();
}

/**
 * Add the particular media file to Simulator's library.
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string} path - Full path to a media file on the local
 *                        file system.
 * @return {ExecResult} Command execution result.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function addMedia (udid, path) {
  return await simExec('addmedia', 0, [udid, path]);
}

/**
 * Terminate the given running application on Simulator.
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string} bundleId - Bundle identifier of the application,
 *                            which is going to be terminated.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function terminate (udid, bundleId) {
  await simExec('terminate', 0, [udid, bundleId]);
}

/**
 * Get the full path to the particular application container
 * on the local file system. Note, that this subcommand throws
 * an error if bundle id of a system application is provided,
 * like 'com.apple.springboard'.
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string} bundleId - Bundle identifier of an application.
 * @param {?boolean} logErrors [true] - Whether to include exec's command
 *                                      stderr output into exception message if thrown.
 * @param {?string} containerType - Which container type to return. Possible values
 *                                  are 'app', 'data', 'groups', '<A specific App Group container>'.
 *                                  The default value is 'app'.
 * @return {string} Full path to the given application container on the local
 *                  file system.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function getAppContainer (udid, bundleId, logErrors = true, containerType = null) {
  const args = [udid, bundleId];
  if (containerType) {
    args.push(containerType);
  }
  const {stdout} = await simExec('get_app_container', 0, args, {}, logErrors);
  return (stdout || '').trim();
}

/**
 * Shutdown the given Simulator if it is running.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function shutdown (udid) {
  try {
    await simExec('shutdown', 0, [udid]);
  } catch (err) {
    if (!(err + '').includes('current state: Shutdown')) {
      throw err;
    }
    log.debug(`Simulator already in 'Shutdown' state. Continuing`);
  }
}

/**
 * @typedef {Object} SimCreationOpts
 * @property {string} platform [iOS] - Platform name in order to specify runtime such as 'iOS', 'tvOS', 'watchOS'
 * @property {number} timeout [10000] - The maximum number of milliseconds to wait
 *                                      unit device creation is completed.
 */
/**
 * Create Simulator device with given name for the particular
 * platform type and version.
 *
 * @param {string} name - The device name to be created.
 * @param {string} deviceTypeId - Device type, for example 'iPhone 6'.
 * @param {string} runtimeId - Platform version, for example '10.3'.
 * @param {?SimCreationOpts} opts - Simulator options for creating devices.
 * @return {string} The UDID of the newly created device.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function createDevice (name, deviceTypeId, runtimeId, opts = {}) {
  const {
    platform = SIM_RUNTIME_NAME_SUFFIX_IOS,
    timeout = DEFAULT_CREATE_SIMULATOR_TIMEOUT
  } = opts;

  // Try getting runtimeId using JSON flag
  let runtimeIdFromJson;
  try {
    runtimeIdFromJson = await getRuntimeForPlatformVersionViaJson(runtimeId, platform);
    runtimeId = runtimeIdFromJson;
  } catch (ign) { }

  if (!runtimeIdFromJson) {
    // at first make sure that the runtime id is the right one
    // in some versions of Xcode it will be a patch version
    try {
      runtimeId = await getRuntimeForPlatformVersion(runtimeId, platform);
    } catch (err) {
      log.warn(`Unable to find runtime for iOS '${runtimeId}'. Continuing`);
    }

    const clangVersion = await getClangVersion();
    // 1st comparison: clangVersion
    // Command line tools version is 10.2+, but xcode 10.1 can happen
    let isNewerIdFormatRequired = clangVersion && util.compareVersions(clangVersion, '>=',
      CMDLINE_TOOLS_CLANG_FORMAT_CHANGED_VERSION);

    if (!isNewerIdFormatRequired) {
      // 2nd comparison: getVersion
      // The opposite can also happen,
      // but the combination of 10.2 command line tools and lower Xcode version happens more frequently
      const xcodeVersion = await getVersion(false);
      isNewerIdFormatRequired = xcodeVersion && util.compareVersions(xcodeVersion, '>=',
        XCODE_FORMAT_CHANGED_VERSION);
    }

    if (isNewerIdFormatRequired) {
      runtimeId = `${SIM_RUNTIME_NAME}${platform}-${runtimeId.replace(/\./g, '-')}`;
    }
  }

  log.debug(`Creating simulator with name '${name}', device type id '${deviceTypeId}' and runtime id '${runtimeId}'`);
  let udid;
  try {
    const out = await simExec('create', 0, [name, deviceTypeId, runtimeId]);
    udid = out.stdout.trim();
  } catch (err) {
    let reason = err.message;
    if (err.stderr) {
      reason = err.stderr.trim();
    }
    log.errorAndThrow(`Could not create simulator with name '${name}', device ` +
                      `type id '${deviceTypeId}' and runtime id '${runtimeId}'. Reason: '${reason}'`);
  }

  // make sure that it gets out of the "Creating" state
  let retries = parseInt(timeout / 1000, 10);
  await retryInterval(retries, 1000, async () => {
    let devices = await getDevices();
    for (const deviceArr of _.values(devices)) {
      for (const device of deviceArr) {
        if (device.udid === udid) {
          if (device.state === 'Creating') {
            // need to retry
            throw new Error('Device still being created');
          } else {
            // stop looking, we're done
            return;
          }
        }
      }
    }
  });

  return udid;
}

/**
 * Delete the particular Simulator from available devices list.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function deleteDevice (udid) {
  await simExec('delete', 0, [udid]);
}

/**
 * Reset the content and settings of the particular Simulator.
 * It is required that Simulator is in _shutdown_ state.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {number} timeout [10000] - The maximum number of milliseconds to wait
 *                                   unit device reset is completed.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function eraseDevice (udid, timeout = 1000) {
  let loopFn = async () => {
    await simExec('erase', 10000, [udid]);
  };
  // retry erase with a sleep in between because it's flakey
  let retries = parseInt(timeout / 200, 10);
  await retryInterval(retries, 200, loopFn);
}

/**
 * @typedef {Object} DeviceInfo
 * @property {string} name - The device name.
 * @property {string} udid - The device UDID.
 * @property {string} state - The current Simulator state, for example 'booted' or 'shutdown'.
 * @property {string} sdk - The SDK version, for example '10.3'.
 */

/**
 * Parse the list of existing Simulator devices to represent
 * it as convenient mapping.
 *
 * @param {?string} platform - The platform name, for example 'watchOS'.
 * @return {Object} The resulting mapping. Each key is platform version,
 *                  for example '10.3' and the corresponding value is an
 *                  array of the matching {@link DeviceInfo} instances.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function getDevicesByParsing (platform) {
  // get the list of devices
  const {stdout} = await simExec('list', 0, ['devices']);

  // expect to get a listing like
  // -- iOS 8.1 --
  //     iPhone 4s (3CA6E7DD-220E-45E5-B716-1E992B3A429C) (Shutdown)
  //     ...
  // -- iOS 8.2 --
  //     iPhone 4s (A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E) (Shutdown)
  //     ...
  // so, get the `-- iOS X.X --` line to find the sdk (X.X)
  // and the rest of the listing in order to later find the devices
  const deviceSectionRe = _.isEmpty(platform)
    ? new RegExp(`\\-\\-\\s+(\\S+)\\s+(\\S+)\\s+\\-\\-(\\n\\s{4}.+)*`, 'mgi')
    : new RegExp(`\\-\\-\\s+${_.escapeRegExp(platform)}\\s+(\\S+)\\s+\\-\\-(\\n\\s{4}.+)*`, 'mgi');
  const matches = [];
  let match;
  // make an entry for each sdk version
  while ((match = deviceSectionRe.exec(stdout))) {
    matches.push(match);
  }
  if (_.isEmpty(matches)) {
    throw new Error('Could not find device section');
  }

  const lineRe = /([^\s].+) \((\w+-.+\w+)\) \((\w+\s?\w+)\)/; // https://regex101.com/r/lG7mK6/3
  // get all the devices for each sdk
  const devices = {};
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
 * @param {?string} forSdk - The sdk version,
 *                           for which the devices list should be parsed,
 *                           for example '10.3'.
 * @param {?string} platform - The platform name, for example 'watchOS'.
 * @return {Object|Array<DeviceInfo>} If _forSdk_ is set then the list
 *                                    of devices for the particular platform version.
 *                                    Otherwise the same result as for {@link getDevicesByParsing}
 *                                    function.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code or if no matching
 *                 platform version is found in the system.
 */
async function getDevices (forSdk, platform) {
  let devices = {};
  try {
    const {stdout} = await simExec('list', 0, ['devices', '-j']);
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
    const versionMatchRe = _.isEmpty(platform)
      ? new RegExp(`^([^\\s-]+)[\\s-](\\S+)`, 'i')
      : new RegExp(`^${_.escapeRegExp(platform)}[\\s-](\\S+)`, 'i');
    for (let [sdkName, entries] of _.toPairs(JSON.parse(stdout).devices)) {
      // there could be a longer name, so remove it
      sdkName = sdkName.replace(SIM_RUNTIME_NAME, '');
      const versionMatch = versionMatchRe.exec(sdkName);
      if (!versionMatch) {
        continue;
      }

      // the sdk can have dashes (`12-2`) or dots (`12.1`)
      const sdk = (platform ? versionMatch[1] : versionMatch[2]).replace('-', '.');
      devices[sdk] = devices[sdk] || [];
      devices[sdk].push(...entries.filter((el) => _.isUndefined(el.isAvailable) || el.isAvailable)
        .map((el) => {
          delete el.availability;
          return {
            sdk,
            ...el,
            platform: platform || versionMatch[1],
          };
        })
      );
    }
  } catch (err) {
    log.debug(`Unable to get JSON device list: ${err.stack}`);
    log.debug('Falling back to manual parsing');
    devices = await getDevicesByParsing(platform);
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
 * @param {string} platformVersion - The platform version name,
 *                                   for example '10.3'.
 * @param {?string} platform - The platform name, for example 'watchOS'.
 * @return {string} The corresponding runtime name for the given
 *                  platform version.
 */
async function getRuntimeForPlatformVersionViaJson (platformVersion, platform = 'iOS') {
  const {stdout} = await simExec('list', 0, ['runtimes', '--json']);
  for (const {version, identifier, name} of JSON.parse(stdout).runtimes) {
    if (version === platformVersion && name.toLowerCase().startsWith(platform.toLowerCase())) {
      return identifier;
    }
  }
  throw new Error(`Could not use --json flag to parse platform version`);
}

/**
 * Get the runtime for the particular platform version.
 *
 * @param {string} platformVersion - The platform version name,
 *                                   for example '10.3'.
 * @param {?string} platform - The platform name, for example 'watchOS'.
 * @return {string} The corresponding runtime name for the given
 *                  platform version.
 */
async function getRuntimeForPlatformVersion (platformVersion, platform = 'iOS') {
  // Try with parsing
  try {
    const {stdout} = await simExec('list', 0, ['runtimes']);
    // https://regex101.com/r/UykjQZ/1
    const runtimeRe = new RegExp(`${_.escapeRegExp(platform)}\\s+(\\d+\\.\\d+)\\s+\\((\\d+\\.\\d+\\.*\\d*)`, 'i');
    for (const line of stdout.split('\n')) {
      const match = runtimeRe.exec(line);
      if (match && match[1] === platformVersion) {
        return match[2];
      }
    }
  } catch (ign) {}

  // if nothing was found, pass platform version back
  return platformVersion;
}

/**
 * Gets base64 screenshot for device (xcode >= 8.1 only).
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @return {string} Base64-encoded Simulator screenshot.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function getScreenshot (udid) {
  let pathToScreenshotPng = await tempDir.path({prefix: `screenshot-${udid}`, suffix: '.png'});
  await simExec('io', 0, [udid, 'screenshot', pathToScreenshotPng]);
  let screenshotImg = await fs.readFile(pathToScreenshotPng);
  await fs.rimraf(pathToScreenshotPng);
  return screenshotImg.toString('base64');
}

/**
 * Set the content of Simulator pasteboard (xcode >= 8.1 only).
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} udid - Device UDID.
 * @param {string} content - The actual string content to be set.
 * @param {string} encoding ['utf-8'] - The encoding of the given pasteboard content.
 *                                      UTF-8 by default.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function setPasteboard (udid, content, encoding = 'utf-8') {
  const pbCopySubprocess = new SubProcess('xcrun', ['simctl', 'pbcopy', udid]);
  await pbCopySubprocess.start(0);
  const exitCodeVerifier = pbCopySubprocess.join();
  const stdin = pbCopySubprocess.proc.stdin;
  stdin.setEncoding(encoding);
  stdin.write(content);
  stdin.end();
  await exitCodeVerifier;
}

/**
 * Get the content of Simulator pasteboard (xcode >= 8.1 only).
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} udid - Device UDID.
 * @param {string} encoding ['utf-8'] - The encoding of the returned pasteboard content.
 *                                      UTF-8 by default.
 * @return {string} Current content of Simulator pasteboard or an empty string.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function getPasteboard (udid, encoding = 'utf-8') {
  const args = ['simctl', 'pbpaste', udid];
  try {
    const {stdout} = await exec('xcrun', args, {timeout: 0, encoding});
    return stdout;
  } catch (e) {
    if (e.stderr) {
      log.errorAndThrow(`Error running 'xcrun ${args.join(' ')}': ${e.stderr.trim()}`);
    } else {
      log.errorAndThrow(e);
    }
  }
}

/**
 * Get the list of device types available in the current Xcode installation
 *
 * @return {Array<string>} List of the types of devices available
 * @throws {Error} If the corresponding simctl command fails
 */
async function getDeviceTypes () {
  try {
    const {stdout} = await simExec('list', 0, ['devicetypes', '-j']);
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
    const deviceTypes = JSON.parse(stdout.trim());
    return deviceTypes.devicetypes.map((type) => type.name);
  } catch (err) {
    let msg = `Unable to get list of device types: ${err.message}`;
    if (err.stderr) {
      msg = `${msg}. Stderr: ${err.stderr}`;
    }
    throw new Error(msg);
  }
}


/**
 * Get the full list of runtimes, devicetypes, devices and pairs as Object
 *
 * @return {Object} Object containing device types, runtimes devices and pairs
 * @throws {Error} If the corresponding simctl command fails
 */
async function getSimctlList () {
  try {
    const {stdout} = await simExec('list', 0, ['-j']);
    /*
     * JSON will be like
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
     */
    return JSON.parse(stdout);
  } catch (err) {
    let msg = `Unable to get simctl list: ${err.message}`;
    if (err.stderr) {
      msg = `${msg}. Stderr: ${err.stderr}`;
    }
    throw new Error(msg);
  }
}

/**
 * @typedef {Object} BootMonitorOptions
 * @property {?number} timeout [240000] - Simulator booting timeout in ms.
 * @property {?Function} onWaitingDataMigration - This event is fired when data migration stage starts.
 * @property {?Function} onWaitingSystemApp - This event is fired when system app wait stage starts.
 * @property {?Function} onFinished - This event is fired when Simulator is fully booted.
 * @property {?Function} onError - This event is fired when there was an error while monitoring the booting process
 * or when the timeout has expired.
 */

/**
 * Start monitoring for boot status of the particular Simulator.
 * If onFinished property is not set then the method will block
 * until Simulator booting is completed.
 * The method is only available since Xcode8.
 *
 * @param {string} udid - Device UDID.
 * @param {?BootMonitorOptions} opts - Monitoring options.
 * @returns {SubProcess} The instance of the corresponding monitoring process.
 * @throws {Error} If the Simulator fails to finish booting within the given timeout and onFinished
 * property is not set.
 */
async function startBootMonitor (udid, opts = {}) {
  const {
    timeout = 240000,
    onWaitingDataMigration,
    onWaitingSystemApp,
    onFinished,
    onError,
  } = opts;

  let status = '';
  let isBootingFinished = false;
  let error = null;
  let timeoutHandler = null;
  const bootMonitor = await simSubProcess('bootstatus', 0, [udid]);
  bootMonitor.on('output', (stdout, stderr) => {
    status += stdout || stderr;
    if (stdout) {
      if (stdout.includes('Waiting on Data Migration') && onWaitingDataMigration) {
        onWaitingDataMigration();
      } else if (stdout.includes('Waiting on System App') && onWaitingSystemApp) {
        onWaitingSystemApp();
      }
    }
  });
  bootMonitor.on('exit', (code, signal) => {
    if (timeoutHandler) {
      clearTimeout(timeoutHandler);
    }
    if (code === 0) {
      if (onFinished) {
        onFinished();
      }
      isBootingFinished = true;
    } else {
      status = status || signal;
      error = new Error(status);
      if (onError) {
        onError(error);
      }
    }
  });
  await bootMonitor.start(0);
  const stopMonitor = async () => {
    if (bootMonitor.isRunning) {
      try {
        await bootMonitor.stop();
      } catch (e) {
        log.warn(e.message);
      }
    }
  };
  const timeStarted = process.hrtime();
  if (onFinished) {
    timeoutHandler = setTimeout(stopMonitor, timeout);
  } else {
    try {
      await waitForCondition(() => {
        if (error) {
          throw error;
        }
        return isBootingFinished;
      }, {waitMs: timeout, intervalMs: 500});
    } catch (err) {
      await stopMonitor();
      throw new Error(`The simulator ${udid} has failed to finish booting after ${process.hrtime(timeStarted)[0]}s. ` +
        `Original status: ${status}`);
    }
  }
  return bootMonitor;
}


export {
  installApp, removeApp, launch, spawn, spawnSubProcess, openUrl, terminate,
  shutdown, createDevice, getAppContainer, getScreenshot, deleteDevice,
  eraseDevice, getDevices, getRuntimeForPlatformVersion, bootDevice,
  setPasteboard, getPasteboard, addMedia, appInfo, getDeviceTypes,
  startBootMonitor, getSimctlList
};
