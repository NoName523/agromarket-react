const listeners = new Set();
const slowRequests = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasSlowRequests() {
  return slowRequests.size > 0;
}

function notifyIfChanged(wasVisible) {
  if (wasVisible !== hasSlowRequests()) {
    for (const listener of listeners) listener();
  }
}

export function beginRequest() {
  const request = Symbol('request');
  const timer = setTimeout(() => {
    const wasVisible = hasSlowRequests();
    slowRequests.add(request);
    notifyIfChanged(wasVisible);
  }, 3000);
  return () => {
    clearTimeout(timer);
    const wasVisible = hasSlowRequests();
    slowRequests.delete(request);
    notifyIfChanged(wasVisible);
  };
}
