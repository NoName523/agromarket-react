const statusNames = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
const farmerSteps = new Set(['farmer-login', 'farmer-form-visible', 'farmer-form-fill', 'farmer-name-fill', 'farmer-price-fill', 'farmer-submit', 'farmer-response', 'farmer-catalog']);
const testCodes = new Map([
  ['prepare farmer session @sensitive', 'farmer-setup'],
  ['registration with a unique email displays the user name @sensitive', 'registration'],
  ['an incorrect password displays the login error @sensitive', 'incorrect-password'],
  ['registers a buyer and places an order for an existing product @creates-order @sensitive', 'buyer-order'],
  ['farmer creates a product but has no administrative access @sensitive', 'farmer-product'],
  ['farmer cannot submit a negative price @sensitive', 'farmer-price'],
]);

function reportProgress(message) {
  if (typeof process.send === 'function' && process.connected) process.send(message, () => {});
}

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
  onTestBegin(test) {
    reportProgress({ event: 'start', test: testCodes.get(test.title) || 'other' });
  }
  onStepBegin(test, _result, step) {
    if (testCodes.get(test.title) === 'farmer-product' && step.category === 'test.step' && farmerSteps.has(step.title)) {
      reportProgress({ event: 'step-start', step: step.title });
    }
  }
  onStepEnd(test, _result, step) {
    if (testCodes.get(test.title) === 'farmer-product' && step.category === 'test.step' && farmerSteps.has(step.title)) {
      const duration = Number.isFinite(step.duration) && step.duration >= 0
        ? Math.min(Math.round(step.duration), 3600000) : 0;
      reportProgress({ event: 'step-end', step: step.title, duration, status: step.error ? 'failed' : 'passed' });
    }
  }
  onTestEnd(test, result) {
    const status = statusNames.has(result.status) ? result.status : 'failed';
    this.counts[status] = (this.counts[status] || 0) + 1;
    const duration = Number.isFinite(result.duration) && result.duration >= 0
      ? Math.min(Math.round(result.duration), 3600000) : 0;
    reportProgress({ event: 'end', test: testCodes.get(test.title) || 'other', status, duration });
  }
  onError() {}
  onStdOut() {}
  onStdErr() {}
  printsToStdio() { return true; }
  onEnd() {
    reportProgress({ event: 'complete' });
    for (const [status, count] of Object.entries(this.counts)) console.log(`Sensitive E2E ${status}: ${count}`);
  }
}
