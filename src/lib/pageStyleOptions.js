export const titleColorOptions = [
  // Overall arc: lightest → darkest, walking the full spectrum at each shade tier.
  // Tier 200 (palest) → Tier 300 → Tier 400 → Tier 500 (deepest).
  // Tier direction alternates (red→orange, then orange→red, etc.) so each tier transition
  // happens at the same hue and only the shade changes.

  { value: 'white',      label: 'White',      text: 'text-slate-100',   bg: 'bg-slate-100',   border: 'border-slate-200/40', nodeBorder: 'border-slate-200/30 hover:border-slate-100/60 hover:shadow-slate-200/10' },

  // Bridge: white → red. Very pale red eases the entry into the spectrum.
  { value: 'blossom',    label: 'Blossom',    text: 'text-red-100',     bg: 'bg-red-100',     border: 'border-red-100/40',     nodeBorder: 'border-red-100/40 hover:border-red-50/60 hover:shadow-red-100/10' },

  // ── Tier 200 — palest pastels, red → orange
  { value: 'coral',      label: 'Coral',      text: 'text-red-200',     bg: 'bg-red-200',     border: 'border-red-200/40',     nodeBorder: 'border-red-200/40 hover:border-red-100/60 hover:shadow-red-200/10' },
  { value: 'crimson',    label: 'Crimson',    text: 'text-rose-200',    bg: 'bg-rose-200',    border: 'border-rose-200/40',    nodeBorder: 'border-rose-200/40 hover:border-rose-100/60 hover:shadow-rose-200/10' },
  { value: 'magenta',    label: 'Magenta',    text: 'text-pink-200',    bg: 'bg-pink-200',    border: 'border-pink-200/40',    nodeBorder: 'border-pink-200/40 hover:border-pink-100/60 hover:shadow-pink-200/10' },
  { value: 'mauve',      label: 'Mauve',      text: 'text-fuchsia-200', bg: 'bg-fuchsia-200', border: 'border-fuchsia-200/40', nodeBorder: 'border-fuchsia-200/40 hover:border-fuchsia-100/60 hover:shadow-fuchsia-200/10' },
  { value: 'lavender',   label: 'Lavender',   text: 'text-purple-200',  bg: 'bg-purple-200',  border: 'border-purple-200/40',  nodeBorder: 'border-purple-200/40 hover:border-purple-100/60 hover:shadow-purple-200/10' },
  { value: 'orchid',     label: 'Orchid',     text: 'text-violet-200',  bg: 'bg-violet-200',  border: 'border-violet-200/40',  nodeBorder: 'border-violet-200/40 hover:border-violet-100/60 hover:shadow-violet-200/10' },
  { value: 'periwinkle', label: 'Periwinkle', text: 'text-indigo-200',  bg: 'bg-indigo-200',  border: 'border-indigo-200/40',  nodeBorder: 'border-indigo-200/40 hover:border-indigo-100/60 hover:shadow-indigo-200/10' },
  { value: 'cobalt',     label: 'Cobalt',     text: 'text-blue-200',    bg: 'bg-blue-200',    border: 'border-blue-200/40',    nodeBorder: 'border-blue-200/40 hover:border-blue-100/60 hover:shadow-blue-200/10' },
  { value: 'powder',     label: 'Powder',     text: 'text-sky-200',     bg: 'bg-sky-200',     border: 'border-sky-200/40',     nodeBorder: 'border-sky-200/40 hover:border-sky-100/60 hover:shadow-sky-200/10' },
  { value: 'aqua',       label: 'Aqua',       text: 'text-cyan-200',    bg: 'bg-cyan-200',    border: 'border-cyan-200/40',    nodeBorder: 'border-cyan-200/40 hover:border-cyan-100/60 hover:shadow-cyan-200/10' },
  { value: 'celadon',    label: 'Celadon',    text: 'text-teal-200',    bg: 'bg-teal-200',    border: 'border-teal-200/40',    nodeBorder: 'border-teal-200/40 hover:border-teal-100/60 hover:shadow-teal-200/10' },
  { value: 'seafoam',    label: 'Seafoam',    text: 'text-emerald-200', bg: 'bg-emerald-200', border: 'border-emerald-200/40', nodeBorder: 'border-emerald-200/40 hover:border-emerald-100/60 hover:shadow-emerald-200/10' },
  { value: 'mint',       label: 'Mint',       text: 'text-green-200',   bg: 'bg-green-200',   border: 'border-green-200/40',   nodeBorder: 'border-green-200/40 hover:border-green-100/60 hover:shadow-green-200/10' },
  { value: 'sage',       label: 'Sage',       text: 'text-lime-200',    bg: 'bg-lime-200',    border: 'border-lime-200/40',    nodeBorder: 'border-lime-200/40 hover:border-lime-100/60 hover:shadow-lime-200/10' },
  { value: 'gold',       label: 'Gold',       text: 'text-yellow-200',  bg: 'bg-yellow-200',  border: 'border-yellow-200/40',  nodeBorder: 'border-yellow-200/40 hover:border-yellow-100/60 hover:shadow-yellow-200/10' },
  { value: 'marigold',   label: 'Marigold',   text: 'text-amber-200',   bg: 'bg-amber-200',   border: 'border-amber-200/40',   nodeBorder: 'border-amber-200/40 hover:border-amber-100/60 hover:shadow-amber-200/10' },
  { value: 'peach',      label: 'Peach',      text: 'text-orange-200',  bg: 'bg-orange-200',  border: 'border-orange-200/40',  nodeBorder: 'border-orange-200/40 hover:border-orange-100/60 hover:shadow-orange-200/10' },

  // ── Tier 300 — light-medium, reversed: orange → red
  { value: 'apricot',    label: 'Apricot',    text: 'text-orange-300',  bg: 'bg-orange-300',  border: 'border-orange-300/40',  nodeBorder: 'border-orange-300/40 hover:border-orange-200/60 hover:shadow-orange-300/10' },
  { value: 'honey',      label: 'Honey',      text: 'text-amber-300',   bg: 'bg-amber-300',   border: 'border-amber-300/40',   nodeBorder: 'border-amber-300/40 hover:border-amber-200/60 hover:shadow-amber-300/10' },
  { value: 'butter',     label: 'Butter',     text: 'text-yellow-300',  bg: 'bg-yellow-300',  border: 'border-yellow-300/40',  nodeBorder: 'border-yellow-300/40 hover:border-yellow-200/60 hover:shadow-yellow-300/10' },
  { value: 'chartreuse', label: 'Chartreuse', text: 'text-lime-300',    bg: 'bg-lime-300',    border: 'border-lime-300/40',    nodeBorder: 'border-lime-300/40 hover:border-lime-200/60 hover:shadow-lime-300/10' },
  { value: 'kiwi',       label: 'Kiwi',       text: 'text-green-300',   bg: 'bg-green-300',   border: 'border-green-300/40',   nodeBorder: 'border-green-300/40 hover:border-green-200/60 hover:shadow-green-300/10' },
  { value: 'spring',     label: 'Spring',     text: 'text-emerald-300', bg: 'bg-emerald-300', border: 'border-emerald-300/40', nodeBorder: 'border-emerald-300/40 hover:border-emerald-200/60 hover:shadow-emerald-300/10' },
  { value: 'jade',       label: 'Jade',       text: 'text-teal-300',    bg: 'bg-teal-300',    border: 'border-teal-300/40',    nodeBorder: 'border-teal-300/40 hover:border-teal-200/60 hover:shadow-teal-300/10' },
  { value: 'turquoise',  label: 'Turquoise',  text: 'text-cyan-300',    bg: 'bg-cyan-300',    border: 'border-cyan-300/40',    nodeBorder: 'border-cyan-300/40 hover:border-cyan-200/60 hover:shadow-cyan-300/10' },
  { value: 'cerulean',   label: 'Cerulean',   text: 'text-sky-300',     bg: 'bg-sky-300',     border: 'border-sky-300/40',     nodeBorder: 'border-sky-300/40 hover:border-sky-200/60 hover:shadow-sky-300/10' },
  { value: 'azure',      label: 'Azure',      text: 'text-blue-300',    bg: 'bg-blue-300',    border: 'border-blue-300/40',    nodeBorder: 'border-blue-300/40 hover:border-blue-200/60 hover:shadow-blue-300/10' },
  { value: 'bluebell',   label: 'Bluebell',   text: 'text-indigo-300',  bg: 'bg-indigo-300',  border: 'border-indigo-300/40',  nodeBorder: 'border-indigo-300/40 hover:border-indigo-200/60 hover:shadow-indigo-300/10' },
  { value: 'thistle',    label: 'Thistle',    text: 'text-violet-300',  bg: 'bg-violet-300',  border: 'border-violet-300/40',  nodeBorder: 'border-violet-300/40 hover:border-violet-200/60 hover:shadow-violet-300/10' },
  { value: 'amethyst',   label: 'Amethyst',   text: 'text-purple-300',  bg: 'bg-purple-300',  border: 'border-purple-300/40',  nodeBorder: 'border-purple-300/40 hover:border-purple-200/60 hover:shadow-purple-300/10' },
  { value: 'lilac',      label: 'Lilac',      text: 'text-fuchsia-300', bg: 'bg-fuchsia-300', border: 'border-fuchsia-300/40', nodeBorder: 'border-fuchsia-300/40 hover:border-fuchsia-200/60 hover:shadow-fuchsia-300/10' },
  { value: 'petal',      label: 'Petal',      text: 'text-pink-300',    bg: 'bg-pink-300',    border: 'border-pink-300/40',    nodeBorder: 'border-pink-300/40 hover:border-pink-200/60 hover:shadow-pink-300/10' },
  { value: 'blush',      label: 'Blush',      text: 'text-rose-300',    bg: 'bg-rose-300',    border: 'border-rose-300/40',    nodeBorder: 'border-rose-300/40 hover:border-rose-200/60 hover:shadow-rose-300/10' },
  { value: 'salmon',     label: 'Salmon',     text: 'text-red-300',     bg: 'bg-red-300',     border: 'border-red-300/40',     nodeBorder: 'border-red-300/40 hover:border-red-200/60 hover:shadow-red-300/10' },

  // Bridge: salmon → scarlet. Custom red-350 (#fa8b8b) is the midpoint between red-300 and red-400.
  { value: 'vermilion',  label: 'Vermilion',  text: 'text-[#fa8b8b]',   bg: 'bg-[#fa8b8b]',   border: 'border-[#fa8b8b]/40',   nodeBorder: 'border-[#fa8b8b]/40 hover:border-red-300/60 hover:shadow-[#fa8b8b]/10' },

  // ── Tier 400 — medium, red → orange again
  { value: 'scarlet',    label: 'Scarlet',    text: 'text-red-400',     bg: 'bg-red-400',     border: 'border-red-400/40',     nodeBorder: 'border-red-400/40 hover:border-red-300/60 hover:shadow-red-400/10' },
  { value: 'cherry',     label: 'Cherry',     text: 'text-rose-400',    bg: 'bg-rose-400',    border: 'border-rose-400/40',    nodeBorder: 'border-rose-400/40 hover:border-rose-300/60 hover:shadow-rose-400/10' },
  { value: 'flamingo',   label: 'Flamingo',   text: 'text-pink-400',    bg: 'bg-pink-400',    border: 'border-pink-400/40',    nodeBorder: 'border-pink-400/40 hover:border-pink-300/60 hover:shadow-pink-400/10' },
  { value: 'berry',      label: 'Berry',      text: 'text-fuchsia-400', bg: 'bg-fuchsia-400', border: 'border-fuchsia-400/40', nodeBorder: 'border-fuchsia-400/40 hover:border-fuchsia-300/60 hover:shadow-fuchsia-400/10' },
  { value: 'grape',      label: 'Grape',      text: 'text-purple-400',  bg: 'bg-purple-400',  border: 'border-purple-400/40',  nodeBorder: 'border-purple-400/40 hover:border-purple-300/60 hover:shadow-purple-400/10' },
  { value: 'iris',       label: 'Iris',       text: 'text-violet-400',  bg: 'bg-violet-400',  border: 'border-violet-400/40',  nodeBorder: 'border-violet-400/40 hover:border-violet-300/60 hover:shadow-violet-400/10' },
  { value: 'cornflower', label: 'Cornflower', text: 'text-indigo-400',  bg: 'bg-indigo-400',  border: 'border-indigo-400/40',  nodeBorder: 'border-indigo-400/40 hover:border-indigo-300/60 hover:shadow-indigo-400/10' },
  { value: 'sapphire',   label: 'Sapphire',   text: 'text-blue-400',    bg: 'bg-blue-400',    border: 'border-blue-400/40',    nodeBorder: 'border-blue-400/40 hover:border-blue-300/60 hover:shadow-blue-400/10' },
  { value: 'ocean',      label: 'Ocean',      text: 'text-sky-400',     bg: 'bg-sky-400',     border: 'border-sky-400/40',     nodeBorder: 'border-sky-400/40 hover:border-sky-300/60 hover:shadow-sky-400/10' },
  { value: 'lagoon',     label: 'Lagoon',     text: 'text-cyan-400',    bg: 'bg-cyan-400',    border: 'border-cyan-400/40',    nodeBorder: 'border-cyan-400/40 hover:border-cyan-300/60 hover:shadow-cyan-400/10' },
  { value: 'pine',       label: 'Pine',       text: 'text-teal-400',    bg: 'bg-teal-400',    border: 'border-teal-400/40',    nodeBorder: 'border-teal-400/40 hover:border-teal-300/60 hover:shadow-teal-400/10' },
  { value: 'forest',     label: 'Forest',     text: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-400/40', nodeBorder: 'border-emerald-400/40 hover:border-emerald-300/60 hover:shadow-emerald-400/10' },
  { value: 'moss',       label: 'Moss',       text: 'text-green-400',   bg: 'bg-green-400',   border: 'border-green-400/40',   nodeBorder: 'border-green-400/40 hover:border-green-300/60 hover:shadow-green-400/10' },
  { value: 'pear',       label: 'Pear',       text: 'text-lime-400',    bg: 'bg-lime-400',    border: 'border-lime-400/40',    nodeBorder: 'border-lime-400/40 hover:border-lime-300/60 hover:shadow-lime-400/10' },
  { value: 'dandelion',  label: 'Dandelion',  text: 'text-yellow-400',  bg: 'bg-yellow-400',  border: 'border-yellow-400/40',  nodeBorder: 'border-yellow-400/40 hover:border-yellow-300/60 hover:shadow-yellow-400/10' },
  { value: 'caramel',    label: 'Caramel',    text: 'text-amber-400',   bg: 'bg-amber-400',   border: 'border-amber-400/40',   nodeBorder: 'border-amber-400/40 hover:border-amber-300/60 hover:shadow-amber-400/10' },
  { value: 'tangerine',  label: 'Tangerine',  text: 'text-orange-400',  bg: 'bg-orange-400',  border: 'border-orange-400/40',  nodeBorder: 'border-orange-400/40 hover:border-orange-300/60 hover:shadow-orange-400/10' },

  // ── Tier 500 — deepest, reversed: orange → red
  { value: 'orange',     label: 'Orange',     text: 'text-orange-500',  bg: 'bg-orange-500',  border: 'border-orange-500/40',  nodeBorder: 'border-orange-500/40 hover:border-orange-400/60 hover:shadow-orange-500/10' },
  { value: 'amber',      label: 'Amber',      text: 'text-amber-500',   bg: 'bg-amber-500',   border: 'border-amber-500/40',   nodeBorder: 'border-amber-500/40 hover:border-amber-400/60 hover:shadow-amber-500/10' },
  { value: 'yellow',     label: 'Yellow',     text: 'text-yellow-500',  bg: 'bg-yellow-500',  border: 'border-yellow-500/40',  nodeBorder: 'border-yellow-500/40 hover:border-yellow-400/60 hover:shadow-yellow-500/10' },
  { value: 'lime',       label: 'Lime',       text: 'text-lime-500',    bg: 'bg-lime-500',    border: 'border-lime-500/40',    nodeBorder: 'border-lime-500/40 hover:border-lime-400/60 hover:shadow-lime-500/10' },
  { value: 'shamrock',   label: 'Shamrock',   text: 'text-green-500',   bg: 'bg-green-500',   border: 'border-green-500/40',   nodeBorder: 'border-green-500/40 hover:border-green-400/60 hover:shadow-green-500/10' },
  { value: 'green',      label: 'Green',      text: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-500/40', nodeBorder: 'border-emerald-500/40 hover:border-emerald-400/60 hover:shadow-emerald-500/10' },
  { value: 'emerald',   label: 'Emerald',    text: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-500/40', nodeBorder: 'border-emerald-500/40 hover:border-emerald-400/60 hover:shadow-emerald-500/10' },
  { value: 'teal',       label: 'Teal',       text: 'text-teal-500',    bg: 'bg-teal-500',    border: 'border-teal-500/40',    nodeBorder: 'border-teal-500/40 hover:border-teal-400/60 hover:shadow-teal-500/10' },
  { value: 'cyan',       label: 'Cyan',       text: 'text-cyan-500',    bg: 'bg-cyan-500',    border: 'border-cyan-500/40',    nodeBorder: 'border-cyan-500/40 hover:border-cyan-400/60 hover:shadow-cyan-500/10' },
  { value: 'sky',        label: 'Sky',        text: 'text-sky-500',     bg: 'bg-sky-500',     border: 'border-sky-500/40',     nodeBorder: 'border-sky-500/40 hover:border-sky-400/60 hover:shadow-sky-500/10' },
  { value: 'blue',       label: 'Blue',       text: 'text-blue-500',    bg: 'bg-blue-500',    border: 'border-blue-500/40',    nodeBorder: 'border-blue-500/40 hover:border-blue-400/60 hover:shadow-blue-500/10' },
  { value: 'indigo',     label: 'Indigo',     text: 'text-indigo-500',  bg: 'bg-indigo-500',  border: 'border-indigo-500/40',  nodeBorder: 'border-indigo-500/40 hover:border-indigo-400/60 hover:shadow-indigo-500/10' },
  { value: 'pansy',      label: 'Pansy',      text: 'text-[#7761f3]',   bg: 'bg-[#7761f3]',   border: 'border-[#7761f3]/40',   nodeBorder: 'border-[#7761f3]/40 hover:border-indigo-400/60 hover:shadow-[#7761f3]/10' },
  { value: 'violet',     label: 'Violet',     text: 'text-violet-500',  bg: 'bg-violet-500',  border: 'border-violet-500/40',  nodeBorder: 'border-violet-500/40 hover:border-violet-400/60 hover:shadow-violet-500/10' },
  { value: 'hyacinth',   label: 'Hyacinth',   text: 'text-[#9959f6]',   bg: 'bg-[#9959f6]',   border: 'border-[#9959f6]/40',   nodeBorder: 'border-[#9959f6]/40 hover:border-violet-400/60 hover:shadow-[#9959f6]/10' },
  { value: 'purple',     label: 'Purple',     text: 'text-purple-500',  bg: 'bg-purple-500',  border: 'border-purple-500/40',  nodeBorder: 'border-purple-500/40 hover:border-purple-400/60 hover:shadow-purple-500/10' },
  { value: 'heather',    label: 'Heather',    text: 'text-[#c04df3]',   bg: 'bg-[#c04df3]',   border: 'border-[#c04df3]/40',   nodeBorder: 'border-[#c04df3]/40 hover:border-purple-400/60 hover:shadow-[#c04df3]/10' },
  { value: 'fuchsia',    label: 'Fuchsia',    text: 'text-fuchsia-500', bg: 'bg-fuchsia-500', border: 'border-fuchsia-500/40', nodeBorder: 'border-fuchsia-500/40 hover:border-fuchsia-400/60 hover:shadow-fuchsia-500/10' },
  { value: 'carnation',  label: 'Carnation',  text: 'text-[#e247c4]',   bg: 'bg-[#e247c4]',   border: 'border-[#e247c4]/40',   nodeBorder: 'border-[#e247c4]/40 hover:border-fuchsia-400/60 hover:shadow-[#e247c4]/10' },
  { value: 'pink',       label: 'Pink',       text: 'text-pink-500',    bg: 'bg-pink-500',    border: 'border-pink-500/40',    nodeBorder: 'border-pink-500/40 hover:border-pink-400/60 hover:shadow-pink-500/10' },
  { value: 'rose',       label: 'Rose',       text: 'text-rose-500',    bg: 'bg-rose-500',    border: 'border-rose-500/40',    nodeBorder: 'border-rose-500/40 hover:border-rose-400/60 hover:shadow-rose-500/10' },
  { value: 'red',        label: 'Red',        text: 'text-red-500',     bg: 'bg-red-500',     border: 'border-red-500/40',     nodeBorder: 'border-red-500/40 hover:border-red-400/60 hover:shadow-red-500/10' },

  // Bridge: red → slate. Deeper red eases the descent toward the dark neutral.
  { value: 'ruby',       label: 'Ruby',       text: 'text-red-600',     bg: 'bg-red-600',     border: 'border-red-600/40',     nodeBorder: 'border-red-600/40 hover:border-red-500/60 hover:shadow-red-600/10' },

  { value: 'slate',      label: 'Slate',      text: 'text-slate-500',   bg: 'bg-slate-600',   border: 'border-slate-500/40',   nodeBorder: 'border-slate-500/40 hover:border-slate-400/60 hover:shadow-slate-500/10' },
];

export const titleFontOptions = [
  { value: 'font-mono', label: 'JetBrains Mono' },
  { value: 'font-sans', label: 'Inter' },
  { value: 'font-title-outfit', label: 'Outfit' },
  { value: 'font-title-sora', label: 'Sora' },
  { value: 'font-title-manrope', label: 'Manrope' },
  { value: 'font-title-space', label: 'Space Grotesk' },
  { value: 'font-title-serif', label: 'IBM Plex Serif' },
  { value: 'font-title-dmserif', label: 'DM Serif Display' },
  { value: 'font-title-editorial', label: 'Cormorant Garamond' },
  { value: 'font-title-display', label: 'Bebas Neue' },
  { value: 'font-title-archivo', label: 'Archivo Black' },
  { value: 'font-title-jakarta', label: 'Plus Jakarta Sans' },
  { value: 'font-title-syne', label: 'Syne' },
  { value: 'font-title-fraunces', label: 'Fraunces' },
  { value: 'font-title-oswald', label: 'Oswald' },
  { value: 'font-title-fjalla', label: 'Fjalla One' },
  { value: 'font-title-passion', label: 'Passion One' },
  { value: 'font-title-barlow', label: 'Barlow Semi Condensed' },
  { value: 'font-title-exo', label: 'Exo 2' },
  { value: 'font-title-titillium', label: 'Titillium Web' },
  { value: 'font-title-montserrat', label: 'Montserrat' },
  { value: 'font-title-raleway', label: 'Raleway' },
  { value: 'font-title-playfair', label: 'Playfair Display' },
  { value: 'font-title-noto', label: 'Noto Sans' },
  { value: 'font-title-ubuntu', label: 'Ubuntu' },
  { value: 'font-title-cantarell', label: 'Cantarell' },
  { value: 'font-title-roboto', label: 'Roboto' },
  { value: 'font-title-roboto-condensed', label: 'Roboto Condensed' },
  { value: 'font-title-opensans', label: 'Open Sans' },
  { value: 'font-title-lato', label: 'Lato' },
  { value: 'font-title-poppins', label: 'Poppins' },
  { value: 'font-title-nunito', label: 'Nunito' },
  { value: 'font-title-work', label: 'Work Sans' },
  { value: 'font-title-dmsans', label: 'DM Sans' },
  { value: 'font-title-fira', label: 'Fira Code' },
  { value: 'font-title-source', label: 'Source Code Pro' },
];

export function getTitleColorClass(value, fallback = 'text-cyan-500') {
  return titleColorOptions.find((option) => option.value === value)?.text || fallback;
}

export function getTitleFontClass(value, fallback = 'font-mono') {
  return titleFontOptions.find((option) => option.value === value)?.value || fallback;
}
