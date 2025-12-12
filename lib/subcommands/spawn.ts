import _ from 'lodash';
import type { Simctl } from '../simctl';
import type { TeenProcessExecResult, SubProcess } from 'teen_process';

/**
 * Spawn the particular process on Simulator.
 * It is required that Simulator is in _booted_ state.
 *
 * @param args - Spawn arguments
 * @param env - Additional environment variables mapping.
 * @return Command execution result.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function spawnProcess (
  this: Simctl,
  args: string | string[],
  env: Record<string, any> = {}
): Promise<TeenProcessExecResult<string>> {
  if (_.isEmpty(args)) {
    throw new Error('Spawn arguments are required');
  }

  return await this.exec('spawn', {
    args: [this.requireUdid('spawn'), ...(_.isArray(args) ? args : [args])],
    env,
  });
}

/**
 * Prepare SubProcess instance for a new process, which is going to be spawned
 * on Simulator.
 *
 * @param args - Spawn arguments
 * @param env - Additional environment variables mapping.
 * @return The instance of the process to be spawned.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function spawnSubProcess (
  this: Simctl,
  args: string | string[],
  env: Record<string, any> = {}
): Promise<SubProcess> {
  if (_.isEmpty(args)) {
    throw new Error('Spawn arguments are required');
  }

  return await this.exec('spawn', {
    args: [this.requireUdid('spawn'), ...(_.isArray(args) ? args : [args])],
    env,
    asynchronous: true,
  }) as SubProcess;
}

