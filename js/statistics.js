import { state } from "./state.js";

export class StatisticsService {
  getOverview() {
    let totalPlays = 0;
    let totalSeconds = 0;
    const artistPlayMap = {};
    const genrePlayMap = {};

    state.songs.forEach(song => {
      const count = song.playCount || 0;
      totalPlays += count;
      totalSeconds += count * (song.duration || 180);

      if (count > 0) {
        artistPlayMap[song.artist] = (artistPlayMap[song.artist] || 0) + count;
        genrePlayMap[song.genre] = (genrePlayMap[song.genre] || 0) + count;
      }
    });

    const topArtists = Object.entries(artistPlayMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topGenres = Object.entries(genrePlayMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topSongs = [...state.songs]
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 5);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return {
      totalPlays,
      listeningTimeFormatted: `${hours}h ${minutes}m`,
      topArtists,
      topGenres,
      topSongs,
      currentStreak: 12, // days
      completionRate: "94%"
    };
  }

  getWeeklyActivity() {
    return [
      { day: "Mon", minutes: 45 },
      { day: "Tue", minutes: 80 },
      { day: "Wed", minutes: 120 },
      { day: "Thu", minutes: 95 },
      { day: "Fri", minutes: 160 },
      { day: "Sat", minutes: 210 },
      { day: "Sun", minutes: 140 }
    ];
  }
}

export const statisticsService = new StatisticsService();
