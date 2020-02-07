import _ from 'lodash';


const commands = {};

/**
 * Retrieves the current UI appearance value from the given simulator
 *
 * @since Xcode 11.4 SDK
 * @return {string} the appearance value, for example 'light' or 'dark'
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while getting the value
 * @throws {Error} If the `udid` instance property is unset
 */
commands.getAppearance = async function getAppearance () {
  const {stdout} = await this.exec('ui', {
    args: [this.requireUdid('ui'), 'appearance'],
  });
  return _.trim(stdout);
};

/**
 * Sets the UI appearance to the given style
 *
 * @since Xcode 11.4 SDK
 * @param {string} appearance valid appearance value, for example 'light' or 'dark'
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while getting the value
 * @throws {Error} If the `udid` instance property is unset
 */
commands.setAppearance = async function setAppearance (appearance) {
  await this.exec('ui', {
    args: [this.requireUdid('ui'), 'appearance', appearance],
  });
};

export default commands;
