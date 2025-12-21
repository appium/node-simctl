import type { SubProcess, TeenProcessExecResult } from 'teen_process';

/**
 * XCRun configuration
 */
export interface XCRun {
  /**
   * Full path to the xcrun script
   */
  path: string | null;
}

/**
 * Options for asynchronous execution
 */
export interface AsyncExecOpts {
  asynchronous: true;
}

/**
 * Execution options for simctl commands
 */
export interface ExecOpts {
  /**
   * The list of additional subcommand arguments.
   * It's empty by default.
   */
  args?: string[];
  /**
   * Environment variables mapping. All these variables
   * will be passed Simulator and used in the executing function.
   */
  env?: Record<string, any>;
  /**
   * Set it to _false_ to throw execution errors
   * immediately without logging any additional information.
   */
  logErrors?: boolean;
  /**
   * Whether to execute the given command
   * 'synchronously' or 'asynchronously'. Affects the returned result of the function.
   */
  asynchronous?: boolean;
  /**
   * Explicitly sets streams encoding for the executed
   * command input and outputs.
   */
  encoding?: string;
  /**
   * One or more architecture names to be enforced while
   * executing xcrun. See https://github.com/appium/appium/issues/18966 for more details.
   */
  architectures?: string | string[];
  /**
   * The maximum number of milliseconds
   * to wait for single synchronous xcrun command. If not provided explicitly, then
   * the value of execTimeout property is used by default.
   */
  timeout?: number;
}

/**
 * Simctl instance options
 */
export interface SimctlOpts {
  /**
   * The xcrun properties. Currently only one property
   * is supported, which is `path` and it by default contains `null`, which enforces
   * the instance to automatically detect the full path to `xcrun` tool and to throw
   * an exception if it cannot be detected. If the path is set upon instance creation
   * then it is going to be used by `exec` and no autodetection will happen.
   */
  xcrun?: XCRun;
  /**
   * The default maximum number of milliseconds
   * to wait for single synchronous xcrun command.
   */
  execTimeout?: number;
  /**
   * Whether to wire xcrun error messages
   * into debug log before throwing them.
   */
  logErrors?: boolean;
  /**
   * The unique identifier of the current device, which is
   * going to be implicitly passed to all methods, which require it. It can either be set
   * upon instance creation if it is already known in advance or later when/if needed via the
   * corresponding instance setter.
   */
  udid?: string | null;
  /**
   * Full path to the set of devices that you want to manage.
   * By default this path usually equals to ~/Library/Developer/CoreSimulator/Devices
   */
  devicesSetPath?: string | null;
}

/**
 * Device information
 */
export interface DeviceInfo {
  /**
   * The device name.
   */
  name: string;
  /**
   * The device UDID.
   */
  udid: string;
  /**
   * The current Simulator state, for example 'booted' or 'shutdown'.
   */
  state: string;
  /**
   * The SDK version, for example '10.3'.
   */
  sdk: string;
  /**
   * The platform name, for example 'iOS'.
   */
  platform: string;
}

/**
 * Simulator creation options
 */
export interface SimCreationOpts {
  /**
   * Platform name in order to specify runtime such as 'iOS', 'tvOS', 'watchOS'
   */
  platform?: string;
  /**
   * The maximum number of milliseconds to wait
   * unit device creation is completed.
   */
  timeout?: number;
}

/**
 * Result type for exec method - either SubProcess for async or TeenProcessExecResult for sync
 */
export type ExecResult<T extends ExecOpts> = T extends AsyncExecOpts
  ? SubProcess
  : TeenProcessExecResult<string>;

/**
 * Boot monitor options
 */
export interface BootMonitorOptions {
  /**
   * Simulator booting timeout in ms.
   */
  timeout?: number;
  /**
   * This event is fired when data migration stage starts.
   */
  onWaitingDataMigration?: () => void;
  /**
   * This event is fired when system app wait stage starts.
   */
  onWaitingSystemApp?: () => void;
  /**
   * This event is fired when Simulator is fully booted.
   */
  onFinished?: () => void;
  /**
   * This event is fired when there was an error while monitoring the booting process
   * or when the timeout has expired.
   */
  onError?: (error: Error) => void;
  /**
   * Whether to preboot the Simulator
   * if this command is called and it is not already in booted or booting state.
   */
  shouldPreboot?: boolean;
}

/**
 * Certificate options
 */
export interface CertOptions {
  /**
   * whether the `cert` argument
   * is the path to the certificate on the local file system or
   * a raw certificate content
   */
  raw?: boolean;
}

/**
 * App information returned by simctl appinfo when the app is found
 */
export interface AppInfo {
  /**
   * Application type (e.g., "Hidden")
   */
  ApplicationType: string;
  /**
   * Bundle URL (file:// URL)
   */
  Bundle?: string;
  /**
   * Bundle container URL (file:// URL)
   */
  BundleContainer?: string;
  /**
   * Display name of the application
   */
  CFBundleDisplayName: string;
  /**
   * Executable name
   */
  CFBundleExecutable: string;
  /**
   * Bundle identifier
   */
  CFBundleIdentifier: string;
  /**
   * Bundle name
   */
  CFBundleName: string;
  /**
   * Bundle version
   */
  CFBundleVersion: string | number;
  /**
   * Data container URL (file:// URL)
   */
  DataContainer?: string;
  /**
   * Group containers dictionary
   */
  GroupContainers?: Record<string, any>;
  /**
   * Path to the app bundle
   */
  Path: string;
  /**
   * SpringBoard app tags
   */
  SBAppTags?: string[];
}

