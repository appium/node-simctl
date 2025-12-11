import os from 'os';
import fs from 'fs/promises';
import { uuidV4 } from '../helpers';
import path from 'path';
import _ from 'lodash';
import { rimraf } from 'rimraf';
import type { Simctl } from '../simctl';
import type { CertOptions } from '../types';

/**
 * @param payload - Certificate payload (string or Buffer)
 * @param onPayloadStored - Callback function to execute with the file path
 */
async function handleRawPayload (
  payload: string | Buffer,
  onPayloadStored: (filePath: string) => Promise<any>
): Promise<void> {
  const filePath = path.resolve(os.tmpdir(), `${await uuidV4()}.pem`);
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
 * Adds the given certificate to the Trusted Root Store on the simulator
 *
 * @since Xcode 11.4 SDK
 * @param cert the full path to a valid .cert file containing
 * the certificate content or the certificate content itself, depending on
 * options
 * @param opts - Certificate options
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while adding the certificate
 * @throws {Error} If the `udid` instance property is unset
 */
export async function addRootCertificate (
  this: Simctl,
  cert: string | Buffer,
  opts: CertOptions = {}
): Promise<void> {
  const {
    raw = false,
  } = opts;
  const execMethod = async (certPath: string) => await this.exec('keychain', {
    args: [this.requireUdid('keychain add-root-cert'), 'add-root-cert', certPath],
  });
  if (raw) {
    await handleRawPayload(cert, execMethod);
  } else {
    await execMethod(cert as string);
  }
}

/**
 * Adds the given certificate to the Keychain Store on the simulator
 *
 * @since Xcode 11.4 SDK
 * @param cert the full path to a valid .cert file containing
 * the certificate content or the certificate content itself, depending on
 * options
 * @param opts - Certificate options
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while adding the certificate
 * @throws {Error} If the `udid` instance property is unset
 */
export async function addCertificate (
  this: Simctl,
  cert: string | Buffer,
  opts: CertOptions = {}
): Promise<void> {
  const {
    raw = false,
  } = opts;
  const execMethod = async (certPath: string) => await this.exec('keychain', {
    args: [this.requireUdid('keychain add-cert'), 'add-cert', certPath],
  });
  if (raw) {
    await handleRawPayload(cert, execMethod);
  } else {
    await execMethod(cert as string);
  }
}

/**
 * Resets the simulator keychain
 *
 * @since Xcode 11.4 SDK
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while resetting the keychain
 * @throws {Error} If the `udid` instance property is unset
 */
export async function resetKeychain (this: Simctl): Promise<void> {
  await this.exec('keychain', {
    args: [this.requireUdid('keychain reset'), 'reset'],
  });
}

