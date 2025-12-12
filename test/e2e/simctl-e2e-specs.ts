import _ from 'lodash';
import { Simctl } from '../../lib/simctl';
import xcode from 'appium-xcode';
import { retryInterval } from 'asyncbox';
import { rimraf } from 'rimraf';
import { uuidV4 } from '../../lib/helpers';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

describe('simctl', function () {
  const DEVICE_NAME = process.env.DEVICE_NAME || 'iPhone 17';
  const MOCHA_TIMEOUT = 200000;
  this.timeout(MOCHA_TIMEOUT);

  let randName: string;
  let validSdks: string[] = [];
  let sdk: string;
  let simctl: Simctl;

  before(async function () {

    simctl = new Simctl();
    const devices = await simctl.getDevices();
    console.log(`Found devices: ${JSON.stringify(devices, null, 2)}`); // eslint-disable-line no-console
    validSdks = _.keys(devices)
      .filter((key) => !_.isEmpty(devices[key]))
      .sort((a, b) => a.localeCompare(b));
    if (!validSdks.length) {
      throw new Error('No valid SDKs');
    }
    console.log(`Found valid SDKs: ${validSdks.join(', ')}`); // eslint-disable-line no-console
    sdk = `${process.env.IOS_SDK || _.last(validSdks)}`;

    // need to find a random name that does not already exist
    // give it 5 tries
    for (let i = 0; i < 5; i++) {
      const randNum = parseInt((Math.random() * 100).toString(), 10);
      randName = `device${randNum}`;

      let nameFound = false;
      for (const list of _.values(devices)) {
        if (_.includes(_.map(list, 'name'), randName)) {
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
    expect(firstDevice).to.have.any.keys(...expectedList);
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
      expect(typeof simctl.udid).to.equal('string');
      expect(simctl.udid.length).to.equal(36);
    });

    it('should create a device and be able to see it in devices list right away', async function () {
      const devicesBefore = await simctl.getDevices();
      const numSimsBefore = devicesBefore[sdk].length;
      simctl.udid = await simctl.createDevice('node-simctl test', DEVICE_NAME, sdk);
      const devicesAfter = await simctl.getDevices();
      const numSimsAfter = devicesAfter[sdk].length;
      expect(numSimsAfter).to.equal(numSimsBefore + 1);
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
      expect(_.map(sdkDevices, 'name')).to.include(name);
    });

    it('should erase devices', async function () {
      await simctl.eraseDevice(16000);
    });

    it('should delete devices', async function () {
      await simctl.deleteDevice();
      const sdkDevices = await simctl.getDevices(sdk);
      expect(_.map(sdkDevices, 'name')).to.not.include(simctl.udid);

      // so we do not delete again
      simctl.udid = null;
    });

    it('should not fail to shutdown a shutdown simulator', async function () {
      await expect(simctl.shutdownDevice()).to.eventually.not.be.rejected;
    });
  });

  it('should return a nice error for invalid usage', async function () {
    let err: Error | null = null;
    try {
      await simctl.createDevice('foo', 'bar', 'baz');
    } catch (e) {
      err = e as Error;
    }
    expect(err).to.exist;
    expect(err!.message).to.include(`Unable to parse version 'baz'`);
  });

  describe('on running Simulator', function () {
    if (process.env.TRAVIS) {
      this.retries(3);
    }

    let major: number, minor: number;

    before(async function () {
      const version = await xcode.getVersion(true);
      if (typeof version === 'string') {
        return this.skip();
      }
      ({major, minor} = version);
      if (major < 8 || (major === 8 && minor < 1)) {
        return this.skip();
      }

      const sdk = process.env.IOS_SDK || _.last(validSdks);
      simctl.udid = await simctl.createDevice('runningSimTest', DEVICE_NAME, sdk!);

      await simctl.bootDevice();
      await simctl.startBootMonitor({timeout: MOCHA_TIMEOUT});
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
        if (major < 8 || (major === 8 && minor < 1)) {
          return this.skip();
        }
        await expect(simctl.startBootMonitor()).to.eventually.be.fulfilled;
      });
      it('should fail to monitor booting of non-existing simulator', async function () {
        if (major < 8 || (major === 8 && minor < 1)) {
          return this.skip();
        }
        const udid = simctl.udid;
        try {
          simctl.udid = 'blabla';
          await expect(simctl.startBootMonitor({timeout: 1000})).to.eventually.be.rejected;
        } finally {
          simctl.udid = udid;
        }
      });
    });

    describe('pasteboard', function () {
      let pbRetries = 0;
      before(function () {
        if (major < 8 || (major === 8 && minor < 1)) {
          return this.skip();
        }
        if (major === 9) {
          if (process.env.TRAVIS) {
            return this.skip();
          }
          // TODO: recheck when full Xcode 9 comes out to see if pasteboard works better
          pbRetries = 200;
          this.timeout(200 * 1000 * 2);
        }
      });
      it('should set and get the content of the pasteboard', async function () {
        const pbContent = 'blablabla';
        const encoding = 'ascii';

        await retryInterval(pbRetries, 1000, async () => {
          await simctl.setPasteboard(pbContent, encoding);
          expect(await simctl.getPasteboard(encoding)).to.eql(pbContent);
        });
      });
    });

    describe('add media', function () {
      const BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      let picturePath: string | undefined;
      before(async function () {
        if (major < 8 || (major === 8 && minor < 1)) {
          return this.skip();
        }
        picturePath = path.join(os.tmpdir(), `${await uuidV4()}.png`);
        await fs.writeFile(picturePath, Buffer.from(BASE64_PNG, 'base64').toString('binary'), 'binary');
      });
      after(async function () {
        if (picturePath) {
          await rimraf(picturePath);
        }
      });
      it('should add media files', async function () {
        expect((await simctl.addMedia(picturePath!)).code).to.eql(0);
      });
    });

    describe('appInfo', function () {
      it('should extract applications information', async function () {
        const appInfo = await simctl.appInfo('com.apple.springboard');
        expect(appInfo.ApplicationType).to.equal('Hidden');
      });
      it('should throw an error if the app is not installed', async function () {
        await expect(simctl.appInfo('com.apple.notinstalled')).to.be.eventually.rejected;
      });
    });

    describe('getEnv', function () {
      it('should get env variable value', async function () {
        const udid = await simctl.getEnv('SIMULATOR_UDID');
        expect(udid!.length).to.be.above(0);
      });
      it('should return null if no var is found', async function () {
        const udid = await simctl.getEnv('SIMULATOR_UDD');
        expect(_.isNull(udid)).to.be.true;
      });
    });

    describe('getDeviceTypes', function () {
      it('should get device types', async function () {
        const deviceTypes = await simctl.getDeviceTypes();
        expect(deviceTypes).to.have.length;
        expect(deviceTypes.length).to.be.above(0);
        // at least one type, no matter the version of Xcode, should be an iPhone
        expect(deviceTypes.filter((el) => el.includes('iPhone')).length).to.be.above(1);
      });
    });

    describe('list', function () {
      it('should get everything from xcrun simctl list', async function () {
        const fullList = await simctl.list();
        expect(fullList).to.have.property('devicetypes');
        expect(fullList).to.have.property('runtimes');
        expect(fullList).to.have.property('devices');
        expect(fullList).to.have.property('pairs');
        expect(fullList.devicetypes.length).to.be.above(1);
        // at least one type, no matter the version of Xcode, should be an iPhone
        expect(fullList.devicetypes.filter((el) => el.identifier.includes('iPhone')).length).to.be.above(0);
        // at least one runtime should be iOS
        expect(fullList.runtimes.filter((el) => el.identifier.includes('iOS')).length).to.be.above(0);
      });
    });

    describe('getScreenshot', function() {
      it('should get a base64 string', async function () {
        const image = await simctl.getScreenshot();

        expect(Buffer.from(image, 'base64').toString('base64') === image).to.be.true;
      });
    });

    describe('pushNotification', function() {
      it('should not throw an error when sending a push notification', async function () {
        if (process.env.CI) {
          // This test is unstable in CI env
          return this.skip();
        }

        const payload = {
          'Simulator Target Bundle': 'com.apple.Preferences',
          'aps': {
            'alert': 'This is a simulated notification!',
            'badge': 3,
            'sound': 'default'
          }
        };

        await expect(simctl.pushNotification(payload)).to.be.fulfilled;
      });
    });
  });
});

