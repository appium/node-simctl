import { exec, SubProcess } from 'teen_process';
import { retryInterval } from 'asyncbox';
import { logger, fs, tempDir } from 'appium-support';
import _ from 'lodash';


const log = logger.getLogger('simctl');

// https://regex101.com/r/UykjQZ/1
const IOS_RUNTIME_REGEXP = /iOS (\d+\.\d+) \((\d+\.\d+\.*\d*)/;

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
  return await simCommand(command, timeout, args, env, async (c, a, ob) => {
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
 * @param {string} executablePath - The path to the process on
 *                                  internal Simulator file system.
 * @param {object} env [{}] - Additional environment variables mapping.
 * @return {ExecResult} Command execution result.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function spawn (udid, executablePath, env = {}) {
  return await simExec('spawn', 0, [udid, executablePath], env);
}

/**
 * Prepare SubProcess instance for a new process, which is going to be spawned
 * on Simulator.
 *
 * @param {string} udid - The UDID of an existing Simulator.
 * @param {string} executablePath - The path to the process on
 *                                  internal Simulator file system.
 * @param {object} env [{}] - Additional environment variables mapping.
 * @return {SubProcess} The instance of the process to be spawned.
 */
async function spawnSubProcess (udid, executablePath, env = {}) {
  return await simSubProcess('spawn', 0, [udid, executablePath], env);
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
 * @param {boolean} logErrors [true] - Whether to include exec's command
 *                                     stderr output into exception message if thrown.
 * @return {string} Full path to the given application container on the local
 *                  file system.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function getAppContainer (udid, bundleId, logErrors = true) {
  let {stdout} = await simExec('get_app_container', 0, [udid, bundleId], {}, logErrors);
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
 * Create Simulator device with given name for the particular
 * platform type and version.
 *
 * @param {string} name - The device name to be created.
 * @param {string} deviceTypeId - Device type, for example 'iPhone 6'.
 * @param {string} runtimeId - Platform version, for example '10.3'.
 * @param {number} timeout [10000] - The maximum number of milliseconds to wait
 *                                   unit device creation is completed.
 * @return {string} The UDID of the newly created device.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function createDevice (name, deviceTypeId, runtimeId, timeout = 10000) {
  let udid;
  // first make sure that the runtime id is the right one
  // in some versions of Xcode it will be a patch version
  try {
    runtimeId = await getRuntimeForPlatformVersion(runtimeId);
  } catch (err) {
    log.warn(`Unable to find runtime for iOS '${runtimeId}'. Continuing`);
  }

  log.debug(`Creating simulator with name '${name}', device type id '${deviceTypeId}' and runtime id '${runtimeId}'`);
  try {
    let out = await simExec('create', 0, [name, deviceTypeId, runtimeId]);
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
    for (let deviceArr of _.values(devices)) {
      for (let device of deviceArr) {
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
 * @return {Object} The resulting mapping. Each key is platform version,
 *                  for example '10.3' and the corresponding value is an
 *                  array of the matching {@link DeviceInfo} instances.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
async function getDevicesByParsing () {
  // get the list of devices
  let {stdout} = await simExec('list', 0, ['devices']);

  // expect to get a listing like
  // -- iOS 8.1 --
  //     iPhone 4s (3CA6E7DD-220E-45E5-B716-1E992B3A429C) (Shutdown)
  //     ...
  // -- iOS 8.2 --
  //     iPhone 4s (A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E) (Shutdown)
  //     ...
  // so, get the `-- iOS X.X --` line to find the sdk (X.X)
  // and the rest of the listing in order to later find the devices
  let deviceSectionRe = /-- iOS (.+) --(\n\s{4}.+)*/mg;
  let matches = [];
  let match = deviceSectionRe.exec(stdout);

  // make an entry for each sdk version
  while (match !== null) {
    matches.push(match);
    match = deviceSectionRe.exec(stdout);
  }
  if (matches.length < 1) {
    log.errorAndThrow('Could not find device section');
  }

  // get all the devices for each sdk
  let devices = {};
  for (match of matches) {
    let sdk = match[1];
    devices[sdk] = [];
    // split the full match into lines and remove the first
    for (let line of match[0].split('\n').slice(1)) {
      // a line is something like
      //    iPhone 4s (A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E) (Shutdown)
      // retrieve:
      //   iPhone 4s
      //   A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E
      //   Shutdown
      let lineRe = /([^\s].+) \((\w+-.+\w+)\) \((\w+\s?\w+)\)/; // https://regex101.com/r/lG7mK6/3
      let lineMatch = lineRe.exec(line);
      if (lineMatch === null) {
        throw new Error(`Could not match line: ${line}`);
      }
      // save the whole thing as ab object in the list for this sdk

      devices[sdk].push({
        name: lineMatch[1],
        udid: lineMatch[2],
        state: lineMatch[3],
        sdk,
      });
    }
  }

  return devices;
}

/**
 * Parse the list of existing Simulator devices to represent
 * it as convenient mapping for the particular platform version.
 *
 * @param {string} forSdk [null] - The platform version,
 *                                 for which the devices list should be parsed,
 *                                 for example '10.3'.
 * @return {Object|Array<DeviceInfo>} If _forSdk_ is set then the list
 *                                    of devices for the particular platform version.
 *                                    Otherwise the same result as for {@link getDevicesByParsing}
 *                                    function.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code or if no matching
 *                 platform version is found in the system.
 */
async function getDevices (forSdk = null) {
  let devices;
  try {
    let {stdout} = await simExec('list', 0, ['devices', '-j']);
    /* JSON should be
     * {
     *   "devices" : {
     *     "iOS <sdk>" : [
     *       {
     *         "state" : "Booted",
     *         "availability" : "(available)",
     *         "name" : "iPhone 6",
     *         "udid" : "75E34140-18E8-4D1A-9F45-AAC735DF75DF"
     *       }
     *     ]
     *   }
     * }
     */
    devices = {};
    for (let [sdkName, entries]  of _.toPairs(JSON.parse(stdout).devices)) {
      if (sdkName.indexOf('iOS') !== 0) {
        continue;
      }
      let sdk = sdkName.replace('iOS ', '');
      devices[sdk] = entries.map((el) => {
        delete el.availability;
        return {...el, sdk};
      });
    }
  } catch (err) {
    log.debug(`Unable to get JSON device list: ${err.message}`);
    log.debug('Falling back to manually parsing');
    devices = await getDevicesByParsing();
  }

  // if a `forSdk` was passed in, return only the corresponding list
  if (forSdk) {
    if (!devices[forSdk]) {
      let errMsg = `'${forSdk}' does not exist in the list of simctl SDKs.`;
      const availableSDKs = _.keys(devices);
      errMsg += availableSDKs.length ?
        ` Only the following Simulator SDK versions are available on your system: ${availableSDKs.join(', ')}` :
        ` No Simulator SDK versions are available on your system. Please install some via Xcode preferences.`;
      throw new Error(errMsg);
    }
    return devices[forSdk];
  }

  // otherwise return everything
  return devices;
}

/**
 * Get the runtime for the particular platform version.
 *
 * @param {string} platformVersion - The platform version name,
 *                                   for example '10.3'.
 * @return {string} The corresponding runtime name for the given
 *                  platform version.
 */
async function getRuntimeForPlatformVersion (platformVersion) {
  try {
    // let {stdout} = await exec('xcrun', ['simctl', 'list', 'runtimes']);
    let {stdout} = await simExec('list', 0, ['runtimes']);
    for (let line of stdout.split('\n')) {
      let match = IOS_RUNTIME_REGEXP.exec(line);
      if (match) {
        if (match[1] === platformVersion) {
          return match[2];
        }
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


export { installApp, removeApp, launch, spawn, spawnSubProcess, openUrl,
         terminate, shutdown, createDevice, getAppContainer, getScreenshot,
         deleteDevice, eraseDevice, getDevices, getRuntimeForPlatformVersion,
         bootDevice, setPasteboard, getPasteboard, addMedia, appInfo };
