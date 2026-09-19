import { state } from "./state.js";
import { audioEngine } from "./audio-engine.js";
import { PlayerController } from "./player.js";
import { uiManager } from "./ui.js";
import { initMediaSession } from "./media-session.js";
import { initKeyboardShortcuts, showShortcutsModal } from "./shortcuts.js";
import { showToast } from "./components.js";
import { ambientContext } from "./ambient-context.js";
import { pwaManager } from "./pwa.js";
import { localLibraryService } from "./local-library.js";

class App {
  init() {
    this.playerController = new PlayerController();
    initMediaSession();
    initKeyboardShortcuts();
    ambientContext.init();
    pwaManager.init();

    this.initNavigation();
    this.initRouting();
    this.initPWAControls();

    // Default right panel initial render
    uiManager.renderRightPanelTab("queue");

    console.log("VIORA Ultimate Music Player initialized successfully.");
  }

  initNavigation() {
    // Sidebar navigation active state handler
    const updateActiveNav = (hash) => {
      const links = document.querySelectorAll(".nav-link, .mobile-nav-item");
      links.forEach(link => {
        const linkHash = link.getAttribute("href");
        if (linkHash === hash || (hash.startsWith(linkHash) && linkHash !== "#/")) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      });
    };

    window.addEventListener("hashchange", () => {
      updateActiveNav(window.location.hash || "#/");
    });

    updateActiveNav(window.location.hash || "#/");

    // Top search bar sync
    const topSearch = document.getElementById("top-search-input");
    if (topSearch) {
      topSearch.addEventListener("focus", () => {
        if (window.location.hash !== "#/search") {
          window.location.hash = "#/search";
        }
      });
      topSearch.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        if (window.location.hash !== "#/search") {
          window.location.hash = "#/search";
        } else {
          const mainInput = document.getElementById("main-search-input");
          if (mainInput && mainInput.value !== e.target.value) {
            mainInput.value = e.target.value;
            mainInput.dispatchEvent(new Event("input"));
          }
        }
      });
    }

    // Keyboard shortcut helper button in top bar
    document.getElementById("btn-shortcuts-help")?.addEventListener("click", () => {
      showShortcutsModal();
    });

    // Menubar Local Icon Tap Handler - Ensure queue is ready without any popups
    document.addEventListener("click", (e) => {
      const localLink = e.target.closest('a[href="#/local"], #nav-local-music, #mobile-nav-local');
      if (localLink && localLibraryService.localTracks && localLibraryService.localTracks.length > 0) {
        if (!state.currentSong || state.queue.length === 0) {
          state.loadLocalMusicQueue(localLibraryService.localTracks);
        }
      }
    });
  }

  initRouting() {
    const handleRoute = () => {
      try {
        const hash = window.location.hash || "#/";
        const [route, param] = hash.split("/").slice(1);

        if (!route || route === "") {
          uiManager.renderHome();
        } else if (route === "search") {
          uiManager.renderSearch();
        } else if (route === "local") {
          uiManager.renderLocalMusic();
        } else if (route === "songs") {
          uiManager.renderSongs();
        } else if (route === "albums") {
          uiManager.renderAlbums();
        } else if (route === "album-detail") {
          uiManager.renderAlbumDetail(param);
        } else if (route === "artists") {
          uiManager.renderArtists();
        } else if (route === "artist-detail") {
          uiManager.renderArtistDetail(param);
        } else if (route === "genres") {
          uiManager.renderGenres();
        } else if (route === "playlists") {
          uiManager.renderPlaylists();
        } else if (route === "playlist-detail") {
          uiManager.renderPlaylistDetail(param);
        } else if (route === "favorites") {
          uiManager.renderFavorites();
        } else if (route === "recent") {
          uiManager.renderRecent();
        } else if (route === "most-played") {
          uiManager.renderMostPlayed();
        } else if (route === "downloads") {
          uiManager.renderDownloads();
        } else if (route === "radio") {
          uiManager.renderRadio();
        } else if (route === "podcasts") {
          uiManager.renderPodcasts();
        } else if (route === "lyrics") {
          uiManager.renderLyrics();
        } else if (route === "equalizer") {
          uiManager.renderEqualizer();
        } else if (route === "visualizer") {
          uiManager.renderVisualizer();
        } else if (route === "statistics") {
          uiManager.renderStatistics();
        } else if (route === "settings") {
          uiManager.renderSettings();
        } else {
          uiManager.renderHome();
        }

        window.scrollTo(0, 0);
      } catch (e) {
        console.error("Routing error:", e);
      }
    };

    window.addEventListener("hashchange", handleRoute);
    handleRoute();
  }

  initPWAControls() {
    const installBtn = document.getElementById("pwa-install-btn");
    const headerInstallBtn = document.getElementById("header-install-btn");

    installBtn?.addEventListener("click", () => {
      pwaManager.promptInstall();
    });

    headerInstallBtn?.addEventListener("click", () => {
      pwaManager.promptInstall();
    });
  }
}

function bootstrap() {
  if (!window.app) {
    window.app = new App();
    window.app.init();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

