import { state } from "./state.js";
import { audioEngine } from "./audio-engine.js";

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

  try {
    navigator.mediaSession.setActionHandler("play", () => audioEngine.play());
    navigator.mediaSession.setActionHandler("pause", () => audioEngine.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => audioEngine.prevTrack());
    navigator.mediaSession.setActionHandler("nexttrack", () => audioEngine.nextTrack());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) {
        audioEngine.seek(details.seekTime);
      }
    });
    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      const skip = details.seekOffset || 10;
      audioEngine.seek(Math.max(state.currentTime - skip, 0));
    });
    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      const skip = details.seekOffset || 10;
      audioEngine.seek(Math.min(state.currentTime + skip, state.duration));
    });
  } catch (e) {
    console.warn("MediaSession action handler error", e);
  }

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

