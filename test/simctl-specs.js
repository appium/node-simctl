import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import * as TeenProcess from 'teen_process';
import _ from 'lodash';
import { getDevices, createDevice } from '../lib/simctl';
import * as xcode from 'appium-xcode';

const devicePayloads = [
  [
    {
      stdout: JSON.stringify(require('../../test/fixtures/devices.json')), // eslint-disable-line import/no-unresolved
    },
    {
      stdout: JSON.stringify(require('../../test/fixtures/devices-with-unavailable.json')), // eslint-disable-line import/no-unresolved
    },
  ],
  [
    {
      stdout: JSON.stringify(require('../../test/fixtures/devices-simple.json')), // eslint-disable-line import/no-unresolved
    },
    {
      stdout: JSON.stringify(require('../../test/fixtures/devices-with-unavailable-simple.json')), // eslint-disable-line import/no-unresolved
    },
  ],
];

chai.should();
chai.use(chaiAsPromised);

describe('simctl', function () {
  const execStub = sinon.stub(TeenProcess, 'exec');

  describe('getDevices', function () {
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

  describe('#createDevice', function () {
    const devicesPayload = devicePayloads[0][0];
    const getClangVersionStub = sinon.stub(xcode, 'getClangVersion');
    const getXcodeVersionStub = sinon.stub(xcode, 'getVersion');
    afterEach(function () {
      execStub.resetHistory();
      getClangVersionStub.resetHistory();
    });
    after(function () {
      execStub.reset();
      getClangVersionStub.reset();
    });

    it('should create iOS simulator by default', async function () {
      execStub.onCall(0).returns({stdout: 'not json'})
              .onCall(1).returns({stdout: 'com.apple.CoreSimulator.SimRuntime.iOS-12-1-1', stderr: ''})
              .onCall(2).returns({stdout: 'EE76EA77-E975-4198-9859-69DFF74252D2', stderr: ''})
              .onCall(3).returns(devicesPayload);
      getClangVersionStub.returns('1001.0.46.3');

      const devices = await createDevice(
        'name',
        'iPhone 6 Plus',
        '12.1.1',
        { timeout: 20000 }
      );
      execStub.getCall(2).args[1].should.eql([
        'simctl', 'create', 'name', 'iPhone 6 Plus', 'com.apple.CoreSimulator.SimRuntime.iOS-12-1-1'
      ]);
      devices.should.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
    });

    it('should create iOS simulator by default and use xcrun simctl "json" parsing', async function () {
      const runtimesJson = `{
        "runtimes" : [
          {
            "buildversion" : "15B87",
            "availability" : "(available)",
            "name" : "iOS 12.1.1",
            "identifier" : "com.apple.CoreSimulator.SimRuntime.iOS-12-1-1",
            "version" : "12.1.1"
          },
          {
            "buildversion" : "15J580",
            "availability" : "(available)",
            "name" : "tvOS 11.1",
            "identifier" : "com.apple.CoreSimulator.SimRuntime.tvOS-11-1",
            "version" : "11.1"
          },
          {
            "buildversion" : "15R844",
            "availability" : "(available)",
            "name" : "watchOS 4.1",
            "identifier" : "com.apple.CoreSimulator.SimRuntime.watchOS-4-1",
            "version" : "4.1"
          }
        ]
      }`;
      execStub.onCall(0).returns({stdout: runtimesJson})
        .onCall(1).returns({stdout: 'FA628127-1D5C-45C3-9918-A47BF7E2AE14', stderr: ''})
        .onCall(2).returns(devicesPayload);
      getClangVersionStub.returns('1.1.1.1');

      const devices = await createDevice(
        'name',
        'iPhone 6 Plus',
        '12.1.1',
        { timeout: 20000 }
      );
      execStub.getCall(1).args[1].should.eql([
        'simctl', 'create', 'name', 'iPhone 6 Plus', 'com.apple.CoreSimulator.SimRuntime.iOS-12-1-1'
      ]);
      devices.should.eql('FA628127-1D5C-45C3-9918-A47BF7E2AE14');
    });

    it('should create tvOS simulator', async function () {
      execStub.onCall(0).returns({stdout: 'invalid json'})
              .onCall(1).returns({stdout: 'com.apple.CoreSimulator.SimRuntime.tvOS-12-1', stderr: ''})
              .onCall(2).returns({stdout: 'FA628127-1D5C-45C3-9918-A47BF7E2AE14', stderr: ''})
              .onCall(3).returns(devicesPayload);
      getClangVersionStub.returns('1001.0.46.4');

      const devices = await createDevice(
        'name',
        'Apple TV',
        '12.1',
        { timeout: 20000, platform: 'tvOS' }
      );
      execStub.getCall(2).args[1].should.eql([
        'simctl', 'create', 'name', 'Apple TV', 'com.apple.CoreSimulator.SimRuntime.tvOS-12-1'
      ]);
      devices.should.eql('FA628127-1D5C-45C3-9918-A47BF7E2AE14');
    });

    it('should create iOS simulator by default with lower command line tool but newer xcode version', async function () {
      execStub.onCall(0).returns({stdout: 'invalid json'})
              .onCall(1).returns({stdout: '12.1', stderr: ''})
              .onCall(2).returns({stdout: 'EE76EA77-E975-4198-9859-69DFF74252D2', stderr: ''})
              .onCall(3).returns(devicesPayload);
      getClangVersionStub.returns('1000.11.45.5');
      getXcodeVersionStub.returns('10.1');

      const devices = await createDevice(
        'name',
        'iPhone 6 Plus',
        '12.1',
        { timeout: 20000 }
      );
      execStub.getCall(2).args[1].should.eql([
        'simctl', 'create', 'name', 'iPhone 6 Plus', '12.1'
      ]);
      devices.should.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
    });

    it('should create iOS simulator by default with old format', async function () {
      execStub.onCall(0).returns({stdout: 'invalid json'})
              .onCall(1).returns({stdout: '12.1', stderr: ''})
              .onCall(2).returns({stdout: 'EE76EA77-E975-4198-9859-69DFF74252D2', stderr: ''})
              .onCall(3).returns(devicesPayload);
      getClangVersionStub.returns('1000.11.45.5');
      getXcodeVersionStub.returns('10.1');

      const devices = await createDevice(
        'name',
        'iPhone 6 Plus',
        '12.1',
        { timeout: 20000 }
      );
      execStub.getCall(2).args[1].should.eql([
        'simctl', 'create', 'name', 'iPhone 6 Plus', '12.1'
      ]);
      devices.should.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
    });

  });
});
