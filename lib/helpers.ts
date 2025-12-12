import * as semver from 'semver';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

export const DEFAULT_EXEC_TIMEOUT = 10 * 60 * 1000; // ms
export const SIM_RUNTIME_NAME = 'com.apple.CoreSimulator.SimRuntime.';

/**
 * "Normalize" the version, since iOS uses 'major.minor' but the runtimes can
 * be 'major.minor.patch'
 *
 * @param version - the string version
 * @return The version in 'major.minor' form
 * @throws {Error} If the version not parseable by the `semver` package
 */
export function normalizeVersion (version: string): string {
  const semverVersion = semver.coerce(version);
  if (!semverVersion) {
    throw new Error(`Unable to parse version '${version}'`);
  }
  return `${semverVersion.major}.${semverVersion.minor}`;
}

/**
 * @returns The xcrun binary name
 */
export function getXcrunBinary (): string {
  return process.env.XCRUN_BINARY || 'xcrun';
}

/**
 * Generate a UUID v4
 *
 * @returns Promise resolving to UUID string
 */
export async function uuidV4 (): Promise<string> {
  const uuidLib = await import('uuid');
  return uuidLib.v4();
}

/**
 * Convert plist-style output to JSON using plutil
 *
 * @param plistInput - The plist-style string to convert
 * @return Promise resolving to parsed JSON object
 * @throws {Error} If plutil fails to convert the input
 */
export async function convertPlistToJson (plistInput: string): Promise<any> {
  const plutilProcess = spawn('plutil', ['-convert', 'json', '-o', '-', '-']);
  let jsonOutput = '';
  plutilProcess.stdout.on('data', (chunk) => {
    jsonOutput += chunk.toString();
  });
  const inputStream = Readable.from([plistInput]);
  inputStream.pipe(plutilProcess.stdin);
  try {
    await new Promise<void>((resolve, reject) => {
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

