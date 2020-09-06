const commands = {};

/**
 * Retrieves the value of a Simulator environment variable
 *
 * @param {string} varName - The name of the variable to be retrieved
 * @returns {?string} The value of the variable or null if the given variable
 * is not present in the Simulator environment
 * @throws {Error} If there was an error while running the command
 * @throws {Error} If the `udid` instance property is unset
 */
commands.getEnv = async function getEnv (varName) {
  const {stdout, stderr} = await this.exec('getenv', {
    args: [this.requireUdid('getenv'), varName],
    logErrors: false,
  });
  return stderr ? null : stdout;
};

export default commands;
