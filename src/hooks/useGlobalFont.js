import { useEffect } from 'react';
import { persistSet } from '@/lib/persistentStorage';

const FONT_KEY = 'library_global_font';
export const DEFAULT_FONT = 'font-sans';

// Maps the CSS class token → actual font-family stack
export const FONT_STACKS = {
  'font-sans':             "'Inter', sans-serif",
  'font-mono':             "'JetBrains Mono', monospace",
  'font-title-outfit':     "'Outfit', sans-serif",
  'font-title-sora':       "'Sora', sans-serif",
  'font-title-manrope':    "'Manrope', sans-serif",
  'font-title-space':      "'Space Grotesk', sans-serif",
  'font-title-serif':      "'IBM Plex Serif', serif",
  'font-title-dmserif':    "'DM Serif Display', serif",
  'font-title-editorial':  "'Cormorant Garamond', serif",
  'font-title-display':    "'Bebas Neue', sans-serif",
  'font-title-archivo':    "'Archivo Black', sans-serif",
  'font-title-jakarta':    "'Plus Jakarta Sans', sans-serif",
  'font-title-syne':       "'Syne', sans-serif",
  'font-title-fraunces':   "'Fraunces', serif",
  'font-title-oswald':     "'Oswald', sans-serif",
  'font-title-fjalla':     "'Fjalla One', sans-serif",
  'font-title-passion':    "'Passion One', sans-serif",
  'font-title-barlow':     "'Barlow Semi Condensed', sans-serif",
  'font-title-exo':        "'Exo 2', sans-serif",
  'font-title-titillium':  "'Titillium Web', sans-serif",
  'font-title-montserrat': "'Montserrat', sans-serif",
  'font-title-raleway':    "'Raleway', sans-serif",
  'font-title-playfair':   "'Playfair Display', serif",
  'font-title-noto':       "'Noto Sans', sans-serif",
  'font-title-ubuntu':     "'Ubuntu', sans-serif",
  'font-title-cantarell':  "'Cantarell', sans-serif",
  'font-title-roboto':     "'Roboto', sans-serif",
  'font-title-opensans':   "'Open Sans', sans-serif",
  'font-title-lato':       "'Lato', sans-serif",
  'font-title-poppins':    "'Poppins', sans-serif",
  'font-title-nunito':     "'Nunito', sans-serif",
  'font-title-work':       "'Work Sans', sans-serif",
  'font-title-dmsans':     "'DM Sans', sans-serif",
  'font-title-fira':       "'Fira Code', monospace",
  'font-title-source':     "'Source Code Pro', monospace",
};

function applyFont(value) {
  const stack = FONT_STACKS[value] ?? FONT_STACKS[DEFAULT_FONT];
  document.documentElement.style.setProperty('--app-font', stack);
}

// App font is now fixed to DEFAULT_FONT (Inter). The user-facing App Font
// picker was removed, so we ignore any previously-persisted value and always
// apply the default. We also proactively clear the persisted key so a future
// reintroduction of a picker doesn't surface a stale stored choice.
export function useGlobalFont() {
  useEffect(() => {
    applyFont(DEFAULT_FONT);
    persistSet(FONT_KEY, null).catch(() => {});
  }, []);

  return { font: DEFAULT_FONT, setFont: () => {} };
}
