import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {describe, it, beforeEach, afterEach, after, before} from 'node:test';

import {retryInterval} from 'asyncbox';
import {rimraf} from 'rimraf';

import {Simctl} from '../../lib/simctl.js';

const BOOT_TIMEOUT_MS = 200000;

describe('simctl', function () {
  const DEVICE_NAME = process.env.DEVICE_NAME || 'iPhone 17';
  let randName: string;
  let validSdks: string[] = [];
  let sdk: string;
  let simctl: Simctl;

  before(async function () {
    simctl = new Simctl();
    const devices = await simctl.getDevices();
    console.log(`Found devices: ${JSON.stringify(devices, null, 2)}`); // eslint-disable-line no-console
    validSdks = Object.keys(devices)
      .filter((key) => devices[key].length > 0)
      .sort((a, b) => a.localeCompare(b));
    if (!validSdks.length) {
      throw new Error('No valid SDKs');
    }
    console.log(`Found valid SDKs: ${validSdks.join(', ')}`); // eslint-disable-line no-console
    sdk = `${process.env.IOS_SDK || validSdks.at(-1)}`;

    // need to find a random name that does not already exist
    // give it 5 tries
    for (let i = 0; i < 5; i++) {
      const randNum = parseInt((Math.random() * 100).toString(), 10);
      randName = `device${randNum}`;

      let nameFound = false;
      for (const list of Object.values(devices)) {
        if (list.map((item) => item.name).includes(randName)) {
          // need to find another random name
          nameFound = true;
          break;
        }
      }
      if (!nameFound) break; // eslint-disable-line curly
    }
  });

  it('should retrieve a device with compatible properties', async function () {
    const devices = await simctl.getDevices();
    const sdkDevices = devices[sdk];
    const firstDevice = sdkDevices[0];
    const expectedList = ['name', 'sdk', 'state', 'udid'];
    assert.ok(expectedList.some((key) => key in firstDevice));
  });

  describe('createDevice', function () {
    after(async function () {
      if (simctl.udid) {
        await simctl.deleteDevice();
        simctl.udid = null;
      }
    });

    it('should create a device', async function () {
      simctl.udid = await simctl.createDevice(randName, DEVICE_NAME, sdk);
      assert.strictEqual(typeof simctl.udid, 'string');
      assert.strictEqual(simctl.udid.length, 36);
    });

    it('should create a device and be able to see it in devices list right away', async function () {
      const devicesBefore = await simctl.getDevices();
      const numSimsBefore = devicesBefore[sdk].length;
      simctl.udid = await simctl.createDevice('node-simctl test', DEVICE_NAME, sdk);
      const devicesAfter = await simctl.getDevices();
      const numSimsAfter = devicesAfter[sdk].length;
      assert.strictEqual(numSimsAfter, numSimsBefore + 1);
    });
  });

  describe('device manipulation', function () {
    let simctl: Simctl;
    const name = 'node-simctl test';
    beforeEach(async function () {
      simctl = new Simctl();
      simctl.udid = await simctl.createDevice('node-simctl test', DEVICE_NAME, sdk);
    });
    afterEach(async function () {
      if (simctl.udid) {
        await simctl.deleteDevice();
        simctl.udid = null;
      }
    });
    it('should get devices', async function () {
      const sdkDevices = await simctl.getDevices(sdk);
      assert.ok(sdkDevices.map((item) => item.name).includes(name));
    });

    it('should erase devices', async function () {
      await simctl.eraseDevice(16000);
    });

    it('should delete devices', async function () {
      await simctl.deleteDevice();
      const sdkDevices = await simctl.getDevices(sdk);
      assert.ok(!sdkDevices.map((item) => item.udid).includes(simctl.udid!));

      // so we do not delete again
      simctl.udid = null;
    });

    it('should not fail to shutdown a shutdown simulator', async function () {
      await assert.doesNotReject(simctl.shutdownDevice());
    });
  });

  it('should return a nice error for invalid usage', async function () {
    let err: Error | null = null;
    try {
      await simctl.createDevice('foo', 'bar', 'baz');
    } catch (e) {
      err = e as Error;
    }
    assert.ok(err);
    assert.ok(err.message.includes(`Unable to parse version 'baz'`));
  });

  describe('on running Simulator', function () {
    before(async function () {
      const sdk = process.env.IOS_SDK || validSdks.at(-1);
      simctl.udid = await simctl.createDevice('runningSimTest', DEVICE_NAME, sdk!);

      await simctl.bootDevice();
      await simctl.startBootMonitor({timeout: BOOT_TIMEOUT_MS});
    });
    after(async function () {
      if (simctl.udid) {
        try {
          await simctl.shutdownDevice();
        } catch {}
        await simctl.deleteDevice();
        simctl.udid = null;
      }
    });

    describe('startBootMonitor', function () {
      it('should be fulfilled if the simulator is already booted', async function () {
        await assert.doesNotReject(simctl.startBootMonitor());
      });
      it('should fail to monitor booting of non-existing simulator', async function () {
        const udid = simctl.udid;
        try {
          simctl.udid = 'blabla';
          await assert.rejects(simctl.startBootMonitor({timeout: 1000}));
        } finally {
          simctl.udid = udid;
        }
      });
    });

    describe('pasteboard', function () {
      it('should set and get the content of the pasteboard', async function () {
        const pbContent = 'blablabla';
        const encoding = 'ascii';

        await retryInterval(10, 1000, async () => {
          await simctl.setPasteboard(pbContent, encoding);
          assert.strictEqual(await simctl.getPasteboard(encoding), pbContent);
        });
      });
    });

    describe('add media', function () {
      const BASE64_PNG =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      let picturePath: string | undefined;
      before(async function () {
        picturePath = path.join(os.tmpdir(), `${randomUUID()}.png`);
        await fs.writeFile(picturePath, Buffer.from(BASE64_PNG, 'base64').toString('binary'), 'binary');
      });
      after(async function () {
        if (picturePath) {
          await rimraf(picturePath);
        }
      });
      it('should add media files', async function () {
        assert.strictEqual((await simctl.addMedia(picturePath!)).code, 0);
      });
    });

    describe('appInfo', function () {
      it('should extract applications information', async function () {
        const appInfo = await simctl.appInfo('com.apple.springboard');
        assert.strictEqual(appInfo.ApplicationType, 'Hidden');
      });
      it('should throw an error if the app is not installed', async function () {
        await assert.rejects(simctl.appInfo('com.apple.notinstalled'));
      });
    });

    describe('getEnv', function () {
      it('should get env variable value', async function () {
        const udid = await simctl.getEnv('SIMULATOR_UDID');
        assert.ok(udid!.length > 0);
      });
      it('should return null if no var is found', async function () {
        const udid = await simctl.getEnv('SIMULATOR_UDD');
        assert.strictEqual(udid, null);
      });
    });

    describe('getDeviceTypes', function () {
      it('should get device types', async function () {
        const deviceTypes = await simctl.getDeviceTypes();
        assert.ok(deviceTypes.length);
        assert.ok(deviceTypes.length > 0);
        // at least one type, no matter the version of Xcode, should be an iPhone
        assert.ok(deviceTypes.filter((el) => el.includes('iPhone')).length > 1);
      });
    });

    describe('list', function () {
      it('should get everything from xcrun simctl list', async function () {
        const fullList = await simctl.list();
        assert.ok('devicetypes' in fullList);
        assert.ok('runtimes' in fullList);
        assert.ok('devices' in fullList);
        assert.ok('pairs' in fullList);
        assert.ok(fullList.devicetypes.length > 1);
        // at least one type, no matter the version of Xcode, should be an iPhone
        assert.ok(
          fullList.devicetypes.filter((el: {identifier: string}) => el.identifier.includes('iPhone')).length > 0,
        );
        // at least one runtime should be iOS
        assert.ok(fullList.runtimes.filter((el: {identifier: string}) => el.identifier.includes('iOS')).length > 0);
      });
    });

    describe('getScreenshot', function () {
      it('should get a base64 string', async function () {
        const image = await simctl.getScreenshot();

        assert.strictEqual(Buffer.from(image, 'base64').toString('base64'), image);
      });
    });

    describe('pushNotification', function () {
      it('should not throw an error when sending a push notification', async function () {
        const payload = {
          'Simulator Target Bundle': 'com.apple.Preferences',
          aps: {
            alert: 'This is a simulated notification!',
            badge: 3,
            sound: 'default',
          },
        };

        await assert.doesNotReject(simctl.pushNotification(payload));
      });
    });
  });
});
