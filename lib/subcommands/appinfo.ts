import type { Simctl } from '../simctl';
import type { AppInfo } from '../types';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import B from 'bluebird';
import _ from 'lodash';

/**
 * Get information about an app installed on the simulator
 *
 * @param bundleId - Bundle identifier of the application
 * @return Promise resolving to app info object
 * @throws {Error} If the app is not found (ApplicationType key is not present)
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function appInfo (this: Simctl, bundleId: string): Promise<AppInfo> {
  const {stdout} = await this.exec('appinfo', {
    args: [this.requireUdid('appinfo'), bundleId],
  });
  let result: any;
  try {
    result = JSON.parse(stdout);
  } catch {
    // If JSON parsing fails, use plutil to convert plist-style output to JSON
    try {
      result = await convertPlistToJson(stdout);
    } catch (err) {
      throw new Error(
        `Cannot retrieve app info for ${bundleId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (!_.isPlainObject(result) || !('ApplicationType' in result)) {
    throw new Error(`App with bundle identifier "${bundleId}" not found. Is it installed?`);
  }

  return result as AppInfo;
}

/**
 * Convert plist-style output to JSON using plutil
 *
 * @param plistInput - The plist-style string to convert
 * @return Promise resolving to parsed JSON object
 * @throws {Error} If plutil fails to convert the input
 */
async function convertPlistToJson (plistInput: string): Promise<any> {
  const plutilProcess = spawn('plutil', ['-convert', 'json', '-o', '-', '-']);
  let jsonOutput = '';
  plutilProcess.stdout.on('data', (chunk) => {
    jsonOutput += chunk.toString();
  });
  const inputStream = Readable.from([plistInput]);
  inputStream.pipe(plutilProcess.stdin);
  try {
    await new B((resolve, reject) => {
      inputStream.once('error', reject);
      plutilProcess.once('exit', (code, signal) => {
        inputStream.unpipe(plutilProcess.stdin);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`plutil exited with code ${code}, signal ${signal}`));
        }
      });
      plutilProcess.once('error', (e) => {
        inputStream.unpipe(plutilProcess.stdin);
        reject(e);
      });
    });
  } catch (err) {
    plutilProcess.kill(9);
    throw new Error(`Failed to convert plist to JSON: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    plutilProcess.removeAllListeners();
    inputStream.removeAllListeners();
  }
  return JSON.parse(jsonOutput);
}
