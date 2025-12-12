import type { Simctl } from '../simctl';

/**
 * Formats the given location argument for simctl usage
 *
 * @param name Argument name
 * @param value Location argument value
 * @returns Formatted value, for example -73.768254
 */
function formatArg (name: string, value: string | number): string {
  const flt = parseFloat(`${value}`);
  if (isNaN(flt)) {
    throw new TypeError(`${name} must be a valid number, got '${value}' instead`);
  }
  return flt.toFixed(7);
}

/**
 * Set the Simulator location to a specific latitude and longitude.
 * This functionality is only available since Xcode 14.
 *
 * @param latitude Location latitude value
 * @param longitude Location longitude value
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {TypeError} If any of the arguments is not a valid value.
 */
export async function setLocation (
  this: Simctl,
  latitude: string | number,
  longitude: string | number
): Promise<void> {
  const lat = formatArg('latitude', latitude);
  const lon = formatArg('longitude', longitude);
  await this.exec('location', {
    args: [this.requireUdid('location'), 'set', `${lat},${lon}`],
  });
}

/**
 * Stop any running scenario and clear any simulated location.
 *
 * @since Xcode 14.
 */
export async function clearLocation (this: Simctl): Promise<void> {
  await this.exec('location', {
    args: [this.requireUdid('location'), 'clear'],
  });
}

