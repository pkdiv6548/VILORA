import { state } from "./state.js";
import { storage } from "./storage.js";

export class PlaylistManager {
  createPlaylist(title, description = "") {
    const id = "pl-custom-" + Date.now();
    const newPl = {
      id,
      title: title || "New Playlist",
      description: description || "Custom created playlist",
      songIds: [],
      artwork: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80",
      creator: "You",
      isCustom: true,
      createdDate: new Date().toISOString()
    };
    state.playlists.unshift(newPl);
    this.persist();
    state.notify("playlistsChanged", state.playlists);
    return newPl;
  }

  renamePlaylist(id, newTitle, newDescription) {
    const pl = state.getPlaylistById(id);
    if (pl) {
      if (newTitle) pl.title = newTitle;
      if (newDescription !== undefined) pl.description = newDescription;
      this.persist();
      state.notify("playlistsChanged", state.playlists);
      return true;
    }
    return false;
  }

  deletePlaylist(id) {
    const idx = state.playlists.findIndex(p => p.id === id);
    if (idx !== -1) {
      state.playlists.splice(idx, 1);
      this.persist();
      state.notify("playlistsChanged", state.playlists);
      return true;
    }
    return false;
  }

  duplicatePlaylist(id) {
    const pl = state.getPlaylistById(id);
    if (!pl) return null;
    const copy = {
      ...pl,
      id: "pl-custom-" + Date.now(),
      title: `${pl.title} (Copy)`,
      creator: "You",
      isCustom: true
    };
    state.playlists.unshift(copy);
    this.persist();
    state.notify("playlistsChanged", state.playlists);
    return copy;
  }

  addSongToPlaylist(playlistId, songId) {
    const pl = state.getPlaylistById(playlistId);
    if (pl && !pl.songIds.includes(songId)) {
      pl.songIds.push(songId);
      this.persist();
      state.notify("playlistsChanged", state.playlists);
      return true;
    }
    return false;
  }

  removeSongFromPlaylist(playlistId, songId) {
    const pl = state.getPlaylistById(playlistId);
    if (pl) {
      pl.songIds = pl.songIds.filter(id => id !== songId);
      this.persist();
      state.notify("playlistsChanged", state.playlists);
      return true;
    }
    return false;
  }

  reorderSong(playlistId, fromIdx, toIdx) {
    const pl = state.getPlaylistById(playlistId);
    if (pl && pl.songIds) {
      const [moved] = pl.songIds.splice(fromIdx, 1);
      pl.songIds.splice(toIdx, 0, moved);
      this.persist();
      state.notify("playlistsChanged", state.playlists);
    }
  }

  exportPlaylist(playlistId) {
    const pl = state.getPlaylistById(playlistId);
    if (!pl) return null;
    const songs = pl.songIds.map(id => state.getSongById(id)).filter(Boolean);
    const exportData = {
      playlist: pl,
      songs: songs.map(s => ({
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration
      }))
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pl.title.replace(/\s+/g, "_")}_playlist.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  importPlaylist(jsonData) {
    try {
      const parsed = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
      if (parsed.playlist && parsed.playlist.title) {
        const newPl = this.createPlaylist(parsed.playlist.title, parsed.playlist.description);
        return newPl;
      }
    } catch (e) {
      console.warn("Import playlist error", e);
    }
    return null;
  }

  persist() {
    storage.setItem("playlists", state.playlists);
  }
}

export const playlistManager = new PlaylistManager();
