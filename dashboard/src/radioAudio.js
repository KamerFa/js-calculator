// Global audio singleton - persists across component mounts/unmounts
// This ensures radio keeps playing when switching views

const STATIONS = [
  // Chill / Lounge
  { id: 'groovesalad', name: 'Groove Salad', genre: 'Chill', url: 'https://ice5.somafm.com/groovesalad-128-aac', desc: 'A nicely chilled plate of ambient/downtempo beats and grooves' },
  { id: 'lush', name: 'Lush', genre: 'Chill', url: 'https://ice4.somafm.com/lush-128-aac', desc: 'Sensuous and mellow vocals, mostly female, with jazzy undertones' },
  { id: 'secretagent', name: 'Secret Agent', genre: 'Lounge', url: 'https://ice4.somafm.com/secretagent-128-aac', desc: 'The soundtrack for your stylish, mysterious, dangerous life' },

  // Electronic / Dance
  { id: 'beatblender', name: 'Beat Blender', genre: 'Deep House', url: 'https://ice4.somafm.com/beatblender-128-aac', desc: 'A late night blend of steep beats and deep house' },
  { id: 'defcon', name: 'DEF CON Radio', genre: 'Electronic', url: 'https://ice5.somafm.com/defcon-128-aac', desc: 'Music for hacking. Dark EDM, industrial, and synthwave' },
  { id: 'thetrip', name: 'The Trip', genre: 'Progressive', url: 'https://ice4.somafm.com/thetrip-128-aac', desc: 'Progressive house and trance. Tip-top dance music' },

  // Ambient / Atmospheric
  { id: 'spacestation', name: 'Space Station Soma', genre: 'Ambient', url: 'https://ice5.somafm.com/spacestation-128-aac', desc: 'Tune in, turn on, space out. Ambient and mid-tempo' },
  { id: 'dronezone', name: 'Drone Zone', genre: 'Ambient', url: 'https://ice4.somafm.com/dronezone-128-aac', desc: 'Served best chilled, safe with most medications' },

  // Hip Hop / Soul / R&B
  { id: 'fluid', name: 'Fluid', genre: 'Hip Hop', url: 'https://ice4.somafm.com/fluid-128-aac', desc: 'Drown in the heavy beats and positive rhymes' },
  { id: '7soul', name: 'Seven Inch Soul', genre: 'Soul', url: 'https://ice4.somafm.com/7soul-128-aac', desc: 'Vintage soul tracks from the original 45 RPM vinyl' },

  // Rock / Indie / Retro
  { id: 'indiepop', name: 'Indie Pop Rocks!', genre: 'Indie', url: 'https://ice4.somafm.com/indiepop-128-aac', desc: 'New and classic indie pop and some sub-genres' },
  { id: 'u80s', name: 'Underground 80s', genre: '80s', url: 'https://ice4.somafm.com/u80s-128-aac', desc: 'Early 80s new wave, post-punk, and underground' },
  { id: 'seventies', name: 'Left Coast 70s', genre: 'Classic Rock', url: 'https://ice4.somafm.com/seventies-128-aac', desc: 'Mellow album rock from the Seventies. West coast vibes' },

  // Country / Folk
  { id: 'bootliquor', name: 'Boot Liquor', genre: 'Americana', url: 'https://ice4.somafm.com/bootliquor-128-aac', desc: 'Americana roots music for dusty backroads and campfires' },

  // Metal
  { id: 'metal', name: 'Metal Detector', genre: 'Metal', url: 'https://ice4.somafm.com/metal-128-aac', desc: 'From black to doom, heavy metal in all its forms' },
];

const audio = new Audio();
let currentStation = null;
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
        currentStation = null;
        localStorage.removeItem('radio_playing');
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
      artist: station.genre,
      album: station.desc,
    });
    navigator.mediaSession.setActionHandler('play', () => {
      if (currentStation) audio.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
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

  play(station) {
    if (currentStation?.id === station.id) {
      // Toggle off
      audio.pause();
      audio.src = '';
      currentStation = null;
      localStorage.removeItem('radio_playing');
      clearMediaSession();
      notifyListeners();
      return Promise.resolve();
    }

    audio.pause();
    audio.src = station.url;
    audio.volume = this.getVolume();

    return audio.play()
      .then(() => {
        currentStation = station;
        localStorage.setItem('radio_playing', JSON.stringify(station.id));
        addToRecent(station.id);
        updateMediaSession(station);
        notifyListeners();
      })
      .catch(() => {
        currentStation = null;
        localStorage.removeItem('radio_playing');
        notifyListeners();
        throw new Error('playback_failed');
      });
  },

  stop() {
    audio.pause();
    audio.src = '';
    currentStation = null;
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
