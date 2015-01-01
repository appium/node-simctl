// transpile:mocha

import 'mochawait';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import { mapify } from 'es6-mapify';
import simctl from '../..';

chai.use(chaiAsPromised);
let should = chai.should();

describe('simctl', () => {
  let randNum = parseInt(Math.random() * 100, 10);
  let randName = `device${randNum}`;
  let randDeviceUdid = null;
  let validSdks = [];

  it('should create a device', async () => {
    let devices = await simctl.getDevices();
    validSdks = _.keys(devices);
    if (!validSdks.length) {
      throw new Error("No valid SDKs");
    }
    for (let list of mapify(devices).values()) {
      if (_.contains(_.pluck(list, 'name'), randName)) {
        throw new Error(`Couldn't run test because device ${randName} ` +
                        `already exists`);
      }
    }
    await simctl.createDevice(randName, 'iPad Air', validSdks[0]);
  });

  it('should get devices', async () => {
    let sdkDevices = await simctl.getDevices(validSdks[0]);
    _.pluck(sdkDevices, 'name').should.include(randName);
    randDeviceUdid = sdkDevices.filter((d) => d.name === randName)[0].udid;
  });

  it('should erase devices', async () => {
    await simctl.eraseDevice(randDeviceUdid);
  });

  it('should delete devices', async () => {
    await simctl.deleteDevice(randDeviceUdid);
    let sdkDevices = await simctl.getDevices(validSdks[0]);
    _.pluck(sdkDevices, 'name').should.not.include(randName);
  });

  it('should return a nice error for invalid usage', async () => {
    let err = null;
    try {
      await simctl.createDevice('foo', 'bar', 'baz');
    } catch (e) {
      err = e;
    }
    should.exist(err);
    err.message.should.include('Invalid device type: bar');
  });

  if (process.env.RTTS_ASSERT) {
    it('should detect type assertion error', () => {
      return simctl.getDevices(123).should.be.rejectedWith(/Invalid arguments given!/);
    });
  } else {
    it('should not detect type assertion error', () => {
      return simctl.getDevices(123).should.be.rejectedWith(/not in list of simctl sdks/);
    });
  }
});
