/* global it:true, describe:true*/
// transpile:mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import Simctl from '../lib/simctl.js';
import xcode from 'appium-xcode';
import { retryInterval } from 'asyncbox';
import rimraf from 'rimraf';
import { v4 as uuidV4 } from 'uuid';
import path from 'path';
import os from 'os';
import fs from 'fs';
import B from 'bluebird';

const should = chai.should();
chai.use(chaiAsPromised);
const rimrafAsync = B.promisify(rimraf);
const writeFileAsync = B.promisify(fs.writeFile);


describe('simctl', function () {
  const DEVICE_NAME = process.env.DEVICE_NAME || 'iPhone X';
  const MOCHA_TIMEOUT = 200000;
  this.timeout(MOCHA_TIMEOUT);

  let randName;
  let validSdks = [];
  let sdk;
  let simctl;

  before(async function () {
    simctl = new Simctl();
    const devices = await simctl.getDevices();
    validSdks = _.keys(devices)
      .filter((key) => !_.isEmpty(devices[key]))
      .sort((a, b) => a - b);
    if (!validSdks.length) {
      throw new Error('No valid SDKs');
    }
    console.log(`Found valid SDKs: ${validSdks.join(', ')}`); // eslint-disable-line no-console
    sdk = process.env.IOS_SDK || _.last(validSdks);

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
    const devices = (await simctl.getDevices())[sdk];
    const firstDevice = devices[0];
    const expectedList = ['name', 'sdk', 'state', 'udid'];
    firstDevice.should.have.any.keys(...expectedList);
  });

  describe('createDevice', function () {
    after(async function () {
      if (simctl.udid) {
        await simctl.deleteDevice(16000);
        simctl.udid = null;
      }
    });

    it('should create a device', async function () {
      simctl.udid = await simctl.createDevice(randName, DEVICE_NAME, sdk);
      (typeof simctl.udid).should.equal('string');
      simctl.udid.length.should.equal(36);
    });

    it('should create a device and be able to see it in devices list right away', async function () {
      const numSimsBefore = (await simctl.getDevices())[sdk].length;
      simctl.udid = await simctl.createDevice('node-simctl test', DEVICE_NAME, sdk);
      const numSimsAfter = (await simctl.getDevices())[sdk].length;
      numSimsAfter.should.equal(numSimsBefore + 1);
    });
  });

  describe('device manipulation', function () {
    let simctl;
    const name = 'node-simctl test';
    beforeEach(async function () {
      simctl = new Simctl();
      simctl.udid = await simctl.createDevice('node-simctl test', DEVICE_NAME, sdk);
    });
    afterEach(async function () {
      if (simctl.udid) {
        await simctl.deleteDevice(simctl.udid, 16000);
        simctl.udid = null;
      }
    });
    it('should get devices', async function () {
      const sdkDevices = await simctl.getDevices(sdk);
      _.map(sdkDevices, 'name').should.include(name);
    });

    it('should erase devices', async function () {
      await simctl.eraseDevice(16000);
    });

    it('should delete devices', async function () {
      await simctl.deleteDevice();
      const sdkDevices = await simctl.getDevices(sdk);
      _.map(sdkDevices, 'name').should.not.include(simctl.udid);

      // so we do not delete again
      simctl.udid = null;
    });

    it('should not fail to shutdown a shutdown simulator', async function () {
      await simctl.shutdownDevice().should.eventually.not.be.rejected;
    });
  });

  it('should return a nice error for invalid usage', async function () {
    let err = null;
    try {
      await simctl.createDevice('foo', 'bar', 'baz');
    } catch (e) {
      err = e;
    }
    should.exist(err);
    err.message.should.include(`Unable to parse version 'baz'`);
  });

  describe('on running Simulator', function () {
    if (process.env.TRAVIS) {
      this.retries(3);
    }

    let major, minor;

    before(async function () {
      ({major, minor} = await xcode.getVersion(true));
      if (major < 8 || (major === 8 && minor < 1)) {
        return this.skip();
      }

      const sdk = process.env.IOS_SDK || _.last(validSdks);
      simctl.udid = await simctl.createDevice('runningSimTest', DEVICE_NAME, sdk);

      await simctl.bootDevice();
      await simctl.startBootMonitor({timeout: MOCHA_TIMEOUT});
    });
    after(async function () {
      if (simctl.udid) {
        try {
          await simctl.shutdownDevice();
        } catch (ign) {}
        await simctl.deleteDevice();
        simctl.udid = null;
      }
    });

    describe('startBootMonitor', function () {
      it('should be fulfilled if the simulator is already booted', async function () {
        if (major < 8 || (major === 8 && minor < 1)) {
          return this.skip();
        }
        await simctl.startBootMonitor().should.eventually.be.fulfilled;
      });
      it('should fail to monitor booting of non-existing simulator', async function () {
        if (major < 8 || (major === 8 && minor < 1)) {
          return this.skip();
        }
        const udid = simctl.udid;
        try {
          simctl.udid = 'blabla';
          await simctl.startBootMonitor({timeout: 1000}).should.eventually.be.rejected;
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

        await simctl.setPasteboard(pbContent, encoding);
        await retryInterval(pbRetries, 1000, async () => {
          (await simctl.getPasteboard(encoding)).should.eql(pbContent);
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
        picturePath = path.join(os.tmpdir(), `${uuidV4()}.png`);
        await writeFileAsync(picturePath, Buffer.from(BASE64_PNG, 'base64').toString('binary'), 'binary');
      });
      after(async function () {
        if (picturePath) {
          await rimrafAsync(picturePath);
        }
      });
      it('should add media files', async function () {
        (await simctl.addMedia(picturePath)).code.should.eql(0);
      });
    });

    it('should extract applications information', async function () {
      (await simctl.appInfo('com.apple.springboard')).should.include('ApplicationType');
    });

    describe('getEnv', function () {
      it('should get env variable value', async function () {
        const udid = await simctl.getEnv('SIMULATOR_UDID');
        udid.length.should.be.above(0);
      });
      it('should return null if no var is found', async function () {
        const udid = await simctl.getEnv('SIMULATOR_UDD');
        _.isNull(udid).should.be.true;
      });
    });

    describe('getDeviceTypes', function () {
      it('should get device types', async function () {
        const deviceTypes = await simctl.getDeviceTypes();
        deviceTypes.should.have.length;
        deviceTypes.length.should.be.above(0);
        // at least one type, no matter the version of Xcode, should be an iPhone
        deviceTypes.filter((el) => el.includes('iPhone')).length.should.be.above(1);
      });
    });
    describe('list', function () {
      it('should get everything from xcrun simctl list', async function () {
        const fullList = await simctl.list();
        fullList.should.have.property('devicetypes');
        fullList.should.have.property('runtimes');
        fullList.should.have.property('devices');
        fullList.should.have.property('pairs');
        fullList.devicetypes.length.should.be.above(1);
        // at least one type, no matter the version of Xcode, should be an iPhone
        fullList.devicetypes.filter((el) => el.identifier.includes('iPhone')).length.should.be.above(0);
        // at least one runtime should be iOS
        fullList.runtimes.filter((el) => el.identifier.includes('iOS')).length.should.be.above(0);
      });
    });
  });
});
