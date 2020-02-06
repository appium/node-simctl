const commands = {};

/**
 * Delete the particular Simulator from available devices list.
 *
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 */
commands.deleteDevice = async function deleteDevice () {
  await this.exec('delete', {
    args: [this.requireUdid('delete')]
  });
};

export default commands;
