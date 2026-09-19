import { state } from "./state.js";
import { showToast } from "./components.js";

class YouTubePlayerService {
  constructor() {
    this.player = null;
    this.isReady = false;
    this.currentVideoId = null;
    this.pollInterval = null;
    this.onEndedCallback = null;
    this.loadPromise = null;
    this.domInitialized = false;
    this.autoplayTimeout = null;
  }

  initDOM() {
    if (this.domInitialized) return;
    this.domInitialized = true;

    const host = document.getElementById("youtube-player-host");
    const pipBtn = document.getElementById("yt-pip-toggle-btn");
    const minBtn = document.getElementById("yt-minimize-btn");
    const playBtn = document.getElementById("yt-click-to-play-btn");
    const expandBtn = document.getElementById("yt-expand-fullscreen-btn");

    if (pipBtn && host) {
      pipBtn.addEventListener("click", () => {
        host.classList.toggle("is-expanded");
      });
    }

    if (expandBtn) {
      expandBtn.addEventListener("click", () => {
        const fsModal = document.getElementById("fullscreen-player-modal");
        const fsBody = document.getElementById("fs-main-body");
        if (fsModal && fsBody) {
          fsModal.classList.add("open");
          fsBody.classList.remove("view-player", "view-lyrics");
          fsBody.classList.add("view-video");
          document.getElementById("fs-switch-video")?.classList.add("active");
          document.getElementById("fs-switch-player")?.classList.remove("active");
          document.getElementById("fs-switch-lyrics")?.classList.remove("active");
          this.showVideo(true);
        }
      });
    }

    if (minBtn && host) {
      minBtn.addEventListener("click", () => {
        // Switch to audio-only mode
        state.setVideoMode(false);
        this.hideVideo();
        showToast("Audio Only Mode Active");
      });
    }

    if (playBtn) {
      playBtn.addEventListener("click", () => {
        const prompt = document.getElementById("yt-click-to-play-prompt");
        if (prompt) prompt.style.display = "none";
        if (this.player && typeof this.player.playVideo === "function") {
          try {
            this.player.playVideo();
          } catch (e) {}
        }
      });
    }
  }

  showVideo(inFullscreen = false) {
    this.initDOM();
    const host = document.getElementById("youtube-player-host");
    if (!host) return;

    const song = state.currentSong;
    const isYt = song && (song.source === "youtube" || (typeof song.id === "string" && song.id.startsWith("youtube:")) || Boolean(song.youtubeId && song.source !== "local" && !song.isRadio));
    if (!isYt) {
      host.classList.add("is-hidden");
      host.classList.remove("in-fullscreen-video");
      return;
    }

    host.classList.remove("is-hidden");
    if (inFullscreen) {
      host.classList.add("in-fullscreen-video");
    } else {
      host.classList.remove("in-fullscreen-video");
    }
  }

  hideVideo() {
    this.initDOM();
    const host = document.getElementById("youtube-player-host");
    if (!host) return;
    host.classList.add("is-hidden");
    host.classList.remove("in-fullscreen-video");
  }

  setFullscreenMount(inFullscreen) {
    this.initDOM();
    const host = document.getElementById("youtube-player-host");
    if (!host) return;

    const song = state.currentSong;
    const isYt = song && (song.source === "youtube" || (typeof song.id === "string" && song.id.startsWith("youtube:")) || Boolean(song.youtubeId && song.source !== "local" && !song.isRadio));
    if (!isYt) {
      host.classList.add("is-hidden");
      host.classList.remove("in-fullscreen-video");
      return;
    }

    if (inFullscreen) {
      host.classList.add("in-fullscreen-video");
      host.classList.remove("is-hidden");
    } else {
      host.classList.remove("in-fullscreen-video");
      if (!state.isVideoMode) {
        host.classList.add("is-hidden");
      }
    }
  }

  toggleFullscreenMaximize() {
    this.initDOM();
    const host = document.getElementById("youtube-player-host");
    if (!host) return;
    host.classList.toggle("is-maximized-fullscreen");
    const isMax = host.classList.contains("is-maximized-fullscreen");
    showToast(isMax ? "Expanded Video Player" : "Restored Normal View");
  }

  loadIFrameAPI() {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        this.isReady = true;
        resolve(window.YT);
        return;
      }

      // Check every 100ms in case script was pre-injected
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          this.isReady = true;
          resolve(window.YT);
        }
      }, 100);

      // Fallback timeout after 10s
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(window.YT || null);
      }, 10000);

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === "function") prevCallback();
        clearInterval(checkInterval);
        this.isReady = true;
        resolve(window.YT);
      };

      if (!document.getElementById("youtube-iframe-api-script")) {
        const tag = document.createElement("script");
        tag.id = "youtube-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }
    });

    return this.loadPromise;
  }

  async ensurePlayer() {
    this.initDOM();
    await this.loadIFrameAPI();

    return new Promise((resolve) => {
      if (this.player && typeof this.player.playVideo === "function") {
        resolve(this.player);
        return;
      }

      if (!window.YT || !window.YT.Player) {
        console.warn("YouTube IFrame API not loaded yet");
        resolve(null);
        return;
      }

      let mount = document.getElementById("youtube-player-mount");
      if (!mount) {
        const container = document.getElementById("youtube-player-container") || document.body;
        mount = document.createElement("div");
        mount.id = "youtube-player-mount";
        container.appendChild(mount);
      }

      try {
        this.player = new window.YT.Player("youtube-player-mount", {
          height: "100%",
          width: "100%",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3
          },
          events: {
            onReady: () => {
              this.isReady = true;
              try {
                this.player.setVolume(Math.round((state.isMuted ? 0 : (state.volume ?? 0.85)) * 100));
              } catch (e) {}
              resolve(this.player);
            },
            onStateChange: (event) => {
              this.handleStateChange(event.data);
            },
            onError: (event) => {
              console.warn("YouTube Player encountered error code:", event.data);
              let msg = "YouTube video unavailable. Playing next track...";
              if (event.data === 150 || event.data === 101) {
                msg = "Video embedding restricted by creator. Skipping to next...";
              }
              showToast(msg);
              if (typeof this.onEndedCallback === "function") {
                setTimeout(() => this.onEndedCallback(), 1200);
              }
            }
          }
        });
      } catch (err) {
        console.error("Failed to construct YT.Player", err);
        resolve(null);
      }
    });
  }

  handleStateChange(playerState) {
    const YTState = window.YT ? window.YT.PlayerState : {
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5
    };

    const prompt = document.getElementById("yt-click-to-play-prompt");

    if (playerState === YTState.PLAYING) {
      if (prompt) prompt.style.display = "none";
      if (this.autoplayTimeout) {
        clearTimeout(this.autoplayTimeout);
        this.autoplayTimeout = null;
      }
      state.isPlaying = true;
      state.notify("playbackStateChanged", true);
      this.startProgressPolling();
    } else if (playerState === YTState.PAUSED) {
      state.isPlaying = false;
      state.notify("playbackStateChanged", false);
      this.stopProgressPolling();
    } else if (playerState === YTState.ENDED) {
      state.isPlaying = false;
      state.notify("playbackStateChanged", false);
      this.stopProgressPolling();
      if (typeof this.onEndedCallback === "function") {
        this.onEndedCallback();
      }
    }
  }

  startProgressPolling() {
    this.stopProgressPolling();
    this.pollInterval = setInterval(() => {
      if (!this.player || typeof this.player.getCurrentTime !== "function") return;
      try {
        const current = this.player.getCurrentTime() || 0;
        const duration = this.player.getDuration() || state.duration || 0;

        if (duration > 0 && Math.abs(duration - (state.duration || 0)) > 1) {
          state.duration = duration;
          if (state.currentSong) state.currentSong.duration = Math.round(duration);
        }

        state.currentTime = current;
        state.notify("timeUpdate", {
          currentTime: current,
          duration: state.duration
        });
      } catch (e) {}
    }, 250);
  }

  stopProgressPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async play(song, startTime = 0) {
    this.initDOM();
    const videoId = song.youtubeId || (song.id ? song.id.replace(/^youtube:/, "") : null);
    if (!videoId) return;

    const host = document.getElementById("youtube-player-host");
    const titleEl = document.getElementById("yt-card-title-text");

    if (host) {
      const isFsVideo = document.getElementById("fullscreen-player-modal")?.classList.contains("open") &&
                        document.getElementById("fs-main-body")?.classList.contains("view-video");
      if (state.isVideoMode) {
        this.showVideo(isFsVideo);
      } else {
        this.hideVideo();
      }
    }
    if (titleEl && song.title) {
      titleEl.textContent = song.title;
    }

    state.isPlaying = true;
    state.notify("playbackStateChanged", true);

    await this.ensurePlayer();

    this.currentVideoId = videoId;
    if (this.player && typeof this.player.loadVideoById === "function") {
      try {
        this.player.loadVideoById({
          videoId: videoId,
          startSeconds: startTime
        });
        this.player.setVolume(Math.round((state.isMuted ? 0 : (state.volume ?? 0.85)) * 100));
        this.player.playVideo();
        this.startProgressPolling();

        // Autoplay check for mobile browsers with gesture restrictions
        if (this.autoplayTimeout) clearTimeout(this.autoplayTimeout);
        this.autoplayTimeout = setTimeout(() => {
          if (state.isPlaying && this.player && typeof this.player.getPlayerState === "function") {
            const curState = this.player.getPlayerState();
            const YTState = window.YT?.PlayerState;
            if (YTState && curState !== YTState.PLAYING && curState !== YTState.BUFFERING) {
              const prompt = document.getElementById("yt-click-to-play-prompt");
              if (prompt) prompt.style.display = "flex";
            }
          }
        }, 1800);
      } catch (e) {
        console.warn("YouTube play invocation error", e);
      }
    }
  }

  pause() {
    if (this.player && typeof this.player.pauseVideo === "function") {
      try {
        this.player.pauseVideo();
      } catch (e) {}
    }
    this.stopProgressPolling();
  }

  resume() {
    if (this.player && typeof this.player.playVideo === "function") {
      try {
        this.player.playVideo();
      } catch (e) {}
    }
  }

  seek(seconds) {
    if (this.player && typeof this.player.seekTo === "function") {
      try {
        this.player.seekTo(seconds, true);
        state.currentTime = seconds;
        state.notify("timeUpdate", {
          currentTime: seconds,
          duration: state.duration
        });
      } catch (e) {}
    }
  }

  setVolume(volFraction) {
    if (this.player && typeof this.player.setVolume === "function") {
      try {
        const vol = Math.max(0, Math.min(100, Math.round(volFraction * 100)));
        this.player.setVolume(vol);
        if (vol === 0) {
          this.player.mute();
        } else {
          this.player.unMute();
        }
      } catch (e) {}
    }
  }

  setOnEnded(callback) {
    this.onEndedCallback = callback;
  }
}

export const youtubePlayer = new YouTubePlayerService();

export async function searchYouTubeTracks(query, maxResults = 12, pageToken = "") {
  try {
    let url = `/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`YouTube API error: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn("YouTube search query error:", err);
    throw err;
  }
}
