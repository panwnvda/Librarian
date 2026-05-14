import React from 'react';
import { createReactStyleSpec } from '@blocknote/react';

// Inline text style — applies a `font-size` to whatever range it covers.
// Value is a CSS size string ("16px", "1.5em", etc.). Cleared by passing null/empty.
export const FontSize = createReactStyleSpec(
  { type: 'fontSize', propSchema: 'string' },
  {
    render: (props) => (
      <span ref={props.contentRef} style={{ fontSize: props.value }} />
    ),
  }
);
