/* global it:true, describe:true*/
// transpile:mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import { createDevice, deleteDevice, eraseDevice, getDevices, setPasteboard,
         getPasteboard, bootDevice, shutdown, addMedia, appInfo,
         getDeviceTypes, startBootMonitor } from '../lib/simctl.js';
import xcode from 'appium-xcode';
import { fs, tempDir } from 'appium-support';
import { retryInterval } from 'asyncbox';


const should = chai.should();
chai.use(chaiAsPromised);

describe('simctl', function () {
  const DEVICE_NAME = 'iPhone 6';
  const MOCHA_TIMEOUT = 200000;
  this.timeout(MOCHA_TIMEOUT);

  let randName;
  let validSdks = [];
  let sdk;

  before(async function () {
    const devices = await getDevices();
    validSdks = _.keys(devices).sort((a, b) => a - b);
    if (!validSdks.length) {
      throw new Error('No valid SDKs');
    }
    console.log(`Found valid SDKs: ${validSdks.join(', ')}`); // eslint-disable-line no-console
    sdk = _.last(validSdks);

    // need to find a random name that does not already exist
    // give it 5 tries
    for (let i = 0; i < 5; i++) {
      let randNum = parseInt(Math.random() * 100, 10);
      randName = `device${randNum}`;

      let nameFound = false;
      for (let list of _.values(devices)) {
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
    const devices = (await getDevices())[sdk];
    const firstDevice = devices[0];
    const expectedList = ['name', 'sdk', 'state', 'udid'];
    firstDevice.should.have.any.keys(...expectedList);
  });

  describe('createDevice', function () {
    let udid;
    after(async function () {
      if (udid) {
        await deleteDevice(udid, 16000);
      }
    });

    it('should create a device', async function () {
      udid = await createDevice(randName, DEVICE_NAME, sdk);
      (typeof udid).should.equal('string');
      udid.length.should.equal(36);
    });

    it('should create a device and be able to see it in devices list right away', async function () {
      const numSimsBefore = (await getDevices())[sdk].length;
      udid = await createDevice('node-simctl test', DEVICE_NAME, sdk);
      const numSimsAfter = (await getDevices())[sdk].length;
      numSimsAfter.should.equal(numSimsBefore + 1);
    });
  });

  describe('device manipulation', function () {
    let udid;
    const name = 'node-simctl test';
    beforeEach(async function () {
      udid = await createDevice('node-simctl test', DEVICE_NAME, sdk);
    });
    afterEach(async function () {
      if (udid) {
        await deleteDevice(udid, 16000);
      }
    });
    it('should get devices', async function () {
      const sdkDevices = await getDevices(sdk);
      _.map(sdkDevices, 'name').should.include(name);
    });

    it('should erase devices', async function () {
      await eraseDevice(udid, 16000);
    });

    it('should delete devices', async function () {
      await deleteDevice(udid);
      const sdkDevices = await getDevices(sdk);
      _.map(sdkDevices, 'name').should.not.include(udid);

      // so we do not delete again
      udid = null;
    });

    it('should not fail to shutdown a shutdown simulator', async function () {
      await shutdown(udid).should.eventually.not.be.rejected;
    });
  });

  it('should return a nice error for invalid usage', async function () {
    let err = null;
    try {
      await createDevice('foo', 'bar', 'baz');
    } catch (e) {
      err = e;
    }
    should.exist(err);
    err.message.should.include('Invalid device type: bar');
  });

  describe('on running Simulator', function () {
    if (process.env.TRAVIS) {
      this.retries(3);
    }

    let udid;
    let major, minor;

    before(async function () {
      ({major, minor} = await xcode.getVersion(true));
      if (major < 8 || (major === 8 && minor < 1)) {
        return this.skip();
      }

      const sdk = _.last(validSdks);
      udid = await createDevice('runningSimTest', DEVICE_NAME, sdk);

      await bootDevice(udid);
      await startBootMonitor(udid, {timeout: MOCHA_TIMEOUT});
    });
    after(async function () {
      if (udid) {
        try {
          await shutdown(udid);
        } catch (ign) {}
        await deleteDevice(udid);
      }
    });

    describe('startBootMonitor', function () {
      it('should be fulfilled if the simulator is already booted', async function () {
        if (major < 8 || (major === 8 && minor < 1)) {
          return this.skip();
        }
        await startBootMonitor(udid).should.eventually.be.fulfilled;
      });
      it('should fail to monitor booting of non-existing simulator', async function () {
        if (major < 8 || (major === 8 && minor < 1)) {
          return this.skip();
        }
        await startBootMonitor('blabla', {timeout: 1000}).should.eventually.be.rejected;
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

        await setPasteboard(udid, pbContent, encoding);
        await retryInterval(pbRetries, 1000, async () => {
          (await getPasteboard(udid, encoding)).should.eql(pbContent);
        });
      });
    });

    describe('add media', function () {
      const BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      let picturePath;
      before(async function () {
        if (major < 8 || (major === 8 && minor < 1)) {
          return this.skip();
        }
        picturePath = await tempDir.path({prefix: 'pixel', suffix: '.png'});
        await fs.writeFile(picturePath, Buffer.from(BASE64_PNG, 'base64').toString('binary'), 'binary');
      });
      after(async function () {
        if (await fs.exists(picturePath)) {
          await fs.unlink(picturePath);
        }
      });
      it('should add media files', async function () {
        (await addMedia(udid, picturePath)).code.should.eql(0);
      });
    });

    it('should extract applications information', async function () {
      (await appInfo(udid, 'com.apple.springboard')).should.include('ApplicationType');
    });

    describe('getDeviceTypes', function () {
      it('should get device types', async function () {
        const deviceTypes = await getDeviceTypes();
        deviceTypes.should.have.length;
        deviceTypes.length.should.be.above(0);
        // at least one type, no matter the version of Xcode, should be an iPhone
        deviceTypes.filter((el) => el.includes('iPhone')).length.should.be.above(1);
      });
    });
  });
});
