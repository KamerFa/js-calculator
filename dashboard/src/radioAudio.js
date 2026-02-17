// Global audio singleton - persists across component mounts/unmounts
// This ensures radio keeps playing when switching views

const STATIONS = [
  // Chill / Lounge
  { id: 'groovesalad', name: 'Groove Salad', genre: 'Chill', url: 'https://ice5.somafm.com/groovesalad-128-aac' },
  { id: 'lush', name: 'Lush', genre: 'Chill', url: 'https://ice4.somafm.com/lush-128-aac' },
  { id: 'secretagent', name: 'Secret Agent', genre: 'Lounge', url: 'https://ice4.somafm.com/secretagent-128-aac' },

  // Electronic / Dance
  { id: 'beatblender', name: 'Beat Blender', genre: 'Deep House', url: 'https://ice4.somafm.com/beatblender-128-aac' },
  { id: 'defcon', name: 'DEF CON Radio', genre: 'Electronic', url: 'https://ice5.somafm.com/defcon-128-aac' },
  { id: 'thetrip', name: 'The Trip', genre: 'Progressive', url: 'https://ice4.somafm.com/thetrip-128-aac' },

  // Ambient / Atmospheric
  { id: 'spacestation', name: 'Space Station Soma', genre: 'Ambient', url: 'https://ice5.somafm.com/spacestation-128-aac' },
  { id: 'dronezone', name: 'Drone Zone', genre: 'Ambient', url: 'https://ice4.somafm.com/dronezone-128-aac' },

  // Hip Hop / Soul / R&B
  { id: 'fluid', name: 'Fluid', genre: 'Hip Hop', url: 'https://ice4.somafm.com/fluid-128-aac' },
  { id: '7soul', name: 'Seven Inch Soul', genre: 'Soul', url: 'https://ice4.somafm.com/7soul-128-aac' },

  // Rock / Indie / Retro
  { id: 'indiepop', name: 'Indie Pop Rocks!', genre: 'Indie', url: 'https://ice4.somafm.com/indiepop-128-aac' },
  { id: 'u80s', name: 'Underground 80s', genre: '80s', url: 'https://ice4.somafm.com/u80s-128-aac' },
  { id: 'seventies', name: 'Left Coast 70s', genre: 'Classic Rock', url: 'https://ice4.somafm.com/seventies-128-aac' },

  // Country / Folk
  { id: 'bootliquor', name: 'Boot Liquor', genre: 'Americana', url: 'https://ice4.somafm.com/bootliquor-128-aac' },

  // Metal
  { id: 'metal', name: 'Metal Detector', genre: 'Metal', url: 'https://ice4.somafm.com/metal-128-aac' },
];

const audio = new Audio();
let currentStation = null;
let listeners = new Set();

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
      audio.play().catch(() => {
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
    notifyListeners();
  },

  setVolume(val) {
    const v = parseFloat(val);
    audio.volume = v;
    localStorage.setItem('radio_volume', v);
    notifyListeners();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export default radioAudio;
