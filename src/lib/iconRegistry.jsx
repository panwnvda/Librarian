// Passthrough renderer for page icons. Kept as a single seam so we can swap
// special icon tokens in later without touching every consumer.
//
// Currently icons are plain Unicode emoji strings, which render directly via
// the system font. So `renderIcon` just returns its input.
export function renderIcon(icon) {
  return icon ?? null;
}
