/* global it:true, describe:true*/
import sms from 'source-map-support';
sms.install();
import 'traceur/bin/traceur-runtime';
let regIt = it;
import 'mochawait';
import should from 'should';
import { mapify } from 'es6-mapify';
import _ from 'lodash';
import { createDevice, deleteDevice, eraseDevice, getDevices } from '../../lib/es5/simctl.js';

describe('simctl', () => {
  let randNum = parseInt(Math.random() * 100, 10);
  let randName = `device${randNum}`;
  let randDeviceUdid = null;
  let validSdks = [];

  it('should create a device', async () => {
    let devices = await getDevices();
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
    await createDevice(randName, 'iPad Air', validSdks[0]);
  });

  it('should get devices', async () => {
    let sdkDevices = await getDevices(validSdks[0]);
    _.pluck(sdkDevices, 'name').should.containEql(randName);
    randDeviceUdid = sdkDevices.filter((d) => d.name === randName)[0].udid;
  });

  it('should erase devices', async () => {
    await eraseDevice(randDeviceUdid);
  });

  it('should delete devices', async () => {
    await deleteDevice(randDeviceUdid);
    let sdkDevices = await getDevices(validSdks[0]);
    _.pluck(sdkDevices, 'name').should.not.containEql(randName);
  });

  it('should return a nice error for invalid usage', async () => {
    let err = null;
    try {
      await createDevice('foo', 'bar', 'baz');
    } catch (e) {
      err = e;
    }
    should.exist(err);
    err.message.should.containEql('Invalid device type: bar');
  });

});
