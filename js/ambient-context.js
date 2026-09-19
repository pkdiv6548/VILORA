// Ambient Context System: Coordinates Live Clock, Open-Meteo Weather, Geolocation, and Weather-Aware Music Moods
import { storage } from "./storage.js";
import { weatherService, getWeatherIconSvg, getWeatherMusicMood } from "./weather.js";
import { liveClock } from "./clock.js";
import { openModal, closeModal, showToast, ICONS } from "./components.js";
import { state } from "./state.js";

class AmbientContextManager {
  constructor() {
    this.storageKey = "ambient_config";

    // Detect contextual fallback city based on user's browser timezone
    const detectDefaultCity = () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        if (tz.includes("Kolkata") || tz.includes("Calcutta") || tz.includes("India") || tz.includes("Colombo")) {
          return { name: "New Delhi", country: "India", latitude: 28.6139, longitude: 77.2090 };
        }
        if (tz.includes("London") || tz.includes("Europe/London") || tz.includes("Dublin")) {
          return { name: "London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278 };
        }
        if (tz.includes("Paris") || tz.includes("Berlin") || tz.includes("Madrid") || tz.includes("Rome")) {
          return { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 };
        }
        if (tz.includes("Tokyo") || tz.includes("Japan")) {
          return { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 };
        }
        if (tz.includes("Dubai")) {
          return { name: "Dubai", country: "UAE", latitude: 25.2048, longitude: 55.2708 };
        }
        if (tz.includes("Singapore")) {
          return { name: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198 };
        }
        if (tz.includes("Sydney") || tz.includes("Melbourne")) {
          return { name: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093 };
        }
      } catch (e) {}
      return { name: "New York", country: "United States", latitude: 40.7128, longitude: -74.0060 };
    };

    this.defaultCity = detectDefaultCity();

    // Load preferences
    const savedConfig = storage.getItem(this.storageKey, {
      tempUnit: "C", // 'C' or 'F'
      timeFormat: "12h", // '12h' or '24h'
      showSeconds: false,
      selectedCity: null,
      useAutoLocation: true
    });

    this.config = savedConfig;
    this.weatherData = null;
    this.isLoadingWeather = false;
    this.weatherError = null;
    this.clockData = liveClock.getTimeData();

    // DOM References
    this.headerPillEl = null;
    this.homeCardEl = null;
    this.modalEl = null;

    // Clock unsubscribe token
    this.clockUnsubscribe = null;
  }

  init() {
    // Subscribe to live clock
    this.clockUnsubscribe = liveClock.subscribe((timeData) => {
      this.clockData = timeData;
      this.updateLiveClocks();
    });

    // Try loading initial weather
    this.initWeather();

    // Listen for tab visibility changes to refresh stale weather (> 20 min)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.weatherData) {
        const cached = weatherService.getCachedWeather();
        if (!cached || (Date.now() - cached.timestamp > 20 * 60 * 1000)) {
          this.refreshWeather(false);
        }
      }
    });

    // Listen to online/offline network events
    window.addEventListener("online", () => {
      if (this.weatherError) this.refreshWeather(true);
    });

    window.addEventListener("offline", () => {
      this.updateWidgets();
    });
  }

  saveConfig() {
    storage.setItem(this.storageKey, this.config);
  }

  setTempUnit(unit) {
    if (unit !== "C" && unit !== "F") return;
    this.config.tempUnit = unit;
    this.saveConfig();
    this.updateWidgets();
    if (document.getElementById("ambient-modal-root")) {
      this.openAmbientDetailModal();
    }
  }

  setTimeFormat(format) {
    if (format !== "12h" && format !== "24h") return;
    this.config.timeFormat = format;
    this.saveConfig();
    this.updateLiveClocks();
  }

  formatTemp(celsius) {
    if (celsius === null || celsius === undefined || isNaN(celsius)) return "--";
    if (this.config.tempUnit === "F") {
      const f = Math.round((celsius * 9 / 5) + 32);
      return `${f}°F`;
    }
    const c = Math.round(celsius);
    return `${c}°C`;
  }

  getDisplayTime(withSeconds = false) {
    if (this.config.timeFormat === "24h") {
      return withSeconds ? this.clockData.time24WithSec : this.clockData.time24;
    }
    return withSeconds ? this.clockData.time12WithSec : this.clockData.time12;
  }

  async initWeather() {
    // 1. Check if user specified a manual city
    if (this.config.selectedCity) {
      await this.loadWeatherForCity(this.config.selectedCity);
      return;
    }

    // 2. Check for fresh cached weather
    const cached = weatherService.getCachedWeather();
    if (cached && (Date.now() - cached.timestamp < 20 * 60 * 1000)) {
      this.weatherData = cached;
      this.isLoadingWeather = false;
      this.updateWidgets();
      return;
    }

    // 3. Try automatic geolocation if enabled
    if (this.config.useAutoLocation) {
      this.detectLocation();
    } else {
      // Fallback to default city
      await this.loadWeatherForCity(this.defaultCity);
    }
  }

  async detectLocation() {
    this.isLoadingWeather = true;
    this.weatherError = null;
    this.updateWidgets();

    try {
      const coords = await weatherService.getCurrentCoordinates(8000);
      let detectedCityName = "";
      try {
        detectedCityName = await weatherService.reverseGeocode(coords.latitude, coords.longitude);
      } catch (e) {
        // Fallback silently
      }

      this.weatherData = await weatherService.fetchLiveWeather(
        coords.latitude,
        coords.longitude,
        detectedCityName
      );
      this.isLoadingWeather = false;
      this.weatherError = null;
      this.config.useAutoLocation = true;
      this.saveConfig();
    } catch (err) {
      console.warn("Location detection failed, falling back to cached or default city:", err);
      this.isLoadingWeather = false;
      // If error is permission denied or unavailable, use default city or cached data
      const cached = weatherService.getCachedWeather();
      if (cached) {
        this.weatherData = cached;
      } else {
        await this.loadWeatherForCity(this.defaultCity);
      }
    } finally {
      this.updateWidgets();
    }
  }

  async loadWeatherForCity(city) {
    this.isLoadingWeather = true;
    this.weatherError = null;
    this.updateWidgets();

    try {
      this.weatherData = await weatherService.fetchLiveWeather(
        city.latitude,
        city.longitude,
        city.name + (city.country ? `, ${city.country}` : "")
      );
      this.config.selectedCity = city;
      this.config.useAutoLocation = false;
      this.saveConfig();
      this.weatherError = null;
    } catch (err) {
      console.warn("Failed to load weather for city:", err);
      this.weatherError = "Weather unavailable";
    } finally {
      this.isLoadingWeather = false;
      this.updateWidgets();
    }
  }

  async refreshWeather(force = true) {
    if (this.isLoadingWeather) return;
    if (force) {
      storage.removeItem(weatherService.cacheKey);
    }
    if (this.config.selectedCity) {
      await this.loadWeatherForCity(this.config.selectedCity);
    } else {
      await this.detectLocation();
    }
    showToast("Weather refreshed");
  }

  // Update live clock texts without re-rendering entire markup
  updateLiveClocks() {
    const timeStr = this.getDisplayTime(false);
    const timeStrSec = this.getDisplayTime(true);

    // Header Pill Time
    const pillTime = document.getElementById("header-ambient-time");
    if (pillTime) pillTime.textContent = timeStr;

    // Home Card Time & Date
    const homeTime = document.getElementById("home-ambient-time");
    if (homeTime) homeTime.textContent = timeStr;

    const homeGreeting = document.getElementById("home-ambient-greeting");
    if (homeGreeting) homeGreeting.textContent = `${this.clockData.greeting}`;

    const homeDayDate = document.getElementById("home-ambient-daydate");
    if (homeDayDate) homeDayDate.textContent = `${this.clockData.dayOfWeek}, ${this.clockData.formattedDate}`;

    // Modal Live Clock
    const modalClock = document.getElementById("ambient-modal-live-clock");
    if (modalClock) modalClock.textContent = timeStrSec;

    const modalGreeting = document.getElementById("ambient-modal-greeting");
    if (modalGreeting) modalGreeting.textContent = this.clockData.greeting;

    const modalDayDate = document.getElementById("ambient-modal-daydate");
    if (modalDayDate) modalDayDate.textContent = `${this.clockData.dayOfWeek}, ${this.clockData.formattedDate}`;
  }

  // Update all ambient components in DOM
  updateWidgets() {
    this.renderHeaderWidget();
    this.renderHomeCard();
  }

  // Render or update Header Pill
  renderHeaderWidget() {
    const container = document.getElementById("header-ambient-pill-wrap");
    if (!container) return;

    if (this.isLoadingWeather && !this.weatherData) {
      container.innerHTML = `
        <button class="ambient-header-pill loading" id="header-ambient-pill" title="Getting live weather...">
          <span class="ambient-pill-dot animate-pulse"></span>
          <span class="ambient-pill-time">${this.getDisplayTime(false)}</span>
          <span class="ambient-pill-temp">Weather…</span>
        </button>
      `;
      this.attachPillListener();
      return;
    }

    const isOffline = !navigator.onLine || (this.weatherData && this.weatherData.isOffline);
    const localHour = this.clockData?.hours24 ?? new Date().getHours();
    const isLocalDaytime = localHour >= 5 && localHour < 19;
    const headerIsDay = this.config.selectedCity && this.weatherData
      ? (this.weatherData.isDay !== false)
      : isLocalDaytime;

    const iconSvg = this.weatherData
      ? getWeatherIconSvg(this.weatherData.iconName, headerIsDay, 16)
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path></svg>`;

    const tempStr = this.weatherData ? this.formatTemp(this.weatherData.temperatureC) : "--";
    const cityStr = this.weatherData ? this.weatherData.cityName.split(",")[0] : "Local";
    const timeStr = this.getDisplayTime(false);

    container.innerHTML = `
      <button class="ambient-header-pill ${isOffline ? 'offline' : ''}" id="header-ambient-pill" title="Click for Live Weather & Clock details" aria-label="Live Weather and Clock">
        <span class="ambient-pill-icon" aria-hidden="true">${iconSvg}</span>
        <span class="ambient-pill-temp">${tempStr}</span>
        <span class="ambient-pill-separator">•</span>
        <span class="ambient-pill-time" id="header-ambient-time">${timeStr}</span>
        <span class="ambient-pill-city hide-on-mobile">${cityStr}</span>
      </button>
    `;

    this.attachPillListener();
  }

  attachPillListener() {
    const btn = document.getElementById("header-ambient-pill");
    if (btn) {
      btn.onclick = () => this.openAmbientDetailModal();
    }
  }

  // Render Home Ambient Soundscape Banner
  renderHomeCard() {
    const mount = document.getElementById("home-ambient-card-mount");
    if (!mount) return;

    const w = this.weatherData || {
      temperatureC: 22,
      feelsLikeC: 23,
      humidity: 50,
      windSpeedKmh: 10,
      windCardinal: "W",
      conditionText: "Clear Sky",
      iconName: "sun",
      isDay: true,
      cityName: "New York",
      sunrise: null,
      sunset: null,
      mood: getWeatherMusicMood(0, 22, true, 10)
    };

    const localHour = this.clockData?.hours24 ?? new Date().getHours();
    const isLocalDaytime = localHour >= 5 && localHour < 19;
    const isDay = this.config.selectedCity && w.isDay !== undefined ? (w.isDay !== false) : isLocalDaytime;
    const mood = getWeatherMusicMood(w.weatherCode || 0, w.temperatureC, isDay, w.windSpeedKmh, localHour);
    const atmosphereClass = isDay ? (w.weatherCode >= 50 ? "atmosphere-rain" : "atmosphere-day") : "atmosphere-night";

    const sunriseStr = liveClock.formatSunTime(w.sunrise, this.config.timeFormat === "24h");
    const sunsetStr = liveClock.formatSunTime(w.sunset, this.config.timeFormat === "24h");
    const tempStr = this.formatTemp(w.temperatureC);
    const feelsLikeStr = this.formatTemp(w.feelsLikeC);
    const iconSvg = getWeatherIconSvg(w.iconName, isDay, 36);

    mount.innerHTML = `
      <div class="ambient-home-card ${atmosphereClass}" id="home-ambient-card">
        <div class="ambient-card-glow"></div>

        <!-- Left Context Content -->
        <div class="ambient-card-left">
          <div class="ambient-greeting-row">
            <span class="ambient-greeting-tag" id="home-ambient-greeting">${this.clockData.greeting}</span>
            <span class="ambient-dot-sep">•</span>
            <span class="ambient-daydate" id="home-ambient-daydate">${this.clockData.dayOfWeek}, ${this.clockData.formattedDate}</span>
          </div>

          <div class="ambient-live-clock-row">
            <span class="ambient-live-time" id="home-ambient-time">${this.getDisplayTime(false)}</span>
            <div class="ambient-mood-pill" title="${mood.description}">
              <span class="ambient-mood-emoji">${mood.icon}</span>
              <span class="ambient-mood-title">${mood.mood}</span>
            </div>
          </div>

          <p class="ambient-mood-desc">${mood.description}</p>

          <div class="ambient-card-actions">
            <button class="btn-primary ambient-explore-btn" id="ambient-mood-listen-btn">
              ${ICONS.play} Listen to ${mood.recommendedGenre}
            </button>
            <button class="btn-secondary ambient-details-btn" id="ambient-card-expand-btn">
              Weather Details
            </button>
          </div>
        </div>

        <!-- Right Weather Metrics Card -->
        <div class="ambient-card-right">
          <div class="ambient-weather-primary">
            <div class="ambient-weather-icon-wrap" aria-hidden="true">${iconSvg}</div>
            <div class="ambient-temp-block">
              <span class="ambient-big-temp">${tempStr}</span>
              <span class="ambient-condition-label">${w.conditionText}</span>
            </div>
          </div>

          <div class="ambient-location-chip" id="ambient-home-location-btn" title="Click to change city or location">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span class="ambient-location-text">${w.cityName}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg>
          </div>

          <!-- Mini Metrics Strip -->
          <div class="ambient-mini-metrics">
            <div class="ambient-mini-metric" title="Feels like temperature">
              <span class="ambient-metric-label">Feels Like</span>
              <span class="ambient-metric-val">${feelsLikeStr}</span>
            </div>
            <div class="ambient-mini-metric" title="Relative Humidity">
              <span class="ambient-metric-label">Humidity</span>
              <span class="ambient-metric-val">${w.humidity}%</span>
            </div>
            <div class="ambient-mini-metric" title="Wind Speed">
              <span class="ambient-metric-label">Wind</span>
              <span class="ambient-metric-val">${w.windSpeedKmh} km/h</span>
            </div>
            <div class="ambient-mini-metric" title="${isDay ? 'Sunset' : 'Sunrise'}">
              <span class="ambient-metric-label">${isDay ? 'Sunset' : 'Sunrise'}</span>
              <span class="ambient-metric-val">${isDay ? sunsetStr : sunriseStr}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event Listeners on Home Card
    document.getElementById("ambient-card-expand-btn")?.addEventListener("click", () => {
      this.openAmbientDetailModal();
    });

    document.getElementById("ambient-home-location-btn")?.addEventListener("click", () => {
      this.openCitySearchModal();
    });

    document.getElementById("ambient-mood-listen-btn")?.addEventListener("click", () => {
      // Navigate to genres or filter songs matching genre without interrupting playing song
      const genre = mood.recommendedGenre.toLowerCase();
      showToast(`Exploring ${mood.recommendedGenre} soundscapes for ${mood.mood}`);
      window.location.hash = "#/genres";
    });
  }

  // Open Full Detail Modal with all 14 required items
  openAmbientDetailModal() {
    const w = this.weatherData || {
      temperatureC: 22,
      feelsLikeC: 23,
      humidity: 50,
      windSpeedKmh: 10,
      windCardinal: "W",
      conditionText: "Clear Sky",
      iconName: "sun",
      isDay: true,
      cityName: "New York",
      sunrise: null,
      sunset: null,
      mood: getWeatherMusicMood(0, 22, true, 10)
    };

    const isDay = w.isDay !== false;
    const mood = w.mood || getWeatherMusicMood(w.weatherCode || 0, w.temperatureC, isDay, w.windSpeedKmh);
    const sunriseStr = liveClock.formatSunTime(w.sunrise, this.config.timeFormat === "24h");
    const sunsetStr = liveClock.formatSunTime(w.sunset, this.config.timeFormat === "24h");
    const iconSvg = getWeatherIconSvg(w.iconName, isDay, 48);

    const tempStr = this.formatTemp(w.temperatureC);
    const feelsLikeStr = this.formatTemp(w.feelsLikeC);

    const contentHtml = `
      <div id="ambient-modal-root" class="ambient-modal-container">
        <!-- Top Hero Section: Greeting, Big Clock & Date -->
        <div class="ambient-modal-hero">
          <div class="ambient-modal-header-top">
            <span class="ambient-modal-greeting" id="ambient-modal-greeting">${this.clockData.greeting}</span>
            <div class="ambient-unit-toggle-group">
              <button class="ambient-unit-btn ${this.config.tempUnit === 'C' ? 'active' : ''}" id="modal-temp-c">°C</button>
              <button class="ambient-unit-btn ${this.config.tempUnit === 'F' ? 'active' : ''}" id="modal-temp-f">°F</button>
            </div>
          </div>

          <!-- Big Live Clock with Seconds -->
          <div class="ambient-modal-clock-box">
            <div class="ambient-modal-clock" id="ambient-modal-live-clock">${this.getDisplayTime(true)}</div>
            <div class="ambient-modal-daydate" id="ambient-modal-daydate">${this.clockData.dayOfWeek}, ${this.clockData.formattedDate}</div>
          </div>
        </div>

        <!-- Weather Status Card -->
        <div class="ambient-modal-weather-card">
          <div class="ambient-modal-weather-main">
            <div class="ambient-modal-icon-large">${iconSvg}</div>
            <div class="ambient-modal-temp-group">
              <div class="ambient-modal-temp-val">${tempStr}</div>
              <div class="ambient-modal-condition-text">${w.conditionText}</div>
              <div class="ambient-modal-feels-text">Feels like ${feelsLikeStr}</div>
            </div>
          </div>

          <!-- Location Bar -->
          <div class="ambient-modal-location-bar">
            <div class="ambient-modal-location-info">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span class="ambient-modal-city-name">${w.cityName}</span>
            </div>
            <div class="ambient-modal-location-actions">
              <button class="btn-secondary ambient-sub-btn" id="modal-change-city-btn">Change City</button>
              <button class="btn-secondary ambient-sub-btn" id="modal-locate-btn" title="Use browser GPS">📍 Auto Locate</button>
            </div>
          </div>
        </div>

        <!-- 6-Point Weather Data Grid -->
        <div class="ambient-modal-grid">
          <div class="ambient-grid-card">
            <div class="ambient-grid-icon">💧</div>
            <div class="ambient-grid-content">
              <div class="ambient-grid-title">Humidity</div>
              <div class="ambient-grid-val">${w.humidity}%</div>
            </div>
          </div>

          <div class="ambient-grid-card">
            <div class="ambient-grid-icon">💨</div>
            <div class="ambient-grid-content">
              <div class="ambient-grid-title">Wind Speed</div>
              <div class="ambient-grid-val">${w.windSpeedKmh} km/h ${w.windCardinal}</div>
            </div>
          </div>

          <div class="ambient-grid-card">
            <div class="ambient-grid-icon">🌅</div>
            <div class="ambient-grid-content">
              <div class="ambient-grid-title">Sunrise</div>
              <div class="ambient-grid-val">${sunriseStr}</div>
            </div>
          </div>

          <div class="ambient-grid-card">
            <div class="ambient-grid-icon">🌇</div>
            <div class="ambient-grid-content">
              <div class="ambient-grid-title">Sunset</div>
              <div class="ambient-grid-val">${sunsetStr}</div>
            </div>
          </div>

          <div class="ambient-grid-card">
            <div class="ambient-grid-icon">${isDay ? '☀️' : '🌙'}</div>
            <div class="ambient-grid-content">
              <div class="ambient-grid-title">Day / Night</div>
              <div class="ambient-grid-val">${isDay ? 'Daytime' : 'Nighttime'}</div>
            </div>
          </div>

          <div class="ambient-grid-card">
            <div class="ambient-grid-icon">🌡️</div>
            <div class="ambient-grid-content">
              <div class="ambient-grid-title">Apparent Temp</div>
              <div class="ambient-grid-val">${feelsLikeStr}</div>
            </div>
          </div>
        </div>

        <!-- Weather-Aware Music Mood Box -->
        <div class="ambient-modal-mood-card">
          <div class="ambient-mood-header">
            <div class="ambient-mood-badge-row">
              <span class="ambient-mood-icon">${mood.icon}</span>
              <span class="ambient-mood-main-tag">${mood.mood}</span>
              <span class="ambient-mood-genre-tag">${mood.recommendedGenre}</span>
            </div>
          </div>
          <p class="ambient-mood-detail-desc">${mood.description}</p>
        </div>
      </div>
    `;

    const footerHtml = `
      <div style="display:flex;align-items:center;justify-content:flex-end;width:100%;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;gap:8px;">
          <button class="btn-secondary" id="modal-refresh-weather-btn">Refresh</button>
          <button class="btn-primary" id="modal-ambient-close-btn">Done</button>
        </div>
      </div>
    `;

    openModal("Live Ambient Context", contentHtml, footerHtml, "ambient-modal-box");

    // Listeners inside modal
    document.getElementById("modal-ambient-close-btn")?.addEventListener("click", closeModal);

    document.getElementById("modal-temp-c")?.addEventListener("click", () => {
      this.setTempUnit("C");
    });

    document.getElementById("modal-temp-f")?.addEventListener("click", () => {
      this.setTempUnit("F");
    });

    document.getElementById("modal-change-city-btn")?.addEventListener("click", () => {
      closeModal();
      setTimeout(() => this.openCitySearchModal(), 150);
    });

    document.getElementById("modal-locate-btn")?.addEventListener("click", () => {
      this.detectLocation();
      closeModal();
      showToast("Detecting your location…");
    });

    document.getElementById("modal-refresh-weather-btn")?.addEventListener("click", () => {
      this.refreshWeather(true);
      closeModal();
    });
  }

  // Open Searchable City Selector Modal
  openCitySearchModal() {
    const popularCities = [
      { name: "New York", country: "United States", latitude: 40.7128, longitude: -74.0060 },
      { name: "London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278 },
      { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
      { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
      { name: "Berlin", country: "Germany", latitude: 52.5200, longitude: 13.4050 },
      { name: "Mumbai", country: "India", latitude: 19.0760, longitude: 72.8777 },
      { name: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093 },
      { name: "Toronto", country: "Canada", latitude: 43.6532, longitude: -79.3832 },
      { name: "Dubai", country: "United Arab Emirates", latitude: 25.2048, longitude: 55.2708 },
      { name: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198 }
    ];

    const quickPicksHtml = popularCities.map(c => `
      <button class="city-quick-chip" data-lat="${c.latitude}" data-lon="${c.longitude}" data-name="${c.name}" data-country="${c.country}">
        ${c.name}
      </button>
    `).join("");

    const contentHtml = `
      <div class="city-search-container">
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:12px;">
          Search any city worldwide or select from popular locations.
        </p>

        <div class="city-input-wrapper">
          <svg class="city-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="city-search-field" class="city-search-input" placeholder="Type city name (e.g. San Francisco, Madrid, Seoul)..." autofocus>
        </div>

        <!-- Quick Picks -->
        <div style="margin-top:16px;">
          <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:8px;">Popular Cities</div>
          <div class="city-quick-picks">
            ${quickPicksHtml}
          </div>
        </div>

        <!-- Live Results -->
        <div id="city-results-container" class="city-results-list" style="margin-top:16px;"></div>
      </div>
    `;

    const footerHtml = `
      <button class="btn-secondary" id="city-cancel-btn">Cancel</button>
      <button class="btn-primary" id="city-use-gps-btn">📍 Auto Detect Location</button>
    `;

    openModal("Select City / Location", contentHtml, footerHtml, "city-selector-modal");

    document.getElementById("city-cancel-btn")?.addEventListener("click", closeModal);

    document.getElementById("city-use-gps-btn")?.addEventListener("click", () => {
      this.detectLocation();
      closeModal();
      showToast("Detecting your location…");
    });

    // Quick pick clicks
    document.querySelectorAll(".city-quick-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const city = {
          name: chip.dataset.name,
          country: chip.dataset.country,
          latitude: parseFloat(chip.dataset.lat),
          longitude: parseFloat(chip.dataset.lon)
        };
        this.loadWeatherForCity(city);
        closeModal();
        showToast(`Weather set to ${city.name}`);
      });
    });

    // Live search input with debounce
    const input = document.getElementById("city-search-field");
    const resultsContainer = document.getElementById("city-results-container");
    let debounceTimer = null;

    if (input && resultsContainer) {
      input.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        if (query.length < 2) {
          resultsContainer.innerHTML = "";
          return;
        }

        resultsContainer.innerHTML = `<div style="padding:10px;font-size:0.85rem;color:var(--color-text-muted);">Searching cities…</div>`;

        debounceTimer = setTimeout(async () => {
          const results = await weatherService.searchCities(query);
          if (!results || results.length === 0) {
            resultsContainer.innerHTML = `<div style="padding:10px;font-size:0.85rem;color:var(--color-text-muted);">No matching cities found. Try another search.</div>`;
            return;
          }

          resultsContainer.innerHTML = results.map(r => `
            <div class="city-result-item" data-lat="${r.latitude}" data-lon="${r.longitude}" data-name="${r.name}" data-country="${r.country}">
              <div style="font-weight:600;font-size:0.9rem;">${r.name}</div>
              <div style="font-size:0.75rem;color:var(--color-text-muted);">${r.admin ? r.admin + ', ' : ''}${r.country}</div>
            </div>
          `).join("");

          resultsContainer.querySelectorAll(".city-result-item").forEach(item => {
            item.addEventListener("click", () => {
              const city = {
                name: item.dataset.name,
                country: item.dataset.country,
                latitude: parseFloat(item.dataset.lat),
                longitude: parseFloat(item.dataset.lon)
              };
              this.loadWeatherForCity(city);
              closeModal();
              showToast(`Weather set to ${city.name}`);
            });
          });
        }, 350);
      });
    }
  }
}

export const ambientContext = new AmbientContextManager();
