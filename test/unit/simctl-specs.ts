import sinon from 'sinon';
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Simctl } from '../../lib/simctl.js';

use(chaiAsPromised);

// @ts-ignore - __dirname is available in CommonJS
const testDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(require.resolve('./simctl-specs.ts'));

const devicePayloads = [
  [
    {
      stdout: fs.readFileSync(path.join(testDir, 'fixtures/devices.json'), 'utf-8'),
    },
    {
      stdout: fs.readFileSync(path.join(__dirname, 'fixtures/devices-with-unavailable.json'), 'utf-8'),
    },
  ],
  [
    {
      stdout: fs.readFileSync(path.join(__dirname, 'fixtures/devices-simple.json'), 'utf-8'),
    },
    {
      stdout: fs.readFileSync(path.join(__dirname, 'fixtures/devices-with-unavailable-simple.json'), 'utf-8'),
    },
  ],
];

describe('simctl', function () {
  let execStub: sinon.SinonStub;

  function stubSimctl (xcrun: { path?: string | null } = {}) {
    const simctl = new Simctl({ xcrun: { path: xcrun.path ?? null } });
    execStub = sinon.stub(simctl, 'exec' as any).resolves({ stdout: '', stderr: '' });
    return simctl;
  }


  describe('getDevices', function () {
    let simctl: Simctl;

    beforeEach(function () {
      simctl = stubSimctl({ path: 'xcrun' });
    });
    afterEach(function () {
      if (execStub) {
        execStub.resetHistory();
      }
    });
    after(function () {
      if (execStub) {
        execStub.restore();
      }
    });

    for (const [devicesPayload, devicesWithUnavailablePayload] of devicePayloads) {
      describe('no forSdk defined', function () {
        describe('no platform defined', function () {
          it('should get all the devices in the JSON', async function () {
            execStub.returns(devicesPayload);

            const devices = await simctl.getDevices();
            expect(_.keys(devices).length).to.eql(2);

            expect(devices['12.1'].length).to.eql(10);
            expect(devices['5.1'].length).to.eql(6);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await simctl.getDevices();
            expect(_.keys(devices).length).to.eql(4);

            expect(devices['12.1'].length).to.eql(10);
            expect(devices['5.1'].length).to.eql(6);
            expect(devices['12.2'].length).to.eql(0);
            expect(devices['5.2'].length).to.eql(0);
          });
        });
        describe('platform defined', function () {
          it('should get all the devices in the JSON', async function () {
            execStub.returns(devicesPayload);

            const devices = await simctl.getDevices(null, 'tvOS');
            expect(_.keys(devices).length).to.eql(1);

            expect(devices['12.1'].length).to.eql(3);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await simctl.getDevices(null, 'tvOS');
            expect(_.keys(devices).length).to.eql(2);

            expect(devices['12.1'].length).to.eql(3);
            expect(devices['12.2'].length).to.eql(0);
          });
        });
      });

      describe('forSdk defined', function () {
        describe('no platform defined', function () {
          it('should get all the devices in the JSON', async function () {
            execStub.returns(devicesPayload);

            const devices = await simctl.getDevices('12.1');
            expect(_.keys(devices).length).to.eql(10);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await simctl.getDevices('12.1');
            expect(_.keys(devices).length).to.eql(10);
          });
        });
        describe('platform defined', function () {
          it('should get all the devices in the JSON', async function () {
            execStub.returns(devicesPayload);

            const devices = await simctl.getDevices('5.1', 'watchOS');
            expect(_.keys(devices).length).to.eql(6);
          });
          it('should ignore unavailable devices', async function () {
            execStub.returns(devicesWithUnavailablePayload);

            const devices = await simctl.getDevices('5.1', 'watchOS');
            expect(_.keys(devices).length).to.eql(6);
          });
        });
      });
    }
  });

  describe('#createDevice', function () {
    const devicesPayload = devicePayloads[0][0];
    let simctl: Simctl;

    beforeEach(function () {
      simctl = stubSimctl({ path: 'xcrun' });
    });
    afterEach(function () {
      if (execStub) {
        execStub.resetHistory();
      }
      delete process.env.XCRUN_BINARY;
    });
    after(function () {
      if (execStub) {
        execStub.restore();
      }
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
      expect(execStub.getCall(2).args[0]).to.eql('create');
      expect(execStub.getCall(2).args[1].args).to.eql([
        'name', 'iPhone 6 Plus', 'com.apple.CoreSimulator.SimRuntime.iOS-12-1'
      ]);
      expect(execStub.getCall(0).args[0]).to.eql('list');
      expect(devices).to.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
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
      expect(execStub.getCall(2).args[0]).to.eql('create');
      expect(execStub.getCall(2).args[1].args).to.eql([
        'name', 'iPhone 6 Plus', 'com.apple.CoreSimulator.SimRuntime.iOS-12-1'
      ]);
      expect(execStub.getCall(0).args[0]).to.eql('list');
      expect(devices).to.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
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
      expect(execStub.getCall(1).args[0]).to.eql('create');
      expect(execStub.getCall(1).args[1].args).to.eql([
        'name', 'iPhone 6 Plus', 'com.apple.CoreSimulator.SimRuntime.iOS-12-1-1'
      ]);
      expect(devices).to.eql('FA628127-1D5C-45C3-9918-A47BF7E2AE14');
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
      expect(execStub.getCall(2).args[0]).to.eql('create');
      expect(execStub.getCall(2).args[1].args).to.eql([
        'name', 'Apple TV', 'com.apple.CoreSimulator.SimRuntime.tvOS-12-1'
      ]);
      expect(devices).to.eql('FA628127-1D5C-45C3-9918-A47BF7E2AE14');
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
      expect(execStub.getCall(3).args[0]).to.eql('create');
      expect(execStub.getCall(3).args[1].args).to.eql([
        'name', 'iPhone 6 Plus', '12.1'
      ]);
      expect(devices).to.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
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
      expect(execStub.getCall(3).args[0]).to.eql('create');
      expect(execStub.getCall(3).args[1].args).to.eql([
        'name', 'iPhone 6 Plus', '12.1'
      ]);
      expect(devices).to.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
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
      expect(execStub.getCall(3).args[0]).to.eql('create');
      expect(execStub.getCall(3).args[1].args).to.eql([
        'name', 'iPhone 6 Plus', 'com.apple.CoreSimulator.SimRuntime.iOS-12-1-1'
      ]);
      expect(devices).to.eql('EE76EA77-E975-4198-9859-69DFF74252D2');
    });
  });
});

