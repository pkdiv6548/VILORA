import { state } from "./state.js";
import { storage } from "./storage.js";
import { youtubePlayer, searchYouTubeTracks } from "./youtube-player.js";
import { showToast } from "./components.js";

// Frequency centers for standard 10-band graphic equalizer
export const EQ_FREQUENCIES = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.htmlAudio = new Audio();
    this.htmlAudio.crossOrigin = "anonymous";
    this.sourceNode = null;
    this.preampNode = null;
    this.eqFilters = [];
    this.bassBoostFilter = null;
    this.trebleBoostFilter = null;
    this.stereoPannerNode = null;
    this.compressorNode = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.dryGain = null;
    this.masterGain = null;
    this.analyser = null;

    // Procedural Synth Synthesizer for Demo Playback
    this.synthInterval = null;
    this.synthActiveNodes = [];
    this.isSynthesized = false;

    // Dedicated HTML5 audio instance for live radio streams
    this.radioAudio = new Audio();
    this.initRadioAudioEvents();

    this.initHTMLAudioEvents();
    youtubePlayer.setOnEnded(() => this.onTrackEnded());
  }

  ensureContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.buildAudioGraph();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  buildAudioGraph() {
    const ctx = this.audioCtx;

    // 1. HTML Audio source node
    try {
      this.sourceNode = ctx.createMediaElementSource(this.htmlAudio);
    } catch (e) {
      // If already connected or synthetic
    }

    // 2. Preamp gain
    this.preampNode = ctx.createGain();
    this.preampNode.gain.value = 1.0;

    // 3. 10-band Peaking Filters
    this.eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
      const filter = ctx.createBiquadFilter();
      if (idx === 0) {
        filter.type = "lowshelf";
      } else if (idx === EQ_FREQUENCIES.length - 1) {
        filter.type = "highshelf";
      } else {
        filter.type = "peaking";
        filter.Q.value = 1.4;
      }
      filter.frequency.value = freq;
      filter.gain.value = state.eqBands[idx] || 0;
      return filter;
    });

    // 4. Bass Boost LowShelf
    this.bassBoostFilter = ctx.createBiquadFilter();
    this.bassBoostFilter.type = "lowshelf";
    this.bassBoostFilter.frequency.value = 100;
    this.bassBoostFilter.gain.value = (state.bassBoost / 100) * 12;

    // 5. Treble Boost HighShelf
    this.trebleBoostFilter = ctx.createBiquadFilter();
    this.trebleBoostFilter.type = "highshelf";
    this.trebleBoostFilter.frequency.value = 8000;
    this.trebleBoostFilter.gain.value = 0;

    // 6. Stereo Panner
    if (ctx.createStereoPanner) {
      this.stereoPannerNode = ctx.createStereoPanner();
      this.stereoPannerNode.pan.value = 0;
    }

    // 7. Dynamics Compressor (Limiter)
    this.compressorNode = ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -3;
    this.compressorNode.knee.value = 12;
    this.compressorNode.ratio.value = 10;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;

    // 8. Synthetic Reverb
    this.buildReverb(ctx);

    // 9. Master Gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = state.isMuted ? 0 : state.volume;

    // 10. Analyser Node for Visualizers
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;

    // Wire up graph
    let currentNode = this.preampNode;

    // Connect EQ filters in series
    this.eqFilters.forEach(filter => {
      currentNode.connect(filter);
      currentNode = filter;
    });

    currentNode.connect(this.bassBoostFilter);
    currentNode = this.bassBoostFilter;

    currentNode.connect(this.trebleBoostFilter);
    currentNode = this.trebleBoostFilter;

    if (this.stereoPannerNode) {
      currentNode.connect(this.stereoPannerNode);
      currentNode = this.stereoPannerNode;
    }

    // Connect to Reverb Dry/Wet split
    currentNode.connect(this.dryGain);
    currentNode.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbGain);

    this.dryGain.connect(this.compressorNode);
    this.reverbGain.connect(this.compressorNode);

    this.compressorNode.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // If sourceNode is available, hook it up to preamp
    if (this.sourceNode) {
      this.sourceNode.connect(this.preampNode);
    }
  }

  buildReverb(ctx) {
    this.reverbNode = ctx.createConvolver();
    this.dryGain = ctx.createGain();
    this.reverbGain = ctx.createGain();

    // Create algorithmic impulse response for lush hall reverb
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2.0; // 2 sec tail
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.5));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    this.reverbNode.buffer = impulse;

    const revAmount = (state.reverb || 10) / 100;
    this.reverbGain.gain.value = revAmount * 0.6;
    this.dryGain.gain.value = 1.0 - (revAmount * 0.3);
  }

  initHTMLAudioEvents() {
    this.htmlAudio.addEventListener("loadedmetadata", () => {
      if (!this.isSynthesized) {
        if (this.htmlAudio.duration && !isNaN(this.htmlAudio.duration) && isFinite(this.htmlAudio.duration)) {
          state.duration = this.htmlAudio.duration;
          if (state.currentSong) state.currentSong.duration = state.duration;
          state.notify("timeUpdate", {
            currentTime: state.currentTime,
            duration: state.duration
          });
        }
      }
    });

    this.htmlAudio.addEventListener("timeupdate", () => {
      if (!this.isSynthesized) {
        state.currentTime = this.htmlAudio.currentTime;
        if (this.htmlAudio.duration && !isNaN(this.htmlAudio.duration) && isFinite(this.htmlAudio.duration)) {
          state.duration = this.htmlAudio.duration;
        }
        state.notify("timeUpdate", {
          currentTime: state.currentTime,
          duration: state.duration
        });
        this.checkABRepeat();
      }
    });

    this.htmlAudio.addEventListener("play", () => {
      if (!this.isSynthesized && !state.isStream) {
        state.isPlaying = true;
        state.notify("playbackStateChanged", true);
      }
    });

    this.htmlAudio.addEventListener("pause", () => {
      if (!this.isSynthesized && !state.isStream && !this.htmlAudio.ended) {
        state.isPlaying = false;
        state.notify("playbackStateChanged", false);
      }
    });

    this.htmlAudio.addEventListener("ended", () => {
      this.onTrackEnded();
    });

    this.htmlAudio.addEventListener("error", (e) => {
      if (state.isStream || state.currentSong?.source === "radio") return;
      console.warn("Audio element error, checking local audio fallback", e);
    });
  }

  initRadioAudioEvents() {
    if (!this.radioAudio) return;

    this.radioAudio.addEventListener("timeupdate", () => {
      if (state.isStream || state.currentSong?.source === "radio") {
        state.currentTime = this.radioAudio.currentTime;
        state.duration = Infinity;
        state.notify("timeUpdate", {
          currentTime: state.currentTime,
          duration: Infinity
        });
      }
    });

    this.radioAudio.addEventListener("playing", () => {
      if (state.isStream || state.currentSong?.source === "radio") {
        state.isPlaying = true;
        state.notify("playbackStateChanged", true);
      }
    });

    this.radioAudio.addEventListener("pause", () => {
      if ((state.isStream || state.currentSong?.source === "radio") && !this.radioAudio.ended) {
        state.isPlaying = false;
        state.notify("playbackStateChanged", false);
      }
    });

    this.radioAudio.addEventListener("error", (e) => {
      if (state.isStream || state.currentSong?.source === "radio") {
        console.warn("Live radio stream playback warning:", e);
        // Do NOT fall back to procedural synthesizer of demo track!
      }
    });
  }

  playRadio(station) {
    if (!station) return;
    this.ensureContext();

    // 1. Terminate other playback sources
    youtubePlayer.pause();
    this.stopProceduralSynthesizer();
    this.isSynthesized = false;
    this.htmlAudio.pause();
    this.htmlAudio.src = "";

    // 2. Formulate standard song object for the live broadcast
    const radioSong = {
      id: station.id,
      title: station.name,
      artist: station.genre || "Live Internet Radio",
      album: `${station.location || "Online Broadcast"} • ${station.frequency || "Live Stream"}`,
      artwork: station.artwork,
      duration: Infinity,
      isLive: true,
      source: "radio",
      format: "LIVE BROADCAST",
      bitrate: station.bitrate || "128 kbps",
      streamUrl: station.streamUrl,
      frequency: station.frequency || "LIVE",
      genre: station.genre
    };

    state.currentSong = radioSong;
    state.isStream = true;
    state.currentStation = station;
    state.isPlaying = true;
    state.currentTime = 0;
    state.duration = Infinity;

    state.addSongToHistory(radioSong);
    state.notify("songChanged", radioSong);
    state.notify("playbackStateChanged", true);

    // 3. Play live radio audio stream
    if (!this.radioAudio) {
      this.radioAudio = new Audio();
      this.initRadioAudioEvents();
    }
    this.radioAudio.pause();
    this.radioAudio.src = station.streamUrl;
    this.radioAudio.volume = state.isMuted ? 0 : state.volume;
    this.radioAudio.load();

    const playPromise = this.radioAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        state.isPlaying = true;
        state.notify("playbackStateChanged", true);
      }).catch(err => {
        console.warn("Live radio autoplay prevented or delayed:", err);
      });
    }
  }

  play() {
    this.ensureContext();
    if (!state.currentSong) {
      if (state.queue && state.queue.length > 0) {
        state.currentSong = state.queue[state.queueIndex || 0];
      } else if (state.songs && state.songs.length > 0) {
        state.setQueue(state.songs, 0);
        state.currentSong = state.songs[0];
      }
      if (state.currentSong) {
        state.notify("songChanged", state.currentSong);
      }
    }
    state.isPlaying = true;
    state.notify("playbackStateChanged", true);

    const song = state.currentSong;
    const isYouTube = song && this.isYouTubeSong(song);
    const isRadio = state.isStream || (song && (song.source === "radio" || song.isLive));

    // If current song is not from YouTube, turn off video mode completely
    if (!isYouTube && state.isVideoMode) {
      state.setVideoMode(false);
      youtubePlayer.hideVideo();
    }

    if (state.isVideoMode && isYouTube) {
      this.isSynthesized = false;
      this.stopProceduralSynthesizer();
      this.htmlAudio.pause();
      if (this.radioAudio) this.radioAudio.pause();
      youtubePlayer.play(song, state.currentTime);
      return;
    }

    if (isYouTube) {
      // 1. YouTube Source
      this.isSynthesized = false;
      this.stopProceduralSynthesizer();
      this.htmlAudio.pause();
      if (this.radioAudio) this.radioAudio.pause();
      youtubePlayer.play(song, state.currentTime);
    } else if (isRadio) {
      // 2. Live Radio Stream
      youtubePlayer.pause();
      this.isSynthesized = false;
      this.stopProceduralSynthesizer();
      this.htmlAudio.pause();

      if (!this.radioAudio) {
        this.radioAudio = new Audio();
        this.initRadioAudioEvents();
      }
      if ((!this.radioAudio.src || this.radioAudio.src === "") && state.currentStation?.streamUrl) {
        this.radioAudio.src = state.currentStation.streamUrl;
      }
      this.radioAudio.volume = state.isMuted ? 0 : state.volume;
      this.radioAudio.play().catch(e => {
        console.warn("Radio playback error:", e);
      });
    } else if (song && (song.blobUrl || song.source === "local" || song.isCustom || (song.id && song.id.startsWith("local:")))) {
      // 3. Local Device Audio Source
      this.ensureContext();
      if (this.radioAudio) this.radioAudio.pause();
      youtubePlayer.pause();
      this.isSynthesized = false;
      this.stopProceduralSynthesizer();
      
      const startLocalAudio = (url) => {
        this.ensureContext();
        if (this.htmlAudio.src !== url) {
          if (url && (url.startsWith("blob:") || url.startsWith("data:"))) {
            this.htmlAudio.removeAttribute("crossorigin");
          } else {
            this.htmlAudio.crossOrigin = "anonymous";
          }
          this.htmlAudio.src = url;
          this.htmlAudio.load();
        }
        if (this.audioCtx && this.sourceNode) {
          this.htmlAudio.volume = state.isMuted ? 0 : 1.0;
        } else {
          this.htmlAudio.volume = state.isMuted ? 0 : state.volume;
        }
        if (state.currentTime > 0) {
          try {
            this.htmlAudio.currentTime = state.currentTime;
          } catch (e) {
            // Ignore if metadata not yet ready
          }
        }
        const p = this.htmlAudio.play();
        if (p !== undefined) {
          p.catch(async (e) => {
            console.warn("Local audio playback error, checking fresh blob", e);
            if (song.id) {
              try {
                const freshBlob = await storage.getAudioBlob(song.id);
                if (freshBlob) {
                  song.blobUrl = URL.createObjectURL(freshBlob);
                  this.htmlAudio.src = song.blobUrl;
                  this.htmlAudio.load();
                  this.htmlAudio.play().catch(err => {
                    console.warn("Blob play failed, falling back to synth", err);
                    this.startProceduralSynthesizer(song);
                  });
                  return;
                }
              } catch (err) {
                console.warn("Error fetching audio blob", err);
              }
            }
            this.startProceduralSynthesizer(song);
          });
        }
      };

      if (song.blobUrl) {
        startLocalAudio(song.blobUrl);
      } else if (song.id) {
        storage.getAudioBlob(song.id).then((blob) => {
          if (blob) {
            song.blobUrl = URL.createObjectURL(blob);
            startLocalAudio(song.blobUrl);
          } else {
            console.warn("Could not find local audio blob for song", song.id);
            this.startProceduralSynthesizer(song);
          }
        }).catch(() => {
          this.startProceduralSynthesizer(song);
        });
      }
    } else {
      // 4. Procedural Web Audio Synth for demo catalogue
      if (this.radioAudio) this.radioAudio.pause();
      youtubePlayer.pause();
      this.isSynthesized = true;
      this.startProceduralSynthesizer(state.currentSong);
    }
  }

  pause() {
    state.isPlaying = false;
    state.notify("playbackStateChanged", false);
    const song = state.currentSong;
    const isYouTube = song && (song.source === "youtube" || (song.id && song.id.startsWith("youtube:")));
    const isRadio = state.isStream || (song && (song.source === "radio" || song.isLive));

    if (isYouTube) {
      youtubePlayer.pause();
    } else if (isRadio) {
      if (this.radioAudio) this.radioAudio.pause();
    } else if (this.isSynthesized) {
      this.stopProceduralSynthesizer();
    } else {
      this.htmlAudio.pause();
    }
  }

  seek(seconds) {
    if (state.isStream || state.currentSong?.isLive || state.currentSong?.source === "radio") {
      return; // Live radio broadcast cannot be arbitrarily seeked
    }
    state.currentTime = Math.max(0, Math.min(seconds, state.duration));
    const song = state.currentSong;
    const isYouTube = song && (song.source === "youtube" || (song.id && song.id.startsWith("youtube:")));

    if (isYouTube) {
      youtubePlayer.seek(seconds);
    } else if (!this.isSynthesized && this.htmlAudio.src) {
      this.htmlAudio.currentTime = state.currentTime;
    }
    state.notify("timeUpdate", {
      currentTime: state.currentTime,
      duration: state.duration
    });
  }

  setVolume(val) {
    const vol = Math.max(0, Math.min(1, val));
    state.volume = vol;
    state.isMuted = vol === 0;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(state.isMuted ? 0 : vol, this.audioCtx.currentTime);
    }
    if (this.audioCtx && this.sourceNode) {
      this.htmlAudio.volume = state.isMuted ? 0 : 1.0;
    } else {
      this.htmlAudio.volume = state.isMuted ? 0 : vol;
    }
    if (this.radioAudio) {
      this.radioAudio.volume = state.isMuted ? 0 : vol;
    }
    youtubePlayer.setVolume(state.isMuted ? 0 : vol);
    state.notify("volumeChanged", { volume: vol, isMuted: state.isMuted });
  }

  toggleMute() {
    if (state.isMuted) {
      state.isMuted = false;
      this.setVolume(state.previousVolume || 0.8);
    } else {
      state.previousVolume = state.volume;
      state.isMuted = true;
      this.setVolume(0);
    }
  }

  setPlaybackRate(rate) {
    state.playbackRate = rate;
    this.htmlAudio.playbackRate = rate;
    state.notify("playbackRateChanged", rate);
  }

  checkABRepeat() {
    if (state.abRepeat.active && state.abRepeat.b > state.abRepeat.a) {
      if (state.currentTime >= state.abRepeat.b) {
        this.seek(state.abRepeat.a);
      }
    }
  }

  onTrackEnded() {
    if (state.repeatMode === "one") {
      this.seek(0);
      this.play();
    } else if (state.autoNext || state.repeatMode === "all") {
      this.nextTrack();
    } else {
      this.pause();
    }
  }

  nextTrack() {
    if ((state.isStream || state.currentSong?.source === "radio") && state.radioStations && state.radioStations.length > 0) {
      const curId = state.currentStation?.id || state.currentSong?.id;
      const idx = state.radioStations.findIndex(s => s.id === curId);
      const nextIdx = (idx + 1) % state.radioStations.length;
      this.playRadio(state.radioStations[nextIdx]);
      return;
    }
    if (!state.queue || state.queue.length === 0) {
      const localTracks = storage.getItem("localMusicLibrary", []) || [];
      const isLocalContext = (state.currentSong?.source === "local" || state.currentSong?.isCustom || (typeof window !== "undefined" && window.location.hash.includes("local")));
      if (isLocalContext && localTracks.length > 0) {
        state.setQueue(localTracks, 0);
      } else if (state.songs && state.songs.length > 0) {
        state.setQueue(state.songs, 0);
      } else {
        return;
      }
    }
    let curIndex = state.queueIndex;
    if (state.currentSong) {
      const found = state.queue.findIndex(s => s && s.id === state.currentSong.id);
      if (found !== -1) {
        curIndex = found;
        state.queueIndex = found;
      }
    }
    let nextIndex = curIndex + 1;
    if (state.shuffle) {
      if (state.queue.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * state.queue.length);
        } while (nextIndex === curIndex);
      } else {
        nextIndex = 0;
      }
    } else if (nextIndex >= state.queue.length) {
      if (state.repeatMode === "all") {
        nextIndex = 0;
      } else {
        this.pause();
        return;
      }
    }
    this.playTrackAtIndex(nextIndex);
  }

  prevTrack() {
    if ((state.isStream || state.currentSong?.source === "radio") && state.radioStations && state.radioStations.length > 0) {
      const curId = state.currentStation?.id || state.currentSong?.id;
      const idx = state.radioStations.findIndex(s => s.id === curId);
      const prevIdx = (idx - 1 + state.radioStations.length) % state.radioStations.length;
      this.playRadio(state.radioStations[prevIdx]);
      return;
    }
    if (state.currentTime > 3) {
      this.seek(0);
      return;
    }
    if (!state.queue || state.queue.length === 0) {
      const localTracks = storage.getItem("localMusicLibrary", []) || [];
      const isLocalContext = (state.currentSong?.source === "local" || state.currentSong?.isCustom || (typeof window !== "undefined" && window.location.hash.includes("local")));
      if (isLocalContext && localTracks.length > 0) {
        state.setQueue(localTracks, 0);
      } else if (state.songs && state.songs.length > 0) {
        state.setQueue(state.songs, 0);
      } else {
        return;
      }
    }
    let curIndex = state.queueIndex;
    if (state.currentSong) {
      const found = state.queue.findIndex(s => s && s.id === state.currentSong.id);
      if (found !== -1) {
        curIndex = found;
        state.queueIndex = found;
      }
    }
    let prevIndex = curIndex - 1;
    if (prevIndex < 0) {
      prevIndex = state.queue.length - 1;
    }
    this.playTrackAtIndex(prevIndex);
  }

  playTrackAtIndex(index) {
    if (index < 0 || index >= state.queue.length) return;
    if (this.radioAudio) {
      this.radioAudio.pause();
      this.radioAudio.src = "";
    }
    state.queueIndex = index;
    const song = state.queue[index];
    state.currentSong = song;
    state.currentTime = 0;
    state.duration = song.duration || 180;
    state.isStream = false;
    state.currentStation = null;

    state.addSongToHistory(song);
    state.incrementSongPlayCount(song.id);
    state.notify("songChanged", song);

    this.play();
  }

  // YouTube Track Verifier (Video mode is strictly restricted to YouTube API tracks)
  isYouTubeSong(song) {
    if (!song) return false;
    // Exclude local files, custom device imports, radio streams, or procedural synth
    if (song.source === "local" || song.isCustom || song.blobUrl || song.isRadio || song.source === "radio") {
      return false;
    }
    return Boolean(
      song.source === "youtube" ||
      (typeof song.id === "string" && song.id.startsWith("youtube:")) ||
      song.youtubeId
    );
  }

  // Spotify-Style Music Video Integration Engine
  async resolveSongVideoId(song) {
    if (!song || !this.isYouTubeSong(song)) return null;
    if (song.youtubeId) return song.youtubeId;
    if (song.id && typeof song.id === "string" && song.id.startsWith("youtube:")) {
      song.youtubeId = song.id.replace(/^youtube:/, "");
      return song.youtubeId;
    }
    return null;
  }

  async enableVideoMode() {
    const song = state.currentSong;
    if (!song || !this.isYouTubeSong(song)) {
      showToast("Video option only YouTube songs ke liye available hai");
      state.setVideoMode(false);
      return;
    }

    state.setVideoMode(true);

    const overlay = document.getElementById("fs-video-status-overlay");
    const statusText = document.getElementById("fs-video-status-text");
    if (overlay) overlay.style.display = "flex";
    if (statusText) statusText.textContent = "Loading Official Music Video...";

    try {
      const vidId = await this.resolveSongVideoId(song);
      if (overlay) overlay.style.display = "none";

      if (vidId) {
        if (this.radioAudio) this.radioAudio.pause();
        this.htmlAudio.pause();
        this.stopProceduralSynthesizer();

        const inFs = document.getElementById("fullscreen-player-modal")?.classList.contains("open") &&
                     document.getElementById("fs-main-body")?.classList.contains("view-video");

        await youtubePlayer.play(song, state.currentTime);
        youtubePlayer.showVideo(inFs);
        showToast("Playing Official Music Video");
      } else {
        showToast("Music video not found for this track");
        state.setVideoMode(false);
      }
    } catch (err) {
      if (overlay) overlay.style.display = "none";
      console.warn("Error starting video mode:", err);
      showToast("Unable to play video for this track");
      state.setVideoMode(false);
    }
  }

  disableVideoMode() {
    state.setVideoMode(false);
    youtubePlayer.hideVideo();

    // If current song is local or custom file or demo synth, resume native audio
    const song = state.currentSong;
    if (song && (song.source === "local" || song.isCustom || song.blobUrl || song.audioUrl || !song.youtubeId)) {
      youtubePlayer.pause();
      this.play();
      this.seek(state.currentTime);
    }
    showToast("Switched to Audio Only");
  }

  toggleVideoMode() {
    const song = state.currentSong;
    if (!this.isYouTubeSong(song)) {
      showToast("Video option only YouTube songs ke liye available hai");
      if (state.isVideoMode) this.disableVideoMode();
      return;
    }

    if (state.isVideoMode) {
      this.disableVideoMode();
    } else {
      this.enableVideoMode();
    }
  }

  // Real-time Procedural Musical Synthesizer for Demo Tracks
  startProceduralSynthesizer(song) {
    this.stopProceduralSynthesizer();
    this.ensureContext();
    const ctx = this.audioCtx;

    const synthType = (song && song.synthType) || "synthwave";
    const bpm = (song && song.bpm) || 120;
    const stepInterval = (60 / bpm) * 250; // 16th note step in ms

    // Musical Scales & Harmonies
    const SCALES = {
      synthwave: [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440], // A Minor
      lofi: [261.63, 293.66, 329.63, 392.00, 440, 523.25], // C Pentatonic Major
      ambient: [130.81, 196.00, 261.63, 329.63, 392.00, 523.25], // Ethereal Open Chords
      classical: [174.61, 220.00, 261.63, 329.63, 349.23, 440.00, 523.25], // F Lydian
      jazz: [207.65, 261.63, 311.13, 370.00, 415.30, 466.16], // Ab Dorian
      cyberpunk: [110, 116.54, 130.81, 146.83, 155.56, 164.81], // Dark Phrygian
      disco: [146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 293.66], // D Minor
      indie: [196.00, 220.00, 246.94, 293.66, 329.63, 392.00], // G Major
      folk: [164.81, 196.00, 220.00, 246.94, 293.66, 329.63], // E Minor
      electronic: [130.81, 146.83, 164.81, 196.00, 220.00, 261.63]
    };

    const currentScale = SCALES[synthType] || SCALES.synthwave;
    let step = 0;

    // Time ticker for simulated song progress
    this.synthInterval = setInterval(() => {
      if (!state.isPlaying) return;

      state.currentTime += (stepInterval / 1000);
      if (state.currentTime >= state.duration) {
        state.currentTime = 0;
        this.onTrackEnded();
        return;
      }
      state.notify("timeUpdate", {
        currentTime: state.currentTime,
        duration: state.duration
      });
      this.checkABRepeat();

      // Synthesize note events
      const now = ctx.currentTime;
      const noteFreq = currentScale[step % currentScale.length];

      // Bass note on downbeats
      if (step % 4 === 0) {
        this.playSynthesizedTone(noteFreq * 0.5, "sawtooth", 0.18, 0.45, now);
      }

      // Melody arpeggio
      if (step % 2 === 0 || synthType === "cyberpunk") {
        const octave = (step % 3 === 0) ? 2 : 1;
        this.playSynthesizedTone(noteFreq * octave, synthType === "classical" ? "triangle" : "sine", 0.12, 0.25, now);
      }

      // Snare / Hi-hat simulated rhythm
      if (step % 4 === 2) {
        this.playSynthesizedPercussion("snare", now);
      } else if (step % 2 === 1) {
        this.playSynthesizedPercussion("hihat", now);
      }

      step = (step + 1) % 32;
    }, stepInterval);
  }

  playSynthesizedTone(freq, type, gainAmount, duration, startTime) {
    if (!this.audioCtx || !this.preampNode) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainAmount, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.preampNode);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      // Ignored
    }
  }

  playSynthesizedPercussion(type, startTime) {
    if (!this.audioCtx || !this.preampNode) return;
    try {
      const noiseBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.1, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = type === "snare" ? "bandpass" : "highpass";
      filter.frequency.value = type === "snare" ? 1000 : 7000;

      const gain = this.audioCtx.createGain();
      const duration = type === "snare" ? 0.12 : 0.04;
      gain.gain.setValueAtTime(type === "snare" ? 0.08 : 0.03, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.preampNode);

      whiteNoise.start(startTime);
      whiteNoise.stop(startTime + duration);
    } catch (e) {
      // Ignored
    }
  }

  stopProceduralSynthesizer() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  // Equalizer Controls
  setEqBandGain(index, gainValue) {
    if (index >= 0 && index < this.eqFilters.length) {
      const filter = this.eqFilters[index];
      const gain = Math.max(-12, Math.min(12, gainValue));
      state.eqBands[index] = gain;
      if (this.audioCtx && filter) {
        filter.gain.setTargetAtTime(gain, this.audioCtx.currentTime, 0.05);
      }
      state.notify("eqChanged", { bands: state.eqBands, index, gain });
    }
  }

  setBassBoost(val) {
    state.bassBoost = val;
    if (this.bassBoostFilter && this.audioCtx) {
      const db = (val / 100) * 14;
      this.bassBoostFilter.gain.setTargetAtTime(db, this.audioCtx.currentTime, 0.05);
    }
    state.notify("effectsChanged", { bassBoost: val });
  }

  setReverb(val) {
    state.reverb = val;
    if (this.reverbGain && this.dryGain && this.audioCtx) {
      const revAmount = val / 100;
      this.reverbGain.gain.setTargetAtTime(revAmount * 0.6, this.audioCtx.currentTime, 0.05);
      this.dryGain.gain.setTargetAtTime(1.0 - (revAmount * 0.3), this.audioCtx.currentTime, 0.05);
    }
    state.notify("effectsChanged", { reverb: val });
  }

  setStereoPan(val) {
    if (this.stereoPannerNode && this.audioCtx) {
      const pan = Math.max(-1, Math.min(1, val));
      this.stereoPannerNode.pan.setTargetAtTime(pan, this.audioCtx.currentTime, 0.05);
    }
  }

  generateRestingFrequencyData(binCount = 64) {
    const data = new Uint8Array(binCount);
    const t = (performance && performance.now ? performance.now() / 1000 : Date.now() / 1000);
    for (let i = 0; i < binCount; i++) {
      const norm = i / Math.max(1, binCount - 1);
      // Gentle, serene harmonic ambient wave when paused
      const wave = Math.sin(t * 1.6 + norm * Math.PI * 2.8) * 0.42 +
                   Math.sin(t * 2.7 - norm * Math.PI * 3.6) * 0.26 +
                   0.68;
      const taper = 1.0 - Math.pow(norm - 0.45, 2) * 1.25;
      data[i] = Math.min(255, Math.max(16, Math.round(wave * Math.max(0.4, taper) * 58)));
    }
    return data;
  }

  generateSimulatedFrequencyData(binCount = 64) {
    const data = new Uint8Array(binCount);
    if (!state.isPlaying) return this.generateRestingFrequencyData(binCount);

    // Use continuous high-precision timestamp so animation is always silky smooth at 60 FPS
    const t = (performance && performance.now ? performance.now() / 1000 : Date.now() / 1000);
    const vol = state.isMuted ? 0 : Math.max(0.70, (state.volume ?? 0.85));
    if (vol === 0) return data;

    // Derive song-specific tempo and signature from track title if available
    let songSalt = 0;
    if (state.currentSong?.title) {
      for (let s = 0; s < state.currentSong.title.length; s++) {
        songSalt += state.currentSong.title.charCodeAt(s);
      }
    }
    const bpm = 120 + (songSalt % 24);
    const beatFreq = bpm / 60; // beats per second (~2.0 - 2.4 Hz)

    // Musical dynamics: kick transients, snare snaps, energetic bassline, vocal presence, treble sparkle
    const beatCycle = (t * beatFreq) % 1.0;
    const kick = Math.exp(-beatCycle * 7.0); // Punchy kick drum
    const snare = Math.exp(-((beatCycle + 0.5) % 1.0) * 8.0); // Snare/clap transient on 2 & 4
    const bassline = Math.sin(t * Math.PI * beatFreq * 2 + (songSalt % 7)) * 0.5 + 0.5;
    const midPulse = Math.sin(t * 5.4 + (songSalt % 5)) * 0.35 + 0.65;
    const vocalFlurry = Math.sin(t * 7.8 + Math.cos(t * 2.1)) * 0.4 + 0.6;
    const trebleShimmer = Math.sin(t * 11.2) * 0.35 + 0.65;
    const microJitter = Math.sin(t * 22.4 + (songSalt % 3)) * 0.25 + 0.75;

    // EQ and Bass Boost influences
    const bassModifier = 1 + ((state.bassBoost || 20) / 100) * 1.4 + ((state.eqBands?.[0] || 0) / 12) * 0.5;
    const midModifier = 1 + ((state.eqBands?.[4] || 0) / 12) * 0.5;
    const trebleModifier = 1 + ((state.eqBands?.[8] || 0) / 12) * 0.5;

    for (let i = 0; i < binCount; i++) {
      const norm = i / Math.max(1, binCount - 1); // 0.0 (sub-bass) to 1.0 (ultra-treble)
      let energy = 0;

      if (norm < 0.15) {
        // Deep sub-bass & punchy kick drum: prominent, heavy, rhythmic
        const taper = 1.0 - (norm / 0.15) * 0.35;
        energy = (kick * 178 + bassline * 82 + 75 + Math.sin(t * 3.6 + i * 0.5) * 24) * taper * bassModifier;
      } else if (norm < 0.35) {
        // Bass punch & lower mid rhythm: tight bass groove
        const bandRatio = (norm - 0.15) / 0.20;
        const groove = (1 - bandRatio) * kick * 125 + bandRatio * snare * 138;
        energy = (groove + bassline * 96 + 70 + Math.sin(t * 5.8 + i * 0.65) * 26) * bassModifier;
      } else if (norm < 0.65) {
        // Vocal core, guitars, keyboard & snare presence
        const curve = 1.0 - Math.abs((norm - 0.48) / 0.22) * 0.45;
        energy = (snare * 148 + vocalFlurry * 92 + midPulse * 68 + 66 + Math.sin(t * 8.2 + i * 0.8) * 28) * curve * midModifier;
      } else if (norm < 0.85) {
        // Lead synths, cymbals, upper harmonic presence
        const curve = 1.0 - Math.abs((norm - 0.75) / 0.16) * 0.4;
        energy = (trebleShimmer * 135 + microJitter * 65 + 62 + Math.sin(t * 12.6 + i * 1.1) * 28) * curve * trebleModifier;
      } else {
        // Air, high-hat sizzle, harmonic sparkle
        energy = (microJitter * 115 + trebleShimmer * 50 + 54 + Math.sin(t * 18.2 + i * 1.4) * 26) * trebleModifier;
      }

      data[i] = Math.min(255, Math.max(38, Math.round(energy * vol)));
    }
    return data;
  }

  generateSimulatedWaveformData(binCount = 64) {
    const data = new Uint8Array(binCount);
    if (!state.isPlaying) {
      data.fill(128);
      return data;
    }

    const t = (performance && performance.now ? performance.now() / 1000 : Date.now() / 1000);
    const vol = state.isMuted ? 0 : Math.max(0.65, (state.volume ?? 0.85));
    const amp = 52 * vol * (1 + ((state.bassBoost || 20) / 100) * 0.4);

    for (let i = 0; i < binCount; i++) {
      const phase = (i / binCount) * Math.PI * 4;
      const val = Math.sin(phase + t * 6.5) * 0.52 +
                  Math.sin(phase * 2.4 - t * 4.2) * 0.34 +
                  Math.sin(phase * 0.7 + t * 1.9) * 0.22;
      data[i] = Math.min(255, Math.max(0, Math.round(128 + val * amp)));
    }
    return data;
  }

  getFrequencyData() {
    const song = state.currentSong;
    const isYouTube = song && this.isYouTubeSong(song);
    const isRadio = state.isStream || (song && (song.source === "radio" || song.isLive));
    const binCount = this.analyser ? this.analyser.frequencyBinCount : 64;

    if (!state.isPlaying) {
      return this.generateRestingFrequencyData(binCount);
    }

    // YouTube and FM streams do not route raw audio through local AnalyserNode
    if (isYouTube || isRadio || !this.analyser) {
      return this.generateSimulatedFrequencyData(binCount);
    }

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);

    // Verify actual acoustic sound across non-DC bins (ignoring bins 0-1)
    let peak = 0;
    let sum = 0;
    const checkBins = Math.min(48, data.length);
    for (let i = 1; i < checkBins; i++) {
      if (data[i] > peak) peak = data[i];
      sum += data[i];
    }
    const avg = sum / Math.max(1, checkBins - 1);

    // Real audio detected: apply studio Automatic Gain Control (AGC) so bars dance vigorously!
    if (peak >= 10 || avg >= 4) {
      // If audio is quiet or recorded softly, boost dynamically so bars are tall, clear & expressive
      const targetPeak = 215;
      const gain = peak < targetPeak ? Math.min(3.6, targetPeak / Math.max(18, peak)) : 1.0;
      for (let i = 0; i < data.length; i++) {
        // Apply dynamic gain with high-frequency tilt compensation
        const tilt = 1.0 + (i / data.length) * 0.45;
        data[i] = Math.min(255, Math.max(0, Math.round(data[i] * gain * tilt)));
      }
      return data;
    }

    // Fallback for CORS-restricted local/external audio streams or silent passages
    return this.generateSimulatedFrequencyData(data.length);
  }

  getWaveformData() {
    const song = state.currentSong;
    const isYouTube = song && this.isYouTubeSong(song);
    const isRadio = state.isStream || (song && (song.source === "radio" || song.isLive));

    if (!state.isPlaying) {
      const data = new Uint8Array(this.analyser ? this.analyser.frequencyBinCount : 64);
      data.fill(128);
      return data;
    }

    if (isYouTube || isRadio || !this.analyser) {
      return this.generateSimulatedWaveformData(this.analyser ? this.analyser.frequencyBinCount : 64);
    }

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);

    let diff = 0;
    const checkBins = Math.min(32, data.length);
    for (let i = 2; i < checkBins; i++) {
      diff += Math.abs(data[i] - 128);
    }
    if (diff > 35) {
      return data;
    }

    return this.generateSimulatedWaveformData(data.length);
  }
}

export const audioEngine = new AudioEngine();
