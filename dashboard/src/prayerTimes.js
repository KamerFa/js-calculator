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

// IZ BiH method: Fajr 18°, Isha 18°
const FAJR_ANGLE = 18;
const ISHA_ANGLE = 18;
const ASR_FACTOR = 1; // Standard (Shafi'i)

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// Trig helpers that work in degrees
function dsin(d) { return Math.sin(d * D2R); }
function dcos(d) { return Math.cos(d * D2R); }
function dtan(d) { return Math.tan(d * D2R); }
function dasin(x) { return Math.asin(x) * R2D; }
function dacos(x) { return Math.acos(Math.max(-1, Math.min(1, x))) * R2D; }
function datan2(y, x) { return Math.atan2(y, x) * R2D; }

function fixAngle(a) { a = a % 360; return a < 0 ? a + 360 : a; }
function fixHour(h) { h = h % 24; return h < 0 ? h + 24 : h; }

/**
 * Julian date from a JS Date (at noon)
 */
function julianDate(year, month, day) {
  if (month <= 2) { year--; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

/**
 * Sun position: declination (degrees) and equation of time (minutes)
 */
function sunPosition(jd) {
  const T = (jd - 2451545.0) / 36525; // Julian centuries from J2000

  // Mean elements
  const L0 = fixAngle(280.46646 + 36000.76983 * T + 0.0003032 * T * T); // mean longitude
  const M = fixAngle(357.52911 + 35999.05029 * T - 0.0001537 * T * T);  // mean anomaly
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;       // eccentricity

  // Equation of center
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * dsin(M)
          + (0.019993 - 0.000101 * T) * dsin(2 * M)
          + 0.000289 * dsin(3 * M);

  const sunLng = L0 + C; // sun true longitude
  const omega = 125.04 - 1934.136 * T;
  const appLng = sunLng - 0.00569 - 0.00478 * dsin(omega); // apparent longitude

  // Obliquity of the ecliptic
  const eps0 = 23.0 + (26.0 + (21.448 - 46.815 * T) / 60) / 60;
  const eps = eps0 + 0.00256 * dcos(omega); // corrected obliquity

  // Declination
  const declination = dasin(dsin(eps) * dsin(appLng));

  // Equation of time (in minutes)
  const y = dtan(eps / 2) * dtan(eps / 2);
  const eqTime = 4 * R2D * (
    y * dsin(2 * L0)
    - 2 * e * dsin(M)
    + 4 * e * y * dsin(M) * dcos(2 * L0)
    - 0.5 * y * y * dsin(4 * L0)
    - 1.25 * e * e * dsin(2 * M)
  );

  return { declination, eqTime };
}

/**
 * Compute the hour angle (in hours) for when the sun is at a given
 * elevation angle, at the given latitude and declination.
 */
function hourAngle(elevationAngle, lat, decl) {
  const cosHA = (dsin(elevationAngle) - dsin(lat) * dsin(decl))
              / (dcos(lat) * dcos(decl));
  return dacos(cosHA) / 15; // convert degrees to hours
}

/**
 * Convert decimal hours to HH:MM string
 */
function formatTime(hours) {
  if (isNaN(hours) || hours === null) return '--:--';
  hours = fixHour(hours);
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 60) return `${String(h + 1).padStart(2, '0')}:00`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculate all prayer times for a given date and city.
 * Returns decimal hours in local time.
 */
export function calculatePrayerTimes(date, cityName) {
  const city = CITIES[cityName];
  if (!city) return null;

  const { lat, lng, alt } = city;
  const tz = -date.getTimezoneOffset() / 60;
  const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { declination, eqTime } = sunPosition(jd);

  // Dhuhr = 12:00 - EqTime/60 - lng/15 + tz
  const dhuhr = fixHour(12 - eqTime / 60 - lng / 15 + tz);

  // Sunrise/sunset angle adjusted for elevation
  // Standard refraction = 0.833°, altitude adjustment = 0.0347 * sqrt(alt)
  const sunRiseSetAngle = -(0.833 + 0.0347 * Math.sqrt(alt));

  // Hour angles (in hours)
  const fajrHA    = hourAngle(-FAJR_ANGLE, lat, declination);
  const sunriseHA = hourAngle(sunRiseSetAngle, lat, declination);
  const sunsetHA  = hourAngle(sunRiseSetAngle, lat, declination);
  const ishaHA    = hourAngle(-ISHA_ANGLE, lat, declination);

  // Asr: shadow length = factor * object + noon shadow
  // noon shadow = tan(|lat - decl|)
  // elevation angle = acot(factor + tan(|lat - decl|)) = atan(1 / (factor + tan(|lat - decl|)))
  const asrElevation = R2D * Math.atan(1 / (ASR_FACTOR + dtan(Math.abs(lat - declination))));
  const asrHA = hourAngle(asrElevation, lat, declination);

  return {
    fajr:    fixHour(dhuhr - fajrHA),
    sunrise: fixHour(dhuhr - sunriseHA),
    dhuhr:   dhuhr,
    asr:     fixHour(dhuhr + asrHA),
    maghrib: fixHour(dhuhr + sunsetHA),
    isha:    fixHour(dhuhr + ishaHA),
  };
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
