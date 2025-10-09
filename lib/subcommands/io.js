import { rimraf } from 'rimraf';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { uuidV4 } from '../helpers';

const commands = {};

/**
 * Gets base64 screenshot for device
 * It is required that Simulator is in _booted_ state.
 *
 * @this {import('../simctl').Simctl}
 * @since Xcode SDK 8.1
 * @return {Promise<string>} Base64-encoded Simulator screenshot.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.getScreenshot = async function getScreenshot () {
  const udid = this.requireUdid('io screenshot');
  const pathToScreenshotPng = path.resolve(os.tmpdir(), `${await uuidV4()}.png`);
  try {
    await this.exec('io', {
      args: [udid, 'screenshot', pathToScreenshotPng],
    });
    return (await fs.readFile(pathToScreenshotPng)).toString('base64');
  } finally {
    await rimraf(pathToScreenshotPng);
  }
};

export default commands;
