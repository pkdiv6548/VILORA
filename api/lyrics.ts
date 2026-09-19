// Vercel Serverless Function / Local Dev API: /api/lyrics
// Fetches authentic synchronized lyrics in the song's original language (Devanagari, Gurmukhi, English, etc.)

interface LyricsRecord {
  id?: number;
  name?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

function cleanTitle(raw: string): string {
  if (!raw) return "";
  let clean = raw
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  // Strip file extensions
  clean = clean.replace(/\.(mp3|m4a|flac|wav|aac|ogg|wma|weba|opus|alac)$/i, "");

  // Replace underscores and inter-word dots with space
  clean = clean.replace(/([a-zA-Z0-9])_([a-zA-Z0-9])/g, "$1 $2").replace(/_/g, " ");
  clean = clean.replace(/([a-zA-Z])\.([a-zA-Z])/g, "$1 $2");

  // Remove channel/label watermarks
  clean = clean.replace(/\|\s*(?:T-Series|Zee Music Company|Sony Music India|YRF|Tips Official|Speed Records|Saregama|Geet MP3|White Hill Music)[^|]*/gi, "");

  // Strip pipe endings
  clean = clean.replace(/\|.*$/, "");

  // Remove website domains & download portals
  clean = clean.replace(/[\(\[\{]?(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9_\-]+\.(?:com|in|net|org|co|info|biz|cc|xyz|top|site|me|pw)[\)\]\}]?/gi, "");
  clean = clean.replace(/[\(\[]?(?:koshalworld|pagalworld|pagalfree|djpunjab|mp3tau|pendujatt|webmusic|songs\.pk|songspk|bolly4u|djmaza|naasongs|masstamilan|sensongs|mp3mad|raagsong|jattmate|mrjatt|saregama)[^\)\]\s]*[\)\]]?/gi, "");

  // Remove bitrates anywhere (e.g. "128 Kbps", "320kbps", "192 kbps")
  clean = clean.replace(/[\(\[]?\b(?:320|256|192|160|128|96|64|48|32)\s*kbps\b[\)\]]?/gi, "");
  clean = clean.replace(/[\(\[]?\b\d{2,3}\s*kbps\b[\)\]]?/gi, "");
  clean = clean.replace(/[\(\[]?\bkbps\b[\)\]]?/gi, "");
  clean = clean.replace(/[\(\[]?\b(?:vbr|cbr)\b[\)\]]?/gi, "");

  // Remove tags like (Official Video), [Lyrical], (Full Song), (4K 60fps), etc.
  clean = clean.replace(/[\(\[]?\b(?:remastered|remaster|hq|hd|uhd|4k|flac|audio|official|lyrical|lyric\s*video|official\s*video|official\s*music\s*video|music\s*video|video\s*song|video|full\s*song|full\s*audio|full\s*video|slowed\s*reverb|slowed\s*\+\s*reverb|slowed|reverb|original|jhankar|dolby|atmos|unplugged|acoustic|cover|instrumental)\b[\)\]]?/gi, "");

  // Remove leading track numbers
  clean = clean.replace(/^(?:track\s*)?\d+[\s\.\-_]+/i, "");
  clean = clean.replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, "");
  return clean.replace(/^[\-_—~:\s]+|[\-_—~:\s]+$/g, "").replace(/\s{2,}/g, " ").trim();
}

function cleanArtist(raw: string): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  if (
    lower.includes("local artist") ||
    lower.includes("unknown") ||
    lower.includes("various") ||
    lower === "artist" ||
    lower === "t-series" ||
    lower.includes("vevo") ||
    lower.includes("zee music") ||
    lower.includes("speed records")
  ) {
    return "";
  }
  return raw.replace(/feat\..*/i, "").replace(/ft\..*/i, "").split(",")[0].trim();
}

function detectScriptAndLanguage(text: string, titleHint = "", artistHint = ""): { name: string; code: string; flag: string; label: string } {
  const combined = `${text} ${titleHint} ${artistHint}`.toLowerCase();

  // Devanagari script (Hindi, Sanskrit, Marathi)
  if (/[\u0900-\u097F]/.test(text) || /[\u0900-\u097F]/.test(titleHint)) {
    return { name: "Hindi", code: "hi", flag: "🇮🇳", label: "हिंदी (Hindi)" };
  }

  // Gurmukhi script (Punjabi)
  if (/[\u0A00-\u0A7F]/.test(text) || /[\u0A00-\u0A7F]/.test(titleHint)) {
    return { name: "Punjabi", code: "pa", flag: "🇮🇳", label: "ਪੰਜਾਬੀ (Punjabi)" };
  }

  // Japanese
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
    return { name: "Japanese", code: "ja", flag: "🇯🇵", label: "日本語 (Japanese)" };
  }

  // Korean
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) {
    return { name: "Korean", code: "ko", flag: "🇰🇷", label: "한국어 (Korean)" };
  }

  // Arabic / Urdu
  if (/[\u0600-\u06FF]/.test(text)) {
    return { name: "Urdu", code: "ur", flag: "🇵🇰", label: "اردو (Urdu)" };
  }

  // Hindi indicators in Roman script
  if (
    /\b(tere|meri|mera|tujhe|hum|tum|dil|ishq|pyar|pyaar|zindagi|saath|chahunga|duniya|mohabbat|kahaani|kabhi|aankhein|jaana|sanam|suno|bana|deewana|intezaar)\b/i.test(combined)
  ) {
    return { name: "Hindi", code: "hi", flag: "🇮🇳", label: "हिंदी / Hinglish" };
  }

  // Punjabi indicators in Roman script
  if (
    /\b(kudi|munda|akhan|ve|sohni|gallan|yaara|tere|vich|nach|pind|jatt|patiala|diljit|karan|aujla|shae|gill|pasoori|excuses)\b/i.test(combined)
  ) {
    return { name: "Punjabi", code: "pa", flag: "🇮🇳", label: "ਪੰਜਾਬੀ / Punjabi" };
  }

  // Spanish indicators
  if (/[ñáéíóú¿¡]/.test(text) || /\b(despacito|corazón|bailar|canción|hermosa|amor|noche|vida)\b/i.test(combined)) {
    return { name: "Spanish", code: "es", flag: "🇪🇸", label: "Español (Spanish)" };
  }

  // French indicators
  if (/[éèêëàâîïôûùçœ]/.test(text) || /\b(champs-élysées|bonjour|monde|avec|dans|cœur|amour)\b/i.test(combined)) {
    return { name: "French", code: "fr", flag: "🇫🇷", label: "Français (French)" };
  }

  return { name: "English", code: "en", flag: "🇺🇸", label: "English" };
}

async function queryLrcLib(url: string): Promise<LyricsRecord[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      headers: { "LrcLib-Client": "HiFiMusicPlayer (web)" },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") return [data];
    return [];
  } catch (e) {
    return [];
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const rawTitle = (req.query?.track || req.query?.q || req.query?.title || "").trim();
  const rawArtist = (req.query?.artist || "").trim();
  const duration = parseInt(req.query?.duration || "0", 10);

  if (!rawTitle) {
    return res.status(400).json({ error: "Track title or query is required" });
  }

  const cleanedTitle = cleanTitle(rawTitle);
  const cleanedArtist = cleanArtist(rawArtist);

  // Generate multi-permutation query candidates
  const queriesToTry: string[] = [];

  // Query 1: Cleaned Title + Cleaned Artist
  if (cleanedTitle && cleanedArtist) {
    queriesToTry.push(`${cleanedTitle} ${cleanedArtist}`);
  }

  // Query 2: Cleaned Title alone
  if (cleanedTitle) {
    queriesToTry.push(cleanedTitle);
  }

  // Query 3: If raw title contains ' - ' (e.g. "Tu Hai Kahan - AUR" or "Arijit Singh - Kesariya")
  if (rawTitle.includes("-")) {
    const parts = rawTitle.split("-").map(p => cleanTitle(p)).filter(Boolean);
    if (parts.length >= 2) {
      queriesToTry.push(parts[0]); // e.g. "Tu Hai Kahan"
      queriesToTry.push(parts[1]); // e.g. "Kesariya"
      queriesToTry.push(`${parts[0]} ${parts[1]}`);
    }
  }

  // Query 4: If raw title contains '|' (e.g. "Kesariya | Brahmastra")
  if (rawTitle.includes("|")) {
    const beforePipe = cleanTitle(rawTitle.split("|")[0]);
    if (beforePipe && !queriesToTry.includes(beforePipe)) {
      queriesToTry.push(beforePipe);
    }
  }

  // Query 5: Fallback to rawTitle without parentheses
  const strippedParens = cleanTitle(rawTitle.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, ""));
  if (strippedParens && !queriesToTry.includes(strippedParens)) {
    queriesToTry.push(strippedParens);
  }

  // Query 6: If cleanedTitle has 3 or more words (e.g. "Tere Liye Prince" -> "Tere Liye")
  const titleWords = cleanedTitle.split(/\s+/).filter(Boolean);
  if (titleWords.length >= 3) {
    const firstTwo = titleWords.slice(0, 2).join(" ");
    if (firstTwo && !queriesToTry.includes(firstTwo)) {
      queriesToTry.push(firstTwo);
    }
    const dropLast = titleWords.slice(0, -1).join(" ");
    if (dropLast && !queriesToTry.includes(dropLast)) {
      queriesToTry.push(dropLast);
    }
  }

  // Collect records from LRCLIB
  const allCandidates: LyricsRecord[] = [];
  const seenIds = new Set<number>();

  // If exact artist & title available, try get endpoint first
  if (cleanedArtist && cleanedTitle) {
    let getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanedArtist)}&track_name=${encodeURIComponent(cleanedTitle)}`;
    if (duration > 0) getUrl += `&duration=${duration}`;
    const exact = await queryLrcLib(getUrl);
    for (const r of exact) {
      if (r && (r.syncedLyrics || r.plainLyrics)) {
        allCandidates.push(r);
        if (r.id) seenIds.add(r.id);
      }
    }
  }

  // Search queries in order of specificity
  for (const q of queriesToTry.slice(0, 3)) {
    if (allCandidates.some(c => c.syncedLyrics)) break; // found synced lyrics already
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
    const results = await queryLrcLib(searchUrl);
    for (const r of results) {
      if (r && (r.syncedLyrics || r.plainLyrics) && r.id && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        allCandidates.push(r);
      }
    }
  }

  if (allCandidates.length === 0) {
    return res.status(200).json({
      found: false,
      message: "No synchronized lyrics found for this track",
      track: cleanedTitle,
      artist: cleanedArtist
    });
  }

  // Determine language expectation from song hints
  const expectedLang = detectScriptAndLanguage("", cleanedTitle, cleanedArtist);

  // Score candidate records
  let bestRecord: LyricsRecord | null = null;
  let bestScore = -1;

  for (const c of allCandidates) {
    const text = c.syncedLyrics || c.plainLyrics || "";
    if (!text.trim()) continue;

    let score = 0;
    // Synced lyrics are high priority
    if (c.syncedLyrics) score += 60;

    // Native Devanagari script for Hindi songs
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    if (expectedLang.name === "Hindi") {
      if (hasDevanagari) score += 80;
    }

    // Native Gurmukhi script for Punjabi songs
    const hasGurmukhi = /[\u0A00-\u0A7F]/.test(text);
    if (expectedLang.name === "Punjabi") {
      if (hasGurmukhi) score += 80;
    }

    // Title match
    if (c.trackName && cleanedTitle) {
      const cTitle = c.trackName.toLowerCase().trim();
      const sTitle = cleanedTitle.toLowerCase().trim();
      if (cTitle === sTitle) score += 40;
      else if (sTitle.includes(cTitle) || cTitle.includes(sTitle)) score += 20;
    }

    // Artist match
    if (c.artistName && cleanedArtist) {
      const cArt = c.artistName.toLowerCase().trim();
      const sArt = cleanedArtist.toLowerCase().trim();
      if (cArt.includes(sArt) || sArt.includes(cArt)) score += 30;
    }

    // Duration match
    if (duration > 0 && c.duration) {
      const diff = Math.abs(c.duration - duration);
      if (diff < 15) score += 25;
      else if (diff < 35) score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRecord = c;
    }
  }

  if (!bestRecord || (!bestRecord.syncedLyrics && !bestRecord.plainLyrics)) {
    return res.status(200).json({
      found: false,
      message: "No suitable lyrics found for this track",
      track: cleanedTitle,
      artist: cleanedArtist
    });
  }

  const sampleText = (bestRecord.syncedLyrics || bestRecord.plainLyrics || "").slice(0, 1000);
  const detectedLang = detectScriptAndLanguage(sampleText, cleanedTitle, cleanedArtist);

  return res.status(200).json({
    found: true,
    id: bestRecord.id,
    trackName: bestRecord.trackName || cleanedTitle,
    artistName: bestRecord.artistName || cleanedArtist,
    albumName: bestRecord.albumName || "",
    duration: bestRecord.duration,
    language: detectedLang.name,
    code: detectedLang.code,
    flag: detectedLang.flag,
    nativeScript: detectedLang.label,
    hasSynced: Boolean(bestRecord.syncedLyrics),
    syncedLyrics: bestRecord.syncedLyrics || null,
    plainLyrics: bestRecord.plainLyrics || null,
    source: `LRCLIB: ${bestRecord.trackName} — ${bestRecord.artistName}`
  });
}
