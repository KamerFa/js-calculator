import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import {
  IconCalendar,
} from '../components/Icons';

export default function VaktijasPage() {
  const { t } = useTranslation();
  const [vaktijas, setVaktijas] = useState(null);
  const [location, setLocation] = useState('Sarajevo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVaktijas();
  }, [location]);

  const fetchVaktijas = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.vaktija.ba/vaktija/v1/${location}`
      );
      if (!response.ok) throw new Error('Failed to fetch vaktijas');
      const data = await response.json();
      setVaktijas(data);
    } catch (err) {
      setError(err.message);
      // Mock data for demo
      setVaktijas({
        location: location,
        date: new Date().toLocaleDateString(),
        vakat: {
          fajr: '05:45',
          sunrise: '07:12',
          dhuhr: '12:32',
          asr: '15:42',
          maghrib: '17:52',
          isha: '19:19',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const locations = ['Sarajevo', 'Tuzla', 'Zenica', 'Mostar', 'Banja Luka'];

  if (loading && !vaktijas) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>{t('vaktijas', 'Vaktijas')}</h1>
        </div>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{t('loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{t('vaktijas', 'Vaktijas')}</h1>
        <p className="page-subtitle">
          {t('prayerTimes', 'Daily prayer times')}
        </p>
      </div>

      <div className="vaktijas-container">
        {/* Location Selector */}
        <div className="location-selector">
          <label htmlFor="location-select">
            📍
            {t('location', 'Location')}
          </label>
          <select
            id="location-select"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="location-select"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="info-box warning">
            <p>{t('loadError', 'Could not load prayer times')}</p>
          </div>
        )}

        {vaktijas && (
          <>
            {/* Date Info */}
            <div className="date-info">
              <IconCalendar size={16} />
              <span>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            {/* Prayer Times Grid */}
            <div className="vaktijas-grid">
              <div className="vakat-card fajr">
                <div className="vakat-icon">
                  <div className="icon-moon">🌙</div>
                </div>
                <div className="vakat-info">
                  <h3>{t('fajr', 'Fajr')}</h3>
                  <p className="vakat-time">{vaktijas.vakat?.fajr}</p>
                  <p className="vakat-desc">
                    {t('beforeSunrise', 'Before sunrise')}
                  </p>
                </div>
              </div>

              <div className="vakat-card sunrise">
                <div className="vakat-icon">
                  <div className="icon-sunrise">🌅</div>
                </div>
                <div className="vakat-info">
                  <h3>{t('sunrise', 'Sunrise')}</h3>
                  <p className="vakat-time">{vaktijas.vakat?.sunrise}</p>
                  <p className="vakat-desc">{t('sunriseTime', 'Sunrise')}</p>
                </div>
              </div>

              <div className="vakat-card dhuhr">
                <div className="vakat-icon">
                  <div className="icon-sun">☀️</div>
                </div>
                <div className="vakat-info">
                  <h3>{t('dhuhr', 'Dhuhr')}</h3>
                  <p className="vakat-time">{vaktijas.vakat?.dhuhr}</p>
                  <p className="vakat-desc">
                    {t('midday', 'Midday prayer')}
                  </p>
                </div>
              </div>

              <div className="vakat-card asr">
                <div className="vakat-icon">
                  <div className="icon-afternoon">🌤️</div>
                </div>
                <div className="vakat-info">
                  <h3>{t('asr', 'Asr')}</h3>
                  <p className="vakat-time">{vaktijas.vakat?.asr}</p>
                  <p className="vakat-desc">
                    {t('afternoon', 'Afternoon prayer')}
                  </p>
                </div>
              </div>

              <div className="vakat-card maghrib">
                <div className="vakat-icon">
                  <div className="icon-sunset">🌇</div>
                </div>
                <div className="vakat-info">
                  <h3>{t('maghrib', 'Maghrib')}</h3>
                  <p className="vakat-time">{vaktijas.vakat?.maghrib}</p>
                  <p className="vakat-desc">
                    {t('sunset', 'Sunset prayer')}
                  </p>
                </div>
              </div>

              <div className="vakat-card isha">
                <div className="vakat-icon">
                  <div className="icon-night">🌃</div>
                </div>
                <div className="vakat-info">
                  <h3>{t('isha', 'Isha')}</h3>
                  <p className="vakat-time">{vaktijas.vakat?.isha}</p>
                  <p className="vakat-desc">
                    {t('nightPrayer', 'Night prayer')}
                  </p>
                </div>
              </div>
            </div>

            {/* Upcoming Prayer */}
            <div className="upcoming-prayer">
              <h3>{t('nextPrayer', 'Next Prayer')}</h3>
              <div className="upcoming-card">
                <div style={{ fontSize: '24px' }}>⏰</div>
                <div>
                  <p className="prayer-name">Dhuhr</p>
                  <p className="prayer-time">
                    in 45 minutes at {vaktijas.vakat?.dhuhr}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
