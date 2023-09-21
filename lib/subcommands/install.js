const commands = {};

/**
 * Install the particular application package on Simulator.
 * It is required that Simulator is in _booted_ state.
 *
 * @this {import('../simctl').Simctl}
 * @param {string} appPath - Full path to .app package, which is
 *                           going to be installed.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.installApp = async function installApp (appPath) {
  await this.exec('install', {
    args: [this.requireUdid('install'), appPath],
  });
};

export default commands;
