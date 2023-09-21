const commands = {};

/**
 * Terminate the given running application on Simulator.
 * It is required that Simulator is in _booted_ state.
 *
 * @this {import('../simctl').Simctl}
 * @param {string} bundleId - Bundle identifier of the application,
 *                            which is going to be terminated.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.terminateApp = async function terminateApp (bundleId) {
  await this.exec('terminate', {
    args: [this.requireUdid('terminate'), bundleId],
  });
};

export default commands;
