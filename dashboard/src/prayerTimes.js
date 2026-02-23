/**
 * Prayer time calculator using astronomical formulas.
 * Based on the standard algorithm from praytimes.org
 * Uses the method of the Islamic Community of Bosnia and Herzegovina (IZ BiH).
 */

const CITIES = {
  Sarajevo:    { lat: 43.8563, lng: 18.4131, alt: 630 },
  Tuzla:       { lat: 44.5384, lng: 18.6739, alt: 237 },
  Zenica:      { lat: 44.2037, lng: 17.9078, alt: 327 },
  Mostar:      { lat: 43.3438, lng: 17.8078, alt: 64 },
  'Banja Luka':{ lat: 44.7722, lng: 17.1910, alt: 163 },
  Travnik:     { lat: 44.2267, lng: 17.6658, alt: 540 },
  'Bihać':     { lat: 44.8169, lng: 15.8697, alt: 243 },
  'Goražde':   { lat: 43.6670, lng: 18.9753, alt: 345 },
  Livno:       { lat: 43.8270, lng: 17.0075, alt: 724 },
  'Brčko':     { lat: 44.8725, lng: 18.8097, alt: 95 },
};

// IZ BiH method angles
const FAJR_ANGLE = 18;
const ISHA_ANGLE = 18;
const ASR_FACTOR = 1; // Standard (Shafi'i). Use 2 for Hanafi.

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function sin(d) { return Math.sin(d * DEG); }
function cos(d) { return Math.cos(d * DEG); }
function tan(d) { return Math.tan(d * DEG); }
function asin(x) { return Math.asin(x) * RAD; }
function acos(x) { return Math.acos(Math.max(-1, Math.min(1, x))) * RAD; }
function atan2(y, x) { return Math.atan2(y, x) * RAD; }

/**
 * Julian date from a JS Date
 */
function julianDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  let jy = y, jm = m;
  if (m <= 2) { jy--; jm += 12; }
  const A = Math.floor(jy / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (jy + 4716)) + Math.floor(30.6001 * (jm + 1)) + d + B - 1524.5;
}

/**
 * Sun position: declination and equation of time
 */
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = (357.529 + 0.98560028 * D) % 360;
  const q = (280.459 + 0.98564736 * D) % 360;
  const L = (q + 1.915 * sin(g) + 0.020 * sin(2 * g)) % 360;
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
  const decl = asin(sin(e) * sin(L));
  const eqt = q / 15 - RA + (D > 0 ? 0 : 24);
  return { declination: decl, equation: fixHour(eqt) };
}

function fixHour(h) {
  h = h % 24;
  return h < 0 ? h + 24 : h;
}

/**
 * Compute the time (in hours) when the sun reaches a given angle below horizon
 */
function sunAngleTime(angle, declination, lat, direction) {
  const cosHA = (sin(angle) - sin(lat) * sin(declination)) / (cos(lat) * cos(declination));
  if (cosHA > 1 || cosHA < -1) return NaN; // sun doesn't reach this angle
  const HA = acos(cosHA) / 15;
  return direction === 'ccw' ? 12 - HA : 12 + HA;
}

/**
 * Asr time: when shadow = factor * object + noon shadow
 */
function asrTime(factor, declination, lat) {
  const delta = acos(sin(Math.atan(1 / (factor + tan(Math.abs(lat - declination)))) * RAD * DEG));
  return delta / 15;
}

/**
 * Convert decimal hours to HH:MM string
 */
function formatTime(hours) {
  if (isNaN(hours)) return '--:--';
  hours = fixHour(hours);
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 60) return `${String(h + 1).padStart(2, '0')}:00`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Get timezone offset in hours for a given date
 */
function getTimezoneOffset(date) {
  return -date.getTimezoneOffset() / 60;
}

/**
 * Calculate all prayer times for a given date and city
 */
export function calculatePrayerTimes(date, cityName) {
  const city = CITIES[cityName];
  if (!city) return null;

  const { lat, lng, alt } = city;
  const jd = julianDate(date);
  const tz = getTimezoneOffset(date);

  const { declination, equation } = sunPosition(jd);

  // Dhuhr: sun at meridian
  const dhuhr = fixHour(12 + (tz - lng / 15) - equation);

  // Sunrise / Sunset angle adjusted for altitude
  const sunAngle = 0.833 + 0.0347 * Math.sqrt(alt);

  const fajr = dhuhr - sunAngleTime(FAJR_ANGLE, declination, lat, 'ccw') + sunAngleTime(FAJR_ANGLE, declination, lat, 'ccw') - sunAngleTime(FAJR_ANGLE, declination, lat, 'ccw');
  // Simplify: compute hour angles directly

  const fajrHA = sunAngleTime(-FAJR_ANGLE, declination, lat, 'ccw');
  const sunriseHA = sunAngleTime(-sunAngle, declination, lat, 'ccw');
  const sunsetHA = sunAngleTime(-sunAngle, declination, lat, 'cw');
  const ishaHA = sunAngleTime(-ISHA_ANGLE, declination, lat, 'cw');

  // Asr: shadow = factor * object + noon shadow
  const asrAngle = acos(sin(Math.atan(1 / (ASR_FACTOR + tan(Math.abs(lat - declination)))) * RAD * DEG));
  const asrHA = asrAngle / 15;

  const base = 12 + (tz - lng / 15) - equation;

  const times = {
    fajr:    fixHour(base - fajrHA),
    sunrise: fixHour(base - sunriseHA),
    dhuhr:   fixHour(base),
    asr:     fixHour(base + asrHA),
    maghrib: fixHour(base + sunsetHA),
    isha:    fixHour(base + ishaHA),
  };

  return times;
}

/**
 * Get formatted prayer times as strings
 */
export function getPrayerTimes(date, cityName) {
  const times = calculatePrayerTimes(date, cityName);
  if (!times) return null;

  return {
    fajr:    formatTime(times.fajr),
    sunrise: formatTime(times.sunrise),
    dhuhr:   formatTime(times.dhuhr),
    asr:     formatTime(times.asr),
    maghrib: formatTime(times.maghrib),
    isha:    formatTime(times.isha),
  };
}

/**
 * Get raw decimal hours for countdown calculations
 */
export function getPrayerTimesRaw(date, cityName) {
  return calculatePrayerTimes(date, cityName);
}

/**
 * Find the next prayer from the current time
 */
export function getNextPrayer(date, cityName) {
  const times = calculatePrayerTimes(date, cityName);
  if (!times) return null;

  const currentHours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  const prayers = [
    { name: 'Fajr', key: 'fajr', time: times.fajr },
    { name: 'Sunrise', key: 'sunrise', time: times.sunrise },
    { name: 'Dhuhr', key: 'dhuhr', time: times.dhuhr },
    { name: 'Asr', key: 'asr', time: times.asr },
    { name: 'Maghrib', key: 'maghrib', time: times.maghrib },
    { name: 'Isha', key: 'isha', time: times.isha },
  ];

  for (const p of prayers) {
    if (p.time > currentHours) {
      const diff = p.time - currentHours;
      const hours = Math.floor(diff);
      const minutes = Math.floor((diff - hours) * 60);
      return {
        ...p,
        formatted: formatTime(p.time),
        remainingHours: hours,
        remainingMinutes: minutes,
        remainingTotal: diff,
      };
    }
  }

  // All prayers passed — next is Fajr tomorrow
  const tomorrowTimes = calculatePrayerTimes(
    new Date(date.getTime() + 86400000),
    cityName
  );
  if (!tomorrowTimes) return null;
  const diff = (24 - currentHours) + tomorrowTimes.fajr;
  const hours = Math.floor(diff);
  const minutes = Math.floor((diff - hours) * 60);
  return {
    name: 'Fajr',
    key: 'fajr',
    time: tomorrowTimes.fajr,
    formatted: formatTime(tomorrowTimes.fajr),
    remainingHours: hours,
    remainingMinutes: minutes,
    remainingTotal: diff,
    tomorrow: true,
  };
}

export { CITIES };
