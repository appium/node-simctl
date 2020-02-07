const commands = {};

/**
 * Open URL scheme on Simulator. iOS will automatically try
 * to find a matching application, which supports the given scheme.
 * It is required that Simulator is in _booted_ state.
 *
 * @param {string} url - The URL scheme to open, for example http://appiom.io
 *                       will be opened by the built-in mobile browser.
 * @return {ExecResult} Command execution result.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.openUrl = async function openUrl (url) {
  return await this.exec('openurl', {
    args: [this.requireUdid('openurl'), url],
  });
};

export default commands;
