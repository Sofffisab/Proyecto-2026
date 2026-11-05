// Frontend/screens/user/yearWrapped/YearWrappedContainer.js
// Conecta la pantalla con el backend (GET /wrapped/year?year=YYYY).
// Se usa desde RootNavigator con gamification.api#getYearWrapped (o `useMock` para ver datos de ejemplo).
import React, { useCallback, useEffect, useState } from 'react';
import YearWrappedScreen from './YearWrappedScreen';
import { mockWrapped } from './mockData';

export default function YearWrappedContainer({ year = new Date().getFullYear(), fetchYearWrapped, useMock = false, onClose, onRedeem }) {
  const [data, setData] = useState(useMock ? mockWrapped : null);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (useMock) return;
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
  }, [useMock, fetchYearWrapped, year]);

  useEffect(() => {
    load();
  }, [load]);

  return <YearWrappedScreen data={data} loading={loading} error={error} onRetry={load} onClose={onClose} onRedeem={onRedeem} />;
}
