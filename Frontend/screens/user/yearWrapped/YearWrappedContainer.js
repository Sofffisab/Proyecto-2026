// Frontend/screens/user/yearWrapped/YearWrappedContainer.js
// Connects the screen with the backend (GET /wrapped/year?year=YYYY).
// Used from RootNavigator with gamification.api#getYearWrapped.
import React, { useCallback, useEffect, useState } from 'react';
import YearWrappedScreen from './YearWrappedScreen';

export default function YearWrappedContainer({ year = new Date().getFullYear(), fetchYearWrapped, onClose, onRedeem }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetchYearWrapped(year);
      setData(res.data ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchYearWrapped, year]);

  useEffect(() => {
    load();
  }, [load]);

  return <YearWrappedScreen data={data} loading={loading} error={error} onRetry={load} onClose={onClose} onRedeem={onRedeem} />;
}
