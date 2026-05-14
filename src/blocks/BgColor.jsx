import React from 'react';
import { createReactStyleSpec } from '@blocknote/react';

// Inline background highlight style — accepts any CSS color. Same role as
// Google Docs' text-highlight tool. Replaces the BlockNote default
// `backgroundColor` style (limited to 9 named tokens).
export const BgColor = createReactStyleSpec(
  { type: 'backgroundColor', propSchema: 'string' },
  {
    render: (props) => (
      <span ref={props.contentRef} style={{ backgroundColor: props.value, padding: '0 0.1em', borderRadius: '2px' }} />
    ),
  }
);
