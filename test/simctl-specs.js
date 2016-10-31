/* global it:true, describe:true*/
// transpile:mocha

import chai from 'chai';
import _ from 'lodash';
import { createDevice, deleteDevice, eraseDevice, getDevices } from '../lib/simctl.js';


const should = chai.should();

describe('simctl', function () {
  this.timeout(40000); // enough time to allow the functions to themselves time out
  let randDeviceUdid = null;
  let randTestSdk = null;
  let validSdks = [];

  before(async () => {
    let devices = await getDevices();
    validSdks = _.keys(devices);
    if (!validSdks.length) {
      throw new Error('No valid SDKs');
    }

    // Set an iOS SDK to use (since sometimes the last
    // is an Apple watch SDK, and you can't run that on the iPhone)
    randTestSdk = _.last(validSdks.filter((x) => x.toLowerCase().startsWith('ios')));
  });

  it('should create a device', async () => {
    let udid = await createDevice('iPhone 5s', randTestSdk);
    (typeof udid).should.equal('string');
    udid.length.should.equal(36);
    randDeviceUdid = udid;
  });

  it('should get devices', async () => {
    let sdkDevices = await getDevices(randTestSdk);
    let found = sdkDevices.filter((d) => d.udid === randDeviceUdid)[0];
    should.equal(found.udid, randDeviceUdid);
  });

  it('should erase devices', async () => {
    await eraseDevice(randDeviceUdid, 16000);
  });

  it('should delete devices', async () => {
    await deleteDevice(randDeviceUdid);
    let sdkDevices = await getDevices(randTestSdk);
    _.map(sdkDevices, 'udid').should.not.include(randDeviceUdid);
  });

  it('should return a nice error for invalid usage', async () => {
    let err = null;
    try {
      await createDevice('foo', 'bar');
    } catch (e) {
      err = e;
    }
    should.exist(err);
    err.message.should.include('Error creating device type: foo');
  });

  it('should create a device and be able to see it in devices list right away', async () => {
    let numSimsBefore = (await getDevices())[randTestSdk].length;
    let udid = await createDevice('iPhone 5s', randTestSdk);
    let numSimsAfter = (await getDevices())[randTestSdk].length;
    numSimsAfter.should.equal(numSimsBefore + 1);
    deleteDevice(udid);
  });

});
