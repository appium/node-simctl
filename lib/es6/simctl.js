import Q from 'q';
import { exec } from 'child_process';
import { sleep, retry } from 'asyncbox';
import log from 'npmlog';

async function simExec (cmd, timeout, args = []) {
  args = args.map((arg) => {
    if (args.indexOf(" ") !== -1) {
      return '"' + arg + '"';
    }
    return arg;
  });
  cmd = "xcrun simctl " + cmd + " " + args.join(' ');
  log.info("Executing: " + cmd);
  return await Q.nfcall(exec, cmd, {timeout: timeout});
}

async function deleteDevice (udid) {
  await simExec("delete", 0, [udid]);
}

async function eraseDevice (udid) {
  // wait at least 2s for simctl to do its thing
  let cmdTimeout = 2000, cmdRetry = 5;
  let loopFn = async () => {
    let ms = Date.now();
    await simExec("erase", cmdTimeout, [udid]);
    await sleep(Math.max(cmdTimeout - (Date.now() - ms), 1));
  };
  // retry erase with a sleep in between because it's flakey
  await retry(cmdRetry, loopFn);
}

async function getDevices (forSdk = null) {
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
  for (let match of matches) {
    let sdk = match[1];
    devices[sdk] = [];
    for (let line of match[0].split("\n").slice(1)) {
      let lineRe = /^    (.+) \((.+)\) \((.+)\)/;
      let match = lineRe.exec(line);
      if (match === null) {
        throw new Error("Couldn't match line");
      }
      let device = {};
      device.name = match[1];
      device.udid = match[2];
      device.state = match[3];
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

export { deleteDevice, eraseDevice, getDevices };
