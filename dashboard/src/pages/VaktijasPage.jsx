import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { getPrayerTimes, getNextPrayer, CITIES } from '../prayerTimes';

// vaktija.ba API location IDs (1-based, matching the official list)
const API_LOCATIONS = {
  'Banovići': 1, 'Banja Luka': 2, 'Bihać': 3, 'Bijeljina': 4, 'Bileća': 5,
  'Bosanski Brod': 6, 'Bosanska Dubica': 7, 'Bosanska Gradiška': 8,
  'Bosansko Grahovo': 9, 'Bosanska Krupa': 10, 'Bosanski Novi': 11,
  'Bosanski Petrovac': 12, 'Bosanski Šamac': 13, 'Bratunac': 14,
  'Brčko': 15, 'Breza': 16, 'Bugojno': 17, 'Busovača': 18, 'Bužim': 19,
  'Cazin': 20, 'Čajniče': 21, 'Čapljina': 22, 'Čelić': 23, 'Čelinac': 24,
  'Čitluk': 25, 'Derventa': 26, 'Doboj': 27, 'Donji Vakuf': 28, 'Drvar': 29,
  'Foča': 30, 'Fojnica': 31, 'Gacko': 32, 'Glamoč': 33, 'Goražde': 34,
  'Gornji Vakuf': 35, 'Gračanica': 36, 'Gradačac': 37, 'Grude': 38,
  'Hadžići': 39, 'Han-Pijesak': 40, 'Hlivno': 41, 'Ilijaš': 42,
  'Jablanica': 43, 'Jajce': 44, 'Kakanj': 45, 'Kalesija': 46,
  'Kalinovik': 47, 'Kiseljak': 48, 'Kladanj': 49, 'Ključ': 50,
  'Konjic': 51, 'Kotor-Varoš': 52, 'Kreševo': 53, 'Kupres': 54,
  'Laktaši': 55, 'Lopare': 56, 'Lukavac': 57, 'Ljubinje': 58,
  'Ljubuški': 59, 'Maglaj': 60, 'Modriča': 61, 'Mostar': 62,
  'Mrkonjić-Grad': 63, 'Neum': 64, 'Nevesinje': 65, 'Novi Travnik': 66,
  'Odžak': 67, 'Olovo': 68, 'Orašje': 69, 'Pale': 70, 'Posušje': 71,
  'Prijedor': 72, 'Prnjavor': 73, 'Prozor': 74, 'Rogatica': 75,
  'Rudo': 76, 'Sanski Most': 77, 'Sarajevo': 78, 'Skender-Vakuf': 79,
  'Sokolac': 80, 'Srbac': 81, 'Srebrenica': 82, 'Srebrenik': 83,
  'Stolac': 84, 'Šekovići': 85, 'Šipovo': 86, 'Široki Brijeg': 87,
  'Teslić': 88, 'Tešanj': 89, 'Tomislav-Grad': 90, 'Travnik': 91,
  'Trebinje': 92, 'Trnovo': 93, 'Tuzla': 94, 'Ugljevik': 95,
  'Vareš': 96, 'Velika Kladuša': 97, 'Visoko': 98, 'Višegrad': 99,
  'Vitez': 100, 'Vlasenica': 101, 'Zavidovići': 102, 'Zenica': 103,
  'Zvornik': 104, 'Žepa': 105, 'Žepče': 106, 'Živinice': 107,
  'Bijelo Polje': 108, 'Gusinje': 109, 'Nova Varoš': 110, 'Novi Pazar': 111,
  'Plav': 112, 'Pljevlja': 113, 'Priboj': 114, 'Prijepolje': 115,
  'Rožaje': 116, 'Sjenica': 117, 'Tutin': 118,
};

const PRAYER_META = [
  { key: 'fajr',    icon: '🌙', css: 'fajr',    label: 'Zora',    desc: 'Sabah namaz' },
  { key: 'sunrise', icon: '🌅', css: 'sunrise',  label: 'Izlazak', desc: 'Izlazak sunca' },
  { key: 'dhuhr',   icon: '☀️', css: 'dhuhr',    label: 'Podne',   desc: 'Podne namaz' },
  { key: 'asr',     icon: '🌤️', css: 'asr',      label: 'Ikindija',desc: 'Ikindija namaz' },
  { key: 'maghrib', icon: '🌇', css: 'maghrib',  label: 'Akšam',   desc: 'Akšam namaz' },
  { key: 'isha',    icon: '🌃', css: 'isha',     label: 'Jacija',  desc: 'Jacija namaz' },
];

// Popular cities to show at top of the dropdown
const POPULAR = ['Sarajevo', 'Tuzla', 'Zenica', 'Mostar', 'Banja Luka', 'Travnik', 'Bihać', 'Goražde', 'Brčko', 'Livno'];

export default function VaktijasPage() {
  const { t } = useTranslation();
  const [location, setLocation] = useState(() => localStorage.getItem('vaktija-city') || 'Sarajevo');
  const [times, setTimes] = useState(null);
  const [nextPrayer, setNextPrayerState] = useState(null);
  const [now, setNow] = useState(new Date());
  const [source, setSource] = useState(null); // 'api' or 'local'
  const timerRef = useRef(null);

  // Save location preference
  useEffect(() => {
    localStorage.setItem('vaktija-city', location);
  }, [location]);

  // Fetch from vaktija.ba API, fall back to local calculation
  const loadTimes = useCallback(async (city) => {
    const today = new Date();
    const apiId = API_LOCATIONS[city];

    // Try vaktija.ba API first
    if (apiId !== undefined) {
      try {
        const res = await fetch(`https://api.vaktija.ba/vaktija/v1/${apiId}`);
        if (res.ok) {
          const data = await res.json();
          // API returns vakat as array: [fajr, sunrise, dhuhr, asr, maghrib, isha]
          if (data.vakat && data.vakat.length === 6) {
            setTimes({
              fajr:    data.vakat[0],
              sunrise: data.vakat[1],
              dhuhr:   data.vakat[2],
              asr:     data.vakat[3],
              maghrib: data.vakat[4],
              isha:    data.vakat[5],
            });
            setSource('api');
            return;
          }
        }
      } catch {
        // CORS or network error — fall through to local calculation
      }
    }

    // Fallback: local astronomical calculation
    const localTimes = getPrayerTimes(today, city);
    if (localTimes) {
      setTimes(localTimes);
      setSource('local');
    }
  }, []);

  useEffect(() => {
    loadTimes(location);
  }, [location, loadTimes]);

  // Update countdown every second
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNow(n);
      const np = getNextPrayer(n, location);
      setNextPrayerState(np);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [location]);

  // Determine which prayer is currently active (the one that has passed most recently)
  const getActivePrayerKey = () => {
    if (!times) return null;
    const currentStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    let active = null;
    for (const p of PRAYER_META) {
      if (times[p.key] <= currentStr) active = p.key;
    }
    return active;
  };

  const activePrayer = getActivePrayerKey();

  // Format countdown
  const formatCountdown = () => {
    if (!nextPrayer) return '';
    const h = nextPrayer.remainingHours;
    const m = nextPrayer.remainingMinutes;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Get Bosnian date
  const bosnianDate = now.toLocaleDateString('bs-BA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Current time display
  const currentTime = now.toLocaleTimeString('bs-BA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // All location names sorted
  const allLocations = Object.keys(API_LOCATIONS).sort((a, b) => a.localeCompare(b, 'bs'));
  const popularSet = new Set(POPULAR);

  // Progress through the day (0-1)
  const dayProgress = () => {
    if (!times) return 0;
    const parseTime = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const fajrMin = parseTime(times.fajr);
    const ishaMin = parseTime(times.isha);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < fajrMin) return 0;
    if (nowMin > ishaMin) return 1;
    return (nowMin - fajrMin) / (ishaMin - fajrMin);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🕌 Vaktija</h1>
        <p className="page-subtitle">{bosnianDate}</p>
      </div>

      <div className="vaktijas-container">
        {/* Hero: Next Prayer Countdown */}
        {nextPrayer && (
          <div className="vaktija-hero">
            <div className="vaktija-hero-left">
              <div className="vaktija-hero-label">
                {nextPrayer.tomorrow ? 'Sljedeći vakat (sutra)' : 'Sljedeći vakat'}
              </div>
              <div className="vaktija-hero-name">
                {PRAYER_META.find(p => p.key === nextPrayer.key)?.label || nextPrayer.name}
              </div>
              <div className="vaktija-hero-time">
                {nextPrayer.formatted}
              </div>
            </div>
            <div className="vaktija-hero-right">
              <div className="vaktija-countdown">
                <div className="vaktija-countdown-value">{formatCountdown()}</div>
                <div className="vaktija-countdown-label">preostalo</div>
              </div>
            </div>
          </div>
        )}

        {/* Location + Clock Row */}
        <div className="vaktija-controls">
          <div className="location-selector">
            <label htmlFor="location-select">📍</label>
            <select
              id="location-select"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="location-select"
            >
              <optgroup label="Popularni gradovi">
                {POPULAR.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </optgroup>
              <optgroup label="Svi gradovi">
                {allLocations.filter(l => !popularSet.has(l)).map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="vaktija-clock">
            {currentTime}
          </div>
        </div>

        {/* Day Progress Bar */}
        {times && (
          <div className="vaktija-progress-wrap">
            <div className="vaktija-progress-bar">
              <div className="vaktija-progress-fill" style={{ width: `${dayProgress() * 100}%` }} />
            </div>
            <div className="vaktija-progress-labels">
              <span>{times.fajr}</span>
              <span>{times.isha}</span>
            </div>
          </div>
        )}

        {/* Prayer Times Grid */}
        {times && (
          <div className="vaktijas-grid">
            {PRAYER_META.map((p) => (
              <div
                key={p.key}
                className={`vakat-card ${p.css}${activePrayer === p.key ? ' vakat-active' : ''}${nextPrayer?.key === p.key ? ' vakat-next' : ''}`}
              >
                <div className="vakat-icon">{p.icon}</div>
                <div className="vakat-info">
                  <h3>{p.label}</h3>
                  <p className="vakat-time">{times[p.key]}</p>
                  <p className="vakat-desc">{p.desc}</p>
                </div>
                {nextPrayer?.key === p.key && (
                  <div className="vakat-badge">Sljedeći</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Source indicator */}
        {source && (
          <div className="vaktija-source">
            {source === 'api'
              ? '📡 Izvor: api.vaktija.ba'
              : '📐 Izvor: lokalni proračun'}
          </div>
        )}
      </div>
    </div>
  );
}
