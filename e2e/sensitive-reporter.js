const statusNames = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);

export function validateSensitivePlaywrightVersion(version) {
  // The error-context lifecycle and NO_COPY_PROMPT behavior were inspected for this version.
  // Fail closed on upgrades until that inspection is repeated.
  if (version !== '1.65.0') throw new Error('Sensitive E2E is disabled until the installed Playwright artifact behavior is reviewed.');
}

export function safeError() {
  return { message: 'Sensitive E2E failure: diagnostic details suppressed.' };
}

export function sanitizeSensitiveErrors(testInfo) {
  testInfo.errors.splice(0, testInfo.errors.length, ...testInfo.errors.map(() => safeError()));
  testInfo.attachments.splice(0, testInfo.attachments.length);
}

// No HTML, source snippets, errors, steps, attachments or raw output are serialized.
export default class SensitiveReporter {
  counts = {};
  onTestEnd(_test, result) {
    const status = statusNames.has(result.status) ? result.status : 'failed';
    this.counts[status] = (this.counts[status] || 0) + 1;
  }
  onError() {}
  onStdOut() {}
  onStdErr() {}
  printsToStdio() { return true; }
  onEnd() {
    for (const [status, count] of Object.entries(this.counts)) console.log(`Sensitive E2E ${status}: ${count}`);
  }
}
