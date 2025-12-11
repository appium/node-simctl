import _ from 'lodash';
import which from 'which';
import { log, LOG_PREFIX } from './logger';
import {
  DEFAULT_EXEC_TIMEOUT, getXcrunBinary,
} from './helpers';
import { exec as tpExec, SubProcess } from 'teen_process';
import * as addmediaCommands from './subcommands/addmedia';
import * as appinfoCommands from './subcommands/appinfo';
import * as bootCommands from './subcommands/boot';
import * as bootstatusCommands from './subcommands/bootstatus';
import * as createCommands from './subcommands/create';
import * as deleteCommands from './subcommands/delete';
import * as eraseCommands from './subcommands/erase';
import * as getappcontainerCommands from './subcommands/get_app_container';
import * as installCommands from './subcommands/install';
import * as ioCommands from './subcommands/io';
import * as keychainCommands from './subcommands/keychain';
import * as launchCommands from './subcommands/launch';
import * as listCommands from './subcommands/list';
import * as openurlCommands from './subcommands/openurl';
import * as pbcopyCommands from './subcommands/pbcopy';
import * as pbpasteCommands from './subcommands/pbpaste';
import * as privacyCommands from './subcommands/privacy';
import * as pushCommands from './subcommands/push';
import * as envCommands from './subcommands/getenv';
import * as shutdownCommands from './subcommands/shutdown';
import * as spawnCommands from './subcommands/spawn';
import * as terminateCommands from './subcommands/terminate';
import * as uiCommands from './subcommands/ui';
import * as uninstallCommands from './subcommands/uninstall';
import * as locationCommands from './subcommands/location';
import type {
  XCRun, ExecOpts, SimctlOpts, ExecResult,
} from './types';

const SIMCTL_ENV_PREFIX = 'SIMCTL_CHILD_';

export class Simctl {
  private xcrun: XCRun;
  private execTimeout: number;
  private logErrors: boolean;
  private _udid: string | null;
  private _devicesSetPath: string | null;

  constructor (opts: SimctlOpts = {}) {
    this.xcrun = _.cloneDeep(opts.xcrun ?? { path: null });
    this.execTimeout = opts.execTimeout ?? DEFAULT_EXEC_TIMEOUT;
    this.logErrors = opts.logErrors ?? true;
    this._udid = opts.udid ?? null;
    this._devicesSetPath = opts.devicesSetPath ?? null;
  }

  set udid (value: string | null) {
    this._udid = value;
  }

  get udid (): string | null {
    return this._udid;
  }

  set devicesSetPath (value: string | null) {
    this._devicesSetPath = value;
  }

  get devicesSetPath (): string | null {
    return this._devicesSetPath;
  }

  /**
   * @param commandName - Optional command name for error message
   * @returns The UDID string
   * @throws {Error} If UDID is not set
   */
  requireUdid (commandName: string | null = null): string {
    if (!this.udid) {
      throw new Error(`udid is required to be set for ` +
        (commandName ? `the '${commandName}' command` : 'this simctl command'));
    }
    return this.udid;
  }

  /**
   * @returns Promise resolving to the xcrun binary path
   */
  async requireXcrun (): Promise<string> {
    const xcrunBinary = getXcrunBinary();

    if (!this.xcrun.path) {
      try {
        this.xcrun.path = await which(xcrunBinary);
      } catch {
        throw new Error(`${xcrunBinary} tool has not been found in PATH. ` +
          `Are Xcode developers tools installed?`);
      }
    }
    if (!this.xcrun.path) {
      throw new Error(`${xcrunBinary} tool path is not set`);
    }
    return this.xcrun.path;
  }

  /**
   * Execute the particular simctl command.
   *
   * @param subcommand - One of available simctl subcommands.
   * Execute `xcrun simctl` in Terminal to see the full list  of available subcommands.
   * @param opts - Execution options
   * @return Either the result of teen process's `exec` or
   * `SubProcess` instance depending of `opts.asynchronous` value.
   * @throws {Error} If the simctl subcommand command returns non-zero return code.
   */
  async exec<T extends ExecOpts> (
    subcommand: string,
    opts?: T
  ): Promise<ExecResult<T>> {
    const {
      args: initialArgs = [],
      env: initialEnv = {},
      asynchronous = false,
      encoding,
      logErrors = true,
      architectures,
      timeout,
    } = opts ?? {} as T;
    // run a particular simctl command
    const args = [
      'simctl',
      ...(this.devicesSetPath ? ['--set', this.devicesSetPath] : []),
      subcommand,
      ...initialArgs
    ];
    // Prefix all passed in environment variables with 'SIMCTL_CHILD_', simctl
    // will then pass these to the child (spawned) process.
    const env = _.defaults(
      _.mapKeys(initialEnv,
        (value, key) => _.startsWith(key, SIMCTL_ENV_PREFIX) ? key : `${SIMCTL_ENV_PREFIX}${key}`),
      process.env
    );

    const execOpts: any = {
      env,
      encoding,
    };
    if (!asynchronous) {
      execOpts.timeout = timeout || this.execTimeout;
    }
    const xcrun = await this.requireXcrun();
    try {
      let execArgs: [string, string[], any];
      if (architectures?.length) {
        const archArgs = _.flatMap(
          (_.isArray(architectures) ? architectures : [architectures]).map((arch) => ['-arch', arch])
        );
        execArgs = ['arch', [...archArgs, xcrun, ...args], execOpts];
      } else {
        execArgs = [xcrun, args, execOpts];
      }
      // We know what we are doing here - the type system can't handle the dynamic nature
      return (asynchronous ? new SubProcess(...execArgs) : await tpExec(...execArgs)) as ExecResult<T>;
    } catch (e: any) {
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

  // Extension methods
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
  getIncreaseContrast = uiCommands.getIncreaseContrast;
  setIncreaseContrast = uiCommands.setIncreaseContrast;
  getContentSize = uiCommands.getContentSize;
  setContentSize = uiCommands.setContentSize;
  removeApp = uninstallCommands.removeApp;
}

export default Simctl;

