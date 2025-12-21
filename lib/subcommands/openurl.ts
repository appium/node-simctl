import type { Simctl } from '../simctl';
import type { TeenProcessExecResult } from 'teen_process';

/**
 * Open URL scheme on Simulator. iOS will automatically try
 * to find a matching application, which supports the given scheme.
 * It is required that Simulator is in _booted_ state.
 *
 * @param url - The URL scheme to open, for example http://appiom.io
 *                       will be opened by the built-in mobile browser.
 * @return Command execution result.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function openUrl (this: Simctl, url: string): Promise<TeenProcessExecResult<string>> {
  return await this.exec('openurl', {
    args: [this.requireUdid('openurl'), url],
  });
}
