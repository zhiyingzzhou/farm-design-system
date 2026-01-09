import type { Reporter, TestModule, TestRunEndReason, Vitest } from 'vitest/node';

type Counts = {
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
};

type Row = Counts & {
  status: string;
  file: string;
  time: string;
};

const ANSI_RESET = '\x1b[0m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_RED = '\x1b[31m';
const ANSI_YELLOW = '\x1b[33m';

function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === '0') return false;
  return true;
}

function paint(text: string, color: string, enabled: boolean): string {
  if (!enabled) return text;
  return `${color}${text}${ANSI_RESET}`;
}

function truncateMiddleEnd(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return '…';
  return `…${text.slice(text.length - (maxLength - 1))}`;
}

function padEnd(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function padStart(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

function formatDurationMs(ms: number): string {
  const rounded = Math.round(ms);
  return `${rounded}ms`;
}

function getModuleStatus(testModule: TestModule): string {
  const state = testModule.state();
  if (state === 'passed') return 'PASS';
  if (state === 'failed') return 'FAIL';
  if (state === 'skipped') return 'SKIP';
  return state.toUpperCase();
}

function getModuleCounts(testModule: TestModule): Counts {
  const counts: Counts = {
    tests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0
  };

  for (const testCase of testModule.children.allTests()) {
    counts.tests += 1;
    const state = testCase.result().state;
    if (state === 'passed') counts.passed += 1;
    else if (state === 'failed') counts.failed += 1;
    else if (state === 'skipped') counts.skipped += 1;
    else counts.pending += 1;
  }

  return counts;
}

function buildTable(rows: Row[], options?: { useColor?: boolean }): string {
  const useColor = options?.useColor ?? false;
  const header = {
    status: 'STATUS',
    file: 'FILE',
    tests: 'TESTS',
    passed: 'PASS',
    failed: 'FAIL',
    skipped: 'SKIP',
    time: 'TIME'
  };

  const statusWidth = Math.max(header.status.length, ...rows.map(r => r.status.length));
  const fileWidth = Math.max(header.file.length, ...rows.map(r => r.file.length));
  const testsWidth = Math.max(header.tests.length, ...rows.map(r => String(r.tests).length));
  const passedWidth = Math.max(header.passed.length, ...rows.map(r => String(r.passed).length));
  const failedWidth = Math.max(header.failed.length, ...rows.map(r => String(r.failed).length));
  const skippedWidth = Math.max(header.skipped.length, ...rows.map(r => String(r.skipped).length));
  const timeWidth = Math.max(header.time.length, ...rows.map(r => r.time.length));

  const line = (left: string, middle: string, right: string) =>
    [
      left,
      '─'.repeat(statusWidth + 2),
      middle,
      '─'.repeat(fileWidth + 2),
      middle,
      '─'.repeat(testsWidth + 2),
      middle,
      '─'.repeat(passedWidth + 2),
      middle,
      '─'.repeat(failedWidth + 2),
      middle,
      '─'.repeat(skippedWidth + 2),
      middle,
      '─'.repeat(timeWidth + 2),
      right
    ].join('');

  const top = line('┌', '┬', '┐');
  const mid = line('├', '┼', '┤');
  const bottom = line('└', '┴', '┘');

  const formatRow = (r: Row) =>
    [
      '│ ',
      (() => {
        const cell = padEnd(r.status, statusWidth);
        if (r.status === 'PASS') return paint(cell, ANSI_GREEN, useColor);
        if (r.status === 'FAIL') return paint(cell, ANSI_RED, useColor);
        if (r.status === 'SKIP') return paint(cell, ANSI_YELLOW, useColor);
        return cell;
      })(),
      ' │ ',
      padEnd(r.file, fileWidth),
      ' │ ',
      padStart(String(r.tests), testsWidth),
      ' │ ',
      paint(padStart(String(r.passed), passedWidth), ANSI_GREEN, useColor),
      ' │ ',
      paint(padStart(String(r.failed), failedWidth), ANSI_RED, useColor),
      ' │ ',
      paint(padStart(String(r.skipped), skippedWidth), ANSI_YELLOW, useColor),
      ' │ ',
      padStart(r.time, timeWidth),
      ' │'
    ].join('');

  const headerRow: Row = {
    status: header.status,
    file: header.file,
    tests: Number.NaN,
    passed: Number.NaN,
    failed: Number.NaN,
    skipped: Number.NaN,
    pending: Number.NaN,
    time: header.time
  };

  const formatHeaderRow = () =>
    [
      '│ ',
      padEnd(headerRow.status, statusWidth),
      ' │ ',
      padEnd(headerRow.file, fileWidth),
      ' │ ',
      padStart(header.tests, testsWidth),
      ' │ ',
      paint(padStart(header.passed, passedWidth), ANSI_GREEN, useColor),
      ' │ ',
      paint(padStart(header.failed, failedWidth), ANSI_RED, useColor),
      ' │ ',
      paint(padStart(header.skipped, skippedWidth), ANSI_YELLOW, useColor),
      ' │ ',
      padStart(headerRow.time, timeWidth),
      ' │'
    ].join('');

  const body = rows.map(formatRow);
  return [top, formatHeaderRow(), mid, ...body, bottom].join('\n');
}

export default class VitestTableReporter implements Reporter {
  private vitest: Vitest | undefined;
  private readonly useColor = supportsColor();

  onInit(vitest: Vitest): void {
    this.vitest = vitest;
  }

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    _unhandledErrors: ReadonlyArray<unknown>,
    _reason: TestRunEndReason
  ): void {
    const fileMaxLength = 80;
    const rows: Row[] = testModules.map(testModule => {
      const counts = getModuleCounts(testModule);
      const status = getModuleStatus(testModule);
      const file = truncateMiddleEnd(testModule.relativeModuleId, fileMaxLength);
      const time = formatDurationMs(testModule.diagnostic().duration);

      return { status, file, time, ...counts };
    });

    if (!rows.length) return;

    const totals = rows.reduce<Counts>(
      (acc, row) => {
        acc.tests += row.tests;
        acc.passed += row.passed;
        acc.failed += row.failed;
        acc.skipped += row.skipped;
        acc.pending += row.pending;
        return acc;
      },
      { tests: 0, passed: 0, failed: 0, skipped: 0, pending: 0 }
    );

    rows.push({
      status: 'TOTAL',
      file: '—',
      time: formatDurationMs(rows.reduce((sum, r) => sum + Number(r.time.replace('ms', '')), 0)),
      ...totals
    });

    const output = buildTable(rows, { useColor: this.useColor });

    const logger = this.vitest?.logger;
    if (logger?.log) {
      logger.log(`\n${output}\n`);
      return;
    }

    console.log(`\n${output}\n`);
  }
}
