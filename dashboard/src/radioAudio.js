// Global audio singleton - persists across component mounts/unmounts
// This ensures radio keeps playing when switching views

const STATIONS = [
  // ── SomaFM ────────────────────────────────────────────
  // Chill / Lounge
  { id: 'groovesalad', name: 'Groove Salad', genre: 'Chill', network: 'SomaFM', url: 'https://ice5.somafm.com/groovesalad-128-aac', desc: 'A nicely chilled plate of ambient/downtempo beats and grooves' },
  { id: 'lush', name: 'Lush', genre: 'Chill', network: 'SomaFM', url: 'https://ice4.somafm.com/lush-128-aac', desc: 'Sensuous and mellow vocals, mostly female, with jazzy undertones' },
  { id: 'secretagent', name: 'Secret Agent', genre: 'Lounge', network: 'SomaFM', url: 'https://ice4.somafm.com/secretagent-128-aac', desc: 'The soundtrack for your stylish, mysterious, dangerous life' },

  // Electronic / Dance
  { id: 'beatblender', name: 'Beat Blender', genre: 'Deep House', network: 'SomaFM', url: 'https://ice4.somafm.com/beatblender-128-aac', desc: 'A late night blend of steep beats and deep house' },
  { id: 'defcon', name: 'DEF CON Radio', genre: 'Electronic', network: 'SomaFM', url: 'https://ice5.somafm.com/defcon-128-aac', desc: 'Music for hacking. Dark EDM, industrial, and synthwave' },
  { id: 'thetrip', name: 'The Trip', genre: 'Progressive', network: 'SomaFM', url: 'https://ice4.somafm.com/thetrip-128-aac', desc: 'Progressive house and trance. Tip-top dance music' },

  // Ambient / Atmospheric
  { id: 'spacestation', name: 'Space Station Soma', genre: 'Ambient', network: 'SomaFM', url: 'https://ice5.somafm.com/spacestation-128-aac', desc: 'Tune in, turn on, space out. Ambient and mid-tempo' },
  { id: 'dronezone', name: 'Drone Zone', genre: 'Ambient', network: 'SomaFM', url: 'https://ice4.somafm.com/dronezone-128-aac', desc: 'Served best chilled, safe with most medications' },

  // Hip Hop / Soul / R&B
  { id: 'fluid', name: 'Fluid', genre: 'Hip Hop', network: 'SomaFM', url: 'https://ice4.somafm.com/fluid-128-aac', desc: 'Drown in the heavy beats and positive rhymes' },
  { id: '7soul', name: 'Seven Inch Soul', genre: 'Soul', network: 'SomaFM', url: 'https://ice4.somafm.com/7soul-128-aac', desc: 'Vintage soul tracks from the original 45 RPM vinyl' },

  // Rock / Indie / Retro
  { id: 'indiepop', name: 'Indie Pop Rocks!', genre: 'Indie', network: 'SomaFM', url: 'https://ice4.somafm.com/indiepop-128-aac', desc: 'New and classic indie pop and some sub-genres' },
  { id: 'u80s', name: 'Underground 80s', genre: '80s', network: 'SomaFM', url: 'https://ice4.somafm.com/u80s-128-aac', desc: 'Early 80s new wave, post-punk, and underground' },
  { id: 'seventies', name: 'Left Coast 70s', genre: 'Classic Rock', network: 'SomaFM', url: 'https://ice4.somafm.com/seventies-128-aac', desc: 'Mellow album rock from the Seventies. West coast vibes' },

  // Country / Folk
  { id: 'bootliquor', name: 'Boot Liquor', genre: 'Americana', network: 'SomaFM', url: 'https://ice4.somafm.com/bootliquor-128-aac', desc: 'Americana roots music for dusty backroads and campfires' },

  // Metal
  { id: 'metal', name: 'Metal Detector', genre: 'Metal', network: 'SomaFM', url: 'https://ice4.somafm.com/metal-128-aac', desc: 'From black to doom, heavy metal in all its forms' },

  // ── Naxi Radio (Serbia) ───────────────────────────────
  // Main
  { id: 'naxi-main', name: 'Naxi Radio', genre: 'Pop', network: 'Naxi', url: 'http://naxi128.streaming.rs:9150/', desc: 'Belgrade 96.9 FM — Serbia\'s most popular radio station' },

  // Dance / Electronic
  { id: 'naxi-dance', name: 'Naxi Dance', genre: 'Dance', network: 'Naxi', url: 'http://naxidigital-dance128.streaming.rs:8110/', desc: 'Non-stop dance music from Belgrade' },
  { id: 'naxi-house', name: 'Naxi House', genre: 'House', network: 'Naxi', url: 'http://naxidigital128.kbcnet.rs:8000/', desc: 'Deep house and electronic grooves' },
  { id: 'naxi-clubbing', name: 'Naxi Clubbing', genre: 'Club', network: 'Naxi', url: 'http://naxidigital128.kbcnet.rs:8090/', desc: 'Club hits and party anthems all night long' },

  // Chill / Lounge / Cafe
  { id: 'naxi-cafe', name: 'Naxi Cafe', genre: 'Cafe', network: 'Naxi', url: 'http://naxidigital-cafe128.streaming.rs:8020/', desc: 'Smooth cafe vibes, perfect for relaxing or working' },
  { id: 'naxi-love', name: 'Naxi Love', genre: 'Love Songs', network: 'Naxi', url: 'http://naxidigital-love128.streaming.rs:8100/', desc: 'The best love songs and romantic ballads' },

  // Rock / Blues
  { id: 'naxi-rock', name: 'Naxi Rock', genre: 'Rock', network: 'Naxi', url: 'http://naxidigital-rock128.streaming.rs:8180/', desc: 'Rock classics and new rock from around the world' },

  // Jazz / Classic
  { id: 'naxi-jazz', name: 'Naxi Jazz', genre: 'Jazz', network: 'Naxi', url: 'http://naxidigital-jazz128.streaming.rs:8170/', desc: 'Smooth jazz, classic standards, and modern jazz' },
  { id: 'naxi-classic', name: 'Naxi Classic', genre: 'Classical', network: 'Naxi', url: 'http://naxidigital128.kbcnet.rs:8030/', desc: 'Classical music masterpieces from all eras' },

  // Retro / Decades
  { id: 'naxi-80s', name: 'Naxi 80e', genre: '80s', network: 'Naxi', url: 'http://naxidigital-80s128.streaming.rs:8040/', desc: 'The greatest hits of the 1980s' },
  { id: 'naxi-evergreen', name: 'Naxi Evergreen', genre: 'Evergreen', network: 'Naxi', url: 'http://naxidigital-evergreen128.streaming.rs:8010/', desc: 'Timeless classics and unforgettable melodies' },
  { id: 'naxi-gold', name: 'Naxi Gold', genre: 'Gold Hits', network: 'Naxi', url: 'http://109.206.96.18:8060/', desc: 'Golden oldies and all-time favorites' },

  // Serbian / Ex-YU
  { id: 'naxi-exyu', name: 'Naxi EX YU', genre: 'Ex-YU', network: 'Naxi', url: 'http://naxidigital-exyu128.streaming.rs:8240/', desc: 'Best music from the former Yugoslavia' },
  { id: 'naxi-boem', name: 'Naxi Boem', genre: 'Boem', network: 'Naxi', url: 'http://109.206.96.18:8050/', desc: 'Traditional bohemian and folk music' },

  // Urban / Fresh
  { id: 'naxi-rnb', name: 'Naxi R\'n\'B', genre: 'R&B', network: 'Naxi', url: 'http://naxidigital-rnb128.streaming.rs:8120/', desc: 'R&B, soul, and hip-hop flavors' },
  { id: 'naxi-fresh', name: 'Naxi Fresh', genre: 'Fresh', network: 'Naxi', url: 'http://naxidigital-fresh128.streaming.rs:8210/', desc: 'Freshest new music and trending hits' },
  { id: 'naxi-latino', name: 'Naxi Latino', genre: 'Latino', network: 'Naxi', url: 'http://naxidigital-latino128.streaming.rs:8230/', desc: 'Latin rhythms, reggaeton, and salsa beats' },

  // Special
  { id: 'naxi-kids', name: 'Naxi Kids', genre: 'Kids', network: 'Naxi', url: 'http://naxidigital128.kbcnet.rs:8050/', desc: 'Music and fun for the little ones' },
];

const audio = new Audio();
let currentStation = null;
let paused = false;
let listeners = new Set();
let sleepTimerId = null;
let sleepEndTime = null;

// Restore volume from localStorage
const savedVolume = localStorage.getItem('radio_volume');
audio.volume = savedVolume ? parseFloat(savedVolume) : 0.7;

// Restore playing station from localStorage on load
const savedStation = localStorage.getItem('radio_playing');
if (savedStation) {
  try {
    const stationId = JSON.parse(savedStation);
    const station = STATIONS.find((s) => s.id === stationId);
    if (station) {
      currentStation = station;
      audio.src = station.url;
      audio.play().then(() => {
        updateMediaSession(station);
      }).catch(() => {
        // Autoplay blocked — keep station selected but paused
        paused = true;
        notifyListeners();
      });
    }
  } catch {
    // ignore
  }
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

// Media Session API — show station name in OS media controls
function updateMediaSession(station) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: station.network ? `${station.network} — ${station.genre}` : station.genre,
      album: station.desc,
    });
    navigator.mediaSession.setActionHandler('play', () => {
      radioAudio.resume();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      radioAudio.pause();
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      radioAudio.stop();
    });
  }
}

function clearMediaSession() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
  }
}

// Favorites management
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('radio_favorites') || '[]');
  } catch {
    return [];
  }
}

function setFavorites(favs) {
  localStorage.setItem('radio_favorites', JSON.stringify(favs));
}

// Recently played
function getRecent() {
  try {
    return JSON.parse(localStorage.getItem('radio_recent') || '[]');
  } catch {
    return [];
  }
}

function addToRecent(stationId) {
  const recent = getRecent().filter((id) => id !== stationId);
  recent.unshift(stationId);
  localStorage.setItem('radio_recent', JSON.stringify(recent.slice(0, 5)));
}

const radioAudio = {
  STATIONS,

  getStation() {
    return currentStation;
  },

  getVolume() {
    return audio.volume;
  },

  isPlaying() {
    return currentStation !== null && !audio.paused;
  },

  isPaused() {
    return paused;
  },

  play(station) {
    // If clicking the same station: toggle pause/resume
    if (currentStation?.id === station.id) {
      if (paused) {
        return this.resume();
      }
      this.pause();
      return Promise.resolve();
    }

    // Switch to a different station
    audio.pause();
    paused = false;
    audio.src = station.url;
    audio.volume = this.getVolume();

    return audio.play()
      .then(() => {
        currentStation = station;
        paused = false;
        localStorage.setItem('radio_playing', JSON.stringify(station.id));
        addToRecent(station.id);
        updateMediaSession(station);
        notifyListeners();
      })
      .catch(() => {
        currentStation = null;
        paused = false;
        localStorage.removeItem('radio_playing');
        notifyListeners();
        throw new Error('playback_failed');
      });
  },

  pause() {
    if (!currentStation) return;
    audio.pause();
    paused = true;
    notifyListeners();
  },

  resume() {
    if (!currentStation) return Promise.resolve();
    paused = false;
    // For live streams, we need to reload src to resume from live position
    audio.src = currentStation.url;
    audio.volume = this.getVolume();
    return audio.play()
      .then(() => {
        paused = false;
        updateMediaSession(currentStation);
        notifyListeners();
      })
      .catch(() => {
        paused = true;
        notifyListeners();
      });
  },

  stop() {
    audio.pause();
    audio.src = '';
    currentStation = null;
    paused = false;
    localStorage.removeItem('radio_playing');
    clearMediaSession();
    this.clearSleepTimer();
    notifyListeners();
  },

  setVolume(val) {
    const v = parseFloat(val);
    audio.volume = v;
    localStorage.setItem('radio_volume', v);
    notifyListeners();
  },

  // Favorites
  getFavorites,
  isFavorite(stationId) {
    return getFavorites().includes(stationId);
  },
  toggleFavorite(stationId) {
    const favs = getFavorites();
    if (favs.includes(stationId)) {
      setFavorites(favs.filter((id) => id !== stationId));
    } else {
      setFavorites([...favs, stationId]);
    }
    notifyListeners();
  },

  // Recently played
  getRecent,
  getRecentStations() {
    const recent = getRecent();
    return recent.map((id) => STATIONS.find((s) => s.id === id)).filter(Boolean);
  },

  // Sleep timer
  setSleepTimer(minutes) {
    this.clearSleepTimer();
    if (minutes <= 0) return;
    sleepEndTime = Date.now() + minutes * 60 * 1000;
    sleepTimerId = setTimeout(() => {
      this.stop();
      sleepTimerId = null;
      sleepEndTime = null;
      notifyListeners();
    }, minutes * 60 * 1000);
    notifyListeners();
  },

  clearSleepTimer() {
    if (sleepTimerId) {
      clearTimeout(sleepTimerId);
      sleepTimerId = null;
    }
    sleepEndTime = null;
    notifyListeners();
  },

  getSleepTimeRemaining() {
    if (!sleepEndTime) return null;
    const remaining = sleepEndTime - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : null;
  },

  hasSleepTimer() {
    return sleepEndTime !== null && sleepEndTime > Date.now();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export default radioAudio;
