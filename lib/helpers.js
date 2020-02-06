import semver from 'semver';


const DEFAULT_EXEC_TIMEOUT = 10 * 60 * 1000; // ms
const XCRUN_BINARY = 'xcrun';
const SIM_RUNTIME_NAME = 'com.apple.CoreSimulator.SimRuntime.';

/**
 * "Normalize" the version, since iOS uses 'major.minor' but the runtimes can
 * be 'major.minor.patch'
 *
 * @param {string} version - the string version
 * @return {string} The version in 'major.minor' form
 * @throws {Error} If the version not parseable by the `semver` package
 */
function normalizeVersion (version) {
  const semverVersion = semver.coerce(version);
  if (!semverVersion) {
    throw new Error(`Unable to parse version '${version}'`);
  }
  return `${semverVersion.major}.${semverVersion.minor}`;
}

export {
  DEFAULT_EXEC_TIMEOUT, XCRUN_BINARY, SIM_RUNTIME_NAME,
  normalizeVersion,
};
