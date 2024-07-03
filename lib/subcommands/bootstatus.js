import log from '../logger';
import { waitForCondition } from 'asyncbox';
import _ from 'lodash';

const commands = {};

/**
 * @typedef {Object} BootMonitorOptions
 * @property {number} [timeout=240000] - Simulator booting timeout in ms.
 * @property {Function} [onWaitingDataMigration] - This event is fired when data migration stage starts.
 * @property {Function} [onWaitingSystemApp] - This event is fired when system app wait stage starts.
 * @property {Function} [onFinished] - This event is fired when Simulator is fully booted.
 * @property {Function} [onError] - This event is fired when there was an error while monitoring the booting process
 * or when the timeout has expired.
 * @property {boolean} [shouldPreboot=false] Whether to preboot the Simulator
 * if this command is called and it is not already in booted or booting state.
 */

/**
 * Start monitoring for boot status of the particular Simulator.
 * If onFinished property is not set then the method will block
 * until Simulator booting is completed.
 * The method is only available since Xcode8.
 *
 * @this {import('../simctl').Simctl}
 * @param {BootMonitorOptions} [opts={}] - Monitoring options.
 * @returns {Promise<import('teen_process').SubProcess>} The instance of the corresponding monitoring process.
 * @throws {Error} If the Simulator fails to finish booting within the given timeout and onFinished
 * property is not set.
 * @throws {Error} If the `udid` instance property is unset
 */
commands.startBootMonitor = async function startBootMonitor (opts = {}) {
  const {
    timeout = 240000,
    onWaitingDataMigration,
    onWaitingSystemApp,
    onFinished,
    onError,
    shouldPreboot,
  } = opts;
  const udid = this.requireUdid('bootstatus');

  /** @type {string[]} */
  const status = [];
  let isBootingFinished = false;
  let error = null;
  let timeoutHandler = null;
  const args = [udid];
  if (shouldPreboot) {
    args.push('-b');
  }
  const bootMonitor = await this.exec('bootstatus', {
    args,
    asynchronous: true,
  });
  const onStreamLine = (/** @type {string} */ line) => {
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
      } catch (e) {
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
    } catch (err) {
      await stopMonitor();
      const [seconds] = process.hrtime(start);
      throw new Error(
        `The simulator ${udid} has failed to finish booting after ${seconds}s. ` +
        `Original status: ${status.join('\n')}`
      );
    }
  }
  return bootMonitor;
};

export default commands;
