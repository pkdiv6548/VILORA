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
    this.playerPromise = null;
    this.domInitialized = false;
    this.autoplayTimeout = null;
    this.lastRequestedVideoId = null;
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
        state.setVideoMode(false);
        this.hideVideo();
        showToast("Audio Only Mode Active");
      });
    }

    if (playBtn) {
      playBtn.addEventListener("click", () => {
        const prompt = document.getElementById("yt-click-to-play-prompt");

        if (prompt) {
          prompt.style.display = "none";
        }

        if (this.player && typeof this.player.playVideo === "function") {
          try {
            this.player.playVideo();
          } catch (e) {
            console.warn("YouTube manual play error:", e);
          }
        }
      });
    }
  }

  isYouTubeSong(song) {
    if (!song) return false;

    return (
      song.source === "youtube" ||
      (typeof song.id === "string" && song.id.startsWith("youtube:")) ||
      Boolean(
        song.youtubeId &&
        song.source !== "local" &&
        !song.isRadio
      )
    );
  }

  getVideoId(song) {
    if (!song) return null;

    const rawId =
      song.youtubeId ||
      (typeof song.id === "string"
        ? song.id.replace(/^youtube:/, "")
        : null);

    if (!rawId) return null;

    const videoId = String(rawId).trim();

    if (!videoId) return null;

    return videoId;
  }

  clearAutoplayTimeout() {
    if (this.autoplayTimeout) {
      clearTimeout(this.autoplayTimeout);
      this.autoplayTimeout = null;
    }
  }

  hideAutoplayPrompt() {
    const prompt = document.getElementById("yt-click-to-play-prompt");

    if (prompt) {
      prompt.style.display = "none";
    }
  }

  showAutoplayPrompt() {
    const prompt = document.getElementById("yt-click-to-play-prompt");

    if (prompt) {
      prompt.style.display = "flex";
    }
  }

  showVideo(inFullscreen = false) {
    this.initDOM();

    const host = document.getElementById("youtube-player-host");

    if (!host) return;

    const song = state.currentSong;

    if (!this.isYouTubeSong(song)) {
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

    if (!this.isYouTubeSong(song)) {
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

    showToast(
      isMax
        ? "Expanded Video Player"
        : "Restored Normal View"
    );
  }

  loadIFrameAPI() {
    if (window.YT && window.YT.Player) {
      this.isReady = true;
      return Promise.resolve(window.YT);
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise((resolve) => {
      let resolved = false;
      let checkInterval = null;
      let timeoutId = null;

      const finish = (yt) => {
        if (resolved) return;

        resolved = true;

        if (checkInterval) {
          clearInterval(checkInterval);
        }

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (yt && yt.Player) {
          this.isReady = true;
          resolve(yt);
        } else {
          this.isReady = false;
          resolve(null);
        }
      };

      const previousCallback = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousCallback === "function") {
          try {
            previousCallback();
          } catch (e) {
            console.warn(
              "Previous YouTube API callback error:",
              e
            );
          }
        }

        if (window.YT && window.YT.Player) {
          finish(window.YT);
        }
      };

      checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          finish(window.YT);
        }
      }, 100);

      timeoutId = setTimeout(() => {
        finish(
          window.YT && window.YT.Player
            ? window.YT
            : null
        );
      }, 10000);

      if (!document.getElementById("youtube-iframe-api-script")) {
        const tag = document.createElement("script");

        tag.id = "youtube-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;

        const firstScriptTag =
          document.getElementsByTagName("script")[0];

        if (firstScriptTag?.parentNode) {
          firstScriptTag.parentNode.insertBefore(
            tag,
            firstScriptTag
          );
        } else {
          document.head.appendChild(tag);
        }
      }
    });

    return this.loadPromise;
  }

  async ensurePlayer() {
    this.initDOM();

    if (
      this.player &&
      typeof this.player.playVideo === "function"
    ) {
      return this.player;
    }

    if (this.playerPromise) {
      return this.playerPromise;
    }

    this.playerPromise = (async () => {
      const YT = await this.loadIFrameAPI();

      if (!YT || !YT.Player) {
        console.warn(
          "YouTube IFrame API could not be loaded."
        );

        return null;
      }

      if (
        this.player &&
        typeof this.player.playVideo === "function"
      ) {
        return this.player;
      }

      let mount =
        document.getElementById(
          "youtube-player-mount"
        );

      if (!mount) {
        const container =
          document.getElementById(
            "youtube-player-container"
          ) || document.body;

        mount = document.createElement("div");
        mount.id = "youtube-player-mount";

        container.appendChild(mount);
      }

      return new Promise((resolve) => {
        let settled = false;

        const resolvePlayer = (player) => {
          if (settled) return;

          settled = true;
          resolve(player);
        };

        try {
          this.player = new YT.Player(
            "youtube-player-mount",
            {
              height: "100%",
              width: "100%",

              playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                enablejsapi: 1,

                /*
                 * Important for deployed/Vercel environments.
                 * YouTube recommends explicitly specifying
                 * the origin when using the IFrame API.
                 */
                origin: window.location.origin,

                fs: 0,
                playsinline: 1,
                rel: 0,
                iv_load_policy: 3
              },

              events: {
                onReady: (event) => {
                  this.isReady = true;

                  try {
                    const volume = Math.round(
                      (
                        state.isMuted
                          ? 0
                          : (state.volume ?? 0.85)
                      ) * 100
                    );

                    event.target.setVolume(
                      Math.max(
                        0,
                        Math.min(100, volume)
                      )
                    );
                  } catch (e) {
                    console.warn(
                      "YouTube initial volume error:",
                      e
                    );
                  }

                  resolvePlayer(event.target);
                },

                onStateChange: (event) => {
                  this.handleStateChange(
                    event.data
                  );
                },

                onAutoplayBlocked: () => {
                  /*
                   * Browser/user gesture restriction.
                   * We do not fake the playing state.
                   */
                  state.isPlaying = false;
                  state.notify(
                    "playbackStateChanged",
                    false
                  );

                  this.stopProgressPolling();
                  this.showAutoplayPrompt();
                },

                onError: (event) => {
                  this.handlePlayerError(
                    event?.data
                  );
                }
              }
            }
          );
        } catch (err) {
          this.player = null;
          this.isReady = false;

          console.error(
            "Failed to construct YouTube player:",
            err
          );

          resolvePlayer(null);
        }
      });
    })();

    try {
      return await this.playerPromise;
    } finally {
      this.playerPromise = null;
    }
  }

  handlePlayerError(errorCode) {
    console.warn(
      "YouTube Player error code:",
      errorCode
    );

    this.clearAutoplayTimeout();
    this.stopProgressPolling();

    state.isPlaying = false;
    state.notify(
      "playbackStateChanged",
      false
    );

    let message =
      "YouTube video unavailable. Playing next track...";

    /*
     * 100 = removed/private
     */
    if (errorCode === 100) {
      message =
        "This YouTube video is unavailable. Playing next...";
    }

    /*
     * 101 / 150 = embedding disabled by creator
     */
    if (
      errorCode === 101 ||
      errorCode === 150
    ) {
      message =
        "YouTube embedding is restricted for this video. Playing next...";
    }

    /*
     * 153 = missing HTTP Referer / client identification
     */
    if (errorCode === 153) {
      message =
        "YouTube could not verify this player request. Please refresh and try again.";
    }

    /*
     * 2 = invalid video/player parameter
     */
    if (errorCode === 2) {
      message =
        "Invalid YouTube video. Playing next...";
    }

    /*
     * 5 = HTML5 player error
     */
    if (errorCode === 5) {
      message =
        "YouTube playback error. Playing next...";
    }

    showToast(message);

    /*
     * For video-specific unavailable errors,
     * continue to the next track.
     *
     * Error 153 is treated differently because it can
     * indicate a deployment/origin/request issue.
     */
    if (
      errorCode !== 153 &&
      typeof this.onEndedCallback === "function"
    ) {
      setTimeout(() => {
        if (
          typeof this.onEndedCallback === "function"
        ) {
          this.onEndedCallback();
        }
      }, 1200);
    }
  }

  handleStateChange(playerState) {
    const YTState =
      window.YT?.PlayerState || {
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5
      };

    if (
      playerState === YTState.PLAYING
    ) {
      this.clearAutoplayTimeout();
      this.hideAutoplayPrompt();

      state.isPlaying = true;
      state.notify(
        "playbackStateChanged",
        true
      );

      this.startProgressPolling();

      return;
    }

    if (
      playerState === YTState.PAUSED
    ) {
      state.isPlaying = false;
      state.notify(
        "playbackStateChanged",
        false
      );

      this.stopProgressPolling();

      return;
    }

    if (
      playerState === YTState.BUFFERING
    ) {
      /*
       * Do not mark the song as paused while YouTube
       * is buffering.
       */
      this.startProgressPolling();

      return;
    }

    if (
      playerState === YTState.CUED
    ) {
      return;
    }

    if (
      playerState === YTState.ENDED
    ) {
      this.clearAutoplayTimeout();

      state.isPlaying = false;
      state.notify(
        "playbackStateChanged",
        false
      );

      this.stopProgressPolling();

      if (
        typeof this.onEndedCallback ===
        "function"
      ) {
        this.onEndedCallback();
      }
    }
  }

  startProgressPolling() {
    this.stopProgressPolling();

    this.pollInterval = setInterval(() => {
      if (
        !this.player ||
        typeof this.player.getCurrentTime !==
          "function"
      ) {
        return;
      }

      try {
        const current =
          Number(
            this.player.getCurrentTime()
          ) || 0;

        const playerDuration =
          Number(
            this.player.getDuration()
          ) || 0;

        const duration =
          playerDuration ||
          Number(state.duration) ||
          0;

        if (
          duration > 0 &&
          Math.abs(
            duration -
              (Number(state.duration) || 0)
          ) > 1
        ) {
          state.duration = duration;

          if (state.currentSong) {
            state.currentSong.duration =
              Math.round(duration);
          }
        }

        state.currentTime = current;

        state.notify(
          "timeUpdate",
          {
            currentTime: current,
            duration:
              state.duration || duration
          }
        );
      } catch (e) {
        /*
         * YouTube can temporarily reject getter calls
         * while changing videos/buffering.
         */
      }
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

    const videoId =
      this.getVideoId(song);

    if (!videoId) {
      console.warn(
        "YouTube play skipped: missing video ID."
      );
      return;
    }

    this.clearAutoplayTimeout();
    this.hideAutoplayPrompt();

    this.lastRequestedVideoId =
      videoId;

    const host =
      document.getElementById(
        "youtube-player-host"
      );

    const titleEl =
      document.getElementById(
        "yt-card-title-text"
      );

    if (host) {
      const isFsVideo =
        document
          .getElementById(
            "fullscreen-player-modal"
          )
          ?.classList.contains("open") &&
        document
          .getElementById("fs-main-body")
          ?.classList.contains(
            "view-video"
          );

      if (state.isVideoMode) {
        this.showVideo(isFsVideo);
      } else {
        this.hideVideo();
      }
    }

    if (
      titleEl &&
      song?.title
    ) {
      titleEl.textContent =
        song.title;
    }

    const player =
      await this.ensurePlayer();

    if (
      !player ||
      typeof player.loadVideoById !==
        "function"
    ) {
      state.isPlaying = false;
      state.notify(
        "playbackStateChanged",
        false
      );

      showToast(
        "YouTube player could not be loaded."
      );

      return;
    }

    /*
     * A newer play request may have arrived while
     * the API/player was loading.
     */
    if (
      this.lastRequestedVideoId !==
      videoId
    ) {
      return;
    }

    const isSameVideo = this.currentVideoId === videoId;

this.currentVideoId =
  videoId;

try {
  const safeStartTime =
    Number.isFinite(
      Number(startTime)
    )
      ? Math.max(
          0,
          Number(startTime)
        )
      : 0;

  const volume =
    Math.round(
      (
        state.isMuted
          ? 0
          : (state.volume ?? 0.85)
      ) * 100
    );

  player.setVolume(
    Math.max(
      0,
      Math.min(100, volume)
    )
  );

  /*
   * If this is already the loaded YouTube video,
   * do NOT reload it. This is important when switching
   * between audio/video fullscreen views.
   */
  if (isSameVideo) {
    const playerState =
      typeof player.getPlayerState === "function"
        ? player.getPlayerState()
        : null;

    const YTState =
      window.YT?.PlayerState;

    if (
      playerState === YTState?.PAUSED ||
      playerState === YTState?.CUED ||
      playerState === YTState?.ENDED ||
      playerState === -1
    ) {
      player.playVideo();
    }

    state.isPlaying = true;
    state.notify(
      "playbackStateChanged",
      true
    );

    this.startProgressPolling();

    return;
  }

  player.loadVideoById({
    videoId,
    startSeconds:
      safeStartTime
  });

  /*
   * Keep the existing UX responsive while
   * waiting for the real YouTube state event.
   */
  state.isPlaying = true;
  state.notify(
    "playbackStateChanged",
    true
  );

  /*
   * loadVideoById with autoplay-enabled player
   * should start playback. Explicit playVideo()
   * provides an additional request.
   */
  player.playVideo();

  this.startProgressPolling();

      /*
       * If the browser blocks scripted autoplay,
       * show the existing click-to-play UI instead
       * of pretending that playback succeeded.
       */
      this.autoplayTimeout =
        setTimeout(() => {
          if (
            !this.player ||
            typeof this.player.getPlayerState !==
              "function"
          ) {
            return;
          }

          try {
            const currentState =
              this.player.getPlayerState();

            const states =
              window.YT?.PlayerState;

            if (
              states &&
              currentState !==
                states.PLAYING &&
              currentState !==
                states.BUFFERING
            ) {
              state.isPlaying = false;
              state.notify(
                "playbackStateChanged",
                false
              );

              this.showAutoplayPrompt();
              this.stopProgressPolling();
            }
          } catch (e) {
            console.warn(
              "YouTube autoplay state check error:",
              e
            );
          }
        }, 1800);
    } catch (e) {
      console.warn(
        "YouTube playback invocation error:",
        e
      );

      state.isPlaying = false;
      state.notify(
        "playbackStateChanged",
        false
      );

      this.stopProgressPolling();

      showToast(
        "YouTube playback could not start."
      );
    }
  }

  pause() {
    this.clearAutoplayTimeout();

    if (
      this.player &&
      typeof this.player.pauseVideo ===
        "function"
    ) {
      try {
        this.player.pauseVideo();
      } catch (e) {
        console.warn(
          "YouTube pause error:",
          e
        );
      }
    }

    this.stopProgressPolling();
  }

  resume() {
    this.hideAutoplayPrompt();

    if (
      this.player &&
      typeof this.player.playVideo ===
        "function"
    ) {
      try {
        this.player.playVideo();
      } catch (e) {
        console.warn(
          "YouTube resume error:",
          e
        );
      }
    }
  }

  seek(seconds) {
    if (
      this.player &&
      typeof this.player.seekTo ===
        "function"
    ) {
      try {
        const safeSeconds =
          Number.isFinite(
            Number(seconds)
          )
            ? Math.max(
                0,
                Number(seconds)
              )
            : 0;

        this.player.seekTo(
          safeSeconds,
          true
        );

        state.currentTime =
          safeSeconds;

        state.notify(
          "timeUpdate",
          {
            currentTime:
              safeSeconds,
            duration:
              state.duration
          }
        );
      } catch (e) {
        console.warn(
          "YouTube seek error:",
          e
        );
      }
    }
  }

  setVolume(volFraction) {
    if (
      this.player &&
      typeof this.player.setVolume ===
        "function"
    ) {
      try {
        const fraction =
          Number(volFraction);

        const safeFraction =
          Number.isFinite(
            fraction
          )
            ? Math.max(
                0,
                Math.min(
                  1,
                  fraction
                )
              )
            : 0;

        const volume =
          Math.round(
            safeFraction * 100
          );

        this.player.setVolume(
          volume
        );

        if (volume === 0) {
          if (
            typeof this.player.mute ===
            "function"
          ) {
            this.player.mute();
          }
        } else {
          if (
            typeof this.player.unMute ===
            "function"
          ) {
            this.player.unMute();
          }
        }
      } catch (e) {
        console.warn(
          "YouTube volume error:",
          e
        );
      }
    }
  }

  setOnEnded(callback) {
    this.onEndedCallback =
      typeof callback === "function"
        ? callback
        : null;
  }
}

export const youtubePlayer =
  new YouTubePlayerService();

export async function searchYouTubeTracks(
  query,
  maxResults = 12,
  pageToken = ""
) {
  try {
    const safeQuery =
      String(query ?? "").trim();

    if (!safeQuery) {
      return {
        items: [],
        nextPageToken: ""
      };
    }

    const safeMaxResults =
      Math.max(
        1,
        Math.min(
          50,
          Number(maxResults) || 12
        )
      );

    let url =
      `/api/youtube/search?q=${encodeURIComponent(
        safeQuery
      )}&maxResults=${safeMaxResults}`;

    if (pageToken) {
      url +=
        `&pageToken=${encodeURIComponent(
          pageToken
        )}`;
    }

    const res =
      await fetch(url);

    if (!res.ok) {
      throw new Error(
        `YouTube API error: ${res.status}`
      );
    }

    return await res.json();
  } catch (err) {
    console.warn(
      "YouTube search query error:",
      err
    );

    throw err;
  }
}
