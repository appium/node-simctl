import os from 'os';
import fs from 'fs/promises';
import { v4 as uuidV4 } from 'uuid';
import path from 'path';
import _ from 'lodash';
import { rimraf } from 'rimraf';

const commands = {};

/**
 *
 * @param {string|Buffer} payload
 * @param {(filePath: string) => Promise<any>} onPayloadStored
 */
async function handleRawPayload (payload, onPayloadStored) {
  const filePath = path.resolve(os.tmpdir(), `${uuidV4()}.pem`);
  try {
    if (_.isBuffer(payload)) {
      await fs.writeFile(filePath, payload);
    } else {
      await fs.writeFile(filePath, payload, 'utf8');
    }
    await onPayloadStored(filePath);
  } finally {
    await rimraf(filePath);
  }
}


/**
 * @typedef {Object} CertOptions
 * @property {boolean} [raw=false] - whether the `cert` argument
 * is the path to the certificate on the local file system or
 * a raw certificate content
 */

/**
 * Adds the given certificate to the Trusted Root Store on the simulator
 *
 * @since Xcode 11.4 SDK
 * @this {import('../simctl').Simctl}
 * @param {string} cert the full path to a valid .cert file containing
 * the certificate content or the certificate content itself, depending on
 * options
 * @param {CertOptions} [opts={}]
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while adding the certificate
 * @throws {Error} If the `udid` instance property is unset
 */
commands.addRootCertificate = async function addRootCertificate (cert, opts = {}) {
  const {
    raw = false,
  } = opts;
  const execMethod = async (/** @type {string} */certPath) => await this.exec('keychain', {
    args: [this.requireUdid('keychain add-root-cert'), 'add-root-cert', certPath],
  });
  if (raw) {
    await handleRawPayload(cert, execMethod);
  } else {
    await execMethod(cert);
  }
};

/**
 * Adds the given certificate to the Keychain Store on the simulator
 *
 * @since Xcode 11.4 SDK
 * @this {import('../simctl').Simctl}
 * @param {string} cert the full path to a valid .cert file containing
 * the certificate content or the certificate content itself, depending on
 * options
 * @param {CertOptions} [opts={}]
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while adding the certificate
 * @throws {Error} If the `udid` instance property is unset
 */
commands.addCertificate = async function addCertificate (cert, opts = {}) {
  const {
    raw = false,
  } = opts;
  const execMethod = async (certPath) => await this.exec('keychain', {
    args: [this.requireUdid('keychain add-cert'), 'add-cert', certPath],
  });
  if (raw) {
    await handleRawPayload(cert, execMethod);
  } else {
    await execMethod(cert);
  }
};

/**
 * Resets the simulator keychain
 *
 * @since Xcode 11.4 SDK
 * @this {import('../simctl').Simctl}
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
