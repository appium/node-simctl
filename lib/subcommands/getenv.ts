import type { Simctl } from '../simctl';

/**
 * Retrieves the value of a Simulator environment variable
 *
 * @param varName - The name of the variable to be retrieved
 * @returns The value of the variable or null if the given variable
 * is not present in the Simulator environment
 * @throws {Error} If there was an error while running the command
 * @throws {Error} If the `udid` instance property is unset
 */
export async function getEnv (this: Simctl, varName: string): Promise<string | null> {
  const {stdout, stderr} = await this.exec('getenv', {
    args: [this.requireUdid('getenv'), varName],
    logErrors: false,
  });
  return stderr ? null : stdout;
}

