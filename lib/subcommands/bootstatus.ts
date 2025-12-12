import { log } from '../logger';
import { waitForCondition } from 'asyncbox';
import _ from 'lodash';
import type { Simctl } from '../simctl';
import type { BootMonitorOptions } from '../types';
import type { SubProcess } from 'teen_process';

/**
 * Start monitoring for boot status of the particular Simulator.
 * If onFinished property is not set then the method will block
 * until Simulator booting is completed.
 * The method is only available since Xcode8.
 *
 * @param opts - Monitoring options.
 * @returns The instance of the corresponding monitoring process.
 * @throws {Error} If the Simulator fails to finish booting within the given timeout and onFinished
 * property is not set.
 * @throws {Error} If the `udid` instance property is unset
 */
export async function startBootMonitor (
  this: Simctl,
  opts: BootMonitorOptions = {}
): Promise<SubProcess> {
    const {
      timeout = 240000,
      onWaitingDataMigration,
      onWaitingSystemApp,
      onFinished,
      onError,
      shouldPreboot,
    } = opts;
    const udid = this.requireUdid('bootstatus');

    const status: string[] = [];
    let isBootingFinished = false;
    let error: Error | null = null;
    let timeoutHandler: NodeJS.Timeout | null = null;
    const args = [udid];
    if (shouldPreboot) {
      args.push('-b');
    }
    const bootMonitor = await this.exec('bootstatus', {
      args,
      asynchronous: true,
    });
    const onStreamLine = (line: string) => {
      status.push(line);
      if (onWaitingDataMigration && line.includes('Waiting on Data Migration')) {
        onWaitingDataMigration();
      } else if (onWaitingSystemApp && line.includes('Waiting on System App')) {
        onWaitingSystemApp();
      }
    };
    for (const streamName of ['stdout', 'stderr']) {
      bootMonitor.on(`line-${streamName}`, onStreamLine);
    }
    bootMonitor.once('exit', (code, signal) => {
      if (timeoutHandler) {
        clearTimeout(timeoutHandler);
      }
      if (code === 0) {
        if (onFinished) {
          onFinished();
        }
        isBootingFinished = true;
      } else {
        const errMessage = _.isEmpty(status)
          ? `The simulator booting process has exited with code ${code} by signal ${signal}`
          : status.join('\n');
        error = new Error(errMessage);
        if (onError) {
          onError(error);
        }
      }
    });
    await bootMonitor.start(0);
    const stopMonitor = async () => {
      if (bootMonitor.isRunning) {
        try {
          await bootMonitor.stop();
        } catch (e: any) {
          log.warn(e.message);
        }
      }
    };
    const start = process.hrtime();
    if (onFinished) {
      timeoutHandler = setTimeout(stopMonitor, timeout);
    } else {
      try {
        await waitForCondition(() => {
          if (error) {
            throw error;
          }
          return isBootingFinished;
        }, {waitMs: timeout, intervalMs: 500});
      } catch {
        await stopMonitor();
        const [seconds] = process.hrtime(start);
        throw new Error(
          `The simulator ${udid} has failed to finish booting after ${seconds}s. ` +
          `Original status: ${status.join('\n')}`
        );
      }
    }
    return bootMonitor;
}

