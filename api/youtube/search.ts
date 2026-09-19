// Vercel Serverless Function: /api/youtube/search
// Proxies queries securely to YouTube Data API v3 without exposing API keys to the client.

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    thumbnails?: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
    publishTime?: string;
  };
}

function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");
}

export default async function handler(req: any, res: any) {
  // Support CORS for client-side fetches
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const query = (req.query?.q || "").trim();
  const pageToken = (req.query?.pageToken || "").trim();
  const maxResults = Math.min(parseInt(req.query?.maxResults || "15", 10), 30);

  if (!query) {
    return res.status(400).json({
      error: "Query parameter 'q' is required",
      items: []
    });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey && apiKey !== "YOUR_YOUTUBE_API_KEY") {
    try {
      const ytUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      ytUrl.searchParams.set("part", "snippet");
      ytUrl.searchParams.set("type", "video");
      ytUrl.searchParams.set("videoEmbeddable", "true"); // Ensures only videos that allow embedded playback are returned
      ytUrl.searchParams.set("maxResults", String(maxResults));
      ytUrl.searchParams.set("q", query);
      ytUrl.searchParams.set("key", apiKey);
      if (pageToken) {
        ytUrl.searchParams.set("pageToken", pageToken);
      }

      const response = await fetch(ytUrl.toString());
      const data = await response.json();

      if (response.ok && data.items) {
        const items = data.items
          .filter((item: YouTubeSearchItem) => item.id && item.id.videoId)
          .map((item: YouTubeSearchItem) => {
            const videoId = item.id.videoId;
            const rawTitle = decodeHtmlEntities(item.snippet.title);
            const rawChannel = decodeHtmlEntities(item.snippet.channelTitle);

            let parsedTitle = rawTitle;
            let parsedArtist = rawChannel;

            // Intelligent extraction for "Artist - Title" pattern common in music videos
            if (rawTitle.includes(" - ")) {
              const parts = rawTitle.split(" - ");
              if (parts.length >= 2) {
                const p0 = parts[0].trim();
                const p1 = parts.slice(1).join(" - ").trim();
                // Check if p0 looks like artist name vs title
                if (!p0.toLowerCase().includes("official") && !p0.toLowerCase().includes("video") && !p0.toLowerCase().includes("lyrics")) {
                  parsedArtist = p0;
                  parsedTitle = p1;
                } else {
                  parsedTitle = p0;
                  parsedArtist = p1;
                }
              }
            } else if (rawTitle.includes(" | ")) {
              const parts = rawTitle.split(" | ");
              parsedTitle = parts[0].trim();
              if (parts.length > 1 && !parts[1].toLowerCase().includes("official")) {
                parsedArtist = parts[1].trim();
              }
            }

            // Strip typical YouTube tags from title
            parsedTitle = parsedTitle
              .replace(/[\(\[][^\)\]]*(?:official|video|audio|lyric|lyrics|full song|hd|4k|remastered|teaser|promo|exclusive|jhankar)[^\)\]]*[\)\]]/gi, "")
              .replace(/\|\s*.*$/, "")
              .trim() || rawTitle;

            // Clean channel name if used as artist
            parsedArtist = parsedArtist
              .replace(/(?:VEVO|Official|Music|Records|Channel|Entertainment)$/i, "")
              .trim() || rawChannel;

            const artwork =
              item.snippet.thumbnails?.high?.url ||
              item.snippet.thumbnails?.medium?.url ||
              item.snippet.thumbnails?.default?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            return {
              id: `youtube:${videoId}`,
              youtubeId: videoId,
              source: "youtube",
              title: parsedTitle,
              artist: parsedArtist,
              album: `${rawChannel} • YouTube Music`,
              genre: "YouTube",
              duration: 215, // Dynamic placeholder until player probes duration
              artwork,
              format: "HD AUDIO",
              bitrate: "320 kbps",
              addedDate: item.snippet.publishTime ? item.snippet.publishTime.split("T")[0] : new Date().toISOString().split("T")[0]
            };
          });

        return res.status(200).json({
          items,
          nextPageToken: data.nextPageToken || null,
          totalResults: data.pageInfo?.totalResults || items.length,
          source: "youtube-api"
        });
      } else {
        console.warn("YouTube API error response:", data);
      }
    } catch (err) {
      console.error("YouTube API request failed:", err);
    }
  }

  // Live direct fallback: fetch search results from YouTube search page
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const ytRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (ytRes.ok) {
      const html = await ytRes.text();
      const items: any[] = [];
      const seenIds = new Set<string>();

      // Match videoRenderer entries in ytInitialData JSON
      const regex = /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"/g;
      let match;
      while ((match = regex.exec(html)) !== null && items.length < maxResults) {
        const videoId = match[1];
        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);

        let parsedTitle = decodeHtmlEntities(match[2]);
        let parsedArtist = "";

        // Attempt to extract channel name
        const channelMatch = html.slice(match.index, match.index + 800).match(/"ownerText":\{"runs":\[\{"text":"([^"]+)"/);
        if (channelMatch) {
          parsedArtist = decodeHtmlEntities(channelMatch[1]);
        }

        if (!parsedArtist && parsedTitle.includes(" - ")) {
          const parts = parsedTitle.split(" - ");
          parsedArtist = parts[0].trim();
          parsedTitle = parts.slice(1).join(" - ").trim();
        }

        parsedTitle = parsedTitle
          .replace(/[\(\[][^\)\]]*(?:official|video|audio|lyric|lyrics|full song|hd|4k|remastered)[^\)\]]*[\)\]]/gi, "")
          .trim() || decodeHtmlEntities(match[2]);

        items.push({
          id: `youtube:${videoId}`,
          youtubeId: videoId,
          source: "youtube",
          title: parsedTitle,
          artist: parsedArtist || "Official Video",
          album: "YouTube Music Video",
          genre: "Music Video",
          duration: 215,
          artwork: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          format: "HD VIDEO",
          bitrate: "1080p",
          addedDate: new Date().toISOString().split("T")[0]
        });
      }

      // If videoRenderer parsing didn't find enough, search for generic videoIds
      if (items.length === 0) {
        const vidMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
        for (const m of vidMatches) {
          const videoId = m[1];
          if (!seenIds.has(videoId) && items.length < maxResults) {
            seenIds.add(videoId);
            items.push({
              id: `youtube:${videoId}`,
              youtubeId: videoId,
              source: "youtube",
              title: query,
              artist: "Official Music Video",
              album: "YouTube",
              genre: "Music Video",
              duration: 220,
              artwork: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              format: "HD VIDEO",
              bitrate: "1080p",
              addedDate: new Date().toISOString().split("T")[0]
            });
          }
        }
      }

      if (items.length > 0) {
        return res.status(200).json({
          items,
          nextPageToken: null,
          totalResults: items.length,
          source: "youtube-web-direct"
        });
      }
    }
  } catch (directErr) {
    console.warn("Direct YouTube search fallback error:", directErr);
  }

  // Graceful curated fallback for when network fails or query is offline
  const qLower = query.toLowerCase();
  const curatedCatalog = [
    {
      id: "youtube:dQw4w9WgXcQ",
      youtubeId: "dQw4w9WgXcQ",
      source: "youtube",
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      album: "Whenever You Need Somebody",
      genre: "Pop / 80s",
      duration: 213,
      artwork: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      format: "STREAM"
    },
    {
      id: "youtube:kJQP7kiw5Fk",
      youtubeId: "kJQP7kiw5Fk",
      source: "youtube",
      title: "Despacito",
      artist: "Luis Fonsi ft. Daddy Yankee",
      album: "Vida",
      genre: "Latin Pop",
      duration: 281,
      artwork: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
      format: "STREAM"
    },
    {
      id: "youtube:fJ9rUzIMcZQ",
      youtubeId: "fJ9rUzIMcZQ",
      source: "youtube",
      title: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      genre: "Rock",
      duration: 359,
      artwork: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
      format: "STREAM"
    },
    {
      id: "youtube:JGwWNGJdvx8",
      youtubeId: "JGwWNGJdvx8",
      source: "youtube",
      title: "Shape of You",
      artist: "Ed Sheeran",
      album: "Divide",
      genre: "Pop",
      duration: 233,
      artwork: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
      format: "STREAM"
    },
    {
      id: "youtube:OPf0YbXqDm0",
      youtubeId: "OPf0YbXqDm0",
      source: "youtube",
      title: "Uptown Funk",
      artist: "Mark Ronson ft. Bruno Mars",
      album: "Uptown Special",
      genre: "Funk / Pop",
      duration: 270,
      artwork: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg",
      format: "STREAM"
    },
    {
      id: "youtube:hT_nvWreIhg",
      youtubeId: "hT_nvWreIhg",
      source: "youtube",
      title: "Counting Stars",
      artist: "OneRepublic",
      album: "Native",
      genre: "Pop Rock",
      duration: 283,
      artwork: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg",
      format: "STREAM"
    },
    {
      id: "youtube:4NRXx6U8ABQ",
      youtubeId: "4NRXx6U8ABQ",
      source: "youtube",
      title: "Blinding Lights",
      artist: "The Weeknd",
      album: "After Hours",
      genre: "Synthwave / Pop",
      duration: 200,
      artwork: "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg",
      format: "STREAM"
    },
    {
      id: "youtube:Umqb9KENgmk",
      youtubeId: "Umqb9KENgmk",
      source: "youtube",
      title: "Tum Hi Ho (Official Aashiqui 2)",
      artist: "Arijit Singh",
      album: "Aashiqui 2",
      genre: "Bollywood / Hindi",
      duration: 262,
      artwork: "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg",
      format: "STREAM"
    },
    {
      id: "youtube:BddP6PYo2gs",
      youtubeId: "BddP6PYo2gs",
      source: "youtube",
      title: "Kesariya (Brahmāstra)",
      artist: "Arijit Singh, Pritam",
      album: "Brahmāstra",
      genre: "Bollywood / Hindi",
      duration: 268,
      artwork: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg",
      format: "STREAM"
    },
    {
      id: "youtube:2Vv-BfVoq4g",
      youtubeId: "2Vv-BfVoq4g",
      source: "youtube",
      title: "Perfect",
      artist: "Ed Sheeran",
      album: "Divide",
      genre: "Pop / Acoustic",
      duration: 263,
      artwork: "https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg",
      format: "STREAM"
    }
  ];

  const filtered = curatedCatalog.filter(
    (t) =>
      t.title.toLowerCase().includes(qLower) ||
      t.artist.toLowerCase().includes(qLower) ||
      t.genre.toLowerCase().includes(qLower) ||
      t.album.toLowerCase().includes(qLower)
  );

  const finalItems = filtered.length > 0 ? filtered : curatedCatalog;

  return res.status(200).json({
    items: finalItems,
    nextPageToken: null,
    totalResults: finalItems.length,
    isCuratedFallback: true,
    message: apiKey
      ? "YouTube Data API quota reached or request restricted. Showing curated music discovery."
      : "YouTube API Key not configured. Add YOUTUBE_API_KEY in environment to enable live search."
  });
}
