import type { Simctl } from '../simctl';

/**
 * Delete the particular Simulator from available devices list.
 *
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function deleteDevice (this: Simctl): Promise<void> {
  await this.exec('delete', {
    args: [this.requireUdid('delete')]
  });
}

