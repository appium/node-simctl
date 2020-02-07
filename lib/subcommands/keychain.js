const commands = {};

/**
 * Adds the given certificate to the Trusted Root Store on the simulator
 *
 * @since Xcode 11.4 SDK
 * @param {string} certPath the full path to a valid .cert file containing
 * the certificate content
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while adding the certificate
 * @throws {Error} If the `udid` instance property is unset
 */
commands.addRootCertificate = async function addRootCertificate (certPath) {
  await this.exec('keychain', {
    args: [this.requireUdid('keychain add-root-cert'), 'add-root-cert', certPath],
  });
};

/**
 * Adds the given certificate to the Keychain Store on the simulator
 *
 * @since Xcode 11.4 SDK
 * @param {string} certPath the full path to a valid .cert file containing
 * the certificate content
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while adding the certificate
 * @throws {Error} If the `udid` instance property is unset
 */
commands.addCertificate = async function addCertificate (certPath) {
  await this.exec('keychain', {
    args: [this.requireUdid('keychain add-cert'), 'add-cert', certPath],
  });
};

/**
 * Resets the simulator keychain
 *
 * @since Xcode 11.4 SDK
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while resetting the keychain
 * @throws {Error} If the `udid` instance property is unset
 */
commands.resetKeychain = async function resetKeychain () {
  await this.exec('keychain', {
    args: [this.requireUdid('keychain reset'), 'reset'],
  });
};

export default commands;
