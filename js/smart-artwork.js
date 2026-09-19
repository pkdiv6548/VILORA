import { state } from "./state.js";
import { storage } from "./storage.js";
import { cleanTrackTitle, cleanArtistName } from "./lyrics.js";
import { getArtworkFallback, showToast, openModal, closeModal, ICONS } from "./components.js";

// Cache key for persistent artwork cache
const ARTWORK_CACHE_KEY = "musiq_smart_artworks_v1";

export class SmartArtworkService {
  constructor() {
    this.cache = this.loadCache();
    this.pendingRequests = new Map();
    this.isEnriching = false;
  }

  loadCache() {
    try {
      const raw = localStorage.getItem(ARTWORK_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  saveCache() {
    try {
      // Limit cache to newest 400 entries to prevent localStorage quota issues
      const keys = Object.keys(this.cache);
      if (keys.length > 400) {
        const excess = keys.slice(0, keys.length - 350);
        excess.forEach(k => delete this.cache[k]);
      }
      localStorage.setItem(ARTWORK_CACHE_KEY, JSON.stringify(this.cache));
    } catch (e) {
      console.warn("Could not save smart artwork cache:", e);
    }
  }

  getCacheKey(title, artist) {
    const t = (title || "").toLowerCase().trim();
    const a = (artist || "").toLowerCase().trim();
    return `${t}___${a}`;
  }

  /**
   * Search iTunes Search API for official album artwork.
   * Returns HD URL (600x600) or null.
   */
  async fetchSmartArtwork(title, artist = "", album = "") {
    const cleanTitle = cleanTrackTitle(title);
    let cleanArtist = cleanArtistName(artist);
    // Remove extra trailing dashes or domain remnants in artist
    cleanArtist = cleanArtist
      .replace(/[-–|].*$/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanTitle) return null;

    const cacheKey = this.getCacheKey(cleanTitle, cleanArtist);
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    // Deduplicate in-flight requests
    if (this.pendingRequests.has(cacheKey)) {
      return await this.pendingRequests.get(cacheKey);
    }

    const promise = (async () => {
      // Strategy 1: Title + Artist
      let result = null;
      if (cleanArtist && cleanArtist !== "Local Artist" && cleanArtist !== "Unknown Artist") {
        result = await this.queryItunes(`${cleanTitle} ${cleanArtist}`);
      }

      // Strategy 2: Title + Album
      if (!result && album && album !== "Unknown Album" && !album.toLowerCase().includes("single")) {
        const cleanAlbum = album.replace(/[-–|].*$/, "").trim();
        result = await this.queryItunes(`${cleanTitle} ${cleanAlbum}`);
      }

      // Strategy 3: Clean Title alone
      if (!result) {
        result = await this.queryItunes(cleanTitle);
      }

      if (result && result.artwork) {
        this.cache[cacheKey] = result.artwork;
        this.saveCache();
        return result.artwork;
      }

      return null;
    })();

    this.pendingRequests.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Internal query to iTunes Search API (CORS enabled)
   */
  async queryItunes(term, limit = 4) {
    if (!term || !term.trim()) return null;
    const cleanTerm = term
      .replace(/[-_]/g, " ")
      .replace(/[^\w\s\u0900-\u097F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTerm)}&entity=song&limit=${limit}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.results || data.results.length === 0) return null;

      // Find best match or default to first
      const item = data.results[0];
      if (item && item.artworkUrl100) {
        const hdArtwork = item.artworkUrl100.replace(/\/\d+x\d+bb\.jpg$/, "/600x600bb.jpg");
        return {
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName,
          artwork: hdArtwork,
          artwork100: item.artworkUrl100
        };
      }
    } catch (e) {
      console.warn("iTunes search error:", e.message || e);
    }
    return null;
  }

  /**
   * Search multiple candidate artwork options for user selection modal
   */
  async searchArtworkOptions(query, limit = 8) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=song&limit=${limit}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.results) return [];

      return data.results.map((r) => ({
        id: r.trackId,
        title: r.trackName,
        artist: r.artistName,
        album: r.collectionName,
        artworkUrl: r.artworkUrl100.replace(/\/\d+x\d+bb\.jpg$/, "/600x600bb.jpg"),
        artworkThumb: r.artworkUrl100
      }));
    } catch (e) {
      console.warn("Error fetching artwork options:", e);
      return [];
    }
  }

  /**
   * Check if an artwork is a placeholder/fallback (SVG or empty) vs a real cover photo
   */
  isArtworkFallback(artwork) {
    if (!artwork) return true;
    if (artwork.startsWith("data:image/svg") || artwork.startsWith("blob:") || artwork.includes("%2523")) {
      return true;
    }
    return false;
  }

  /**
   * Enriches a single track if missing real artwork.
   */
  async enrichTrack(track, force = false) {
    if (!track) return null;
    if (!force && !this.isArtworkFallback(track.artwork)) {
      return track.artwork;
    }

    const smartArt = await this.fetchSmartArtwork(track.title, track.artist, track.album);
    if (smartArt) {
      track.artwork = smartArt;
      this.updateDOMElementsForSong(track.id, smartArt);
      return smartArt;
    }
    return null;
  }

  /**
   * Batch auto-enrichment for local tracks with progress feedback
   */
  async batchEnrichTracks(tracks, onProgress = null) {
    if (!tracks || tracks.length === 0 || this.isEnriching) return { matched: 0, total: 0 };
    this.isEnriching = true;

    // Filter tracks needing artwork
    const needingArtwork = tracks.filter((t) => this.isArtworkFallback(t.artwork));
    const total = needingArtwork.length;
    let matched = 0;

    for (let i = 0; i < needingArtwork.length; i++) {
      const track = needingArtwork[i];
      try {
        const smartArt = await this.fetchSmartArtwork(track.title, track.artist, track.album);
        if (smartArt) {
          track.artwork = smartArt;
          matched++;
          this.updateDOMElementsForSong(track.id, smartArt);
        }
      } catch (err) {
        console.warn(`Smart artwork error for ${track.title}:`, err);
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          matched,
          track
        });
      }

      // Small delay between requests to be friendly to iTunes API
      await new Promise((r) => setTimeout(r, 180));
    }

    this.isEnriching = false;
    return { matched, total };
  }

  /**
   * Real-time update all DOM images rendering this song across rows, cards, player bar, etc.
   */
  updateDOMElementsForSong(songId, newArtwork) {
    if (!songId || !newArtwork) return;

    // 1. Song table rows
    const matchingRows = document.querySelectorAll(`tr[data-id="${songId}"], .song-row[data-id="${songId}"]`);
    matchingRows.forEach((row) => {
      const img = row.querySelector(".song-thumb, img");
      if (img) {
        img.src = newArtwork;
        img.style.transition = "opacity 0.3s ease";
        img.style.opacity = "0.4";
        setTimeout(() => { img.style.opacity = "1"; }, 50);
      }
    });

    // 2. Music cards
    const matchingCards = document.querySelectorAll(`.music-card[data-id="${songId}"]`);
    matchingCards.forEach((card) => {
      const img = card.querySelector(".card-artwork-img, img");
      if (img) img.src = newArtwork;
    });

    // 3. Queue items
    const queueItems = document.querySelectorAll(`.queue-item[data-song-id="${songId}"]`);
    queueItems.forEach((item) => {
      const img = item.querySelector("img");
      if (img) img.src = newArtwork;
    });

    // 4. If current playing song matches
    if (state.currentSong && state.currentSong.id === songId) {
      state.currentSong.artwork = newArtwork;
      const playerThumb = document.getElementById("player-thumb");
      if (playerThumb) playerThumb.src = newArtwork;
      const fsArt = document.getElementById("fs-artwork-img");
      if (fsArt) fsArt.src = newArtwork;
      const fsBackdrop = document.getElementById("fs-backdrop");
      if (fsBackdrop) fsBackdrop.style.backgroundImage = `url('${newArtwork}')`;
    }
  }

  /**
   * Apply and permanently save new artwork to a song
   */
  async applyArtworkToSong(songId, newArtwork, localServiceInstance = null) {
    if (!songId || !newArtwork) return;

    // Update in state.songs
    const songInState = state.songs.find((s) => s.id === songId);
    if (songInState) songInState.artwork = newArtwork;

    // Update in state.queue
    state.queue.forEach((s) => {
      if (s.id === songId) s.artwork = newArtwork;
    });

    // Update in local library if applicable
    const localSvc = localServiceInstance || (typeof window !== "undefined" ? window.localLibraryService : null);
    if (localSvc && localSvc.localTracks) {
      const localTrack = localSvc.localTracks.find((t) => t.id === songId);
      if (localTrack) {
        localTrack.artwork = newArtwork;
        localSvc.persistLibrary();
      }
    } else {
      // Also update in localStorage customSongs / localMusicLibrary
      try {
        const localList = storage.getItem("localMusicLibrary", []) || [];
        const customList = storage.getItem("customSongs", []) || [];
        let updated = false;

        const updateItem = (item) => {
          if (item.id === songId) {
            item.artwork = newArtwork;
            updated = true;
          }
        };
        localList.forEach(updateItem);
        customList.forEach(updateItem);

        if (updated) {
          storage.setItem("localMusicLibrary", localList);
          storage.setItem("customSongs", customList);
        }
      } catch (e) {
        console.warn("Storage artwork update error:", e);
      }
    }

    // Cache it for fast retrieval
    if (songInState) {
      const cKey = this.getCacheKey(songInState.title, songInState.artist);
      this.cache[cKey] = newArtwork;
      this.saveCache();
    }

    // Live update DOM
    this.updateDOMElementsForSong(songId, newArtwork);
    state.notify("songArtworkChanged", { id: songId, artwork: newArtwork });
  }

  /**
   * Open the interactive Smart Artwork Picker Modal
   */
  openArtworkPickerModal(song, localServiceInstance = null) {
    if (!song) return;
    const cleanTitle = cleanTrackTitle(song.title);
    const cleanArtist = cleanArtistName(song.artist);
    const defaultQuery = `${cleanTitle} ${cleanArtist}`.trim();

    const currentArt = (song.artwork && !song.artwork.startsWith("blob:"))
      ? song.artwork
      : getArtworkFallback(song.title, song.artist);

    const isFallback = this.isArtworkFallback(song.artwork);

    openModal(
      "Smart Album Thumbnail",
      `
      <div style="display:flex;flex-direction:column;gap:18px;max-width:540px;width:100%;">
        <!-- Track info preview -->
        <div style="display:flex;align-items:center;gap:16px;padding:12px 14px;background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:12px;">
          <img id="modal-art-preview" src="${currentArt}" alt="${song.title}" style="width:68px;height:68px;border-radius:8px;object-fit:cover;box-shadow:var(--shadow-sm);flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${song.title}</div>
            <div style="color:var(--color-text-secondary);font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">${song.artist || "Unknown Artist"}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
              <span class="badge-pill" style="font-size:0.7rem;padding:2px 8px;background:${isFallback ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'};color:${isFallback ? '#f59e0b' : '#10b981'};font-weight:600;">
                ${isFallback ? "Procedural Fallback" : "Official / Custom Artwork"}
              </span>
            </div>
          </div>
        </div>

        <!-- Search Bar for Online Covers -->
        <div>
          <label style="font-size:0.78rem;font-weight:600;color:var(--color-text-muted);display:block;margin-bottom:6px;">Search Official HD Covers Online</label>
          <div style="display:flex;gap:8px;">
            <div style="position:relative;flex:1;">
              <input type="text" id="modal-art-search-input" value="${defaultQuery}" placeholder="Search track or artist name..." style="width:100%;padding:9px 12px;border-radius:8px;background:var(--color-bg-surface-elevated);border:1px solid var(--color-border);color:var(--color-text-primary);font-size:0.86rem;">
            </div>
            <button class="btn-primary" id="modal-art-search-btn" style="padding:9px 16px;border-radius:8px;font-size:0.84rem;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>Find Covers</span>
            </button>
          </div>
        </div>

        <!-- Results Grid -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:0.78rem;font-weight:600;color:var(--color-text-muted);">Select Matching Album Art</span>
            <span id="modal-art-status-text" style="font-size:0.75rem;color:var(--color-text-dim);">Tap any cover to apply</span>
          </div>
          <div id="modal-art-results-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(105px, 1fr));gap:10px;max-height:220px;overflow-y:auto;padding:4px;border-radius:8px;background:var(--color-bg-base);border:1px solid var(--color-border);min-height:120px;">
            <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;color:var(--color-text-muted);font-size:0.82rem;gap:8px;">
              <div class="loader-spinner" style="width:24px;height:24px;border:2px solid rgba(255,255,255,0.1);border-top-color:var(--color-accent);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
              <span>Searching official high-resolution album covers...</span>
            </div>
          </div>
        </div>

        <!-- Custom Image & Manual Actions -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--color-border);">
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn-secondary" id="modal-art-upload-btn" style="padding:7px 14px;border-radius:6px;font-size:0.8rem;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
              <span>Upload Custom Image</span>
            </button>
            <input type="file" id="modal-art-file-input" accept="image/png,image/jpeg,image/webp,image/jpg" style="display:none;">
            <button class="btn-secondary" id="modal-art-reset-btn" style="padding:7px 14px;border-radius:6px;font-size:0.8rem;cursor:pointer;color:var(--color-text-muted);">
              Reset to Vinyl
            </button>
          </div>
          <button class="btn-secondary" id="modal-art-close-btn" style="padding:7px 16px;border-radius:6px;font-size:0.82rem;cursor:pointer;">
            Close
          </button>
        </div>
      </div>
      `,
      "",
      "smart-artwork-modal"
    );

    const searchInput = document.getElementById("modal-art-search-input");
    const searchBtn = document.getElementById("modal-art-search-btn");
    const resultsGrid = document.getElementById("modal-art-results-grid");
    const statusText = document.getElementById("modal-art-status-text");
    const previewImg = document.getElementById("modal-art-preview");
    const uploadBtn = document.getElementById("modal-art-upload-btn");
    const fileInput = document.getElementById("modal-art-file-input");
    const resetBtn = document.getElementById("modal-art-reset-btn");
    const closeBtn = document.getElementById("modal-art-close-btn");

    closeBtn?.addEventListener("click", closeModal);

    const performSearch = async (q) => {
      if (!resultsGrid) return;
      resultsGrid.innerHTML = `
        <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;color:var(--color-text-muted);font-size:0.82rem;gap:8px;">
          <div class="loader-spinner" style="width:24px;height:24px;border:2px solid rgba(255,255,255,0.1);border-top-color:var(--color-accent);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <span>Searching covers for "${q}"...</span>
        </div>
      `;

      const options = await this.searchArtworkOptions(q, 10);
      if (!options || options.length === 0) {
        resultsGrid.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--color-text-muted);font-size:0.82rem;">
            No covers found for "${q}". Try editing the search terms or upload a custom image.
          </div>
        `;
        if (statusText) statusText.textContent = "0 results found";
        return;
      }

      if (statusText) statusText.textContent = `Found ${options.length} official covers`;

      resultsGrid.innerHTML = options.map((opt) => `
        <div class="art-option-card" data-url="${opt.artworkUrl}" title="${opt.title} - ${opt.artist} (${opt.album || ''})" style="cursor:pointer;display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:8px;background:var(--color-bg-card);border:1px solid var(--color-border);transition:all 0.2s ease;">
          <img src="${opt.artworkUrl}" alt="${opt.title}" loading="lazy" style="width:100%;aspect-ratio:1/1;border-radius:6px;object-fit:cover;">
          <div style="font-size:0.72rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--color-text-primary);">${opt.title}</div>
          <div style="font-size:0.68rem;color:var(--color-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${opt.artist}</div>
        </div>
      `).join("");

      resultsGrid.querySelectorAll(".art-option-card").forEach((card) => {
        card.addEventListener("click", async () => {
          const newUrl = card.dataset.url;
          if (!newUrl) return;

          // Selected highlight
          resultsGrid.querySelectorAll(".art-option-card").forEach(c => {
            c.style.borderColor = "var(--color-border)";
            c.style.transform = "scale(1)";
          });
          card.style.borderColor = "var(--color-accent)";
          card.style.transform = "scale(1.04)";

          if (previewImg) previewImg.src = newUrl;
          await this.applyArtworkToSong(song.id, newUrl, localServiceInstance);
          showToast(`Cover updated for "${song.title}"!`, "accent");
        });
      });
    };

    searchBtn?.addEventListener("click", () => {
      const q = searchInput?.value?.trim();
      if (q) performSearch(q);
    });

    searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = searchInput?.value?.trim();
        if (q) performSearch(q);
      }
    });

    // Custom File Upload
    uploadBtn?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result;
        if (dataUrl) {
          if (previewImg) previewImg.src = dataUrl;
          await this.applyArtworkToSong(song.id, dataUrl, localServiceInstance);
          showToast(`Custom image applied to "${song.title}"!`, "accent");
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset to SVG vinyl fallback
    resetBtn?.addEventListener("click", async () => {
      const fallbackUrl = getArtworkFallback(song.title, song.artist);
      if (previewImg) previewImg.src = fallbackUrl;
      await this.applyArtworkToSong(song.id, fallbackUrl, localServiceInstance);
      showToast(`Reset to procedural artwork.`, "info");
    });

    // Auto-trigger search immediately
    performSearch(defaultQuery);
  }
}

export const smartArtworkService = new SmartArtworkService();
if (typeof window !== "undefined") {
  window.smartArtworkService = smartArtworkService;
}
