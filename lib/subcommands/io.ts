import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {rimraf} from 'rimraf';

import type {Simctl} from '../simctl.js';

/**
 * Gets base64 screenshot for device
 * It is required that Simulator is in _booted_ state.
 *
 * @since Xcode SDK 8.1
 * @return Base64-encoded Simulator screenshot.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function getScreenshot(this: Simctl): Promise<string> {
  const udid = this.requireUdid('io screenshot');
  const pathToScreenshotPng = path.resolve(os.tmpdir(), `${randomUUID()}.png`);
  try {
    await this.exec('io', {
      args: [udid, 'screenshot', pathToScreenshotPng],
    });
    return (await fs.readFile(pathToScreenshotPng)).toString('base64');
  } finally {
    await rimraf(pathToScreenshotPng);
  }
}
