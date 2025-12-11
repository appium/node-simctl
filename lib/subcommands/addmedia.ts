import type { Simctl } from '../simctl';
import type { TeenProcessExecResult } from 'teen_process';

/**
 * Add the particular media file to Simulator's library.
 * It is required that Simulator is in _booted_ state.
 *
 * @param filePath - Full path to a media file on the local
 *                            file system.
 * @return Command execution result.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function addMedia (this: Simctl, filePath: string): Promise<TeenProcessExecResult<string>> {
  return await this.exec('addmedia', {
    args: [this.requireUdid('addmedia'), filePath],
  });
}
