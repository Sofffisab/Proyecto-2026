import { useEffect, useRef, useState } from 'react';
import useLoad from './useLoad';
import { subscribeStaff, isStaffLive, onStaffLiveChange } from '../realtime/staffRealtime';

const DEBOUNCE_MS = 800;
const FALLBACK_MS = 20000;

/**
 * useLoad + live updates. The screen re-reads its data whenever the Backend
 * signals that one of `topics` changed (see realtime/staffRealtime.js).
 *
 * Several signals in a row (many people asking for help at the same time)
 * become ONE re-read: the refresh waits DEBOUNCE_MS after the last signal.
 *
 * @param {function} loader                       - same as useLoad
 * @param {string[]} topics                       - 'help' | 'people' | 'conflicts' | 'routines' | 'reports'
 * @param {object}   [options]
 * @param {number}   [options.fallbackMs=20000]   - refresh period while the live connection is down
 * @param {number}   [options.alwaysMs]           - extra slow refresh even when live (for data no signal covers)
 */
export default function useLiveLoad(loader, topics, { fallbackMs = FALLBACK_MS, alwaysMs } = {}) {
  const [live, setLive] = useState(isStaffLive());
  const result = useLoad(loader, { interval: live ? alwaysMs : fallbackMs });
  const reloadRef = useRef(result.reload);
  reloadRef.current = result.reload;
  const key = topics.join(',');

  useEffect(() => {
    let timer = null;
    const onSignal = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reloadRef.current({ silent: true }), DEBOUNCE_MS);
    };
    const off = subscribeStaff(topics, onSignal);
    const offState = onStaffLiveChange(setLive);
    setLive(isStaffLive());
    return () => {
      clearTimeout(timer);
      off();
      offState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ...result, live };
}
