const commands = {};

/**
 * Adds the given certificate to the Trusted Root Store on the simulator
 *
 * @since Xcode 11.4 SDK
 * @param {string} certPath the full path to a valid .cert file containing
 * the certificate content
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while adding the certificate
 */
commands.addRootCertificate = async function addRootCertificate (certPath) {
  await this.exec('keychain', {
    args: [this.requireUdid('addRootCertificate'), 'add-root-cert', certPath],
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
 */
commands.addCertificate = async function addCertificate (certPath) {
  await this.exec('keychain', {
    args: [this.requireUdid('addCerificate'), 'add-cert', certPath],
  });
};

/**
 * Resets the simulator keychain
 *
 * @since Xcode 11.4 SDK
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while resetting the keychain
 */
commands.resetKeychain = async function resetKeychain () {
  await this.exec('keychain', {
    args: [this.requireUdid('resetKeychain'), 'reset'],
  });
};

export default commands;
