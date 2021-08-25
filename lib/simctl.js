import _ from 'lodash';
import subcommands from './subcommands/index.js';
import which from 'which';
import log, { LOG_PREFIX } from './logger';
import {
  DEFAULT_EXEC_TIMEOUT, getXcrunBinary,
} from './helpers';
import { exec as tpExec, SubProcess } from 'teen_process';

const SIMCTL_ENV_PREFIX = 'SIMCTL_CHILD_';
const DEFAULT_OPTS = {
  xcrun: {
    path: null,
  },
  execTimeout: DEFAULT_EXEC_TIMEOUT,
  logErrors: true,
};

/**
 * @typedef {Object} ExecOpts
 * @property {Array.<string>} args [[]] - The list of additional subcommand arguments.
 * It's empty by default.
 * @property {Object} env [{}] - Environment variables mapping. All these variables
 * will be passed Simulator and used in the executing function.
 * @property {boolean} logErrors [true] - Set it to _false_ to throw execution errors
 * immediately without logging any additional information.
 * @property {boolean} asynchronous [false] - Whether to execute the given command
 * 'synchronously' or 'asynchronously'. Affects the returned result of the function.
 * @property {?string} encoding - Explicitly sets streams encoding for the executed
 * command input and outputs.
 */


/**
 * @typedef {Object} SimctlOpts
 * @property {?Object} xcrun - The xcrun properties. Currently only one property
 * is supported, which is `path` and it by default contains `null`, which enforces
 * the instance to automatically detect the full path to `xcrun` tool and to throw
 * an exception if it cannot be detected. If the path is set upon instance creation
 * then it is going to be used by `exec` and no autodetection will happen.
 * @property {?number} execTimeout [600000] - The maximum number of milliseconds
 * to wait for single synchronous xcrun command.
 * @property {?boolean} logErrors [true] - Whether to wire xcrun error messages
 * into debug log before throwing them.
 * @property {?string} udid [null] - The unique identifier of the current device, which is
 * going to be implicitly passed to all methods, which require it. It can either be set
 * upon instance creation if it is already known in advance or later when/if needed via the
 * corresponding instance setter.
 * @property {?string} devicesSetPath - Full path to the set of devices that you want to manage.
 * By default this path usually equals to ~/Library/Developer/CoreSimulator/Devices
 */


class Simctl {
  /**
   * @param {?SimctlOpts} opts
   */
  constructor (opts = {}) {
    opts = _.cloneDeep(opts);
    _.defaultsDeep(opts, DEFAULT_OPTS);
    for (const key of _.keys(DEFAULT_OPTS)) {
      this[key] = opts[key];
    }
    this._udid = _.isNil(opts.udid) ? null : opts.udid;
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

  requireUdid (commandName = null) {
    if (!this.udid) {
      throw new Error(`udid is required to be set for ` +
        (commandName ? `the '${commandName}' command` : 'this simctl command'));
    }
    return this.udid;
  }

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
   * @param {string} subcommand - One of available simctl subcommands.
   *                           Execute `xcrun simctl` in Terminal to see the full list
   *                           of available subcommands.
   * @param {?ExecOpts} opts
   * @return {ExecResult|SubProcess} Either the result of teen process's `exec` or
   * `SubProcess` instance depending of `opts.asynchronous` value.
   * @throws {Error} If the simctl subcommand command returns non-zero return code.
   */
  async exec (subcommand, opts = {}) {
    let {
      args = [],
      env = {},
      asynchronous = false,
      encoding,
      logErrors = true,
    } = opts;
    // run a particular simctl command
    args = ['simctl',
      ...(this.devicesSetPath ? ['--set', this.devicesSetPath] : []),
      subcommand,
      ...args
    ];
    // Prefix all passed in environment variables with 'SIMCTL_CHILD_', simctl
    // will then pass these to the child (spawned) process.
    env = _.defaults(
      _.mapKeys(env,
        (value, key) => _.startsWith(key, SIMCTL_ENV_PREFIX) ? key : `${SIMCTL_ENV_PREFIX}${key}`),
      process.env);

    const execOpts = {
      env,
      encoding,
    };
    if (!asynchronous) {
      execOpts.timeout = this.execTimeout;
    }
    const xcrun = await this.requireXcrun();
    try {
      return asynchronous ? new SubProcess(xcrun, args, execOpts) : await tpExec(xcrun, args, execOpts);
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
}


// add all the subcommands to the Simctl prototype
for (const [fnName, fn] of _.toPairs(subcommands)) {
  Simctl.prototype[fnName] = fn;
}

export default Simctl;
export { Simctl };
