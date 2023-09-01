import semver from 'semver';

export const DEFAULT_EXEC_TIMEOUT = 10 * 60 * 1000; // ms
export const SIM_RUNTIME_NAME = 'com.apple.CoreSimulator.SimRuntime.';

/**
 * "Normalize" the version, since iOS uses 'major.minor' but the runtimes can
 * be 'major.minor.patch'
 *
 * @param {string} version - the string version
 * @return {string} The version in 'major.minor' form
 * @throws {Error} If the version not parseable by the `semver` package
 */
export function normalizeVersion (version) {
  const semverVersion = semver.coerce(version);
  if (!semverVersion) {
    throw new Error(`Unable to parse version '${version}'`);
  }
  return `${semverVersion.major}.${semverVersion.minor}`;
}

/**
 * @returns {string}
 */
export function getXcrunBinary () {
  return process.env.XCRUN_BINARY || 'xcrun';
}
