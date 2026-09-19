import { showToast, openModal, closeModal } from "./components.js";

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isStandalone = false;
    this.isOnline = navigator.onLine;
  }

  init() {
    this.checkStandalone();
    this.initServiceWorker();
    this.initInstallPrompt();
    this.initNetworkListeners();
    this.updateInstallButtonsVisibility();
  }

  checkStandalone() {
    this.isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  initServiceWorker() {
    if ("serviceWorker" in navigator) {
      const isInIframe = window.self !== window.top;
      if (isInIframe) {
        // In dev preview iframe, clean up any stale registrations to prevent preview loading hangs
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        }).catch(() => {});
        return;
      }

      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("Service Worker registered successfully:", reg.scope);
          })
          .catch((err) => {
            console.log("Service Worker registration skipped:", err);
          });
      });
    }
  }

  initInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallUI();
    });

    window.addEventListener("appinstalled", () => {
      this.deferredPrompt = null;
      this.isStandalone = true;
      this.hideInstallUI();
      showToast("VIORA installed successfully! You can now launch it from your home screen.");
    });
  }

  showInstallUI() {
    const installBtn = document.getElementById("pwa-install-btn");
    const headerInstallBtn = document.getElementById("header-install-btn");
    if (installBtn) installBtn.style.display = "flex";
    if (headerInstallBtn) headerInstallBtn.style.display = "inline-flex";
  }

  hideInstallUI() {
    const installBtn = document.getElementById("pwa-install-btn");
    const headerInstallBtn = document.getElementById("header-install-btn");
    if (installBtn) installBtn.style.display = "none";
    if (headerInstallBtn) headerInstallBtn.style.display = "none";
  }

  updateInstallButtonsVisibility() {
    if (this.isStandalone) {
      this.hideInstallUI();
    }
  }

  promptInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          showToast("Thank you for installing VIORA!");
        }
        this.deferredPrompt = null;
        this.hideInstallUI();
      });
      return;
    }

    // Check if on iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      this.showIOSInstallInstructions();
      return;
    }

    // Generic instructions modal if prompt unavailable or already dismissed
    openModal(
      "Install VIORA Music Player",
      `
      <div style="text-align:center;padding:12px 0;">
        <div style="width:76px;height:76px;margin:0 auto 16px;border-radius:20px;overflow:hidden;border:1.5px solid rgba(0,240,255,0.4);box-shadow:0 10px 28px rgba(0,0,0,0.7),0 0 24px rgba(217,70,239,0.3);">
          <img src="/icons/icon-192.png" alt="VIORA App Icon" width="76" height="76" style="display:block;width:100%;height:100%;object-fit:cover;" />
        </div>
        <h3 style="font-size:1.2rem;font-weight:700;margin-bottom:8px;">Install on your Device</h3>
        <p style="font-size:0.88rem;color:var(--color-text-muted);line-height:1.5;max-width:340px;margin:0 auto 20px;">
          Install VIORA as a standalone Progressive Web App for instant launch, background audio playback, and offline local library access.
        </p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid var(--color-border);border-radius:12px;padding:14px;text-align:left;font-size:0.84rem;margin-bottom:20px;">
          <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;color:var(--color-accent);">1.</span>
            <span>Click the <strong>Install</strong> icon in your browser's address bar or menu.</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;color:var(--color-accent);">2.</span>
            <span>Select <strong>"Install VIORA"</strong> to add it to your desktop or home screen.</span>
          </div>
        </div>
        <button class="btn-primary" id="pwa-modal-ok-btn" style="width:100%;justify-content:center;padding:10px;">Got it</button>
      </div>
      `
    );
    document.getElementById("pwa-modal-ok-btn")?.addEventListener("click", () => {
      closeModal();
    });
  }

  showIOSInstallInstructions() {
    openModal(
      "Install on iPhone or iPad",
      `
      <div style="text-align:center;padding:10px 0;">
        <div style="width:72px;height:72px;margin:0 auto 14px;border-radius:18px;overflow:hidden;border:1.5px solid rgba(0,240,255,0.4);box-shadow:0 8px 24px rgba(0,0,0,0.7),0 0 20px rgba(217,70,239,0.3);">
          <img src="/icons/icon-192.png" alt="VIORA App Icon" width="72" height="72" style="display:block;width:100%;height:100%;object-fit:cover;" />
        </div>
        <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:8px;">Add to Home Screen</h3>
        <p style="font-size:0.86rem;color:var(--color-text-muted);margin-bottom:16px;">
          To install VIORA on your iOS device:
        </p>
        <div style="text-align:left;background:rgba(255,255,255,0.04);border:1px solid var(--color-border);border-radius:12px;padding:14px;font-size:0.85rem;line-height:1.6;margin-bottom:20px;">
          <p>1. Tap the <strong>Share</strong> button <svg style="display:inline;vertical-align:middle;margin:0 2px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> in Safari's bottom toolbar.</p>
          <p>2. Scroll down and tap <strong>"Add to Home Screen"</strong>.</p>
          <p>3. Tap <strong>"Add"</strong> in the top-right corner.</p>
        </div>
        <button class="btn-primary" id="ios-modal-close-btn" style="width:100%;justify-content:center;padding:10px;">Close</button>
      </div>
      `
    );
    document.getElementById("ios-modal-close-btn")?.addEventListener("click", () => {
      closeModal();
    });
  }

  initNetworkListeners() {
    const banner = document.getElementById("offline-banner");
    const updateStatus = () => {
      this.isOnline = navigator.onLine;
      if (banner) {
        banner.style.display = this.isOnline ? "none" : "flex";
      }
      if (!this.isOnline) {
        showToast("You are offline. Cached tracks & local files remain playable.");
      }
    };

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    updateStatus();
  }
}

export const pwaManager = new PWAManager();
