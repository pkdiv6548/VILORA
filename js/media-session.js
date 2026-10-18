import { state } from "./state.js";
import { audioEngine } from "./audio-engine.js";
import { storage } from "./storage.js";

export function initMediaSession() {
  if (!("mediaSession" in navigator)) return;

  const updateMetadata = (song) => {
    if (!song) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title || "Unknown Title",
      artist: song.artist || "Unknown Artist",
      album: song.album || "Unknown Album",
      artwork: [
        { src: song.artwork, sizes: "96x96", type: "image/jpeg" },
        { src: song.artwork, sizes: "192x192", type: "image/jpeg" },
        { src: song.artwork, sizes: "512x512", type: "image/jpeg" }
      ]
    });
  };

  // Register each action independently. Some browsers do not support every
  // Media Session action; one unsupported action must not disable the rest.
  const registerAction = (action, handler) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) {
      console.debug(`Media Session action not supported: ${action}`);
    }
  };

  registerAction("play", () => {
    audioEngine.play();
    navigator.mediaSession.playbackState = "playing";
  });
  registerAction("pause", () => {
    audioEngine.pause();
    navigator.mediaSession.playbackState = "paused";
  });
  // Use a direct previous-track action for lock-screen controls. The in-app
  // previous button intentionally restarts the current track after 3 seconds.
  registerAction("previoustrack", () => {
    if (state.isStream || state.currentSong?.source === "radio") {
      audioEngine.prevTrack();
      return;
    }
    if (!state.queue || state.queue.length === 0) {
      const isLocal = state.currentSong?.source === "local" ||
        state.currentSong?.isCustom ||
        state.currentSong?.id?.startsWith("local:");
      const localTracks = isLocal
        ? (storage.getItem("localMusicLibrary", []) || [])
        : [];
      if (localTracks.length) state.setQueue(localTracks, 0);
    }
    if (state.queue?.length) {
      let index = state.currentSong
        ? state.queue.findIndex(song => song?.id === state.currentSong.id)
        : state.queueIndex || 0;
      if (index < 0) index = state.queueIndex || 0;
      const previousIndex = (index - 1 + state.queue.length) % state.queue.length;
      audioEngine.playTrackAtIndex(previousIndex);
    } else {
      audioEngine.prevTrack();
    }
  });
  registerAction("nexttrack", () => audioEngine.nextTrack());
  registerAction("seekto", (details) => {
    if (details.seekTime !== undefined) audioEngine.seek(details.seekTime);
  });
  registerAction("seekbackward", (details) => {
    const skip = details.seekOffset || 10;
    audioEngine.seek(Math.max(state.currentTime - skip, 0));
  });
  registerAction("seekforward", (details) => {
    const skip = details.seekOffset || 10;
    audioEngine.seek(Math.min(state.currentTime + skip, state.duration));
  });

  state.subscribe("songChanged", (song) => updateMetadata(song));
  state.subscribe("playbackStateChanged", (isPlaying) => {
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  });
  state.subscribe("timeUpdate", ({ currentTime, duration }) => {
    if ("setPositionState" in navigator.mediaSession && duration > 0 && currentTime <= duration) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, 1),
          playbackRate: state.playbackRate || 1.0,
          position: Math.min(Math.max(currentTime, 0), duration)
        });
      } catch (e) {}
    }
  });

  if (state.currentSong) {
    updateMetadata(state.currentSong);
  }
}

