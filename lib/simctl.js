import { exec, SubProcess } from 'teen_process';
import { retryInterval } from 'asyncbox';
import { logger, fs, tempDir } from 'appium-support';
import _ from 'lodash';


const log = logger.getLogger('simctl');

// https://regex101.com/r/UykjQZ/1
const IOS_RUNTIME_REGEXP = /iOS (\d+\.\d+) \((\d+\.\d+\.*\d*)/;

async function simCommand (command:string, timeout:number, args:Array = [], env = {}, executingFunction = exec, logErrors = true) {
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

async function simExec (command:string, timeout:number, args:Array = [], env = {}, logErrors = true) {
  return await simCommand(command, timeout, args, env, async (c, a, ob) => {
    return await exec(c, a, ob);
  }, logErrors);
}

async function simSubProcess (command:string, timeout:number, args:Array = [], env = {}) {
  return await simCommand(command, timeout, args, env, async (c, a, ob) => {
    return new SubProcess(c, a, ob);
  });
}

async function installApp (udid:string, appPath:string):void {
  await simExec('install', 0, [udid, appPath]);
}

async function bootDevice (udid:string):void {
  await simExec('boot', 0, [udid]);
}

async function removeApp (udid:string, bundleId:string):void {
  await simExec('uninstall', 0, [udid, bundleId]);
}

async function launch (udid:string, bundleId:string, tries:int = 5):void {
  await retryInterval(tries, 1000, async () => {
    await simExec('launch', 0, [udid, bundleId]);
  });
}

async function spawn (udid:string, executablePath:string, env = {}):void {
  return await simExec('spawn', 0, [udid, executablePath], env);
}

async function spawnSubProcess (udid:string, executablePath:string, env = {}):void {
  return await simSubProcess('spawn', 0, [udid, executablePath], env);
}

async function openUrl (udid:string, url:string):void {
  return await simExec('openurl', 0, [udid, url]);
}

async function addMedia (udid:string, path:string):void {
  return await simExec('addmedia', 0, [udid, path]);
}

async function terminate (udid:string, bundleId:string):void {
  await simExec('terminate', 0, [udid, bundleId]);
}

async function getAppContainer (udid:string, bundleId:string, logErrors = true) {
  let {stdout} = await simExec('get_app_container', 0, [udid, bundleId], {}, logErrors);
  return (stdout || '').trim();
}

async function shutdown (udid:string):void {
  await simExec('shutdown', 0, [udid]);
}

async function createDevice (name:string, deviceTypeId:string,
    runtimeId:string, timeout:int = 10000):void {
  let udid;
  // first make sure that the runtime id is the right one
  // in some versions of xcode it will be a patch version
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

async function deleteDevice (udid:string):void {
  await simExec('delete', 0, [udid]);
}

async function eraseDevice (udid:string, timeout:int = 1000):void {
  let loopFn:Function = async () => {
    await simExec('erase', 10000, [udid]);
  };
  // retry erase with a sleep in between because it's flakey
  let retries = parseInt(timeout / 200, 10);
  await retryInterval(retries, 200, loopFn);
}

async function getDevicesByParsing ():Object {
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
  let deviceSectionRe:RegExp = /-- iOS (.+) --(\n\s{4}.+)*/mg;
  let matches:Array = [];
  let match:Object = deviceSectionRe.exec(stdout);

  // make an entry for each sdk version
  while (match !== null) {
    matches.push(match);
    match = deviceSectionRe.exec(stdout);
  }
  if (matches.length < 1) {
    log.errorAndThrow('Could not find device section');
  }

  // get all the devices for each sdk
  let devices:Object = {};
  for (match of matches) {
    let sdk:string = match[1];
    devices[sdk] = [];
    // split the full match into lines and remove the first
    for (let line:string of match[0].split('\n').slice(1)) {
      // a line is something like
      //    iPhone 4s (A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E) (Shutdown)
      // retrieve:
      //   iPhone 4s
      //   A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E
      //   Shutdown
      let lineRe:RegExp = /([^\s].+) \((\w+-.+\w+)\) \((\w+\s?\w+)\)/; // https://regex101.com/r/lG7mK6/3
      let lineMatch:Object = lineRe.exec(line);
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

async function getDevices (forSdk:string = null):Object {
  let devices:Object;
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
      throw new Error(`Sdk '${forSdk}' was not in list of simctl sdks`);
    }
    return devices[forSdk];
  }

  // otherwise return everything
  return devices;
}

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
 * Gets base64 screenshot for device (xcode >= 8.1 only)
 * @param {string} udid
 */
async function getScreenshot (udid:string):string {
  let pathToScreenshotPng = await tempDir.path({prefix: `screenshot-${udid}`, suffix: '.png'});
  await simExec('io', 0, [udid, 'screenshot', pathToScreenshotPng]);
  let screenshotImg = await fs.readFile(pathToScreenshotPng);
  await fs.rimraf(pathToScreenshotPng);
  return screenshotImg.toString('base64');
}

/**
 * Set the content of Simulator pasteboard (xcode >= 8.1 only)
 *
 * @param {string} udid - Device UDID.
 * @param {string} content - The actual string content to be set.
 * @param {string} encoding - The encoding of the given pasteboard content. UTF-8 by default.
 */
async function setPasteboard (udid:string, content:string, encoding = 'utf-8'):void {
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
 * Get the content of Simulator pasteboard (xcode >= 8.1 only)
 *
 * @param {string} udid - Device UDID.
 * @param {string} encoding - The encoding of the returned pasteboard content. UTF-8 by default.
 *
 * @return {string} Current content of Simulator pasteboard or an empty string.
 */
async function getPasteboard (udid:string, encoding = 'utf-8'):string {
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
         bootDevice, setPasteboard, getPasteboard, addMedia };
