/* global it:true, describe:true*/
// transpile:mocha

import chai from 'chai';
import _ from 'lodash';
import { createDevice, deleteDevice, eraseDevice, getDevices, setPasteboard, getPasteboard,
         bootDevice, launch, shutdown, addMedia } from '../lib/simctl.js';
import xcode from 'appium-xcode';
import B from 'bluebird';
import { fs, tempDir } from 'appium-support';


const should = chai.should();

describe('simctl', function () {
  const DEVICE_NAME = 'iPhone 6';
  const MOCHA_TIMEOUT = 200000;
  this.timeout(MOCHA_TIMEOUT);

  let randName;
  let randDeviceUdid = null;
  let validSdks = [];

  before(async () => {
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
    deleteDevice(udid);
  });

  it('should create a device with compatible properties', async function () {
    let sdk = _.last(validSdks);
    let devices = (await getDevices())[sdk];
    let firstDevice = devices[0];
    let expectedList = ['name', 'sdk', 'state', 'udid'];
    Object.keys(firstDevice).sort().should.eql(expectedList);
  });

  describe('on running Simulator', function () {
    if (process.env.TRAVIS) {
      this.retries(3);
    }

    const BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    let udid, picturePath;

    before(async function () {
      const {major, minor} = await xcode.getVersion(true);
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

      picturePath = await tempDir.path({prefix: 'pixel', suffix: '.png'});
      await fs.writeFile(picturePath, new Buffer(BASE64_PNG, 'base64').toString('binary'), 'binary');
    });
    after(async function () {
      if (udid) {
        try {
          await shutdown(udid);
        } catch (ign) {}
        await deleteDevice(udid);
      }

      if (await fs.exists(picturePath)) {
        await fs.unlink(picturePath);
      }
    });

    it('should set and get the content of the pasteboard', async function () {
      const pbContent = 'blablabla';
      const encoding = 'ascii';

      await setPasteboard(udid, pbContent, encoding);
      (await getPasteboard(udid, encoding)).should.eql(pbContent);
    });

    it('should add media files', async function () {
      (await addMedia(udid, picturePath)).code.should.eql(0);
    });
  });
});
