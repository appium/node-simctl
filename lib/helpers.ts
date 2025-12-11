import * as semver from 'semver';

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

