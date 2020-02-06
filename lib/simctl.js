import _ from 'lodash';
import subcommands from './subcommands/index.js';
import { fs } from 'appium-support';
import log from './logger';
import {
  DEFAULT_EXEC_TIMEOUT, XCRUN_BINARY,
} from './helpers';
import { exec, SubProcess } from 'teen_process';

const SIMCTL_ENV_PREFIX = 'SIMCTL_CHILD_';
const DEFAULT_OPTS = {
  xcrun: {
    path: null,
  },
  execTimeout: DEFAULT_EXEC_TIMEOUT,
  logErrors: true,
};


class Simctl {
  constructor (opts = {}) {
    opts = _.cloneDeep(opts);
    _.defaultsDeep(opts, DEFAULT_OPTS);
    for (const key of _.keys(DEFAULT_OPTS)) {
      this[key] = opts[key];
    }
    if (opts.udid) {
      this._udid = opts.udid;
    }
  }

  set udid (value) {
    this._udid = value;
  }

  get udid () {
    return this._udid;
  }

  requireUdid (commandName = null) {
    if (!this.udid) {
      throw new Error(`udid is required to be set` + (commandName ? ` for '${commandName}' command` : ''));
    }
    return this.udid;
  }

  async requireXcrun () {
    if (!this.xcrun.path) {
      try {
        this.xcrun.path = await fs.which(XCRUN_BINARY);
        log.debug(`Using xcrun at '${this.xcrun.path}'`);
      } catch (e) {
        throw new Error(`${XCRUN_BINARY} tool has not been found in PATH. ` +
          `Are Xcode developers tools installed?`);
      }
    }
    return this.xcrun.path;
  }

  /**
   * Execute the particular simctl command and return the output.
   *
   * @param {string} subcommand - One of available simctl subcommands.
   *                           Execute `xcrun simctl` in Terminal to see the full list
   *                           of available subcommands.
   * @param {number} timeout - Command execution timeout in milliseconds.
   *                           Set it to zero to skip waiting for command
   *                           execution.
   * @param {Array.<string>} args [[]] - The list of additional subcommand arguments.
   *                                     It's empty by default.
   * @param {Object} env [{}] - Environment variables mapping. All these variables
   *                            will be passed Simulator and used in _executingFunction_.
   * @param {Function} executingFunction - Executing function object. Equals to teen_process's
   *                                       _exec_ by default.
   * @param {boolean} logErrors [true] - Set it to _false_ to throw execution errors
   *                                     immediately without logging any additional information.
   * @return {Object} The result of _executingFunction_.
   * @throws {Error} If the simctl subcommand command executed by _executingFunction_
   *                 returns non-zero return code.
   */
  async exec (subcommand, opts = {}) {
    let {
      args = [],
      env = {},
      asynchronous = false,
      encoding,
    } = opts;
    // run a particular simctl command
    args = ['simctl', subcommand, ...args];
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
      return asynchronous ? new SubProcess(xcrun, args, execOpts) : await exec(xcrun, args, execOpts);
    } catch (e) {
      if (!this.logErrors) {
        // if we don't want to see the errors, just throw and allow the calling
        // code do what it wants
        throw e;
      } else if (e.stderr) {
        log.errorAndThrow(`simctl error running '${subcommand}': ${e.stderr.trim()}`);
      } else {
        log.errorAndThrow(e);
      }
    }
  }
}


// add all the subcommands to the Simctl prototype
for (const [fnName, fn] of _.toPairs(subcommands)) {
  Simctl.prototype[fnName] = fn;
}

export default Simctl;
export { Simctl };