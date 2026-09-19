import { state } from "./state.js";
import { audioEngine } from "./audio-engine.js";
import { openModal, closeModal, showToast } from "./components.js";

export function initKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    // Ignore if typing in input or textarea
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      return;
    }

    switch (e.code) {
      case "Space":
        e.preventDefault();
        if (state.isPlaying) audioEngine.pause();
        else audioEngine.play();
        break;

      case "ArrowRight":
        e.preventDefault();
        if (e.shiftKey) {
          audioEngine.nextTrack();
        } else {
          audioEngine.seek(Math.min(state.currentTime + 5, state.duration));
        }
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (e.shiftKey) {
          audioEngine.prevTrack();
        } else {
          audioEngine.seek(Math.max(state.currentTime - 5, 0));
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        audioEngine.setVolume(Math.min(1, state.volume + 0.05));
        break;

      case "ArrowDown":
        e.preventDefault();
        audioEngine.setVolume(Math.max(0, state.volume - 0.05));
        break;

      case "KeyM":
        audioEngine.toggleMute();
        break;

      case "KeyS":
        state.shuffle = !state.shuffle;
        showToast(state.shuffle ? "Shuffle turned ON" : "Shuffle turned OFF");
        break;

      case "KeyR":
        state.repeatMode = state.repeatMode === "off" ? "all" : (state.repeatMode === "all" ? "one" : "off");
        showToast(`Repeat mode: ${state.repeatMode.toUpperCase()}`);
        break;

      case "KeyL":
        window.location.hash = "#/lyrics";
        break;

      case "KeyE":
        window.location.hash = "#/equalizer";
        break;

      case "KeyV":
        window.location.hash = "#/visualizer";
        break;

      case "KeyF":
        document.getElementById("player-expand-btn")?.click();
        break;

      case "Slash":
        e.preventDefault();
        window.location.hash = "#/search";
        setTimeout(() => document.getElementById("main-search-input")?.focus(), 100);
        break;

      case "Question":
      case "Slash":
        if (e.shiftKey) {
          e.preventDefault();
          showShortcutsModal();
        }
        break;
    }
  });
}

export function showShortcutsModal() {
  openModal("Keyboard Shortcuts", `
    <div class="shortcuts-container">
      <div class="shortcuts-grid">
        <!-- Playback Group -->
        <div class="shortcuts-group">
          <div class="shortcuts-group-title">Playback Controls</div>
          
          <div class="shortcut-row">
            <span class="shortcut-label">Play / Pause</span>
            <div class="shortcut-keys"><kbd class="shortcut-kbd">Space</kbd></div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Next Track</span>
            <div class="shortcut-keys">
              <kbd class="shortcut-kbd">Shift</kbd>
              <span class="shortcut-plus">+</span>
              <kbd class="shortcut-kbd">→</kbd>
            </div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Previous Track</span>
            <div class="shortcut-keys">
              <kbd class="shortcut-kbd">Shift</kbd>
              <span class="shortcut-plus">+</span>
              <kbd class="shortcut-kbd">←</kbd>
            </div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Seek ±5 seconds</span>
            <div class="shortcut-keys">
              <kbd class="shortcut-kbd">←</kbd>
              <span class="shortcut-plus">/</span>
              <kbd class="shortcut-kbd">→</kbd>
            </div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Toggle Shuffle</span>
            <div class="shortcut-keys"><kbd class="shortcut-kbd">S</kbd></div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Cycle Repeat</span>
            <div class="shortcut-keys"><kbd class="shortcut-kbd">R</kbd></div>
          </div>
        </div>

        <!-- Audio & Navigation Group -->
        <div class="shortcuts-group">
          <div class="shortcuts-group-title">Audio & Views</div>

          <div class="shortcut-row">
            <span class="shortcut-label">Volume Up / Down</span>
            <div class="shortcut-keys">
              <kbd class="shortcut-kbd">↑</kbd>
              <span class="shortcut-plus">/</span>
              <kbd class="shortcut-kbd">↓</kbd>
            </div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Mute / Unmute</span>
            <div class="shortcut-keys"><kbd class="shortcut-kbd">M</kbd></div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Fullscreen Player</span>
            <div class="shortcut-keys"><kbd class="shortcut-kbd">F</kbd></div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Focus Search</span>
            <div class="shortcut-keys"><kbd class="shortcut-kbd">/</kbd></div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Go to Lyrics</span>
            <div class="shortcut-keys"><kbd class="shortcut-kbd">L</kbd></div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Go to Equalizer</span>
            <div class="shortcut-keys"><kbd class="shortcut-kbd">E</kbd></div>
          </div>

          <div class="shortcut-row">
            <span class="shortcut-label">Go to Visualizer</span>
            <div class="shortcut-keys"><kbd class="shortcut-kbd">V</kbd></div>
          </div>
        </div>
      </div>
    </div>
  `, `
    <button class="btn-primary" id="close-shortcuts-btn" style="min-width:96px;height:38px;padding:0 20px;font-size:0.86rem;font-weight:600;">Got it</button>
  `, "shortcuts-modal");

  document.getElementById("close-shortcuts-btn")?.addEventListener("click", closeModal);
}
