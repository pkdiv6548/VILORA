import { state } from "./state.js";
import { DEMO_LYRICS } from "../data/lyrics.js";
import { audioEngine } from "./audio-engine.js";
import { showToast } from "./components.js";

export function cleanTrackTitle(title) {
  if (!title) return "";
  let clean = title;
  // Decode HTML entities if present e.g. &amp;, &#39;, &quot;
  clean = clean.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  // Remove audio file extension
  clean = clean.replace(/\.(mp3|m4a|flac|wav|aac|ogg|wma|weba|opus|alac)$/i, "");
  // Replace underscores and dots between words with space
  clean = clean.replace(/([a-zA-Z0-9])_([a-zA-Z0-9])/g, "$1 $2").replace(/_/g, " ");
  clean = clean.replace(/([a-zA-Z])\.([a-zA-Z])/g, "$1 $2");
  // Remove YouTube channel watermarks e.g. | T-Series, | Zee Music Company, | Sony Music India
  clean = clean.replace(/\|\s*(?:T-Series|Zee Music Company|Sony Music India|YRF|Tips Official|Speed Records|Saregama|Geet MP3|White Hill Music)[^|]*/gi, "");
  // Remove trailing pipe or dashes with artist/channel info e.g. "Song Name | Artist Name"
  clean = clean.replace(/\|.*$/, "");
  // Remove domain names and download site watermarks e.g. - PagalNew, RiskyjaTT CoM, etc.
  clean = clean.replace(/[-–—\s]*\b(?:pagalnew|riskyjatt|pagalworld|pagalfree|djpunjab|mp3tau|pendujatt|webmusic|songs\.pk|songspk|bolly4u|djmaza|naasongs|masstamilan|sensongs|mp3mad|raagsong|jattmate|mrjatt|koshalworld|saregama)(?:\s*co?m)?\b/gi, "");
  clean = clean.replace(/[\(\[\{]?(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9_\-]+\.(?:com|in|net|org|co|info|biz|cc|xyz|top|site|me|pw)[\)\]\}]?/gi, "");
  clean = clean.replace(/[\(\[]?(?:koshalworld|pagalworld|pagalnew|riskyjatt|pagalfree|djpunjab|mp3tau|pendujatt|webmusic|songs\.pk|songspk|bolly4u|djmaza|naasongs|masstamilan|sensongs|mp3mad|raagsong|jattmate|mrjatt|saregama)[^\)\]\s]*[\)\]]?/gi, "");
  // Remove bitrates anywhere e.g. 128 Kbps, 320kbps, 192 kbps
  clean = clean.replace(/[\(\[]?\b(?:320|256|192|160|128|96|64|48|32)\s*kbps\b[\)\]]?/gi, "");
  clean = clean.replace(/[\(\[]?\b\d{2,3}\s*kbps\b[\)\]]?/gi, "");
  clean = clean.replace(/[\(\[]?\bkbps\b[\)\]]?/gi, "");
  clean = clean.replace(/[\(\[]?\b(?:vbr|cbr)\b[\)\]]?/gi, "");
  // Remove quality, remix, lyrical, video and audio tags
  clean = clean.replace(/[\(\[]?\b(?:remastered|remaster|hq|hd|uhd|4k|flac|audio|official|lyrical|lyric\s*video|official\s*video|official\s*music\s*video|music\s*video|video\s*song|video|full\s*song|full\s*audio|full\s*video|dj\s*remix|remix|mix|slowed\s*reverb|slowed\s*\+\s*reverb|slowed|reverb|original|jhankar|dolby|atmos|unplugged|acoustic|cover|instrumental)\b[\)\]]?/gi, "");
  // Remove leading numbers e.g. "01 - ", "01. "
  clean = clean.replace(/^(?:track\s*)?\d+[\s\.\-_]+/i, "");
  // Remove empty parens
  clean = clean.replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, "");
  // Clean up dashes or underscores at ends
  return clean.replace(/^[\-_—~:\s]+|[\-_—~:\s]+$/g, "").replace(/\s{2,}/g, " ").trim() || title;
}

export function cleanArtistName(artist) {
  if (!artist) return "";
  let clean = artist
    .replace(/[-–—\s]*\b(?:pagalnew|riskyjatt|pagalworld|pagalfree|djpunjab|mp3tau|pendujatt|webmusic|songs\.pk|songspk|bolly4u|djmaza|naasongs|masstamilan|sensongs|mp3mad|raagsong|jattmate|mrjatt|koshalworld|saregama)(?:\s*co?m)?\b/gi, "")
    .replace(/[\(\[\{]?(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9_\-]+\.(?:com|in|net|org|co|info|biz)[\)\]\}]?/gi, "")
    .trim();

  const lower = clean.toLowerCase();
  if (
    lower.includes("local artist") ||
    lower.includes("unknown") ||
    lower.includes("various") ||
    lower === "artist" ||
    lower === "local" ||
    lower === "admin"
  ) {
    return "";
  }
  return clean.replace(/feat\..*/i, "").replace(/ft\..*/i, "").split(",")[0].trim();
}

export class LyricsService {
  constructor() {
    this.currentLyricsData = null;
    this.currentSongId = null;
    this.activeLineIndex = -1;
    this.containerEl = null;
    this.fontSize = 1.35; // rem
    this.timingOffset = 0; // seconds
    this.customLyricsCache = {};
    this.pendingFetches = new Set();
    this.isFetchingOnline = false;

    // Load custom cached lyrics from localStorage
    this.loadCachedLyrics();

    // Auto-prefetch lyrics immediately when active song changes
    state.subscribe("currentSongChanged", (song) => {
      if (song) {
        this.currentSongId = song.id;
        const data = this.getLyricsForSong(song.id);
        if (data && !data.isLoading) {
          this.refreshAllLyricsContainers(song.id);
        }
      }
    });
  }

  loadCachedLyrics() {
    try {
      const stored = localStorage.getItem("hifi_custom_lyrics_cache");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Clean out any stale, empty, or failed records
        for (const k of Object.keys(parsed)) {
          const lowerK = k.toLowerCase().trim();
          if (
            DEMO_LYRICS[k] ||
            DEMO_LYRICS[lowerK] ||
            k.startsWith("song-") ||
            lowerK === "appalachian sunrise" ||
            parsed[k]?.notFound ||
            !parsed[k]?.lines ||
            parsed[k]?.lines?.length === 0
          ) {
            delete parsed[k];
          }
        }
        this.customLyricsCache = parsed;
        localStorage.setItem("hifi_custom_lyrics_cache", JSON.stringify(this.customLyricsCache));
      }
    } catch (e) {
      this.customLyricsCache = {};
    }
  }

  saveCachedLyrics(key, data) {
    if (!key || !data) return;
    // Never overwrite demo tracks in custom cache
    if (DEMO_LYRICS[key] || key.startsWith("song-")) return;
    this.customLyricsCache[key] = data;
    // Only persist successful lyrics with lines to localStorage
    if (!data.notFound && data.lines && data.lines.length > 0) {
      try {
        localStorage.setItem("hifi_custom_lyrics_cache", JSON.stringify(this.customLyricsCache));
      } catch (e) {}
    }
  }

  detectLanguage(text = "", song = null) {
    // 1. Direct song.language if set
    if (song && song.language) {
      const l = song.language.toLowerCase().trim();
      if (l.includes("hindi") || l.includes("bollywood")) {
        return { name: "Hindi", code: "hi", flag: "🇮🇳", label: "हिंदी (Hindi)" };
      }
      if (l.includes("punjabi")) {
        return { name: "Punjabi", code: "pa", flag: "🇮🇳", label: "ਪੰਜਾਬੀ (Punjabi)" };
      }
      if (l.includes("japanese")) {
        return { name: "Japanese", code: "ja", flag: "🇯🇵", label: "日本語 (Japanese)" };
      }
      if (l.includes("french")) {
        return { name: "French", code: "fr", flag: "🇫🇷", label: "Français (French)" };
      }
      if (l.includes("spanish")) {
        return { name: "Spanish", code: "es", flag: "🇪🇸", label: "Español (Spanish)" };
      }
      if (l.includes("english")) {
        return { name: "English", code: "en", flag: "🇺🇸", label: "English" };
      }
    }

    const combined = [
      text,
      song ? song.title : "",
      song ? song.artist : "",
      song ? (song.album || "") : "",
      song ? (song.genre || "") : ""
    ].join(" ").toLowerCase();

    // 2. Unicode script ranges
    // Devanagari script for Hindi / Sanskrit / Marathi
    if (/[\u0900-\u097F]/.test(combined)) {
      return { name: "Hindi", code: "hi", flag: "🇮🇳", label: "हिंदी (Hindi)" };
    }

    // Gurmukhi script for Punjabi
    if (/[\u0A00-\u0A7F]/.test(combined)) {
      return { name: "Punjabi", code: "pa", flag: "🇮🇳", label: "ਪੰਜਾਬੀ (Punjabi)" };
    }

    // Japanese Kanji / Hiragana / Katakana
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(combined)) {
      return { name: "Japanese", code: "ja", flag: "🇯🇵", label: "日本語 (Japanese)" };
    }

    // Korean Hangul
    if (/[\uAC00-\uD7AF]/.test(combined)) {
      return { name: "Korean", code: "ko", flag: "🇰🇷", label: "한국어 (Korean)" };
    }

    // Arabic / Urdu
    if (/[\u0600-\u06FF]/.test(combined)) {
      return { name: "Urdu", code: "ur", flag: "🇵🇰", label: "اردو (Urdu)" };
    }

    // 3. Indian music website watermarks in title or filename
    if (/(koshalworld|pagalworld|pagalfree|djpunjab|mp3tau|pendujatt|webmusic|songs\.pk|songspk|bolly4u|djmaza|naasongs)/i.test(combined)) {
      return { name: "Hindi", code: "hi", flag: "🇮🇳", label: "हिंदी (Hindi)" };
    }

    // 4. Renowned Hindi / Bollywood artist names
    if (/\b(kumar sanu|sadhana sargam|anu malik|arijit|arijit singh|lata mangeshkar|kishore kumar|mohammed rafi|mukesh|asha bhosle|alka yagnik|udit narayan|sonu nigam|shreya ghoshal|sunidhi chauhan|atif aslam|jubin nautiyal|neha kakkar|rahat fateh|badshah|sachin-jigar|pritam|jatin lalit|ar rahman|himesh reshammiya|mohit chauhan|kk|shaan|arman malik|vishal mishra)\b/i.test(combined)) {
      return { name: "Hindi", code: "hi", flag: "🇮🇳", label: "हिंदी (Hindi)" };
    }

    // 5. Strict Hindi / Hinglish vocabulary detection (NEVER include common English words like 'the', 'do', 'main', 'le', 'hum')
    const strictHindiKeywords = /\b(aayiye|aaiye|intezaar|intezar|zindagi|aashiqui|dhadkan|kesariya|saansein|wajood|galiyan|mohabbat|deewana|deewani|humsafar|judaai|chaahat|bewafa|ankhiyan|chaand|barsaat|ghabraaye|vijaypath)\b/i;
    if (strictHindiKeywords.test(combined)) {
      return { name: "Hindi", code: "hi", flag: "🇮🇳", label: "हिंदी (Hindi)" };
    }

    // 6. Romanized Punjabi keywords detection
    if (/\b(meriyan|akhan|gabru|kiven|hoya|sohniye|pichhe|pasoori|majboori|judaiyan|dhola|diljit dosanjh|sidhu moosewala|karan aujla|b praak|ap dhillon)\b/i.test(combined)) {
      return { name: "Punjabi", code: "pa", flag: "🇮🇳", label: "ਪੰਜਾਬੀ (Punjabi)" };
    }

    // 7. French indicators
    if (/[éèêëàâîïôûùçœ]/.test(combined) && /\b(champs-élysées|bonjour|monde|avec|dans|champs|cœur)\b/i.test(combined)) {
      return { name: "French", code: "fr", flag: "🇫🇷", label: "Français (French)" };
    }

    // 8. Spanish indicators
    if (/[ñáéíóú¿¡]/.test(combined) && /\b(despacito|corazón|bailar|canción|hermosa)\b/i.test(combined)) {
      return { name: "Spanish", code: "es", flag: "🇪🇸", label: "Español (Spanish)" };
    }

    // 9. Romaji Japanese keywords detection
    if (/\b(watashi|anata|mayonaka|shinjuku|sakura|shibuya|arigatou|sayonara|kokoro)\b/i.test(combined)) {
      return { name: "Japanese", code: "ja", flag: "🇯🇵", label: "Romaji / 日本語 (Japanese)" };
    }

    return { name: "English", code: "en", flag: "🇺🇸", label: "English" };
  }

  parseLrc(lrcText) {
    if (!lrcText || typeof lrcText !== "string") return [];
    const lines = lrcText.split("\n");
    const parsed = [];

    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (let rawLine of lines) {
      rawLine = rawLine.trim();
      if (!rawLine) continue;

      // Check for timestamp matches
      const matches = [...rawLine.matchAll(timeRegex)];
      if (matches.length > 0) {
        const text = rawLine.replace(timeRegex, "").trim();
        for (const match of matches) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const msStr = match[3] || "0";
          const fraction = parseFloat(`0.${msStr}`);
          const totalSeconds = minutes * 60 + seconds + fraction;

          if (text) {
            parsed.push({ time: Math.round(totalSeconds * 100) / 100, text });
          }
        }
      }
    }

    parsed.sort((a, b) => a.time - b.time);
    return parsed;
  }

  createTimedLinesFromPlain(plainText, duration = 180) {
    if (!plainText) return [];
    const rawLines = plainText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) return [];

    const count = rawLines.length;
    const usableDuration = Math.max(30, duration - 10);
    const interval = usableDuration / Math.max(1, count);

    return rawLines.map((text, idx) => ({
      time: Math.round((idx * interval) * 10) / 10,
      text
    }));
  }

  findMatchingDemoLyrics(cleanTitle, songId = null) {
    if (songId && DEMO_LYRICS[songId]) {
      return DEMO_LYRICS[songId];
    }
    if (!cleanTitle) return null;
    const target = cleanTitle.toLowerCase().trim();

    // Strict, exact title matching for built-in demo songs only
    const strictDemoTitles = {
      "tum hi ho": "song-hi-1",
      "kesariya": "song-hi-2",
      "apna bana le": "song-hi-3",
      "aayiye aapka intezaar tha": "song-hi-4",
      "pasoori": "song-pb-1",
      "excuses": "song-pb-2",
      "despacito": "song-es-1",
      "shape of you": "song-1",
      "blinding lights": "song-2",
      "levitating": "song-3",
      "starboy": "song-20",
      "believer": "song-21"
    };

    const matchedKey = strictDemoTitles[target];
    if (matchedKey && DEMO_LYRICS[matchedKey]) {
      return DEMO_LYRICS[matchedKey];
    }
    return null;
  }

  getLyricsForSong(songId) {
    const song = state.getSongById(songId);
    const cleanTitle = song ? cleanTrackTitle(song.title) : "";

    // 1. Built-in verified demo lyrics by exact demo song ID
    if (songId && DEMO_LYRICS[songId]) {
      const demo = DEMO_LYRICS[songId];
      if (!demo.language) {
        const fullText = (demo.lines || []).map(l => l.text).join(" ");
        const langInfo = this.detectLanguage(fullText, song);
        demo.language = langInfo.name;
        demo.flag = langInfo.flag;
        demo.nativeScript = langInfo.label;
      }
      return demo;
    }

    // 2. Check custom cache by song ID (user saved / previously loaded)
    if (this.customLyricsCache[songId] && !this.customLyricsCache[songId].notFound && this.customLyricsCache[songId].lines?.length > 0) {
      return this.customLyricsCache[songId];
    }

    // 3. Check custom cache by clean title
    if (cleanTitle && this.customLyricsCache[cleanTitle.toLowerCase()] && !this.customLyricsCache[cleanTitle.toLowerCase()].notFound && this.customLyricsCache[cleanTitle.toLowerCase()].lines?.length > 0) {
      return this.customLyricsCache[cleanTitle.toLowerCase()];
    }

    // 4. Strict demo match by exact title
    const demoMatch = this.findMatchingDemoLyrics(cleanTitle, songId);
    if (demoMatch) {
      if (!demoMatch.language) {
        const fullText = (demoMatch.lines || []).map(l => l.text).join(" ");
        const langInfo = this.detectLanguage(fullText, song);
        demoMatch.language = langInfo.name;
        demoMatch.flag = langInfo.flag;
        demoMatch.nativeScript = langInfo.label;
      }
      return demoMatch;
    }

    // 5. Trigger asynchronous real lyrics fetch from server API
    if (song && !this.pendingFetches.has(songId)) {
      this.fetchRealLyrics(song);
    }

    // 6. Return loading state while lyrics are being fetched
    return {
      isLoading: true,
      hasSynced: true,
      language: "Detecting",
      flag: "🔄",
      nativeScript: "Searching Lyrics...",
      lines: []
    };
  }

  async fetchRealLyrics(song) {
    if (!song || !song.title) return;
    const songId = song.id;
    if (this.pendingFetches.has(songId)) return;
    this.pendingFetches.add(songId);

    try {
      const cleanTitle = cleanTrackTitle(song.title);
      const cleanArtist = cleanArtistName(song.artist);
      const duration = Math.round(song.duration || 0);

      let record = null;

      // Primary: Query our dedicated server-side API (/api/lyrics)
      try {
        let apiUrl = `/api/lyrics?track=${encodeURIComponent(cleanTitle || song.title)}`;
        if (cleanArtist) apiUrl += `&artist=${encodeURIComponent(cleanArtist)}`;
        if (duration > 0) apiUrl += `&duration=${duration}`;

        const res = await fetch(apiUrl);
        if (res.ok) {
          const json = await res.json();
          if (json && json.found && (json.syncedLyrics || json.plainLyrics)) {
            record = json;
          }
        }
      } catch (err) {
        console.warn("Server /api/lyrics failed, attempting client fallback...", err);
      }

      // Secondary: Direct client-side LRCLIB fallback if server route didn't return lyrics
      if (!record) {
        record = await this.clientFallbackFetch(cleanTitle || song.title, cleanArtist, duration, song);
      }

      if (record && (record.syncedLyrics || record.plainLyrics)) {
        let lines = [];
        if (record.syncedLyrics) {
          lines = this.parseLrc(record.syncedLyrics);
        }
        if (lines.length === 0 && record.plainLyrics) {
          lines = this.createTimedLinesFromPlain(record.plainLyrics, duration || 180);
        }

        if (lines.length > 0) {
          const sampleText = lines.map(l => l.text).join(" ");
          const langInfo = this.detectLanguage(sampleText, song);

          const lyricsData = {
            hasSynced: Boolean(record.syncedLyrics),
            isReal: true,
            source: record.source || `LRCLIB: ${record.trackName || cleanTitle} — ${record.artistName || cleanArtist}`,
            language: record.language || langInfo.name,
            flag: record.flag || langInfo.flag,
            nativeScript: record.nativeScript || langInfo.label,
            lines
          };

          this.saveCachedLyrics(songId, lyricsData);
          if (cleanTitle) {
            this.saveCachedLyrics(cleanTitle.toLowerCase(), lyricsData);
          }
          this.refreshAllLyricsContainers(songId);
          return;
        }
      }

      // If no lyrics could be found across all providers
      const notFoundData = {
        notFound: true,
        hasSynced: false,
        language: "Original",
        flag: "🎵",
        nativeScript: "No Synced Lyrics",
        lines: []
      };
      this.saveCachedLyrics(songId, notFoundData);
      this.refreshAllLyricsContainers(songId);
    } catch (e) {
      console.warn("fetchRealLyrics encountered an error:", e);
    } finally {
      this.pendingFetches.delete(songId);
    }
  }

  async clientFallbackFetch(cleanTitle, cleanArtist, duration, song) {
    const queries = [];
    if (cleanTitle && cleanArtist) queries.push(`${cleanTitle} ${cleanArtist}`);
    if (cleanTitle) queries.push(cleanTitle);

    const titleWords = (cleanTitle || "").split(/\s+/).filter(Boolean);
    if (titleWords.length >= 3) {
      queries.push(titleWords.slice(0, 2).join(" "));
      queries.push(titleWords.slice(0, -1).join(" "));
    }

    if (song && song.title.includes("-")) {
      const parts = song.title.split("-").map(p => cleanTrackTitle(p)).filter(Boolean);
      if (parts[0]) queries.push(parts[0]);
      if (parts[1]) queries.push(parts[1]);
    }
    if (song && song.title.includes("|")) {
      const partBefore = cleanTrackTitle(song.title.split("|")[0]);
      if (partBefore && !queries.includes(partBefore)) queries.push(partBefore);
    }

    for (const q of queries.slice(0, 5)) {
      try {
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { "LrcLib-Client": "HiFiMusicPlayer (web)" } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const synced = data.find(d => d.syncedLyrics);
            if (synced) return synced;
            if (data[0].plainLyrics) return data[0];
          }
        }
      } catch (e) {}
    }
    return null;
  }

  refreshAllLyricsContainers(songId) {
    this.currentLyricsData = this.getLyricsForSong(songId);
    const targetContainers = document.querySelectorAll(
      "#fs-lyrics-display, #panel-lyrics-container, #full-lyrics-container, #page-lyrics-container, .lyrics-viewport-container"
    );
    targetContainers.forEach(c => {
      this.renderToContainer(c, songId);
    });
    if (this.containerEl && !Array.from(targetContainers).includes(this.containerEl)) {
      this.renderToContainer(this.containerEl, songId);
    }
  }

  async searchAndApplyLyrics(query, songId) {
    if (!query || !query.trim()) return [];
    try {
      const cleanQ = cleanTrackTitle(query.trim());
      const url = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanQ)}`;
      const res = await fetch(url, { headers: { "LrcLib-Client": "HiFiMusicPlayer (web)" } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("Lyrics query search error", e);
      return [];
    }
  }

  applySearchResult(resultRecord, songId) {
    if (!resultRecord || !songId) return;

    let lines = [];
    if (resultRecord.syncedLyrics) {
      lines = this.parseLrc(resultRecord.syncedLyrics);
    }
    if (lines.length === 0 && resultRecord.plainLyrics) {
      const song = state.getSongById(songId);
      lines = this.createTimedLinesFromPlain(resultRecord.plainLyrics, song ? song.duration : 180);
    }

    if (lines.length > 0) {
      const sampleText = lines.map(l => l.text).join(" ");
      const song = state.getSongById(songId);
      const langInfo = this.detectLanguage(sampleText, song);

      const lyricsData = {
        hasSynced: true,
        isReal: true,
        source: `LRCLIB: ${resultRecord.trackName} - ${resultRecord.artistName}`,
        language: langInfo.name,
        flag: langInfo.flag,
        nativeScript: langInfo.label,
        lines
      };

      this.saveCachedLyrics(songId, lyricsData);
      if (song) {
        const cleanTitle = cleanTrackTitle(song.title);
        this.saveCachedLyrics(cleanTitle.toLowerCase(), lyricsData);
      }

      this.refreshAllLyricsContainers(songId);
      return true;
    }
    return false;
  }

  renderToContainer(container, songId) {
    if (!container) return;
    this.containerEl = container;
    this.currentSongId = songId;
    this.currentLyricsData = this.getLyricsForSong(songId);
    this.activeLineIndex = -1;

    container.innerHTML = "";

    const song = state.getSongById(songId);
    const data = this.currentLyricsData;

    // 1. If currently loading lyrics asynchronously
    if (data.isLoading) {
      const toolbar = document.createElement("div");
      toolbar.className = "lyrics-interactive-toolbar";
      toolbar.innerHTML = `
        <div class="lyrics-lang-pill" title="Original Language of Lyrics">
          <span class="lyrics-flag">🔄</span>
          <span class="lyrics-lang-name">Fetching Lyrics...</span>
        </div>
      `;
      container.appendChild(toolbar);

      const loadingBox = document.createElement("div");
      loadingBox.className = "lyrics-container";
      loadingBox.style.fontSize = `${this.fontSize}rem`;
      loadingBox.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:70px 20px;text-align:center;">
          <div style="width:36px;height:36px;border:3px solid rgba(255,255,255,0.15);border-top-color:var(--color-accent);border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:18px;"></div>
          <p style="font-size:1.15rem;font-weight:700;color:var(--color-text);">Loading Lyrics...</p>
          <p style="font-size:0.88rem;color:var(--color-text-muted);margin-top:6px;max-width:360px;">
            Fetching synchronized lyrics in original language for "${song ? song.title : 'this track'}"
          </p>
        </div>
      `;
      container.appendChild(loadingBox);
      return;
    }

    // 2. If no lyrics could be found
    if (data.notFound || !data.lines || data.lines.length === 0) {
      const toolbar = document.createElement("div");
      toolbar.className = "lyrics-interactive-toolbar";
      toolbar.innerHTML = `
        <div class="lyrics-lang-pill" title="Lyrics Status">
          <span class="lyrics-flag">🎵</span>
          <span class="lyrics-lang-name">No Synced Lyrics</span>
        </div>
        <div class="lyrics-actions-group">
          <button class="lyrics-action-btn" id="lyrics-find-online-btn" title="Search Live Lyrics Database">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>Search Database</span>
          </button>
        </div>
      `;
      container.appendChild(toolbar);
      toolbar.querySelector("#lyrics-find-online-btn")?.addEventListener("click", () => {
        this.showOnlineSearchModal(song);
      });

      const notFoundBox = document.createElement("div");
      notFoundBox.className = "lyrics-container";
      notFoundBox.style.fontSize = `${this.fontSize}rem`;
      notFoundBox.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.6);">
          <div style="font-size:2.4rem;margin-bottom:12px;">🎶</div>
          <p style="font-size:1.15rem;font-weight:700;color:var(--color-text);margin-bottom:6px;">No synchronized lyrics found</p>
          <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:18px;max-width:380px;margin-left:auto;margin-right:auto;">
            Could not find synchronized lyrics for "${song ? song.title : 'this track'}". You can search the live database with a custom query.
          </p>
          <button class="fs-tool-chip" id="lyrics-manual-search-btn" style="margin:0 auto;display:inline-flex;padding:8px 20px;">
            Search Live Database
          </button>
        </div>
      `;
      notFoundBox.querySelector("#lyrics-manual-search-btn")?.addEventListener("click", () => {
        this.showOnlineSearchModal(song);
      });
      container.appendChild(notFoundBox);
      return;
    }

    // 3. Language & Real Lyrics Control Bar
    const toolbar = document.createElement("div");
    toolbar.className = "lyrics-interactive-toolbar";
    toolbar.innerHTML = `
      <div class="lyrics-lang-pill" title="Original Language of Lyrics">
        <span class="lyrics-flag">${data.flag || "🎵"}</span>
        <span class="lyrics-lang-name">${data.nativeScript || data.language || "Original"}</span>
        <span class="lyrics-real-badge">${data.isReal || DEMO_LYRICS[songId] ? "REAL LYRICS" : "SYNCED"}</span>
      </div>
      <div class="lyrics-actions-group">
        <button class="lyrics-action-btn" id="lyrics-find-online-btn" title="Search Live Lyrics Database">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Find Lyrics</span>
        </button>
        <button class="lyrics-action-btn" id="lyrics-copy-btn" title="Copy Lyrics to Clipboard">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copy</span>
        </button>
        <div class="lyrics-sync-offset-box" title="Adjust Lyrics Timing Sync">
          <button class="lyrics-offset-btn" id="lyrics-offset-dec" title="Offset -0.5s">-0.5s</button>
          <span class="lyrics-offset-val" id="lyrics-offset-display">${this.timingOffset >= 0 ? "+" : ""}${this.timingOffset.toFixed(1)}s</span>
          <button class="lyrics-offset-btn" id="lyrics-offset-inc" title="Offset +0.5s">+0.5s</button>
        </div>
      </div>
    `;

    container.appendChild(toolbar);

    // Bind toolbar actions
    toolbar.querySelector("#lyrics-copy-btn")?.addEventListener("click", () => {
      this.copyLyricsToClipboard(toolbar.querySelector("#lyrics-copy-btn"));
    });

    toolbar.querySelector("#lyrics-find-online-btn")?.addEventListener("click", () => {
      this.showOnlineSearchModal(song);
    });

    toolbar.querySelector("#lyrics-offset-dec")?.addEventListener("click", () => {
      this.adjustTimingOffset(-0.5);
    });

    toolbar.querySelector("#lyrics-offset-inc")?.addEventListener("click", () => {
      this.adjustTimingOffset(0.5);
    });

    // 4. Synchronized Lines Container
    const wrapper = document.createElement("div");
    wrapper.className = "lyrics-container";
    wrapper.style.fontSize = `${this.fontSize}rem`;

    data.lines.forEach((line, idx) => {
      const lineEl = document.createElement("div");
      lineEl.className = "lyrics-line";
      lineEl.dataset.index = idx;
      lineEl.dataset.time = line.time;

      // Check if text has bilingual script format: e.g. "हिंदी बोल (English transliteration)"
      const hasNonLatin = /[\u0900-\u097F\u0A00-\u0A7F\u3040-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/.test(line.text);
      const parenMatch = line.text.match(/^([^()]+)\s*\(([^()]+)\)$/);
      if (hasNonLatin && parenMatch) {
        lineEl.innerHTML = `
          <div class="lyrics-primary-text">${parenMatch[1].trim()}</div>
          <div class="lyrics-secondary-text">${parenMatch[2].trim()}</div>
        `;
      } else {
        lineEl.innerHTML = `
          <div class="lyrics-primary-text">${line.text}</div>
        `;
      }

      lineEl.addEventListener("click", () => {
        audioEngine.seek(Math.max(0, line.time - this.timingOffset));
      });

      wrapper.appendChild(lineEl);
    });

    container.appendChild(wrapper);
    this.updateHighlight(state.currentTime);
  }

  adjustTimingOffset(delta) {
    this.timingOffset = Math.round((this.timingOffset + delta) * 10) / 10;
    const display = document.getElementById("lyrics-offset-display");
    if (display) {
      display.textContent = `${this.timingOffset >= 0 ? "+" : ""}${this.timingOffset.toFixed(1)}s`;
    }
    this.updateHighlight(state.currentTime);
  }

  copyLyricsToClipboard(btnEl) {
    if (!this.currentLyricsData || !this.currentLyricsData.lines) return;
    const plain = this.currentLyricsData.lines.map(l => l.text).join("\n");
    navigator.clipboard.writeText(plain).then(() => {
      if (btnEl) {
        const span = btnEl.querySelector("span");
        if (span) {
          const original = span.textContent;
          span.textContent = "Copied!";
          btnEl.style.color = "#1db954";
          setTimeout(() => {
            span.textContent = original;
            btnEl.style.color = "";
          }, 1800);
        }
      }
    }).catch(() => {
      showToast("Lyrics copied to clipboard!", "success");
    });
  }

  showOnlineSearchModal(song) {
    const existing = document.getElementById("lyrics-online-search-modal");
    if (existing) existing.remove();

    const cleanTitle = song ? cleanTrackTitle(song.title) : "";
    const cleanArtist = song ? cleanArtistName(song.artist) : "";

    const modal = document.createElement("div");
    modal.id = "lyrics-online-search-modal";
    modal.className = "lyrics-search-modal-backdrop";
    modal.innerHTML = `
      <div class="lyrics-search-modal-card">
        <div class="lyrics-search-modal-header">
          <div>
            <h3 style="font-size:1.15rem;font-weight:700;color:#fff;margin:0 0 4px;">Find Real Synced Lyrics</h3>
            <p style="font-size:0.8rem;color:rgba(255,255,255,0.6);margin:0;">Search global multi-language synced lyrics database (LRCLIB)</p>
          </div>
          <button class="lyrics-modal-close" id="lyrics-search-close-btn">&times;</button>
        </div>
        <div class="lyrics-search-input-wrap">
          <input type="text" id="lyrics-search-modal-input" value="${cleanTitle ? `${cleanTitle} ${cleanArtist}`.trim() : ""}" placeholder="Enter song title or artist in any language...">
          <button id="lyrics-search-modal-submit" class="lyrics-modal-submit-btn">Search</button>
        </div>
        <div class="lyrics-search-modal-results" id="lyrics-search-results-list">
          <div style="text-align:center;padding:24px;color:rgba(255,255,255,0.5);font-size:0.9rem;">
            Click search to find synchronized lyrics for "${cleanTitle || "this song"}"
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector("#lyrics-search-close-btn");
    const searchInput = modal.querySelector("#lyrics-search-modal-input");
    const submitBtn = modal.querySelector("#lyrics-search-modal-submit");
    const resultsContainer = modal.querySelector("#lyrics-search-results-list");

    closeBtn.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    const executeSearch = async () => {
      const q = searchInput.value.trim();
      if (!q) return;

      resultsContainer.innerHTML = `<div style="text-align:center;padding:30px;color:var(--color-accent);">Searching live lyrics database...</div>`;

      const results = await this.searchAndApplyLyrics(q, song ? song.id : null);
      if (!results || results.length === 0) {
        resultsContainer.innerHTML = `<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.6);">No exact matches found. Try searching by song title or lyrics fragment.</div>`;
        return;
      }

      resultsContainer.innerHTML = results.map((item, idx) => {
        const itemText = item.syncedLyrics || item.plainLyrics || "";
        const isHindiText = /[\u0900-\u097F]/.test(itemText);
        return `
          <div class="lyrics-result-row" data-index="${idx}">
            <div class="lyrics-result-meta">
              <span class="lyrics-result-title">${item.trackName || item.name} ${isHindiText ? '<span style="color:#1db954;font-size:0.75rem;font-weight:700;">[हिंदी]</span>' : ''}</span>
              <span class="lyrics-result-artist">${item.artistName} • ${item.albumName || "Single"}</span>
            </div>
            <div class="lyrics-result-badge-col">
              <span class="lyrics-type-tag ${item.syncedLyrics ? 'synced' : 'plain'}">${item.syncedLyrics ? '⚡ Synced' : 'Plain'}</span>
              <button class="lyrics-select-btn" data-index="${idx}">Apply</button>
            </div>
          </div>
        `;
      }).join("");

      resultsContainer.querySelectorAll(".lyrics-select-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const index = parseInt(btn.dataset.index, 10);
          const chosen = results[index];
          if (chosen && song) {
            this.applySearchResult(chosen, song.id);
            modal.remove();
          }
        });
      });
    };

    submitBtn.addEventListener("click", executeSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") executeSearch();
    });

    // Run auto-search immediately on open
    executeSearch();
  }

  updateHighlight(currentTime) {
    if (!this.currentLyricsData) return;
    const lines = this.currentLyricsData.lines;
    if (!lines || lines.length === 0) return;

    // Apply manual timing offset
    const adjustedTime = currentTime + this.timingOffset;
    let newIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (adjustedTime >= lines[i].time) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== this.activeLineIndex) {
      this.activeLineIndex = newIndex;

      // Find all lyrics containers across the DOM
      const targetContainers = document.querySelectorAll(
        "#fs-lyrics-display, #panel-lyrics-container, #full-lyrics-container, #page-lyrics-container, .lyrics-viewport-container, .lyrics-container"
      );

      const allContainers = targetContainers.length > 0
        ? Array.from(targetContainers)
        : (this.containerEl ? [this.containerEl] : []);

      allContainers.forEach(container => {
        const lineEls = container.querySelectorAll(".lyrics-line");
        lineEls.forEach((el, idx) => {
          if (idx === newIndex) {
            el.classList.add("active");
            el.classList.remove("near-active");
            const scrollParent = el.closest(".fs-lyrics-viewport, #fs-lyrics-viewport, .panel-tab-content, .page-container, .lyrics-viewport");
            if (scrollParent && typeof scrollParent.scrollTo === "function") {
              const targetTop = el.offsetTop - (scrollParent.clientHeight / 2) + (el.clientHeight / 2);
              scrollParent.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
            } else {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } else if (newIndex !== -1 && Math.abs(idx - newIndex) === 1) {
            el.classList.remove("active");
            el.classList.add("near-active");
          } else {
            el.classList.remove("active");
            el.classList.remove("near-active");
          }
        });
      });
    }
  }

  increaseFontSize() {
    this.fontSize = Math.min(2.4, this.fontSize + 0.15);
    if (this.containerEl) {
      const wrap = this.containerEl.querySelector(".lyrics-container");
      if (wrap) wrap.style.fontSize = `${this.fontSize}rem`;
    }
  }

  decreaseFontSize() {
    this.fontSize = Math.max(1.0, this.fontSize - 0.15);
    if (this.containerEl) {
      const wrap = this.containerEl.querySelector(".lyrics-container");
      if (wrap) wrap.style.fontSize = `${this.fontSize}rem`;
    }
  }
}

export const lyricsService = new LyricsService();
