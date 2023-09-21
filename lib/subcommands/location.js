const commands = {};

/**
 * Formats the given location argument for simctl usage
 *
 * @param {string} name Argument name
 * @param {string|number} value Location argument value
 * @returns {string} Formatted value, for example -73.768254
 */
function formatArg (name, value) {
  const flt = parseFloat(`${value}`);
  if (isNaN(flt)) {
    throw new TypeError(`${name} must be a valid number, got '${value}' instead`);
  }
  return flt.toFixed(7);
}

/**
 * Set the Simulator location to a specific latitude and longitude.
 * This functionality is only available since Xcode 14.
 *
 * @this {import('../simctl').Simctl}
 * @param {string|number} latitude Location latitude value
 * @param {string|number} longitude Location longitude value
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {TypeError} If any of the arguments is not a valid value.
 */
commands.setLocation = async function setLocation (latitude, longitude) {
  const lat = formatArg('latitude', latitude);
  const lon = formatArg('longitude', longitude);
  await this.exec('location', {
    args: [this.requireUdid('location'), 'set', `${lat},${lon}`],
  });
};

/**
 * Stop any running scenario and clear any simulated location.
 *
 * @since Xcode 14.
 * @this {import('../simctl').Simctl}
 */
commands.clearLocation = async function clearLocation () {
  await this.exec('location', {
    args: [this.requireUdid('location'), 'clear'],
  });
};

export default commands;
