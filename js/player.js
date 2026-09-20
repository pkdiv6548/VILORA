import { state } from "./state.js";
import { audioEngine } from "./audio-engine.js";
import { ICONS, formatTime, showToast, openModal, closeModal, updateActiveSongRows, showContextMenu, getArtworkFallback } from "./components.js";
import { lyricsService } from "./lyrics.js";
import { youtubePlayer } from "./youtube-player.js";
import { liveVisualizer } from "./live-visualizer.js";

export class PlayerController {
  constructor() {
    this.isDraggingSeek = false;
    this.eqAnimFrame = null;
    this.waveSmoothed = new Float32Array(14).fill(0.35);
    this.isVisualizerActive = false;
    this.initDOM();
    this.bindEvents();
    this.bindSubscriptions();
  }

  initDOM() {
    this.playBtn = document.getElementById("player-play-btn");
    this.prevBtn = document.getElementById("player-prev-btn");
    this.nextBtn = document.getElementById("player-next-btn");
    this.shuffleBtn = document.getElementById("player-shuffle-btn");
    this.repeatBtn = document.getElementById("player-repeat-btn");
    this.favBtn = document.getElementById("player-fav-btn");

    this.seekSlider = document.getElementById("seek-slider");
    this.seekFill = document.getElementById("seek-fill");
    this.seekThumb = document.getElementById("seek-thumb");
    this.timeCurrent = document.getElementById("time-current");
    this.timeDuration = document.getElementById("time-duration");

    this.volumeBtn = document.getElementById("player-vol-btn");
    this.volumeSlider = document.getElementById("volume-slider");
    this.volumeFill = document.getElementById("volume-fill");

    this.thumbImg = document.getElementById("player-thumb");
    this.titleEl = document.getElementById("player-title");
    this.artistEl = document.getElementById("player-artist");
    this.badgesEl = document.getElementById("player-badges");

    // Mobile controls & progress
    this.mobilePrevBtn = document.getElementById("mobile-prev-btn");
    this.mobilePlayBtn = document.getElementById("mobile-play-btn");
    this.mobileNextBtn = document.getElementById("mobile-next-btn");
    this.mobileProgressFill = document.getElementById("mobile-progress-fill");
    this.playerLeftBox = document.getElementById("player-left-box");
    this.miniPlayRingOuter = document.getElementById("mini-play-ring-outer");
    this.mobilePlayRingOuter = document.getElementById("mobile-play-ring-outer");
    this.mobileFavBtn = document.getElementById("mobile-fav-btn");
    this.mobileMenuBtn = document.getElementById("mobile-menu-btn");
    this.mobileSeekSlider = document.getElementById("mobile-seek-slider");
    this.mobileSeekFill = document.getElementById("mobile-seek-fill");
    this.mobileSeekThumb = document.getElementById("mobile-seek-thumb");
    this.mobileTimeCurrent = document.getElementById("mobile-time-current");
    this.mobileTimeDuration = document.getElementById("mobile-time-duration");

    // Fullscreen elements
    this.fsModal = document.getElementById("fullscreen-player-modal");
    this.fsBackdrop = document.getElementById("fs-backdrop-blur");
    this.fsMainBody = document.getElementById("fs-main-body");
    this.fsArtwork = document.getElementById("fs-artwork-img");
    this.fsArtworkCard = document.getElementById("fs-artwork-card");
    this.fsTitle = document.getElementById("fs-title");
    this.fsArtist = document.getElementById("fs-artist");
    this.fsPlayBtn = document.getElementById("fs-play-btn");
    this.fsPrevBtn = document.getElementById("fs-prev-btn");
    this.fsNextBtn = document.getElementById("fs-next-btn");
    this.fsShuffleBtn = document.getElementById("fs-shuffle-btn");
    this.fsRepeatBtn = document.getElementById("fs-repeat-btn");
    this.fsFavBtn = document.getElementById("fs-fav-btn");
    this.fsCloseBtn = document.getElementById("fs-close-btn");

    // Fullscreen seeker
    this.fsSeekSlider = document.getElementById("fs-seek-slider");
    this.fsSeekFill = document.getElementById("fs-seek-fill");
    this.fsSeekThumb = document.getElementById("fs-seek-thumb");
    this.fsTimeCurrent = document.getElementById("fs-time-current");
    this.fsTimeDuration = document.getElementById("fs-time-duration");

    // View Switchers
    this.fsSwitchPlayer = document.getElementById("fs-switch-player");
    this.fsSwitchVideo = document.getElementById("fs-switch-video");
    this.fsSwitchLyrics = document.getElementById("fs-switch-lyrics");
    this.fsVisualizerBtn = document.getElementById("fs-visualizer-btn");
    this.fsLiveVisualizerPanel = document.getElementById("fs-live-visualizer-panel");
    this.fsLiveVisCloseBtn = document.getElementById("fs-live-vis-close-btn");
    this.fsBackToArtBtn = document.getElementById("fs-back-to-art-btn");
    this.fsArtSwitchVideoBtn = document.getElementById("fs-art-switch-video-btn");
    this.fsEqBtn = document.getElementById("fs-eq-btn");

    if (this.fsLiveVisualizerPanel) {
      liveVisualizer.init(this.fsLiveVisualizerPanel);
    }

    // Video Mode Switchers
    this.playerVideoBtn = document.getElementById("player-video-btn");
    this.mobileVideoBtn = document.getElementById("mobile-video-btn");

    // Dedicated Video Panel Elements
    this.fsVideoPanel = document.getElementById("fs-video-panel");
    this.fsVideoSongTitle = document.getElementById("fs-video-song-title");
    this.fsVideoSongArtist = document.getElementById("fs-video-song-artist");
    this.fsVideoSwitchAudioBtn = document.getElementById("fs-video-switch-audio-btn");
    this.fsVideoMaximizeBtn = document.getElementById("fs-video-maximize-btn");
    this.fsVideoPlayBtn = document.getElementById("fs-video-play-btn");
    this.fsVideoPrevBtn = document.getElementById("fs-video-prev-btn");
    this.fsVideoNextBtn = document.getElementById("fs-video-next-btn");
    this.fsVideoSeekLine = document.getElementById("fs-video-seek-line");
    this.fsVideoSeekFill = document.getElementById("fs-video-seek-fill");
    this.fsVideoTimeCurrent = document.getElementById("fs-video-time-current");
    this.fsVideoTimeDuration = document.getElementById("fs-video-time-duration");

    // Lyrics panel elements
    this.fsLyricsSongTitle = document.getElementById("fs-lyrics-song-title");
    this.fsLyricsSongArtist = document.getElementById("fs-lyrics-song-artist");
    this.fsLyricsBarTitle = document.getElementById("fs-lyrics-bar-title");
    this.fsLyricsPlayBtn = document.getElementById("fs-lyrics-play-btn");
    this.fsLyricsPrevBtn = document.getElementById("fs-lyrics-prev-btn");
    this.fsLyricsNextBtn = document.getElementById("fs-lyrics-next-btn");
    this.fsLyricsProgressFill = document.getElementById("fs-lyrics-progress-fill");

    // Spotify Equalizer Animation references
    this.appPlayerBar = document.getElementById("app-player-bar");
    this.playerBarSpotifyEq = document.getElementById("player-bar-spotify-eq");
    this.playerBarEqBars = document.getElementById("player-bar-eq-bars");
    this.playerBarEqText = document.getElementById("player-bar-eq-text");
    this.playerThumbEqBars = document.getElementById("player-thumb-eq-bars");
    this.fsSpotifyEqBadge = document.getElementById("fs-spotify-eq-badge");
    this.fsPlayerEqBars = document.getElementById("fs-player-eq-bars");
    this.fsPlayerEqStatus = document.getElementById("fs-player-eq-status");
    this.fsPlayerEqFormat = document.getElementById("fs-player-eq-format");
    this.fsArtEqBars = document.getElementById("fs-art-eq-bars");

    // Fullscreen visualizer & wave wings elements
    this.fsVisualizerStage = document.getElementById("fs-visualizer-stage");
    this.fsAuraRing = document.getElementById("fs-aura-ring");
    this.fsWaveLeft = document.getElementById("fs-wave-left");
    this.fsWaveRight = document.getElementById("fs-wave-right");
    this.fsArtMenuBtn = document.getElementById("fs-art-menu-btn");
    this.fsPlayRingOuter = document.getElementById("fs-play-ring-outer");
    this.fsRepeatDot = document.getElementById("fs-repeat-dot");
  }

  bindEvents() {
    // Play/Pause toggles
    this.playBtn?.addEventListener("click", () => this.togglePlay());
    this.fsPlayBtn?.addEventListener("click", () => this.togglePlay());
    this.fsLyricsPlayBtn?.addEventListener("click", () => this.togglePlay());
    this.mobilePlayBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePlay();
    });

    // Next / Prev with Apple Music spring nudge animation
    const triggerNudge = (btn, dir) => {
      if (!btn) return;
      const animClass = dir === "left" ? "apple-nudge-left" : "apple-nudge-right";
      btn.classList.remove("apple-nudge-left", "apple-nudge-right");
      void btn.offsetWidth;
      btn.classList.add(animClass);
    };

    this.nextBtn?.addEventListener("click", () => {
      triggerNudge(this.nextBtn, "right");
      audioEngine.nextTrack();
    });
    this.prevBtn?.addEventListener("click", () => {
      triggerNudge(this.prevBtn, "left");
      audioEngine.prevTrack();
    });
    this.fsNextBtn?.addEventListener("click", () => {
      triggerNudge(this.fsNextBtn, "right");
      audioEngine.nextTrack();
    });
    this.fsPrevBtn?.addEventListener("click", () => {
      triggerNudge(this.fsPrevBtn, "left");
      audioEngine.prevTrack();
    });
    this.fsLyricsNextBtn?.addEventListener("click", () => {
      triggerNudge(this.fsLyricsNextBtn, "right");
      audioEngine.nextTrack();
    });
    this.fsLyricsPrevBtn?.addEventListener("click", () => {
      triggerNudge(this.fsLyricsPrevBtn, "left");
      audioEngine.prevTrack();
    });
    this.mobilePrevBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerNudge(this.mobilePrevBtn, "left");
      audioEngine.prevTrack();
    });
    this.mobileNextBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerNudge(this.mobileNextBtn, "right");
      audioEngine.nextTrack();
    });

    // Tap on mini player left area opens fullscreen player (especially on mobile)
    this.playerLeftBox?.addEventListener("click", (e) => {
      if (e.target.closest("#player-fav-btn")) return;
      this.openFullscreenPlayer();
    });

    // Shuffle
    const toggleShuffle = () => {
      state.shuffle = !state.shuffle;
      this.shuffleBtn?.classList.toggle("active", state.shuffle);
      this.fsShuffleBtn?.classList.toggle("active", state.shuffle);
      showToast(state.shuffle ? "Shuffle turned ON" : "Shuffle turned OFF");
    };
    this.shuffleBtn?.addEventListener("click", toggleShuffle);
    this.fsShuffleBtn?.addEventListener("click", toggleShuffle);

    // Repeat
    const cycleRepeat = () => {
      if (state.repeatMode === "off") {
        state.repeatMode = "all";
        const icon = ICONS.repeat;
        if (this.repeatBtn) { this.repeatBtn.innerHTML = icon; this.repeatBtn.classList.add("active"); }
        if (this.fsRepeatBtn) { this.fsRepeatBtn.innerHTML = icon; this.fsRepeatBtn.classList.add("active"); }
        showToast("Repeat All active");
      } else if (state.repeatMode === "all") {
        state.repeatMode = "one";
        const icon = ICONS.repeatOne;
        if (this.repeatBtn) { this.repeatBtn.innerHTML = icon; this.repeatBtn.classList.add("active"); }
        if (this.fsRepeatBtn) { this.fsRepeatBtn.innerHTML = icon; this.fsRepeatBtn.classList.add("active"); }
        showToast("Repeat One active");
      } else {
        state.repeatMode = "off";
        const icon = ICONS.repeat;
        if (this.repeatBtn) { this.repeatBtn.innerHTML = icon; this.repeatBtn.classList.remove("active"); }
        if (this.fsRepeatBtn) { this.fsRepeatBtn.innerHTML = icon; this.fsRepeatBtn.classList.remove("active"); }
        showToast("Repeat OFF");
      }
    };
    this.repeatBtn?.addEventListener("click", cycleRepeat);
    this.fsRepeatBtn?.addEventListener("click", cycleRepeat);

    // Favorite toggle
    const toggleFav = () => {
      if (state.currentSong) {
        const isFav = state.toggleFavorite(state.currentSong.id);
        const icon = isFav ? ICONS.heartFilled : ICONS.heart;
        if (this.favBtn) this.favBtn.innerHTML = icon;
        if (this.fsFavBtn) this.fsFavBtn.innerHTML = icon;
        if (this.mobileFavBtn) {
          this.mobileFavBtn.innerHTML = icon;
          this.mobileFavBtn.classList.toggle("is-active", isFav);
        }
        showToast(isFav ? "Saved to Favorites" : "Removed from Favorites");
      }
    };
    this.favBtn?.addEventListener("click", toggleFav);
    this.fsFavBtn?.addEventListener("click", toggleFav);
    this.mobileFavBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFav();
    });

    // Mobile Track Context Options Menu
    this.mobileMenuBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.currentSong) {
        const rect = this.mobileMenuBtn.getBoundingClientRect();
        showContextMenu(Math.max(10, rect.left - 130), Math.max(10, rect.top - 180), state.currentSong, "song");
      }
    });

    // Playing button status badge toggle
    this.playerBarSpotifyEq?.addEventListener("click", (e) => {
      e.stopPropagation();
      audioEngine.togglePlay();
    });

    // Mobile Interactive Seek Slider Drag & Tap Handler
    if (this.mobileSeekSlider) {
      let activeDragPct = null;

      const updateMobileSeekVisuals = (clientX) => {
        if (state.isStream || state.currentSong?.source === "radio" || state.currentSong?.isLive) return null;
        const rect = this.mobileSeekSlider.getBoundingClientRect();
        if (rect.width <= 0) return null;
        const clickX = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        const pctStr = `${(pct * 100).toFixed(1)}%`;
        if (this.mobileSeekFill) this.mobileSeekFill.style.width = pctStr;
        if (this.mobileSeekThumb) this.mobileSeekThumb.style.left = pctStr;
        if (this.mobileTimeCurrent && state.duration > 0) {
          this.mobileTimeCurrent.textContent = formatTime(pct * state.duration);
        }
        return pct;
      };

      this.mobileSeekSlider.addEventListener("click", (e) => {
        e.stopPropagation();
        if (state.isStream || state.currentSong?.source === "radio" || state.currentSong?.isLive) return;
        const pct = updateMobileSeekVisuals(e.clientX);
        if (pct !== null && state.duration > 0) {
          audioEngine.seek(pct * state.duration);
        }
      });

      this.mobileSeekSlider.addEventListener("touchstart", (e) => {
        e.stopPropagation();
        if (state.isStream || state.currentSong?.source === "radio" || state.currentSong?.isLive) return;
        this.isDraggingSeek = true;
        this.mobileSeekSlider.classList.add("is-dragging");
        if (e.touches && e.touches.length > 0) {
          activeDragPct = updateMobileSeekVisuals(e.touches[0].clientX);
        }
      }, { passive: true });

      this.mobileSeekSlider.addEventListener("touchmove", (e) => {
        e.stopPropagation();
        if (!this.isDraggingSeek) return;
        if (e.cancelable) e.preventDefault();
        if (e.touches && e.touches.length > 0) {
          activeDragPct = updateMobileSeekVisuals(e.touches[0].clientX);
        }
      }, { passive: false });

      const finishMobileDrag = (e) => {
        if (!this.isDraggingSeek) return;
        e.stopPropagation();
        this.isDraggingSeek = false;
        this.mobileSeekSlider.classList.remove("is-dragging");
        if (activeDragPct !== null && state.duration > 0) {
          audioEngine.seek(activeDragPct * state.duration);
        }
        activeDragPct = null;
      };

      this.mobileSeekSlider.addEventListener("touchend", finishMobileDrag);
      this.mobileSeekSlider.addEventListener("touchcancel", finishMobileDrag);
    }

    // View Switching in Fullscreen (Player vs Video vs Lyrics)
    this.fsSwitchPlayer?.addEventListener("click", () => this.setFullscreenView("player"));
    this.fsSwitchVideo?.addEventListener("click", () => {
      if (!this.isYouTubeTrack(state.currentSong)) {
        showToast("Video option only YouTube songs ke liye available hai");
        return;
      }
      this.setFullscreenView("video");
    });
    this.fsSwitchLyrics?.addEventListener("click", () => this.setFullscreenView("lyrics"));
    this.fsVisualizerBtn?.addEventListener("click", () => this.toggleLiveVisualizer());
    this.fsLiveVisCloseBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleLiveVisualizer(false);
    });
    this.fsBackToArtBtn?.addEventListener("click", () => this.setFullscreenView("player"));
    this.fsVideoSwitchAudioBtn?.addEventListener("click", () => this.setFullscreenView("player"));
    this.fsVideoMaximizeBtn?.addEventListener("click", () => youtubePlayer.toggleFullscreenMaximize());

    // Spotify-style "Switch to Video" badge on artwork card
    this.fsArtSwitchVideoBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.isYouTubeTrack(state.currentSong)) {
        showToast("Video option only YouTube songs ke liye available hai");
        return;
      }
      this.setFullscreenView("video");
    });

    // Player bar & mobile bottom bar video toggles
    this.playerVideoBtn?.addEventListener("click", () => {
      if (!this.isYouTubeTrack(state.currentSong)) {
        showToast("Video option only YouTube songs ke liye available hai");
        return;
      }
      audioEngine.toggleVideoMode();
    });

    this.mobileVideoBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!this.isYouTubeTrack(state.currentSong)) {
    showToast("Video option only YouTube songs ke liye available hai");
    return;
  }
  this.openFullscreenPlayer("video");
});
    // Video Panel playback controls
    this.fsVideoPlayBtn?.addEventListener("click", () => this.togglePlay());
    this.fsVideoPrevBtn?.addEventListener("click", () => audioEngine.prevTrack());
    this.fsVideoNextBtn?.addEventListener("click", () => audioEngine.nextTrack());

    // Video scrubber line interaction
    this.fsVideoSeekLine?.addEventListener("click", (e) => {
      if (state.duration > 0) {
        const rect = this.fsVideoSeekLine.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        audioEngine.seek(pct * state.duration);
      }
    });

    this.fsArtworkCard?.addEventListener("click", (e) => {
      if (e.target.closest("#fs-art-menu-btn") || e.target.closest("#fs-art-switch-video-btn")) return;
      this.setFullscreenView("lyrics");
    });

    // Artwork Floating Options Menu Button
    this.fsArtMenuBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.currentSong) {
        const rect = this.fsArtMenuBtn.getBoundingClientRect();
        showContextMenu(Math.max(10, rect.left - 130), rect.bottom + 8, state.currentSong, "song");
      }
    });

    // Fullscreen Equalizer Shortcut
    this.fsEqBtn?.addEventListener("click", () => {
      this.closeFullscreenPlayer();
      window.location.hash = "#/equalizer";
    });

    // Main Seek interaction
    if (this.seekSlider) {
      const handleSeek = (e) => {
        if (state.isStream || state.currentSong?.source === "radio" || state.currentSong?.isLive) return;
        const rect = this.seekSlider.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clickX = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = pct * state.duration;
        audioEngine.seek(newTime);
      };

      this.seekSlider.addEventListener("click", handleSeek);

      this.seekSlider.addEventListener("mousedown", (e) => {
        if (state.isStream || state.currentSong?.source === "radio" || state.currentSong?.isLive) return;
        this.isDraggingSeek = true;
        this.seekSlider.classList.add("is-dragging");
        handleSeek(e);

        const onMouseMove = (moveEv) => {
          if (this.isDraggingSeek) handleSeek(moveEv);
        };
        const onMouseUp = () => {
          this.isDraggingSeek = false;
          this.seekSlider.classList.remove("is-dragging");
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });
    }

    // Fullscreen Seek interaction
    if (this.fsSeekSlider) {
      const handleFsSeek = (e) => {
        if (state.isStream || state.currentSong?.source === "radio" || state.currentSong?.isLive) return;
        const rect = this.fsSeekSlider.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clickX = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = pct * state.duration;
        audioEngine.seek(newTime);
      };

      this.fsSeekSlider.addEventListener("click", handleFsSeek);

      this.fsSeekSlider.addEventListener("mousedown", (e) => {
        if (state.isStream || state.currentSong?.source === "radio" || state.currentSong?.isLive) return;
        this.isDraggingSeek = true;
        this.fsSeekSlider.classList.add("is-dragging");
        handleFsSeek(e);

        const onFsMove = (moveEv) => {
          if (this.isDraggingSeek) handleFsSeek(moveEv);
        };
        const onFsUp = () => {
          this.isDraggingSeek = false;
          this.fsSeekSlider.classList.remove("is-dragging");
          window.removeEventListener("mousemove", onFsMove);
          window.removeEventListener("mouseup", onFsUp);
        };
        window.addEventListener("mousemove", onFsMove);
        window.addEventListener("mouseup", onFsUp);
      });

      this.fsSeekSlider.addEventListener("touchstart", (e) => {
        this.isDraggingSeek = true;
        this.fsSeekSlider.classList.add("is-dragging");
        handleFsSeek(e);
      }, { passive: true });

      this.fsSeekSlider.addEventListener("touchmove", (e) => {
        if (this.isDraggingSeek) handleFsSeek(e);
      }, { passive: true });

      this.fsSeekSlider.addEventListener("touchend", () => {
        this.isDraggingSeek = false;
        this.fsSeekSlider.classList.remove("is-dragging");
      });
    }

    // Volume Slider
    if (this.volumeSlider) {
      const handleVol = (e) => {
        const rect = this.volumeSlider.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        audioEngine.setVolume(pct);
      };
      this.volumeSlider.addEventListener("click", handleVol);
    }

    // Volume Mute
    this.volumeBtn?.addEventListener("click", () => {
      audioEngine.toggleMute();
    });

    // Fullscreen player open/close
    document.getElementById("player-expand-btn")?.addEventListener("click", () => {
      this.openFullscreenPlayer();
    });
    this.thumbImg?.parentElement?.addEventListener("click", () => {
      this.openFullscreenPlayer();
    });
    this.fsCloseBtn?.addEventListener("click", () => {
      this.closeFullscreenPlayer();
    });

    // Header / Bar shortcuts: Equalizer, Visualizer, Lyrics, Sleep Timer
    document.getElementById("player-eq-btn")?.addEventListener("click", () => {
      window.location.hash = "#/equalizer";
    });
    document.getElementById("player-vis-btn")?.addEventListener("click", () => {
      window.location.hash = "#/visualizer";
    });
    document.getElementById("player-lyrics-btn")?.addEventListener("click", () => {
      window.location.hash = "#/lyrics";
    });
    document.getElementById("player-queue-btn")?.addEventListener("click", () => {
      this.toggleRightPanel("queue");
    });
    document.getElementById("player-timer-btn")?.addEventListener("click", () => {
      this.openSleepTimerModal();
    });
    document.getElementById("player-quality-btn")?.addEventListener("click", () => {
      this.openQualityModal();
    });
  }

  bindSubscriptions() {
    state.subscribe("songChanged", (song) => {
      this.renderSong(song);
      updateActiveSongRows();
    });
    state.subscribe("playbackStateChanged", (isPlaying) => {
      this.renderPlaybackState(isPlaying);
      updateActiveSongRows();
    });
    state.subscribe("queueChanged", () => {
      updateActiveSongRows();
    });
    state.subscribe("timeUpdate", (data) => this.renderTime(data));
    state.subscribe("volumeChanged", (data) => this.renderVolume(data));
    state.subscribe("videoModeChanged", (isVideoMode) => this.renderVideoMode(isVideoMode));
    state.subscribe("favoritesChanged", ({ songId, isFavorite }) => {
      if (state.currentSong && state.currentSong.id === songId) {
        if (this.favBtn) this.favBtn.innerHTML = isFavorite ? ICONS.heartFilled : ICONS.heart;
      }
    });

    if (state.currentSong) {
      this.renderSong(state.currentSong);
    }
    updateActiveSongRows();
  }

  isYouTubeTrack(song) {
    if (!song) return false;
    if (song.source === "local" || song.isCustom || song.blobUrl || song.isRadio || song.source === "radio") {
      return false;
    }
    return Boolean(
      song.source === "youtube" ||
      (typeof song.id === "string" && song.id.startsWith("youtube:")) ||
      song.youtubeId
    );
  }

  renderVideoMode(isVideoMode) {
    const isYt = this.isYouTubeTrack(state.currentSong);
    const active = Boolean(isVideoMode && isYt);

    if (this.playerVideoBtn) {
      this.playerVideoBtn.classList.toggle("active", active);
      this.playerVideoBtn.style.display = isYt ? "" : "none";
    }
    if (this.mobileVideoBtn) {
      this.mobileVideoBtn.classList.toggle("active", active);
      this.mobileVideoBtn.style.display = isYt ? "" : "none";
    }
    if (this.fsSwitchVideo) {
      this.fsSwitchVideo.classList.toggle("active", active && this.fsMainBody?.classList.contains("view-video"));
      this.fsSwitchVideo.style.display = isYt ? "" : "none";
    }
    if (this.fsArtSwitchVideoBtn) {
      this.fsArtSwitchVideoBtn.style.display = isYt ? "" : "none";
    }

    // If fullscreen modal is open, sync view
    if (this.fsModal?.classList.contains("open")) {
      if (active) {
        this.setFullscreenView("video");
      } else if (this.fsMainBody?.classList.contains("view-video")) {
        this.setFullscreenView("player");
      }
    }
  }

  togglePlay() {
    if (state.isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  }

  renderSong(song) {
    if (!song) return;
    window.__vioraCurrentTitle = song.title;
    window.__musiqCurrentTitle = song.title;

    const safeArtwork = (song.artwork && !song.artwork.startsWith("blob:"))
      ? song.artwork
      : getArtworkFallback(song.title, song.artist);

    if (this.thumbImg) {
      this.thumbImg.src = safeArtwork;
      this.thumbImg.alt = song.title || "Album Artwork";
      this.thumbImg.onerror = () => {
        this.thumbImg.onerror = null;
        this.thumbImg.src = getArtworkFallback(song.title, song.artist);
      };
    }
    if (this.titleEl) this.titleEl.textContent = song.title;
    if (this.artistEl) this.artistEl.textContent = song.artist;

    // Video Option Visibility: ONLY show video play option for YouTube API songs
    const isYouTubeTrack = this.isYouTubeTrack(song);

    if (this.playerVideoBtn) {
      this.playerVideoBtn.style.display = isYouTubeTrack ? "" : "none";
      if (!isYouTubeTrack) this.playerVideoBtn.classList.remove("active");
    }
    if (this.mobileVideoBtn) {
      this.mobileVideoBtn.style.display = isYouTubeTrack ? "" : "none";
      if (!isYouTubeTrack) this.mobileVideoBtn.classList.remove("active");
    }
    if (this.fsSwitchVideo) {
      this.fsSwitchVideo.style.display = isYouTubeTrack ? "" : "none";
      if (!isYouTubeTrack) this.fsSwitchVideo.classList.remove("active");
    }
    if (this.fsArtSwitchVideoBtn) {
      this.fsArtSwitchVideoBtn.style.display = isYouTubeTrack ? "" : "none";
    }

    // If current song is NOT a YouTube track, ensure video mode is turned off
    if (!isYouTubeTrack) {
      if (state.isVideoMode) {
        state.setVideoMode(false);
      }
      if (this.fsMainBody?.classList.contains("view-video")) {
        this.setFullscreenView("player");
      }
    }

    if (this.badgesEl) {
      const isYouTube = song.source === "youtube" || (song.id && song.id.startsWith("youtube:"));
      const isLocal = song.source === "local" || (song.id && song.id.startsWith("local:"));
      const isRadio = song.source === "radio" || state.isStream || song.isLive;
      let sourceBadge = `<span class="badge-pill">${song.format || "MP3"}</span>`;
      if (isRadio) {
        sourceBadge = `<span class="badge-pill" style="background:rgba(239,68,68,0.22);color:#ef4444;border:1px solid rgba(239,68,68,0.45);font-weight:700;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ef4444;margin-right:4px;vertical-align:1px;"></span>LIVE RADIO</span>`;
      } else if (isYouTube) {
        sourceBadge = `<span class="badge-pill" style="background:rgba(255,0,0,0.18);color:#ff4b4b;border:1px solid rgba(255,0,0,0.3);"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline;margin-right:3px;vertical-align:-1px;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>YouTube</span>`;
      } else if (isLocal) {
        sourceBadge = `<span class="badge-pill" style="background:rgba(0,180,255,0.16);color:#38bdf8;border:1px solid rgba(0,180,255,0.25);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;margin-right:3px;vertical-align:-1px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>Local</span>`;
      }

      this.badgesEl.innerHTML = `
        ${sourceBadge}
        <span class="badge-pill">${song.frequency || song.bitrate || "320k"}</span>
        ${song.isHiRes ? `<span class="badge-pill" style="color:#d4af37;background:rgba(212,175,55,0.15)">Hi-Res</span>` : ""}
      `;
    }

    if (this.favBtn) {
      this.favBtn.innerHTML = state.isFavorite(song.id) ? ICONS.heartFilled : ICONS.heart;
    }
    if (this.fsFavBtn) {
      this.fsFavBtn.innerHTML = state.isFavorite(song.id) ? ICONS.heartFilled : ICONS.heart;
    }
    if (this.mobileFavBtn) {
      const isFav = state.isFavorite(song.id);
      this.mobileFavBtn.innerHTML = isFav ? ICONS.heartFilled : ICONS.heart;
      this.mobileFavBtn.classList.toggle("is-active", isFav);
    }

    // Fullscreen updates
    if (this.fsArtwork) {
      this.fsArtwork.src = safeArtwork;
      this.fsArtwork.alt = song.title || "Album Artwork";
      this.fsArtwork.onerror = () => {
        this.fsArtwork.onerror = null;
        this.fsArtwork.src = getArtworkFallback(song.title, song.artist);
      };
    }
    if (this.fsBackdrop) this.fsBackdrop.style.backgroundImage = `url('${safeArtwork}')`;
    if (this.fsTitle) this.fsTitle.textContent = song.title;
    if (this.fsArtist) this.fsArtist.textContent = song.artist;

    if (this.fsLyricsSongTitle) this.fsLyricsSongTitle.textContent = song.title;
    if (this.fsLyricsSongArtist) this.fsLyricsSongArtist.textContent = song.artist;
    if (this.fsLyricsBarTitle) this.fsLyricsBarTitle.textContent = `${song.title} • ${song.artist}`;

    // Dedicated Video Panel metadata
    if (this.fsVideoSongTitle) this.fsVideoSongTitle.textContent = song.title;
    if (this.fsVideoSongArtist) this.fsVideoSongArtist.textContent = song.artist;

    if (this.fsPlayerEqFormat) {
      this.fsPlayerEqFormat.textContent = `${song.bitrate || "320K"} • ${song.format || (song.isHiRes ? "HI-RES" : "AUDIO")}`;
    }

    // Render lyrics if fullscreen is currently displaying lyrics
    const lyricsContainer = document.getElementById("fs-lyrics-display");
    if (lyricsContainer && this.fsModal?.classList.contains("open")) {
      lyricsService.renderToContainer(lyricsContainer, song.id);
    }

    // Apple Music Artwork Pop Animation on track switch
    if (this.fsArtworkCard) {
      this.fsArtworkCard.classList.remove("track-switched");
      void this.fsArtworkCard.offsetWidth;
      this.fsArtworkCard.classList.add("track-switched");
    }

    // Update active song rows, cards, and queue
    updateActiveSongRows();
  }

  renderPlaybackState(isPlaying) {
    const playIcon = isPlaying ? ICONS.pause : ICONS.play;
    const popHtml = `<span class="apple-icon-pop">${playIcon}</span>`;
    if (this.playBtn) this.playBtn.innerHTML = popHtml;
    if (this.fsPlayBtn) this.fsPlayBtn.innerHTML = popHtml;
    if (this.fsLyricsPlayBtn) this.fsLyricsPlayBtn.innerHTML = popHtml;
    if (this.fsVideoPlayBtn) this.fsVideoPlayBtn.innerHTML = popHtml;
    if (this.mobilePlayBtn) this.mobilePlayBtn.innerHTML = popHtml;

    if (this.fsArtworkCard) {
      this.fsArtworkCard.classList.toggle("playing", isPlaying);
    }

    if (this.miniPlayRingOuter) {
      this.miniPlayRingOuter.classList.toggle("is-playing", isPlaying);
    }
    if (this.mobilePlayRingOuter) {
      this.mobilePlayRingOuter.classList.toggle("is-playing", isPlaying);
    }

    // Toggle container playback classes
    this.appPlayerBar?.classList.toggle("is-playing", isPlaying);
    this.appPlayerBar?.classList.toggle("is-paused", !isPlaying);
    this.fsModal?.classList.toggle("is-playing", isPlaying);
    this.fsModal?.classList.toggle("is-paused", !isPlaying);

    // Toggle equalizer animation classes across all Spotify equalizer bars
    const allEqBars = document.querySelectorAll(".spotify-eq-bars");
    allEqBars.forEach(el => {
      el.classList.toggle("is-playing", isPlaying);
      el.classList.toggle("is-paused", !isPlaying);
    });

    // Update player bar pill status
    if (this.playerBarSpotifyEq) {
      this.playerBarSpotifyEq.classList.toggle("is-paused", !isPlaying);
    }
    if (this.playerBarEqText) {
      this.playerBarEqText.textContent = isPlaying ? "PLAYING" : "PAUSED";
    }

    // Update fullscreen player badge status
    if (this.fsSpotifyEqBadge) {
      this.fsSpotifyEqBadge.classList.toggle("is-paused", !isPlaying);
    }
    if (this.fsPlayerEqStatus) {
      this.fsPlayerEqStatus.textContent = isPlaying ? "NOW PLAYING" : "PAUSED";
    }

    // Dynamic seek bar glow & fill effect
    this.seekFill?.classList.toggle("spotify-active-bar", isPlaying);
    this.fsSeekFill?.classList.toggle("spotify-active-bar", isPlaying);

    // Update equalizer bar animation (audio-reactive or CSS animation)
    this.updateEqualizerAnimation(isPlaying);

    // Synchronize all table rows, music cards, and queue items
    updateActiveSongRows();
  }

  updateEqualizerAnimation(isPlaying) {
    if (this.eqAnimFrame) {
      cancelAnimationFrame(this.eqAnimFrame);
      this.eqAnimFrame = null;
    }

    if (!isPlaying) {
      const allBars = document.querySelectorAll(".spotify-eq-bar, .fs-wave-bar");
      allBars.forEach(bar => {
        bar.style.transform = "";
      });
      document.querySelectorAll(".spotify-eq-bars.audio-reactive").forEach(el => {
        el.classList.remove("audio-reactive");
      });
      return;
    }

    // 14 logarithmic frequency bands + pink noise compensation
    // Bar 0 is closest to artwork (bass/kick punch), Bar 13 is outermost (treble air)
    const bandConfig = [
      { start: 1, end: 3, boost: 1.05 },    // 0: Deep Sub-bass
      { start: 3, end: 6, boost: 1.1 },     // 1: Bass
      { start: 6, end: 10, boost: 1.18 },   // 2: Warm Low-mids
      { start: 10, end: 16, boost: 1.28 },  // 3: Mids (primary crest)
      { start: 16, end: 24, boost: 1.38 },  // 4: Vocal core
      { start: 24, end: 34, boost: 1.48 },  // 5: Upper mids
      { start: 34, end: 46, boost: 1.62 },  // 6: Presence (secondary crest)
      { start: 46, end: 60, boost: 1.78 },  // 7: Brilliance
      { start: 60, end: 76, boost: 1.98 },  // 8: Crisp highs
      { start: 76, end: 94, boost: 2.2 },   // 9: Highs
      { start: 94, end: 114, boost: 2.42 }, // 10: Treble
      { start: 114, end: 136, boost: 2.68 },// 11: Sparkle
      { start: 136, end: 160, boost: 2.95 },// 12: Ultra-high
      { start: 160, end: 190, boost: 3.25 } // 13: Air & ambience
    ];

    // Ultra-smooth 60fps render loop with liquid spring damping & acoustic harmonic physics
    const tick = () => {
      if (!state.isPlaying) return;

      try {
        const dataArray = audioEngine.getFrequencyData();
        const hasAudioData = dataArray && dataArray.length > 0;

        let energySum = 0;
        if (hasAudioData) {
          for (let i = 0; i < 24; i++) {
            energySum += (dataArray[i] || 0);
          }
        }
        const avgEnergy = hasAudioData ? (energySum / 24) : 0;
        const now = performance.now() * 0.0025;

        // Player bar active reactive indicators
        if (avgEnergy > 5) {
          document.querySelectorAll(".spotify-eq-bars.is-playing").forEach(el => {
            if (!el.classList.contains("audio-reactive")) el.classList.add("audio-reactive");
          });

          const bar1Scale = Math.min(1, Math.max(0.2, ((dataArray[2] || 0) / 210)));
          const bar2Scale = Math.min(1, Math.max(0.28, ((dataArray[5] || 0) / 195)));
          const bar3Scale = Math.min(1, Math.max(0.22, ((dataArray[9] || 0) / 180)));
          const bar4Scale = Math.min(1, Math.max(0.25, ((dataArray[14] || 0) / 165)));

          const bar1Els = document.querySelectorAll(".spotify-eq-bars.is-playing .spotify-eq-bar.bar-1");
          const bar2Els = document.querySelectorAll(".spotify-eq-bars.is-playing .spotify-eq-bar.bar-2");
          const bar3Els = document.querySelectorAll(".spotify-eq-bars.is-playing .spotify-eq-bar.bar-3");
          const bar4Els = document.querySelectorAll(".spotify-eq-bars.is-playing .spotify-eq-bar.bar-4");

          bar1Els.forEach(b => { b.style.transform = `scaleY(${bar1Scale})`; });
          bar2Els.forEach(b => { b.style.transform = `scaleY(${bar2Scale})`; });
          bar3Els.forEach(b => { b.style.transform = `scaleY(${bar3Scale})`; });
          bar4Els.forEach(b => { b.style.transform = `scaleY(${bar4Scale})`; });
        } else {
          document.querySelectorAll(".spotify-eq-bars.audio-reactive").forEach(el => {
            el.classList.remove("audio-reactive");
          });
          const allBars = document.querySelectorAll(".spotify-eq-bar");
          allBars.forEach(bar => {
            bar.style.transform = "";
          });
        }

        // Fullscreen Symmetrical Wave Wings: 14 bars with liquid physics & acoustic harmonic profile
        const leftWaveBars = document.querySelectorAll("#fs-wave-left .fs-wave-bar");
        const rightWaveBars = document.querySelectorAll("#fs-wave-right .fs-wave-bar");

        for (let i = 0; i < 14; i++) {
          const cfg = bandConfig[i];
          let bandEnergy = 0;
          if (hasAudioData && avgEnergy > 2) {
            let count = 0;
            for (let b = cfg.start; b <= cfg.end && b < dataArray.length; b++) {
              bandEnergy += dataArray[b];
              count++;
            }
            if (count > 0) bandEnergy = (bandEnergy / count) / 255;
          }

          // Liquid multi-harmonic wave flutter to ensure organic motion even during soft passages
          const harmonicFlutter = Math.sin(now * 2.1 + i * 0.52) * 0.16 + Math.cos(now * 1.35 - i * 0.38) * 0.12;
          const reactivePart = bandEnergy * cfg.boost * 1.15;
          const target = Math.min(1.42, Math.max(0.22, reactivePart + harmonicFlutter + 0.34));

          // Spring damping: snappy attack (0.34) for rhythm, silky smooth decay (0.16) for analog feel
          const lerpRate = target > this.waveSmoothed[i] ? 0.34 : 0.16;
          this.waveSmoothed[i] += (target - this.waveSmoothed[i]) * lerpRate;

          const scaleVal = this.waveSmoothed[i].toFixed(3);
          if (leftWaveBars[i]) leftWaveBars[i].style.transform = `scaleY(${scaleVal})`;
          if (rightWaveBars[i]) rightWaveBars[i].style.transform = `scaleY(${scaleVal})`;
        }
      } catch (e) {}

      this.eqAnimFrame = requestAnimationFrame(tick);
    };

    this.eqAnimFrame = requestAnimationFrame(tick);
  }

  renderTime({ currentTime, duration }) {
    if (this.isDraggingSeek) return;

    if (state.isStream || state.currentSong?.source === "radio" || state.currentSong?.isLive) {
      if (this.timeCurrent) this.timeCurrent.innerHTML = `<span style="color:#ef4444;font-weight:700;">● LIVE</span>`;
      if (this.timeDuration) this.timeDuration.textContent = state.currentStation?.frequency || "BROADCAST";
      if (this.fsTimeCurrent) this.fsTimeCurrent.innerHTML = `<span style="color:#ef4444;font-weight:700;">● LIVE</span>`;
      if (this.fsTimeDuration) this.fsTimeDuration.textContent = state.currentStation?.frequency || "BROADCAST";

      if (this.seekFill) this.seekFill.style.width = "100%";
      if (this.seekThumb) this.seekThumb.style.left = "100%";
      if (this.fsSeekFill) this.fsSeekFill.style.width = "100%";
      if (this.fsSeekThumb) this.fsSeekThumb.style.left = "100%";
      if (this.fsLyricsProgressFill) this.fsLyricsProgressFill.style.width = "100%";
      if (this.mobileProgressFill) this.mobileProgressFill.style.width = "100%";
      if (this.mobileSeekFill) this.mobileSeekFill.style.width = "100%";
      if (this.mobileSeekThumb) this.mobileSeekThumb.style.left = "100%";
      if (this.mobileTimeCurrent) this.mobileTimeCurrent.innerHTML = `<span style="color:#ef4444;font-weight:700;">● LIVE</span>`;
      if (this.mobileTimeDuration) this.mobileTimeDuration.textContent = state.currentStation?.frequency || "BROADCAST";
      return;
    }

    const curFormatted = formatTime(currentTime);
    const durFormatted = formatTime(duration);

    if (this.timeCurrent) this.timeCurrent.textContent = curFormatted;
    if (this.timeDuration) this.timeDuration.textContent = durFormatted;
    if (this.fsTimeCurrent) this.fsTimeCurrent.textContent = curFormatted;
    if (this.fsTimeDuration) this.fsTimeDuration.textContent = durFormatted;
    if (this.fsVideoTimeCurrent) this.fsVideoTimeCurrent.textContent = curFormatted;
    if (this.fsVideoTimeDuration) this.fsVideoTimeDuration.textContent = durFormatted;

    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
    if (this.seekFill) this.seekFill.style.width = `${pct}%`;
    if (this.seekThumb) this.seekThumb.style.left = `${pct}%`;
    if (this.fsSeekFill) this.fsSeekFill.style.width = `${pct}%`;
    if (this.fsSeekThumb) this.fsSeekThumb.style.left = `${pct}%`;
    if (this.fsVideoSeekFill) this.fsVideoSeekFill.style.width = `${pct}%`;
    if (this.fsLyricsProgressFill) this.fsLyricsProgressFill.style.width = `${pct}%`;
    if (this.mobileProgressFill) this.mobileProgressFill.style.width = `${pct}%`;
    if (this.mobileSeekFill) this.mobileSeekFill.style.width = `${pct}%`;
    if (this.mobileSeekThumb) this.mobileSeekThumb.style.left = `${pct}%`;
    if (this.mobileTimeCurrent) this.mobileTimeCurrent.textContent = curFormatted;
    if (this.mobileTimeDuration) this.mobileTimeDuration.textContent = durFormatted;

    // Lyrics highlight update
    lyricsService.updateHighlight(currentTime);
  }

  renderVolume({ volume, isMuted }) {
    if (this.volumeFill) {
      this.volumeFill.style.width = `${isMuted ? 0 : volume * 100}%`;
    }
    if (this.volumeBtn) {
      this.volumeBtn.innerHTML = (isMuted || volume === 0) ? ICONS.volumeMute : ICONS.volume;
    }
  }

  toggleLiveVisualizer(forceState = null) {
    const nextState = forceState !== null ? forceState : !this.isVisualizerActive;
    this.isVisualizerActive = nextState;

    if (this.fsVisualizerBtn) {
      this.fsVisualizerBtn.classList.toggle("active", this.isVisualizerActive);
    }
    if (this.fsVisualizerStage) {
      this.fsVisualizerStage.classList.toggle("visualizer-active", this.isVisualizerActive);
    }
    if (this.fsLiveVisualizerPanel) {
      this.fsLiveVisualizerPanel.setAttribute("aria-hidden", (!this.isVisualizerActive).toString());
    }

    if (this.isVisualizerActive) {
      liveVisualizer.start();
      requestAnimationFrame(() => {
        liveVisualizer.resize();
      });
      setTimeout(() => {
        liveVisualizer.resize();
      }, 60);
    } else {
      liveVisualizer.stop();
    }
  }

  setFullscreenView(view = "player") {
    if (!this.fsMainBody) return;

    if (view === "video") {
      const isYt = this.isYouTubeTrack(state.currentSong);
      if (!isYt) {
        showToast("Video option only YouTube songs ke liye available hai");
        this.setFullscreenView("player");
        return;
      }

      this.fsMainBody.classList.remove("view-player", "view-lyrics");
      this.fsMainBody.classList.add("view-video");
      this.fsSwitchPlayer?.classList.remove("active");
      this.fsSwitchLyrics?.classList.remove("active");
      this.fsSwitchVideo?.classList.add("active");

      // Enable video mode and mount YouTube player in fullscreen video panel
      if (!state.isVideoMode) audioEngine.enableVideoMode();
      youtubePlayer.setFullscreenMount(true);
    } else if (view === "lyrics") {
      this.fsMainBody.classList.remove("view-player", "view-video");
      this.fsMainBody.classList.add("view-lyrics");
      this.fsSwitchPlayer?.classList.remove("active");
      this.fsSwitchVideo?.classList.remove("active");
      this.fsSwitchLyrics?.classList.add("active");

      youtubePlayer.setFullscreenMount(false);

      const lyricsContainer = document.getElementById("fs-lyrics-display");
      if (lyricsContainer && state.currentSong) {
        lyricsService.renderToContainer(lyricsContainer, state.currentSong.id);
        lyricsService.updateHighlight(state.currentTime);
      }
      liveVisualizer.stop();
    } else {
      // Audio player view
      this.fsMainBody.classList.remove("view-lyrics", "view-video");
      this.fsMainBody.classList.add("view-player");
      this.fsSwitchLyrics?.classList.remove("active");
      this.fsSwitchVideo?.classList.remove("active");
      this.fsSwitchPlayer?.classList.add("active");

      youtubePlayer.setFullscreenMount(false);
      if (this.isVisualizerActive) {
        liveVisualizer.start();
      }
    }
  }

  openFullscreenPlayer(defaultView = null) {
    if (this.fsModal) {
      this.fsModal.classList.add("open");
      const isYt = this.isYouTubeTrack(state.currentSong);
      let targetView = defaultView;
      if (!targetView) {
        targetView = (state.isVideoMode && isYt) ? "video" : "player";
      } else if (targetView === "video" && !isYt) {
        targetView = "player";
      }
      this.setFullscreenView(targetView);

      if (targetView === "player" && this.isVisualizerActive) {
        liveVisualizer.start();
      }

      // Sync shuffle, repeat, favorite buttons in fullscreen
      if (this.fsShuffleBtn) this.fsShuffleBtn.classList.toggle("active", state.shuffle);
      if (this.fsRepeatBtn) {
        if (state.repeatMode === "one") {
          this.fsRepeatBtn.innerHTML = ICONS.repeatOne;
          this.fsRepeatBtn.classList.add("active");
        } else if (state.repeatMode === "all") {
          this.fsRepeatBtn.innerHTML = ICONS.repeat;
          this.fsRepeatBtn.classList.add("active");
        } else {
          this.fsRepeatBtn.innerHTML = ICONS.repeat;
          this.fsRepeatBtn.classList.remove("active");
        }
      }
      if (this.fsFavBtn && state.currentSong) {
        this.fsFavBtn.innerHTML = state.isFavorite(state.currentSong.id) ? ICONS.heartFilled : ICONS.heart;
      }
    }
  }

  closeFullscreenPlayer() {
    if (this.fsModal) {
      this.fsModal.classList.remove("open");
      youtubePlayer.setFullscreenMount(false);
      liveVisualizer.stop();
    }
  }

  toggleRightPanel(tab = "queue") {
    const mainBody = document.querySelector(".app-main-body");
    if (!mainBody) return;

    if (state.settings.rightPanelOpen && state.settings.rightPanelTab === tab) {
      state.settings.rightPanelOpen = false;
      mainBody.classList.add("right-collapsed");
    } else {
      state.settings.rightPanelOpen = true;
      state.settings.rightPanelTab = tab;
      mainBody.classList.remove("right-collapsed");
      state.notify("rightPanelTabChanged", tab);
    }
  }

  openSleepTimerModal() {
    openModal("Sleep Timer", `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <p style="font-size:0.85rem;color:var(--color-text-muted);">Automatically stop audio playback after a designated period:</p>
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;">
          <button class="btn-secondary timer-opt" data-mins="15">15 Minutes</button>
          <button class="btn-secondary timer-opt" data-mins="30">30 Minutes</button>
          <button class="btn-secondary timer-opt" data-mins="45">45 Minutes</button>
          <button class="btn-secondary timer-opt" data-mins="60">60 Minutes</button>
          <button class="btn-secondary timer-opt" data-mins="track">End of Track</button>
          <button class="btn-secondary timer-opt" data-mins="off" style="color:#ef4444;">Cancel Timer</button>
        </div>
      </div>
    `);

    const container = document.getElementById("modal-container");
    container.querySelectorAll(".timer-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        const mins = btn.dataset.mins;
        if (mins === "off") {
          if (state.sleepTimer.timerId) clearTimeout(state.sleepTimer.timerId);
          state.sleepTimer.active = false;
          showToast("Sleep timer cancelled");
        } else if (mins === "track") {
          state.sleepTimer.active = true;
          showToast("Sleep timer set for end of current song");
        } else {
          const num = parseInt(mins, 10);
          if (state.sleepTimer.timerId) clearTimeout(state.sleepTimer.timerId);
          state.sleepTimer.active = true;
          state.sleepTimer.timerId = setTimeout(() => {
            audioEngine.pause();
            showToast("Sleep timer finished. Playback paused.");
          }, num * 60 * 1000);
          showToast(`Sleep timer set for ${num} minutes`);
        }
        closeModal();
      });
    });
  }

  openQualityModal() {
    openModal("Streaming & Audio Quality", `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:8px;background:var(--color-bg-card);">
            <input type="radio" name="audio-qual" value="standard" ${state.settings.audioQuality === "standard" ? "checked" : ""}>
            <div>
              <div style="font-weight:600;">Data Saver (160 kbps AAC)</div>
              <div style="font-size:0.75rem;color:var(--color-text-muted);">Optimized for metered connections and cellular networks.</div>
            </div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:8px;background:var(--color-bg-card);">
            <input type="radio" name="audio-qual" value="high" ${state.settings.audioQuality === "high" ? "checked" : ""}>
            <div>
              <div style="font-weight:600;">High Quality (320 kbps MP3/AAC)</div>
              <div style="font-size:0.75rem;color:var(--color-text-muted);">Crystal clear stereo audio with wide dynamic range.</div>
            </div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:8px;background:var(--color-bg-card);">
            <input type="radio" name="audio-qual" value="lossless" ${state.settings.audioQuality === "lossless" ? "checked" : ""}>
            <div>
              <div style="font-weight:600;color:var(--color-accent);">Lossless (ALAC/FLAC up to 24-bit/48 kHz)</div>
              <div style="font-size:0.75rem;color:var(--color-text-muted);">Bit-for-bit studio master accuracy with zero audio compression artifacts.</div>
            </div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:8px;background:var(--color-bg-card);">
            <input type="radio" name="audio-qual" value="hi-res" ${state.settings.audioQuality === "hi-res" ? "checked" : ""}>
            <div>
              <div style="font-weight:600;color:#d4af37;">Hi-Res Lossless (24-bit/96 kHz)</div>
              <div style="font-size:0.75rem;color:var(--color-text-muted);">Audiophile resolution preserving extreme micro-dynamics and space.</div>
            </div>
          </label>
        </div>
      </div>
    `, `
      <button class="btn-primary" id="save-qual-btn">Confirm</button>
    `);

    document.getElementById("save-qual-btn")?.addEventListener("click", () => {
      const selected = document.querySelector("input[name='audio-qual']:checked")?.value || "lossless";
      state.updateSettings({ audioQuality: selected });
      showToast(`Audio quality configured: ${selected.toUpperCase()}`);
      closeModal();
    });
  }
}
