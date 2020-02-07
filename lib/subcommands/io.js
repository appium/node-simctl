import { tempDir, fs } from 'appium-support';
import path from 'path';

const commands = {};

/**
 * Gets base64 screenshot for device
 * It is required that Simulator is in _booted_ state.
 *
 * @since Xcode SDK 8.1
 * @return {string} Base64-encoded Simulator screenshot.
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.getScreenshot = async function getScreenshot () {
  const udid = this.requireUdid('io screenshot');
  const tmpRoot = await tempDir.openDir();
  try {
    const pathToScreenshotPng = path.resolve(tmpRoot, 'screenshot.png');
    await this.exec('io', {
      args: [udid, 'screenshot', pathToScreenshotPng],
    });
    return (await fs.readFile(pathToScreenshotPng)).toString('base64');
  } finally {
    await fs.rimraf(tmpRoot);
  }
};

export default commands;
