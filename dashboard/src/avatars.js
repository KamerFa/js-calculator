// 15 funny SVG vector avatars as data URIs
// Each avatar is a unique cartoon character with distinct personality

const AVATARS = [
  // 1 — Cool Sunglasses Cat
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#FFB74D"/><polygon points="25,15 20,45 35,35" fill="#FFB74D" stroke="#F57C00" stroke-width="2"/><polygon points="75,15 80,45 65,35" fill="#FFB74D" stroke="#F57C00" stroke-width="2"/><rect x="18" y="38" width="28" height="12" rx="4" fill="#333"/><rect x="54" y="38" width="28" height="12" rx="4" fill="#333"/><line x1="46" y1="43" x2="54" y2="43" stroke="#333" stroke-width="2"/><ellipse cx="50" cy="58" rx="5" ry="3" fill="#E91E63"/><path d="M38 65 Q50 78 62 65" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><line x1="10" y1="50" x2="0" y2="45" stroke="#333" stroke-width="1.5"/><line x1="10" y1="55" x2="0" y2="55" stroke="#333" stroke-width="1.5"/><line x1="10" y1="60" x2="0" y2="65" stroke="#333" stroke-width="1.5"/><line x1="90" y1="50" x2="100" y2="45" stroke="#333" stroke-width="1.5"/><line x1="90" y1="55" x2="100" y2="55" stroke="#333" stroke-width="1.5"/><line x1="90" y1="60" x2="100" y2="65" stroke="#333" stroke-width="1.5"/></svg>`,

  // 2 — Happy Robot
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="15" y="25" width="70" height="60" rx="10" fill="#78909C"/><rect x="35" y="10" width="30" height="20" rx="5" fill="#546E7A"/><circle cx="50" cy="5" r="5" fill="#FFD54F"/><circle cx="35" cy="48" r="10" fill="#E3F2FD"/><circle cx="65" cy="48" r="10" fill="#E3F2FD"/><circle cx="35" cy="48" r="5" fill="#2196F3"/><circle cx="65" cy="48" r="5" fill="#2196F3"/><rect x="30" y="65" width="40" height="8" rx="4" fill="#B0BEC5"/><rect x="33" y="67" width="6" height="4" fill="#546E7A"/><rect x="42" y="67" width="6" height="4" fill="#546E7A"/><rect x="51" y="67" width="6" height="4" fill="#546E7A"/><rect x="60" y="67" width="6" height="4" fill="#546E7A"/><rect x="8" y="40" width="7" height="25" rx="3" fill="#78909C"/><rect x="85" y="40" width="7" height="25" rx="3" fill="#78909C"/></svg>`,

  // 3 — Derpy Penguin
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="38" ry="42" fill="#37474F"/><ellipse cx="50" cy="60" rx="25" ry="30" fill="#ECEFF1"/><circle cx="38" cy="40" r="8" fill="white"/><circle cx="62" cy="40" r="8" fill="white"/><circle cx="40" cy="42" r="4" fill="#333"/><circle cx="60" cy="38" r="4" fill="#333"/><path d="M44 55 L50 65 L56 55" fill="#FF9800"/><path d="M12 50 Q5 70 20 80" fill="#37474F" stroke="#263238" stroke-width="1"/><path d="M88 50 Q95 70 80 80" fill="#37474F" stroke="#263238" stroke-width="1"/><ellipse cx="38" cy="88" rx="10" ry="5" fill="#FF9800"/><ellipse cx="62" cy="88" rx="10" ry="5" fill="#FF9800"/></svg>`,

  // 4 — Winking Emoji Star
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,2 61,35 97,35 68,56 79,90 50,70 21,90 32,56 3,35 39,35" fill="#FDD835"/><circle cx="38" cy="45" r="5" fill="#333"/><path d="M58 45 Q63 40 68 45" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><path d="M35 60 Q50 75 65 60" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><circle cx="28" cy="55" r="6" fill="#FFAB91" opacity="0.5"/><circle cx="72" cy="55" r="6" fill="#FFAB91" opacity="0.5"/></svg>`,

  // 5 — Nerdy Fox
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="52" r="40" fill="#FF7043"/><polygon points="20,20 15,52 35,42" fill="#FF7043"/><polygon points="80,20 85,52 65,42" fill="#FF7043"/><polygon points="20,20 15,52 28,45" fill="#FFAB91"/><polygon points="80,20 85,52 72,45" fill="#FFAB91"/><ellipse cx="50" cy="62" rx="22" ry="18" fill="#FFF3E0"/><circle cx="38" cy="48" r="10" fill="white" stroke="#333" stroke-width="1.5"/><circle cx="62" cy="48" r="10" fill="white" stroke="#333" stroke-width="1.5"/><circle cx="38" cy="48" r="5" fill="#333"/><circle cx="62" cy="48" r="5" fill="#333"/><circle cx="40" cy="46" r="2" fill="white"/><circle cx="64" cy="46" r="2" fill="white"/><line x1="38" y1="38" x2="28" y2="36" stroke="#333" stroke-width="1.5"/><line x1="62" y1="38" x2="72" y2="36" stroke="#333" stroke-width="1.5"/><ellipse cx="50" cy="62" rx="4" ry="3" fill="#333"/><path d="M46 68 Q50 73 54 68" fill="none" stroke="#333" stroke-width="1.5"/></svg>`,

  // 6 — Silly Ghost
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M20 95 L20 45 Q20 10 50 10 Q80 10 80 45 L80 95 L70 85 L60 95 L50 85 L40 95 L30 85 Z" fill="#E8EAF6"/><circle cx="38" cy="42" r="8" fill="#333"/><circle cx="62" cy="42" r="8" fill="#333"/><circle cx="40" cy="40" r="3" fill="white"/><circle cx="64" cy="40" r="3" fill="white"/><ellipse cx="50" cy="60" rx="8" ry="10" fill="#333"/><circle cx="25" cy="55" r="5" fill="#F8BBD0" opacity="0.6"/><circle cx="75" cy="55" r="5" fill="#F8BBD0" opacity="0.6"/></svg>`,

  // 7 — Pirate Panda
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="white"/><circle cx="22" cy="28" r="14" fill="#333"/><circle cx="78" cy="28" r="14" fill="#333"/><ellipse cx="35" cy="45" rx="14" ry="12" fill="#333"/><ellipse cx="65" cy="45" rx="14" ry="12" fill="#333"/><circle cx="35" cy="44" r="6" fill="white"/><circle cx="65" cy="44" r="6" fill="white"/><circle cx="37" cy="44" r="3" fill="#333"/><circle cx="67" cy="44" r="3" fill="#333"/><ellipse cx="50" cy="60" rx="6" ry="4" fill="#333"/><path d="M44 66 Q50 72 56 66" fill="none" stroke="#333" stroke-width="2"/><path d="M25 38 L45 32" fill="none" stroke="#333" stroke-width="3" stroke-linecap="round"/><rect x="22" y="28" width="18" height="3" rx="1" fill="#C62828" transform="rotate(-15, 31, 30)"/><ellipse cx="50" cy="14" rx="25" ry="8" fill="#333"/><rect x="25" y="8" width="50" height="10" rx="2" fill="#333"/></svg>`,

  // 8 — Chill Sloth
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="52" r="40" fill="#8D6E63"/><ellipse cx="50" cy="58" rx="28" ry="24" fill="#D7CCC8"/><ellipse cx="36" cy="45" rx="12" ry="10" fill="#D7CCC8"/><ellipse cx="64" cy="45" rx="12" ry="10" fill="#D7CCC8"/><path d="M30 46 Q36 42 42 46" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><path d="M58 46 Q64 42 70 46" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="50" cy="58" rx="5" ry="4" fill="#5D4037"/><path d="M42 65 Q50 72 58 65" fill="none" stroke="#5D4037" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="60" r="5" fill="#FFAB91" opacity="0.4"/><circle cx="70" cy="60" r="5" fill="#FFAB91" opacity="0.4"/></svg>`,

  // 9 — Party Unicorn
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="55" r="38" fill="#F8BBD0"/><polygon points="50,2 45,30 55,30" fill="#FFD54F" stroke="#FFC107" stroke-width="1"/><circle cx="38" cy="48" r="6" fill="#333"/><circle cx="62" cy="48" r="6" fill="#333"/><circle cx="40" cy="46" r="2.5" fill="white"/><circle cx="64" cy="46" r="2.5" fill="white"/><path d="M40 65 Q50 78 60 65" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><circle cx="30" cy="58" r="6" fill="#CE93D8" opacity="0.5"/><circle cx="70" cy="58" r="6" fill="#CE93D8" opacity="0.5"/><path d="M70 25 Q80 15 85 25 Q90 20 88 30" fill="#FF8A80" stroke="none"/><path d="M75 20 Q82 12 88 22" fill="#FFFF8D" stroke="none"/><path d="M78 22 Q85 18 86 28" fill="#B9F6CA" stroke="none"/><ellipse cx="32" cy="80" rx="4" ry="2" fill="#CE93D8"/><ellipse cx="68" cy="80" rx="4" ry="2" fill="#CE93D8"/></svg>`,

  // 10 — Grumpy Cactus
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="32" y="20" width="36" height="70" rx="18" fill="#66BB6A"/><rect x="8" y="40" width="24" height="14" rx="7" fill="#66BB6A"/><rect x="14" y="30" width="14" height="24" rx="7" fill="#66BB6A"/><rect x="68" y="35" width="24" height="14" rx="7" fill="#66BB6A"/><rect x="78" y="25" width="14" height="24" rx="7" fill="#66BB6A"/><line x1="40" y1="42" x2="34" y2="38" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><line x1="34" y1="42" x2="40" y2="38" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><line x1="66" y1="42" x2="60" y2="38" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><line x1="60" y1="42" x2="66" y2="38" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><path d="M42 55 Q50 50 58 55" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><circle cx="50" cy="18" r="6" fill="#E91E63"/><circle cx="50" cy="12" r="4" fill="#F44336"/></svg>`,

  // 11 — Shocked Moon
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#FFF9C4"/><circle cx="65" cy="45" r="20" fill="#FFF9C4"/><circle cx="37" cy="42" r="7" fill="#333"/><circle cx="63" cy="42" r="7" fill="#333"/><circle cx="39" cy="40" r="2.5" fill="white"/><circle cx="65" cy="40" r="2.5" fill="white"/><ellipse cx="50" cy="65" rx="8" ry="10" fill="#333"/><circle cx="28" cy="55" r="7" fill="#FFCC80" opacity="0.5"/><circle cx="72" cy="55" r="7" fill="#FFCC80" opacity="0.5"/><circle cx="82" cy="30" r="3" fill="#FFF59D"/><circle cx="78" cy="22" r="2" fill="#FFF59D"/><circle cx="86" cy="25" r="1.5" fill="#FFF59D"/></svg>`,

  // 12 — Detective Dog
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="52" r="38" fill="#A1887F"/><ellipse cx="25" cy="35" rx="14" ry="20" fill="#8D6E63" transform="rotate(-15, 25, 35)"/><ellipse cx="75" cy="35" rx="14" ry="20" fill="#8D6E63" transform="rotate(15, 75, 35)"/><ellipse cx="50" cy="62" rx="20" ry="15" fill="#D7CCC8"/><circle cx="38" cy="48" r="7" fill="white"/><circle cx="62" cy="48" r="7" fill="white"/><circle cx="39" cy="48" r="4" fill="#333"/><circle cx="63" cy="48" r="4" fill="#333"/><ellipse cx="50" cy="60" rx="7" ry="5" fill="#333"/><path d="M43 70 Q50 76 57 70" fill="none" stroke="#333" stroke-width="2"/><circle cx="40" cy="55" r="2" fill="#333"/><circle cx="60" cy="55" r="2" fill="#333"/><circle cx="36" cy="58" r="1.5" fill="#333"/><circle cx="64" cy="58" r="1.5" fill="#333"/><ellipse cx="50" cy="17" rx="22" ry="8" fill="#5D4037"/><rect x="28" y="13" width="44" height="8" rx="2" fill="#5D4037"/></svg>`,

  // 13 — Alien Chef
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="58" rx="32" ry="35" fill="#A5D6A7"/><ellipse cx="35" cy="42" rx="12" ry="14" fill="#C8E6C9"/><ellipse cx="65" cy="42" rx="12" ry="14" fill="#C8E6C9"/><circle cx="35" cy="42" r="6" fill="#333"/><circle cx="65" cy="42" r="6" fill="#333"/><circle cx="37" cy="40" r="2.5" fill="#76FF03"/><circle cx="67" cy="40" r="2.5" fill="#76FF03"/><path d="M44 62 Q50 68 56 62" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round"/><rect x="22" y="10" width="56" height="12" rx="3" fill="white"/><rect x="18" y="18" width="64" height="5" rx="2" fill="white"/><circle cx="50" cy="8" r="4" fill="white"/><ellipse cx="30" cy="78" rx="5" ry="3" fill="#81C784"/><ellipse cx="70" cy="78" rx="5" ry="3" fill="#81C784"/></svg>`,

  // 14 — Laughing Taco
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 60 Q50 95 90 60 Q50 15 10 60Z" fill="#FFB74D"/><path d="M15 58 Q50 85 85 58 Q50 25 15 58Z" fill="#FFF8E1"/><circle cx="35" cy="48" r="8" fill="#66BB6A"/><circle cx="55" cy="52" r="6" fill="#EF5350"/><circle cx="48" cy="58" r="5" fill="#FFB74D"/><circle cx="65" cy="48" r="4" fill="#66BB6A"/><circle cx="40" cy="55" r="3" fill="#EF5350"/><circle cx="40" cy="40" r="4" fill="#333"/><circle cx="60" cy="40" r="4" fill="#333"/><circle cx="41" cy="39" r="1.5" fill="white"/><circle cx="61" cy="39" r="1.5" fill="white"/><path d="M43 46 Q50 54 57 46" fill="#333" stroke="none"/></svg>`,

  // 15 — Wizard Owl
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="58" rx="35" ry="35" fill="#795548"/><circle cx="35" cy="48" r="14" fill="#FFF8E1"/><circle cx="65" cy="48" r="14" fill="#FFF8E1"/><circle cx="35" cy="48" r="8" fill="#FF8F00"/><circle cx="65" cy="48" r="8" fill="#FF8F00"/><circle cx="35" cy="48" r="4" fill="#333"/><circle cx="65" cy="48" r="4" fill="#333"/><polygon points="50,56 45,65 55,65" fill="#FF8F00"/><path d="M22 35 L30 45" fill="none" stroke="#5D4037" stroke-width="2.5" stroke-linecap="round"/><path d="M78 35 L70 45" fill="none" stroke="#5D4037" stroke-width="2.5" stroke-linecap="round"/><polygon points="50,0 35,28 65,28" fill="#3F51B5"/><polygon points="50,0 38,25 62,25" fill="#5C6BC0"/><circle cx="50" cy="24" r="4" fill="#FFD54F"/><path d="M22 70 Q50 85 78 70" fill="none" stroke="#5D4037" stroke-width="1.5"/></svg>`,
];

// Convert SVG string to data URI
export function avatarToDataUri(svgString) {
  return `data:image/svg+xml,${encodeURIComponent(svgString)}`;
}

// Get avatar by index (0-14)
export function getAvatar(index) {
  const i = Math.abs(index) % AVATARS.length;
  return avatarToDataUri(AVATARS[i]);
}

// Get a random avatar data URI
export function getRandomAvatar() {
  const index = Math.floor(Math.random() * AVATARS.length);
  return avatarToDataUri(AVATARS[index]);
}

// Get a random avatar index
export function getRandomAvatarIndex() {
  return Math.floor(Math.random() * AVATARS.length);
}

// All avatars as data URIs for picker
export function getAllAvatars() {
  return AVATARS.map((svg, index) => ({
    index,
    url: avatarToDataUri(svg),
  }));
}

export const AVATAR_COUNT = AVATARS.length;

export default AVATARS;
