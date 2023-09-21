import { rimraf } from 'rimraf';
import { v4 as uuidV4 } from 'uuid';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

const commands = {};

/**
 * Send a simulated push notification
 *
 * @since Xcode 11.4 SDK
 * @this {import('../simctl').Simctl}
 * @param {Object} payload - The object that describes Apple push notification content.
 * It must contain a top-level "Simulator Target Bundle" key with a string value matching
 * the target application‘s bundle identifier and "aps" key with valid Apple Push Notification values.
 * For example:
 * {
 *   "Simulator Target Bundle": "com.apple.Preferences",
 *   "aps": {
 *     "alert": "This is a simulated notification!",
 *     "badge": 3,
 *     "sound": "default"
 *   }
 * }
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while pushing the notification
 * @throws {Error} If the `udid` instance property is unset
 */
commands.pushNotification = async function pushNotification (payload) {
  const dstPath = path.resolve(os.tmpdir(), `${uuidV4()}.json`);
  try {
    await fs.writeFile(dstPath, JSON.stringify(payload), 'utf8');
    await this.exec('push', {
      args: [this.requireUdid('push'), dstPath],
    });
  } finally {
    await rimraf(dstPath);
  }
};

export default commands;
