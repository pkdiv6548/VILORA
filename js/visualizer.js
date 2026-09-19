import { audioEngine } from "./audio-engine.js";
import { state } from "./state.js";

function drawRoundedTopBar(ctx, x, y, width, height, radius = 4) {
  if (height <= 0 || width <= 0) return;
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    try {
      ctx.roundRect(x, y, width, height, [r, r, 0, 0]);
      return;
    } catch (e) {}
  }
  ctx.moveTo(x, y + height);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height);
  ctx.closePath();
}

export class VisualizerEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animId = null;
    this.mode = state.visualizerMode || "bars"; // bars, spectrum, wave, circular, particles
    this.particles = [];
    this.barCount = 52;
    this.smoothedBars = new Float32Array(this.barCount);
    this.peaks = new Float32Array(this.barCount);
    this.peakVels = new Float32Array(this.barCount);
    this.agcPeak = 160;
    this.initParticles();
  }

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.start();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(10, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(10, Math.floor(rect.height * dpr));
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * 400,
        y: Math.random() * 300,
        size: Math.random() * 4 + 2,
        speedX: (Math.random() - 0.5) * 1.5,
        speedY: (Math.random() - 0.5) * 1.5,
        color: `hsl(${(i * 15) % 360}, 85%, 65%)`
      });
    }
  }

  setMode(mode) {
    this.mode = mode;
    state.visualizerMode = mode;
  }

  start() {
    if (this.animId) cancelAnimationFrame(this.animId);
    const loop = () => {
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  render() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);

    const freqData = audioEngine.getFrequencyData();
    const waveData = audioEngine.getWaveformData();

    switch (this.mode) {
      case "bars":
        this.renderBars(ctx, width, height, freqData);
        break;
      case "spectrum":
        this.renderSpectrum(ctx, width, height, freqData);
        break;
      case "wave":
        this.renderWave(ctx, width, height, waveData);
        break;
      case "circular":
        this.renderCircular(ctx, width, height, freqData);
        break;
      case "particles":
        this.renderParticles(ctx, width, height, freqData);
        break;
      default:
        this.renderBars(ctx, width, height, freqData);
    }
  }

  renderBars(ctx, width, height, data) {
    const barCount = this.barCount;
    const sidePadding = 12;
    const availW = width - sidePadding * 2;
    const gap = Math.max(2, Math.floor(availW / (barCount * 4)));
    const barWidth = Math.max(3, (availW - (barCount - 1) * gap) / barCount);
    const maxHeight = height * 0.78;
    const baseY = height - 16;

    // Baseline guide
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sidePadding, baseY);
    ctx.lineTo(width - sidePadding, baseY);
    ctx.stroke();

    const isPlaying = state.isPlaying;
    const hasData = data && data.length > 0;
    const dataLen = hasData ? data.length : 64;
    const t = performance.now() * 0.0025;

    // AGC tracker
    let maxVal = 0;
    if (hasData) {
      for (let k = 0; k < Math.min(64, dataLen); k++) {
        if (data[k] > maxVal) maxVal = data[k];
      }
    }
    const targetPeak = Math.max(45, maxVal);
    this.agcPeak = Math.max(targetPeak, this.agcPeak * 0.985);

    for (let i = 0; i < barCount; i++) {
      let energy = 0;
      const ratio = i / Math.max(1, barCount - 1);

      if (isPlaying && hasData) {
        const logIdx = Math.pow(ratio, 1.25) * (dataLen * 0.75);
        const idx = Math.min(dataLen - 1, Math.max(0, Math.floor(logIdx)));
        const nextIdx = Math.min(dataLen - 1, idx + 1);
        const frac = logIdx - idx;
        const rawBin = ((data[idx] || 0) * (1 - frac) + (data[nextIdx] || 0) * frac);
        const norm = Math.min(1.0, rawBin / Math.max(40, this.agcPeak));
        const tilt = 0.92 + Math.pow(ratio, 0.85) * 1.35;
        energy = Math.min(1.0, Math.pow(norm, 0.68) * tilt);
      } else {
        const restWave = Math.sin(t * 1.5 + ratio * Math.PI * 2.6) * 0.35 +
                         Math.sin(t * 2.8 - ratio * Math.PI * 3.4) * 0.22 + 0.52;
        const taper = 1.0 - Math.pow(ratio - 0.5, 2) * 1.1;
        energy = Math.max(0.12, restWave * Math.max(0.35, taper) * 0.42);
      }

      if (!Number.isFinite(energy)) energy = 0.15;
      const minH = isPlaying ? 10 : 8;
      const targetHeight = Math.min(maxHeight, Math.max(minH, energy * maxHeight));

      const prevH = Number.isFinite(this.smoothedBars[i]) ? this.smoothedBars[i] : minH;
      const lerp = targetHeight > prevH ? 0.52 : 0.16;
      this.smoothedBars[i] = prevH + (targetHeight - prevH) * lerp;

      const currentH = Math.max(minH, Math.min(maxHeight, this.smoothedBars[i]));
      const x = sidePadding + i * (barWidth + gap);
      const y = baseY - currentH;

      // Peak Physics
      if (!Number.isFinite(this.peaks[i])) this.peaks[i] = currentH;
      if (!Number.isFinite(this.peakVels[i])) this.peakVels[i] = 0;

      if (currentH >= this.peaks[i]) {
        this.peaks[i] = currentH;
        this.peakVels[i] = 0;
      } else {
        this.peakVels[i] += 0.42;
        this.peaks[i] = Math.max(currentH, this.peaks[i] - this.peakVels[i]);
      }

      // Glass floor reflection
      if (currentH > 6) {
        const reflH = Math.min(24, currentH * 0.28);
        const reflGrad = ctx.createLinearGradient(0, baseY, 0, baseY + reflH);
        reflGrad.addColorStop(0, "rgba(255, 255, 255, 0.22)");
        reflGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
        ctx.fillStyle = reflGrad;
        ctx.fillRect(x, baseY + 1, barWidth, reflH);
      }

      // Multi-Color Prism Gradient per Bar
      const hue1 = 280 + ratio * 160; // Violet to Cyan to Emerald
      const hue2 = 180 + ratio * 140;
      const grad = ctx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, `hsl(${hue1 % 360}, 95%, 66%)`);
      grad.addColorStop(0.55, `hsl(${hue2 % 360}, 90%, 58%)`);
      grad.addColorStop(1, `hsla(${(hue2 + 40) % 360}, 90%, 45%, 0.85)`);

      ctx.fillStyle = grad;
      ctx.shadowColor = `hsl(${hue1 % 360}, 95%, 65%)`;
      ctx.shadowBlur = isPlaying ? 7 : 2;

      drawRoundedTopBar(ctx, x, y, barWidth, currentH, 3.5);
      ctx.fill();

      // Floating Peak Cap
      if (this.peaks[i] > 6) {
        const peakY = baseY - this.peaks[i] - 3;
        ctx.fillStyle = `hsl(${hue1 % 360}, 100%, 75%)`;
        ctx.shadowColor = `hsl(${hue1 % 360}, 100%, 75%)`;
        ctx.shadowBlur = 8;
        ctx.fillRect(x, Math.max(3, peakY), barWidth, 2.2);
      }
    }
    ctx.shadowBlur = 0;
  }

  renderSpectrum(ctx, width, height, data) {
    const count = 64;
    const step = width / (count - 1);
    const maxHeight = height * 0.76;
    const baseY = height - 16;
    const hasData = data && data.length > 0;
    const dataLen = hasData ? data.length : 64;
    const isPlaying = state.isPlaying;

    // Multi-color spectrum fill gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "rgba(236, 72, 153, 0.82)");
    gradient.addColorStop(0.35, "rgba(168, 85, 247, 0.85)");
    gradient.addColorStop(0.7, "rgba(6, 182, 212, 0.85)");
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.82)");

    ctx.beginPath();
    ctx.moveTo(0, baseY);

    const coords = [];
    for (let i = 0; i < count; i++) {
      const ratio = i / (count - 1);
      let energy = 0;
      if (isPlaying && hasData) {
        const logIdx = Math.pow(ratio, 1.25) * (dataLen * 0.7);
        const idx = Math.min(dataLen - 1, Math.max(0, Math.floor(logIdx)));
        const norm = Math.min(1.0, (data[idx] || 0) / Math.max(40, this.agcPeak || 160));
        energy = Math.min(1.0, Math.pow(norm, 0.70) * (0.9 + ratio * 0.5));
      } else {
        const t = performance.now() * 0.002;
        energy = 0.08 + Math.sin(t + i * 0.25) * 0.04;
      }
      const x = i * step;
      const y = baseY - Math.max(6, energy * maxHeight);
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

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#06b6d4";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  renderWave(ctx, width, height, data) {
    const centerY = height / 2;
    const len = data && data.length > 0 ? data.length : 128;
    const step = width / (len - 1);
    const maxAmp = height * 0.42;
    const isPlaying = state.isPlaying;

    // Multi-color horizontal linear gradient
    const waveGrad = ctx.createLinearGradient(0, 0, width, 0);
    waveGrad.addColorStop(0, "#ec4899");
    waveGrad.addColorStop(0.3, "#a855f7");
    waveGrad.addColorStop(0.65, "#06b6d4");
    waveGrad.addColorStop(1, "#10b981");

    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      let val = 0;
      if (isPlaying && data) {
        val = ((data[i] || 128) - 128) / 128;
        val = Math.max(-1.0, Math.min(1.0, val * 1.35));
      } else {
        const t = performance.now() * 0.0018;
        val = Math.sin(t * 1.6 + (i / len) * Math.PI * 2) * 0.12;
      }
      const x = i * step;
      const y = centerY + val * maxAmp;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * step;
        const prevRaw = isPlaying && data ? ((data[i - 1] || 128) - 128) / 128 : 0;
        const prevVal = Math.max(-1.0, Math.min(1.0, prevRaw * 1.35));
        const prevY = centerY + prevVal * maxAmp;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    // Outer glow & crisp stroke
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = waveGrad;
    ctx.shadowColor = "#06b6d4";
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#ffffff";
    ctx.shadowBlur = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  renderCircular(ctx, width, height, data) {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.24;
    const count = 52;
    const hasData = data && data.length > 0;
    const dataLen = hasData ? data.length : 64;
    const isPlaying = state.isPlaying;
    const t = performance.now() * 0.002;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const ratio = i / count;
      let energy = 0;

      if (isPlaying && hasData) {
        const logIdx = Math.pow(ratio, 1.2) * (dataLen * 0.7);
        const idx = Math.min(dataLen - 1, Math.max(0, Math.floor(logIdx)));
        const norm = Math.min(1.0, (data[idx] || 0) / Math.max(40, this.agcPeak || 160));
        energy = Math.min(1.0, Math.pow(norm, 0.68));
      } else {
        energy = 0.15 + Math.sin(t * 1.8 + angle * 3) * 0.08;
      }

      const spike = energy * (baseRadius * 1.15);
      const x1 = centerX + Math.cos(angle) * baseRadius;
      const y1 = centerY + Math.sin(angle) * baseRadius;
      const x2 = centerX + Math.cos(angle) * (baseRadius + spike);
      const y2 = centerY + Math.sin(angle) * (baseRadius + spike);

      const hue = (260 + ratio * 200) % 360;
      ctx.strokeStyle = `hsl(${hue}, 95%, 65%)`;
      ctx.shadowColor = `hsl(${hue}, 95%, 65%)`;
      ctx.shadowBlur = isPlaying ? 6 : 2;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  renderParticles(ctx, width, height, data) {
    const bass = state.isPlaying && data && data.length > 0 ? (data[0] + data[1] + data[2]) / 3 : 25;
    const scale = 1 + (bass / 255) * 0.85;

    this.particles.forEach(p => {
      p.x += p.speedX * scale;
      p.y += p.speedY * scale;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (bass / 200 + 0.8), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }
}

export const visualizerEngine = new VisualizerEngine();

