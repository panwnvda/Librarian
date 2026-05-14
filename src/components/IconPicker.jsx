import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Search, X, Shuffle, Clock, Smile, Leaf, Coffee, Plane, Boxes, Hash, Shield } from 'lucide-react';
import { persistGet, persistSet } from '@/lib/persistentStorage';

const RECENTS_KEY = 'library_icon_recents';
const MAX_RECENTS = 24;

// ─── Categories ───────────────────────────────────────────────────────────────
// Each entry is { glyph, names } where `names` is a space-separated string of
// keywords used for substring search.

const CATEGORIES = [
  {
    id: 'smileys',
    label: 'Smileys & People',
    icon: Smile,
    emojis: [
      ['😀', 'grin smile happy'], ['😃', 'smile happy joy'], ['😄', 'smile happy'],
      ['😁', 'beam grin'], ['😆', 'laugh'], ['😅', 'sweat'], ['🤣', 'rofl laugh'],
      ['😂', 'joy laugh tears'], ['🙂', 'slight smile'], ['🙃', 'upside'],
      ['😉', 'wink'], ['😊', 'blush'], ['😇', 'innocent halo'],
      ['🥰', 'love hearts'], ['😍', 'heart eyes love'], ['🤩', 'star'],
      ['😘', 'kiss'], ['😋', 'yum'], ['😎', 'cool sunglasses'],
      ['🤓', 'nerd geek'], ['🥸', 'disguise'], ['🤔', 'think'],
      ['🤨', 'eyebrow suspicious'], ['😐', 'neutral'], ['😶', 'no mouth'],
      ['🙄', 'roll eyes'], ['😏', 'smirk'], ['🤐', 'zipper quiet'],
      ['😬', 'grimace'], ['🤥', 'lie pinocchio'], ['😴', 'sleep zzz'],
      ['😪', 'sleepy'], ['😌', 'relieved'], ['🤤', 'drool'],
      ['😵', 'dizzy'], ['🤯', 'mind blown explode'], ['🤠', 'cowboy'],
      ['🥳', 'party hat'], ['😎', 'cool'], ['🤡', 'clown'],
      ['🤖', 'robot'], ['👻', 'ghost spook'], ['💀', 'skull death'],
      ['☠️', 'skull crossbones pirate'], ['👽', 'alien ufo'], ['👾', 'space invader'],
      ['🙈', 'see no evil monkey'], ['🙉', 'hear no evil'], ['🙊', 'speak no evil'],
      ['👋', 'wave hello'], ['👌', 'ok'], ['🤝', 'handshake'],
      ['👍', 'thumbs up'], ['👎', 'thumbs down'], ['👊', 'fist'],
      ['🙏', 'pray thanks'], ['💪', 'flex muscle strong'], ['🫡', 'salute'],
      ['🧠', 'brain mind'], ['👀', 'eyes look'], ['👁️', 'eye watch'],
    ],
  },
  {
    id: 'nature',
    label: 'Animals & Nature',
    icon: Leaf,
    emojis: [
      ['🐶', 'dog puppy'], ['🐱', 'cat kitty'], ['🦊', 'fox'],
      ['🐻', 'bear'], ['🐼', 'panda'], ['🐨', 'koala'],
      ['🦁', 'lion'], ['🐯', 'tiger'], ['🐺', 'wolf'],
      ['🦝', 'raccoon'], ['🐮', 'cow'], ['🐷', 'pig'],
      ['🐸', 'frog'], ['🐵', 'monkey'], ['🦍', 'gorilla'],
      ['🦄', 'unicorn'], ['🐝', 'bee'], ['🐛', 'bug worm'],
      ['🦋', 'butterfly'], ['🕷️', 'spider'], ['🦂', 'scorpion'],
      ['🐢', 'turtle'], ['🐍', 'snake'], ['🦖', 'dinosaur trex'],
      ['🐙', 'octopus'], ['🦑', 'squid'], ['🦀', 'crab'],
      ['🐟', 'fish'], ['🐬', 'dolphin'], ['🐋', 'whale'],
      ['🦈', 'shark'], ['🐊', 'crocodile'], ['🐅', 'tiger'],
      ['🦓', 'zebra'], ['🦒', 'giraffe'], ['🐘', 'elephant'],
      ['🦏', 'rhino'], ['🦘', 'kangaroo'], ['🐎', 'horse'],
      ['🐓', 'rooster'], ['🦅', 'eagle'], ['🦉', 'owl'],
      ['🦇', 'bat'], ['🐺', 'wolf'], ['🌲', 'tree pine'],
      ['🌳', 'tree'], ['🌵', 'cactus'], ['🌴', 'palm tree'],
      ['🍀', 'clover lucky'], ['🌸', 'cherry blossom'], ['🌺', 'hibiscus flower'],
      ['🌻', 'sunflower'], ['🌹', 'rose'], ['🌷', 'tulip'],
      ['🌍', 'earth world globe'], ['🌎', 'earth americas'], ['🌏', 'earth asia'],
      ['🌕', 'moon full'], ['🌑', 'moon new'], ['⭐', 'star'],
      ['🌟', 'star glow'], ['☀️', 'sun'], ['🌤️', 'partly cloudy'],
      ['☁️', 'cloud'], ['⛈️', 'storm'], ['🌈', 'rainbow'],
      ['❄️', 'snowflake'], ['🔥', 'fire flame'], ['💧', 'water drop'],
      ['🌊', 'wave ocean'],
    ],
  },
  {
    id: 'food',
    label: 'Food & Drink',
    icon: Coffee,
    emojis: [
      ['🍎', 'apple'], ['🍊', 'orange'], ['🍋', 'lemon'],
      ['🍌', 'banana'], ['🍉', 'watermelon'], ['🍇', 'grapes'],
      ['🍓', 'strawberry'], ['🫐', 'blueberry'], ['🍒', 'cherry'],
      ['🍑', 'peach'], ['🥭', 'mango'], ['🍍', 'pineapple'],
      ['🥥', 'coconut'], ['🥝', 'kiwi'], ['🍅', 'tomato'],
      ['🍆', 'eggplant'], ['🥑', 'avocado'], ['🥦', 'broccoli'],
      ['🥒', 'cucumber'], ['🌶️', 'pepper chili'], ['🌽', 'corn'],
      ['🥕', 'carrot'], ['🧄', 'garlic'], ['🧅', 'onion'],
      ['🥔', 'potato'], ['🍞', 'bread'], ['🥖', 'baguette'],
      ['🥯', 'bagel'], ['🥨', 'pretzel'], ['🧀', 'cheese'],
      ['🥚', 'egg'], ['🍳', 'fried egg'], ['🥞', 'pancakes'],
      ['🥓', 'bacon'], ['🥩', 'steak'], ['🍗', 'chicken leg'],
      ['🌭', 'hot dog'], ['🍔', 'burger'], ['🍟', 'fries'],
      ['🍕', 'pizza'], ['🥪', 'sandwich'], ['🌮', 'taco'],
      ['🌯', 'burrito'], ['🥗', 'salad'], ['🍝', 'pasta'],
      ['🍜', 'ramen noodles'], ['🍲', 'stew pot'], ['🍛', 'curry'],
      ['🍣', 'sushi'], ['🥟', 'dumpling'], ['🍰', 'cake'],
      ['🎂', 'birthday cake'], ['🧁', 'cupcake'], ['🍪', 'cookie'],
      ['🍩', 'donut'], ['🍫', 'chocolate'], ['🍬', 'candy'],
      ['☕', 'coffee'], ['🍵', 'tea'], ['🥤', 'soda drink'],
      ['🧃', 'juice'], ['🍺', 'beer'], ['🍷', 'wine'],
      ['🍸', 'cocktail'], ['🥂', 'champagne cheers'], ['🍾', 'champagne'],
      ['🧊', 'ice'],
    ],
  },
  {
    id: 'activity',
    label: 'Activity & Travel',
    icon: Plane,
    emojis: [
      ['⚽', 'soccer football'], ['🏀', 'basketball'], ['🏈', 'football'],
      ['⚾', 'baseball'], ['🎾', 'tennis'], ['🏐', 'volleyball'],
      ['🎱', 'pool billiards'], ['🏓', 'pingpong'], ['🏸', 'badminton'],
      ['🥊', 'boxing'], ['🥋', 'martial arts'], ['🎯', 'target dart'],
      ['🎳', 'bowling'], ['🎣', 'fishing'], ['🏹', 'archery bow'],
      ['⛳', 'golf'], ['🎿', 'ski'], ['🏂', 'snowboard'],
      ['🏄', 'surfing'], ['🚣', 'rowing'], ['🏊', 'swimming'],
      ['🚴', 'biking cycling'], ['🚵', 'mountain bike'], ['🧗', 'climbing'],
      ['🧘', 'yoga meditation'], ['🏆', 'trophy'], ['🥇', 'gold medal first'],
      ['🥈', 'silver medal second'], ['🥉', 'bronze medal third'], ['🏅', 'medal'],
      ['🎖️', 'military medal'], ['🎮', 'gaming controller'], ['🕹️', 'joystick'],
      ['🎲', 'dice'], ['🎰', 'slot machine'], ['🎨', 'palette art'],
      ['🎭', 'theater'], ['🎬', 'movie clapper'], ['🎤', 'microphone'],
      ['🎧', 'headphones'], ['🎼', 'music'], ['🎹', 'piano keyboard'],
      ['🥁', 'drums'], ['🎷', 'saxophone'], ['🎺', 'trumpet'],
      ['🎸', 'guitar'], ['🚗', 'car'], ['🚕', 'taxi'],
      ['🚙', 'suv'], ['🚌', 'bus'], ['🚒', 'fire engine'],
      ['🚑', 'ambulance'], ['🚓', 'police car'], ['🚜', 'tractor'],
      ['🏎️', 'race car'], ['🏍️', 'motorcycle'], ['🛵', 'scooter'],
      ['🚲', 'bicycle'], ['🛴', 'kick scooter'], ['🚀', 'rocket'],
      ['🛸', 'ufo'], ['✈️', 'airplane'], ['🚁', 'helicopter'],
      ['⛵', 'sailboat'], ['🚂', 'train'], ['🗽', 'statue of liberty'],
      ['🗼', 'tokyo tower'], ['🏰', 'castle'], ['🏯', 'japanese castle'],
      ['🌋', 'volcano'], ['🏔️', 'mountain snow'], ['🗻', 'mount fuji'],
      ['🏕️', 'camping tent'], ['🏖️', 'beach'], ['🏟️', 'stadium'],
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: Boxes,
    emojis: [
      ['💻', 'laptop computer'], ['🖥️', 'desktop computer'], ['⌨️', 'keyboard'],
      ['🖱️', 'mouse'], ['🖨️', 'printer'], ['📱', 'phone'],
      ['☎️', 'telephone'], ['📞', 'phone call'], ['📷', 'camera'],
      ['🎥', 'video camera'], ['📺', 'tv'], ['📻', 'radio'],
      ['🎙️', 'microphone studio'], ['⏰', 'alarm clock'], ['⏱️', 'stopwatch'],
      ['📡', 'satellite'], ['🔋', 'battery'], ['🔌', 'plug'],
      ['💡', 'lightbulb idea'], ['🔦', 'flashlight'], ['🕯️', 'candle'],
      ['🪔', 'lamp oil'], ['🔍', 'magnify search'], ['🔎', 'magnify right'],
      ['📖', 'book open'], ['📚', 'books'], ['📕', 'red book'],
      ['📗', 'green book'], ['📘', 'blue book'], ['📙', 'orange book'],
      ['📒', 'notebook ledger'], ['📓', 'notebook'], ['📔', 'notebook decorated'],
      ['📜', 'scroll'], ['📃', 'page'], ['📄', 'page document'],
      ['📑', 'tabs bookmark'], ['📊', 'bar chart'], ['📈', 'chart up'],
      ['📉', 'chart down'], ['📋', 'clipboard'], ['📌', 'pin pushpin'],
      ['📍', 'round pin location'], ['📎', 'paperclip'], ['🖇️', 'paperclips linked'],
      ['📏', 'ruler'], ['📐', 'triangle ruler'], ['✂️', 'scissors'],
      ['🖊️', 'pen'], ['🖋️', 'fountain pen'], ['✒️', 'black nib'],
      ['🖌️', 'paintbrush'], ['🖍️', 'crayon'], ['📝', 'memo note'],
      ['📅', 'calendar'], ['📆', 'tear-off calendar'], ['🗓️', 'spiral calendar'],
      ['📇', 'card index'], ['🗃️', 'card file box'], ['🗄️', 'file cabinet'],
      ['🗑️', 'trash wastebasket'], ['📦', 'package box'], ['📫', 'mailbox'],
      ['📨', 'incoming envelope'], ['📩', 'envelope arrow'], ['📤', 'outbox tray'],
      ['📥', 'inbox tray'], ['💼', 'briefcase work'], ['🧳', 'luggage'],
      ['🔑', 'key'], ['🗝️', 'old key'], ['🔒', 'lock locked'],
      ['🔓', 'unlock unlocked'], ['🔏', 'lock with pen'], ['🔐', 'lock with key'],
      ['💰', 'money bag'], ['💳', 'credit card'], ['💎', 'gem diamond'],
      ['⚖️', 'balance scale justice'], ['🔨', 'hammer'], ['⛏️', 'pickaxe'],
      ['🛠️', 'tools'], ['⚙️', 'gear settings cog'], ['🧰', 'toolbox'],
      ['🧲', 'magnet'], ['🧪', 'test tube'], ['🧫', 'petri dish'],
      ['🧬', 'dna'], ['🔬', 'microscope'], ['🔭', 'telescope'],
      ['📡', 'antenna satellite'], ['💉', 'syringe'], ['💊', 'pill medicine'],
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: Hash,
    emojis: [
      ['❤️', 'red heart love'], ['🧡', 'orange heart'], ['💛', 'yellow heart'],
      ['💚', 'green heart'], ['💙', 'blue heart'], ['💜', 'purple heart'],
      ['🖤', 'black heart'], ['🤍', 'white heart'], ['🤎', 'brown heart'],
      ['💔', 'broken heart'], ['❣️', 'heart exclamation'], ['💕', 'two hearts'],
      ['💞', 'revolving hearts'], ['💗', 'growing heart'], ['💓', 'beating heart'],
      ['💘', 'heart arrow'], ['💝', 'heart ribbon'], ['💯', '100 hundred'],
      ['✨', 'sparkles'], ['⚡', 'high voltage lightning'], ['🔥', 'fire flame'],
      ['💥', 'collision boom'], ['💫', 'dizzy'], ['💢', 'anger symbol'],
      ['✅', 'check mark green'], ['☑️', 'check box'], ['✔️', 'check mark'],
      ['❌', 'cross mark x'], ['❎', 'cross mark button'], ['⛔', 'no entry'],
      ['🚫', 'prohibited'], ['⚠️', 'warning'], ['❗', 'exclamation'],
      ['❓', 'question'], ['‼️', 'double exclamation'], ['⁉️', 'exclamation question'],
      ['🔴', 'red circle'], ['🟠', 'orange circle'], ['🟡', 'yellow circle'],
      ['🟢', 'green circle'], ['🔵', 'blue circle'], ['🟣', 'purple circle'],
      ['🟤', 'brown circle'], ['⚫', 'black circle'], ['⚪', 'white circle'],
      ['🟥', 'red square'], ['🟧', 'orange square'], ['🟨', 'yellow square'],
      ['🟩', 'green square'], ['🟦', 'blue square'], ['🟪', 'purple square'],
      ['⬛', 'black square'], ['⬜', 'white square'], ['◼️', 'small black square'],
      ['▶️', 'play'], ['⏸️', 'pause'], ['⏹️', 'stop'],
      ['⏺️', 'record'], ['⏭️', 'next track'], ['⏮️', 'previous track'],
      ['🔀', 'shuffle'], ['🔁', 'repeat'], ['🔂', 'repeat one'],
      ['♻️', 'recycle'], ['⚛️', 'atom'], ['🔱', 'trident'],
      ['📛', 'name badge'], ['🆕', 'new button'], ['🆒', 'cool button'],
      ['🆗', 'ok button'], ['🆙', 'up button'], ['🆓', 'free'],
      ['🔢', 'numbers 1234'], ['#️⃣', 'hash keycap'], ['*️⃣', 'asterisk keycap'],
    ],
  },
  {
    id: 'security',
    label: 'Security / Tech',
    icon: Shield,
    emojis: [
      ['🛡️', 'shield defense'], ['⚔️', 'crossed swords attack'], ['🗡️', 'dagger'],
      ['🔫', 'gun'], ['💣', 'bomb'], ['🧨', 'dynamite'],
      ['🎯', 'target'], ['🚨', 'siren alarm alert'], ['🔔', 'bell notification'],
      ['🔓', 'unlocked'], ['🔒', 'locked secure'], ['🔐', 'locked key'],
      ['🔑', 'key'], ['🗝️', 'old key'], ['🆔', 'id badge'],
      ['👤', 'silhouette user'], ['👥', 'users group'], ['🕵️', 'detective spy'],
      ['🏴', 'black flag ctf'], ['🏳️', 'white flag'], ['🚩', 'red flag'],
      ['📡', 'antenna signal'], ['📶', 'signal bars'], ['📞', 'phone'],
      ['📲', 'mobile arrow'], ['📵', 'no mobile'], ['🚷', 'no pedestrian'],
      ['⛓️', 'chains links'], ['🪝', 'hook'], ['🧯', 'fire extinguisher'],
      ['🪤', 'mouse trap'], ['🧲', 'magnet'], ['📌', 'pin'],
      ['🪲', 'beetle bug'], ['🐛', 'worm bug'], ['🪱', 'worm'],
      ['🐍', 'snake'], ['🦠', 'microbe virus'], ['☣️', 'biohazard'],
      ['☢️', 'radioactive'], ['⚗️', 'alembic chemistry'], ['🧪', 'test tube'],
      ['🧬', 'dna'], ['🔬', 'microscope'], ['💻', 'laptop'],
      ['🖥️', 'desktop'], ['⌨️', 'keyboard'], ['💾', 'floppy save'],
      ['💿', 'cd'], ['📀', 'dvd'], ['🗃️', 'card files'],
      ['📊', 'chart'], ['📈', 'trend up'], ['📉', 'trend down'],
      ['🧠', 'brain'], ['👁️‍🗨️', 'eye bubble'], ['🔍', 'search'],
      ['🔎', 'search right'], ['🛰️', 'satellite'],
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function IconPicker({ onSelect, onClose, anchorEl }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState(CATEGORIES[0].id);
  const [recents, setRecents] = useState([]);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [position, setPosition] = useState({ top: 60, left: 60 });

  useEffect(() => {
    let cancelled = false;
    persistGet(RECENTS_KEY).then((v) => {
      if (!cancelled && Array.isArray(v)) setRecents(v);
    });
    return () => { cancelled = true; };
  }, []);

  // Position relative to anchor (preferred), otherwise fall back to a sensible spot.
  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const vh = window.innerHeight, vw = window.innerWidth;
    const W = 360, H = 420;
    let top = rect.bottom + 6;
    if (top + H > vh - 8) top = Math.max(8, rect.top - H - 6);
    let left = rect.left;
    if (left + W > vw - 8) left = vw - W - 8;
    if (left < 8) left = 8;
    setPosition({ top, left });
  }, [anchorEl]);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (anchorEl && anchorEl.contains?.(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorEl]);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const handlePick = useCallback((emoji) => {
    onSelect(emoji);
    // Update recents
    setRecents((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
      persistSet(RECENTS_KEY, next);
      return next;
    });
    onClose();
  }, [onSelect, onClose]);

  const handleRandom = () => {
    const all = CATEGORIES.flatMap((c) => c.emojis.map(([g]) => g));
    handlePick(all[Math.floor(Math.random() * all.length)]);
  };

  // Search results across all categories
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const seen = new Set();
    const hits = [];
    for (const cat of CATEGORIES) {
      for (const [glyph, names] of cat.emojis) {
        if (seen.has(glyph)) continue;
        if (names.toLowerCase().includes(q) || glyph === q) {
          hits.push(glyph);
          seen.add(glyph);
        }
      }
    }
    return hits;
  }, [query]);

  const activeCat = CATEGORIES.find((c) => c.id === tab) ?? CATEGORIES[0];

  return (
    <div
      ref={rootRef}
      className="fixed z-[1500] flex w-[360px] flex-col overflow-hidden rounded-xl border border-[#373737] bg-[#202020] shadow-2xl"
      style={{ top: position.top, left: position.left, maxHeight: 420 }}
    >
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-[#2f2f2f] bg-[#1d1d1d] px-3 py-2">
        <Search className="h-3.5 w-3.5 flex-shrink-0 text-[#6e6e6e]" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emojis…"
          className="w-full bg-transparent text-[13px] text-[#e8e8e8] placeholder-[#5a5a5a] focus:outline-none"
        />
        <button
          onClick={handleRandom}
          title="Random"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[#7a7a7a] transition-colors hover:bg-white/[0.05] hover:text-[#e8e8e8]"
        >
          <Shuffle className="h-3 w-3" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {searchResults ? (
          <>
            <SectionLabel>Results ({searchResults.length})</SectionLabel>
            {searchResults.length === 0 ? (
              <p className="px-2 py-6 text-center text-[12px] text-[#7a7a7a]">No matches</p>
            ) : (
              <EmojiGrid items={searchResults} onPick={handlePick} />
            )}
          </>
        ) : (
          <>
            {recents.length > 0 && tab === CATEGORIES[0].id && (
              <>
                <SectionLabel>
                  <Clock className="h-3 w-3" />
                  Recent
                </SectionLabel>
                <EmojiGrid items={recents} onPick={handlePick} />
              </>
            )}
            <SectionLabel>
              <activeCat.icon className="h-3 w-3" />
              {activeCat.label}
            </SectionLabel>
            <EmojiGrid items={activeCat.emojis.map(([g]) => g)} onPick={handlePick} />
          </>
        )}
      </div>

      {/* Tabs + remove */}
      <div className="flex items-center justify-between border-t border-[#2f2f2f] bg-[#1d1d1d] px-1.5 py-1.5">
        <div className="flex items-center gap-0.5">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const isActive = tab === c.id && !query;
            return (
              <button
                key={c.id}
                onClick={() => { setQuery(''); setTab(c.id); }}
                title={c.label}
                className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] text-[#e8e8e8]'
                    : 'text-[#7a7a7a] hover:bg-white/[0.045] hover:text-[#c4c4c4]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { onSelect(null); onClose(); }}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11.5px] text-[#9a9a9a] transition-colors hover:bg-white/[0.045] hover:text-[#e57373]"
        >
          <X className="h-3 w-3" />
          Remove
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-[#7a7a7a]">
      {children}
    </div>
  );
}

function EmojiGrid({ items, onPick }) {
  return (
    <div className="grid grid-cols-9 gap-0.5 px-1 pb-1">
      {items.map((g, i) => (
        <button
          key={`${g}-${i}`}
          onClick={() => onPick(g)}
          className="flex h-8 w-8 items-center justify-center rounded text-[19px] leading-none transition-colors hover:bg-white/[0.06]"
        >
          {g}
        </button>
      ))}
    </div>
  );
}
