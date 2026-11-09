import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data from the Backend for a screen.
 *
 *   const { data, loading, error, reload, setData } = useLoad(loader, { interval });
 *
 * - `loader` must be a stable function (module-level or wrapped in useCallback)
 *   that resolves to the value to keep in `data` (unwrap `.data` inside it).
 * - `interval` (ms) re-fetches silently in the background (no spinner), used
 *   by the trainer's live lists.
 * - A failed silent refresh keeps showing the last data instead of an error.
 */
export default function useLoad(loader, { interval } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const alive = useRef(true);
  const request = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++request.current;
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await loader();
        if (alive.current && id === request.current) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!alive.current || id !== request.current) return;
        setState((s) => (silent && s.data !== null ? s : { data: null, loading: false, error: err.message || 'error' }));
      }
    },
    [loader]
  );

  useEffect(() => {
    alive.current = true;
    load();
    const timer = interval ? setInterval(() => load({ silent: true }), interval) : null;
    return () => {
      alive.current = false;
      if (timer) clearInterval(timer);
    };
  }, [load, interval]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: load, setData };
}
