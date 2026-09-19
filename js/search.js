import { state } from "./state.js";
import { storage } from "./storage.js";
import { DEMO_LYRICS } from "../data/lyrics.js";

export class SearchEngine {
  search(query) {
    if (!query || !query.trim()) {
      return {
        songs: [],
        artists: [],
        albums: [],
        playlists: [],
        radio: []
      };
    }

    const q = query.toLowerCase().trim();

    const songs = state.songs.filter(s => {
      // 1. Direct metadata matching
      if (
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q) ||
        s.genre.toLowerCase().includes(q) ||
        (s.language && s.language.toLowerCase().includes(q))
      ) {
        return true;
      }

      // 2. Lyrics content search in original language/script
      const lyricsObj = DEMO_LYRICS[s.id];
      if (lyricsObj && lyricsObj.lines) {
        const matchesLyrics = lyricsObj.lines.some(line => line.text.toLowerCase().includes(q));
        if (matchesLyrics) return true;
        if (lyricsObj.language && lyricsObj.language.toLowerCase().includes(q)) return true;
      }

      return false;
    });

    const artists = state.artists.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.genre.toLowerCase().includes(q)
    );

    const albums = state.albums.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.artist.toLowerCase().includes(q) ||
      a.genre.toLowerCase().includes(q)
    );

    const playlists = state.playlists.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );

    const radio = state.radioStations.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.genre.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q)
    );

    return { songs, artists, albums, playlists, radio };
  }

  saveQueryToHistory(q) {
    if (!q || !q.trim()) return;
    const clean = q.trim();
    state.searchHistory = state.searchHistory.filter(item => item.toLowerCase() !== clean.toLowerCase());
    state.searchHistory.unshift(clean);
    if (state.searchHistory.length > 10) state.searchHistory.pop();
    storage.setItem("searchHistory", state.searchHistory);
  }

  clearSearchHistory() {
    state.searchHistory = [];
    storage.setItem("searchHistory", []);
  }
}

export const searchEngine = new SearchEngine();
