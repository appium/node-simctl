const commands = {};

/**
 * Set the content of Simulator pasteboard.
 * It is required that Simulator is in _booted_ state.
 *
 * @since Xcode SDK 8.1
 * @param {string} content - The actual string content to be set.
 * @param {string} encoding [utf'] - The encoding of the given pasteboard content.
 *                                   UTF-8 by default.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.setPasteboard = async function setPasteboard (content, encoding = 'utf8') {
  const pbCopySubprocess = await this.exec('pbcopy', {
    args: [this.requireUdid('pbcopy')],
    asynchronous: true,
  });
  await pbCopySubprocess.start(0);
  const exitCodeVerifier = pbCopySubprocess.join();
  const stdin = pbCopySubprocess.proc.stdin;
  stdin.setEncoding(encoding);
  stdin.write(content);
  stdin.end();
  await exitCodeVerifier;
};

export default commands;
