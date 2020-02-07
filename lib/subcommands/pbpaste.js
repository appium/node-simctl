const commands = {};

/**
 * Get the content of Simulator pasteboard.
 * It is required that Simulator is in _booted_ state.
 *
 * @since Xcode 8.1 SDK
 * @param {string} encoding ['utf-8'] - The encoding of the returned pasteboard content.
 *                                      UTF-8 by default.
 * @return {string} Current content of Simulator pasteboard or an empty string.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.getPasteboard = async function getPasteboard (encoding = 'utf8') {
  const {stdout} = await this.exec('pbpaste', {
    args: [this.requireUdid('pbpaste')],
    encoding,
  });
  return stdout;
};

export default commands;
