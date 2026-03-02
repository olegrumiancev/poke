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
    autoplay: true,
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

  let cachedInnerVideoEl = null;
  function getPlayableVideoEl() {
    try {
      if (videoEl && typeof videoEl.play === "function") return videoEl;
    } catch {}

    try {
      if (cachedInnerVideoEl && typeof cachedInnerVideoEl.play === "function") return cachedInnerVideoEl;
      const inner = player?.el?.()?.querySelector?.("video");
      if (inner && typeof inner.play === "function") {
        cachedInnerVideoEl = inner;
        return inner;
      }
    } catch {}

    return null;
  }

  function getVideoNode() {
    return getPlayableVideoEl() || videoEl;
  }

  function clamp01(v) {
    v = Number(v);
    if (!isFinite(v)) return 1;
    return Math.max(0, Math.min(1, v));
  }

  function now() {
    return performance.now();
  }

  const platform = (() => {
    try {
      const isFirefox = (() => {
        try { return CSS.supports("-moz-orient", "horizontal"); } catch { return false; }
      })();

      const isChromium = (() => {
        if (isFirefox) return false;
        try {
          const hasChrome = typeof window.chrome !== "undefined" && window.chrome !== null;
          const hasChromeCSS = CSS.supports("overflow", "overlay");
          return hasChrome && hasChromeCSS;
        } catch { return false; }
      })();

      const isIosWebKit = (() => {
        if (isFirefox) return false;
        try {
          return (typeof GestureEvent !== "undefined" && navigator.maxTouchPoints > 1);
        } catch { return false; }
      })();

      const mobile = (() => {
        try {
          if (typeof navigator.userAgentData?.mobile === "boolean") return navigator.userAgentData.mobile;
        } catch {}
        try {
          return navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches;
        } catch {}
        return false;
      })();

      return {
        mobile: !!mobile,
        ios: !!isIosWebKit,
        android: !!(isChromium && mobile && !isIosWebKit),
        isFirefox: !!isFirefox,
        isChromium: !!isChromium,
        desktopChromiumLike: !!(isChromium && !mobile),
        iosWebKitLike: !!isIosWebKit
      };
    } catch {
      return {
        mobile: false,
        ios: false,
        android: false,
        isFirefox: false,
        isChromium: false,
        desktopChromiumLike: false,
        iosWebKitLike: false
      };
    }
  })();

  function pickAudioSrc() {
    try {
      const s = audioEl?.getAttribute?.("src");
      if (s) return s;
    } catch {}

    try {
      const child = audioEl?.querySelector?.("source");
      if (child?.getAttribute?.("src")) return child.getAttribute("src");
    } catch {}

    try {
      if (audioEl?.currentSrc) return audioEl.currentSrc;
    } catch {}

    return null;
  }

  const hasExternalAudio = !!audioEl && audioEl.tagName === "AUDIO" && !!pickAudioSrc();
  const coupledMode = hasExternalAudio && qua !== "medium";

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
    try {
      if (videoEl.loop) return true;
      if (videoEl.hasAttribute("loop")) return true;
    } catch {}

    try {
      const q = (qs.get("loop") || "").toLowerCase();
      if (q === "1" || q === "true") return true;
    } catch {}

    try { if (window.forceLoop === true) return true; } catch {}
    return false;
  }

  // -----------------------------
  // Title bar (unchanged behavior)
  // -----------------------------
  player.ready(() => {
    const metaTitle = document.querySelector('meta[name="title"]')?.content || "";
    const metaDesc = document.querySelector('meta[name="twitter:description"]')?.content || "";
    let stats = "";

    const statsMatch = metaDesc.match(/👍\s*[\d.KMB]+\s*(?:\|)?\s*👎\s*[\d.KMB]+\s*(?:\|)?\s*📈\s*[\d.KMB]+\s*(?:Views?)?/i);
    if (statsMatch) stats = statsMatch[0].replace(/\s*\|\s*/g, " | ").trim();

    const createTitleBar = () => {
      const existing = player.getChild("TitleBar");
      if (!existing) {
        const titleBar = player.addChild("TitleBar");
        titleBar.update({ title: metaTitle, description: stats });
      }
    };

    const removeTitleBar = () => {
      const existing = player.getChild("TitleBar");
      if (existing) player.removeChild(existing);
    };

    const onFullscreenChange = () => {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) createTitleBar();
      else removeTitleBar();
    };

    document.addEventListener("fullscreenchange", onFullscreenChange, { passive: true });
    document.addEventListener("webkitfullscreenchange", onFullscreenChange, { passive: true });
    onFullscreenChange();
  });

  // -----------------------------------------
  // Core goals:
  // - No volume hard-jumps (prevents pops)
  // - No play/pause spam loops
  // - MediaSession pause always works (even hidden)
  // - Autoplay uses robust retry with user-gesture fallback
  // - Background Chromium "no-audio-track" pause is handled by resync on return
  // -----------------------------------------

  const state = {
    intendedPlaying: false,
    userPaused: false,
    seeking: false,
    syncing: false,
    hiddenSince: 0,
    wasPlayingOnHide: false,
    expectedVideoBgPause: false,
    autoplayAttempted: false,
    autoplaySucceeded: false,
    autoplayBlocked: false,
    pendingUserGestureResume: false,
    lastSyncAt: 0,
    syncTimer: null,
    syncDelayMs: 250,
    lastKnownGoodVT: 0,
    lastKnownGoodVTts: 0,
    audioPlayPromise: null,
    volumeRampRaf: null,
    volumeRampTarget: 1,
    volumeRampFrom: 1,
    volumeRampStart: 0,
    volumeRampMs: 0,
    audioFadeGuardUntil: 0,
    mediaSessionActionSerial: 0,
    positionStateNextAt: 0
  };

  const HAVE_FUTURE_DATA = 3;
  const HAVE_ENOUGH_DATA = 4;

  const MICRO_DRIFT = 0.12;
  const BIG_DRIFT = 1.25;

  const VOLUME_RAMP_MS = 120;
  const SEEK_FADE_OUT_MS = 80;
  const SEEK_FADE_IN_MS = 140;
  const PAUSE_FADE_OUT_MS = 70;
  const START_FADE_IN_MS = 180;

  const AUTOPLAY_RETRY_MS = 700;
  const AUTOPLAY_RETRY_MAX = 6;

  function safeGetVideoPaused() {
    try { if (typeof player.paused === "function") return !!player.paused(); } catch {}
    try { return !!getVideoNode().paused; } catch {}
    return true;
  }

  function safeGetAudioPaused() {
    try { if (!audioEl) return true; return !!audioEl.paused; } catch {}
    return true;
  }

  function safeGetVT() {
    try {
      const vt = Number(player.currentTime());
      return isFinite(vt) ? vt : 0;
    } catch {}

    try {
      const v = getVideoNode();
      const vt = Number(v.currentTime);
      return isFinite(vt) ? vt : 0;
    } catch {}

    return 0;
  }

  function safeGetAT() {
    if (!audioEl) return 0;
    try {
      const at = Number(audioEl.currentTime);
      return isFinite(at) ? at : 0;
    } catch {}
    return 0;
  }

  function safeSetVT(t) {
    if (!isFinite(t) || t < 0) return;
    try { player.currentTime(t); } catch {}
    try { getVideoNode().currentTime = t; } catch {}
  }

  function safeSetAT(t) {
    if (!audioEl) return;
    if (!isFinite(t) || t < 0) return;
    try { audioEl.currentTime = t; } catch {}
  }

  function safeGetDuration() {
    try {
      const d = Number(player.duration());
      return isFinite(d) ? d : 0;
    } catch {}
    try {
      const d = Number(getVideoNode().duration);
      return isFinite(d) ? d : 0;
    } catch {}
    return 0;
  }

  function clampTime(t) {
    const dur = safeGetDuration();
    if (dur > 0 && isFinite(t)) return Math.min(Math.max(0, t), Math.max(0, dur - 0.25));
    return Math.max(0, t);
  }

  function bufferedAhead(media, t) {
    try {
      if (!media || !media.buffered || media.buffered.length === 0) return 0;
      for (let i = 0; i < media.buffered.length; i++) {
        const s = media.buffered.start(i);
        const e = media.buffered.end(i);
        if (t >= s && t <= e) return Math.max(0, e - t);
      }
    } catch {}
    return 0;
  }

  function canPlaySmoothAt(media, t, minAheadSec) {
    try {
      if (!media || !isFinite(t)) return false;
      const rs = Number(media.readyState || 0);
      const ahead = bufferedAhead(media, t);
      if (rs >= HAVE_ENOUGH_DATA) return true;
      if (rs >= HAVE_FUTURE_DATA && ahead >= Math.min(0.10, minAheadSec)) return true;
      return ahead >= minAheadSec;
    } catch {}
    return false;
  }

  function videoHasAudioTrack() {
    const v = getVideoNode();
    try {
      if (typeof v.mozHasAudio === "boolean") return v.mozHasAudio;
    } catch {}
    try {
      if (typeof v.webkitAudioDecodedByteCount === "number" && v.webkitAudioDecodedByteCount > 0) return true;
    } catch {}
    try {
      if (v.audioTracks && v.audioTracks.length > 0) return true;
    } catch {}
    return false;
  }

  function computeTargetAudioVolume() {
    const vVol = clamp01(typeof player.volume === "function" ? player.volume() : (videoEl.volume ?? 1));
    const vMuted = !!(typeof player.muted === "function" ? player.muted() : videoEl.muted);
    return vMuted ? 0 : vVol;
  }

  function cancelVolumeRamp() {
    if (state.volumeRampRaf) {
      cancelAnimationFrame(state.volumeRampRaf);
      state.volumeRampRaf = null;
    }
  }

  function rampAudioVolume(target, ms = VOLUME_RAMP_MS) {
    if (!audioEl) return;

    target = clamp01(target);

    const from = clamp01(audioEl.volume);
    if (Math.abs(target - from) < 0.001 || ms <= 0 || document.visibilityState === "hidden") {
      try { audioEl.volume = target; } catch {}
      return;
    }

    cancelVolumeRamp();
    state.volumeRampFrom = from;
    state.volumeRampTarget = target;
    state.volumeRampStart = now();
    state.volumeRampMs = Math.max(1, Number(ms) || VOLUME_RAMP_MS);

    const step = () => {
      const t = (now() - state.volumeRampStart) / state.volumeRampMs;
      const p = Math.max(0, Math.min(1, t));
      const ease = p * p * (3 - 2 * p);
      const val = state.volumeRampFrom + (state.volumeRampTarget - state.volumeRampFrom) * ease;
      try { audioEl.volume = clamp01(val); } catch {}

      if (p < 1) {
        state.volumeRampRaf = requestAnimationFrame(step);
      } else {
        state.volumeRampRaf = null;
      }
    };

    state.volumeRampRaf = requestAnimationFrame(step);
  }

  async function fadeAudioOut(ms = PAUSE_FADE_OUT_MS) {
    if (!audioEl) return;
    const target = 0;
    rampAudioVolume(target, ms);
    state.audioFadeGuardUntil = now() + ms + 80;
    await new Promise(r => setTimeout(r, ms + 20));
  }

  async function fadeAudioIn(ms = START_FADE_IN_MS) {
    if (!audioEl) return;
    const target = computeTargetAudioVolume();
    const from = clamp01(audioEl.volume);
    if (from > 0.001 && Math.abs(target - from) < 0.01) return;
    try { audioEl.volume = 0; } catch {}
    rampAudioVolume(target, ms);
    state.audioFadeGuardUntil = now() + ms + 80;
  }

  function audioFadeGuardActive() {
    return now() < state.audioFadeGuardUntil;
  }

  async function ensureMediaReady(media, minRS = 2, timeoutMs = 2500) {
    return new Promise(resolve => {
      if (!media) return resolve(false);

      let done = false;
      let to = null;

      const finish = ok => {
        if (done) return;
        done = true;
        try { if (to) clearTimeout(to); } catch {}
        try { media.removeEventListener("canplay", onEvt); } catch {}
        try { media.removeEventListener("loadeddata", onEvt); } catch {}
        try { media.removeEventListener("canplaythrough", onEvt); } catch {}
        resolve(!!ok);
      };

      const onEvt = () => {
        try {
          if (Number(media.readyState || 0) >= minRS) finish(true);
        } catch {}
      };

      try {
        if (Number(media.readyState || 0) >= minRS) return resolve(true);
      } catch {}

      try { media.addEventListener("canplay", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("loadeddata", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("canplaythrough", onEvt, { once: true, passive: true }); } catch {}

      to = setTimeout(() => finish(false), Math.max(300, Number(timeoutMs) || 0));
    });
  }

  async function safePlay(media) {
    if (!media || typeof media.play !== "function") return { ok: false, err: null };
    try {
      const p = media.play();
      await Promise.resolve(p);
      return { ok: true, err: null };
    } catch (err) {
      return { ok: false, err };
    }
  }

  function safePause(media) {
    if (!media || typeof media.pause !== "function") return;
    try { media.pause(); } catch {}
  }

  function updateLastKnownGoodVT() {
    const vt = safeGetVT();
    if (isFinite(vt) && vt > 0.05) {
      state.lastKnownGoodVT = vt;
      state.lastKnownGoodVTts = now();
    }
  }

  function bestResumePos() {
    const vt = safeGetVT();
    const at = coupledMode ? safeGetAT() : vt;

    const hasSaved = state.lastKnownGoodVT > 0.5 && (now() - state.lastKnownGoodVTts) < 30000;
    const bothAtStart = vt < 0.5 && (!coupledMode || at < 0.5);

    if (bothAtStart && hasSaved) return state.lastKnownGoodVT;
    if (coupledMode && isFinite(at) && at > 0.5 && (vt < 0.5 || at > vt + 0.3)) return at;
    if (isFinite(vt) && vt > 0) return vt;
    return state.lastKnownGoodVT || 0;
  }

  function setMediaSessionPlaybackState() {
    if (!("mediaSession" in navigator)) return;

    // Important: reflect actual playback, not just intention, to prevent control loops.
    const actuallyPlaying = (() => {
      const vp = safeGetVideoPaused();
      const ap = coupledMode ? safeGetAudioPaused() : vp;
      return !vp && !ap;
    })();

    try {
      navigator.mediaSession.playbackState = actuallyPlaying ? "playing" : "paused";
    } catch {}
  }

  function updateMediaSessionPosition() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (now() < state.positionStateNextAt) return;
    state.positionStateNextAt = now() + 1000;

    const vt = safeGetVT();
    try {
      navigator.mediaSession.setPositionState({
        duration: safeGetDuration(),
        playbackRate: Number(player.playbackRate?.() || 1) || 1,
        position: vt
      });
    } catch {}
  }

  async function pauseAll(reason = "") {
    state.intendedPlaying = false;
    state.userPaused = true;
    state.pendingUserGestureResume = false;

    if (coupledMode && audioEl) {
      // Fade quickly to avoid stopping waveform mid-cycle (pops).
      await fadeAudioOut(PAUSE_FADE_OUT_MS);
      safePause(audioEl);
    }

    safePause(getVideoNode());
    try { player.pause(); } catch {}

    setMediaSessionPlaybackState();
    scheduleSync(500);
  }

  async function playAll(reason = "") {
    if (state.syncing) return;
    state.syncing = true;

    try {
      state.userPaused = false;
      state.intendedPlaying = true;

      const v = getVideoNode();

      // Ensure sources are loaded.
      try { v.load?.(); } catch {}
      if (coupledMode && audioEl) {
        try { audioEl.preload = "auto"; } catch {}
        try { audioEl.load?.(); } catch {}
      }

      // If we have a better resume point, apply it once.
      const resume = bestResumePos();
      const vt = safeGetVT();
      const at = coupledMode ? safeGetAT() : vt;
      const needsSeek = resume > 0.5 && (vt < 0.5 || (coupledMode && at < 0.5) || Math.abs(resume - vt) > 1.0);
      if (needsSeek) {
        safeSetVT(resume);
        if (coupledMode) safeSetAT(resume);
      }

      // Buffer gates (avoid immediate stalls that cause rapid play/pause loops).
      await ensureMediaReady(v, 2, 2200);
      if (coupledMode && audioEl) await ensureMediaReady(audioEl, 2, 2200);

      // Start VIDEO first.
      let vPlay = await safePlay(v);
      if (!vPlay.ok) {
        // Autoplay could be blocked if audio isn't allowed yet. Try muted video fallback.
        try { player.muted(true); } catch {}
        try { v.muted = true; } catch {}

        vPlay = await safePlay(v);
      }

      if (!vPlay.ok) {
        // Still blocked: wait for a user gesture.
        state.pendingUserGestureResume = true;
        setMediaSessionPlaybackState();
        scheduleSync(700);
        return;
      }

      // Keep MediaSession in sync.
      setMediaSessionPlaybackState();

      if (!coupledMode || !audioEl) {
        // If we played muted for autoplay, keep volume state aligned.
        try { player.muted(false); } catch {}
        setMediaSessionPlaybackState();
        scheduleSync(200);
        return;
      }

      // Align AUDIO to video time, but do it pop-safe: fade out, set time, play at 0 vol, fade in.
      const vtNow = clampTime(safeGetVT());
      const atNow = clampTime(safeGetAT());
      const drift = vtNow - atNow;

      if (Math.abs(drift) > 0.08) {
        // Avoid changing currentTime while audible.
        await fadeAudioOut(SEEK_FADE_OUT_MS);
        safePause(audioEl);
        safeSetAT(vtNow);
      }

      // Start audio, but avoid multiple in-flight play() calls.
      if (audioEl.paused) {
        if (!state.audioPlayPromise) {
          state.audioPlayPromise = safePlay(audioEl).finally(() => { state.audioPlayPromise = null; });
        }
        const aPlay = await state.audioPlayPromise;
        if (!aPlay.ok) {
          // Audio blocked -> user gesture needed.
          state.pendingUserGestureResume = true;
          setMediaSessionPlaybackState();

          // If audio can't start, pause video to avoid "video-only playing" mismatch when user expects both.
          safePause(v);
          try { player.pause(); } catch {}
          return;
        }
      }

      // Fade in audio to match video UI volume.
      await fadeAudioIn(START_FADE_IN_MS);
      setMediaSessionPlaybackState();
      scheduleSync(0);
    } finally {
      state.syncing = false;
    }
  }

  async function seekTo(target, { keepPlaying = true } = {}) {
    target = clampTime(Number(target) || 0);
    state.seeking = true;

    try {
      if (coupledMode && audioEl) {
        // Pop-safe: fade out, pause, seek, then restart/fade in if needed.
        await fadeAudioOut(SEEK_FADE_OUT_MS);
        safePause(audioEl);
      }

      safeSetVT(target);
      if (coupledMode) safeSetAT(target);

      await ensureMediaReady(getVideoNode(), 2, 2000);
      if (coupledMode && audioEl) await ensureMediaReady(audioEl, 2, 2000);

      if (keepPlaying && state.intendedPlaying && !state.userPaused) {
        // Restart both.
        await playAll("seek");
      } else {
        // Stay paused.
        await pauseAll("seek-pause");
      }
    } finally {
      state.seeking = false;
      scheduleSync(0);
    }
  }

  function noteBackgroundEntry() {
    state.hiddenSince = now();
    state.wasPlayingOnHide = state.intendedPlaying && !state.userPaused;
    state.expectedVideoBgPause = false;

    // Chromium optimization: video without audio tracks may be auto-paused in background.
    // We'll resync on visibility return.
    if (platform.desktopChromiumLike && coupledMode && !videoHasAudioTrack()) {
      state.expectedVideoBgPause = true;
    }
  }

  async function handleVisibleReturn() {
    // If user paused via MediaSession while hidden, respect that.
    if (!state.intendedPlaying || state.userPaused) {
      // Enforce pause consistency.
      if (!safeGetVideoPaused()) safePause(getVideoNode());
      if (coupledMode && audioEl && !audioEl.paused) {
        await fadeAudioOut(PAUSE_FADE_OUT_MS);
        safePause(audioEl);
      }
      setMediaSessionPlaybackState();
      scheduleSync(400);
      return;
    }

    if (!coupledMode || !audioEl) {
      // Just ensure video is playing.
      if (safeGetVideoPaused()) await playAll("visible-return-videoonly");
      return;
    }

    const vPaused = safeGetVideoPaused();
    const aPaused = safeGetAudioPaused();

    // If only audio is playing (common after background controls), force video catch-up.
    if (!aPaused && vPaused) {
      const at = clampTime(safeGetAT());
      safeSetVT(at);
      await playAll("visible-return-audio-master");
      return;
    }

    // If only video is playing, try to start audio.
    if (!vPaused && aPaused) {
      const vt = clampTime(safeGetVT());
      safeSetAT(vt);
      await playAll("visible-return-video-master");
      return;
    }

    // If both paused but intended playing, restart at best time.
    if (vPaused && aPaused) {
      const resume = clampTime(bestResumePos());
      safeSetVT(resume);
      safeSetAT(resume);
      await playAll("visible-return-both-paused");
      return;
    }

    // If both playing, just snap if drifting.
    scheduleSync(0);
  }

  function scheduleSync(delay = null) {
    const d = typeof delay === "number" ? Math.max(0, delay) : state.syncDelayMs;
    if (state.syncTimer) clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(runSync, d);
  }

  function runSync() {
    state.syncTimer = null;

    // Keep MediaSession updated.
    setMediaSessionPlaybackState();
    updateMediaSessionPosition();

    if (!coupledMode || !audioEl) {
      // Video-only: just keep intended state aligned.
      if (state.intendedPlaying && safeGetVideoPaused() && !state.userPaused) {
        playAll("videoonly-sync").catch(() => {});
      }
      scheduleSync(800);
      return;
    }

    // If audio is blocked and we're waiting for a user gesture, do nothing but keep state sane.
    if (state.pendingUserGestureResume) {
      // Keep playbackState paused so controls don't loop.
      setMediaSessionPlaybackState();
      scheduleSync(800);
      return;
    }

    const v = getVideoNode();
    const vt = clampTime(safeGetVT());
    const at = clampTime(safeGetAT());

    if (state.intendedPlaying && !safeGetVideoPaused() && vt > 0.1) updateLastKnownGoodVT();

    // Hidden tab: avoid aggressive repair (timers are throttled). Just remember base and resync on visible.
    if (document.visibilityState === "hidden") {
      if (!state.hiddenSince) noteBackgroundEntry();

      // If Chromium pauses the video in background, let audio keep going (user can still listen).
      // We'll realign on visible.
      scheduleSync(1200);
      return;
    }

    // Visible tab: enforce intended state.
    const vPaused = safeGetVideoPaused();
    const aPaused = safeGetAudioPaused();

    if (!state.intendedPlaying || state.userPaused) {
      // Enforce pause.
      if (!vPaused) safePause(v);
      if (!aPaused) {
        if (!audioFadeGuardActive()) {
          fadeAudioOut(PAUSE_FADE_OUT_MS).then(() => safePause(audioEl)).catch(() => safePause(audioEl));
        } else {
          safePause(audioEl);
        }
      }
      scheduleSync(800);
      return;
    }

    // Ensure both are playing.
    if (vPaused || aPaused) {
      playAll("sync-resume").catch(() => {});
      scheduleSync(400);
      return;
    }

    // Avoid drift without snapping too much (snaps cause pops if audible).
    const drift = vt - at;
    const absDrift = Math.abs(drift);

    // If we are buffering badly, let the browser catch up before doing hard changes.
    const vOk = canPlaySmoothAt(v, vt, 0.20);
    const aOk = canPlaySmoothAt(audioEl, at, 0.20);

    if (!vOk || !aOk) {
      // Slightly increase sync cadence during buffering.
      scheduleSync(350);
      return;
    }

    if (absDrift > BIG_DRIFT) {
      // Hard snap (rare): fade out to avoid pop, then snap audio to video.
      fadeAudioOut(SEEK_FADE_OUT_MS).then(() => {
        safePause(audioEl);
        safeSetAT(vt);
        return safePlay(audioEl);
      }).then(() => fadeAudioIn(SEEK_FADE_IN_MS)).catch(() => {});
      scheduleSync(350);
      return;
    }

    if (absDrift > MICRO_DRIFT) {
      // Soft correction: gently nudge audio playbackRate (tiny changes).
      const base = Number(player.playbackRate?.() || 1) || 1;
      const nudge = Math.max(-0.004, Math.min(0.004, drift * 0.02));
      try { audioEl.playbackRate = base + nudge; } catch {}
      scheduleSync(250);
      return;
    }

    // Drift is fine: reset audio rate and keep volume aligned.
    try {
      const base = Number(player.playbackRate?.() || 1) || 1;
      if (Math.abs((audioEl.playbackRate || base) - base) > 0.0005) audioEl.playbackRate = base;
    } catch {}

    // Volume tracking without hard-jumps.
    rampAudioVolume(computeTargetAudioVolume(), VOLUME_RAMP_MS);

    scheduleSync(500);
  }

  // ----------------------------
  // Media Session (fixed handlers)
  // ----------------------------
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

    const bumpSerial = () => ++state.mediaSessionActionSerial;

    const onPlay = () => {
      const serial = bumpSerial();
      state.pendingUserGestureResume = false;
      state.userPaused = false;
      state.intendedPlaying = true;

      // Avoid seeking to 0 on mobile controls by using bestResumePos.
      const resume = clampTime(bestResumePos());
      const vt = safeGetVT();
      if (resume > 0.5 && (vt < 0.5 || Math.abs(resume - vt) > 1.0)) {
        safeSetVT(resume);
        if (coupledMode) safeSetAT(resume);
      }

      playAll("mediasession-play").catch(() => {}).finally(() => {
        if (serial !== state.mediaSessionActionSerial) return;
        setMediaSessionPlaybackState();
      });
    };

    const onPause = () => {
      const serial = bumpSerial();
      // Pause MUST always be honored, even when hidden/unfocused.
      pauseAll("mediasession-pause").catch(() => {}).finally(() => {
        if (serial !== state.mediaSessionActionSerial) return;
        setMediaSessionPlaybackState();
      });
    };

    const onStop = () => {
      const serial = bumpSerial();
      pauseAll("mediasession-stop").catch(() => {}).finally(() => {
        if (serial !== state.mediaSessionActionSerial) return;
        setMediaSessionPlaybackState();
      });
    };

    const onSeekTo = details => {
      const serial = bumpSerial();
      const t = clampTime(Number(details?.seekTime) || 0);
      const keepPlaying = state.intendedPlaying && !state.userPaused;

      // Some Android builds like when you implement seekto directly.
      seekTo(t, { keepPlaying }).catch(() => {}).finally(() => {
        if (serial !== state.mediaSessionActionSerial) return;
        setMediaSessionPlaybackState();
        updateMediaSessionPosition();
      });
    };

    const onSeekForward = details => {
      const inc = Number(details?.seekOffset) || 10;
      const t = clampTime(safeGetVT() + inc);
      onSeekTo({ seekTime: t });
    };

    const onSeekBackward = details => {
      const dec = Number(details?.seekOffset) || 10;
      const t = clampTime(safeGetVT() - dec);
      onSeekTo({ seekTime: t });
    };

    try { navigator.mediaSession.setActionHandler("play", onPlay); } catch {}
    try { navigator.mediaSession.setActionHandler("pause", onPause); } catch {}
    try { navigator.mediaSession.setActionHandler("stop", onStop); } catch {}
    try { navigator.mediaSession.setActionHandler("seekto", onSeekTo); } catch {}
    try { navigator.mediaSession.setActionHandler("seekforward", onSeekForward); } catch {}
    try { navigator.mediaSession.setActionHandler("seekbackward", onSeekBackward); } catch {}

    // Keep playbackState accurate.
    setMediaSessionPlaybackState();
    updateMediaSessionPosition();
  }

  // ----------------------------
  // Event bindings
  // ----------------------------
  function bindEvents() {
    // Volume changes from UI -> ramp external audio volume (no hard jump).
    player.on("volumechange", () => {
      if (!coupledMode || !audioEl) return;
      rampAudioVolume(computeTargetAudioVolume(), VOLUME_RAMP_MS);
    });

    player.on("ratechange", () => {
      if (!coupledMode || !audioEl) return;
      try { audioEl.playbackRate = Number(player.playbackRate()) || 1; } catch {}
    });

    // Play/pause detection: treat these as "user intent" when they originate from the page UI.
    player.on("play", () => {
      // If autoplay was blocked, don't keep fighting.
      if (state.pendingUserGestureResume) return;

      state.userPaused = false;
      state.intendedPlaying = true;

      // Ensure we start audio too.
      if (coupledMode) {
        playAll("player-play").catch(() => {});
      }

      setMediaSessionPlaybackState();
      scheduleSync(0);
    });

    player.on("pause", () => {
      // If browser pauses video in background (Chromium no-audio-track optimization), don't force "userPaused".
      if (document.visibilityState === "hidden" && state.expectedVideoBgPause && state.intendedPlaying) {
        scheduleSync(900);
        return;
      }

      // Otherwise treat as user pause.
      state.userPaused = true;
      state.intendedPlaying = false;

      if (coupledMode) {
        pauseAll("player-pause").catch(() => {});
      }

      setMediaSessionPlaybackState();
      scheduleSync(300);
    });

    player.on("seeking", () => {
      if (!coupledMode || !audioEl) return;
      state.seeking = true;

      // Pop-safe: fade audio out and pause while seeking.
      fadeAudioOut(SEEK_FADE_OUT_MS).then(() => safePause(audioEl)).catch(() => safePause(audioEl));
    });

    player.on("seeked", () => {
      if (!coupledMode || !audioEl) return;

      const vt = clampTime(safeGetVT());
      safeSetAT(vt);

      state.seeking = false;

      if (state.intendedPlaying && !state.userPaused) {
        playAll("player-seeked").catch(() => {});
      } else {
        pauseAll("player-seeked-paused").catch(() => {});
      }
    });

    player.on("waiting", () => {
      // Buffering: tighten sync cadence but don't spam play/pause.
      scheduleSync(250);
    });

    player.on("playing", () => {
      updateLastKnownGoodVT();
      scheduleSync(0);
    });

    player.on("ended", () => {
      if (isLoopDesired()) {
        seekTo(0, { keepPlaying: true }).catch(() => {});
      } else {
        pauseAll("ended").catch(() => {});
      }
    });

    if (coupledMode && audioEl) {
      audioEl.addEventListener("play", () => {
        // Keep audio volume aligned (ramped).
        rampAudioVolume(computeTargetAudioVolume(), VOLUME_RAMP_MS);
        setMediaSessionPlaybackState();
        scheduleSync(0);
      }, { passive: true });

      audioEl.addEventListener("pause", () => {
        // If audio pauses unexpectedly while intended playing, try to restart (but don't loop aggressively).
        if (state.intendedPlaying && !state.userPaused && document.visibilityState === "visible") {
          // Give a short grace window to avoid play/pause loops.
          setTimeout(() => {
            if (!state.intendedPlaying || state.userPaused) return;
            if (audioEl.paused && !state.seeking && !state.syncing) {
              playAll("audio-unexpected-pause").catch(() => {});
            }
          }, 220);
        }

        setMediaSessionPlaybackState();
      }, { passive: true });

      audioEl.addEventListener("ended", () => {
        if (isLoopDesired()) {
          seekTo(0, { keepPlaying: true }).catch(() => {});
        } else {
          pauseAll("audio-ended").catch(() => {});
        }
      }, { passive: true });
    }

    // Visibility lifecycle: resync on return, don't fight browser in background.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        noteBackgroundEntry();
        scheduleSync(1200);
        return;
      }

      // visible
      state.hiddenSince = 0;
      handleVisibleReturn().catch(() => {});
    }, { passive: true, capture: true });

    window.addEventListener("pagehide", () => {
      if (state.syncTimer) {
        clearTimeout(state.syncTimer);
        state.syncTimer = null;
      }
      cancelVolumeRamp();
    }, { passive: true });

    window.addEventListener("pageshow", e => {
      // If restored from bfcache and we intended to play, resync.
      if (state.intendedPlaying && !state.userPaused) {
        handleVisibleReturn().catch(() => {});
      }
    }, { passive: true });
  }

  // ----------------------------
  // Autoplay strategy
  // ----------------------------
  function attachUserGestureUnlock() {
    if (state.autoplaySucceeded) return;
    if (!state.pendingUserGestureResume) return;

    const once = (fn) => {
      let done = false;
      return (e) => {
        if (done) return;
        done = true;
        try { fn(e); } catch {}
      };
    };

    const resume = once(() => {
      state.pendingUserGestureResume = false;
      // If user interacts, we can attempt full A/V playback.
      playAll("user-gesture").catch(() => {});
      cleanup();
    });

    const cleanup = () => {
      try { document.removeEventListener("pointerdown", resume, true); } catch {}
      try { document.removeEventListener("keydown", resume, true); } catch {}
      try { document.removeEventListener("touchstart", resume, true); } catch {}
      try { document.removeEventListener("mousedown", resume, true); } catch {}
    };

    try { document.addEventListener("pointerdown", resume, true); } catch {}
    try { document.addEventListener("touchstart", resume, true); } catch {}
    try { document.addEventListener("mousedown", resume, true); } catch {}
    try { document.addEventListener("keydown", resume, true); } catch {}
  }

  async function attemptAutoplay() {
    if (state.autoplayAttempted) return;
    state.autoplayAttempted = true;

    // Only attempt if the player wants autoplay (video.js config or query).
    const wants = (() => {
      try {
        const q = (qs.get("autoplay") || "").toLowerCase();
        if (q === "1" || q === "true" || q === "yes") return true;
      } catch {}
      try { if (window.forceAutoplay === true) return true; } catch {}
      try {
        if (videoEl?.autoplay || videoEl?.hasAttribute?.("autoplay")) return true;
      } catch {}
      try {
        const a = typeof player.autoplay === "function" ? player.autoplay() : null;
        if (a === true || a === "play" || a === "muted" || a === "any") return true;
      } catch {}
      return true; // keep current behavior (autoplay default on)
    })();

    if (!wants) return;

    state.intendedPlaying = true;
    state.userPaused = false;

    // Retry loop: not spammy, but enough to handle load ordering.
    for (let i = 0; i < AUTOPLAY_RETRY_MAX; i++) {
      if (!state.intendedPlaying || state.userPaused) break;

      await playAll("autoplay");

      if (!safeGetVideoPaused() && (!coupledMode || !audioEl || !audioEl.paused)) {
        state.autoplaySucceeded = true;
        state.pendingUserGestureResume = false;
        setMediaSessionPlaybackState();
        scheduleSync(0);
        return;
      }

      // If audio got blocked, require gesture.
      if (state.pendingUserGestureResume) {
        attachUserGestureUnlock();
        setMediaSessionPlaybackState();
        scheduleSync(800);
        return;
      }

      await new Promise(r => setTimeout(r, AUTOPLAY_RETRY_MS));
    }

    // Give up: wait for user.
    state.pendingUserGestureResume = true;
    attachUserGestureUnlock();
    setMediaSessionPlaybackState();
  }

  // ----------------------------
  // Init
  // ----------------------------
  setupMediaSession();
  bindEvents();

  // Prime external audio early to improve "audio doesn't start sometimes".
  if (coupledMode && audioEl) {
    try { audioEl.preload = "auto"; } catch {}
    try { audioEl.load?.(); } catch {}
    try { audioEl.volume = 0; } catch {}
    // Keep volume aligned when user changes it before play.
    rampAudioVolume(computeTargetAudioVolume(), VOLUME_RAMP_MS);
  }

  // Start sync loop (low cadence; ramps/repairs are event-driven).
  scheduleSync(0);

  // Autoplay attempt after the next task tick so DOM/media settle.
  setTimeout(() => {
    attemptAutoplay().catch(() => {});
  }, 0);
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