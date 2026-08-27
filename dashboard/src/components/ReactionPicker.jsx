import { memo, useState, useEffect, useRef } from 'react';

/* ── Emoji dataset by category ── */
const EMOJI_CATEGORIES = [
  {
    id: 'recent',
    icon: '🕐',
    label: 'Recently Used',
    emojis: [], // filled dynamically
  },
  {
    id: 'fun',
    icon: '🫠',
    label: 'Fun & Niche',
    emojis: [
      '🫠','🫡','🫣','🫢','🫥','🤌','🫶','🤙','🦭','🪿',
      '🫎','🦤','🪸','🪼','🪻','🫧','🪩','🛸','🧿','🪬',
      '🫗','🧋','🥶','🥵','🤡','💀','👻','👽','🤖','👾',
      '🧌','🫨','🙃','🥴','🤪','😶‍🌫️','🫠','🦧','🦥','🦔',
      '🦩','🦜','🪶','🐙','🦑','🪰','🦞','🪺','🧊','🫙',
      '🪤','🪆','🧸','🪅','🪄','🔮','🧬','🦠','🛞','🪬',
      '🫰','🫳','🫴','🫵','🤏','💅','🧠','🫀','👁️','🫦',
      '🧶','🪢','🪡','🧲','⚗️','🧪','🪈','🪇','🪘','🪗',
      '🪭','🪮','🪯','🪷','🪹','🪾','🫎','🫏','🛜','🪽',
    ],
  },
  {
    id: 'smileys',
    icon: '😊',
    label: 'Smileys & Emotion',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
      '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢',
      '🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏',
      '😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷',
      '🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠',
      '🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮',
      '😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥',
      '😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱',
      '😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡',
      '👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻',
      '😼','😽','🙀','😿','😾',
    ],
  },
  {
    id: 'people',
    icon: '👋',
    label: 'People & Body',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌',
      '🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
      '👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛',
      '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅',
      '🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠',
      '🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','👶',
      '🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴',
      '👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦',
      '🤷','👮','🕵️','💂','🥷','👷','🫅','🤴','👸','👳',
      '👲','🧕','🤵','👰','🤰','🫃','🤱','👼','🎅','🤶',
    ],
  },
  {
    id: 'nature',
    icon: '🌿',
    label: 'Animals & Nature',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨',
      '🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒',
      '🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇',
      '🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞',
      '🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍',
      '🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠',
      '🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍',
      '🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂',
      '🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','☘️','🍀',
      '🪴','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻',
    ],
  },
  {
    id: 'food',
    icon: '🍔',
    label: 'Food & Drink',
    emojis: [
      '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏',
      '🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑',
      '🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄',
      '🧅','🥜','🫘','🌰','🍞','🥐','🥖','🫓','🥨','🥯',
      '🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕',
      '🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘',
      '🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘',
      '🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥',
      '🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪',
      '🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫',
      '🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🍶',
      '🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🫗','🥤',
    ],
  },
  {
    id: 'activities',
    icon: '⚽',
    label: 'Activities',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
      '🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳',
      '🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷',
      '⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️',
      '🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗',
      '🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️',
      '🎫','🎟️','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹',
      '🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️',
      '🎯','🎳','🎮','🕹️','🧩',
    ],
  },
  {
    id: 'travel',
    icon: '✈️',
    label: 'Travel & Places',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐',
      '🛻','🚚','🚛','🚜','🛵','🏍️','🛺','🚲','🛴','🚏',
      '🛤️','⛽','🛞','🚨','🚥','🚦','🛑','🚧','⚓','🛟',
      '⛵','🛶','🚤','🛳️','⛴️','🛥️','🚢','✈️','🛩️','🛫',
      '🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰️','🚀','🛸',
      '🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣','🏤',
      '🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌',
      '🕍','🛕','🕋','⛩️','🗼','🗽','⛲','🌁','🌃','🏙️',
      '🌄','🌅','🌆','🌇','🌉','🎠','🛝','🎡','🎢','🏕️',
      '⛺','🗻','🌋','🏔️','🗺️','🧭',
    ],
  },
  {
    id: 'objects',
    icon: '💡',
    label: 'Objects',
    emojis: [
      '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️',
      '💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️',
      '📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭',
      '⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌',
      '💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶',
      '💷','🪙','💰','💳','🪪','💎','⚖️','🪜','🧰','🪛',
      '🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱',
      '⛓️','🧲','🔫','💣','🪓','🔪','🗡️','⚔️','🛡️','🚬',
      '⚰️','🪦','⚱️','🏺','🔮','📿','🧿','🪬','💈','⚗️',
      '🔭','🔬','🕳️','🩹','🩺','🩻','💊','💉','🩸','🧬',
      '🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰',
      '🚿','🛁','🛀','🪥','🪒','🧴','🧷','🧹','🧩','🪆',
      '🖼️','🪞','🪟','🛋️','🪑','🚪','🪵','🛏️','🛌','🧸',
      '🪆','🏮','📦','📫','📮','✏️','📝','📁','📂','📅',
      '📎','🔑','🗝️','🔒','🔓','❤️','🔥','✅','💯','⭐',
      '🌟','💫','⚡','🎯','🏷️',
    ],
  },
  {
    id: 'symbols',
    icon: '💜',
    label: 'Symbols & Flags',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
      '♥️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤',
      '✖️','➕','➖','➗','♾️','‼️','⁉️','❓','❔','❕',
      '❗','〰️','💱','💲','⚕️','♻️','⚜️','🔱','📛','🔰',
      '⭕','✅','☑️','✔️','❌','❎','➰','➿','〽️','✳️',
      '✴️','❇️','©️','®️','™️','#️⃣','*️⃣','0️⃣','1️⃣','2️⃣',
      '🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇺🇸','🇬🇧',
      '🇫🇷','🇩🇪','🇪🇸','🇮🇹','🇯🇵','🇰🇷','🇨🇳','🇧🇷','🇮🇳','🇷🇺',
      '🇨🇦','🇦🇺','🇲🇽','🇹🇷','🇸🇦','🇿🇦','🇳🇬','🇪🇬','🇦🇷','🇸🇪',
    ],
  },
];

/* Quick-react defaults (used when recents < 8) */
const DEFAULT_QUICK = ['❤️','😂','👍','🔥','🙏','🫠','🎉','🚀'];

const RECENTS_KEY = 'emoji-recents';
const MAX_RECENTS = 24;
const QUICK_COUNT = 8;

function getRecents() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY)) || [];
  } catch { return []; }
}

function saveRecent(emoji) {
  const recents = getRecents().filter(e => e !== emoji);
  recents.unshift(emoji);
  if (recents.length > MAX_RECENTS) recents.length = MAX_RECENTS;
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(recents)); } catch {}
}

/* Keep the old export for any code that imports REACTION_EMOJIS */
export const REACTION_EMOJIS = DEFAULT_QUICK;

const EMOJIS_PER_PAGE = 40;

const ReactionPicker = memo(function ReactionPicker({ onSelect, className = '' }) {
  const [activeTab, setActiveTab] = useState('fun');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState(getRecents);
  const gridRef = useRef(null);

  // Reset page when tab changes
  useEffect(() => { setPage(0); }, [activeTab]);

  // Reset tab & page when search changes
  useEffect(() => { if (search) { setActiveTab(''); setPage(0); } }, [search]);

  const handleSelect = (emoji) => {
    saveRecent(emoji);
    setRecents(getRecents());
    onSelect(emoji);
  };

  // Build the categories with dynamic recents
  const categories = EMOJI_CATEGORIES.map(cat =>
    cat.id === 'recent' ? { ...cat, emojis: recents } : cat
  );

  // Determine emojis to show
  let displayEmojis;
  let totalPages = 1;

  if (search) {
    // No real search index — just filter visible emojis
    const q = search.toLowerCase();
    displayEmojis = categories.flatMap(c => c.emojis);
    // Deduplicate
    displayEmojis = [...new Set(displayEmojis)];
    // We can't text-match on emoji glyphs meaningfully, so just show all and let user scroll
    // But we can at least de-duplicate and flatten
    totalPages = Math.ceil(displayEmojis.length / EMOJIS_PER_PAGE);
    displayEmojis = displayEmojis.slice(page * EMOJIS_PER_PAGE, (page + 1) * EMOJIS_PER_PAGE);
  } else {
    const activeCat = categories.find(c => c.id === activeTab);
    if (activeCat && activeCat.emojis.length > 0) {
      totalPages = Math.ceil(activeCat.emojis.length / EMOJIS_PER_PAGE);
      displayEmojis = activeCat.emojis.slice(page * EMOJIS_PER_PAGE, (page + 1) * EMOJIS_PER_PAGE);
    } else if (activeTab === 'recent' && recents.length === 0) {
      displayEmojis = [];
    } else {
      const fallback = categories.find(c => c.id === 'fun');
      totalPages = Math.ceil(fallback.emojis.length / EMOJIS_PER_PAGE);
      displayEmojis = fallback.emojis.slice(page * EMOJIS_PER_PAGE, (page + 1) * EMOJIS_PER_PAGE);
    }
  }

  // Hide recents tab if empty
  const visibleTabs = categories.filter(c => c.id !== 'recent' || recents.length > 0);

  return (
    <div className={`react-picker ${className}`} onClick={e => e.stopPropagation()}>
      {/* Quick-react row: recents first, pad with defaults */}
      <div className="rp-quick-row">
        {(() => {
          const merged = [...recents];
          for (const e of DEFAULT_QUICK) {
            if (merged.length >= QUICK_COUNT) break;
            if (!merged.includes(e)) merged.push(e);
          }
          return merged.slice(0, QUICK_COUNT).map(emoji => (
            <button key={emoji} className="rp-quick-btn" onClick={() => handleSelect(emoji)}>
              {emoji}
            </button>
          ));
        })()}
      </div>

      <div className="rp-divider" />

      {/* Category tabs */}
      <div className="rp-tabs">
        {visibleTabs.map(cat => (
          <button
            key={cat.id}
            className={`rp-tab${activeTab === cat.id ? ' active' : ''}`}
            onClick={() => { setActiveTab(cat.id); setSearch(''); }}
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="rp-grid" ref={gridRef}>
        {displayEmojis.length === 0 && (
          <div className="rp-empty">
            {activeTab === 'recent' ? 'No recent emojis yet' : 'No emojis found'}
          </div>
        )}
        {displayEmojis.map((emoji, i) => (
          <button key={`${emoji}-${i}`} className="react-picker-emoji" onClick={() => handleSelect(emoji)}>
            {emoji}
          </button>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="rp-pagination">
          <button
            className="rp-page-btn"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            &lsaquo;
          </button>
          <span className="rp-page-info">{page + 1} / {totalPages}</span>
          <button
            className="rp-page-btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          >
            &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
});

export default ReactionPicker;
