const commands = {};

/**
 * Remove the particular application package from Simulator.
 * It is required that Simulator is in _booted_ state and
 * the application with given bundle identifier is already installed.
 *
 * @param {string} bundleId - Bundle identifier of the application,
 *                            which is going to be removed.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.removeApp = async function removeApp (bundleId) {
  await this.exec('uninstall', {
    args: [this.requireUdid('uninstall'), bundleId],
  });
};

export default commands;
