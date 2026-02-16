// Global audio singleton - persists across component mounts/unmounts
// This ensures radio keeps playing when switching views

const STATIONS = [
  // Regional
  { id: 'naxi', name: 'Naxi Radio', genre: 'Pop', region: 'Beograd', url: 'http://naxi128.streaming.rs:9150/;' },
  { id: 'naxi-house', name: 'Naxi House', genre: 'House', region: 'Beograd', url: 'http://naxidigital-128.streaming.rs:8000/;' },
  { id: 'naxi-dance', name: 'Naxi Dance', genre: 'Dance', region: 'Beograd', url: 'http://naxidigital-128.streaming.rs:8110/;' },
  { id: 'naxi-clubbing', name: 'Naxi Clubbing', genre: 'Club', region: 'Beograd', url: 'http://naxidigital-128.streaming.rs:8090/;' },

  // Islamic Radio
  { id: 'islamic1', name: 'Radio El-Kelimeh', genre: 'Islamic', region: 'Sarajevo', url: 'http://185.47.65.85:8002/;' },
  { id: 'islamic2', name: 'Quran Radio', genre: 'Islamic', region: 'Internet', url: 'http://quraan.us:9996/;' },
  { id: 'islamic3', name: 'Radio Nur', genre: 'Islamic', region: 'BiH', url: 'http://stream.radionur.ba:8000/radionur' },

  // House / Electronic
  { id: 'beatblender', name: 'SomaFM - Beat Blender', genre: 'Deep House', region: 'Internet', url: 'https://ice4.somafm.com/beatblender-128-aac' },
  { id: 'groovesalad', name: 'SomaFM - Groove Salad', genre: 'Downtempo', region: 'Internet', url: 'https://ice5.somafm.com/groovesalad-128-aac' },
  { id: 'spacestation', name: 'SomaFM - Space Station', genre: 'Ambient', region: 'Internet', url: 'https://ice5.somafm.com/spacestation-128-aac' },
  { id: 'defcon', name: 'SomaFM - DEF CON', genre: 'Electronic', region: 'Internet', url: 'https://ice5.somafm.com/defcon-128-aac' },
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
