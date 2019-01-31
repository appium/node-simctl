import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import * as TeenProcess from 'teen_process';
import _ from 'lodash';
import { getDevices } from '../lib/simctl';


const devicePayloads = [
  [
    {
      stdout: JSON.stringify(require('../../test/fixtures/devices.json')), // eslint-disable-line no-unresolved
    },
    {
      stdout: JSON.stringify(require('../../test/fixtures/devices-with-unavailable.json')), // eslint-disable-line no-unresolved
    },
  ],
  [
    {
      stdout: JSON.stringify(require('../../test/fixtures/devices-simple.json')), // eslint-disable-line no-unresolved
    },
    {
      stdout: JSON.stringify(require('../../test/fixtures/devices-with-unavailable-simple.json')), // eslint-disable-line no-unresolved
    },
  ],
];

chai.should();
chai.use(chaiAsPromised);

describe('simctl', function () {
  describe('getDevices', function () {
    const execStub = sinon.stub(TeenProcess, 'exec');
    afterEach(function () {
      execStub.resetHistory();
    });
    after(function () {
      execStub.reset();
    });

    for (const [devicesPayload, devicesWithUnavailablePayload] of devicePayloads) {
      describe('no forSdk defined', function () {
        describe('no platform defined', function () {
          it('should get all the devices in the JSON', async function () {
            execStub.returns(devicesPayload);

            const devices = await getDevices();
            _.keys(devices).length.should.eql(2);

            devices['12.1'].length.should.eql(10);
            devices['5.1'].length.should.eql(6);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await getDevices();
            _.keys(devices).length.should.eql(4);

            devices['12.1'].length.should.eql(10);
            devices['5.1'].length.should.eql(6);
            devices['12.2'].length.should.eql(0);
            devices['5.2'].length.should.eql(0);
          });
        });
        describe('platform defined', function () {
          it('should get all the devices in the JSON', async function () {
            execStub.returns(devicesPayload);

            const devices = await getDevices(null, 'tvOS');
            _.keys(devices).length.should.eql(1);

            devices['12.1'].length.should.eql(3);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await getDevices(null, 'tvOS');
            _.keys(devices).length.should.eql(2);

            devices['12.1'].length.should.eql(3);
            devices['12.2'].length.should.eql(0);
          });
        });
      });

      describe('forSdk defined', function () {
        describe('no platform defined', function () {
          it('should get all the devices in the JSON', async function () {
            execStub.returns(devicesPayload);

            const devices = await getDevices('12.1');
            _.keys(devices).length.should.eql(10);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await getDevices('12.1');
            _.keys(devices).length.should.eql(10);
          });
        });
        describe('platform defined', function () {
          it('should get all the devices in the JSON', async function () {
            execStub.returns(devicesPayload);

            const devices = await getDevices('5.1', 'watchOS');
            _.keys(devices).length.should.eql(6);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await getDevices('5.1', 'watchOS');
            _.keys(devices).length.should.eql(6);
          });
        });
      });
    }
  });
});
