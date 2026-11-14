import { useSyncExternalStore } from 'react';
import { subscribe, hasSlowRequests } from '../requestActivity';

export default function ServerWakeNotice() {
  const visible = useSyncExternalStore(subscribe, hasSlowRequests);
  return visible ? (
    <p className="server-wake-notice" role="status">
      Сервер просыпается, это может занять до минуты
    </p>
  ) : null;
}
