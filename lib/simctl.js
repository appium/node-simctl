import { exec } from 'teen_process';
import { retryInterval } from 'asyncbox';
import { getLogger } from 'appium-logger';


const log = getLogger('simctl');

async function simExec (command:string, timeout:number, args:Array = []) {
  // run a particular simctl command
  args = ['simctl', command, ...args];
  log.info(`Executing: xcrun with args: ${args.join(' ')} and timeout: ${timeout}`);

  try {
    return exec('xcrun', args, {timeout});
  } catch (e) {
    if (e.stderr) {
      log.errorAndThrow(`simctl error: ${e.stderr.trim()}`);
    } else {
      log.errorAndThrow(e);
    }
  }
}

async function installApp (udid:string, appPath:string):void {
  await simExec('install', 0, [udid, appPath]);
}

async function removeApp (udid:string, bundleId:string):void {
  await simExec('uninstall', 0, [udid, bundleId]);
}

async function launch (udid:string, bundleId:string):void {
  await simExec('launch', 0, [udid, bundleId]);
}

async function shutdown (udid:string):void {
  await simExec('shutdown', 0, [udid]);
}

async function createDevice (name:string, deviceTypeId:string,
    runtimeId:string):void {
  let out;
  try {
    out = await simExec('create', 0, [name, deviceTypeId, runtimeId]);
  } catch (e) {
    log.errorAndThrow(`Could not create simulator. Reason: ${e.stderr.trim()}`);
  }
  return out.stdout.trim();
}

async function deleteDevice (udid:string):void {
  await simExec('delete', 0, [udid]);
}

async function eraseDevice (udid:string):void {
  let loopFn:Function = async () => {
    await simExec('erase', 2000, [udid]);
  };
  // retry erase with a sleep in between because it's flakey
  await retryInterval(5, 200, loopFn);
}

async function getDevices (forSdk:string = null):Object {
  // get the list of devices
  let { stdout } = await simExec('list', 0, ['devices']);

  // expect to get a listing like
  // -- iOS 8.1 --
  //     iPhone 4s (3CA6E7DD-220E-45E5-B716-1E992B3A429C) (Shutdown)
  //     ...
  // -- iOS 8.2 --
  //     iPhone 4s (A99FFFC3-8E19-4DCF-B585-7D9D46B4C16E) (Shutdown)
  //     ...
  // so, get the `-- iOS X.X --` line to find the sdk (X.X)
  // and the rest of the listing in order to later find the devices
  let deviceSectionRe:RegExp = /-- iOS (.+) --(\n    .+)*/mg;
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
      let lineRe:RegExp = /^    ([^\(]+) \(([^\)]+)\) \(([^\)]+)\)/;
      let lineMatch:Object = lineRe.exec(line);
      if (lineMatch === null) {
        throw new Error('Could not match line');
      }
      // save the whole thing as ab object in the list for this sdk
      devices[sdk].push({
        name: lineMatch[1],
        udid: lineMatch[2],
        state: lineMatch[3],
      });
    }
  }

  // if a `forSdk` was passed in, return only the corresponding list
  if (forSdk) {
    if (!devices[forSdk]) {
      throw new Error(`Sdk '${forSdk}' was not in list of simctl sdks`);
    }
    return devices[forSdk];
  }

  // otherwise return all the sdk -> device mappings.
  return devices;
}

export { installApp, removeApp, launch, shutdown, createDevice, deleteDevice,
         eraseDevice, getDevices };
