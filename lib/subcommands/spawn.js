import _ from 'lodash';


const commands = {};

/**
 * Spawn the particular process on Simulator.
 * It is required that Simulator is in _booted_ state.
 *
 * @this {import('../simctl').Simctl}
 * @param {string|string[]} args - Spawn arguments
 * @param {object} [env={}] - Additional environment variables mapping.
 * @return {Promise<import('teen_process').TeenProcessExecResult>} Command execution result.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.spawnProcess = async function spawnProcess (args, env = {}) {
  if (_.isEmpty(args)) {
    throw new Error('Spawn arguments are required');
  }

  return await this.exec('spawn', {
    args: [this.requireUdid('spawn'), ...(_.isArray(args) ? args : [args])],
    env,
  });
};

/**
 * Prepare SubProcess instance for a new process, which is going to be spawned
 * on Simulator.
 *
 * @this {import('../simctl').Simctl}
 * @param {string|string[]} args - Spawn arguments
 * @param {object} [env={}] - Additional environment variables mapping.
 * @return {Promise<import('teen_process').SubProcess>} The instance of the process to be spawned.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.spawnSubProcess = async function spawnSubProcess (args, env = {}) {
  if (_.isEmpty(args)) {
    throw new Error('Spawn arguments are required');
  }

  return await this.exec('spawn', {
    args: [this.requireUdid('spawn'), ...(_.isArray(args) ? args : [args])],
    env,
    asynchronous: true,
  });
};

export default commands;
