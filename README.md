## node-simctl

[![NPM version](http://img.shields.io/npm/v/node-simctl.svg)](https://npmjs.org/package/node-simctl)
[![Downloads](http://img.shields.io/npm/dm/node-simctl.svg)](https://npmjs.org/package/node-simctl)

[![Release](https://github.com/appium/node-simctl/actions/workflows/publish.js.yml/badge.svg?branch=master)](https://github.com/appium/node-simctl/actions/workflows/publish.js.yml)

ES6/7 Node wrapper around Apple's `simctl` binary, the "Command line utility to control the iOS Simulator". `simctl` is run as a sub-command of [xcrun](https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/xcrun.1.html)

### Installation

Install through [npm](https://www.npmjs.com/package/node-simctl).

```
npm install node-simctl
```

### API

The module exports single class `Simctl`. This class contains methods
which wrap the following simctl subcommands:

#### create (Create a new device)
 - createDevice `*`

#### clone (Clone an existing device)
_None_

#### upgrade (Upgrade a device to a newer runtime)
_None_

#### delete (Delete specified devices, unavailable devices, or all devices)
 - deleteDevice

#### pair (Create a new watch and phone pair)
_None_

#### unpair (Unpair a watch and phone pair)
_None_

#### pair_activate (Set a given pair as active)
_None_

#### erase (Erase a device's contents and settings)
 - eraseDevice

#### boot (Boot a device)
 - bootDevice

#### shutdown (Shutdown a device)
 - shutdownDevice

#### rename (Rename a device)
_None_

#### getenv (Print an environment variable from a running device)
- getEnv

#### openurl (Open a URL in a device)
 - openUrl

#### addmedia (Add photos, live photos, videos, or contacts to the library of a device)
 - addMedia

#### install (Install an app on a device)
 - installApp

#### uninstall (Uninstall an app from a device)
 - uninstallApp

#### get_app_container (Print the path of the installed app's container)
 - getAppContainer

#### launch (Launch an application by identifier on a device)
 - launchApp

#### terminate (Terminate an application by identifier on a device)
 - terminateApp

#### spawn (Spawn a process by executing a given executable on a device)
 - spawnProcess
 - spawnSubProcess

#### list (List available devices, device types, runtimes, or device pairs)
 - getDevicesByParsing `*`
 - getDevices `*`
 - getRuntimeForPlatformVersionViaJson `*`
 - getRuntimeForPlatformVersion `*`
 - getDeviceTypes `*`
 - list `*`

#### icloud_sync (Trigger iCloud sync on a device)
_None_

#### pbsync (Sync the pasteboard content from one pasteboard to another)
_None_

#### pbcopy (Copy standard input onto the device pasteboard)
 - setPasteboard

#### pbpaste (Print the contents of the device's pasteboard to standard output)
 - getPasteboard

#### help (Prints the usage for a given subcommand)
_None_

#### io (Set up a device IO operation)
 - getScreeenshot

#### diagnose (Collect diagnostic information and logs)
_None_

#### logverbose (enable or disable verbose logging for a device)
_None_

#### status_bar (Set or clear status bar overrides)
_None_

#### ui (Get or Set UI options)
 - getAppearance
 - setAppearance

#### push (Send a simulated push notification)
 - pushNotification

#### privacy (Grant, revoke, or reset privacy and permissions)
 - grantPermission
 - revokePermission
 - resetPermission

#### keychain (Manipulate a device's keychain)
 - addRootCertificate
 - addCertificate
 - resetKeychain

#### appinfo (Undocumented)
 - appInfo

#### bootstatus (Undocumented)
 - startBootMonitor

Methods marked with the star (`*`) character *do not* require the `udid` property to be set
on the `Simctl` instance upon their invocation. All other methods will *throw an error* if the `udid`
property is unset while they are being invoked.

All public methods are supplied with docstrings that describe their arguments and returned values.

The `Simctl` class constructor supports the following options:

- `xcrun` (Object): The xcrun properties. Currently only one property
is supported, which is `path` and it by default contains `null`, which enforces
the instance to automatically detect the full path to `xcrun` tool and to throw
an exception if it cannot be detected. If the path is set upon instance creation
then it is going to be used by `exec` and no autodetection will happen.
- `execTimeout` (number[600000]): The maximum number of milliseconds
to wait for a single synchronous xcrun command.
- `logErrors` (boolean[true]): Whether to write xcrun error messages
into the debug log before throwing them as errors.
- `udid` (string[null]): The unique identifier of the current device, which is
going to be implicitly passed to all methods, which require it (see above). It can either be set
upon instance creation if it is already known or later when/if needed via the corresponding
setter.
- `devicesSetPath` (string[null]): Full path to the set of devices that you want to manage.
By default this path usually equals to ~/Library/Developer/CoreSimulator/Devices. This option
has a getter and a setter which allows to switch between multiple device sets during the Simctl
instance life cycle.


### Advanced Usage

Any simctl subcommand could be called via `exec` method, which accepts the subcommand itself
as the first argument and the set of options, which may contain additional command args,
environment variables, encoding, etc. For example:

```js
import Simctl from 'node-simctl';

const simctl = new Simctl();
const name = 'My Device Name';
simctl.udid = await simctl.createDevice(name, 'iPhone X', '13.3');
await simctl.bootDevice();
await simctl.startBootMonitor({timeout: 120000});
await simctl.exec('pbsync');
console.log(`Pasteboard content: ${await simctl.getPasteboard()}`);
const {stdout} = await simctl.exec('status_bar', {
  args: [simctl.udid, 'list']
});
console.log(output);
simctl.udid = void(await simctl.deleteDevice());
```

See [specs](test/simctl-specs.js) for examples of usage.


### Running Multiple Simulator SDKs On a Single Computer

It is possible to run multiple simulators using different Xcode SDKs on a single machine.
Simply set a proper value to `DEVELOPER_DIR` environment variable for each process.

Read this [MacOps article](https://macops.ca/developer-binaries-on-os-x-xcode-select-and-xcrun/) for more details.
