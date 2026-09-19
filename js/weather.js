// Weather Module: Open-Meteo public API integration with WMO code mapping, reverse geocoding, and weather mood system
import { storage } from "./storage.js";

// WMO Weather Interpretation Codes (WW)
export const WMO_WEATHER_CODES = {
  0: { label: "Clear Sky", icon: "sun", nightIcon: "moon", category: "clear" },
  1: { label: "Mainly Clear", icon: "sun", nightIcon: "moon", category: "clear" },
  2: { label: "Partly Cloudy", icon: "cloud-sun", nightIcon: "cloud-moon", category: "clouds" },
  3: { label: "Overcast", icon: "cloud", nightIcon: "cloud", category: "clouds" },
  45: { label: "Foggy", icon: "fog", nightIcon: "fog", category: "fog" },
  48: { label: "Depositing Rime Fog", icon: "fog", nightIcon: "fog", category: "fog" },
  51: { label: "Light Drizzle", icon: "rain-drizzle", nightIcon: "rain-drizzle", category: "rain" },
  53: { label: "Moderate Drizzle", icon: "rain-drizzle", nightIcon: "rain-drizzle", category: "rain" },
  55: { label: "Dense Drizzle", icon: "rain-drizzle", nightIcon: "rain-drizzle", category: "rain" },
  56: { label: "Light Freezing Drizzle", icon: "rain-drizzle", nightIcon: "rain-drizzle", category: "rain" },
  57: { label: "Dense Freezing Drizzle", icon: "rain-drizzle", nightIcon: "rain-drizzle", category: "rain" },
  61: { label: "Slight Rain", icon: "rain", nightIcon: "rain", category: "rain" },
  63: { label: "Moderate Rain", icon: "rain", nightIcon: "rain", category: "rain" },
  65: { label: "Heavy Rain", icon: "rain-heavy", nightIcon: "rain-heavy", category: "rain" },
  66: { label: "Light Freezing Rain", icon: "rain", nightIcon: "rain", category: "rain" },
  67: { label: "Heavy Freezing Rain", icon: "rain-heavy", nightIcon: "rain-heavy", category: "rain" },
  71: { label: "Slight Snow Fall", icon: "snow", nightIcon: "snow", category: "snow" },
  73: { label: "Moderate Snow Fall", icon: "snow", nightIcon: "snow", category: "snow" },
  75: { label: "Heavy Snow Fall", icon: "snow", nightIcon: "snow", category: "snow" },
  77: { label: "Snow Grains", icon: "snow", nightIcon: "snow", category: "snow" },
  80: { label: "Slight Rain Showers", icon: "rain", nightIcon: "rain", category: "rain" },
  81: { label: "Moderate Rain Showers", icon: "rain", nightIcon: "rain", category: "rain" },
  82: { label: "Violent Rain Showers", icon: "rain-heavy", nightIcon: "rain-heavy", category: "rain" },
  85: { label: "Slight Snow Showers", icon: "snow", nightIcon: "snow", category: "snow" },
  86: { label: "Heavy Snow Showers", icon: "snow", nightIcon: "snow", category: "snow" },
  95: { label: "Thunderstorm", icon: "thunder", nightIcon: "thunder", category: "thunder" },
  96: { label: "Thunderstorm with Slight Hail", icon: "thunder", nightIcon: "thunder", category: "thunder" },
  99: { label: "Thunderstorm with Heavy Hail", icon: "thunder", nightIcon: "thunder", category: "thunder" }
};

// Weather SVG Icons Generator matching the app design system
export function getWeatherIconSvg(iconName, isDay = true, size = 22) {
  const strokeColor = "currentColor";
  const strokeWidth = "2";

  switch (iconName) {
    case "sun":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffb300" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5" fill="rgba(255,179,0,0.2)"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>`;

    case "moon":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#90caf9" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="rgba(144,202,249,0.15)"></path>
        <circle cx="19" cy="5" r="1" fill="#90caf9"></circle>
      </svg>`;

    case "cloud-sun":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41" stroke="#ffb300"></path>
        <path d="M15.5 12a3.5 3.5 0 0 0-3.5-3.5" stroke="#ffb300"></path>
        <path d="M17.5 19H9a5 5 0 0 1-.2-9.98 6.5 6.5 0 0 1 12.4 2.98A4 4 0 0 1 17.5 19z" fill="rgba(255,255,255,0.06)"></path>
      </svg>`;

    case "cloud-moon":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 3a5 5 0 0 0 6 6" stroke="#90caf9"></path>
        <path d="M17.5 19H9a5 5 0 0 1-.2-9.98 6.5 6.5 0 0 1 12.4 2.98A4 4 0 0 1 17.5 19z" fill="rgba(144,202,249,0.1)"></path>
      </svg>`;

    case "cloud":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="rgba(255,255,255,0.08)"></path>
      </svg>`;

    case "rain-drizzle":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#29b6f6" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" stroke="${strokeColor}"></path>
        <line x1="8" y1="19" x2="8" y2="21"></line>
        <line x1="12" y1="18" x2="12" y2="20"></line>
        <line x1="16" y1="19" x2="16" y2="21"></line>
      </svg>`;

    case "rain":
    case "rain-heavy":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#00b0ff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 13a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.8A4 4 0 0 0 4 13" stroke="${strokeColor}"></path>
        <line x1="8" y1="16" x2="6" y2="21"></line>
        <line x1="12" y1="16" x2="10" y2="21"></line>
        <line x1="16" y1="16" x2="14" y2="21"></line>
      </svg>`;

    case "thunder":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffd600" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" stroke="${strokeColor}"></path>
        <polyline points="13 11 9 17 15 17 11 23" fill="rgba(255,214,0,0.2)"></polyline>
      </svg>`;

    case "snow":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#b3e5fc" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" stroke="${strokeColor}"></path>
        <circle cx="8" cy="19" r="1" fill="#b3e5fc"></circle>
        <circle cx="12" cy="20" r="1" fill="#b3e5fc"></circle>
        <circle cx="16" cy="19" r="1" fill="#b3e5fc"></circle>
      </svg>`;

    case "fog":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <line x1="4" y1="8" x2="20" y2="8"></line>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="6" y1="16" x2="18" y2="16"></line>
        <line x1="8" y1="20" x2="16" y2="20"></line>
      </svg>`;

    default:
      return isDay ? getWeatherIconSvg("sun", true, size) : getWeatherIconSvg("moon", false, size);
  }
}

// Convert wind degrees to cardinal direction
export function getWindCardinal(degrees) {
  if (typeof degrees !== "number" || isNaN(degrees)) return "";
  const cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const val = Math.round((degrees / 22.5) + 0.5);
  return cardinals[val % 16] || "";
}

// Map weather conditions & parameters to music moods and recommendations
export function getWeatherMusicMood(weatherCode, tempC, isDay, windSpeed = 0, localHours = null) {
  const codeInfo = WMO_WEATHER_CODES[weatherCode] || { category: "clear", label: "Clear" };
  const cat = codeInfo.category;
  const hour = (localHours !== null && localHours !== undefined) ? localHours : new Date().getHours();

  // 1. Morning Context (5:00 AM - 11:59 AM) takes top priority for morning listening
  if (hour >= 5 && hour < 12) {
    if (cat === "rain") {
      return {
        mood: "Morning Rain Acoustic",
        badge: "Cozy Melodies & Coffee",
        description: "Gentle morning raindrops with warm acoustic melodies and peaceful lofi rhythms.",
        recommendedGenre: "Acoustic",
        icon: "🌧️"
      };
    }
    if (cat === "snow") {
      return {
        mood: "Frosty Morning",
        badge: "Crisp Air & Soft Piano",
        description: "Fresh snowy morning atmosphere with gentle piano and ambient warmth.",
        recommendedGenre: "Ambient",
        icon: "❄️"
      };
    }
    return {
      mood: "Morning Energy",
      badge: "Fresh Melodies & Sunrise",
      description: "Bright morning melodies, crisp acoustic rhythms, and uplifting sunrise vibes.",
      recommendedGenre: "Acoustic",
      icon: "🌅"
    };
  }

  // 2. Severe weather takes precedence during daytime
  if (cat === "thunder") {
    return {
      mood: "Stormy Atmosphere",
      badge: "Deep Bass & Cinematic",
      description: "Atmospheric basslines and dramatic synth swells to echo the storm.",
      recommendedGenre: "Synthwave",
      icon: "⚡"
    };
  }

  if (cat === "rain") {
    return {
      mood: "Rainy Mood",
      badge: "Acoustic & Cozy Beats",
      description: "Warm acoustic melodies and relaxing lofi rhythm for rainy contemplation.",
      recommendedGenre: "Lofi",
      icon: "🌧️"
    };
  }

  if (cat === "snow") {
    return {
      mood: "Winter Frost",
      badge: "Piano & Ambient Chill",
      description: "Soft ambient soundscapes and quiet piano notes for snowy calm.",
      recommendedGenre: "Ambient",
      icon: "❄️"
    };
  }

  // 3. Afternoon Context (12:00 PM - 5:59 PM)
  if (hour >= 12 && hour < 18) {
    if (tempC !== null && tempC < 10) {
      return {
        mood: "Cozy Session",
        badge: "Warm Melodies & Hearth",
        description: "Snuggle into warm acoustics and gentle rhythms to beat the cold.",
        recommendedGenre: "Acoustic",
        icon: "☕"
      };
    }

    if (tempC !== null && tempC > 30) {
      return {
        mood: "Summer Heatwave",
        badge: "Tropical Energy & Beats",
        description: "High-octane tropical house and sun-drenched anthems for warm days.",
        recommendedGenre: "Dance",
        icon: "🔥"
      };
    }

    if (cat === "clouds" || cat === "fog") {
      return {
        mood: "Cloudy Chill",
        badge: "Mellow Groove & Focus",
        description: "Smooth downtempo and mellow rhythms for overcast afternoons.",
        recommendedGenre: "Chill",
        icon: "☁️"
      };
    }

    if (windSpeed > 30) {
      return {
        mood: "Breezy Grooves",
        badge: "Airy Funk & Upbeat Flow",
        description: "Dynamic, fast-paced rhythms matching the brisk outdoor breeze.",
        recommendedGenre: "Indie Pop",
        icon: "🍃"
      };
    }

    return {
      mood: "Sunny Vibes",
      badge: "Bright & Uplifting Rhythms",
      description: "Vibrant and cheerful pop melodies reflecting crisp, sunny skies.",
      recommendedGenre: "Pop",
      icon: "☀️"
    };
  }

  // 4. Evening Context (6:00 PM - 9:59 PM)
  if (hour >= 18 && hour < 22) {
    return {
      mood: "Evening Wind Down",
      badge: "Smooth R&B & Sunset Beats",
      description: "Warm sunset hues, mellow chords, and relaxing evening beats.",
      recommendedGenre: "R&B",
      icon: "🌇"
    };
  }

  // 5. Late Night Context (10:00 PM - 4:59 AM)
  return {
    mood: "Night Listening",
    badge: "Dreamy Synthwave & Dusk",
    description: "Midnight frequencies, neon soundscapes, and hypnotic late-night rhythms.",
    recommendedGenre: "Synthwave",
    icon: "🌙"
  };
}

// Weather Service API Client
export class WeatherService {
  constructor() {
    this.cacheKey = "ambient_weather_cache";
    this.locationKey = "ambient_location_pref";
    this.cacheTTL = 20 * 60 * 1000; // 20 minutes cache
  }

  // Retrieve cached weather if still fresh
  getCachedWeather() {
    const cached = storage.getItem(this.cacheKey, null);
    if (!cached || !cached.timestamp) return null;
    const age = Date.now() - cached.timestamp;
    if (age < this.cacheTTL) {
      return cached;
    }
    return cached; // Return even if stale for offline fallback
  }

  // Save weather to cache
  saveCachedWeather(data) {
    storage.setItem(this.cacheKey, {
      ...data,
      timestamp: Date.now()
    });
  }

  // Fetch live weather from Open-Meteo
  async fetchLiveWeather(latitude, longitude, cityName = "") {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP error: ${response.status}`);
      }
      const raw = await response.json();

      const current = raw.current || {};
      const daily = raw.daily || {};

      const weatherCode = typeof current.weather_code === "number" ? current.weather_code : 0;
      const isDay = current.is_day === 1;
      const codeInfo = WMO_WEATHER_CODES[weatherCode] || {
        label: "Clear Sky",
        icon: isDay ? "sun" : "moon",
        nightIcon: "moon",
        category: "clear"
      };

      const sunrise = (daily.sunrise && daily.sunrise[0]) ? daily.sunrise[0] : null;
      const sunset = (daily.sunset && daily.sunset[0]) ? daily.sunset[0] : null;

      const weatherData = {
        latitude,
        longitude,
        cityName: cityName || (raw.timezone ? raw.timezone.split("/").pop().replace(/_/g, " ") : "Local City"),
        timezone: raw.timezone || "auto",
        temperatureC: Math.round((current.temperature_2m || 0) * 10) / 10,
        feelsLikeC: Math.round((current.apparent_temperature || current.temperature_2m || 0) * 10) / 10,
        humidity: current.relative_humidity_2m || 0,
        weatherCode,
        conditionText: codeInfo.label,
        iconName: isDay ? codeInfo.icon : (codeInfo.nightIcon || codeInfo.icon),
        isDay,
        windSpeedKmh: Math.round((current.wind_speed_10m || 0) * 10) / 10,
        windDirectionDeg: current.wind_direction_10m || 0,
        windCardinal: getWindCardinal(current.wind_direction_10m),
        sunrise,
        sunset,
        mood: getWeatherMusicMood(weatherCode, current.temperature_2m, isDay, current.wind_speed_10m),
        fetchedAt: new Date().toISOString()
      };

      this.saveCachedWeather(weatherData);
      return weatherData;
    } catch (err) {
      console.warn("Weather API fetch error:", err);
      // Fallback to cached data if available
      const cached = this.getCachedWeather();
      if (cached) {
        return {
          ...cached,
          isOffline: true
        };
      }
      throw err;
    }
  }

  // Reverse Geocoding with fallback to Nominatim & Open-Meteo
  async reverseGeocode(latitude, longitude) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" }
      });
      if (res.ok) {
        const json = await res.json();
        const addr = json.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.state_district || addr.state || "";
        const country = addr.country || "";
        if (city) {
          return country ? `${city}, ${country}` : city;
        }
      }
    } catch (e) {
      // Nominatim might be rate-limited or blocked; ignore silently
    }
    return "";
  }

  // City search using Open-Meteo Geocoding API
  async searchCities(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.results) return [];

      return data.results.map(r => ({
        id: r.id,
        name: r.name,
        country: r.country || "",
        admin: r.admin1 || "",
        latitude: r.latitude,
        longitude: r.longitude,
        label: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country ? ', ' + r.country : ''}`
      }));
    } catch (e) {
      console.warn("City search error:", e);
      return [];
    }
  }

  // Get current browser coordinates via Geolocation
  getCurrentCoordinates(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          reject(err);
        },
        {
          enableHighAccuracy: false,
          timeout: timeoutMs,
          maximumAge: 300000 // 5 minutes cache
        }
      );
    });
  }
}

export const weatherService = new WeatherService();
