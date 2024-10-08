import pq from 'proxyquire';
import sinon from 'sinon';
import * as TeenProcess from 'teen_process';
import _ from 'lodash';
import fs from 'node:fs';

const proxyquire = pq.noCallThru();

const devicePayloads = [
  [
    {
      stdout: fs.readFileSync(`${__dirname}/fixtures/devices.json`, 'utf-8'),
    },
    {
      stdout: fs.readFileSync(`${__dirname}/fixtures/devices-with-unavailable.json`, 'utf-8'),
    },
  ],
  [
    {
      stdout: fs.readFileSync(`${__dirname}/fixtures/devices-simple.json`, 'utf-8'),
    },
    {
      stdout: fs.readFileSync(`${__dirname}/fixtures/devices-with-unavailable-simple.json`, 'utf-8'),
    },
  ],
];

describe('simctl', function () {
  let chai;
  let chaiAsPromised;

  const execStub = sinon.stub(TeenProcess, 'exec');
  function stubSimctl (xcrun = {}) {
    const xcrunPath = process.env.XCRUN_BINARY || xcrun.path;
    const { Simctl } = proxyquire('../../lib/simctl', {
      'which': sinon.stub().withArgs(xcrunPath).resolves(xcrunPath)
    });

    return new Simctl({ xcrun });
  }

  before(async function() {
    chai = await import('chai');
    chaiAsPromised = await import('chai-as-promised');

    chai.should();
    chai.use(chaiAsPromised.default);
  });


  describe('getDevices', function () {
    let simctl;

    beforeEach(function () {
      simctl = stubSimctl({ path: 'xcrun' });
    });
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

            const devices = await simctl.getDevices();
            _.keys(devices).length.should.eql(2);

            devices['12.1'].length.should.eql(10);
            devices['5.1'].length.should.eql(6);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await simctl.getDevices();
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

            const devices = await simctl.getDevices(null, 'tvOS');
            _.keys(devices).length.should.eql(1);

            devices['12.1'].length.should.eql(3);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await simctl.getDevices(null, 'tvOS');
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

            const devices = await simctl.getDevices('12.1');
            _.keys(devices).length.should.eql(10);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await simctl.getDevices('12.1');
            _.keys(devices).length.should.eql(10);
          });
        });
        describe('platform defined', function () {
          it('should get all the devices in the JSON', async function () {
            execStub.returns(devicesPayload);

            const devices = await simctl.getDevices('5.1', 'watchOS');
            _.keys(devices).length.should.eql(6);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await simctl.getDevices('5.1', 'watchOS');
            _.keys(devices).length.should.eql(6);
          });
        });
      });
    }
  });

  describe('#createDevice', function () {
    const devicesPayload = devicePayloads[0][0];
    let simctl;

    beforeEach(function () {
      simctl = stubSimctl({ path: 'xcrun' });
    });
    afterEach(function () {
      execStub.resetHistory();
      delete process.env.XCRUN_BINARY;
    });
    after(function () {
      execStub.reset();
    });

    it('should create iOS simulator using xcrun path from env', async function () {
      process.env.XCRUN_BINARY = 'some/path';
      simctl = stubSimctl({ path: undefined });
      execStub.onCall(0).returns({stdout: 'not json'})
              .onCall(1).returns({stdout: '12.1.1', stderr: ''})
              .onCall(2).returns({stdout: 'EE76EA77-E975-4198-9859-69DFF74252D2', stderr: ''})
              .onCall(3).returns(devicesPayload);

      const devices = await simctl.createDevice(
        'name',
        'iPhone 6 Plus',
        '12.1.1',
        { timeout: 20000 }
      );
      execStub.getCall(2).args[1].should.eql([
        'simctl', 'create', 'name', 'iPhone 6 Plus', 'com.apple.CoreSimulator.SimRuntime.iOS-12-1'
      ]);
      execStub.getCall(0).args[0].should.eql('some/path');
      devices.should.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
    });

    it('should create iOS simulator using xcrun path from passed opts', async function () {
      process.env.XCRUN_BINARY = 'some/path';
      simctl = stubSimctl({ path: 'other/path' });
      execStub.onCall(0).returns({stdout: 'not json'})
              .onCall(1).returns({stdout: '12.1.1', stderr: ''})
              .onCall(2).returns({stdout: 'EE76EA77-E975-4198-9859-69DFF74252D2', stderr: ''})
              .onCall(3).returns(devicesPayload);

      const devices = await simctl.createDevice(
        'name',
        'iPhone 6 Plus',
        '12.1.1',
        { timeout: 20000 }
      );
      execStub.getCall(2).args[1].should.eql([
        'simctl', 'create', 'name', 'iPhone 6 Plus', 'com.apple.CoreSimulator.SimRuntime.iOS-12-1'
      ]);
      execStub.getCall(0).args[0].should.eql('other/path');
      devices.should.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
    });

    it('should create iOS simulator and use xcrun simctl "json" parsing', async function () {
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

      const devices = await simctl.createDevice(
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

      const devices = await simctl.createDevice(
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

    it('should create iOS simulator with old runtime format', async function () {
      execStub.onCall(0).returns({stdout: 'invalid json'})
              .onCall(1).returns({stdout: '12.1', stderr: ''})
              .onCall(2).throws('Invalid runtime: com.apple.CoreSimulator.SimRuntime.iOS-12-1')
              .onCall(3).returns({stdout: 'EE76EA77-E975-4198-9859-69DFF74252D2', stderr: ''})
              .onCall(4).returns(devicesPayload);

      const devices = await simctl.createDevice(
        'name',
        'iPhone 6 Plus',
        '12.1',
        { timeout: 20000 }
      );
      execStub.getCall(3).args[1].should.eql([
        'simctl', 'create', 'name', 'iPhone 6 Plus', '12.1'
      ]);
      devices.should.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
    });

    it('should create iOS simulator with old runtime format and three-part platform version', async function () {
      execStub.onCall(0).returns({stdout: 'invalid json'})
              .onCall(1).returns({stdout: '12.1.1', stderr: ''})
              .onCall(2).throws('Invalid runtime: com.apple.CoreSimulator.SimRuntime.iOS-12-1')
              .onCall(3).returns({stdout: 'EE76EA77-E975-4198-9859-69DFF74252D2', stderr: ''})
              .onCall(4).returns(devicesPayload);

      const devices = await simctl.createDevice(
        'name',
        'iPhone 6 Plus',
        '12.1',
        { timeout: 20000 }
      );
      execStub.getCall(3).args[1].should.eql([
        'simctl', 'create', 'name', 'iPhone 6 Plus', '12.1'
      ]);
      devices.should.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
    });

    it('should create iOS simulator with three-part platform version and three-part runtime', async function () {
      execStub.onCall(0).returns({stdout: 'invalid json'})
              .onCall(1).returns({stdout: '12.1.1', stderr: ''})
              .onCall(2).throws('Invalid runtime: com.apple.CoreSimulator.SimRuntime.iOS-12-1')
              .onCall(3).returns({stdout: 'EE76EA77-E975-4198-9859-69DFF74252D2', stderr: ''})
              .onCall(4).returns(devicesPayload);

      const devices = await simctl.createDevice(
        'name',
        'iPhone 6 Plus',
        '12.1.1',
        { timeout: 20000 }
      );
      execStub.getCall(3).args[1].should.eql([
        'simctl', 'create', 'name', 'iPhone 6 Plus', 'com.apple.CoreSimulator.SimRuntime.iOS-12-1-1'
      ]);
      devices.should.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
    });
  });
});
