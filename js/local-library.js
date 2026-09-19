import { state } from "./state.js";
import { storage } from "./storage.js";
import { cleanTrackTitle, cleanArtistName } from "./lyrics.js";
import { showToast, getArtworkFallback } from "./components.js";
import { smartArtworkService } from "./smart-artwork.js";

// ID3 Parser helper in pure JavaScript to extract title, artist, album, genre, year, and embedded APIC artwork
export class ID3Parser {
  static async parse(file) {
    try {
      // First read 10 bytes to get ID3 header and tag size
      const headerBuf = await file.slice(0, 10).arrayBuffer();
      if (headerBuf.byteLength < 10) return null;
      const headerView = new DataView(headerBuf);

      // Check ID3v2 header: 'ID3'
      if (
        headerView.getUint8(0) === 0x49 && // 'I'
        headerView.getUint8(1) === 0x44 && // 'D'
        headerView.getUint8(2) === 0x33    // '3'
      ) {
        const rawSize =
          ((headerView.getUint8(6) & 0x7f) << 21) |
          ((headerView.getUint8(7) & 0x7f) << 14) |
          ((headerView.getUint8(8) & 0x7f) << 7) |
          (headerView.getUint8(9) & 0x7f);

        // Read the full ID3 chunk (up to 4MB for high-res embedded album artwork)
        const readLen = Math.min(rawSize + 10, Math.min(file.size, 4 * 1024 * 1024));
        const buffer = await file.slice(0, readLen).arrayBuffer();
        const view = new DataView(buffer);
        return await this.parseID3v2(view, buffer);
      }
    } catch (e) {
      console.warn("ID3 parser exception:", e);
    }
    return null;
  }

  static async parseID3v2(view, buffer) {
    const version = view.getUint8(3);
    const size =
      ((view.getUint8(6) & 0x7f) << 21) |
      ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) |
      (view.getUint8(9) & 0x7f);

    const tags = {};
    let offset = 10;
    const maxOffset = Math.min(size + 10, buffer.byteLength - 10);

    while (offset < maxOffset) {
      // Read 4-character frame ID
      let frameId = "";
      for (let i = 0; i < 4; i++) {
        const charCode = view.getUint8(offset + i);
        if (charCode >= 32 && charCode <= 126) {
          frameId += String.fromCharCode(charCode);
        }
      }

      if (frameId.length < 4 || frameId.charCodeAt(0) === 0) break;

      // Frame size
      let frameSize = 0;
      if (version === 4) {
        frameSize =
          ((view.getUint8(offset + 4) & 0x7f) << 21) |
          ((view.getUint8(offset + 5) & 0x7f) << 14) |
          ((view.getUint8(offset + 6) & 0x7f) << 7) |
          (view.getUint8(offset + 7) & 0x7f);
      } else {
        frameSize = view.getUint32(offset + 4, false);
      }

      if (frameSize <= 0 || offset + 10 + frameSize > buffer.byteLength) break;

      const frameDataOffset = offset + 10;

      // Text frames: TIT2 (Title), TPE1 (Artist), TALB (Album), TCON (Genre), TYER/TDRC (Year)
      if (["TIT2", "TPE1", "TALB", "TCON", "TYER", "TDRC", "TRCK"].includes(frameId)) {
        try {
          const encoding = view.getUint8(frameDataOffset);
          const rawBytes = new Uint8Array(buffer, frameDataOffset + 1, frameSize - 1);
          let text = "";
          if (encoding === 0 || encoding === 3) {
            text = new TextDecoder(encoding === 3 ? "utf-8" : "iso-8859-1").decode(rawBytes);
          } else {
            text = new TextDecoder("utf-16").decode(rawBytes);
          }
          text = text.replace(/\0+$/, "").trim();

          if (frameId === "TIT2") tags.title = text;
          if (frameId === "TPE1") tags.artist = text;
          if (frameId === "TALB") tags.album = text;
          if (frameId === "TCON") tags.genre = text;
          if (frameId === "TYER" || frameId === "TDRC") tags.year = parseInt(text, 10) || null;
        } catch (e) {}
      }

      // APIC: Attached Picture (Embedded Album Art)
      if (frameId === "APIC") {
        try {
          const picBytes = new Uint8Array(buffer, frameDataOffset, frameSize);
          let mimeEnd = 1;
          while (mimeEnd < picBytes.length && picBytes[mimeEnd] !== 0) {
            mimeEnd++;
          }
          const mimeType = new TextDecoder("ascii").decode(picBytes.subarray(1, mimeEnd)).trim() || "image/jpeg";
          let picStart = mimeEnd + 2; // skip picture type byte
          // skip description until 0
          while (picStart < picBytes.length && picBytes[picStart] !== 0) {
            picStart++;
          }
          picStart++; // past null
          if (picBytes[picStart] === 0) picStart++;

          const imgData = picBytes.subarray(picStart);
          if (imgData.length > 100) {
            const blob = new Blob([imgData], { type: mimeType.startsWith("image/") ? mimeType : "image/jpeg" });
            // Convert to persistent Base64 Data URL so album artwork survives refreshes & browser restarts
            tags.artworkUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
          }
        } catch (e) {
          console.warn("APIC parse error", e);
        }
      }

      offset += 10 + frameSize;
    }

    return tags;
  }
}

export class LocalLibraryService {
  constructor() {
    this.localTracks = [];
    this.activeObjectUrls = new Set();
    this.filterTab = "all"; // all, recent-added, recent-played, artists, albums, genres
    this.searchTerm = "";
    this.init();
    this.setupGlobalInputs();
  }

  setupGlobalInputs() {
    const bindInputs = () => {
      const fileInput = document.getElementById("global-device-audio-input");
      const folderInput = document.getElementById("global-device-folder-input");

      if (fileInput && !fileInput.dataset.bound) {
        fileInput.dataset.bound = "true";
        fileInput.addEventListener("change", async (e) => {
          if (e.target.files && e.target.files.length) {
            const count = e.target.files.length;
            showToast(`Importing ${count} audio track(s) from device...`, "info");
            const res = await this.importFiles(e.target.files);
            const imported = res.added || [];
            if (imported.length > 0) {
              showToast(`Loaded ${imported.length} new song(s) from device!`, "success");
            } else if (res.duplicates > 0) {
              showToast(`${res.duplicates} song(s) are already in your local library.`, "info");
            }
            if (this.localTracks.length > 0) {
              state.loadLocalMusicQueue(this.localTracks);
              if (imported.length > 0 && !state.isPlaying) {
                const idx = this.localTracks.findIndex((t) => t.id === imported[0].id);
                if (idx >= 0) {
                  state.setCurrentSong(this.localTracks[idx]);
                  state.notify("playRequest", this.localTracks[idx]);
                }
              }
            }
            e.target.value = "";
            if (window.location.hash !== "#/local") {
              window.location.hash = "#/local";
            } else {
              state.notify("localLibraryChanged", this.localTracks);
            }
          }
        });
      }

      if (folderInput && !folderInput.dataset.bound) {
        folderInput.dataset.bound = "true";
        folderInput.addEventListener("change", async (e) => {
          if (e.target.files && e.target.files.length) {
            const count = e.target.files.length;
            showToast(`Scanning folder for audio files...`, "info");
            const res = await this.importFiles(e.target.files);
            const imported = res.added || [];
            if (imported.length > 0) {
              showToast(`Imported ${imported.length} track(s) from folder!`, "success");
            } else if (res.duplicates > 0) {
              showToast(`${res.duplicates} song(s) were already in library.`, "info");
            }
            if (this.localTracks.length > 0) {
              state.loadLocalMusicQueue(this.localTracks);
            }
            e.target.value = "";
            if (window.location.hash !== "#/local") {
              window.location.hash = "#/local";
            } else {
              state.notify("localLibraryChanged", this.localTracks);
            }
          }
        });
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindInputs);
    } else {
      bindInputs();
    }
  }

  triggerAutoLoadDeviceSongs() {
    const input = document.getElementById("global-device-audio-input") || document.getElementById("local-file-input");
    if (input) {
      try {
        input.click();
      } catch (err) {
        console.warn("Could not trigger audio file input:", err);
      }
    }
  }

  triggerAutoLoadDeviceFolder() {
    const folderInput = document.getElementById("global-device-folder-input") || document.getElementById("local-folder-input");
    if (folderInput) {
      try {
        folderInput.click();
      } catch (err) {
        console.warn("Could not trigger folder input:", err);
      }
    }
  }

  async init() {
    // Load persisted local tracks metadata from storage
    const saved = storage.getItem("localMusicLibrary", []) || [];
    const custom = storage.getItem("customSongs", []) || [];
    const merged = [...saved];
    custom.forEach((c) => {
      if (c && c.id && !merged.some((m) => m.id === c.id)) {
        merged.push(c);
      }
    });

    this.localTracks = merged.map((t) => {
      const copy = {
        ...t,
        source: "local",
        isCustom: true
      };
      delete copy.blobUrl;
      // Clean site watermarks from saved titles and artists
      if (copy.title) copy.title = cleanTrackTitle(copy.title);
      if (copy.artist) copy.artist = cleanArtistName(copy.artist) || "Local Artist";

      // Repair expired blob:, missing, or broken double-encoded SVG artworks
      if (!copy.artwork || copy.artwork.startsWith("blob:") || copy.artwork.includes("%2523")) {
        copy.artwork = getArtworkFallback(copy.title, copy.artist);
      }
      return copy;
    });

    // Also sync with IndexedDB audio records in the background
    try {
      const records = await storage.getAllAudioRecords();
      if (records && records.length > 0) {
        let changed = false;
        records.forEach((rec) => {
          if (rec.metadata && !this.localTracks.some((t) => t.id === rec.id)) {
            const m = { ...rec.metadata, source: "local", isCustom: true };
            delete m.blobUrl;
            this.localTracks.push(m);
            changed = true;
          }
        });
        if (changed) {
          this.persistLibrary();
        }
      }
    } catch (e) {
      console.warn("IndexedDB sync error", e);
    }

    // Auto-load local music into player whenever local tracks exist
    if (this.localTracks.length > 0) {
      state.loadLocalMusicQueue(this.localTracks);
    }

    state.notify("localLibraryChanged", this.localTracks);

    // Background Smart Artwork Auto-Enrichment for tracks with fallback/missing covers
    if (this.localTracks.length > 0) {
      setTimeout(async () => {
        try {
          const { matched } = await smartArtworkService.batchEnrichTracks(this.localTracks);
          if (matched > 0) {
            this.persistLibrary();
            state.notify("localLibraryChanged", this.localTracks);
          }
        } catch (e) {
          console.warn("Background smart artwork enrichment error:", e);
        }
      }, 1500);
    }
  }

  // Audio format validation
  isFormatSupported(file) {
    const audioTest = document.createElement("audio");
    const mime = file.type || "";
    const ext = "." + file.name.split(".").pop().toLowerCase();

    const formatMap = {
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg; codecs=vorbis",
      ".m4a": "audio/mp4; codecs=mp4a.40.2",
      ".aac": "audio/aac",
      ".flac": "audio/flac",
      ".webm": "audio/webm",
      ".weba": "audio/webm",
      ".opus": "audio/ogg; codecs=opus",
      ".wma": "audio/x-ms-wma",
      ".mp4": "audio/mp4"
    };

    const checkMime = mime || formatMap[ext] || "";
    if (!checkMime) return true; // try playback anyway

    const validExtensions = [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a", ".weba", ".webm", ".opus", ".wma", ".alac", ".mp4"];
    const canPlay = audioTest.canPlayType(checkMime);
    return canPlay !== "" || validExtensions.includes(ext) || (file.type && file.type.startsWith("audio/"));
  }

  createTrackUrl(file) {
    const url = URL.createObjectURL(file);
    this.activeObjectUrls.add(url);
    return url;
  }

  revokeTrackUrl(url) {
    if (url && this.activeObjectUrls.has(url)) {
      try {
        URL.revokeObjectURL(url);
        this.activeObjectUrls.delete(url);
      } catch (e) {}
    }
  }

  async importFiles(fileList) {
    return this.processFiles(fileList);
  }

  async processFiles(fileList) {
    const validExtensions = [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a", ".weba", ".webm", ".opus", ".wma", ".alac", ".mp4"];
    const addedTracks = [];
    let unsupportedCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = "." + file.name.split(".").pop().toLowerCase();

      if (!validExtensions.includes(ext) && !file.type.startsWith("audio/")) {
        continue;
      }

      // Check if file already exists in localTracks (prevent duplicates by fileName + size, or same name/size)
      const isDuplicate = this.localTracks.some((t) => {
        if (t.fileSize && file.size && t.fileSize === file.size) {
          if (t.fileName && t.fileName.toLowerCase() === file.name.toLowerCase()) return true;
          if (file.name.toLowerCase().includes(t.title?.toLowerCase() || "")) return true;
        }
        if (t.fileName && t.fileName.toLowerCase() === file.name.toLowerCase()) {
          return true;
        }
        return false;
      });

      if (isDuplicate) {
        duplicateCount++;
        continue;
      }

      if (!this.isFormatSupported(file)) {
        unsupportedCount++;
        continue;
      }

      // 1. Try reading embedded ID3 tags
      const id3 = await ID3Parser.parse(file);

      // 2. Derive titles and artists
      let title = id3?.title ? cleanTrackTitle(id3.title) : null;
      let artist = id3?.artist ? cleanArtistName(id3.artist) : null;
      let album = id3?.album || "Local Music";
      let genre = id3?.genre || "Local Audio";
      let artwork = id3?.artworkUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80";

      // Fallback: parse filename
      if (!title) {
        const rawName = file.name.replace(/\.[^/.]+$/, "");
        if (rawName.includes(" - ")) {
          const parts = rawName.split(" - ");
          artist = cleanArtistName(parts[0].trim()) || "Local Artist";
          title = cleanTrackTitle(parts.slice(1).join(" - ").trim());
        } else {
          title = cleanTrackTitle(rawName);
          artist = artist || "Local Artist";
        }
      }

      if (!artist) artist = "Local Artist";

      // Iconic Bollywood Hindi track detection
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes("intezaar") || lowerTitle.includes("intezar") || (lowerTitle.includes("aayiye") && lowerTitle.includes("aapka"))) {
        title = "Aayiye Aapka Intezaar Tha";
        artist = "Kumar Sanu, Sadhana Sargam";
        album = "Vijaypath";
        genre = "Bollywood / Hindi";
        artwork = artwork || "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80";
      } else if (lowerTitle.includes("tere liye")) {
        title = "Tere Liye";
        artist = "Atif Aslam, Shreya Ghoshal";
        album = "Prince";
        genre = "Bollywood / Romance";
        artwork = artwork || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80";
      } else if (lowerTitle.includes("tere bina")) {
        title = "Tere Bina";
        artist = "A. R. Rahman, Chinmayi";
        album = "Guru";
        genre = "Bollywood / Sufi";
        artwork = artwork || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80";
      } else if (lowerTitle.includes("bodyguard") || lowerTitle === "i love you" || lowerTitle.startsWith("i love you")) {
        title = "I Love You";
        artist = "Pritam, Ash King, Clinton Cerejo";
        album = "Bodyguard";
        genre = "Bollywood / Romantic";
        artwork = artwork || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80";
      } else if (lowerTitle.includes("tum hi ho")) {
        title = "Tum Hi Ho";
        artist = "Arijit Singh";
        album = "Aashiqui 2";
        genre = "Bollywood / Hindi";
        artwork = artwork || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80";
      } else if (lowerTitle.includes("kesariya")) {
        title = "Kesariya";
        artist = "Arijit Singh, Pritam";
        album = "Brahmāstra";
        genre = "Bollywood / Hindi";
        artwork = artwork || "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80";
      }

      // Smart Artwork: If no embedded artwork or generic placeholder, auto-query iTunes HD cover
      if (!artwork || artwork.startsWith("blob:") || artwork.includes("images.unsplash.com")) {
        try {
          const smartArt = await smartArtworkService.fetchSmartArtwork(title, artist, album);
          if (smartArt) {
            artwork = smartArt;
          } else {
            artwork = getArtworkFallback(title, artist);
          }
        } catch {
          artwork = getArtworkFallback(title, artist);
        }
      }

      const songId = "local:" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);
      const blobUrl = this.createTrackUrl(file);

      // Probe duration
      const duration = await this.probeDuration(blobUrl);

      const track = {
        id: songId,
        source: "local",
        title,
        artist,
        album,
        genre,
        language: genre.toLowerCase().includes("hindi") || genre.toLowerCase().includes("bollywood") ? "Hindi" : "en",
        year: id3?.year || new Date().getFullYear(),
        duration: Math.round(duration) || 180,
        artwork,
        format: ext.replace(".", "").toUpperCase(),
        bitrate: "320 kbps",
        sampleRate: "44.1 kHz",
        bitDepth: "16-bit",
        isLossless: ext === ".flac" || ext === ".wav",
        favorite: false,
        playCount: 0,
        addedDate: new Date().toISOString().split("T")[0],
        addedTimestamp: Date.now(),
        blobUrl,
        fileSize: file.size,
        fileName: file.name,
        isCustom: true
      };

      // Save to IndexedDB
      await storage.saveAudioBlob(songId, file, track);

      this.localTracks.unshift(track);
      addedTracks.push(track);
      state.addCustomSong(track);
    }

    if (unsupportedCount > 0) {
      showToast(`${unsupportedCount} audio file(s) format not supported by this browser.`);
    }
    if (duplicateCount > 0) {
      showToast(`${duplicateCount} duplicate file(s) skipped (already in local library).`);
    }

    this.persistLibrary();
    return {
      added: addedTracks,
      duplicates: duplicateCount,
      unsupported: unsupportedCount
    };
  }

  async removeLocalTrack(songId) {
    const trackIndex = this.localTracks.findIndex((t) => t.id === songId);
    if (trackIndex === -1) return false;

    const [track] = this.localTracks.splice(trackIndex, 1);
    if (track?.blobUrl) {
      this.revokeTrackUrl(track.blobUrl);
    }

    // Remove from IndexedDB
    try {
      await storage.deleteAudioBlob(songId);
    } catch (e) {
      console.warn("Could not remove blob from storage", e);
    }

    this.persistLibrary();
    state.removeSong(songId);
    state.notify("localLibraryChanged", this.localTracks);
    return true;
  }

  probeDuration(url) {
    return new Promise((resolve) => {
      const tempAudio = new Audio();
      let finished = false;
      const finish = (dur) => {
        if (finished) return;
        finished = true;
        try {
          tempAudio.src = "";
          tempAudio.load();
        } catch (e) {}
        resolve(dur);
      };
      tempAudio.addEventListener("loadedmetadata", () => finish(tempAudio.duration || 180));
      tempAudio.addEventListener("error", () => finish(180));
      setTimeout(() => finish(180), 1200);
      tempAudio.src = url;
    });
  }

  persistLibrary() {
    // Store metadata without temporary blob URLs
    const serializable = this.localTracks.map((t) => {
      const copy = { ...t };
      delete copy.blobUrl;
      return copy;
    });
    storage.setItem("localMusicLibrary", serializable);
    state.notify("localLibraryChanged", this.localTracks);
  }

  getLocalTracks(tab = "all", filterText = "") {
    let list = [...this.localTracks];

    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q)
      );
    }

    if (tab === "recent-added") {
      list.sort((a, b) => (b.addedTimestamp || 0) - (a.addedTimestamp || 0));
    } else if (tab === "recent-played") {
      list = list.filter((t) => t.lastPlayed).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    }

    return list;
  }

  getGrouped(type = "artists") {
    const groups = new Map();
    this.localTracks.forEach((t) => {
      const key = (type === "artists" ? t.artist : type === "albums" ? t.album : t.genre) || "Unknown";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(t);
    });
    return Array.from(groups.entries()).map(([name, tracks]) => ({
      name,
      tracks,
      count: tracks.length,
      artwork: tracks[0]?.artwork
    }));
  }
}

export const localLibraryService = new LocalLibraryService();
