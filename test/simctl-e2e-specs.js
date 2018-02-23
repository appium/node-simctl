/* global it:true, describe:true*/
// transpile:mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import { createDevice, deleteDevice, eraseDevice, getDevices, setPasteboard, getPasteboard,
         bootDevice, launch, shutdown, addMedia, appInfo } from '../lib/simctl.js';
import xcode from 'appium-xcode';
import B from 'bluebird';
import { fs, tempDir } from 'appium-support';
import { retryInterval } from 'asyncbox';


const should = chai.should();
chai.use(chaiAsPromised);

describe('simctl', function () {
  const DEVICE_NAME = 'iPhone 6';
  const MOCHA_TIMEOUT = 200000;
  this.timeout(MOCHA_TIMEOUT);

  let randName;
  let randDeviceUdid = null;
  let validSdks = [];

  before(async function () {
    let devices = await getDevices();
    validSdks = _.keys(devices).sort((a, b) => a - b);
    if (!validSdks.length) {
      throw new Error('No valid SDKs');
    }
    console.log(`Found valid SDKs: ${validSdks.join(', ')}`); // eslint-disable-line no-console

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

  it('should create a device', async function () {
    let udid = await createDevice(randName, DEVICE_NAME, _.last(validSdks));
    (typeof udid).should.equal('string');
    udid.length.should.equal(36);
  });

  it('should get devices', async function () {
    let sdkDevices = await getDevices(_.last(validSdks));
    _.map(sdkDevices, 'name').should.include(randName);
    randDeviceUdid = sdkDevices.filter((d) => d.name === randName)[0].udid;
  });

  it('should erase devices', async function () {
    await eraseDevice(randDeviceUdid, 16000);
  });

  it('should delete devices', async function () {
    await deleteDevice(randDeviceUdid);
    let sdkDevices = await getDevices(_.last(validSdks));
    _.map(sdkDevices, 'name').should.not.include(randName);
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

  it('should create a device and be able to see it in devices list right away', async function () {
    let sdk = _.last(validSdks);
    let numSimsBefore = (await getDevices())[sdk].length;
    let udid = await createDevice('node-simctl test', DEVICE_NAME, sdk);
    let numSimsAfter = (await getDevices())[sdk].length;
    numSimsAfter.should.equal(numSimsBefore + 1);
    await deleteDevice(udid);
  });

  it('should create a device with compatible properties', async function () {
    let sdk = _.last(validSdks);
    let devices = (await getDevices())[sdk];
    let firstDevice = devices[0];
    let expectedList = ['name', 'sdk', 'state', 'udid'];
    Object.keys(firstDevice).sort().should.eql(expectedList);
  });

  it('should not fail to shutdown a shutdown simulator', async function () {
    let sdk = _.last(validSdks);
    let udid = await createDevice('node-simctl test', DEVICE_NAME, sdk);
    await shutdown(udid).should.eventually.not.be.rejected;
    await deleteDevice(udid);
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
      // Wait for boot to complete
      await launch(udid, 'com.apple.springboard', MOCHA_TIMEOUT);

      // pause a moment or everything is messed up
      await B.delay(5000);
    });
    after(async function () {
      if (udid) {
        try {
          await shutdown(udid);
        } catch (ign) {}
        await deleteDevice(udid);
      }
    });

    describe('pasteboard', function () {
      let pbRetries = 0;
      before(async function () {
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
        await fs.writeFile(picturePath, new Buffer(BASE64_PNG, 'base64').toString('binary'), 'binary');
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
  });
});
