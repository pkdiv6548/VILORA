import { DEMO_SONGS } from "../data/songs.js";
import { DEMO_ALBUMS } from "../data/albums.js";
import { DEMO_ARTISTS } from "../data/artists.js";
import { DEMO_PLAYLISTS } from "../data/playlists.js";
import { DEMO_GENRES } from "../data/genres.js";
import { DEMO_RADIO_STATIONS } from "../data/radio.js";
import { DEMO_PODCASTS } from "../data/podcasts.js";
import { storage } from "./storage.js";

class AppState {
  constructor() {
    this.listeners = new Map();

    // Load persisted state or defaults
    const savedFavorites = storage.getItem("favorites", ["song-1", "song-2", "song-4", "song-9", "song-15", "song-19"]);
    const savedPlaylists = storage.getItem("playlists", DEMO_PLAYLISTS);
    const savedLocalMusic = storage.getItem("localMusicLibrary", []) || [];
    const savedCustomSongs = storage.getItem("customSongs", []) || [];

    // Combine unique local tracks (strip stale session blobUrls)
    const allLocal = [...savedCustomSongs];
    savedLocalMusic.forEach((t) => {
      if (!allLocal.some((s) => s.id === t.id)) {
        allLocal.push({ ...t, source: "local", isCustom: true });
      }
    });
    allLocal.forEach((track) => {
      delete track.blobUrl;
    });

    const savedHistory = storage.getItem("history", []);
    const savedSettings = storage.getItem("settings", {
      theme: "dark", // dark, light, amoled
      accent: "default", // default, emerald, electric-blue, sunset-amber, cyber-magenta
      reduceMotion: false,
      crossfade: 2, // seconds
      gapless: true,
      audioQuality: "lossless", // standard, high, lossless, hi-res
      normalizeVolume: true,
      autoNext: true,
      sidebarCollapsed: false,
      rightPanelTab: "queue", // queue, lyrics, info
      rightPanelOpen: false,
      gridDensity: "comfortable", // dense, comfortable, large
      viewMode: "grid" // grid, table, compact
    });

    // Merge demo songs with imported local user songs (local user songs placed first)
    this.songs = allLocal.length > 0 ? [...allLocal, ...DEMO_SONGS] : [...DEMO_SONGS];
    this.albums = [...DEMO_ALBUMS];
    this.artists = [...DEMO_ARTISTS];
    this.genres = [...DEMO_GENRES];
    this.radioStations = [...DEMO_RADIO_STATIONS];
    this.podcasts = [...DEMO_PODCASTS];

    this.playlists = savedPlaylists;
    this.favorites = new Set(savedFavorites);
    this.history = savedHistory;
    this.settings = savedSettings;

    const isLocalHash = typeof window !== "undefined" && window.location.hash && window.location.hash.includes("local");

    // Playback state: auto-load local tracks into currentSong and queue if user has local tracks
    if (allLocal.length > 0) {
      this.currentSong = allLocal[0];
      this.queue = [...allLocal];
      this.queueIndex = 0;
      storage.setItem("lastMusicSource", "local");
    } else {
      this.currentSong = this.songs[0] || null;
      const savedQueueData = storage.getItem("queueData", null);
      if (savedQueueData && Array.isArray(savedQueueData) && savedQueueData.length > 0) {
        this.queue = savedQueueData;
      } else {
        const savedQueueIds = storage.getItem("queue", this.songs.slice(0, 15).map(s => s.id));
        this.queue = savedQueueIds.map(id => this.getSongById(id)).filter(Boolean);
      }
      this.queueIndex = storage.getItem("queueIndex", 0);
      if (this.queueIndex >= this.queue.length) this.queueIndex = 0;
    }

    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = this.currentSong ? this.currentSong.duration : 0;
    this.volume = storage.getItem("volume", 0.85);
    this.isMuted = false;
    this.previousVolume = this.volume;
    this.playbackRate = 1.0;
    this.shuffle = storage.getItem("shuffle", false);
    this.repeatMode = storage.getItem("repeatMode", "all"); // off, all, one
    this.abRepeat = { active: false, a: 0, b: 0 };
    this.sleepTimer = { active: false, endTime: null, remaining: 0, timerId: null };

    // Visualizer & EQ state
    this.visualizerMode = storage.getItem("visualizerMode", "bars"); // bars, spectrum, wave, circular, particles
    this.visualizerSensitivity = 1.2;
    this.eqEnabled = storage.getItem("eqEnabled", true);
    this.eqPreset = storage.getItem("eqPreset", "Flat");
    this.eqBands = storage.getItem("eqBands", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // 10 bands
    this.preamp = storage.getItem("preamp", 0);
    this.bassBoost = storage.getItem("bassBoost", 20); // 0 - 100
    this.stereoWiden = storage.getItem("stereoWiden", 15);
    this.reverb = storage.getItem("reverb", 10);

    // Active live stream status (for radio or podcast)
    this.isStream = false;
    this.currentStation = null;

    // Spotify-style Music Video Mode state
    this.isVideoMode = storage.getItem("isVideoMode", false);

    // Search query & active route
    this.currentRoute = "#/home";
    this.searchQuery = "";
    this.searchHistory = storage.getItem("searchHistory", ["Synthwave", "Lofi", "Hana Takahashi", "Piano"]);
    this.downloads = storage.getItem("downloads", ["song-1", "song-9"]);
  }

  // Event bus
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  notify(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      });
    }
  }

  // Getters
  getSongById(id) {
    if (!id) return null;
    if (this.currentSong && this.currentSong.id === id) return this.currentSong;
    const inQueue = this.queue?.find(s => s && s.id === id);
    if (inQueue) return inQueue;
    const inHistory = this.history?.find(s => s && s.id === id);
    if (inHistory) return inHistory;
    return this.songs.find(s => s && s.id === id) || null;
  }

  getAlbumById(id) {
    return this.albums.find(a => a.id === id) || null;
  }

  getArtistById(id) {
    return this.artists.find(a => a.id === id) || null;
  }

  getPlaylistById(id) {
    return this.playlists.find(p => p.id === id) || null;
  }

  isFavorite(songId) {
    return this.favorites.has(songId);
  }

  // Mutations
  toggleFavorite(songId) {
    const isFav = this.favorites.has(songId);
    if (isFav) {
      this.favorites.delete(songId);
    } else {
      this.favorites.add(songId);
    }
    const song = this.getSongById(songId);
    if (song) song.favorite = !isFav;
    storage.setItem("favorites", Array.from(this.favorites));
    this.notify("favoritesChanged", { songId, isFavorite: !isFav });
    return !isFav;
  }

  addSongToHistory(song) {
    if (!song) return;
    this.history = this.history.filter(item => item.id !== song.id);
    this.history.unshift({
      id: song.id,
      title: song.title,
      artist: song.artist,
      artwork: song.artwork,
      timestamp: Date.now()
    });
    if (this.history.length > 100) this.history.pop();
    storage.setItem("history", this.history);
    this.notify("historyChanged", this.history);
  }

  incrementSongPlayCount(songId) {
    const song = this.getSongById(songId);
    if (song) {
      song.playCount = (song.playCount || 0) + 1;
      song.lastPlayed = Date.now();
      this.notify("songStatsUpdated", song);
    }
  }

  setQueue(songs, startIndex = 0) {
    if (!songs || !songs.length) return;
    this.queue = [...songs];
    this.queueIndex = Math.max(0, Math.min(startIndex, this.queue.length - 1));
    storage.setItem("queue", this.queue.map(s => s.id));
    storage.setItem("queueData", this.queue);
    storage.setItem("queueIndex", this.queueIndex);
    this.notify("queueChanged", { queue: this.queue, index: this.queueIndex });
  }

  addToQueue(song, playNext = false) {
    if (!song) return;
    if (playNext) {
      this.queue.splice(this.queueIndex + 1, 0, song);
    } else {
      this.queue.push(song);
    }
    storage.setItem("queue", this.queue.map(s => s.id));
    storage.setItem("queueData", this.queue);
    this.notify("queueChanged", { queue: this.queue, index: this.queueIndex });
  }

  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.queue.splice(index, 1);
    if (this.queueIndex >= this.queue.length) {
      this.queueIndex = Math.max(0, this.queue.length - 1);
    }
    storage.setItem("queue", this.queue.map(s => s.id));
    storage.setItem("queueData", this.queue);
    storage.setItem("queueIndex", this.queueIndex);
    this.notify("queueChanged", { queue: this.queue, index: this.queueIndex });
  }

  clearQueue() {
    this.queue = this.currentSong ? [this.currentSong] : [];
    this.queueIndex = 0;
    storage.setItem("queue", this.queue.map(s => s.id));
    storage.setItem("queueData", this.queue);
    storage.setItem("queueIndex", 0);
    this.notify("queueChanged", { queue: this.queue, index: this.queueIndex });
  }

  updateSettings(partial) {
    this.settings = { ...this.settings, ...partial };
    storage.setItem("settings", this.settings);
    this.notify("settingsChanged", this.settings);
  }

  addCustomSong(song) {
    this.songs.unshift(song);
    const custom = this.songs.filter(s => s.isCustom).map(s => {
      const copy = { ...s };
      delete copy.blobUrl;
      return copy;
    });
    storage.setItem("customSongs", custom);
    this.notify("libraryChanged", this.songs);
  }

  removeCustomSong(songId) {
    this.removeSong(songId);
  }

  removeSong(songId) {
    const isCurrent = this.currentSong && this.currentSong.id === songId;
    this.songs = this.songs.filter(s => s.id !== songId);
    const custom = this.songs.filter(s => s.isCustom).map(s => {
      const copy = { ...s };
      delete copy.blobUrl;
      return copy;
    });
    storage.setItem("customSongs", custom);

    // Also remove from queue if present
    const qIdx = this.queue.findIndex(s => s.id === songId);
    if (qIdx !== -1) {
      this.removeFromQueue(qIdx);
    }
    if (isCurrent) {
      if (this.queue.length > 0) {
        this.queueIndex = Math.min(this.queueIndex, this.queue.length - 1);
        this.currentSong = this.queue[this.queueIndex];
        this.notify("songChanged", this.currentSong);
      } else {
        this.currentSong = null;
        this.isPlaying = false;
        this.notify("playbackStateChanged", false);
        this.notify("songChanged", null);
      }
    }
    this.notify("libraryChanged", this.songs);
    this.notify("songRemoved", songId);
  }

  loadLocalMusicQueue(localTracks) {
    if (!localTracks || localTracks.length === 0) return false;

    const currentIsLocal = this.currentSong && (
      this.currentSong.source === "local" ||
      this.currentSong.isCustom ||
      localTracks.some(t => t.id === this.currentSong.id)
    );

    let targetIndex = 0;
    if (currentIsLocal) {
      const idx = localTracks.findIndex(t => t.id === this.currentSong.id);
      if (idx >= 0) targetIndex = idx;
    } else {
      this.currentSong = localTracks[0];
      this.duration = localTracks[0].duration || 180;
      this.currentTime = 0;
    }

    this.queue = [...localTracks];
    this.queueIndex = targetIndex;
    storage.setItem("lastMusicSource", "local");
    storage.setItem("queueData", this.queue);
    storage.setItem("queueIndex", this.queueIndex);

    this.notify("songChanged", this.currentSong);
    this.notify("queueChanged", { queue: this.queue, index: this.queueIndex });
    return true;
  }

  setVideoMode(enable) {
    this.isVideoMode = !!enable;
    storage.setItem("isVideoMode", this.isVideoMode);
    this.notify("videoModeChanged", this.isVideoMode);
  }

  toggleVideoMode() {
    this.setVideoMode(!this.isVideoMode);
    return this.isVideoMode;
  }
}

export const state = new AppState();
