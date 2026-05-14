import React from 'react';
import { createReactStyleSpec } from '@blocknote/react';

// Inline text style — applies a `font-family` to whatever range it covers.
// Value is a CSS font-family string ("'Inter', sans-serif", a class token, etc.).
// Cleared by passing null/empty so the selection falls back to the page font.
export const FontFamily = createReactStyleSpec(
  { type: 'fontFamily', propSchema: 'string' },
  {
    render: (props) => (
      <span ref={props.contentRef} style={{ fontFamily: props.value }} />
    ),
  }
);
