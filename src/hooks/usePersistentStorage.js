/**
 * Hook for persistent key-value storage backed by DB + localStorage cache.
 * Usage: const [value, setValue, loading] = usePersistentStorage(key, defaultValue)
 */
import { useState, useEffect, useRef } from 'react';
import { persistGet, persistSet } from '@/lib/persistentStorage';

export default function usePersistentStorage(key, defaultValue) {
  const [value, setValueState] = useState(() => {
    // Read from localStorage synchronously for fast initial render
    try {
      const s = localStorage.getItem(key);
      if (s) return JSON.parse(s);
    } catch {}
    return defaultValue;
  });
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // On mount, sync from DB (may override localStorage)
  useEffect(() => {
    let cancelled = false;
    persistGet(key).then(dbVal => {
      if (cancelled) return;
      if (dbVal !== null && dbVal !== undefined) {
        setValueState(dbVal);
      }
      setLoading(false);
      initialized.current = true;
    });
    return () => { cancelled = true; };
  }, [key]);

  const setValue = (valOrFn) => {
    setValueState(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      persistSet(key, next); // async, fire and forget
      return next;
    });
  };

  return [value, setValue, loading];
}