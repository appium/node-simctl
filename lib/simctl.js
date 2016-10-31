import { exec, SubProcess } from 'teen_process';
import { retryInterval } from 'asyncbox';
import { getLogger } from 'appium-logger';
import _ from 'lodash';


const log = getLogger('simctl');

async function simCommand (command:string, timeout:number, args:Array = [], env = {}, executingFunction = exec) {
  // run a particular simctl command
  args = [command, ...args];
  // Prefix all passed in environment variables with 'SIMCTL_CHILD_', simctl
  // will then pass these to the child (spawned) process.
  env = _.defaults(_.mapKeys(env, function(value, key) {
    return `SIMCTL_CHILD_${key}`;
  }), process.env);

  try {
    return await executingFunction('fbsimctl', args, {timeout, env});
  } catch (e) {
    if (e.stderr) {
      log.errorAndThrow(`simctl error running '${command}': ${e.stderr.trim()}`);
    } else {
      log.errorAndThrow(e);
    }
  }
}

async function simExec (command:string, timeout:number, args:Array = [], env = {}) {
  return await simCommand(command, timeout, args, env, async (c, a, ob) => {
    return await exec(c, a, ob);
  });
}

async function simSubProcess (command:string, timeout:number, args:Array = [], env = {}) {
  return await simCommand(command, timeout, args, env, async (c, a, ob) => {
    return new SubProcess(c, a, ob);
  });
}

async function installApp (udid:string, appPath:string):void {
  await simExec(udid, 0, ['install', appPath]);
}

async function removeApp (udid:string, bundleId:string):void {
  await simExec(udid, 0, ['uninstall', bundleId]);
}

async function launch (udid:string, bundleId:string, tries:int = 5):void {
  await retryInterval(tries, 1000, async () => {
    await simExec(udid, 0, ['launch', bundleId]);
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

async function shutdown (udid:string):void {
  await simExec('shutdown', 0, [udid]);
}

async function createDevice (deviceTypeId:string,
    runtimeId:string, timeout:int = 10000):void {
  let udid;
  try {
    const out = await simExec('create', 0, [deviceTypeId, runtimeId]);
    const finalLine = _.last(out.stdout.trim().split('\n')).replace('Create Ended: ', '');
    udid = finalLine.split('|')[0].trim();
  } catch (e) {
    if (e.stderr) {
      log.errorAndThrow(`Could not create simulator. Reason: ${e.stderr.trim()}`);
    } else {
      log.errorAndThrow(new Error(`Error creating device type: ${deviceTypeId} - Exception: `,
        deviceTypeId,
        e
      ));
    }

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
  await simExec(udid, 0, ['delete']);
}

async function eraseDevice (udid:string, timeout:int = 1000):void {
  let loopFn:Function = async () => {
    await simExec(udid, 10000, ['erase']);
  };
  // retry erase with a sleep in between because it's flakey
  let retries = parseInt(timeout / 200, 10);
  await retryInterval(retries, 200, loopFn);
}

async function getDevices (forSdk:string = null):Object {
  // get the list of devices
  const {stdout} = await simExec('list', 0);
  const devices:Object = {};
  const items = stdout.trim().split('\n');
  for (const item of items) {
    const itemSegments = item.split('|').map((x) => x.trim());
    const sdk = itemSegments[4];
    devices[sdk] = devices[sdk] || [];
    devices[sdk].push({
      udid: itemSegments[0],
      name: itemSegments[1],  // 1 or 3? Seems either suits in fbsimctl 
      state: itemSegments[2], // since names arent customizable.
    });
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

export { installApp, removeApp, launch, spawn, spawnSubProcess, openUrl, shutdown, createDevice,
         deleteDevice, eraseDevice, getDevices };
