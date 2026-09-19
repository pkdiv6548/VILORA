import { audioEngine } from "./audio-engine.js";
import { state } from "./state.js";

// Multi-Color Palette Presets designed to look ultra-luxurious on dark OLED player
const COLOR_THEMES = {
  prism: {
    name: "PRISM MULTI-COLOR",
    subtag: "PRISM SPECTRUM • 48kHz",
    // 32-bar chromatic color progression across frequency bands
    getBarGradient: (ctx, i, total, baseY, h) => {
      const ratio = i / Math.max(1, total - 1);
      const barH = Math.max(14, Number.isFinite(h) ? h : 14);
      const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
      if (ratio < 0.20) {
        // Deep sub-bass / Bass: Electric Cyan to Aquamarine & Emerald
        grad.addColorStop(0, "rgba(8, 145, 178, 0.95)");
        grad.addColorStop(0.5, "rgba(6, 182, 212, 1.0)");
        grad.addColorStop(1, "rgba(52, 211, 153, 1.0)");
      } else if (ratio < 0.42) {
        // Punchy Mid-Bass & Low-Mids: Emerald Green to Spring Mint & Neon Lime
        grad.addColorStop(0, "rgba(5, 150, 105, 0.95)");
        grad.addColorStop(0.55, "rgba(34, 197, 94, 1.0)");
        grad.addColorStop(1, "rgba(163, 230, 53, 1.0)");
      } else if (ratio < 0.65) {
        // Vocal Mids & Snare: Rich Gold to Sunlit Amber & Sunset Coral
        grad.addColorStop(0, "rgba(217, 119, 6, 0.95)");
        grad.addColorStop(0.55, "rgba(245, 158, 11, 1.0)");
        grad.addColorStop(1, "rgba(251, 146, 60, 1.0)");
      } else if (ratio < 0.84) {
        // Upper Presence & Leads: Radiant Coral to Hot Neon Rose & Vivid Pink
        grad.addColorStop(0, "rgba(234, 88, 12, 0.95)");
        grad.addColorStop(0.5, "rgba(244, 63, 94, 1.0)");
        grad.addColorStop(1, "rgba(236, 72, 153, 1.0)");
      } else {
        // Highs, Air & Sparkle: Electric Magenta to Neon Violet & Ultraviolet
        grad.addColorStop(0, "rgba(217, 70, 239, 0.95)");
        grad.addColorStop(0.55, "rgba(168, 85, 247, 1.0)");
        grad.addColorStop(1, "rgba(129, 140, 248, 1.0)");
      }
      return grad;
    },
    getPeakColor: (i, total) => {
      const ratio = i / Math.max(1, total - 1);
      if (ratio < 0.20) return "#67e8f9";      // Cyan
      if (ratio < 0.42) return "#a3e635";      // Lime
      if (ratio < 0.65) return "#fde047";      // Gold
      if (ratio < 0.84) return "#fb7185";      // Coral Rose
      return "#e879f9";                        // Orchid Magenta
    },
    waveStroke: ["#06b6d4", "#22c55e", "#f59e0b", "#ec4899", "#a855f7"],
    auroraFills: [
      { top: "rgba(168, 85, 247, 0.52)", bot: "rgba(99, 102, 241, 0.05)", stroke: "#c084fc" },
      { top: "rgba(6, 182, 212, 0.48)", bot: "rgba(16, 185, 129, 0.05)", stroke: "#38bdf8" },
      { top: "rgba(245, 158, 11, 0.55)", bot: "rgba(236, 72, 153, 0.06)", stroke: "#fbbf24" }
    ]
  },
  cyber: {
    name: "CYBER NEON",
    subtag: "CYBER CYAN • HI-RES",
    getBarGradient: (ctx, i, total, baseY, h) => {
      const ratio = i / Math.max(1, total - 1);
      const barH = Math.max(14, Number.isFinite(h) ? h : 14);
      const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
      if (ratio < 0.5) {
        grad.addColorStop(0, "rgba(30, 64, 175, 0.95)");
        grad.addColorStop(0.5, "rgba(6, 182, 212, 1.0)");
        grad.addColorStop(1, "rgba(165, 243, 252, 1.0)");
      } else {
        grad.addColorStop(0, "rgba(124, 58, 237, 0.95)");
        grad.addColorStop(0.6, "rgba(168, 85, 247, 1.0)");
        grad.addColorStop(1, "rgba(244, 114, 182, 1.0)");
      }
      return grad;
    },
    getPeakColor: (i, total) => {
      return (i / Math.max(1, total - 1) < 0.5) ? "#a5f3fc" : "#fbcfe8";
    },
    waveStroke: ["#3b82f6", "#06b6d4", "#a855f7", "#ec4899"],
    auroraFills: [
      { top: "rgba(147, 51, 234, 0.48)", bot: "rgba(59, 130, 246, 0.05)", stroke: "#c084fc" },
      { top: "rgba(6, 182, 212, 0.50)", bot: "rgba(14, 116, 144, 0.05)", stroke: "#67e8f9" },
      { top: "rgba(236, 72, 153, 0.52)", bot: "rgba(168, 85, 247, 0.06)", stroke: "#f472b6" }
    ]
  },
  sunset: {
    name: "SUNSET AURORA",
    subtag: "SUNSET GOLD • 48kHz",
    getBarGradient: (ctx, i, total, baseY, h) => {
      const ratio = i / Math.max(1, total - 1);
      const barH = Math.max(14, Number.isFinite(h) ? h : 14);
      const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
      if (ratio < 0.4) {
        grad.addColorStop(0, "rgba(180, 83, 9, 0.95)");
        grad.addColorStop(0.6, "rgba(245, 158, 11, 1.0)");
        grad.addColorStop(1, "rgba(253, 224, 71, 1.0)");
      } else {
        grad.addColorStop(0, "rgba(190, 24, 93, 0.95)");
        grad.addColorStop(0.55, "rgba(244, 63, 94, 1.0)");
        grad.addColorStop(1, "rgba(251, 146, 60, 1.0)");
      }
      return grad;
    },
    getPeakColor: (i, total) => {
      return (i / Math.max(1, total - 1) < 0.4) ? "#fef08a" : "#fda4af";
    },
    waveStroke: ["#eab308", "#f97316", "#ef4444", "#ec4899"],
    auroraFills: [
      { top: "rgba(239, 68, 68, 0.48)", bot: "rgba(245, 158, 11, 0.05)", stroke: "#f87171" },
      { top: "rgba(245, 158, 11, 0.50)", bot: "rgba(251, 146, 60, 0.05)", stroke: "#fde047" },
      { top: "rgba(236, 72, 153, 0.50)", bot: "rgba(190, 24, 93, 0.06)", stroke: "#fb7185" }
    ]
  },
  emerald: {
    name: "EMERALD LUXE",
    subtag: "EMERALD HI-FI • 48kHz",
    getBarGradient: (ctx, i, total, baseY, h) => {
      const barH = Math.max(14, Number.isFinite(h) ? h : 14);
      const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
      grad.addColorStop(0, "rgba(4, 120, 87, 0.95)");
      grad.addColorStop(0.5, "rgba(16, 185, 129, 1.0)");
      grad.addColorStop(0.85, "rgba(52, 211, 153, 1.0)");
      grad.addColorStop(1, "rgba(167, 243, 208, 1.0)");
      return grad;
    },
    getPeakColor: () => "#dcfce7",
    waveStroke: ["#059669", "#10b981", "#34d399", "#6ee7b7"],
    auroraFills: [
      { top: "rgba(5, 150, 105, 0.48)", bot: "rgba(6, 78, 59, 0.05)", stroke: "#34d399" },
      { top: "rgba(16, 185, 129, 0.50)", bot: "rgba(4, 120, 87, 0.05)", stroke: "#6ee7b7" },
      { top: "rgba(52, 211, 153, 0.52)", bot: "rgba(16, 185, 129, 0.06)", stroke: "#a7f3d0" }
    ]
  }
};

// Safe rounded-top bar drawing function that uses roundRect or quadratic curves without throwing
function drawRoundedTopBar(ctx, x, y, width, height, radius) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, [r, r, 0, 0]);
  } else if (r === 0) {
    ctx.rect(x, y, width, height);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
  ctx.closePath();
}

export class LiveAudioVisualizer {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.canvasWrap = null;
    this.subtagEl = null;
    this.animId = null;
    this.mode = "bars"; // 'bars' | 'wave' | 'spectrum'
    this.theme = "prism"; // 'prism' | 'cyber' | 'sunset' | 'emerald'
    this.isRunning = false;
    this.resizeObserver = null;

    // 32 Frequency bands with responsive smoothing and gravity decay physics
    this.barCount = 32;
    this.smoothedBars = new Float32Array(this.barCount);
    this.peaks = new Float32Array(this.barCount);
    this.peakVels = new Float32Array(this.barCount);

    // Floating starlight particles
    this.particles = [];
    this.initParticles();
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 36; i++) {
      this.particles.push({
        x: Math.random() * 380,
        y: Math.random() * 200,
        radius: Math.random() * 2.2 + 0.8,
        speedX: (Math.random() - 0.5) * 0.7,
        speedY: -Math.random() * 0.9 - 0.25,
        alpha: Math.random() * 0.7 + 0.2,
        hue: Math.random() * 360
      });
    }
  }

  init(panelEl) {
    if (!panelEl) return;
    this.container = panelEl;
    this.canvas = panelEl.querySelector("#fs-live-vis-canvas");
    this.canvasWrap = panelEl.querySelector(".fs-live-vis-canvas-wrap");
    this.subtagEl = panelEl.querySelector("#fs-live-vis-subtag");

    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d", { alpha: true });

    // Bind Mode Selection Chips
    const modeBtns = panelEl.querySelectorAll(".fs-vis-mode-pill");
    modeBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetMode = btn.dataset.visMode;
        if (targetMode) this.setMode(targetMode);
      });
    });

    // Bind Color Theme Selection Dots
    const themeDots = panelEl.querySelectorAll(".fs-vis-theme-dot");
    themeDots.forEach((dot) => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetTheme = dot.dataset.visTheme;
        if (targetTheme) this.setTheme(targetTheme);
      });
    });

    // Observe size changes
    if (window.ResizeObserver && this.canvasWrap) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this.resizeObserver.observe(this.canvasWrap);
    } else {
      window.addEventListener("resize", () => this.resize());
    }

    this.resize();
  }

  resize() {
    if (!this.canvas || !this.canvasWrap) return;
    const rect = this.canvasWrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (this.container) {
      const modeBtns = this.container.querySelectorAll(".fs-vis-mode-pill");
      modeBtns.forEach((b) => {
        b.classList.toggle("active", b.dataset.visMode === mode);
      });
    }
  }

  setTheme(themeName) {
    if (!COLOR_THEMES[themeName]) return;
    this.theme = themeName;
    if (this.container) {
      const themeDots = this.container.querySelectorAll(".fs-vis-theme-dot");
      themeDots.forEach((d) => {
        d.classList.toggle("active", d.dataset.visTheme === themeName);
      });
    }
    if (this.subtagEl) {
      this.subtagEl.textContent = COLOR_THEMES[themeName].subtag;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.resize();

    const loop = () => {
      if (!this.isRunning) return;
      try {
        this.render();
      } catch (err) {
        console.warn("Visualizer frame render error:", err);
      }
      this.animId = requestAnimationFrame(loop);
    };

    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  render() {
    if (!this.canvas || !this.ctx || !this.width || !this.height) {
      this.resize();
      if (!this.width || !this.height) return;
    }

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const isPlaying = !!state.isPlaying;
    const freqData = audioEngine.getFrequencyData();
    const waveData = audioEngine.getWaveformData();
    const themeConfig = COLOR_THEMES[this.theme] || COLOR_THEMES.prism;

    switch (this.mode) {
      case "wave":
        this.renderWave(ctx, w, h, waveData, isPlaying, themeConfig);
        break;
      case "spectrum":
        this.renderSpectrum(ctx, w, h, freqData, isPlaying, themeConfig);
        break;
      case "bars":
      default:
        this.renderBars(ctx, w, h, freqData, isPlaying, themeConfig);
        break;
    }
  }

  renderBars(ctx, width, height, freqData, isPlaying, theme) {
    const barCount = this.barCount;
    const sidePadding = 10;
    const availableWidth = width - sidePadding * 2;
    const gap = Math.max(2.5, Math.floor(availableWidth / (barCount * 4.2)));
    const barWidth = Math.max(3.5, (availableWidth - (barCount - 1) * gap) / barCount);
    const maxHeight = height * 0.78;
    const baseY = height - 12;

    // Draw baseline guideline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sidePadding, baseY);
    ctx.lineTo(width - sidePadding, baseY);
    ctx.stroke();

    const hasData = freqData && freqData.length > 0;
    const dataLen = hasData ? freqData.length : 64;
    const t = performance.now() * 0.0025;

    // Adaptive AGC Peak tracker
    let currentMax = 0;
    if (hasData) {
      for (let k = 0; k < Math.min(64, dataLen); k++) {
        if (freqData[k] > currentMax) currentMax = freqData[k];
      }
    }
    const targetPeak = Math.max(45, currentMax);
    this.agcPeak = Math.max(targetPeak, (this.agcPeak || 160) * 0.985);

    for (let i = 0; i < barCount; i++) {
      let energy = 0;
      const ratio = i / Math.max(1, barCount - 1);

      if (isPlaying && hasData) {
        // High-fidelity logarithmic frequency bin mapping
        const logIndex = Math.pow(ratio, 1.25) * (dataLen * 0.75);
        const idx = Math.min(dataLen - 1, Math.max(0, Math.floor(logIndex)));
        const nextIdx = Math.min(dataLen - 1, idx + 1);
        const fraction = logIndex - idx;
        const rawBin = ((freqData[idx] || 0) * (1 - fraction) + (freqData[nextIdx] || 0) * fraction);
        
        // Perceptual dynamic normalization & frequency tilt
        const norm = Math.min(1.0, rawBin / Math.max(40, this.agcPeak));
        const tilt = 0.92 + Math.pow(ratio, 0.85) * 1.35;
        energy = Math.min(1.0, Math.pow(norm, 0.68) * tilt);
      } else {
        // Serene ambient harmonic wave when paused
        const restWave = Math.sin(t * 1.5 + ratio * Math.PI * 2.6) * 0.35 +
                         Math.sin(t * 2.8 - ratio * Math.PI * 3.4) * 0.22 +
                         0.52;
        const taper = 1.0 - Math.pow(ratio - 0.5, 2) * 1.1;
        energy = Math.max(0.12, restWave * Math.max(0.35, taper) * 0.42);
      }

      if (!Number.isFinite(energy)) energy = 0.15;
      const minH = isPlaying ? 10 : 8;
      const targetHeight = Math.min(maxHeight, Math.max(minH, energy * maxHeight));

      // Snappy attack, smooth elastic decay
      const prevH = Number.isFinite(this.smoothedBars[i]) ? this.smoothedBars[i] : minH;
      const lerpRate = targetHeight > prevH ? 0.52 : 0.16;
      this.smoothedBars[i] = prevH + (targetHeight - prevH) * lerpRate;

      const currentH = Math.max(minH, Math.min(maxHeight, this.smoothedBars[i]));
      const x = sidePadding + i * (barWidth + gap);
      const y = baseY - currentH;

      // Peak Hold with smooth gravity
      if (!Number.isFinite(this.peaks[i])) this.peaks[i] = currentH;
      if (!Number.isFinite(this.peakVels[i])) this.peakVels[i] = 0;

      if (currentH >= this.peaks[i]) {
        this.peaks[i] = currentH;
        this.peakVels[i] = 0;
      } else {
        this.peakVels[i] += 0.42;
        this.peaks[i] = Math.max(currentH, this.peaks[i] - this.peakVels[i]);
      }

      // 1. Sleek Glass Floor Reflection (below baseline)
      if (currentH > 6) {
        const reflH = Math.min(24, currentH * 0.28);
        const reflGrad = ctx.createLinearGradient(0, baseY, 0, baseY + reflH);
        reflGrad.addColorStop(0, "rgba(255, 255, 255, 0.22)");
        reflGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
        ctx.fillStyle = reflGrad;
        ctx.fillRect(x, baseY + 1, barWidth, reflH);
      }

      // 2. Bar Body with Multi-Color Gradient
      const barGrad = theme.getBarGradient(ctx, i, barCount, baseY, currentH);
      ctx.fillStyle = barGrad;
      ctx.shadowColor = theme.getPeakColor(i, barCount);
      ctx.shadowBlur = isPlaying ? 7 : 2;

      drawRoundedTopBar(ctx, x, y, barWidth, currentH, 3.5);
      ctx.fill();

      // 3. Floating Peak Cap (glowing line with distinct color)
      if (this.peaks[i] > 6) {
        const peakY = baseY - this.peaks[i] - 3;
        ctx.fillStyle = theme.getPeakColor(i, barCount);
        ctx.shadowColor = theme.getPeakColor(i, barCount);
        ctx.shadowBlur = 8;
        ctx.fillRect(x, Math.max(3, peakY), barWidth, 2.2);
      }
    }

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  renderWave(ctx, width, height, waveData, isPlaying, theme) {
    const centerY = height / 2;
    const len = waveData && waveData.length > 0 ? waveData.length : 128;
    const step = width / (len - 1);
    const maxAmp = height * 0.42;

    // Ambient Center Axis Guide
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Multi-color horizontal linear gradient across the oscilloscope
    const waveGrad = ctx.createLinearGradient(0, 0, width, 0);
    const colors = theme.waveStroke;
    colors.forEach((color, idx) => {
      waveGrad.addColorStop(idx / (colors.length - 1), color);
    });

    ctx.beginPath();
    let firstX = 0;
    let firstY = centerY;

    for (let i = 0; i < len; i++) {
      let val = 0;
      if (isPlaying && waveData) {
        val = ((waveData[i] || 128) - 128) / 128;
        // AGC normalization for dramatic, responsive wave curves
        val = Math.max(-1.0, Math.min(1.0, val * 1.35));
      } else {
        const t = performance.now() * 0.0018;
        val = Math.sin(t * 1.6 + (i / len) * Math.PI * 2) * 0.12;
      }

      const x = i * step;
      const y = centerY + val * maxAmp;

      if (i === 0) {
        firstX = x;
        firstY = y;
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * step;
        const prevRaw = isPlaying && waveData ? ((waveData[i - 1] || 128) - 128) / 128 : 0;
        const prevVal = Math.max(-1.0, Math.min(1.0, prevRaw * 1.35));
        const prevY = centerY + prevVal * maxAmp;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    // Outer Ambient Glow
    ctx.lineWidth = 4.0;
    ctx.strokeStyle = waveGrad;
    ctx.shadowColor = colors[1] || "#06b6d4";
    ctx.shadowBlur = 14;
    ctx.stroke();

    // Inner Crisp High-Definition Line
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#ffffff";
    ctx.shadowBlur = 4;
    ctx.stroke();

    // Soft audio-reactive ambient fill below wave
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, centerY, 0, height);
    fillGrad.addColorStop(0, "rgba(6, 182, 212, 0.18)");
    fillGrad.addColorStop(1, "rgba(6, 182, 212, 0.0)");
    ctx.fillStyle = fillGrad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  renderSpectrum(ctx, width, height, freqData, isPlaying, theme) {
    const points = 44;
    const step = width / (points - 1);
    const maxHeight = height * 0.76;
    const baseY = height - 12;
    const hasData = freqData && freqData.length > 0;
    const dataLen = hasData ? freqData.length : 64;

    // Render floating starlight sparks in the background
    this.updateAndRenderParticles(ctx, width, height, isPlaying);

    const ribbons = theme.auroraFills || COLOR_THEMES.prism.auroraFills;
    const time = performance.now() * 0.002;

    // Multi-Layer Aurora Waves (layered depth & glowing fills)
    ribbons.forEach((ribbon, layerIdx) => {
      ctx.beginPath();
      ctx.moveTo(0, baseY);

      const coords = [];
      for (let i = 0; i < points; i++) {
        let energy = 0;
        if (isPlaying && hasData) {
          const offset = layerIdx * 2;
          const logIndex = Math.pow(i / (points - 1), 1.30) * (dataLen * 0.68) + offset;
          const idx = Math.min(dataLen - 1, Math.max(0, Math.floor(logIndex)));
          const norm = Math.min(1.0, ((freqData[idx] || 0) / Math.max(40, this.agcPeak || 160)));
          energy = Math.min(1.0, Math.pow(norm, 0.70) * (1.25 - layerIdx * 0.12));
        } else {
          energy = 0.08 + Math.sin(time + i * 0.3 + layerIdx * 1.2) * 0.04;
        }

        const x = i * step;
        const phaseMod = Math.sin(time * 2 + i * 0.4 + layerIdx) * 4;
        const y = baseY - Math.max(4, energy * maxHeight + phaseMod);
        coords.push({ x, y });
      }

      ctx.lineTo(coords[0].x, coords[0].y);
      for (let i = 0; i < coords.length - 1; i++) {
        const curr = coords[i];
        const next = coords[i + 1];
        const mx = (curr.x + next.x) / 2;
        const my = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
      }
      const last = coords[coords.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.lineTo(width, baseY);
      ctx.closePath();

      // Ribbon Glow Fill
      const fillGrad = ctx.createLinearGradient(0, baseY - maxHeight, 0, baseY);
      fillGrad.addColorStop(0, ribbon.top);
      fillGrad.addColorStop(1, ribbon.bot);
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Ribbon Crest Stroke
      ctx.lineWidth = 2.0 - layerIdx * 0.4;
      ctx.strokeStyle = ribbon.stroke;
      ctx.shadowColor = ribbon.stroke;
      ctx.shadowBlur = 10 - layerIdx * 2;
      ctx.stroke();
    });

    // Baseline
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(width, baseY);
    ctx.stroke();
  }

  updateAndRenderParticles(ctx, width, height, isPlaying) {
    for (const p of this.particles) {
      if (isPlaying) {
        p.x += p.speedX;
        p.y += p.speedY;
      } else {
        p.y += p.speedY * 0.25;
      }

      if (p.y < 0) {
        p.y = height;
        p.x = Math.random() * width;
      }
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.alpha * (isPlaying ? 0.75 : 0.35)})`;
      ctx.shadowColor = `hsla(${p.hue}, 90%, 65%, 0.8)`;
      ctx.shadowBlur = 5;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  destroy() {
    this.stop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}

export const liveVisualizer = new LiveAudioVisualizer();
