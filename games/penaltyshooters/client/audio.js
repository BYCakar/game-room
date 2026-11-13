import { isMuted } from '/js/sounds.js';

const FILES = {
  kick: ['ball_kick.webm', 0.65],
  // The original also plays ball_kick when the ball touches the keeper.
  impact: ['ball_kick.webm', 0.5],
  post: ['post.webm', 0.65],
  miss: ['near_miss.webm', 0.4],
  goal: ['crowd_middle_goal.webm', 0.45],
  crowd: ['tier-3-atmosfera-aud-180823.webm', 0.09],
};

// Share the site's mute switch. Recordings only start after an interaction,
// and rejected play promises never interrupt a match or queue stale effects.
export function createAudio() {
  let disposed = false;
  let unlocked = false;
  let active = true;
  let lastMuted = isMuted();
  const recordings = new Map(Object.entries(FILES).map(([name, [file, volume]]) => {
    const audio = new Audio(new URL(`./assets/${file}`, import.meta.url).href);
    audio.preload = 'auto';
    audio.volume = volume;
    audio.loop = name === 'crowd';
    return [name, audio];
  }));
  const crowd = recordings.get('crowd');
  function stop(audio, rewind = false) {
    audio.pause();
    if (rewind) { try { audio.currentTime = 0; } catch {} }
  }
  function start(audio) {
    if (disposed || !unlocked || isMuted()) return;
    audio.play()?.catch(() => {});
  }
  function sync() {
    if (disposed) return;
    const muted = isMuted();
    if (muted) {
      if (!lastMuted) for (const audio of recordings.values()) stop(audio, true);
    } else if (active && unlocked && (lastMuted || crowd.paused)) start(crowd);
    if (!active) stop(crowd);
    lastMuted = muted;
  }
  function interaction(event) {
    if (!event.isTrusted) return;
    unlocked = true;
    sync();
  }
  window.addEventListener('pointerdown', interaction);
  window.addEventListener('keydown', interaction);
  // The site's click handler changes its mute flag before this bubbles here.
  window.addEventListener('click', sync);
  // Also cover a setting changed programmatically, without adding a new
  // platform event contract just for this game.
  const timer = setInterval(sync, 150);
  return {
    play(name) {
      const audio = recordings.get(name);
      if (!audio || disposed || !unlocked || isMuted()) return;
      stop(audio, true);
      start(audio);
    },
    update(snapshot) { active = !snapshot.over && !snapshot.paused; sync(); },
    destroy() {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('pointerdown', interaction);
      window.removeEventListener('keydown', interaction);
      window.removeEventListener('click', sync);
      for (const audio of recordings.values()) { stop(audio, true); audio.removeAttribute('src'); audio.load(); }
      recordings.clear();
    },
  };
}
