import _ from 'lodash';
import which from 'which';
import log, { LOG_PREFIX } from './logger';
import {
  DEFAULT_EXEC_TIMEOUT, getXcrunBinary,
} from './helpers';
import { exec as tpExec, SubProcess } from 'teen_process';
import addmediaCommands from './subcommands/addmedia';
import appinfoCommands from './subcommands/appinfo';
import bootCommands from './subcommands/boot';
import bootstatusCommands from './subcommands/bootstatus';
import createCommands from './subcommands/create';
import deleteCommands from './subcommands/delete';
import eraseCommands from './subcommands/erase';
import getappcontainerCommands from './subcommands/get_app_container';
import installCommands from './subcommands/install';
import ioCommands from './subcommands/io';
import keychainCommands from './subcommands/keychain';
import launchCommands from './subcommands/launch';
import listCommands from './subcommands/list';
import openurlCommands from './subcommands/openurl';
import pbcopyCommands from './subcommands/pbcopy';
import pbpasteCommands from './subcommands/pbpaste';
import privacyCommands from './subcommands/privacy';
import pushCommands from './subcommands/push';
import envCommands from './subcommands/getenv';
import shutdownCommands from './subcommands/shutdown';
import spawnCommands from './subcommands/spawn';
import terminateCommands from './subcommands/terminate';
import uiCommands from './subcommands/ui';
import uninstallCommands from './subcommands/uninstall';
import locationCommands from './subcommands/location';

const SIMCTL_ENV_PREFIX = 'SIMCTL_CHILD_';
const DEFAULT_OPTS = {
  xcrun: {
    path: null,
  },
  execTimeout: DEFAULT_EXEC_TIMEOUT,
  logErrors: true,
};

/**
 * @typedef {Object} XCRun
 * @property {string?} path Full path to the xcrun script
 */

/**
 * @typedef {{asynchronous: true}} TAsyncOpts
 */

/**
 * @typedef {Object} ExecOpts
 * @property {string[]} [args=[]] - The list of additional subcommand arguments.
 * It's empty by default.
 * @property {Record<string, any>} [env={}] - Environment variables mapping. All these variables
 * will be passed Simulator and used in the executing function.
 * @property {boolean} [logErrors=true] - Set it to _false_ to throw execution errors
 * immediately without logging any additional information.
 * @property {boolean} [asynchronous=false] - Whether to execute the given command
 * 'synchronously' or 'asynchronously'. Affects the returned result of the function.
 * @property {string} [encoding] - Explicitly sets streams encoding for the executed
 * command input and outputs.
 * @property {string|string[]} [architectures] - One or more architecture names to be enforced while
 * executing xcrun. See https://github.com/appium/appium/issues/18966 for more details.
 * @property {number} [timeout] - The maximum number of milliseconds
 * to wait for single synchronous xcrun command. If not provided explicitly, then
 * the value of execTimeout property is used by default.
 */

/**
 * @typedef {Object} SimctlOpts
 * @property {XCRun} [xcrun] - The xcrun properties. Currently only one property
 * is supported, which is `path` and it by default contains `null`, which enforces
 * the instance to automatically detect the full path to `xcrun` tool and to throw
 * an exception if it cannot be detected. If the path is set upon instance creation
 * then it is going to be used by `exec` and no autodetection will happen.
 * @property {number} [execTimeout=600000] - The default maximum number of milliseconds
 * to wait for single synchronous xcrun command.
 * @property {boolean} [logErrors=true] - Whether to wire xcrun error messages
 * into debug log before throwing them.
 * @property {string?} [udid] - The unique identifier of the current device, which is
 * going to be implicitly passed to all methods, which require it. It can either be set
 * upon instance creation if it is already known in advance or later when/if needed via the
 * corresponding instance setter.
 * @property {string?} [devicesSetPath] - Full path to the set of devices that you want to manage.
 * By default this path usually equals to ~/Library/Developer/CoreSimulator/Devices
 */


class Simctl {
  /** @type {XCRun} */
  xcrun;

  /** @type {number} */
  execTimeout;

  /** @type {boolean} */
  logErrors;

  /**
   * @param {SimctlOpts} [opts={}]
   */
  constructor (opts = {}) {
    opts = _.cloneDeep(opts);
    _.defaultsDeep(opts, DEFAULT_OPTS);
    for (const key of _.keys(DEFAULT_OPTS)) {
      this[key] = opts[key];
    }
    /** @type {string?} */
    this._udid = _.isNil(opts.udid) ? null : opts.udid;
    /** @type {string?} */
    this._devicesSetPath = _.isNil(opts.devicesSetPath) ? null : opts.devicesSetPath;
  }

  set udid (value) {
    this._udid = value;
  }

  get udid () {
    return this._udid;
  }

  set devicesSetPath (value) {
    this._devicesSetPath = value;
  }

  get devicesSetPath () {
    return this._devicesSetPath;
  }

  /**
   * @param {string?} [commandName=null]
   * @returns {string}
   */
  requireUdid (commandName = null) {
    if (!this.udid) {
      throw new Error(`udid is required to be set for ` +
        (commandName ? `the '${commandName}' command` : 'this simctl command'));
    }
    return this.udid;
  }

  /**
   * @returns {Promise<string>}
   */
  async requireXcrun () {
    const xcrunBinary = getXcrunBinary();

    if (!this.xcrun.path) {
      try {
        this.xcrun.path = await which(xcrunBinary);
      } catch (e) {
        throw new Error(`${xcrunBinary} tool has not been found in PATH. ` +
          `Are Xcode developers tools installed?`);
      }
    }
    return this.xcrun.path;
  }

  /**
   * Execute the particular simctl command.
   *
   * @template {ExecOpts} TExecOpts
   * @param {string} subcommand - One of available simctl subcommands.
   * Execute `xcrun simctl` in Terminal to see the full list  of available subcommands.
   * @param {TExecOpts} [opts]
   * @return {Promise<TExecOpts extends TAsyncOpts ? import('teen_process').SubProcess : import('teen_process').TeenProcessExecResult>}
   * Either the result of teen process's `exec` or
   * `SubProcess` instance depending of `opts.asynchronous` value.
   * @throws {Error} If the simctl subcommand command returns non-zero return code.
   */
  async exec (subcommand, opts) {
    let {
      args = [],
      env = {},
      asynchronous = false,
      encoding,
      logErrors = true,
      architectures,
      timeout,
    } = opts ?? {};
    // run a particular simctl command
    args = [
      'simctl',
      ...(this.devicesSetPath ? ['--set', this.devicesSetPath] : []),
      subcommand,
      ...args
    ];
    // Prefix all passed in environment variables with 'SIMCTL_CHILD_', simctl
    // will then pass these to the child (spawned) process.
    env = _.defaults(
      _.mapKeys(env,
        (value, key) => _.startsWith(key, SIMCTL_ENV_PREFIX) ? key : `${SIMCTL_ENV_PREFIX}${key}`),
      process.env
    );

    const execOpts = {
      env,
      encoding,
    };
    if (!asynchronous) {
      execOpts.timeout = timeout || this.execTimeout;
    }
    const xcrun = await this.requireXcrun();
    try {
      let execArgs = [xcrun, args, execOpts];
      if (architectures?.length) {
        const archArgs = _.flatMap(
          (_.isArray(architectures) ? architectures : [architectures]).map((arch) => ['-arch', arch])
        );
        execArgs = ['arch', [...archArgs, xcrun, ...args], execOpts];
      }
      // @ts-ignore We know what we are doing here
      return asynchronous ? new SubProcess(...execArgs) : await tpExec(...execArgs);
    } catch (e) {
      if (!this.logErrors || !logErrors) {
        // if we don't want to see the errors, just throw and allow the calling
        // code do what it wants
      } else if (e.stderr) {
        const msg = `Error running '${subcommand}': ${e.stderr.trim()}`;
        log.debug(LOG_PREFIX, msg);
        e.message = msg;
      } else {
        log.debug(LOG_PREFIX, e.message);
      }
      throw e;
    }
  }

  addMedia = addmediaCommands.addMedia;

  appInfo = appinfoCommands.appInfo;

  bootDevice = bootCommands.bootDevice;

  startBootMonitor = bootstatusCommands.startBootMonitor;

  createDevice = createCommands.createDevice;

  deleteDevice = deleteCommands.deleteDevice;

  eraseDevice = eraseCommands.eraseDevice;

  getAppContainer = getappcontainerCommands.getAppContainer;

  getEnv = envCommands.getEnv;

  installApp = installCommands.installApp;

  getScreenshot = ioCommands.getScreenshot;

  addRootCertificate = keychainCommands.addRootCertificate;
  addCertificate = keychainCommands.addCertificate;
  resetKeychain = keychainCommands.resetKeychain;

  launchApp = launchCommands.launchApp;

  getDevicesByParsing = listCommands.getDevicesByParsing;
  getDevices = listCommands.getDevices;
  getRuntimeForPlatformVersionViaJson = listCommands.getRuntimeForPlatformVersionViaJson;
  getRuntimeForPlatformVersion = listCommands.getRuntimeForPlatformVersion;
  getDeviceTypes = listCommands.getDeviceTypes;
  list = listCommands.list;

  setLocation = locationCommands.setLocation;
  clearLocation = locationCommands.clearLocation;

  openUrl = openurlCommands.openUrl;

  setPasteboard = pbcopyCommands.setPasteboard;

  getPasteboard = pbpasteCommands.getPasteboard;

  grantPermission = privacyCommands.grantPermission;
  revokePermission = privacyCommands.revokePermission;
  resetPermission = privacyCommands.resetPermission;

  pushNotification = pushCommands.pushNotification;

  shutdownDevice = shutdownCommands.shutdownDevice;

  spawnProcess = spawnCommands.spawnProcess;
  spawnSubProcess = spawnCommands.spawnSubProcess;

  terminateApp = terminateCommands.terminateApp;

  getAppearance = uiCommands.getAppearance;
  setAppearance = uiCommands.setAppearance;

  removeApp = uninstallCommands.removeApp;
}

export default Simctl;
export { Simctl };
