// in the beginning.... god made mrrprpmnaynayaynaynayanyuwuuuwmauwnwanwaumawp :p
var _yt_player = videojs;

var versionclient = "youtube.player.web_20250917_22_RC00"

 /**
 * @license
 * Video.js 8.x <http://videojs.com/>
 * Copyright Brightcove, Inc. <https://www.brightcove.com/>
 * Available under Apache License Version 2.0
 * <https://github.com/videojs/video.js/blob/main/LICENSE>
 *
 * Includes vtt.js <https://github.com/mozilla/vtt.js>
 * Available under Apache License Version 2.0
 * <https://github.com/mozilla/vtt.js/blob/main/LICENSE>
 */ 
 
document.addEventListener("DOMContentLoaded", () => {
  const player = videojs("video", {
    controls: true,
    autoplay: false,
    preload: "auto",
    errorDisplay: false
  });

  const qs = new URLSearchParams(window.location.search);
  const qua = qs.get("quality") || "";
  const vidKey = qs.get("v") || "";
  const videoEl = document.getElementById("video");
  const audioEl = document.getElementById("aud");

  try {
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("webkit-playsinline", "");
  } catch {}

  function getPlayableVideoEl() {
    try {
      if (videoEl && typeof videoEl.play === "function") return videoEl;
    } catch {}
    try {
      const inner = player?.el?.()?.querySelector?.("video");
      if (inner && typeof inner.play === "function") return inner;
    } catch {}
    return null;
  }

  function getVideoNode() {
    return getPlayableVideoEl() || videoEl;
  }

  function getVideoPaused() {
    try {
      if (typeof player.paused === "function") return !!player.paused();
    } catch {}
    try {
      return !!getVideoNode().paused;
    } catch {}
    return true;
  }

  function getVideoCurrentTime() {
    try {
      const t = Number(player.currentTime());
      if (Number.isFinite(t)) return t;
    } catch {}
    try {
      const t = Number(getVideoNode().currentTime);
      if (Number.isFinite(t)) return t;
    } catch {}
    return 0;
  }

  function getVideoReadyState() {
    try {
      return Number(getVideoNode().readyState || 0);
    } catch {}
    return 0;
  }

  function pickAudioSrc() {
    const direct = audioEl?.getAttribute?.("src");
    if (direct) return direct;
    const source = audioEl?.querySelector?.("source");
    if (source?.getAttribute?.("src")) return source.getAttribute("src");
    if (audioEl?.currentSrc) return audioEl.currentSrc;
    return "";
  }

  const coupledMode = !!audioEl && audioEl.tagName === "AUDIO" && !!pickAudioSrc() && qua !== "medium";

  try {
    videoEl.loop = false;
    videoEl.removeAttribute?.("loop");
  } catch {}

  try {
    if (audioEl) {
      audioEl.loop = false;
      audioEl.removeAttribute?.("loop");
    }
  } catch {}

  function isLoopDesired() {
    return !!videoEl?.loop ||
      !!videoEl?.hasAttribute?.("loop") ||
      qs.get("loop") === "1" ||
      qs.get("loop") === "true" ||
      window.forceLoop === true;
  }

  function wantsAutoplay() {
    try {
      const q = (qs.get("autoplay") || "").toLowerCase();
      if (q === "1" || q === "true" || q === "yes") return true;
    } catch {}
    try {
      if (window.forceAutoplay === true) return true;
    } catch {}
    try {
      if (videoEl?.autoplay || videoEl?.hasAttribute?.("autoplay")) return true;
    } catch {}
    try {
      const ap = player.autoplay?.();
      if (ap === true || ap === "play" || ap === "muted" || ap === "any") return true;
    } catch {}
    return false;
  }

  const state = {
    intendedPlaying: false,
    userPaused: false,
    autoplayWanted: wantsAutoplay(),
    startupDone: !coupledMode,
    startupRetryCount: 0,
    startupRetryTimer: null,
    waitingResumeTimer: null,
    syncTimer: null,
    syncing: false,
    seeking: false,
    restarting: false,
    videoWaiting: false,
    audioWaiting: false,
    wasPlayingBeforeSeek: false,
    pendingPlayAfterSeek: false,
    hiddenAt: 0,
    shouldResumeOnVisible: false,
    lastKnownGoodTime: 0,
    lastVolume: 1,
    userMutedVideo: false,
    userMutedAudio: false,
    mediaSessionSerial: 0,
    suppress: {
      videoPlayUntil: 0,
      videoPauseUntil: 0,
      audioPlayUntil: 0,
      audioPauseUntil: 0
    }
  };

  const HAVE_CURRENT_DATA = 2;
  const HAVE_FUTURE_DATA = 3;
  const STARTUP_AHEAD = 0.7;
  const RUN_AHEAD = 0.18;
  const SOFT_SYNC_DRIFT = 0.08;
  const HARD_SYNC_DRIFT = 0.22;
  const AUDIO_RATE_NUDGE = 0.02;
  const SHORT_FADE_MS = 40;
  const NORMAL_FADE_MS = 120;
  const VISIBILITY_CATCHUP_DRIFT = 0.12;

  function now() {
    return performance.now();
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, Number(n)));
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function markSuppressed(kind, ms) {
    state.suppress[kind] = now() + ms;
  }

  function isSuppressed(kind) {
    return now() < (state.suppress[kind] || 0);
  }

  function safeSetVideoTime(t) {
    if (!Number.isFinite(t) || t < 0) return;
    try { player.currentTime(t); } catch {}
    try { getVideoNode().currentTime = t; } catch {}
    try { videoEl.currentTime = t; } catch {}
  }

  function safeSetAudioTime(t) {
    if (!coupledMode || !audioEl || !Number.isFinite(t) || t < 0) return;
    try { audioEl.currentTime = t; } catch {}
  }

  function bufferedAhead(media, time) {
    try {
      const ranges = media?.buffered;
      if (!ranges || !Number.isFinite(time)) return 0;
      for (let i = 0; i < ranges.length; i += 1) {
        const start = ranges.start(i);
        const end = ranges.end(i);
        if (time >= start - 0.05 && time <= end + 0.05) return Math.max(0, end - time);
      }
    } catch {}
    return 0;
  }

  function canPlayAt(media, time, minAhead) {
    try {
      if (!media || !Number.isFinite(time)) return false;
      const readyState = Number(media.readyState || 0);
      if (readyState >= HAVE_FUTURE_DATA) return true;
      if (readyState >= HAVE_CURRENT_DATA && bufferedAhead(media, time) >= minAhead) return true;
      return bufferedAhead(media, time) >= minAhead;
    } catch {}
    return false;
  }

  function bothPlayable(time, startup = false) {
    if (!coupledMode || !audioEl) return true;
    const minAhead = startup ? STARTUP_AHEAD : RUN_AHEAD;
    return canPlayAt(getVideoNode(), time, minAhead) && canPlayAt(audioEl, time, minAhead);
  }

  function currentTargetVolume() {
    const playerVolume = clamp(typeof player.volume === "function" ? player.volume() : (videoEl?.volume ?? 1), 0, 1);
    const playerMuted = !!(typeof player.muted === "function" ? player.muted() : videoEl?.muted);
    state.lastVolume = playerVolume;
    return playerMuted || state.userMutedVideo || state.userMutedAudio ? 0 : playerVolume;
  }

  function createSmoothGainController(media) {
    if (!media) {
      return {
        enabled: false,
        ensureReady: async () => false,
        rampTo: async () => {},
        setImmediate: () => {},
        syncToPlayerVolume: async () => {},
        isReady: () => false
      };
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    let context = null;
    let source = null;
    let gainNode = null;
    let rafId = 0;
    let usingWebAudio = false;

    function cancelElementRamp() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function tryInitGraph() {
      if (!AudioContextCtor || context) return usingWebAudio;
      try {
        context = new AudioContextCtor();
        source = context.createMediaElementSource(media);
        gainNode = context.createGain();
        gainNode.gain.value = clamp(media.volume ?? 1, 0, 1);
        source.connect(gainNode);
        gainNode.connect(context.destination);
        try { media.volume = 1; } catch {}
        usingWebAudio = true;
      } catch {
        context = null;
        source = null;
        gainNode = null;
        usingWebAudio = false;
      }
      return usingWebAudio;
    }

    async function ensureReady() {
      tryInitGraph();
      if (!context) return false;
      if (context.state === "running") return true;
      try {
        await context.resume();
      } catch {}
      return context.state === "running";
    }

    function setImmediate(value) {
      const v = clamp(value, 0, 1);
      cancelElementRamp();
      if (usingWebAudio && context && gainNode) {
        try {
          const t = context.currentTime;
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(v, t);
          return;
        } catch {}
      }
      try { media.volume = v; } catch {}
    }

    async function rampTo(value, durationMs = NORMAL_FADE_MS) {
      const v = clamp(value, 0, 1);
      cancelElementRamp();
      if (usingWebAudio && context && gainNode) {
        try {
          await ensureReady();
          const t = context.currentTime;
          const from = gainNode.gain.value;
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(from, t);
          gainNode.gain.linearRampToValueAtTime(v, t + Math.max(0.005, durationMs / 1000));
          return;
        } catch {}
      }
      const from = clamp(media.volume ?? 1, 0, 1);
      if (durationMs <= 0 || Math.abs(from - v) < 0.001) {
        try { media.volume = v; } catch {}
        return;
      }
      const startedAt = performance.now();
      await new Promise(resolve => {
        const step = timestamp => {
          const progress = clamp((timestamp - startedAt) / durationMs, 0, 1);
          const eased = progress * progress * (3 - 2 * progress);
          const next = from + ((v - from) * eased);
          try { media.volume = clamp(next, 0, 1); } catch {}
          if (progress < 1) {
            rafId = requestAnimationFrame(step);
          } else {
            rafId = 0;
            resolve();
          }
        };
        rafId = requestAnimationFrame(step);
      });
    }

    async function syncToPlayerVolume(durationMs = NORMAL_FADE_MS) {
      await rampTo(currentTargetVolume(), durationMs);
    }

    return {
      enabled: true,
      ensureReady,
      rampTo,
      setImmediate,
      syncToPlayerVolume,
      isReady: () => usingWebAudio && !!context && context.state === "running"
    };
  }

  const audioGain = createSmoothGainController(coupledMode ? audioEl : null);

  async function syncAudioGain(duration = NORMAL_FADE_MS) {
    if (!coupledMode) return;
    await audioGain.syncToPlayerVolume(duration);
  }

  async function softenAudioForSeek() {
    if (!coupledMode) return;
    await audioGain.rampTo(0, SHORT_FADE_MS);
  }

  async function restoreAudioAfterSeek() {
    if (!coupledMode) return;
    if (!state.intendedPlaying || state.userPaused) return;
    await syncAudioGain(NORMAL_FADE_MS);
  }

  async function resumeAudioContextFromGesture() {
    if (!coupledMode) return;
    await audioGain.ensureReady();
    await syncAudioGain(80);
  }

  const unlockAudioContextOnce = async () => {
    await resumeAudioContextFromGesture();
  };

  try {
    document.addEventListener("pointerdown", unlockAudioContextOnce, { passive: true, capture: true });
    document.addEventListener("keydown", unlockAudioContextOnce, { passive: true, capture: true });
    document.addEventListener("touchstart", unlockAudioContextOnce, { passive: true, capture: true });
  } catch {}

  function updateLastKnownGoodTime() {
    const t = getVideoCurrentTime();
    if (Number.isFinite(t) && t > 0) state.lastKnownGoodTime = t;
  }

  async function pauseVideoSoft() {
    markSuppressed("videoPauseUntil", 400);
    try { player.pause(); } catch {}
    try { getVideoNode().pause(); } catch {}
  }

  async function pauseAudioSoft() {
    if (!coupledMode || !audioEl) return;
    markSuppressed("audioPauseUntil", 500);
    await audioGain.rampTo(0, SHORT_FADE_MS);
    try { audioEl.pause(); } catch {}
  }

  async function playVideoSoft(allowMutedFallback = false) {
    markSuppressed("videoPlayUntil", 500);
    let playPromise = null;
    try {
      playPromise = player.play();
    } catch {}
    if (!playPromise) {
      try {
        playPromise = getVideoNode().play();
      } catch {}
    }
    try {
      await Promise.resolve(playPromise);
      return true;
    } catch (error) {
      if (!allowMutedFallback) return false;
      try {
        player.muted(true);
      } catch {}
      try {
        getVideoNode().muted = true;
      } catch {}
      try {
        await Promise.resolve(player.play());
        return true;
      } catch {
        return false;
      }
    }
  }

  async function playAudioSoft() {
    if (!coupledMode || !audioEl) return true;
    markSuppressed("audioPlayUntil", 700);
    await audioGain.ensureReady();
    try {
      await audioGain.rampTo(0, 0);
      await Promise.resolve(audioEl.play());
      await syncAudioGain(NORMAL_FADE_MS);
      return true;
    } catch {
      return false;
    }
  }

  async function hardPauseAll() {
    state.intendedPlaying = false;
    state.pendingPlayAfterSeek = false;
    state.shouldResumeOnVisible = false;
    await pauseAudioSoft();
    await pauseVideoSoft();
    updateMediaSessionPlaybackState();
  }

  async function syncAudioToVideo(forceFade = false) {
    if (!coupledMode || !audioEl) return;
    const vt = getVideoCurrentTime();
    const at = Number(audioEl.currentTime || 0);
    if (!Number.isFinite(vt) || !Number.isFinite(at)) return;
    const drift = vt - at;
    const absDrift = Math.abs(drift);

    if (absDrift >= HARD_SYNC_DRIFT) {
      if (forceFade || !audioEl.paused) await softenAudioForSeek();
      safeSetAudioTime(vt);
      if (state.intendedPlaying && !getVideoPaused() && audioEl.paused) {
        await playAudioSoft();
      } else if (state.intendedPlaying && !audioEl.paused) {
        await restoreAudioAfterSeek();
      }
      try { audioEl.playbackRate = Number(player.playbackRate()) || 1; } catch {}
      return;
    }

    if (absDrift >= SOFT_SYNC_DRIFT) {
      const baseRate = Number(player.playbackRate()) || 1;
      const nudge = clamp(drift * 0.08, -AUDIO_RATE_NUDGE, AUDIO_RATE_NUDGE);
      try {
        audioEl.playbackRate = baseRate + nudge;
      } catch {}
      return;
    }

    try {
      audioEl.playbackRate = Number(player.playbackRate()) || 1;
    } catch {}
  }

  function clearWaitingResumeTimer() {
    if (state.waitingResumeTimer) {
      clearTimeout(state.waitingResumeTimer);
      state.waitingResumeTimer = null;
    }
  }

  function clearStartupRetryTimer() {
    if (state.startupRetryTimer) {
      clearTimeout(state.startupRetryTimer);
      state.startupRetryTimer = null;
    }
  }

  function clearSyncTimer() {
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      state.syncTimer = null;
    }
  }

  function scheduleSync(delay) {
    const nextDelay = typeof delay === "number"
      ? delay
      : state.intendedPlaying
        ? (state.videoWaiting || state.audioWaiting || state.seeking ? 90 : 180)
        : 500;

    clearSyncTimer();
    state.syncTimer = setTimeout(() => {
      state.syncTimer = null;
      runSync().catch(() => {
        scheduleSync(220);
      });
    }, nextDelay);
  }

  async function holdForBuffering() {
    if (!state.intendedPlaying || state.userPaused) return;
    const vt = getVideoCurrentTime();
    await pauseAudioSoft();
    safeSetAudioTime(vt);
    await pauseVideoSoft();
    clearWaitingResumeTimer();
    state.waitingResumeTimer = setTimeout(() => {
      state.waitingResumeTimer = null;
      if (state.intendedPlaying && !state.userPaused) {
        resumePlayback("buffer-end").catch(() => {});
      }
    }, 120);
  }

  async function resumePlayback(reason = "resume") {
    if (state.restarting || state.syncing) return;
    if (state.userPaused) return;
    state.intendedPlaying = true;
    updateMediaSessionPlaybackState();

    const startTime = getVideoCurrentTime();
    if (coupledMode && audioEl) {
      await audioGain.ensureReady();
      safeSetAudioTime(startTime);
    }

    const videoStarted = await playVideoSoft(reason === "autoplay");
    if (!videoStarted) {
      scheduleStartupRetry();
      return;
    }

    if (coupledMode && audioEl) {
      const ready = bothPlayable(getVideoCurrentTime(), !state.startupDone);
      if (!ready) {
        await holdForBuffering();
        scheduleSync(90);
        return;
      }
      const audioStarted = await playAudioSoft();
      if (!audioStarted) {
        scheduleStartupRetry();
      }
      await syncAudioToVideo(true);
    }

    state.startupDone = true;
    state.startupRetryCount = 0;
    updateLastKnownGoodTime();
    scheduleSync(0);
  }

  function scheduleStartupRetry() {
    if (!state.autoplayWanted || state.userPaused || state.startupDone) return;
    clearStartupRetryTimer();
    const delays = [200, 450, 800, 1200, 1800, 2500, 3500, 5000];
    const delay = delays[Math.min(state.startupRetryCount, delays.length - 1)];
    state.startupRetryCount += 1;
    state.startupRetryTimer = setTimeout(() => {
      state.startupRetryTimer = null;
      if (!state.autoplayWanted || state.userPaused || state.startupDone) return;
      resumePlayback("autoplay").catch(() => {});
    }, delay);
  }

  async function runSync() {
    if (state.syncing || state.restarting) {
      scheduleSync(150);
      return;
    }

    state.syncing = true;
    try {
      if (!coupledMode) {
        if (state.intendedPlaying && !state.userPaused && getVideoPaused()) {
          await playVideoSoft(false);
        }
        if (!state.intendedPlaying && !getVideoPaused()) {
          await pauseVideoSoft();
        }
        scheduleSync();
        return;
      }

      const vt = getVideoCurrentTime();
      const at = Number(audioEl.currentTime || 0);
      const videoPaused = getVideoPaused();
      const audioPaused = !!audioEl.paused;
      const readyNow = bothPlayable(vt, !state.startupDone);

      if (state.intendedPlaying && !state.userPaused) {
        if (!readyNow || state.videoWaiting || state.audioWaiting) {
          await holdForBuffering();
          scheduleSync(90);
          return;
        }

        if (videoPaused) {
          const ok = await playVideoSoft(false);
          if (!ok) {
            scheduleStartupRetry();
            scheduleSync(180);
            return;
          }
        }

        if (audioPaused) {
          safeSetAudioTime(getVideoCurrentTime());
          const ok = await playAudioSoft();
          if (!ok) {
            scheduleStartupRetry();
            scheduleSync(180);
            return;
          }
        }

        await syncAudioToVideo(false);
        await syncAudioGain(80);
        updateLastKnownGoodTime();
      } else {
        if (!audioPaused) await pauseAudioSoft();
        if (!videoPaused) await pauseVideoSoft();
      }

      if (Number.isFinite(vt) && Number.isFinite(at) && state.intendedPlaying && !videoPaused) {
        maybeUpdateMediaSessionPosition(vt);
      }
    } finally {
      state.syncing = false;
      scheduleSync();
    }
  }

  function waitForReady(media, minReadyState = HAVE_CURRENT_DATA, timeoutMs = 2500) {
    return new Promise(resolve => {
      let done = false;
      let timeoutId = 0;
      const finish = value => {
        if (done) return;
        done = true;
        clearTimeout(timeoutId);
        try { media.removeEventListener("canplay", onReady); } catch {}
        try { media.removeEventListener("loadeddata", onReady); } catch {}
        try { media.removeEventListener("canplaythrough", onReady); } catch {}
        resolve(!!value);
      };
      const onReady = () => {
        try {
          if (Number(media.readyState || 0) >= minReadyState) finish(true);
        } catch {}
      };
      try {
        if (Number(media.readyState || 0) >= minReadyState) {
          finish(true);
          return;
        }
      } catch {}
      try { media.addEventListener("canplay", onReady, { passive: true }); } catch {}
      try { media.addEventListener("loadeddata", onReady, { passive: true }); } catch {}
      try { media.addEventListener("canplaythrough", onReady, { passive: true }); } catch {}
      timeoutId = setTimeout(() => finish(false), timeoutMs);
    });
  }

  async function startupPrime() {
    if (!coupledMode) {
      state.startupDone = true;
      return true;
    }

    const startAt = getVideoCurrentTime();
    safeSetAudioTime(startAt);
    await audioGain.ensureReady();
    await Promise.allSettled([
      waitForReady(getVideoNode(), HAVE_CURRENT_DATA, 3000),
      waitForReady(audioEl, HAVE_CURRENT_DATA, 3000)
    ]);
    safeSetAudioTime(getVideoCurrentTime());
    return bothPlayable(getVideoCurrentTime(), true) || canPlayAt(getVideoNode(), getVideoCurrentTime(), 0.1);
  }

  function updateMediaSessionPlaybackState() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state.intendedPlaying && !state.userPaused ? "playing" : "paused";
    } catch {}
  }

  function maybeUpdateMediaSessionPosition(position) {
    if (!("mediaSession" in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== "function") return;
    try {
      navigator.mediaSession.setPositionState({
        duration: Number(player.duration()) || 0,
        playbackRate: Number(player.playbackRate()) || 1,
        position: clamp(position, 0, Number(player.duration()) || position || 0)
      });
    } catch {}
  }

  function setupTitleBar() {
    player.ready(() => {
      const metaTitle = document.querySelector('meta[name="title"]')?.content || "";
      const metaDesc = document.querySelector('meta[name="twitter:description"]')?.content || "";
      let stats = "";
      const statsMatch = metaDesc.match(/👍\s*[\d.KMB]+\s*(?:\|)?\s*👎\s*[\d.KMB]+\s*(?:\|)?\s*📈\s*[\d.KMB]+\s*(?:Views?)?/i);
      if (statsMatch) stats = statsMatch[0].replace(/\s*\|\s*/g, " | ").trim();

      const add = () => {
        const existing = player.getChild("TitleBar");
        if (existing) return;
        const bar = player.addChild("TitleBar");
        bar.update({ title: metaTitle, description: stats });
      };

      const remove = () => {
        const existing = player.getChild("TitleBar");
        if (existing) player.removeChild(existing);
      };

      const onFs = () => {
        const active = document.fullscreenElement || document.webkitFullscreenElement;
        if (active) add();
        else remove();
      };

      document.addEventListener("fullscreenchange", onFs, { passive: true });
      document.addEventListener("webkitfullscreenchange", onFs, { passive: true });
      onFs();
    });
  }

  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: document.title || "Video",
        artist: typeof authorchannelname !== "undefined" ? authorchannelname : "",
        artwork: vidKey ? [
          { src: `https://i.ytimg.com/vi/${vidKey}/default.jpg`, sizes: "120x90", type: "image/jpeg" },
          { src: `https://i.ytimg.com/vi/${vidKey}/mqdefault.jpg`, sizes: "320x180", type: "image/jpeg" },
          { src: `https://i.ytimg.com/vi/${vidKey}/hqdefault.jpg`, sizes: "480x360", type: "image/jpeg" },
          { src: `https://i.ytimg.com/vi/${vidKey}/maxresdefault.jpg`, sizes: "1280x720", type: "image/jpeg" }
        ] : []
      });
    } catch {}

    const doPause = async () => {
      const serial = ++state.mediaSessionSerial;
      state.userPaused = true;
      state.intendedPlaying = false;
      updateMediaSessionPlaybackState();
      await hardPauseAll();
      if (serial !== state.mediaSessionSerial) return;
    };

    const doPlay = async () => {
      const serial = ++state.mediaSessionSerial;
      state.userPaused = false;
      state.intendedPlaying = true;
      updateMediaSessionPlaybackState();
      const resumeAt = state.lastKnownGoodTime > 0.1 ? state.lastKnownGoodTime : getVideoCurrentTime();
      safeSetVideoTime(resumeAt);
      safeSetAudioTime(resumeAt);
      await resumePlayback("media-session");
      if (serial !== state.mediaSessionSerial) return;
    };

    try { navigator.mediaSession.setActionHandler("pause", doPause); } catch {}
    try { navigator.mediaSession.setActionHandler("stop", doPause); } catch {}
    try { navigator.mediaSession.setActionHandler("play", doPlay); } catch {}
    try {
      navigator.mediaSession.setActionHandler("seekforward", details => {
        const offset = Number(details?.seekOffset) || 10;
        const next = Math.min(getVideoCurrentTime() + offset, Number(player.duration()) || getVideoCurrentTime() + offset);
        safeSetVideoTime(next);
      });
    } catch {}
    try {
      navigator.mediaSession.setActionHandler("seekbackward", details => {
        const offset = Number(details?.seekOffset) || 10;
        const next = Math.max(0, getVideoCurrentTime() - offset);
        safeSetVideoTime(next);
      });
    } catch {}
    try {
      navigator.mediaSession.setActionHandler("seekto", details => {
        if (!details || typeof details.seekTime !== "number") return;
        const next = clamp(details.seekTime, 0, Number(player.duration()) || details.seekTime);
        safeSetVideoTime(next);
      });
    } catch {}
  }

  function bindUserIntent() {
    const root = player?.el?.() || videoEl || document;
    let techPressedWhilePaused = null;

    const getElement = target => {
      try {
        return target && target.nodeType === 1 ? target : null;
      } catch {
        return null;
      }
    };

    const isPlayButton = target => {
      try {
        const el = getElement(target);
        return !!el?.closest?.(".vjs-play-control, .vjs-big-play-button");
      } catch {
        return false;
      }
    };

    const isTechSurface = target => {
      try {
        const el = getElement(target);
        if (!el) return false;
        if (el.closest?.(".vjs-control-bar, .vjs-menu, .vjs-slider, .vjs-control")) return false;
        return !!el.closest?.(".vjs-tech, video");
      } catch {
        return false;
      }
    };

    const onPress = event => {
      if (isPlayButton(event.target)) {
        techPressedWhilePaused = null;
        state.userPaused = !getVideoPaused() || !audioEl?.paused ? true : false;
        return;
      }
      if (isTechSurface(event.target)) {
        techPressedWhilePaused = getVideoPaused();
      } else {
        techPressedWhilePaused = null;
      }
    };

    const onClick = () => {
      if (typeof techPressedWhilePaused !== "boolean") return;
      const wasPaused = techPressedWhilePaused;
      techPressedWhilePaused = null;
      requestAnimationFrame(() => {
        if (wasPaused) {
          state.userPaused = false;
          state.intendedPlaying = true;
          resumePlayback("user").catch(() => {});
        } else {
          state.userPaused = true;
          state.intendedPlaying = false;
          hardPauseAll().catch(() => {});
        }
      });
    };

    const onKeyDown = event => {
      const code = event.code || event.key || "";
      if (code === "Space" || code === "KeyK" || code === "MediaPlayPause") {
        if (getVideoPaused()) {
          state.userPaused = false;
          state.intendedPlaying = true;
          resumePlayback("keyboard").catch(() => {});
        } else {
          state.userPaused = true;
          state.intendedPlaying = false;
          hardPauseAll().catch(() => {});
        }
      }
      if (code === "MediaPause" || code === "MediaStop") {
        state.userPaused = true;
        state.intendedPlaying = false;
        hardPauseAll().catch(() => {});
      }
    };

    try {
      if ("PointerEvent" in window) root.addEventListener("pointerdown", onPress, { passive: true, capture: true });
      else root.addEventListener("mousedown", onPress, { passive: true, capture: true });
    } catch {}
    try { root.addEventListener("click", onClick, { passive: true, capture: true }); } catch {}
    try { document.addEventListener("keydown", onKeyDown, true); } catch {}
  }

  function onUnexpectedPause(source) {
    if (!state.intendedPlaying || state.userPaused) return;
    if (document.visibilityState === "hidden") {
      state.shouldResumeOnVisible = true;
      return;
    }
    if (source === "media-session") return;
    resumePlayback("unexpected-pause").catch(() => {});
  }

  function bindPlaybackEvents() {
    player.on("ratechange", () => {
      if (!coupledMode || !audioEl) return;
      try { audioEl.playbackRate = Number(player.playbackRate()) || 1; } catch {}
    });

    player.on("volumechange", () => {
      state.userMutedVideo = !!player.muted();
      syncAudioGain(70).catch(() => {});
    });

    if (coupledMode && audioEl) {
      try {
        audioEl.addEventListener("volumechange", () => {
          state.userMutedAudio = !!audioEl.muted;
          syncAudioGain(70).catch(() => {});
        }, { passive: true });
      } catch {}
    }

    player.on("play", () => {
      if (isSuppressed("videoPlayUntil")) return;
      if (state.userPaused) {
        pauseVideoSoft().catch(() => {});
        return;
      }
      state.intendedPlaying = true;
      updateMediaSessionPlaybackState();
      if (coupledMode) resumePlayback("video-play-event").catch(() => {});
      else scheduleSync(0);
    });

    player.on("pause", () => {
      if (state.seeking || isSuppressed("videoPauseUntil")) return;
      if (state.userPaused) {
        updateMediaSessionPlaybackState();
        return;
      }
      onUnexpectedPause("video");
    });

    player.on("waiting", () => {
      state.videoWaiting = true;
      if (state.intendedPlaying && !state.userPaused) holdForBuffering().catch(() => {});
    });

    player.on("playing", () => {
      state.videoWaiting = false;
      updateLastKnownGoodTime();
      if (state.intendedPlaying && !state.userPaused) scheduleSync(0);
    });

    player.on("seeking", async () => {
      state.seeking = true;
      state.wasPlayingBeforeSeek = state.intendedPlaying && !state.userPaused;
      state.pendingPlayAfterSeek = state.wasPlayingBeforeSeek;
      await softenAudioForSeek();
      safeSetAudioTime(getVideoCurrentTime());
    });

    player.on("seeked", async () => {
      safeSetAudioTime(getVideoCurrentTime());
      state.seeking = false;
      if (state.pendingPlayAfterSeek && !state.userPaused) {
        state.pendingPlayAfterSeek = false;
        await resumePlayback("seeked");
      } else {
        await restoreAudioAfterSeek();
      }
      scheduleSync(0);
    });

    player.on("ended", () => {
      if (isLoopDesired()) {
        restartLoop().catch(() => {});
      } else {
        state.userPaused = true;
        hardPauseAll().catch(() => {});
      }
    });

    if (!coupledMode || !audioEl) return;

    audioEl.addEventListener("play", () => {
      if (isSuppressed("audioPlayUntil")) return;
      if (state.userPaused) {
        pauseAudioSoft().catch(() => {});
        return;
      }
      state.intendedPlaying = true;
      scheduleSync(0);
    }, { passive: true });

    audioEl.addEventListener("pause", () => {
      if (state.seeking || isSuppressed("audioPauseUntil")) return;
      if (state.userPaused) return;
      onUnexpectedPause("audio");
    }, { passive: true });

    audioEl.addEventListener("waiting", () => {
      state.audioWaiting = true;
      if (state.intendedPlaying && !state.userPaused) holdForBuffering().catch(() => {});
    }, { passive: true });

    const clearAudioWaiting = () => {
      state.audioWaiting = false;
      if (state.intendedPlaying && !state.userPaused) scheduleSync(0);
    };

    audioEl.addEventListener("playing", clearAudioWaiting, { passive: true });
    audioEl.addEventListener("canplay", clearAudioWaiting, { passive: true });
    audioEl.addEventListener("canplaythrough", clearAudioWaiting, { passive: true });
    audioEl.addEventListener("loadeddata", clearAudioWaiting, { passive: true });

    audioEl.addEventListener("ended", () => {
      if (isLoopDesired()) restartLoop().catch(() => {});
      else {
        state.userPaused = true;
        hardPauseAll().catch(() => {});
      }
    }, { passive: true });
  }

  async function restartLoop() {
    if (state.restarting) return;
    state.restarting = true;
    try {
      await pauseAudioSoft();
      await pauseVideoSoft();
      safeSetVideoTime(0);
      safeSetAudioTime(0);
      state.userPaused = false;
      state.intendedPlaying = true;
      await resumePlayback("loop");
    } finally {
      state.restarting = false;
    }
  }

  function setupVisibilityLifecycle() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        state.hiddenAt = now();
        updateLastKnownGoodTime();
        return;
      }

      const hiddenFor = state.hiddenAt ? now() - state.hiddenAt : 0;
      state.hiddenAt = 0;

      if (state.intendedPlaying && !state.userPaused) {
        const vt = getVideoCurrentTime();
        const at = coupledMode && audioEl ? Number(audioEl.currentTime || 0) : vt;
        const drift = Math.abs(vt - at);
        if (state.shouldResumeOnVisible || drift > VISIBILITY_CATCHUP_DRIFT || hiddenFor > 800) {
          state.shouldResumeOnVisible = false;
          resumePlayback("visible").catch(() => {});
        } else {
          scheduleSync(0);
        }
      }
    }, { passive: true, capture: true });

    window.addEventListener("pageshow", () => {
      if (state.intendedPlaying && !state.userPaused) {
        resumePlayback("pageshow").catch(() => {});
      }
    }, { passive: true, capture: true });

    window.addEventListener("beforeunload", () => {
      clearSyncTimer();
      clearStartupRetryTimer();
      clearWaitingResumeTimer();
    });
  }

  setupTitleBar();
  setupMediaSession();
  bindUserIntent();
  bindPlaybackEvents();
  setupVisibilityLifecycle();

  if (coupledMode && audioEl) {
    try {
      audioEl.preload = "auto";
      audioEl.load();
    } catch {}
    audioGain.ensureReady().catch(() => {});
    syncAudioGain(0).catch(() => {});
  }

  startupPrime().then(async ready => {
    if (!ready && state.autoplayWanted) scheduleStartupRetry();
    if (state.autoplayWanted) {
      state.userPaused = false;
      state.intendedPlaying = true;
      await resumePlayback("autoplay");
    } else {
      updateMediaSessionPlaybackState();
      scheduleSync(250);
    }
  }).catch(() => {
    if (state.autoplayWanted) scheduleStartupRetry();
    scheduleSync(250);
  });
});


document.addEventListener('keydown', function(event) {
     const active = document.activeElement;
    if (active && (active.tagName.toLowerCase() === 'input' || active.tagName.toLowerCase() === 'textarea')) {
        return;
    }

    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
        return;
    }

    const videoElement = document.querySelector('.video-js');
    if (!videoElement) return;
    const player = videojs(videoElement);

    switch (event.key.toLowerCase()) {
        case 'f':
            if (!player.isFullscreen()) {
                player.requestFullscreen();
            } else {
                player.exitFullscreen();
            }
            break;
        case ' ':
        case 'k':
            event.preventDefault();
            if (player.paused()) {
                player.play();
            } else {
                player.pause();
            }
            break;
        case 'm':
            player.muted(!player.muted());
            break;
        case 'arrowright':
        case 'l':
            player.currentTime(player.currentTime() + 10);
            break;
        case 'arrowleft':
        case 'j':
            player.currentTime(player.currentTime() - 10);
            break;
        case 'arrowup':
            event.preventDefault();
            player.volume(Math.min(1, player.volume() + 0.1));
            break;
        case 'arrowdown':
            event.preventDefault();
            player.volume(Math.max(0, player.volume() - 0.1));
            break;
    }
});

 // https://codeberg.org/ashleyirispuppy/poke/src/branch/main/src/libpoketube/libpoketube-youtubei-objects.json


 const FORMATS = {
    "5": { ext: "flv", width: 400, height: 240, acodec: "mp3", abr: 64, vcodec: "h263" },
    "6": { ext: "flv", width: 450, height: 270, acodec: "mp3", abr: 64, vcodec: "h263" },
    "13": { ext: "3gp", acodec: "aac", vcodec: "mp4v" },
    "17": { ext: "3gp", width: 176, height: 144, acodec: "aac", abr: 24, vcodec: "mp4v" },
    "18": { ext: "mp4", width: 640, height: 360, acodec: "aac", abr: 96, vcodec: "h264" },
    "34": { ext: "flv", width: 640, height: 360, acodec: "aac", abr: 128, vcodec: "h264" },
    "35": { ext: "flv", width: 854, height: 480, acodec: "aac", abr: 128, vcodec: "h264" },
    "36": { ext: "3gp", width: 320, acodec: "aac", vcodec: "mp4v" },
    "37": { ext: "mp4", width: 1920, height: 1080, acodec: "aac", abr: 192, vcodec: "h264" },
    "38": { ext: "mp4", width: 4096, height: 3072, acodec: "aac", abr: 192, vcodec: "h264" },
    "43": { ext: "webm", width: 640, height: 360, acodec: "vorbis", abr: 128, vcodec: "vp8" },
    "44": { ext: "webm", width: 854, height: 480, acodec: "vorbis", abr: 128, vcodec: "vp8" },
    "45": { ext: "webm", width: 1280, height: 720, acodec: "vorbis", abr: 192, vcodec: "vp8" },
    "46": { ext: "webm", width: 1920, height: 1080, acodec: "vorbis", abr: 192, vcodec: "vp8" },
    "59": { ext: "mp4", width: 854, height: 480, acodec: "aac", abr: 128, vcodec: "h264" },
    "78": { ext: "mp4", width: 854, height: 480, acodec: "aac", abr: 128, vcodec: "h264" },
    
    // 3D videos
    "82": { ext: "mp4", height: 360, format: "3D", acodec: "aac", abr: 128, vcodec: "h264" },
    "83": { ext: "mp4", height: 480, format: "3D", acodec: "aac", abr: 128, vcodec: "h264" },
    "84": { ext: "mp4", height: 720, format: "3D", acodec: "aac", abr: 192, vcodec: "h264" },
    "85": { ext: "mp4", height: 1080, format: "3D", acodec: "aac", abr: 192, vcodec: "h264" },
    "100": { ext: "webm", height: 360, format: "3D", acodec: "vorbis", abr: 128, vcodec: "vp8" },
    "101": { ext: "webm", height: 480, format: "3D", acodec: "vorbis", abr: 192, vcodec: "vp8" },
    "102": { ext: "webm", height: 720, format: "3D", acodec: "vorbis", abr: 192, vcodec: "vp8" },

    // Apple HTTP Live Streaming
    "91": { ext: "mp4", height: 144, format: "HLS", acodec: "aac", abr: 48, vcodec: "h264" },
    "92": { ext: "mp4", height: 240, format: "HLS", acodec: "aac", abr: 48, vcodec: "h264" },
    "93": { ext: "mp4", height: 360, format: "HLS", acodec: "aac", abr: 128, vcodec: "h264" },
    "94": { ext: "mp4", height: 480, format: "HLS", acodec: "aac", abr: 128, vcodec: "h264" },
    "95": { ext: "mp4", height: 720, format: "HLS", acodec: "aac", abr: 256, vcodec: "h264" },
    "96": { ext: "mp4", height: 1080, format: "HLS", acodec: "aac", abr: 256, vcodec: "h264" },
    "132": { ext: "mp4", height: 240, format: "HLS", acodec: "aac", abr: 48, vcodec: "h264" },
    "151": { ext: "mp4", height: 72, format: "HLS", acodec: "aac", abr: 24, vcodec: "h264" },

    // DASH mp4 video
    "133": { ext: "mp4", height: 240, format: "DASH video", vcodec: "h264" },
    "134": { ext: "mp4", height: 360, format: "DASH video", vcodec: "h264" },
    "135": { ext: "mp4", height: 480, format: "DASH video", vcodec: "h264" },
    "136": { ext: "mp4", height: 720, format: "DASH video", vcodec: "h264" },
    "137": { ext: "mp4", height: 1080, format: "DASH video", vcodec: "h264" },
    "138": { ext: "mp4", format: "DASH video", vcodec: "h264" }, // Height can vary
    "160": { ext: "mp4", height: 144, format: "DASH video", vcodec: "h264" },
    "212": { ext: "mp4", height: 480, format: "DASH video", vcodec: "h264" },
    "264": { ext: "mp4", height: 1440, format: "DASH video", vcodec: "h264" },
    "298": { ext: "mp4", height: 720, format: "DASH video", vcodec: "h264", fps: 60 },
    "299": { ext: "mp4", height: 1080, format: "DASH video", vcodec: "h264", fps: 60 },
    "266": { ext: "mp4", height: 2160, format: "DASH video", vcodec: "h264" },

    // Dash mp4 audio
    "139": { ext: "m4a", format: "DASH audio", acodec: "aac", abr: 48, container: "m4a_dash" },
    "140": { ext: "m4a", format: "DASH audio", acodec: "aac", abr: 128, container: "m4a_dash" },
    "141": { ext: "m4a", format: "DASH audio", acodec: "aac", abr: 256, container: "m4a_dash" },
    "256": { ext: "m4a", format: "DASH audio", acodec: "aac", container: "m4a_dash" },
    "258": { ext: "m4a", format: "DASH audio", acodec: "aac", container: "m4a_dash" },
    "325": { ext: "m4a", format: "DASH audio", acodec: "dtse", container: "m4a_dash" },
    "328": { ext: "m4a", format: "DASH audio", acodec: "ec-3", container: "m4a_dash" },

    // Dash webm
    "167": { ext: "webm", height: 360, width: 640, vcodec: "vp9", acodec: "vorbis" },
    "171": { ext: "webm", height: 480, width: 854, vcodec: "vp9", acodec: "vorbis" },
    "172": { ext: "webm", height: 720, width: 1280, vcodec: "vp9", acodec: "vorbis" },
    "248": { ext: "webm", height: 1080, width: 1920, vcodec: "vp9", acodec: "vorbis" },
    "249": { ext: "webm", height: 1440, width: 2560, vcodec: "vp9", acodec: "vorbis" },
    "250": { ext: "webm", height: 2160, width: 3840, vcodec: "vp9", acodec: "vorbis" },

    // Extra formats
    "264": { ext: "mp4", height: 1440, vcodec: "h264" }
};



// youtube client stuff 
const YoutubeAPI = {
  DEFAULT_API_KEY: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
  ANDROID_API_KEY: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",

  ANDROID_APP_VERSION: "20.20.41",
  ANDROID_USER_AGENT:  "com.google.android.youtube/20.20.41 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
  ANDROID_SDK_VERSION: 36,
  ANDROID_VERSION: "16",

  ANDROID_TS_APP_VERSION: "1.9",
  ANDROID_TS_USER_AGENT:
    "com.google.android.youtube/1.9 (Linux; U; Android 1; US) gzip",

  IOS_APP_VERSION: "20.11.6",
  IOS_USER_AGENT:
    "com.google.ios.youtube/20.11.6 (iPhone14,5; U; CPU iOS 18_5 like Mac OS X;)",
  IOS_VERSION: "18.5.0.22F76",

  WINDOWS_VERSION: "10.0",

  ClientType: {
    web: "Web",
    web_embedded_player: "WebEmbeddedPlayer",
    web_mobile: "WebMobile",
    web_screen_embed: "WebScreenEmbed",
    android: "Android",
    android_embedded_player: "AndroidEmbeddedPlayer",
    android_screen_embed: "AndroidScreenEmbed",
    android_test_suite: "AndroidTestSuite",
    ios: "IOS",
    ios_embedded: "IOSEmbedded",
    ios_music: "IOSMusic",
    tv_html5: "TvHtml5",
    tv_html5_screen_embed: "TvHtml5ScreenEmbed"
  },

  HARDCODED_CLIENTS: {
    // Web
    web: {
      name: "WEB",
      name_proto: "1",
      version: "2.20250917.02.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "WATCH_FULL_SCREEN",
      os_name: "Windows",
      os_version: "10.0",
      platform: "DESKTOP"
    },
    web_embedded_player: {
      name: "WEB_EMBEDDED_PLAYER",
      name_proto: "56",
      version: "1.20250907.01.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "EMBED",
      os_name: "Windows",
      os_version: "10.0",
      platform: "DESKTOP"
    },
    web_mobile: {
      name: "MWEB",
      name_proto: "2",
      version: "2.20250909.02.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      os_name: "Android",
      os_version: "16",
      platform: "MOBILE"
    },
    web_screen_embed: {
      name: "WEB",
      name_proto: "1",
      version: "2.20250909.02.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "EMBED",
      os_name: "Windows",
      os_version: "10.0",
      platform: "DESKTOP"
    },

    // Android
    android: {
      name: "ANDROID",
      name_proto: "3",
      version: "20.20.41",
      api_key: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
      android_sdk_version: 36,
      user_agent:
        "com.google.android.youtube/20.20.41 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
      os_name: "Android",
      os_version: "16",
      platform: "MOBILE"
    },
    android_embedded_player: {
      name: "ANDROID_EMBEDDED_PLAYER",
      name_proto: "55",
      version: "20.20.41",
      api_key: "AIzaSyCjc_pVEDi4qsv5MtC2dMXzpIaDoRFLsxw"
    },
    android_screen_embed: {
      name: "ANDROID",
      name_proto: "3",
      version: "20.20.41",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "EMBED",
      android_sdk_version: 36,
      user_agent:
        "com.google.android.youtube/20.20.41 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
      os_name: "Android",
      os_version: "16",
      platform: "MOBILE"
    },
    android_test_suite: {
      name: "ANDROID_TESTSUITE",
      name_proto: "30",
      version: "1.9",
      api_key: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
      android_sdk_version: 36,
      user_agent:
        "com.google.android.youtube/1.9 (Linux; U; Android 16; US) gzip",
      os_name: "Android",
      os_version: "16",
      platform: "MOBILE"
    },

    // iOS
    ios: {
      name: "IOS",
      name_proto: "5",
      version: "20.11.6",
      api_key: "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
      user_agent:
        "com.google.ios.youtube/20.11.6 (iPhone14,5; U; CPU iOS 18_5 like Mac OS X;)",
      device_make: "Apple",
      device_model: "iPhone14,5",
      os_name: "iPhone",
      os_version: "18.5.0.22F76",
      platform: "MOBILE"
    },
    ios_embedded: {
      name: "IOS_MESSAGES_EXTENSION",
      name_proto: "66",
      version: "20.11.6",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      user_agent:
        "com.google.ios.youtube/20.11.6 (iPhone14,5; U; CPU iOS 18_5 like Mac OS X;)",
      device_make: "Apple",
      device_model: "iPhone14,5",
      os_name: "iPhone",
      os_version: "18.5.0.22F76",
      platform: "MOBILE"
    },
    ios_music: {
      name: "IOS_MUSIC",
      name_proto: "26",
      version: "7.14",
      api_key: "AIzaSyBAETezhkwP0ZWA02RsqT1zu78Fpt0bC_s",
      user_agent:
        "com.google.ios.youtubemusic/7.14 (iPhone14,5; U; CPU iOS 17_6 like Mac OS X;)",
      device_make: "Apple",
      device_model: "iPhone14,5",
      os_name: "iPhone",
      os_version: "18.5.0.22F76",
      platform: "MOBILE"
    },

    // TV
    tv_html5: {
      name: "TVHTML5",
      name_proto: "7",
      version: "7.20250219.14.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
    },
    tv_html5_screen_embed: {
      name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
      name_proto: "85",
      version: "2.0",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "EMBED"
    }
  },

  DEFAULT_CLIENT_CONFIG: {
    client_type: "web",
    region: "US"
  }
};




// player base 
const base_player_old_old = "https://www.youtube.com/s/player/a87a9450/player_ias.vflset/en_US/base.js"
const base_player_old = "https://www.youtube.com/s/player/2d24ba15/player_ias.vflset/en_US/base.js";
const base_player_broken = "https://www.youtube.com/s/player/6740c111/player_ias.vflset/en_US/base.js";
const hey = " please dont use the above player base stuff!! tyyyyyyyy <3 "
const youtubeobjects = "https://codeberg.org/ashleyirispuppy/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json"
const watchURl = "https://youtube.com/watch"
const base_player = "https://www.youtube.com/s/player/0004de42/player_ias.vflset/en_US/base.js";
const base_player_poketube = "https://poketube.fun/s/player/0004de42/player_ias.vflset/en_US/base.js";

function extractPlayerData(playerUrl) {
    const segments = playerUrl.split('/');
    const domain = segments[2];
    const version = segments[segments.length - 2];
    const fileName = segments[segments.length - 1];
    const key = generateKey(domain, version, fileName);

    return {
        domain,
        version,
        fileName,
        key,
        timestamp: Date.now(),
    };
}

function generateKey(domain, version, fileName) {
    const rawString = `${domain}|${version}|${fileName}|${Date.now()}`;
    return Array.from(rawString)
        .map((char) => char.charCodeAt(0) * 3)
        .reduce((acc, val) => (acc + val) % 997, 1)
        .toString(36);
}

function initializePlayer(data) {
    const context = createPlayerContext(data.key, data.version);
    const frameData = calculateFrames(data.timestamp, data.fileName);

    const playerObject = {
        context,
        frameData,
        ready: false,
    };

    if (validatePlayerObject(playerObject)) {
        playerObject.ready = true;
    }

    return playerObject;
}

function createPlayerContext(key, version) {
    const contextMap = new Map();
    const modifiers = key.length + version.length;

    contextMap.set("encryptionLevel", modifiers % 5);
    contextMap.set("versionHash", Array.from(version).reduce((acc, char) => acc + char.charCodeAt(0), 0));
    contextMap.set("keyWeight", key.split('').reduce((acc, char) => acc * char.charCodeAt(0), 1));

    return contextMap;
}

function calculateFrames(timestamp, fileName) {
    const base = fileName.split('_').length + timestamp.toString().length;
    const frameCount = base % 128 + 10;

    return Array.from({ length: frameCount }, (_, index) => ({
        frame: index,
        delay: (timestamp % (index + 1)) + 20,
    }));
}

function validatePlayerObject(player) {
    const { context, frameData } = player;
    const frameHash = frameData.reduce((acc, frame) => acc + frame.frame * frame.delay, 0);
    const contextHash = Array.from(context.values()).reduce((acc, value) => acc + value, 0);

    return (frameHash + contextHash) % 13 === 0;
}

const extractedData = extractPlayerData(base_player_poketube);
const initializedPlayer = initializePlayer(extractedData);

const POKEPLAYEROBJECTS = {
  base_player_old_old: "https://www.youtube.com/s/player/a87a9450/player_ias.vflset/en_US/base.js",
  base_player_old: "https://www.youtube.com/s/player/2d24ba15/player_ias.vflset/en_US/base.js",
  base_player_broken: "https://www.youtube.com/s/player/6740c111/player_ias.vflset/en_US/base.js",
  base_player: "https://www.youtube.com/s/player/0004de42/player_ias.vflset/en_US/base.js",
  base_player_poketube: "https://poketube.fun/s/player/0004de42/player_ias.vflset/en_US/base.js",
  youtubeobjects: "https://codeberg.org/ashleyirispuppy/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json",
  watchURL: "https://youtube.com/watch",
  youtube_home: "https://www.youtube.com/",
  youtube_trending: "https://www.youtube.com/feed/trending",
  youtube_music: "https://music.youtube.com/",
  youtube_shorts: "https://www.youtube.com/shorts/",
  youtube_subscriptions: "https://www.youtube.com/feed/subscriptions",
  youtube_api_v1: "https://www.youtube.com/youtubei/v1/player",
  youtube_embed: "https://www.youtube.com/embed/",
  youtube_channel: "https://www.youtube.com/channel/",
  youtube_search: "https://www.youtube.com/results?search_query=",
  youtube_feed: "https://www.youtube.com/feeds/videos.xml?channel_id="
};

try {
  console.log("[POKE PLAYER] initializing player configuration...");

  for (const [name, url] of Object.entries(POKEPLAYEROBJECTS)) {
    if (!url.startsWith("http")) {
      console.log(`[POKE PLAYER] skipped ${name}`);
      continue;
    }

    if (name === "base_player") {
      const id = (url.match(/player\/([^/]+)/) || [])[1] || "unknown";
      console.log(`[POKE PLAYER] USING PLAYER [${id}]`);
    } else {
      console.log(`[POKE PLAYER] loaded ${name}`);
    }
  }

  console.log("[POKE PLAYER] all URLs registered successfully!");
} catch (err) {
  console.error("[POKE PLAYER] initialization error:", err.message);
}



// custom video.js ui for POKE PLAYER 
 const customVideoJsUI = document.createElement("style");
customVideoJsUI.innerHTML = `
 

:root{
  /* Brand */
  --poke-accent-1: #ff0045;
  --poke-accent-2: #ff0e55;
  --poke-accent-3: #ff1d79;

   --glass-bg: rgba(20, 20, 20, 0.38);
  --glass-bg-hover: rgba(20, 20, 20, 0.46);
  --glass-border: rgba(255, 255, 255, 0.22);
  --glass-border-strong: rgba(255, 255, 255, 0.30);
  --glass-shadow: 0 10px 30px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.10);

   --scene-contrast-wash: rgba(0,0,0,0.10);

  /* Text */
  --ui-text: rgba(255,255,255,0.96);
  --ui-text-soft: rgba(255,255,255,0.86);
  --ui-text-shadow: 0 1px 2px rgba(0,0,0,0.65);
  --ui-text-outline: 0 0 1px rgba(0,0,0,0.70);

  /* Radii */
  --r-outer: 16px;
  --r-pill: 999px;
  --r-bubble: 1em;

  /* Sizes */
  --btn: 38px;
  --btn-mobile: 34px;
  --bar-bottom: 12px;
  --bar-bottom-mobile: 10px;
}

/* Keep the whole player rounded */
.video-js,
.video-js .vjs-tech,
.video-js .vjs-poster,
.video-js .vjs-poster img{
  border-radius: var(--r-outer) !important;
}

/* Title bar container */
.vjs-title-bar{
  background: none !important;
  border-radius: var(--r-outer);
  overflow: hidden;
}

/* Title text readability on bright frames */
.vjs-title-bar-title{
  font-family: "PokeTube Flex", sans-serif !important;
  font-stretch: ultra-expanded;
  font-weight: 1000;
  font-size: 1.5em;
  color: var(--ui-text) !important;
  text-shadow: var(--ui-text-shadow);
  -webkit-text-stroke: 0.35px rgba(0,0,0,0.35);
}

/* Description bubble: more readable on white frames */
.vjs-title-bar-description{
  width: fit-content;
  border-radius: var(--r-bubble);
  padding: 1em;

  font-family: "PokeTube Flex", "poketube flex", sans-serif;
  font-weight: 600;
  font-stretch: semi-expanded;

  color: var(--ui-text);
  text-shadow: var(--ui-text-shadow);
  filter: drop-shadow(0 8px 22px rgba(0,0,0,0.25));

  /* layered glass + wash for bright scenes */
  background:
    linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)),
    linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)),
    var(--glass-bg);
  border: 1px solid var(--glass-border);
  -webkit-backdrop-filter: blur(14px) saturate(170%);
  backdrop-filter: blur(14px) saturate(170%);
}

/* Control bar placement */
.video-js .vjs-control-bar{
  bottom: var(--bar-bottom) !important;
}

/* Control bar glass container */
.vjs-control-bar{
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  display: flex !important;
  align-items: center !important;

  gap: 2px;
  padding: 6px 10px;
  border-radius: var(--r-outer);

  /* A faint wash behind the whole bar to survive white frames */
  background:
    linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05)),
    linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)) !important;

  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid rgba(255,255,255,0.12) !important;
  box-shadow: 0 12px 34px rgba(0,0,0,0.26) !important;
}

/* Buttons */
.vjs-control-bar .vjs-button{
  width: var(--btn);
  height: var(--btn);
  min-width: var(--btn);
  border-radius: 50%;

  /* Slightly darker glass base so it reads on white frames */
  background:
    linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)),
    linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)),
    var(--glass-bg);

  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);

  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);

  display: inline-flex;
  align-items: center;
  justify-content: center;

  margin: 0 6px;
  transition: transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  vertical-align: middle;
}

.vjs-control-bar .vjs-button:hover{
  background:
    linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.12)),
    linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.12)),
    var(--glass-bg-hover);

  border-color: var(--glass-border-strong);
  box-shadow: 0 12px 32px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(255,255,255,0.16);
  transform: translateY(-1px);
}

.vjs-control-bar .vjs-button:active{
  transform: translateY(0);
}

.vjs-control-bar .vjs-button:focus-visible{
  outline: none;
  box-shadow:
    0 0 0 3px rgba(255,0,90,0.35),
    inset 0 0 0 1px rgba(255,255,255,0.20),
    0 12px 34px rgba(0,0,0,0.32);
  border-color: rgba(255,255,255,0.30);
}

/* Icons: keep them readable on white frames */
.vjs-control-bar .vjs-icon-placeholder:before{
  font-size: 18px;
  line-height: var(--btn);
  color: var(--ui-text);
  text-shadow: var(--ui-text-shadow);
  filter: drop-shadow(var(--ui-text-outline));
}

/* Time text pills */
.vjs-current-time,
.vjs-duration,
.vjs-remaining-time,
.vjs-time-divider{
  background: transparent;
  padding: 0 8px;
  border-radius: var(--r-pill);
  box-shadow: none;
  margin: 0;

  height: var(--btn);
  line-height: 1;

  display: inline-flex;
  align-items: center;

  color: var(--ui-text-soft) !important;
  text-shadow: var(--ui-text-shadow);
}

/* Ensure remaining time / fullscreen control doesn't add its own background */
.vjs-fullscreen-control,
.vjs-remaining-time{
  background-color: transparent !important;
}

/* Progress control layout */
.vjs-progress-control{
  flex: 1 1 auto;
  display: flex !important;
  align-items: center !important;
  margin: 0 6px;
  padding: 0;
  height: var(--btn);
}

/* Progress bar glass track */
.vjs-progress-control .vjs-progress-holder{
  height: 8px !important;
  border-radius: var(--r-pill) !important;
  background: transparent !important;
  border: none;
  box-shadow: none;
  position: relative;
  margin: 0;
  width: 100%;
  overflow: hidden;
}

/* Track surface (stronger contrast for white scenes) */
.vjs-progress-control .vjs-progress-holder::before{
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;

  background:
    linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)),
    linear-gradient(180deg, rgba(0,0,0,0.14), rgba(0,0,0,0.14)),
    rgba(20,20,20,0.34);

  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);

  border: 1px solid rgba(255,255,255,0.18);
  box-shadow: 0 8px 24px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.10);
  pointer-events: none;
}

/* Load + play layers */
.vjs-progress-control .vjs-load-progress,
.vjs-progress-control .vjs-play-progress{
  position: relative;
  z-index: 1;
  border-radius: inherit !important;
}

.vjs-progress-control .vjs-play-progress,
.vjs-play-progress{
  background-image: linear-gradient(to right, var(--poke-accent-1), var(--poke-accent-2), var(--poke-accent-3)) !important;
}

/* Scrubber handle */
.vjs-progress-control .vjs-slider-handle{
  width: 14px !important;
  height: 14px !important;
  border-radius: 50% !important;

  background: rgba(255,255,255,0.95) !important;
  border: 1px solid rgba(255,255,255,0.95);

  box-shadow:
    0 8px 20px rgba(0,0,0,0.35),
    0 0 0 3px rgba(255,0,90,0.22);

  top: -4px !important;
  z-index: 2;
}

/* Volume panel */
.vjs-volume-panel{
  gap: 8px;
  align-items: center !important;
  padding: 0;
  height: var(--btn);
}

/* Volume track: make it readable on white frames too */
.vjs-volume-bar{
  height: 6px !important;
  border-radius: var(--r-pill) !important;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06)),
    linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18)),
    rgba(18,18,18,0.40) !important;

  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 8px 20px rgba(0,0,0,0.20);
  position: relative;
  overflow: hidden;
}

.vjs-volume-level{
  border-radius: inherit !important;
  background-image: linear-gradient(to right, var(--poke-accent-1), var(--poke-accent-3)) !important;
}

.vjs-volume-bar .vjs-slider-handle{
  width: 12px !important;
  height: 12px !important;
  border-radius: 50% !important;

  background: rgba(255,255,255,0.95) !important;
  border: 1px solid rgba(255,255,255,0.95);

  top: -3px !important;

  box-shadow:
    0 6px 16px rgba(0,0,0,0.28),
    0 0 0 3px rgba(255,0,90,0.20);
}

/* Mobile tweaks */
@media (max-width: 640px){
  .video-js .vjs-control-bar{
    bottom: var(--bar-bottom-mobile) !important;
  }

  .vjs-control-bar{
    gap: 8px;
    padding: 6px 8px;
  }

  .vjs-control-bar .vjs-button{
    width: var(--btn-mobile);
    height: var(--btn-mobile);
    min-width: var(--btn-mobile);
  }

  .vjs-control-bar .vjs-icon-placeholder:before{
    font-size: 16px;
    line-height: var(--btn-mobile);
  }

  .vjs-current-time,
  .vjs-duration,
  .vjs-remaining-time,
  .vjs-time-divider{
    height: var(--btn-mobile);
  }

  .vjs-progress-control{
    height: var(--btn-mobile);
  }

  .vjs-progress-control .vjs-slider-handle{
    width: 12px !important;
    height: 12px !important;
    top: -3px !important;
  }
}

/* If backdrop-filter isn't supported, fall back to solid-ish surfaces */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
  .vjs-control-bar,
  .vjs-control-bar .vjs-button,
  .vjs-title-bar-description,
  .vjs-progress-control .vjs-progress-holder::before,
  .vjs-volume-bar{
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    background: rgba(18,18,18,0.72) !important;
    border-color: rgba(255,255,255,0.18) !important;
  }
}
`;
document.head.appendChild(customVideoJsUI);


window.pokePlayer = {
    ver:`21-6740c111-vjs-${videojs.VERSION}`,
    canHasAmbientMode:true,
    videoID:new URLSearchParams(window.location.search).get('v'),
    supported_itag_list:["22","136", "140", "298", "18", "400", "401", "313", "271"],
    formats:["SD", "HD", "4K", "2K", "UHD", "FHD"],
	YoutubeAPI,
    clientVideoPlayerID:"0004de42",
}


/* video js plugins */









/*  github: https://github.com/afrmtbl/videojs-youtube-annotations */

class AnnotationParser {
	static get defaultAppearanceAttributes() {
		return {
			bgColor: 0xFFFFFF,
			bgOpacity: 0.80,
			fgColor: 0,
			textSize: 3.15
		};
	}

	static get attributeMap() {
		return {
			type: "tp",
			style: "s",
			x: "x",
			y: "y",
			width: "w",
			height: "h",

			sx: "sx",
			sy: "sy",

			timeStart: "ts",
			timeEnd: "te",
			text: "t",

			actionType: "at",
			actionUrl: "au",
			actionUrlTarget: "aut",
			actionSeconds: "as",

			bgOpacity: "bgo",
			bgColor: "bgc",
			fgColor: "fgc",
			textSize: "txsz"
		};
	}

	/* AR ANNOTATION FORMAT */
	deserializeAnnotation(serializedAnnotation) {
		const map = this.constructor.attributeMap;
		const attributes = serializedAnnotation.split(",");
		const annotation = {};
		for (const attribute of attributes) {
			const [ key, value ] = attribute.split("=");
			const mappedKey = this.getKeyByValue(map, key);

			let finalValue = "";

			if (["text", "actionType", "actionUrl", "actionUrlTarget", "type", "style"].indexOf(mappedKey) > -1) {
				finalValue = decodeURIComponent(value);
			}
			else {
				finalValue = parseFloat(value, 10);
			}
			annotation[mappedKey] = finalValue;
		}
		return annotation;
	}
	serializeAnnotation(annotation) {
		const map = this.constructor.attributeMap;
		let serialized = "";
		for (const key in annotation) {
			const mappedKey = map[key];
			if ((["text", "actionType", "actionUrl", "actionUrlTarget"].indexOf(key) > -1) && mappedKey && annotation.hasOwnProperty(key)) {
				let text = encodeURIComponent(annotation[key]);
				serialized += `${mappedKey}=${text},`;
			}
			else if ((["text", "actionType", "actionUrl", "actionUrlTarget"].indexOf("key") === -1) && mappedKey && annotation.hasOwnProperty(key)) {
				serialized += `${mappedKey}=${annotation[key]},`;
			}
		}
		// remove trailing comma
		return serialized.substring(0, serialized.length - 1);
	}

	deserializeAnnotationList(serializedAnnotationString) {
		const serializedAnnotations = serializedAnnotationString.split(";");
		serializedAnnotations.length = serializedAnnotations.length - 1;
		const annotations = [];
		for (const annotation of serializedAnnotations) {
			annotations.push(this.deserializeAnnotation(annotation));
		}
		return annotations;
	}
	serializeAnnotationList(annotations) {
		let serialized = "";
		for (const annotation of annotations) {
			serialized += this.serializeAnnotation(annotation) + ";";
		}
		return serialized;
	}

	/* PARSING YOUTUBE'S ANNOTATION FORMAT */
	xmlToDom(xml) {
		const parser = new DOMParser();
		const dom = parser.parseFromString(xml, "application/xml");
		return dom;
	}
	getAnnotationsFromXml(xml) {
		const dom = this.xmlToDom(xml);
		return dom.getElementsByTagName("annotation");
	}
	parseYoutubeAnnotationList(annotationElements) {
		const annotations = [];
		for (const el of annotationElements) {
			const parsedAnnotation = this.parseYoutubeAnnotation(el);
			if (parsedAnnotation) annotations.push(parsedAnnotation);
		}
		return annotations;
	}
	parseYoutubeAnnotation(annotationElement) {
		const base = annotationElement;
		const attributes = this.getAttributesFromBase(base);
		if (!attributes.type || attributes.type === "pause") return null;

		const text = this.getTextFromBase(base);
		const action = this.getActionFromBase(base);

		const backgroundShape = this.getBackgroundShapeFromBase(base);
		if (!backgroundShape) return null;
		const timeStart = backgroundShape.timeRange.start;
		const timeEnd = backgroundShape.timeRange.end;

		if (isNaN(timeStart) || isNaN(timeEnd) || timeStart === null || timeEnd === null) {
			return null;
		}

		const appearance = this.getAppearanceFromBase(base);

		// properties the renderer needs
		let annotation = {
			// possible values: text, highlight, pause, branding
			type: attributes.type,
			// x, y, width, and height as percent of video size
			x: backgroundShape.x, 
			y: backgroundShape.y, 
			width: backgroundShape.width, 
			height: backgroundShape.height,
			// what time the annotation is shown in seconds
			timeStart,
			timeEnd
		};
		// properties the renderer can work without
		if (attributes.style) annotation.style = attributes.style;
		if (text) annotation.text = text;
		if (action) annotation = Object.assign(action, annotation);
		if (appearance) annotation = Object.assign(appearance, annotation);

		if (backgroundShape.hasOwnProperty("sx")) annotation.sx = backgroundShape.sx;
		if (backgroundShape.hasOwnProperty("sy")) annotation.sy = backgroundShape.sy;

		return annotation;
	}
	getBackgroundShapeFromBase(base) {
		const movingRegion = base.getElementsByTagName("movingRegion")[0];
		if (!movingRegion) return null;
		const regionType = movingRegion.getAttribute("type");

		const regions = movingRegion.getElementsByTagName(`${regionType}Region`);
		const timeRange = this.extractRegionTime(regions);

		const shape = {
			type: regionType,
			x: parseFloat(regions[0].getAttribute("x"), 10),
			y: parseFloat(regions[0].getAttribute("y"), 10),
			width: parseFloat(regions[0].getAttribute("w"), 10),
			height: parseFloat(regions[0].getAttribute("h"), 10),
			timeRange
		}

		const sx = regions[0].getAttribute("sx");
		const sy = regions[0].getAttribute("sy");

		if (sx) shape.sx = parseFloat(sx, 10);
		if (sy) shape.sy = parseFloat(sy, 10);
		
		return shape;
	}
	getAttributesFromBase(base) {
		const attributes = {};
		attributes.type = base.getAttribute("type");
		attributes.style = base.getAttribute("style");
		return attributes;
	}
	getTextFromBase(base) {
		const textElement = base.getElementsByTagName("TEXT")[0];
		if (textElement) return textElement.textContent;
	}
	getActionFromBase(base) {
		const actionElement = base.getElementsByTagName("action")[0];
		if (!actionElement) return null;
		const typeAttr = actionElement.getAttribute("type");

		const urlElement = actionElement.getElementsByTagName("url")[0];
		if (!urlElement) return null;
		const actionUrlTarget = urlElement.getAttribute("target");
		const href = urlElement.getAttribute("value");
		// only allow links to youtube
		// can be changed in the future
		if (href.startsWith("https://www.youtube.com/")) {
			const url = new URL(href);
			const srcVid = url.searchParams.get("src_vid");
			const toVid = url.searchParams.get("v");

			return this.linkOrTimestamp(url, srcVid, toVid, actionUrlTarget);
		}
	}
	linkOrTimestamp(url, srcVid, toVid, actionUrlTarget) {
		// check if it's a link to a new video
		// or just a timestamp
		if (srcVid && toVid && srcVid === toVid) {
			let seconds = 0;
			const hash = url.hash;
			if (hash && hash.startsWith("#t=")) {
				const timeString = url.hash.split("#t=")[1];
				seconds = this.timeStringToSeconds(timeString);
			}
			return {actionType: "time", actionSeconds: seconds}
		}
		else {
			return {actionType: "url", actionUrl: url.href, actionUrlTarget};
		}
	}
	getAppearanceFromBase(base) {
		const appearanceElement = base.getElementsByTagName("appearance")[0];
		const styles = this.constructor.defaultAppearanceAttributes;

		if (appearanceElement) {
			const bgOpacity = appearanceElement.getAttribute("bgAlpha");
			const bgColor = appearanceElement.getAttribute("bgColor");
			const fgColor = appearanceElement.getAttribute("fgColor");
			const textSize = appearanceElement.getAttribute("textSize");
			// not yet sure what to do with effects 
			// const effects = appearanceElement.getAttribute("effects");

			// 0.00 to 1.00
			if (bgOpacity) styles.bgOpacity = parseFloat(bgOpacity, 10);
			// 0 to 256 ** 3
			if (bgColor) styles.bgColor = parseInt(bgColor, 10);
			if (fgColor) styles.fgColor = parseInt(fgColor, 10);
			// 0.00 to 100.00?
			if (textSize) styles.textSize = parseFloat(textSize, 10);
		}

		return styles;
	}

	/* helper functions */
	extractRegionTime(regions) {
		let timeStart = regions[0].getAttribute("t");
		timeStart = this.hmsToSeconds(timeStart);

		let timeEnd = regions[regions.length - 1].getAttribute("t");
		timeEnd = this.hmsToSeconds(timeEnd);

		return {start: timeStart, end: timeEnd}
	}
	// https://stackoverflow.com/a/9640417/10817894
	hmsToSeconds(hms) {
	    let p = hms.split(":");
	    let s = 0;
	    let m = 1;

	    while (p.length > 0) {
	        s += m * parseFloat(p.pop(), 10);
	        m *= 60;
	    }
	    return s;
	}
	timeStringToSeconds(time) {
		let seconds = 0;

		const h = time.split("h");
	  	const m = (h[1] || time).split("m");
	  	const s = (m[1] || time).split("s");
		  
	  	if (h[0] && h.length === 2) seconds += parseInt(h[0], 10) * 60 * 60;
	  	if (m[0] && m.length === 2) seconds += parseInt(m[0], 10) * 60;
	  	if (s[0] && s.length === 2) seconds += parseInt(s[0], 10);

		return seconds;
	}
	getKeyByValue(obj, value) {
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (obj[key] === value) {
					return key;
				}
			}
		}
	}
}
class AnnotationRenderer {
	constructor(annotations, container, playerOptions, updateInterval = 1000) {
		if (!annotations) throw new Error("Annotation objects must be provided");
		if (!container) throw new Error("An element to contain the annotations must be provided");

		if (playerOptions && playerOptions.getVideoTime && playerOptions.seekTo) {
			this.playerOptions = playerOptions;
		}
		else {
			console.info("AnnotationRenderer is running without a player. The update method will need to be called manually.");
		}

		this.annotations = annotations;
		this.container = container;

		this.annotationsContainer = document.createElement("div");
		this.annotationsContainer.classList.add("__cxt-ar-annotations-container__");
		this.annotationsContainer.setAttribute("data-layer", "4");
		this.annotationsContainer.addEventListener("click", e => {
			this.annotationClickHandler(e);
		});
		this.container.prepend(this.annotationsContainer);

		this.createAnnotationElements();

		// in case the dom already loaded
		this.updateAllAnnotationSizes();
		window.addEventListener("DOMContentLoaded", e => {
			this.updateAllAnnotationSizes();
		});

		this.updateInterval = updateInterval;
		this.updateIntervalId = null;
	}
	changeAnnotationData(annotations) {
		this.stop();
		this.removeAnnotationElements();
		this.annotations = annotations;
		this.createAnnotationElements();
		this.start();
	}
	createAnnotationElements() {
		for (const annotation of this.annotations) {
			const el = document.createElement("div");
			el.classList.add("__cxt-ar-annotation__");

			annotation.__element = el;
			el.__annotation = annotation;

			// close button
			const closeButton = this.createCloseElement();
			closeButton.addEventListener("click", e => {
				el.setAttribute("hidden", "");
				el.setAttribute("data-ar-closed", "");
				if (el.__annotation.__speechBubble) {
					const speechBubble = el.__annotation.__speechBubble;
					speechBubble.style.display = "none";
				}
			});
			el.append(closeButton);

			if (annotation.text) {
				const textNode = document.createElement("span");
				textNode.textContent = annotation.text;
				el.append(textNode);
				el.setAttribute("data-ar-has-text", "");
			}

			if (annotation.style === "speech") {
				const containerDimensions = this.container.getBoundingClientRect();
				const speechX = this.percentToPixels(containerDimensions.width, annotation.x);
				const speechY = this.percentToPixels(containerDimensions.height, annotation.y);

				const speechWidth = this.percentToPixels(containerDimensions.width, annotation.width);
				const speechHeight = this.percentToPixels(containerDimensions.height, annotation.height);

				const speechPointX = this.percentToPixels(containerDimensions.width, annotation.sx);
				const speechPointY = this.percentToPixels(containerDimensions.height, annotation.sy);

				const bubbleColor = this.getFinalAnnotationColor(annotation, false);
				const bubble = this.createSvgSpeechBubble(speechX, speechY, speechWidth, speechHeight, speechPointX, speechPointY, bubbleColor, annotation.__element);
				bubble.style.display = "none";
				bubble.style.overflow = "visible";
				el.style.pointerEvents = "none";
				bubble.__annotationEl = el;
				annotation.__speechBubble = bubble;

				const path = bubble.getElementsByTagName("path")[0];
				path.addEventListener("mouseover", () => {
					closeButton.style.display = "block";
					// path.style.cursor = "pointer";
					closeButton.style.cursor = "pointer";
					path.setAttribute("fill", this.getFinalAnnotationColor(annotation, true));
				});
				path.addEventListener("mouseout", e => {
					if (!e.relatedTarget.classList.contains("__cxt-ar-annotation-close__")) {
						closeButton.style.display ="none";
						// path.style.cursor = "default";
						closeButton.style.cursor = "default";
						path.setAttribute("fill", this.getFinalAnnotationColor(annotation, false));
					}
				});

				closeButton.addEventListener("mouseleave", () => {
					closeButton.style.display = "none";
					path.style.cursor = "default";
					closeButton.style.cursor = "default";
					path.setAttribute("fill", this.getFinalAnnotationColor(annotation, false));
				});

				el.prepend(bubble);
			}
			else if (annotation.type === "highlight") {
				el.style.backgroundColor = "";
				el.style.border = `2.5px solid ${this.getFinalAnnotationColor(annotation, false)}`;
				if (annotation.actionType === "url")
					el.style.cursor = "pointer";
			}
			else if (annotation.style !== "title") {
				el.style.backgroundColor = this.getFinalAnnotationColor(annotation);
				el.addEventListener("mouseenter", () => {
					el.style.backgroundColor = this.getFinalAnnotationColor(annotation, true);
				});
				el.addEventListener("mouseleave", () => {
					el.style.backgroundColor = this.getFinalAnnotationColor(annotation, false);
				});
				if (annotation.actionType === "url")
					el.style.cursor = "pointer";
			}

			el.style.color = `#${this.decimalToHex(annotation.fgColor)}`;

			el.setAttribute("data-ar-type", annotation.type);
			el.setAttribute("hidden", "");
			this.annotationsContainer.append(el);
		}
	}
	createCloseElement() {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", "0 0 100 100")
		svg.classList.add("__cxt-ar-annotation-close__");

		const path = document.createElementNS(svg.namespaceURI, "path");
		path.setAttribute("d", "M25 25 L 75 75 M 75 25 L 25 75");
		path.setAttribute("stroke", "#bbb");
		path.setAttribute("stroke-width", 10)
		path.setAttribute("x", 5);
		path.setAttribute("y", 5);

		const circle = document.createElementNS(svg.namespaceURI, "circle");
		circle.setAttribute("cx", 50);
		circle.setAttribute("cy", 50);
		circle.setAttribute("r", 50);

		svg.append(circle, path);
		return svg;
	}
	createSvgSpeechBubble(x, y, width, height, pointX, pointY, color = "white", element, svg) {

		const horizontalBaseStartMultiplier = 0.17379070765180116;
		const horizontalBaseEndMultiplier = 0.14896346370154384;

		const verticalBaseStartMultiplier = 0.12;
		const verticalBaseEndMultiplier = 0.3;

		let path;

		if (!svg) {
			svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.classList.add("__cxt-ar-annotation-speech-bubble__");

			path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("fill", color);
			svg.append(path);
		}
		else {
			path = svg.children[0];
		}

		svg.style.position = "absolute";
		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");
		svg.style.left = "0";
		svg.style.top = "0";

		let positionStart;

		let baseStartX = 0;
		let baseStartY = 0;

		let baseEndX = 0;
		let baseEndY = 0;

		let pointFinalX = pointX;
		let pointFinalY = pointY;

		let commentRectPath;
		const pospad = 20;

		let textWidth = 0;
		let textHeight = 0;
		let textX = 0;
		let textY = 0;

		let textElement;
		let closeElement;

		if (element) {
			textElement = element.getElementsByTagName("span")[0];
			closeElement = element.getElementsByClassName("__cxt-ar-annotation-close__")[0];
		}

		if (pointX > ((x + width) - (width / 2)) && pointY > y + height) {
			positionStart = "br";
			baseStartX = width - ((width * horizontalBaseStartMultiplier) * 2);
			baseEndX = baseStartX + (width * horizontalBaseEndMultiplier);
			baseStartY = height;
			baseEndY = height;

			pointFinalX = pointX - x;
			pointFinalY = pointY - y;
			element.style.height = pointY - y;
			commentRectPath = `L${width} ${height} L${width} 0 L0 0 L0 ${baseStartY} L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = 0;
			}
		}
		else if (pointX < ((x + width) - (width / 2)) && pointY > y + height) {
			positionStart = "bl";
			baseStartX = width * horizontalBaseStartMultiplier;
			baseEndX = baseStartX + (width * horizontalBaseEndMultiplier);
			baseStartY = height;
			baseEndY = height;

			pointFinalX = pointX - x;
			pointFinalY = pointY - y;
			element.style.height = `${pointY - y}px`;
			commentRectPath = `L${width} ${height} L${width} 0 L0 0 L0 ${baseStartY} L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = 0;
			}
		}
		else if (pointX > ((x + width) - (width / 2)) && pointY < (y - pospad)) {
			positionStart = "tr";
			baseStartX = width - ((width * horizontalBaseStartMultiplier) * 2);
			baseEndX = baseStartX + (width * horizontalBaseEndMultiplier);

			const yOffset = y - pointY;
			baseStartY = yOffset;
			baseEndY = yOffset;
			element.style.top = y - yOffset + "px";
			element.style.height = height + yOffset + "px";

			pointFinalX = pointX - x;
			pointFinalY = 0;
			commentRectPath = `L${width} ${yOffset} L${width} ${height + yOffset} L0 ${height + yOffset} L0 ${yOffset} L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = yOffset;
			}
		}
		else if (pointX < ((x + width) - (width / 2)) && pointY < y) {
			positionStart = "tl";
			baseStartX = width * horizontalBaseStartMultiplier;
			baseEndX = baseStartX + (width * horizontalBaseEndMultiplier);

			const yOffset = y - pointY;
			baseStartY = yOffset;
			baseEndY = yOffset;
			element.style.top = y - yOffset + "px";
			element.style.height = height + yOffset + "px";

			pointFinalX = pointX - x;
			pointFinalY = 0;
			commentRectPath = `L${width} ${yOffset} L${width} ${height + yOffset} L0 ${height + yOffset} L0 ${yOffset} L${baseStartX} ${baseStartY}`;

			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = yOffset;
			}
		}
		else if (pointX > (x + width) && pointY > (y - pospad) && pointY < ((y + height) - pospad)) {
			positionStart = "r";

			const xOffset = pointX - (x + width);

			baseStartX = width;
			baseEndX = width;

			element.style.width = width + xOffset + "px";

			baseStartY = height * verticalBaseStartMultiplier;
			baseEndY = baseStartY + (height * verticalBaseEndMultiplier);

			pointFinalX = width + xOffset;
			pointFinalY = pointY - y;
			commentRectPath = `L${baseStartX} ${height} L0 ${height} L0 0 L${baseStartX} 0 L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = 0;
			}
		}
		else if (pointX < x && pointY > y && pointY < (y + height)) {
			positionStart = "l";

			const xOffset = x - pointX;

			baseStartX = xOffset;
			baseEndX = xOffset;

			element.style.left = x - xOffset + "px";
			element.style.width = width + xOffset + "px";

			baseStartY = height * verticalBaseStartMultiplier;
			baseEndY = baseStartY + (height * verticalBaseEndMultiplier);

			pointFinalX = 0;
			pointFinalY = pointY - y;
			commentRectPath = `L${baseStartX} ${height} L${width + baseStartX} ${height} L${width + baseStartX} 0 L${baseStartX} 0 L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = xOffset;
				textY = 0;
			}
		}
		else {
			return svg;
		}

		if (textElement) {
			textElement.style.left = textX + "px";
			textElement.style.top = textY + "px";
			textElement.style.width = textWidth + "px";
			textElement.style.height = textHeight + "px";
		}
		if (closeElement) {
			const closeSize = parseFloat(this.annotationsContainer.style.getPropertyValue("--annotation-close-size"), 10);
			if (closeSize) {
				closeElement.style.left = ((textX + textWidth) + (closeSize / -1.8)) + "px";
				closeElement.style.top = (textY + (closeSize / -1.8)) + "px";
			}
		}

		const pathData = `M${baseStartX} ${baseStartY} L${pointFinalX} ${pointFinalY} L${baseEndX} ${baseEndY} ${commentRectPath}`;
		path.setAttribute("d", pathData);

		return svg;
	}
	getFinalAnnotationColor(annotation, hover = false) {
		const alphaHex = hover ? (0xE6).toString(16) : Math.floor((annotation.bgOpacity * 255)).toString(16);
		if (!isNaN(annotation.bgColor)) {
			const bgColorHex = this.decimalToHex(annotation.bgColor);

			const backgroundColor = `#${bgColorHex}${alphaHex}`;
			return backgroundColor;
		}
	}
	removeAnnotationElements() {
		for (const annotation of this.annotations) {
			annotation.__element.remove();
		}
	}
	update(videoTime) {
		for (const annotation of this.annotations) {
			const el = annotation.__element;
			if (el.hasAttribute("data-ar-closed")) continue;
			const start = annotation.timeStart;
			const end = annotation.timeEnd;

			if (el.hasAttribute("hidden") && (videoTime >= start && videoTime < end)) {
				el.removeAttribute("hidden");
				if (annotation.style === "speech" && annotation.__speechBubble) {
					annotation.__speechBubble.style.display = "block";
				}
			}
			else if (!el.hasAttribute("hidden") && (videoTime < start || videoTime > end)) {
				el.setAttribute("hidden", "");
				if (annotation.style === "speech" && annotation.__speechBubble) {
					annotation.__speechBubble.style.display = "none";
				}
			}
		}
	}
	start() {
		if (!this.playerOptions) throw new Error("playerOptions must be provided to use the start method");

		const videoTime = this.playerOptions.getVideoTime();
		if (!this.updateIntervalId) {
			this.update(videoTime);
			this.updateIntervalId = setInterval(() => {
				const videoTime = this.playerOptions.getVideoTime();
				this.update(videoTime);
				window.dispatchEvent(new CustomEvent("__ar_renderer_start"));
			}, this.updateInterval);
		}
	}
	stop() {
		if (!this.playerOptions) throw new Error("playerOptions must be provided to use the stop method");

		const videoTime = this.playerOptions.getVideoTime();
		if (this.updateIntervalId) {
			this.update(videoTime);
			clearInterval(this.updateIntervalId);
			this.updateIntervalId = null;
			window.dispatchEvent(new CustomEvent("__ar_renderer_stop"));
		}
	}

	updateAnnotationTextSize(annotation, containerHeight) {
		if (annotation.textSize) {
			const textSize = (annotation.textSize / 100) * containerHeight;
			annotation.__element.style.fontSize = `${textSize}px`;
		}
	}
	updateTextSize() {
		const containerHeight = this.container.getBoundingClientRect().height;
		// should be run when the video resizes
		for (const annotation of this.annotations) {
			this.updateAnnotationTextSize(annotation, containerHeight);
		}
	}
	updateCloseSize(containerHeight) {
		if (!containerHeight) containerHeight = this.container.getBoundingClientRect().height;
		const multiplier = 0.0423;
		this.annotationsContainer.style.setProperty("--annotation-close-size", `${containerHeight * multiplier}px`);
	}
	updateAnnotationDimensions(annotations, videoWidth, videoHeight) {
		const playerWidth = this.container.getBoundingClientRect().width;
		const playerHeight = this.container.getBoundingClientRect().height;

		const widthDivider = playerWidth / videoWidth;
		const heightDivider = playerHeight / videoHeight;

		let scaledVideoWidth = playerWidth;
		let scaledVideoHeight = playerHeight;

		if (widthDivider % 1 !== 0 || heightDivider % 1 !== 0) {
			// vertical bars
			if (widthDivider > heightDivider) {
				scaledVideoWidth = (playerHeight / videoHeight) * videoWidth;
				scaledVideoHeight = playerHeight;
			}
			// horizontal bars
			else if (heightDivider > widthDivider) {
				scaledVideoWidth = playerWidth;
				scaledVideoHeight = (playerWidth / videoWidth) * videoHeight;
			}
		}

		const verticalBlackBarWidth = (playerWidth - scaledVideoWidth) / 2;
		const horizontalBlackBarHeight = (playerHeight - scaledVideoHeight) / 2;

		const widthOffsetPercent = (verticalBlackBarWidth / playerWidth * 100);
		const heightOffsetPercent = (horizontalBlackBarHeight / playerHeight * 100);

		const widthMultiplier = (scaledVideoWidth / playerWidth);
		const heightMultiplier = (scaledVideoHeight / playerHeight);

		for (const annotation of annotations) {
			const el = annotation.__element;

			let ax = widthOffsetPercent + (annotation.x * widthMultiplier);
			let ay = heightOffsetPercent + (annotation.y * heightMultiplier);
			let aw = annotation.width * widthMultiplier;
			let ah = annotation.height * heightMultiplier;

			el.style.left = `${ax}%`;
			el.style.top = `${ay}%`;

			el.style.width = `${aw}%`;
			el.style.height = `${ah}%`;

			let horizontalPadding = scaledVideoWidth * 0.008;
			let verticalPadding = scaledVideoHeight * 0.008;

			if (annotation.style === "speech" && annotation.text) {
				const pel = annotation.__element.getElementsByTagName("span")[0];
				horizontalPadding *= 2;
				verticalPadding *= 2;

				pel.style.paddingLeft = horizontalPadding + "px";
				pel.style.paddingRight = horizontalPadding + "px";
				pel.style.paddingBottom = verticalPadding + "px";
				pel.style.paddingTop = verticalPadding + "px";
			}
			else if (annotation.style !== "speech") {
				el.style.paddingLeft = horizontalPadding + "px";
				el.style.paddingRight = horizontalPadding + "px";
				el.style.paddingBottom = verticalPadding + "px";
				el.style.paddingTop = verticalPadding + "px";
			}

			if (annotation.__speechBubble) {
				const asx = this.percentToPixels(playerWidth, ax);
				const asy = this.percentToPixels(playerHeight, ay);
				const asw = this.percentToPixels(playerWidth, aw);
				const ash = this.percentToPixels(playerHeight, ah);

				let sx = widthOffsetPercent + (annotation.sx * widthMultiplier);
				let sy = heightOffsetPercent + (annotation.sy * heightMultiplier);
				sx = this.percentToPixels(playerWidth, sx);
				sy = this.percentToPixels(playerHeight, sy);

				this.createSvgSpeechBubble(asx, asy, asw, ash, sx, sy, null, annotation.__element, annotation.__speechBubble);
			}

			this.updateAnnotationTextSize(annotation, scaledVideoHeight);
			this.updateCloseSize(scaledVideoHeight);
		}
	}

	updateAllAnnotationSizes() {
		if (this.playerOptions && this.playerOptions.getOriginalVideoWidth && this.playerOptions.getOriginalVideoHeight) {
			const videoWidth = this.playerOptions.getOriginalVideoWidth();
			const videoHeight = this.playerOptions.getOriginalVideoHeight();
			this.updateAnnotationDimensions(this.annotations, videoWidth, videoHeight);
		}
		else {
			const playerWidth = this.container.getBoundingClientRect().width;
			const playerHeight = this.container.getBoundingClientRect().height;
			this.updateAnnotationDimensions(this.annotations, playerWidth, playerHeight);
		}
	}

	hideAll() {
		for (const annotation of this.annotations) {
			annotation.__element.setAttribute("hidden", "");
		}
	}
	annotationClickHandler(e) {
		let annotationElement = e.target;
		// if we click on annotation text instead of the actual annotation element
		if (!annotationElement.matches(".__cxt-ar-annotation__") && !annotationElement.closest(".__cxt-ar-annotation-close__")) {
			annotationElement = annotationElement.closest(".__cxt-ar-annotation__");
			if (!annotationElement) return null;
		} 
		let annotationData = annotationElement.__annotation;

		if (!annotationElement || !annotationData) return;

		if (annotationData.actionType === "time") {
			const seconds = annotationData.actionSeconds;
			if (this.playerOptions) {
				this.playerOptions.seekTo(seconds);
				const videoTime = this.playerOptions.getVideoTime();
				this.update(videoTime);
			}
			window.dispatchEvent(new CustomEvent("__ar_seek_to", {detail: {seconds}}));
		}
		else if (annotationData.actionType === "url") {
			const data = {url: annotationData.actionUrl, target: annotationData.actionUrlTarget || "current"};

			const timeHash = this.extractTimeHash(new URL(data.url));
			if (timeHash && timeHash.hasOwnProperty("seconds")) {
				data.seconds = timeHash.seconds;
			}
			window.dispatchEvent(new CustomEvent("__ar_annotation_click", {detail: data}));
		}
	}

	setUpdateInterval(ms) {
		this.updateInterval = ms;
		this.stop();
		this.start();
	}
	// https://stackoverflow.com/a/3689638/10817894
	decimalToHex(dec) {
		let hex = dec.toString(16);
		hex = "000000".substr(0, 6 - hex.length) + hex; 
		return hex;
	}
	extractTimeHash(url) {
		if (!url) throw new Error("A URL must be provided");
		const hash = url.hash;

		if (hash && hash.startsWith("#t=")) {
			const timeString = url.hash.split("#t=")[1];
			const seconds = this.timeStringToSeconds(timeString);
			return {seconds};
		}
		else {
			return false;
		}
	}
	timeStringToSeconds(time) {
		let seconds = 0;

		const h = time.split("h");
	  	const m = (h[1] || time).split("m");
	  	const s = (m[1] || time).split("s");
		  
	  	if (h[0] && h.length === 2) seconds += parseInt(h[0], 10) * 60 * 60;
	  	if (m[0] && m.length === 2) seconds += parseInt(m[0], 10) * 60;
	  	if (s[0] && s.length === 2) seconds += parseInt(s[0], 10);

		return seconds;
	}
	percentToPixels(a, b) {
		return a * b / 100;
	}
}
function youtubeAnnotationsPlugin(options) {
	if (!options.annotationXml) throw new Error("Annotation data must be provided");
	if (!options.videoContainer) throw new Error("A video container to overlay the data on must be provided");

	const player = this;

	const xml = options.annotationXml;
	const parser = new AnnotationParser();
	const annotationElements = parser.getAnnotationsFromXml(xml);
	const annotations = parser.parseYoutubeAnnotationList(annotationElements);

	const videoContainer = options.videoContainer;

	const playerOptions = {
		getVideoTime() {
			return player.currentTime();
		},
		seekTo(seconds) {
			player.currentTime(seconds);
		},
		getOriginalVideoWidth() {
			return player.videoWidth();
		},
		getOriginalVideoHeight() {
			return player.videoHeight();
		}
	};

	raiseControls();
	const renderer = new AnnotationRenderer(annotations, videoContainer, playerOptions, options.updateInterval);
	setupEventListeners(player, renderer);
	renderer.start();
}

function setupEventListeners(player, renderer) {
	if (!player) throw new Error("A video player must be provided");
	// should be throttled for performance
	player.on("playerresize", e => {
		renderer.updateAllAnnotationSizes(renderer.annotations);
	});
	// Trigger resize since the video can have different dimensions than player
	player.one("loadedmetadata", e => {
		renderer.updateAllAnnotationSizes(renderer.annotations);
	});

	player.on("pause", e => {
		renderer.stop();
	});
	player.on("play", e => {
		renderer.start();
	});
	player.on("seeking", e => {
		renderer.update();
	});
	player.on("seeked", e => {
		renderer.update();
	});
}

function raiseControls() {
	const styles = document.createElement("style");
	styles.textContent = `
	.vjs-control-bar {
		z-index: 21;
	}
	`;
	document.body.append(styles);
}