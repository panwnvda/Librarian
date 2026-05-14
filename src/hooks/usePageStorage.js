import { useState, useEffect, useMemo, useCallback } from 'react';
import { persistGet, persistSet } from '@/lib/persistentStorage';

function localLoad(key, fallback) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
}

export function usePageStorage(pageKey, defaultColumns, builtInCards = []) {
  const colKey    = `library_columns_${pageKey}`;
  const cardKey   = `library_cards_${pageKey}`;
  const orderKey  = `library_order_${pageKey}`;
  const hiddenKey = `library_hidden_${pageKey}`;

  const [columns, setColumnsRaw]       = useState(() => localLoad(colKey, defaultColumns));
  const [customCards, setCustomCardsRaw] = useState(() => localLoad(cardKey, []));
  const [hiddenIds, setHiddenIdsRaw]   = useState(() => localLoad(hiddenKey, []));
  const [cardOrder, setCardOrderRaw]   = useState(() => localLoad(orderKey, builtInCards.map(c => c.id)));

  // When pageKey changes, reset from the new key's localStorage then sync from DB.
  useEffect(() => {
    setColumnsRaw(localLoad(colKey, defaultColumns));
    setCustomCardsRaw(localLoad(cardKey, []));
    setHiddenIdsRaw(localLoad(hiddenKey, []));
    setCardOrderRaw(localLoad(orderKey, builtInCards.map(c => c.id)));

    persistGet(colKey).then(val => { if (val != null) setColumnsRaw(val); });
    persistGet(cardKey).then(val => { if (val != null) setCustomCardsRaw(val); });
    persistGet(hiddenKey).then(val => { if (val != null) setHiddenIdsRaw(val); });
    persistGet(orderKey).then(val => { if (val != null) setCardOrderRaw(val); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  // Setter wrappers: use functional-updater form so they only change when the key changes,
  // not on every state update. persistSet is async + idempotent, safe inside updaters.
  const setColumns = useCallback((val) => {
    setColumnsRaw(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      persistSet(colKey, next);
      return next;
    });
  }, [colKey]);

  const setCustomCards = useCallback((val) => {
    setCustomCardsRaw(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      persistSet(cardKey, next);
      return next;
    });
  }, [cardKey]);

  const setHiddenIds = useCallback((val) => {
    setHiddenIdsRaw(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      persistSet(hiddenKey, next);
      return next;
    });
  }, [hiddenKey]);

  const setCardOrder = useCallback((val) => {
    setCardOrderRaw(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      persistSet(orderKey, next);
      return next;
    });
  }, [orderKey]);

  // Merged ordered list — memoised so it only recomputes when state actually changes.
  const allCards = useMemo(() => {
    const builtInMap = {};
    builtInCards.forEach(c => { builtInMap[c.id] = { ...c, isBuiltIn: true }; });
    const customMap = {};
    customCards.forEach(c => { customMap[c.id] = { ...c, isBuiltIn: false }; });

    const orderedIds = [...cardOrder];
    builtInCards.forEach(c => { if (!orderedIds.includes(c.id)) orderedIds.push(c.id); });
    customCards.forEach(c => { if (!orderedIds.includes(c.id)) orderedIds.push(c.id); });

    return orderedIds
      .filter(id => !hiddenIds.includes(id))
      .map(id => builtInMap[id] || customMap[id])
      .filter(Boolean);
  }, [cardOrder, customCards, builtInCards, hiddenIds]);

  const addCustomCard = useCallback((card) => {
    setCustomCards(prev => [...prev, { ...card, isBuiltIn: false }]);
    setCardOrder(prev => [...prev, card.id]);
  }, [setCustomCards, setCardOrder]);

  const updateCard = useCallback((updatedCard) => {
    const isBuiltIn = builtInCards.some(c => c.id === updatedCard.id);
    if (isBuiltIn) {
      setHiddenIds(prev => prev.includes(updatedCard.id) ? prev : [...prev, updatedCard.id]);
      const overrideCard = { ...updatedCard, id: updatedCard.id + '_override', isBuiltIn: false, _originalId: updatedCard.id };
      setCustomCards(prev => {
        const existing = prev.findIndex(c => c._originalId === updatedCard.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = overrideCard;
          return next;
        }
        return [...prev, overrideCard];
      });
      setCardOrder(prev => {
        const overrideId = updatedCard.id + '_override';
        const idx = prev.indexOf(updatedCard.id);
        if (idx >= 0) {
          const next = [...prev];
          next.splice(idx + 1, 0, overrideId);
          return next;
        }
        return prev.includes(overrideId) ? prev : [...prev, overrideId];
      });
    } else {
      setCustomCards(prev => prev.map(c => c.id === updatedCard.id ? { ...updatedCard, isBuiltIn: false } : c));
    }
  }, [builtInCards, setHiddenIds, setCustomCards, setCardOrder]);

  const deleteCard = useCallback((id) => {
    const isBuiltIn = builtInCards.some(c => c.id === id);
    if (isBuiltIn) {
      setHiddenIds(prev => [...prev, id]);
    } else {
      setCustomCards(prev => prev.filter(c => c.id !== id));
    }
    setCardOrder(prev => prev.filter(cid => cid !== id));
  }, [builtInCards, setHiddenIds, setCustomCards, setCardOrder]);

  const reorderCards = useCallback((fromIndex, toIndex) => {
    const currentIds = allCards.map(c => c.id);
    const [moved] = currentIds.splice(fromIndex, 1);
    currentIds.splice(toIndex, 0, moved);
    setCardOrder([...currentIds, ...hiddenIds]);
  }, [allCards, hiddenIds, setCardOrder]);

  return { columns, setColumns, customCards, allCards, addCustomCard, updateCard, deleteCard, reorderCards };
}
