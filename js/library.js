import { state } from "./state.js";
import { storage } from "./storage.js";
import { cleanTrackTitle, cleanArtistName } from "./lyrics.js";

export class LibraryManager {
  constructor() {
    this.sortField = "title"; // title, artist, album, duration, playCount, date
    this.sortAsc = true;
    this.filterText = "";
    this.activeGenreFilter = "all";
  }

  getFilteredSongs() {
    let result = [...state.songs];

    // Filter by genre
    if (this.activeGenreFilter !== "all") {
      result = result.filter(s => s.genre && s.genre.toLowerCase().includes(this.activeGenreFilter.toLowerCase()));
    }

    // Filter by search text
    if (this.filterText.trim()) {
      const q = this.filterText.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[this.sortField];
      let valB = b[this.sortField];

      if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = (valB || "").toLowerCase();
        return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = valA || 0;
        valB = valB || 0;
        return this.sortAsc ? valA - valB : valB - valA;
      }
    });

    return result;
  }

  setSorting(field) {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
  }

  // Handle local audio file import
  async importAudioFiles(fileList) {
    const importedSongs = [];
    const validExtensions = [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a", ".weba"];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = "." + file.name.split(".").pop().toLowerCase();

      if (!validExtensions.includes(ext) && !file.type.startsWith("audio/")) {
        continue;
      }

      // Extract and clean metadata from filename
      let rawTitle = file.name.replace(/\.[^/.]+$/, "");
      let title = cleanTrackTitle(rawTitle);
      let artist = "Local Artist";
      let album = "Local Imports";
      let genre = "Local Audio";
      let language = "en";
      let artwork = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80";

      if (rawTitle.includes(" - ")) {
        const parts = rawTitle.split(" - ");
        artist = cleanArtistName(parts[0].trim()) || "Local Artist";
        title = cleanTrackTitle(parts.slice(1).join(" - ").trim());
      }

      // Check for iconic Hindi track titles
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes("intezaar") || lowerTitle.includes("intezar") || (lowerTitle.includes("aayiye") && lowerTitle.includes("aapka"))) {
        title = "Aayiye Aapka Intezaar Tha";
        artist = "Kumar Sanu, Sadhana Sargam";
        album = "Vijaypath";
        genre = "Bollywood / Hindi";
        language = "Hindi";
        artwork = "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80";
      } else if (lowerTitle.includes("tum hi ho")) {
        title = "Tum Hi Ho";
        artist = "Arijit Singh";
        album = "Aashiqui 2";
        genre = "Bollywood / Romantic";
        language = "Hindi";
      } else if (lowerTitle.includes("kesariya")) {
        title = "Kesariya";
        artist = "Arijit Singh, Pritam";
        album = "Brahmāstra";
        genre = "Bollywood / Romantic";
        language = "Hindi";
      } else if (lowerTitle.includes("apna bana le")) {
        title = "Apna Bana Le";
        artist = "Arijit Singh, Sachin-Jigar";
        album = "Bhediya";
        genre = "Bollywood / Romantic";
        language = "Hindi";
      } else if (/(pagalworld|koshalworld|djpunjab|songspk)/i.test(file.name)) {
        genre = "Bollywood / Hindi";
        language = "Hindi";
      }

      const songId = "local-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);
      const blobUrl = URL.createObjectURL(file);

      // Estimate or read duration
      const duration = await this.probeDuration(blobUrl);

      const newSong = {
        id: songId,
        title,
        artist,
        album,
        genre,
        language,
        year: new Date().getFullYear(),
        duration: Math.round(duration) || 180,
        artwork,
        format: ext.replace(".", "").toUpperCase(),
        bitrate: "320 kbps",
        sampleRate: "44.1 kHz",
        bitDepth: "16-bit",
        isLossless: ext === ".flac" || ext === ".wav",
        isHiRes: false,
        favorite: false,
        playCount: 0,
        addedDate: new Date().toISOString().split("T")[0],
        blobUrl,
        isCustom: true,
        fileSize: file.size
      };

      // Save blob into IndexedDB for persistence
      await storage.saveAudioBlob(songId, file, newSong);
      state.addCustomSong(newSong);
      importedSongs.push(newSong);
    }

    return importedSongs;
  }

  probeDuration(url) {
    return new Promise((resolve) => {
      const tempAudio = new Audio();
      tempAudio.src = url;
      tempAudio.addEventListener("loadedmetadata", () => {
        resolve(tempAudio.duration);
      });
      tempAudio.addEventListener("error", () => {
        resolve(180);
      });
    });
  }

  editSongMetadata(songId, updates) {
    const song = state.getSongById(songId);
    if (song) {
      Object.assign(song, updates);
      state.notify("songMetadataUpdated", song);
      return true;
    }
    return false;
  }
}

export const libraryManager = new LibraryManager();
