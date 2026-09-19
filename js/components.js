import { state } from "./state.js";
import { audioEngine } from "./audio-engine.js";
import { playlistManager } from "./playlist.js";
import { localLibraryService } from "./local-library.js";
import { smartArtworkService } from "./smart-artwork.js";

// Clean SVG Icons
export const ICONS = {
  play: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
  pause: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
  next: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>`,
  prev: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>`,
  shuffle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>`,
  repeat: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`,
  repeatOne: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path><text x="10" y="14" font-size="8" font-weight="bold" fill="currentColor">1</text></svg>`,
  heart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  heartFilled: `<svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-accent)" stroke="var(--color-accent)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  volume: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
  volumeMute: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
  queue: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`,
  lyrics: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
  equalizer: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`,
  visualizer: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
  more: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`,
  search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  share: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
  download: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  check: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
};

export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Universal SVG artwork fallback with rich gradients and deterministic styling
export function getArtworkFallback(title = "Music", artist = "") {
  let cleanTitle = (title || "Music").trim();
  if (cleanTitle === "Album Artwork" || cleanTitle === "Song Title" || !cleanTitle) {
    cleanTitle = "Music";
  }
  const cleanDisplayTitle = cleanTitle.slice(0, 22).replace(/[<>'"]/g, "");
  const cleanDisplayArtist = (artist || "").trim().slice(0, 20).replace(/[<>'"]/g, "");

  // Deterministic color palette based on track title hash
  let hash = 0;
  for (let i = 0; i < cleanTitle.length; i++) {
    hash = (hash << 5) - hash + cleanTitle.charCodeAt(i);
    hash |= 0;
  }
  const gradId = `musiq_grad_${Math.abs(hash) % 9999}`;

  const palettes = [
    ["#ff2d55", "#7928ca"],
    ["#ec4899", "#8b5cf6"],
    ["#3b82f6", "#1d4ed8"],
    ["#10b981", "#047857"],
    ["#f59e0b", "#d97706"],
    ["#6366f1", "#4338ca"],
    ["#06b6d4", "#0891b2"],
    ["#8b5cf6", "#6d28d9"],
    ["#f43f5e", "#be123c"],
    ["#14b8a6", "#0f766e"]
  ];
  const [col1, col2] = palettes[Math.abs(hash) % palettes.length];
  const initial = (cleanDisplayTitle.charAt(0) || "♪").toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${col1}"/>
        <stop offset="100%" stop-color="${col2}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#${gradId})"/>
    <circle cx="150" cy="125" r="56" fill="rgba(0,0,0,0.3)"/>
    <circle cx="150" cy="125" r="48" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <circle cx="150" cy="125" r="22" fill="rgba(0,0,0,0.45)"/>
    <polygon points="144,113 144,137 162,125" fill="#ffffff"/>
    <text x="150" y="222" font-family="system-ui,-apple-system,sans-serif" font-size="17" font-weight="700" fill="#ffffff" text-anchor="middle">${cleanDisplayTitle}</text>
    ${cleanDisplayArtist ? `<text x="150" y="248" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="500" fill="rgba(255,255,255,0.8)" text-anchor="middle">${cleanDisplayArtist}</text>` : `<text x="150" y="248" font-family="system-ui,-apple-system,sans-serif" font-size="12" font-weight="500" fill="rgba(255,255,255,0.65)" text-anchor="middle">VIORA AUDIO</text>`}
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Global safe image error handler to prevent broken image icons and blank rectangles
if (typeof window !== "undefined") {
  window.__vioraImgFallback = function (img, fallbackTitle) {
    if (!img) return;
    img.onerror = null;
    let title = fallbackTitle || "";
    let artist = "";
    if (!title || title === "Album Artwork" || title === "Song Title") {
      const parent = img.closest(".song-row, .music-card, .player-left, #player-bar, .fullscreen-player-content, .player-upper-row");
      if (parent) {
        title = parent.querySelector(".song-title-text, .music-card-title, #player-title, .fs-title")?.textContent?.trim() || "";
        artist = parent.querySelector(".song-artist-text, .music-card-subtitle, #player-artist, .fs-artist")?.textContent?.trim() || "";
      }
    }
    if (!title || title === "Album Artwork" || title === "Song Title") {
      title = (window.__vioraCurrentTitle || window.__musiqCurrentTitle) || img.alt || "Music";
    }
    img.src = getArtworkFallback(title, artist);

    // Asynchronously try to fetch smart HD artwork if not tried yet for this element
    if (!img.dataset.smartArtAttempted && title && title !== "Music" && title !== "Album Artwork") {
      img.dataset.smartArtAttempted = "true";
      smartArtworkService.fetchSmartArtwork(title, artist).then((art) => {
        if (art && img) {
          const testImg = new Image();
          testImg.onload = () => {
            img.style.transition = "opacity 0.25s ease";
            img.style.opacity = "0.5";
            img.src = art;
            setTimeout(() => { img.style.opacity = "1"; }, 30);
          };
          testImg.src = art;
        }
      }).catch(() => {});
    }
  };
}

// Toast notification helper - strictly one active notification at a time
let currentToastTimeout = null;
let currentToastFadeTimeout = null;

export function showToast(message, type = "accent", duration = 2400) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  // Cancel any pending dismissal timers
  if (currentToastTimeout) {
    clearTimeout(currentToastTimeout);
    currentToastTimeout = null;
  }
  if (currentToastFadeTimeout) {
    clearTimeout(currentToastFadeTimeout);
    currentToastFadeTimeout = null;
  }

  // Remove all previous toasts immediately so only 1 alert popup is visible at a time
  container.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;

  toast.addEventListener("click", () => {
    if (currentToastTimeout) clearTimeout(currentToastTimeout);
    if (currentToastFadeTimeout) clearTimeout(currentToastFadeTimeout);
    toast.remove();
  });

  container.appendChild(toast);
  currentToastTimeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-12px)";
    toast.style.transition = "all 0.22s ease";
    currentToastFadeTimeout = setTimeout(() => {
      toast.remove();
      currentToastTimeout = null;
      currentToastFadeTimeout = null;
    }, 230);
  }, duration);
}

// Render Spotify-style Music Card
export function renderMusicCard(item, type = "song") {
  const card = document.createElement("div");
  card.className = "music-card animate-fade-in";
  card.dataset.id = item.id;
  card.dataset.type = type;

  const isCurrentPlaying = state.isPlaying && state.currentSong && state.currentSong.id === item.id;
  if (isCurrentPlaying) card.classList.add("is-playing");

  let subtitle = item.artist || item.creator || item.genre || "";
  let badgeHtml = "";
  if (type === "radio") {
    badgeHtml = `<span class="card-badge live" style="background:rgba(239,68,68,0.92);color:#fff;font-weight:700;letter-spacing:0.5px;padding:2px 6px;border-radius:4px;font-size:0.65rem;text-transform:uppercase;"><span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#fff;margin-right:3px;vertical-align:1px;"></span>LIVE</span>`;
  } else if (item.isHiRes) {
    badgeHtml = `<span class="card-badge hi-res">Hi-Res</span>`;
  } else if (item.isLossless) {
    badgeHtml = `<span class="card-badge lossless">Lossless</span>`;
  }

  const safeArt = (item.artwork && !item.artwork.startsWith("blob:") && !item.artwork.includes("%2523"))
    ? item.artwork
    : getArtworkFallback(item.title || item.name, item.artist || item.creator);

  card.innerHTML = `
    <div class="card-artwork-wrapper">
      <img src="${safeArt}" alt="${item.title || item.name}" class="card-artwork-img" loading="lazy" referrerpolicy="no-referrer" onerror="if(typeof window.__musiqImgFallback==='function')window.__musiqImgFallback(this);">
      ${badgeHtml}
      <button class="card-hover-play" title="Play ${item.title || item.name}" aria-label="Play">
        ${isCurrentPlaying ? ICONS.pause : ICONS.play}
      </button>
    </div>
    <div class="card-title" title="${item.title || item.name}">${item.title || item.name}</div>
    <div class="card-subtitle" title="${subtitle}">${subtitle}</div>
    <div class="card-meta-row">
      <span>${type === "radio" ? (item.frequency ? `<span style="color:var(--color-primary);font-weight:600;">${item.frequency}</span>` : (item.bitrate || "LIVE BROADCAST")) : (item.duration ? formatTime(item.duration) : (item.trackCount ? item.trackCount + " tracks" : ""))}</span>
      <div class="card-quick-actions">
        ${type === "song" ? `
          <button class="card-action-btn fav-btn" title="Toggle Favorite">
            ${state.isFavorite(item.id) ? ICONS.heartFilled : ICONS.heart}
          </button>
        ` : ""}
        <button class="card-action-btn menu-btn" title="More options">
          ${ICONS.more}
        </button>
      </div>
    </div>
  `;

  // Click on play button
  const playBtn = card.querySelector(".card-hover-play");
  playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (type === "song") {
      const idx = state.songs.findIndex(s => s.id === item.id);
      state.setQueue(state.songs, idx);
      audioEngine.playTrackAtIndex(idx);
    } else if (type === "album") {
      const albumSongs = state.songs.filter(s => s.albumId === item.id);
      if (albumSongs.length) {
        state.setQueue(albumSongs, 0);
        audioEngine.playTrackAtIndex(0);
      }
    } else if (type === "playlist") {
      const plSongs = item.songIds.map(id => state.getSongById(id)).filter(Boolean);
      if (plSongs.length) {
        state.setQueue(plSongs, 0);
        audioEngine.playTrackAtIndex(0);
      }
    } else if (type === "radio") {
      if (state.isPlaying && (state.isStream || state.currentSong?.source === "radio") && (state.currentStation?.id === item.id || state.currentSong?.id === item.id)) {
        audioEngine.pause();
      } else {
        audioEngine.playRadio(item);
        showToast(`Tuned into ${item.name} (${item.frequency || item.genre})`);
      }
    }
  });

  // Favorite toggle
  const favBtn = card.querySelector(".fav-btn");
  if (favBtn) {
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isFav = state.toggleFavorite(item.id);
      favBtn.innerHTML = isFav ? ICONS.heartFilled : ICONS.heart;
      showToast(isFav ? "Added to Favorites" : "Removed from Favorites");
    });
  }

  // More options context menu
  const menuBtn = card.querySelector(".menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showContextMenu(e.clientX, e.clientY, item, type);
    });
  }

  // Card click navigates or plays
  card.addEventListener("click", () => {
    if (type === "song") {
      const idx = state.songs.findIndex(s => s.id === item.id);
      state.setQueue(state.songs, idx);
      audioEngine.playTrackAtIndex(idx);
    } else if (type === "album") {
      window.location.hash = `#/album-detail/${item.id}`;
    } else if (type === "artist") {
      window.location.hash = `#/artist-detail/${item.id}`;
    } else if (type === "playlist") {
      window.location.hash = `#/playlist-detail/${item.id}`;
    } else if (type === "radio") {
      audioEngine.playRadio(item);
      showToast(`Tuned into ${item.name} (${item.frequency || item.genre})`);
    }
  });

  return card;
}

// Synchronize all active song rows, cards, and queue items across the entire app
export function updateActiveSongRows() {
  const currentSong = state.currentSong;
  const currentId = currentSong?.id;
  const isPlaying = Boolean(state.isPlaying);

  // 1. Sync all song table rows in the DOM
  const allRows = document.querySelectorAll(".song-row");
  allRows.forEach((row) => {
    const rowId = row.dataset.id;
    const isCurrent = Boolean(currentId && rowId === currentId);
    const numLabel = row.querySelector(".song-num-label");
    const playBtn = row.querySelector(".song-row-play-btn");
    const titleCol = row.querySelector(".song-title-text");

    if (isCurrent) {
      if (!row.classList.contains("is-active")) {
        row.classList.add("is-active");
      }

      if (numLabel) {
        numLabel.innerHTML = `
          <div class="spotify-eq-bars mini ${isPlaying ? 'is-playing' : 'is-paused'}" title="${isPlaying ? 'Playing' : 'Paused'}">
            <span class="spotify-eq-bar bar-1"></span>
            <span class="spotify-eq-bar bar-2"></span>
            <span class="spotify-eq-bar bar-3"></span>
            <span class="spotify-eq-bar bar-4"></span>
          </div>
        `;
      }
      if (playBtn) {
        playBtn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
        playBtn.title = isPlaying ? "Pause" : "Play";
      }
      if (titleCol) {
        titleCol.style.color = "var(--color-accent)";
        titleCol.style.fontWeight = "600";
      }
    } else {
      if (row.classList.contains("is-active")) {
        row.classList.remove("is-active");
      }

      if (numLabel) {
        let originalIndex = row.dataset.index;
        if (originalIndex === undefined || originalIndex === null || originalIndex === "") {
          const parentTbody = row.parentElement;
          if (parentTbody) {
            const siblings = Array.from(parentTbody.querySelectorAll(".song-row"));
            const found = siblings.indexOf(row);
            if (found !== -1) {
              originalIndex = found;
              row.dataset.index = originalIndex;
            }
          }
        }
        const displayNum = originalIndex !== undefined && originalIndex !== "" ? (parseInt(originalIndex, 10) + 1) : "";
        numLabel.textContent = displayNum;
      }
      if (playBtn) {
        playBtn.innerHTML = ICONS.play;
        playBtn.title = "Play";
      }
      if (titleCol) {
        titleCol.style.color = "";
        titleCol.style.fontWeight = "";
      }
    }
  });

  // 2. Sync all music cards in the DOM
  const allCards = document.querySelectorAll(".music-card");
  allCards.forEach((card) => {
    const cardId = card.dataset.id;
    const isCurrentCard = Boolean(currentId && cardId === currentId);
    card.classList.toggle("is-playing", isCurrentCard && isPlaying);
    const cardPlayBtn = card.querySelector(".card-hover-play");
    if (cardPlayBtn) {
      cardPlayBtn.innerHTML = (isCurrentCard && isPlaying) ? ICONS.pause : ICONS.play;
    }
  });

  // 3. Sync all queue items in the right panel or modals
  const allQueueItems = document.querySelectorAll(".queue-item");
  allQueueItems.forEach((item) => {
    const qIdx = parseInt(item.dataset.index, 10);
    const isActiveQ = qIdx === state.queueIndex;
    item.classList.toggle("active", isActiveQ);
    item.style.background = isActiveQ ? "rgba(255,45,85,0.12)" : "transparent";
    const titleEl = item.querySelector("div > div");
    if (titleEl) {
      titleEl.style.color = isActiveQ ? "var(--color-accent)" : "var(--color-text-primary)";
    }
  });
}

// Render Song Table Row
export function renderSongRow(song, index, allSongs = null) {
  const tr = document.createElement("tr");
  tr.className = "song-row";
  tr.dataset.id = song.id;
  tr.dataset.index = index;

  const isCurrent = Boolean(state.currentSong && state.currentSong.id === song.id);
  if (isCurrent) tr.classList.add("is-active");

  const safeArt = (song.artwork && !song.artwork.startsWith("blob:") && !song.artwork.includes("%2523"))
    ? song.artwork
    : getArtworkFallback(song.title, song.artist);

  tr.innerHTML = `
    <td class="song-row-num">
      <span class="song-num-label">
        ${isCurrent ? `
          <div class="spotify-eq-bars mini ${state.isPlaying ? 'is-playing' : 'is-paused'}" title="${state.isPlaying ? 'Playing' : 'Paused'}">
            <span class="spotify-eq-bar bar-1"></span>
            <span class="spotify-eq-bar bar-2"></span>
            <span class="spotify-eq-bar bar-3"></span>
            <span class="spotify-eq-bar bar-4"></span>
          </div>
        ` : (index + 1)}
      </span>
      <button class="song-row-play-btn" title="${isCurrent && state.isPlaying ? 'Pause' : 'Play'}">
        ${isCurrent && state.isPlaying ? ICONS.pause : ICONS.play}
      </button>
    </td>
    <td class="song-row-info">
      <div class="song-info-cell">
        <img src="${safeArt}" alt="${song.title}" class="song-thumb" loading="lazy" referrerpolicy="no-referrer" onerror="if(typeof window.__musiqImgFallback==='function')window.__musiqImgFallback(this);">
        <div class="song-title-col">
          <div class="song-title-text" style="${isCurrent ? 'color: var(--color-accent); font-weight: 600;' : ''}" title="${song.title}">
            ${song.title}
          </div>
          <div class="song-artist-text" title="${song.artist}">${song.artist}</div>
        </div>
      </div>
    </td>
    <td class="song-row-album" title="${song.album || 'Single'}">${song.album || "Single"}</td>
    <td class="song-row-format"><span class="badge-pill">${song.format || "MP3"}</span></td>
    <td class="song-row-time">${formatTime(song.duration)}</td>
    <td class="song-row-fav">
      <button class="icon-btn fav-row-btn" title="Favorite">
        ${state.isFavorite(song.id) ? ICONS.heartFilled : ICONS.heart}
      </button>
    </td>
    <td class="song-row-menu">
      <button class="icon-btn menu-row-btn" title="More">
        ${ICONS.more}
      </button>
    </td>
  `;

  // Row Play Button handler (toggle play/pause if current, or play clicked song)
  const rowPlayBtn = tr.querySelector(".song-row-play-btn");
  rowPlayBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.currentSong && state.currentSong.id === song.id) {
      if (state.isPlaying) {
        audioEngine.pause();
      } else {
        audioEngine.play();
      }
    } else {
      const list = (allSongs && allSongs.length > 0) ? allSongs : state.songs;
      const idx = list.findIndex(s => s.id === song.id);
      const playIdx = idx >= 0 ? idx : 0;
      state.setQueue(list, playIdx);
      audioEngine.playTrackAtIndex(playIdx);
    }
  });

  // Entire row click handler
  tr.addEventListener("click", (e) => {
    if (e.target.closest(".fav-row-btn") || e.target.closest(".menu-row-btn") || e.target.closest(".song-row-play-btn")) {
      return;
    }
    if (state.currentSong && state.currentSong.id === song.id) {
      // Toggle play/pause
      if (state.isPlaying) {
        audioEngine.pause();
      } else {
        audioEngine.play();
      }
      return;
    }
    const list = (allSongs && allSongs.length > 0) ? allSongs : state.songs;
    const idx = list.findIndex(s => s.id === song.id);
    const playIdx = idx >= 0 ? idx : 0;
    state.setQueue(list, playIdx);
    audioEngine.playTrackAtIndex(playIdx);
  });

  const favBtn = tr.querySelector(".fav-row-btn");
  favBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isFav = state.toggleFavorite(song.id);
    favBtn.innerHTML = isFav ? ICONS.heartFilled : ICONS.heart;
    showToast(isFav ? "Saved to Loved Songs" : "Removed from Loved Songs");
  });

  const menuBtn = tr.querySelector(".menu-row-btn");
  menuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const btnRect = menuBtn.getBoundingClientRect();
    const x = (e.clientX && e.clientX > 0) ? e.clientX : (btnRect.left - 160);
    const y = (e.clientY && e.clientY > 0) ? e.clientY : btnRect.bottom;
    showContextMenu(x, y, song, "song");
  });

  return tr;
}

// Context menu popup
export function showContextMenu(x, y, item, type = "song") {
  closeContextMenu();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.id = "active-context-menu";

  if (type === "song") {
    menu.innerHTML = `
      <div class="context-item" data-action="play">${ICONS.play} <span>Play</span></div>
      <div class="context-item" data-action="play-next">${ICONS.next} <span>Play Next</span></div>
      <div class="context-item" data-action="add-queue">${ICONS.queue} <span>Add to Queue</span></div>
      <div class="context-divider"></div>
      <div class="context-item" data-action="toggle-fav">${state.isFavorite(item.id) ? ICONS.heartFilled : ICONS.heart} <span>${state.isFavorite(item.id) ? "Remove Favorite" : "Add to Favorite"}</span></div>
      <div class="context-item" data-action="add-playlist">${ICONS.plus} <span>Add to Playlist...</span></div>
      <div class="context-divider"></div>
      <div class="context-item" data-action="lyrics">${ICONS.lyrics} <span>Show Lyrics</span></div>
      <div class="context-item" data-action="smart-art"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg> <span>Smart Thumbnail</span></div>
      <div class="context-item" data-action="change-art"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg> <span>Change Album Art...</span></div>
      <div class="context-item" data-action="share">${ICONS.share} <span>Share Song</span></div>
      <div class="context-item" data-action="edit-meta">${ICONS.settings} <span>Edit Metadata</span></div>
      <div class="context-item" data-action="download">${ICONS.download} <span>Download Offline</span></div>
      <div class="context-divider"></div>
      <div class="context-item" data-action="delete-song" style="color:var(--color-error, #ff4d4f);">${ICONS.trash} <span>Remove from Library</span></div>
    `;
  } else {
    menu.innerHTML = `
      <div class="context-item" data-action="play">${ICONS.play} <span>Play All</span></div>
      <div class="context-item" data-action="share">${ICONS.share} <span>Share</span></div>
    `;
  }

  document.body.appendChild(menu);

  // Position bounded
  const rect = menu.getBoundingClientRect();
  let left = x;
  let top = y;
  if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;
  if (left < 10) left = 10;
  if (top + rect.height > window.innerHeight - 10) top = window.innerHeight - rect.height - 10;
  if (top < 10) top = 10;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  menu.querySelectorAll(".context-item").forEach(el => {
    el.addEventListener("click", () => {
      const action = el.dataset.action;
      handleContextAction(action, item, type);
      closeContextMenu();
    });
  });

  const outsideClick = (e) => {
    if (!menu.contains(e.target)) {
      closeContextMenu();
      document.removeEventListener("click", outsideClick);
    }
  };
  setTimeout(() => document.addEventListener("click", outsideClick), 50);
}

export function closeContextMenu() {
  const existing = document.getElementById("active-context-menu");
  if (existing) existing.remove();
}

function handleContextAction(action, item, type) {
  switch (action) {
    case "play":
      if (type === "song") {
        const idx = state.songs.findIndex(s => s.id === item.id);
        state.setQueue(state.songs, idx);
        audioEngine.playTrackAtIndex(idx);
      }
      break;
    case "play-next":
      state.addToQueue(item, true);
      showToast(`Playing next: ${item.title}`);
      break;
    case "add-queue":
      state.addToQueue(item, false);
      showToast(`Added to queue: ${item.title}`);
      break;
    case "toggle-fav":
      state.toggleFavorite(item.id);
      showToast(state.isFavorite(item.id) ? "Added to Favorites" : "Removed from Favorites");
      break;
    case "add-playlist":
      openAddToPlaylistModal(item);
      break;
    case "lyrics":
      window.location.hash = "#/lyrics";
      break;
    case "smart-art":
      showToast(`Searching official HD cover for "${item.title}"...`, "info");
      smartArtworkService.fetchSmartArtwork(item.title, item.artist, item.album).then(art => {
        if (art) {
          smartArtworkService.applyArtworkToSong(item.id, art, localLibraryService);
          showToast(`Applied smart thumbnail for "${item.title}"!`, "accent");
        } else {
          showToast(`No exact match. Opening cover picker...`, "info");
          smartArtworkService.openArtworkPickerModal(item, localLibraryService);
        }
      });
      break;
    case "change-art":
      smartArtworkService.openArtworkPickerModal(item, localLibraryService);
      break;
    case "share":
      if (navigator.share) {
        navigator.share({ title: item.title, text: `Listen to ${item.title} by ${item.artist} on VIORA` }).catch(() => {});
      } else {
        navigator.clipboard.writeText(`${window.location.origin}/#/song/${item.id}`);
        showToast("Link copied to clipboard!");
      }
      break;
    case "edit-meta":
      openEditMetadataModal(item);
      break;
    case "download":
      showToast(`Saved ${item.title} to offline storage.`);
      break;
    case "delete-local":
    case "delete-song": {
      const isLocal = item.source === "local" || item.isCustom || (item.id && item.id.startsWith("local:")) || (typeof localLibraryService !== "undefined" && localLibraryService.localTracks.some(t => t.id === item.id));

      if (isLocal && typeof localLibraryService !== "undefined") {
        localLibraryService.removeLocalTrack(item.id);
      } else {
        state.removeSong(item.id);
      }

      // Smoothly animate and remove all matching rows from table and queue DOM
      const matchingRows = document.querySelectorAll(`tr[data-id="${item.id}"], .song-row[data-id="${item.id}"]`);
      matchingRows.forEach((r) => {
        r.style.transition = "all 0.25s ease";
        r.style.opacity = "0";
        r.style.transform = "translateX(24px)";
        setTimeout(() => {
          r.remove();
        }, 250);
      });

      // Update count text if displayed on screen
      const localCountText = document.getElementById("local-tracks-count-text");
      if (localCountText && typeof localLibraryService !== "undefined") {
        localCountText.textContent = `${localLibraryService.localTracks.length} tracks stored in device browser sandbox`;
      }
      const songsCountText = document.getElementById("all-songs-count-text");
      if (songsCountText) {
        songsCountText.textContent = `${state.songs.length} tracks in studio quality`;
      }

      showToast(`Removed "${item.title || "Song"}" from library`, "info");
      break;
    }
  }
}

// Modal dialog system
export function openModal(title, contentHtml, footerHtml = "", extraClass = "") {
  const overlay = document.getElementById("modal-overlay");
  const container = document.getElementById("modal-container");
  if (!overlay || !container) return;

  container.innerHTML = `
    <div class="modal-box ${extraClass}">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="icon-btn modal-close-btn" title="Close">${ICONS.close}</button>
      </div>
      <div class="modal-content">${contentHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
    </div>
  `;

  overlay.classList.add("open");
  const closeBtn = container.querySelector(".modal-close-btn");
  closeBtn?.addEventListener("click", closeModal);

  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };
}

export function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  if (overlay) overlay.classList.remove("open");
}

function openAddToPlaylistModal(song) {
  let plListHtml = state.playlists.map(p => `
    <div class="playlist-choice-item" data-id="${p.id}" style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;cursor:pointer;background:var(--color-bg-card);margin-bottom:8px;">
      <img src="${p.artwork}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">
      <div style="flex:1;">
        <div style="font-weight:600;">${p.title}</div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);">${p.songIds.length} tracks</div>
      </div>
      <span>${ICONS.plus}</span>
    </div>
  `).join("");

  openModal("Add to Playlist", `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <p style="font-size:0.85rem;color:var(--color-text-muted);">Choose a playlist to add "<strong>${song.title}</strong>":</p>
      <div style="max-height:300px;overflow-y:auto;">
        ${plListHtml}
      </div>
    </div>
  `);

  const container = document.getElementById("modal-container");
  container.querySelectorAll(".playlist-choice-item").forEach(item => {
    item.addEventListener("click", () => {
      const plId = item.dataset.id;
      playlistManager.addSongToPlaylist(plId, song.id);
      showToast("Added song to playlist!");
      closeModal();
    });
  });
}

function openEditMetadataModal(song) {
  let pendingArtwork = song.artwork;
  const initialThumb = (song.artwork && !song.artwork.startsWith("blob:"))
    ? song.artwork
    : getArtworkFallback(song.title, song.artist);

  openModal("Edit Song Metadata", `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- Artwork Preview & Smart Thumbnail Action -->
      <div style="display:flex;align-items:center;gap:14px;padding:10px 12px;border-radius:10px;background:var(--color-bg-card);border:1px solid var(--color-border);">
        <img id="meta-thumb-preview" src="${initialThumb}" alt="${song.title}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;box-shadow:var(--shadow-sm);flex-shrink:0;">
        <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;">
          <div style="font-size:0.75rem;font-weight:600;color:var(--color-text-muted);">Album Artwork</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn-secondary" id="meta-autofetch-btn" style="padding:4px 10px;font-size:0.75rem;border-radius:6px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>
              <span>Auto Smart Cover</span>
            </button>
            <button type="button" class="btn-secondary" id="meta-browse-art-btn" style="padding:4px 10px;font-size:0.75rem;border-radius:6px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
              <span>Browse / Upload</span>
            </button>
          </div>
        </div>
      </div>

      <div>
        <label style="font-size:0.75rem;color:var(--color-text-muted);">Title</label>
        <input type="text" id="meta-title" value="${song.title}" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--color-bg-surface-elevated);border:1px solid var(--color-border);margin-top:4px;">
      </div>
      <div>
        <label style="font-size:0.75rem;color:var(--color-text-muted);">Artist</label>
        <input type="text" id="meta-artist" value="${song.artist}" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--color-bg-surface-elevated);border:1px solid var(--color-border);margin-top:4px;">
      </div>
      <div>
        <label style="font-size:0.75rem;color:var(--color-text-muted);">Album</label>
        <input type="text" id="meta-album" value="${song.album}" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--color-bg-surface-elevated);border:1px solid var(--color-border);margin-top:4px;">
      </div>
      <div>
        <label style="font-size:0.75rem;color:var(--color-text-muted);">Genre</label>
        <input type="text" id="meta-genre" value="${song.genre}" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--color-bg-surface-elevated);border:1px solid var(--color-border);margin-top:4px;">
      </div>
      <p style="font-size:0.72rem;color:var(--color-text-dim);">* Metadata & smart artwork changes are saved in browser storage.</p>
    </div>
  `, `
    <button class="btn-secondary" id="meta-cancel-btn">Cancel</button>
    <button class="btn-primary" id="meta-save-btn">Save Changes</button>
  `);

  const preview = document.getElementById("meta-thumb-preview");
  const autoFetchBtn = document.getElementById("meta-autofetch-btn");
  const browseArtBtn = document.getElementById("meta-browse-art-btn");

  autoFetchBtn?.addEventListener("click", async () => {
    const titleVal = document.getElementById("meta-title")?.value || song.title;
    const artistVal = document.getElementById("meta-artist")?.value || song.artist;
    const albumVal = document.getElementById("meta-album")?.value || song.album;
    autoFetchBtn.disabled = true;
    autoFetchBtn.textContent = "Searching...";
    try {
      const art = await smartArtworkService.fetchSmartArtwork(titleVal, artistVal, albumVal);
      if (art) {
        pendingArtwork = art;
        if (preview) preview.src = art;
        showToast("Official smart cover found!", "accent");
      } else {
        showToast("No exact cover found online.", "info");
      }
    } finally {
      autoFetchBtn.disabled = false;
      autoFetchBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>
        <span>Auto Smart Cover</span>
      `;
    }
  });

  browseArtBtn?.addEventListener("click", () => {
    closeModal();
    smartArtworkService.openArtworkPickerModal(song, localLibraryService);
  });

  document.getElementById("meta-cancel-btn")?.addEventListener("click", closeModal);
  document.getElementById("meta-save-btn")?.addEventListener("click", async () => {
    song.title = document.getElementById("meta-title").value;
    song.artist = document.getElementById("meta-artist").value;
    song.album = document.getElementById("meta-album").value;
    song.genre = document.getElementById("meta-genre").value;
    if (pendingArtwork && pendingArtwork !== song.artwork) {
      await smartArtworkService.applyArtworkToSong(song.id, pendingArtwork, localLibraryService);
    }
    state.notify("songMetadataUpdated", song);
    showToast("Metadata updated successfully!");
    closeModal();
  });
}
