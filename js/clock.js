// Clock Module: High-precision client-side live clock with ticker subscription
export class LiveClock {
  constructor() {
    this.listeners = new Set();
    this.timerId = null;
    this.start();
  }

  start() {
    if (this.timerId) return;
    // Tick immediately and then every second
    this.tick();
    this.timerId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    // Call once immediately with current time
    callback(this.getTimeData());
    return () => this.listeners.delete(callback);
  }

  tick() {
    const data = this.getTimeData();
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (e) {
        console.warn("Clock listener error:", e);
      }
    }
  }

  getTimeData() {
    const now = new Date();
    const hours24 = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // 12-hour calculation
    const ampm = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    const padMin = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const padSec = seconds < 10 ? `0${seconds}` : `${seconds}`;
    const padHour24 = hours24 < 10 ? `0${hours24}` : `${hours24}`;

    // Day of week
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayOfWeek = days[now.getDay()];

    // Formatted date (e.g. 11 September 2026)
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const dayNum = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    const formattedDate = `${dayNum} ${monthName} ${year}`;
    const shortDate = `${dayNum} ${monthName.slice(0, 3)}`;

    // Contextual greeting
    let greeting = "Good Day";
    if (hours24 >= 5 && hours24 < 12) {
      greeting = "Good Morning";
    } else if (hours24 >= 12 && hours24 < 17) {
      greeting = "Good Afternoon";
    } else if (hours24 >= 17 && hours24 < 22) {
      greeting = "Good Evening";
    } else {
      greeting = "Good Night";
    }

    return {
      now,
      hours24,
      hours12,
      minutes,
      seconds,
      ampm,
      padMin,
      padSec,
      time12: `${hours12}:${padMin} ${ampm}`,
      time12WithSec: `${hours12}:${padMin}:${padSec} ${ampm}`,
      time24: `${padHour24}:${padMin}`,
      time24WithSec: `${padHour24}:${padMin}:${padSec}`,
      dayOfWeek,
      dayNum,
      monthName,
      year,
      formattedDate,
      shortDate,
      greeting
    };
  }

  // Format sunrise / sunset ISO time string into clean local 12h or 24h
  formatSunTime(isoString, is24h = false) {
    if (!isoString) return "--:--";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "--:--";
      const h24 = date.getHours();
      const m = date.getMinutes();
      const padM = m < 10 ? `0${m}` : `${m}`;
      if (is24h) {
        const padH = h24 < 10 ? `0${h24}` : `${h24}`;
        return `${padH}:${padM}`;
      }
      const ampm = h24 >= 12 ? "PM" : "AM";
      const h12 = h24 % 12 || 12;
      return `${h12}:${padM} ${ampm}`;
    } catch (e) {
      return "--:--";
    }
  }
}

export const liveClock = new LiveClock();
