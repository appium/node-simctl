import Q from 'q';
import cp from 'child_process';
import { sleep, retry } from 'asyncbox';
import npmlog from 'npmlog';

let log = global._global_npmlog || npmlog;

function simExec (cmd/*:string*/, timeout/*:number*/, args/*:Array*/ = []) {
  args = args.map((arg) => {
    if (arg.indexOf(" ") !== -1) {
      return '"' + arg + '"';
    }
    return arg;
  });
  cmd = "xcrun simctl " + cmd + " " + args.join(' ');
  log.info("Executing: " + cmd + " with timeout " + timeout);
  return Q.nfcall(cp.exec, cmd, {timeout});
}

async function createDevice (name/*:string*/, deviceTypeId/*:string*/,
    runtimeId/*:string*/)/*:void*/ {
  await simExec("create", 0, [name, deviceTypeId, runtimeId]);
}

async function deleteDevice (udid/*:string*/)/*:void*/ {
  await simExec("delete", 0, [udid]);
}

async function eraseDevice (udid/*:string*/)/*:void*/ {
  let cmdTimeout = 2000, cmdRetry/*:number*/ = 5;
  let loopFn = async () => {
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

async function getDevices (forSdk/*:string*/ = null)/*:Object*/ {
  let res = await simExec("list", 0, ["devices"]);
  let stdout = res[0];
  let deviceSecRe = /-- iOS (.+) --(\n    .+)*/mg;
  let matches = [];
  let devices = {};
  let match = deviceSecRe.exec(stdout);
  while (match !== null) {
    matches.push(match);
    match = deviceSecRe.exec(stdout);
  }
  if (matches.length < 1) {
    throw new Error("Could not find device section");
  }
  for (match of matches) {
    let sdk = match[1];
    devices[sdk] = [];
    for (let line of match[0].split("\n").slice(1)) {
      let lineRe = /^    ([^\(]+) \(([^\)]+)\) \(([^\)]+)\)/;
      let lineMatch = lineRe.exec(line);
      if (lineMatch === null) {
        throw new Error("Couldn't match line");
      }
      let device = {};
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

export default  {
  createDevice: createDevice,
  deleteDevice: deleteDevice,
  eraseDevice: eraseDevice,
  getDevices: getDevices
};
