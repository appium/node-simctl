import Q from 'q';
import { exec } from 'teen_process';
import { sleep, retry, nodeifyAll } from 'asyncbox';
import { getLogger } from 'appium-logger';
import { mapify } from 'es6-mapify';

const log = getLogger('node-simctl');

function simExec (command:string, timeout:number, args:Array = []) {

  args = ["simctl", command].concat(args);
  log.info(`Executing: xcrun with args: ${args.join(' ')} and timeout: ${timeout}`);

  let ret;
  try {
    ret = exec("xcrun", args, {timeout});
  } catch (e) {
    if (e.stderr) {
      log.errorAndThrow(`sim-ctl error: ${e.stderr.trim()}`);
    } else {
      throw e;
    }
  }

  return ret;
}

async function installApp (udid:string, appPath:string):void {
  await simExec("install", 0, [udid, appPath]);
}

async function removeApp (udid:string, bundleId:string):void {
  await simExec("uninstall", 0, [udid, bundleId]);
}

async function launch (udid:string, bundleId:string):void {
  await simExec("launch", 0, [udid, bundleId]);
}

async function createDevice (name:string, deviceTypeId:string,
    runtimeId:string):void {

  let out;
  try {
    out = await simExec("create", 0, [name, deviceTypeId, runtimeId]);
  } catch (e) {
    log.errorAndThrow(`Could not create simulator. Reason: ${e.stderr.trim()}`);
  }
  return out.stdout.trim();
}

async function deleteDevice (udid:string):void {
  await simExec("delete", 0, [udid]);
}

async function eraseDevice (udid:string):void {
  let cmdTimeout:number = 2000, cmdRetry:number = 5;
  let loopFn:Function = async () => {
    let ms = Date.now();
    try {
      await simExec("erase", cmdTimeout, [udid]);
    } catch (e) {
      await sleep(Math.max(cmdTimeout - (Date.now() - ms), 1));
      throw e;
    }
  };
  // retry erase with a sleep in between because it's flakey
  await retry(cmdRetry, loopFn);
}

async function getDevices (forSdk:string = null):Object {
  let { stdout } = await simExec("list", 0, ["devices"]);
  let deviceSecRe:RegExp = /-- iOS (.+) --(\n    .+)*/mg;
  let matches:Array = [];
  let devices:Object = {};
  let match:Object = deviceSecRe.exec(stdout);
  while (match !== null) {
    matches.push(match);
    match = deviceSecRe.exec(stdout);
  }
  if (matches.length < 1) {
    throw new Error("Could not find device section");
  }
  for (match of matches) {
    let sdk:string = match[1];
    devices[sdk] = [];
    for (let line:string of match[0].split("\n").slice(1)) {
      let lineRe:RegExp = /^    ([^\(]+) \(([^\)]+)\) \(([^\)]+)\)/;
      let lineMatch:Object = lineRe.exec(line);
      if (lineMatch === null) {
        throw new Error("Couldn't match line");
      }
      let device:Object = {};
      device.name = lineMatch[1];
      device.udid = lineMatch[2];
      device.state = lineMatch[3];
      devices[sdk].push(device);
    }
  }
  if (forSdk) {
    if (!devices[forSdk]) {
      throw new Error("Sdk " + forSdk + " was not in list of simctl sdks");
    }
    return devices[forSdk];
  }
  return devices;
}

export { installApp, removeApp, launch, createDevice, deleteDevice, eraseDevice, getDevices };
