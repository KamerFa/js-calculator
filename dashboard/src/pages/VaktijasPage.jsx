import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { getPrayerTimes, getNextPrayer, CITIES } from '../prayerTimes';

// vaktija.ba API location IDs
const API_LOCATIONS = {
  'Banovići': 0, 'Banja Luka': 1, 'Bihać': 2, 'Bijeljina': 3, 'Bileća': 4,
  'Bosanski Brod': 5, 'Bosanska Dubica': 6, 'Bosanska Gradiška': 7,
  'Bosansko Grahovo': 8, 'Bosanska Krupa': 9, 'Bosanski Novi': 10,
  'Bosanski Petrovac': 11, 'Bosanski Šamac': 12, 'Bratunac': 13,
  'Brčko': 14, 'Breza': 15, 'Bugojno': 16, 'Busovača': 17, 'Bužim': 18,
  'Cazin': 19, 'Čajniče': 20, 'Čapljina': 21, 'Čelić': 22, 'Čelinac': 23,
  'Čitluk': 24, 'Derventa': 25, 'Doboj': 26, 'Donji Vakuf': 27, 'Drvar': 28,
  'Foča': 29, 'Fojnica': 30, 'Gacko': 31, 'Glamoč': 32, 'Goražde': 33,
  'Gornji Vakuf': 34, 'Gračanica': 35, 'Gradačac': 36, 'Grude': 37,
  'Hadžići': 38, 'Han-Pijesak': 39, 'Hlivno': 40, 'Ilijaš': 41,
  'Jablanica': 42, 'Jajce': 43, 'Kakanj': 44, 'Kalesija': 45,
  'Kalinovik': 46, 'Kiseljak': 47, 'Kladanj': 48, 'Ključ': 49,
  'Konjic': 50, 'Kotor-Varoš': 51, 'Kreševo': 52, 'Kupres': 53,
  'Laktaši': 54, 'Lopare': 55, 'Lukavac': 56, 'Ljubinje': 57,
  'Ljubuški': 58, 'Maglaj': 59, 'Modriča': 60, 'Mostar': 61,
  'Mrkonjić-Grad': 62, 'Neum': 63, 'Nevesinje': 64, 'Novi Travnik': 65,
  'Odžak': 66, 'Olovo': 67, 'Orašje': 68, 'Pale': 69, 'Posušje': 70,
  'Prijedor': 71, 'Prnjavor': 72, 'Prozor': 73, 'Rogatica': 74,
  'Rudo': 75, 'Sanski Most': 76, 'Sarajevo': 77, 'Skender-Vakuf': 78,
  'Sokolac': 79, 'Srbac': 80, 'Srebrenica': 81, 'Srebrenik': 82,
  'Stolac': 83, 'Šekovići': 84, 'Šipovo': 85, 'Široki Brijeg': 86,
  'Teslić': 87, 'Tešanj': 88, 'Tomislav-Grad': 89, 'Travnik': 90,
  'Trebinje': 91, 'Trnovo': 92, 'Tuzla': 93, 'Ugljevik': 94,
  'Vareš': 95, 'Velika Kladuša': 96, 'Visoko': 97, 'Višegrad': 98,
  'Vitez': 99, 'Vlasenica': 100, 'Zavidovići': 101, 'Zenica': 102,
  'Zvornik': 103, 'Žepa': 104, 'Žepče': 105, 'Živinice': 106,
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
