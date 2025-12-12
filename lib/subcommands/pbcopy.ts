import type { Simctl } from '../simctl';
import type { SubProcess } from 'teen_process';

/**
 * Set the content of Simulator pasteboard.
 * It is required that Simulator is in _booted_ state.
 *
 * @since Xcode SDK 8.1
 * @param content - The actual string content to be set.
 * @param encoding - The encoding of the given pasteboard content.
 * utf8 by default.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function setPasteboard (
  this: Simctl,
  content: string,
  encoding: BufferEncoding = 'utf8'
): Promise<void> {
  const pbCopySubprocess = await this.exec('pbcopy', {
    args: [this.requireUdid('pbcopy')],
    asynchronous: true,
  }) as SubProcess;
  await pbCopySubprocess.start(0);
  const exitCodeVerifier = pbCopySubprocess.join();
  const stdin = pbCopySubprocess.proc?.stdin;
  if (stdin) {
    stdin.setDefaultEncoding(encoding);
    stdin.write(content);
    stdin.end();
  }
  await exitCodeVerifier;
}

