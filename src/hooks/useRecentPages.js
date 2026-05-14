import { useState, useEffect, useCallback } from 'react';
import { persistGet, persistSet } from '@/lib/persistentStorage';

const KEY = 'library_recent_pages';
const MAX = 8;

export function useRecentPages() {
  const [recentIds, setRecentIds] = useState([]);

  useEffect(() => {
    persistGet(KEY).then((data) => {
      if (Array.isArray(data)) setRecentIds(data);
    });
  }, []);

  const trackVisit = useCallback((id) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX);
      persistSet(KEY, next);
      return next;
    });
  }, []);

  return { recentIds, trackVisit };
}
