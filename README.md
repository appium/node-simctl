## node-simctl

[![NPM version](http://img.shields.io/npm/v/node-simctl.svg)](https://npmjs.org/package/node-simctl)
[![Downloads](http://img.shields.io/npm/dm/node-simctl.svg)](https://npmjs.org/package/node-simctl)
[![Dependency Status](https://david-dm.org/appium/node-simctl.svg)](https://david-dm.org/appium/node-simctl)
[![devDependency Status](https://david-dm.org/appium/node-simctl/dev-status.svg)](https://david-dm.org/appium/node-simctl#info=devDependencies)

[![Build Status](https://travis-ci.org/appium/node-simctl.svg?branch=master)](https://travis-ci.org/appium/node-simctl)
[![Coverage Status](https://coveralls.io/repos/appium/node-simctl/badge.svg?branch=master)](https://coveralls.io/r/appium/node-simctl?branch=master)

ES6/7 Node wrapper around Apple's `simctl` binary, the "Command line utility to control the iOS Simulator". `simctl` is run as a sub-command of [xcrun](https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/xcrun.1.html)

### Installation

Install through [npm](https://www.npmjs.com/package/node-simctl).

```
npm install node-simctl
```

### Api

Exported methods:

`installApp(udid, appPath)`

- `udid` - the unique identifier of the simulator to which to install the application
- `appPath` - the path to the application to be installed


`removeApp(udid, bundleId)`

- `udid` - the unique identifier of the simulator from which to remove the application
- `bundleId` - the bundle identifier of the application (e.g., `com.corp.app`)


`launch(udid, bundleId)`

- `udid` - the unique identifier of the simulator on which to launch the app
- `bundleId` - the bundle identifier of the application (e.g., `com.corp.app`)

`openUrl(udid, url)`

- `udid` - the unique identifier of the simulator on which to open the url (in safari)
- `url`- the url to navigate to

`shutdown(udid)`

- `udid` - the unique identifier of the simulator to be stopped


`createDevice(name, deviceType, runtime)`

- `name` - any name you choose for this simulator
- `deviceType` - e.g., `"iPhone 6"` or `"iPad Air"`, see more possibilities from the output of `getDevices`
- `runtime` - iOS sdk version. eg `"8.3"`

returns: `udid` of the created simulator.


`deleteDevice(udid)`

- `udid` - the unique identifier of the simulator to be deleted


`eraseDevice(udid)`

- `udid` - the unique identifier of the simulator to be erased


`getDevices()`

  output looks like:

  ```shell
  {
    '7.1': [
     { name: 'iPhone 4s',
       udid: 'C09B34E5-7DCB-442E-B79C-AB6BC0357417',
       state: 'Shutdown' },
     { name: 'iPhone 5',
       udid: 'B236B73C-8EFA-4284-AC1F-2A45F3286E4C',
       state: 'Shutdown' },
     { name: 'iPhone 5s',
       udid: '8E248C90-0F79-46AD-9CAA-8DF3B6E3FBA6',
       state: 'Shutdown' },
     { name: 'iPad 2',
       udid: 'B4179FA5-B9C4-4F79-BDDF-314ED66B889C',
       state: 'Shutdown' },
     { name: 'iPad Retina',
       udid: '707AC76E-319C-4215-BAF7-5D6D3B3BA4D2',
       state: 'Shutdown' },
     { name: 'iPad Air',
       udid: 'FA5C971D-4E05-4AA3-B48B-C9619C7453BE',
       state: 'Shutdown' } ],
    '8.1': [
     { name: 'iPhone 4s',
       udid: '0829568F-7479-4ADE-9E51-B208DC99C107',
       state: 'Shutdown' },
     { name: 'iPhone 5',
       udid: 'B5048708-566E-45D5-9885-C878EF7D6D13',
       state: 'Shutdown' },
     { name: 'iPhone 5s',
       udid: '2F7678F2-FD52-497F-9383-41D3BB401FBD',
       state: 'Shutdown' },
     { name: 'iPhone 6 Plus',
       udid: '013D6994-B4E6-4548-AD77-C0D7C6C6D245',
       state: 'Shutdown' },
     { name: 'iPhone 6',
       udid: '1CA836DA-2A2D-428A-846D-C378E0C39B09',
       state: 'Shutdown' },
     { name: 'iPad 2',
       udid: '47D8FF29-4E76-4E7B-A412-FCE9C3B8A9AC',
       state: 'Shutdown' },
     { name: 'iPad Retina',
       udid: '82071785-2C47-4AF2-BD27-1FAF2B12DF32',
       state: 'Shutdown' },
     { name: 'iPad Air',
       udid: '342872EB-7559-4D42-B601-0FCF816B2E78',
       state: 'Shutdown' },
     { name: 'Resizable iPhone',
       udid: 'E46EFA59-E2B4-4FF9-B290-B61F3CFECC65',
       state: 'Shutdown' },
     { name: 'Resizable iPad',
       udid: '6DAB91C9-CCD1-4C17-9124-D765E2F0567A',
       state: 'Shutdown' } ],
    '8.3': [
     { name: 'iPhone 4s',
       udid: '3D1A8D2A-615A-4C1E-A73C-91E92D6637FF',
       state: 'Shutdown' },
     { name: 'iPhone 5',
       udid: '813AAB6A-32C8-4859-A5CF-F3355C244F54',
       state: 'Shutdown' },
     { name: 'iPhone 5s',
       udid: '9D3A405E-65D6-4743-85DA-E644DA9A8373',
       state: 'Shutdown' },
     { name: 'iPhone 6 Plus',
       udid: 'D94E4CD7-D412-4198-BCD4-26799672975E',
       state: 'Shutdown' },
     { name: 'iPhone 6',
       udid: '26EAADAE-1CD5-42F9-9A4C-50554CDF0910',
       state: 'Shutdown' },
     { name: 'iPad 2',
       udid: 'C8E68217-82E6-42A8-8326-9824CA2E7C7C',
       state: 'Shutdown' },
     { name: 'iPad Retina',
       udid: '8F4A3349-3ABF-4597-953A-285C5C0FFD00',
       state: 'Shutdown' },
     { name: 'iPad Air',
       udid: '7DEA409E-159A-4730-B1C6-7C18279F72B8',
       state: 'Shutdown' },
     { name: 'Resizable iPhone',
       udid: 'F33783B2-9EE9-4A99-866E-E126ADBAD410',
       state: 'Shutdown' },
     { name: 'Resizable iPad',
       udid: 'DFBC2970-9455-4FD9-BB62-9E4AE5AA6954',
       state: 'Shutdown' } ]
  }
  ```

`spawn(udid, executablePath, env)`

 - spawns a process on the simulator specified by `udid` with given environment variable in `env`

`spawnSubProcess(udid, executablePath, env)`

 - spawns a process on the simulator specified by `udid` with given environment variable in `env`
 - returns a (SubProcess)[https://github.com/appium/node-teen_process#teen_processsubprocess] object.

`getScreenshot(udid)`

- returns a base64 png screenshot of device specified by `udid`

### Usage

See [specs](test/simctl-specs.js) for examples of usage.
