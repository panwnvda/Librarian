import React from 'react';
import { createReactStyleSpec } from '@blocknote/react';

// Inline text style — applies a CSS color to the selection. Accepts any
// CSS color value (hex, rgb, named) so the right-click color picker can
// expose the same range Google Docs / Word does. Replaces the BlockNote
// default `textColor` style (which only accepts 9 named tokens).
export const TextColor = createReactStyleSpec(
  { type: 'textColor', propSchema: 'string' },
  {
    render: (props) => (
      <span ref={props.contentRef} style={{ color: props.value }} />
    ),
  }
);
