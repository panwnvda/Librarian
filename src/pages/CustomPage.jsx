import React, { useState, useEffect } from 'react';
import NotesPage from './custom/NotesPage';
import ResourcePage from './custom/ResourcePage';
import HomePage from './custom/HomePage';
import TextPage from './custom/TextPage';
import AttackChainPage from './custom/AttackChainPage';
import { persistGet } from '@/lib/persistentStorage';

export default function CustomPage({ pageKey }) {
  const [type, setType] = useState(null);

  useEffect(() => {
    persistGet(`library_pagetype_${pageKey}`).then(val => {
      setType(val || 'notes');
    });
  }, [pageKey]);

  if (type === null) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
    </div>
  );

  if (type === 'resource') return <ResourcePage pageKey={pageKey} />;
  if (type === 'home') return <HomePage pageKey={pageKey} />;
  if (type === 'text') return <TextPage pageKey={pageKey} />;
  if (type === 'attackchain') return <AttackChainPage pageKey={pageKey} />;
  return <NotesPage pageKey={pageKey} />;
}
