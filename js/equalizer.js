import { state } from "./state.js";
import { audioEngine, EQ_FREQUENCIES } from "./audio-engine.js";
import { storage } from "./storage.js";

export const EQ_PRESETS = {
  "Flat": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [7, 6, 5, 2, 0, 0, 0, 0, 1, 2],
  "Vocal Boost": [-2, -2, -1, 1, 4, 5, 4, 2, 0, -1],
  "Electronic": [5, 4, 2, 0, -2, 2, 1, 3, 5, 6],
  "Acoustic": [3, 2, 1, 1, 2, 2, 3, 3, 3, 2],
  "Classical": [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  "Modern Jazz": [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  "Cyberpunk": [8, 6, 4, -1, -3, 1, 4, 6, 7, 8],
  "Lofi Chill": [4, 3, 2, 1, 0, -2, -3, -4, -3, -2],
  "Treble Boost": [-2, -2, -1, 0, 1, 2, 4, 6, 8, 9]
};

export class EqualizerManager {
  constructor() {
    this.customPresets = storage.getItem("customEqPresets", {});
  }

  applyPreset(presetName) {
    let bands = EQ_PRESETS[presetName] || this.customPresets[presetName];
    if (!bands) return;

    state.eqPreset = presetName;
    bands.forEach((gain, idx) => {
      audioEngine.setEqBandGain(idx, gain);
    });
    storage.setItem("eqPreset", presetName);
    storage.setItem("eqBands", state.eqBands);
    state.notify("eqPresetApplied", { preset: presetName, bands });
  }

  saveCustomPreset(name) {
    if (!name) return false;
    this.customPresets[name] = [...state.eqBands];
    storage.setItem("customEqPresets", this.customPresets);
    state.eqPreset = name;
    storage.setItem("eqPreset", name);
    state.notify("eqCustomPresetSaved", { name, bands: state.eqBands });
    return true;
  }

  deleteCustomPreset(name) {
    if (this.customPresets[name]) {
      delete this.customPresets[name];
      storage.setItem("customEqPresets", this.customPresets);
      this.applyPreset("Flat");
      return true;
    }
    return false;
  }

  resetEq() {
    this.applyPreset("Flat");
    audioEngine.setBassBoost(0);
    audioEngine.setReverb(0);
  }
}

export const equalizerManager = new EqualizerManager();
