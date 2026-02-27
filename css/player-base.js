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

  const pickAudioSrc = () => {
    try {
      const direct = audioEl?.getAttribute?.("src");
      if (direct) return direct;
      const child = audioEl?.querySelector?.("source");
      const childSrc = child?.getAttribute?.("src");
      if (childSrc) return childSrc;
      if (audioEl?.currentSrc) return audioEl.currentSrc;
    } catch {}
    return "";
  };

  const useExternalAudio =
    qua !== "medium" &&
    !!audioEl &&
    audioEl.tagName === "AUDIO" &&
    !!pickAudioSrc();

  const cfg = {
    syncIntervalMs: 180,
    softDrift: 0.065,
    hardDrift: 0.28,
    seekDrift: 0.04,
    maxRateOffset: 0.025,
    audioRestartCooldownMs: 900,
    repairCooldownMs: 900,
    visibilityRepairCooldownMs: 1100,
    waitResumeDelayMs: 120,
    settleGuardMs: 320,
    startupJoinWindowMs: 2200,
    bufferAheadMinSec: 0.15,
    forceMuteInternalVideo: false
  };

  let cachedInnerVideoEl = null;
  let targetPlaying = false;
  let restarting = false;
  let seeking = false;
  let syncTimer = null;
  let rvfcHandle = null;
  let opSerial = 0;
  let ignoreVideoEventsUntil = 0;
  let ignoreAudioEventsUntil = 0;
  let ignoreVolumeMirrorUntil = 0;
  let userVolume = 1;
  let userMuted = false;
  let startupJoined = !useExternalAudio;
  let startupJoinDeadline = performance.now() + cfg.startupJoinWindowMs;
  let lastAudioRestartAt = 0;
  let lastRepairAt = 0;
  let lastVisibilityRepairAt = 0;
  let waitResumeTimer = null;
  let endedRestartTimer = null;
  let lastStableVideoTime = 0;
  let lastStableAudioTime = 0;
  let lastVideoProgressAt = performance.now();
  let lastAudioProgressAt = performance.now();

  function getNativeVideoEl() {
    try {
      if (videoEl && typeof videoEl.play === "function") return videoEl;
    } catch {}

    try {
      if (cachedInnerVideoEl && typeof cachedInnerVideoEl.play === "function") {
        return cachedInnerVideoEl;
      }

      const inner = player?.el?.()?.querySelector?.("video");
      if (inner && typeof inner.play === "function") {
        cachedInnerVideoEl = inner;
        return inner;
      }
    } catch {}

    return videoEl || null;
  }

  function getVideoTime() {
    try {
      const t = Number(player.currentTime());
      if (isFinite(t)) return t;
    } catch {}

    try {
      const t = Number(getNativeVideoEl()?.currentTime);
      if (isFinite(t)) return t;
    } catch {}

    return 0;
  }

  function setVideoTime(time) {
    if (!isFinite(time) || time < 0) return;

    try {
      player.currentTime(time);
    } catch {}

    try {
      videoEl.currentTime = time;
    } catch {}

    try {
      const native = getNativeVideoEl();
      if (native && native !== videoEl) native.currentTime = time;
    } catch {}
  }

  function getAudioTime() {
    try {
      const t = Number(audioEl?.currentTime);
      if (isFinite(t)) return t;
    } catch {}
    return 0;
  }

  function setAudioTime(time) {
    if (!useExternalAudio) return;
    if (!isFinite(time) || time < 0) return;

    try {
      audioEl.currentTime = time;
    } catch {}
  }

  function getVideoDuration() {
    try {
      const d = Number(player.duration());
      if (isFinite(d) && d > 0) return d;
    } catch {}

    try {
      const d = Number(getNativeVideoEl()?.duration);
      if (isFinite(d) && d > 0) return d;
    } catch {}

    return NaN;
  }

  function isVideoPaused() {
    try {
      if (typeof player.paused === "function") return !!player.paused();
    } catch {}

    try {
      const native = getNativeVideoEl();
      if (native) return !!native.paused;
    } catch {}

    return true;
  }

  function isAudioPaused() {
    if (!useExternalAudio) return true;

    try {
      return !!audioEl.paused;
    } catch {}

    return true;
  }

  function getVideoReadyState() {
    try {
      const native = getNativeVideoEl();
      if (native && typeof native.readyState === "number") {
        return Number(native.readyState) || 0;
      }
    } catch {}

    try {
      return Number(videoEl.readyState || 0);
    } catch {}

    return 0;
  }

  function getAudioReadyState() {
    if (!useExternalAudio) return 0;

    try {
      return Number(audioEl.readyState || 0);
    } catch {}

    return 0;
  }

  function getVideoPlaybackRate() {
    try {
      const r = Number(player.playbackRate());
      if (isFinite(r) && r > 0) return r;
    } catch {}

    try {
      const r = Number(getNativeVideoEl()?.playbackRate);
      if (isFinite(r) && r > 0) return r;
    } catch {}

    return 1;
  }

  function setAudioPlaybackRate(rate) {
    if (!useExternalAudio) return;
    if (!isFinite(rate) || rate <= 0) return;

    try {
      audioEl.playbackRate = rate;
    } catch {}
  }

  function canPlayAt(media, time, minAhead = cfg.bufferAheadMinSec) {
    try {
      if (!media || !isFinite(time)) return false;

      const rs = Number(media.readyState || 0);
      if (rs >= 3) return true;

      const ranges = media.buffered;
      if (!ranges || ranges.length === 0) return rs >= 2 && time < 0.5;

      for (let i = 0; i < ranges.length; i += 1) {
        const start = Number(ranges.start(i));
        const end = Number(ranges.end(i));

        if (time >= start - 0.05 && time <= end - minAhead) return true;
        if (time >= start - 0.05 && time <= end + 0.25 && rs >= 2) return true;
      }
    } catch {}

    return false;
  }

  function videoCanPlayNow() {
    const native = getNativeVideoEl();
    const time = getVideoTime();
    return canPlayAt(native, time, 0.05);
  }

  function audioCanPlayNow() {
    if (!useExternalAudio) return false;
    const time = getVideoTime();
    return canPlayAt(audioEl, time, 0.05);
  }

  function shouldLoop() {
    try {
      return (
        !!videoEl.loop ||
        videoEl.hasAttribute("loop") ||
        qs.get("loop") === "1" ||
        qs.get("loop") === "true" ||
        window.forceLoop === true
      );
    } catch {}

    return false;
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
      if (typeof player.autoplay === "function") {
        const a = player.autoplay();
        if (a === true || a === "play" || a === "muted" || a === "any") return true;
      }
    } catch {}

    return false;
  }

  function guardVideoEvents(ms = cfg.settleGuardMs) {
    ignoreVideoEventsUntil = Math.max(ignoreVideoEventsUntil, performance.now() + ms);
  }

  function guardAudioEvents(ms = cfg.settleGuardMs) {
    ignoreAudioEventsUntil = Math.max(ignoreAudioEventsUntil, performance.now() + ms);
  }

  function videoEventsGuarded() {
    return performance.now() < ignoreVideoEventsUntil;
  }

  function audioEventsGuarded() {
    return performance.now() < ignoreAudioEventsUntil;
  }

  function clearWaitResumeTimer() {
    if (waitResumeTimer) {
      clearTimeout(waitResumeTimer);
      waitResumeTimer = null;
    }
  }

  function clearEndedRestartTimer() {
    if (endedRestartTimer) {
      clearTimeout(endedRestartTimer);
      endedRestartTimer = null;
    }
  }

  function syncExternalVolumeFromPlayer() {
    if (!useExternalAudio) return;

    try {
      userVolume = Math.max(0, Math.min(1, Number(player.volume())));
    } catch {}

    try {
      userMuted = !!player.muted();
    } catch {}

    const targetVolume = userMuted ? 0 : userVolume;

    try {
      audioEl.muted = !!userMuted;
    } catch {}

    try {
      audioEl.volume = targetVolume;
    } catch {}

    if (cfg.forceMuteInternalVideo) {
      try {
        const native = getNativeVideoEl();
        if (native) native.muted = true;
      } catch {}
    }
  }

  function markVideoProgress() {
    const now = performance.now();
    const time = getVideoTime();

    if (Math.abs(time - lastStableVideoTime) > 0.001) {
      lastStableVideoTime = time;
      lastVideoProgressAt = now;
    }
  }

  function markAudioProgress() {
    if (!useExternalAudio) return;

    const now = performance.now();
    const time = getAudioTime();

    if (Math.abs(time - lastStableAudioTime) > 0.001) {
      lastStableAudioTime = time;
      lastAudioProgressAt = now;
    }
  }

  function updateMediaSessionPlaybackState() {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.playbackState = targetPlaying ? "playing" : "paused";
    } catch {}
  }

  function updateMediaSessionPosition() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;

    try {
      const duration = getVideoDuration();
      const position = getVideoTime();

      navigator.mediaSession.setPositionState({
        duration: isFinite(duration) ? duration : 0,
        playbackRate: getVideoPlaybackRate(),
        position: isFinite(position) ? position : 0
      });
    } catch {}
  }

  function setupTitleBar() {
    player.ready(() => {
      const metaTitle = document.querySelector('meta[name="title"]')?.content || "";
      const metaDesc =
        document.querySelector('meta[name="twitter:description"]')?.content || "";

      let stats = "";
      const match = metaDesc.match(/👍\s*[^|]+\|\s*👎\s*[^|]+\|\s*📈\s*[^💬]+/);

      if (match) {
        stats = match[0]
          .replace(/👍/g, "👍")
          .replace(/👎/g, "• 👎")
          .replace(/📈/g, "• 📈")
          .replace(/\s*\|\s*/g, "   ");
      }

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

      const handleFullscreen = () => {
        const fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (fs) createTitleBar();
        else removeTitleBar();
      };

      document.addEventListener("fullscreenchange", handleFullscreen, { passive: true });
      document.addEventListener("webkitfullscreenchange", handleFullscreen, {
        passive: true
      });
      handleFullscreen();
    });
  }

  async function safeVideoPlay(localOp = opSerial) {
    guardVideoEvents(450);

    try {
      const p = player.play();
      if (p && typeof p.then === "function") await p;
    } catch {}

    if (localOp !== opSerial) return false;
    return !isVideoPaused();
  }

  function safeVideoPause() {
    guardVideoEvents(300);

    try {
      player.pause();
    } catch {}

    try {
      const native = getNativeVideoEl();
      if (native && !native.paused) native.pause();
    } catch {}
  }

  async function safeAudioPlay(localOp = opSerial) {
    if (!useExternalAudio) return false;
    if (!audioCanPlayNow()) return false;

    guardAudioEvents(450);
    syncExternalVolumeFromPlayer();

    try {
      const p = audioEl.play();
      if (p && typeof p.then === "function") await p;
    } catch {
      return false;
    }

    if (localOp !== opSerial) return false;
    return !isAudioPaused();
  }

  function safeAudioPause() {
    if (!useExternalAudio) return;

    guardAudioEvents(300);

    try {
      if (!audioEl.paused) audioEl.pause();
    } catch {}
  }

  function setAudioToVideoTime(force = false) {
    if (!useExternalAudio) return;

    const vt = getVideoTime();
    const at = getAudioTime();

    if (!isFinite(vt)) return;
    if (!force && isFinite(at) && Math.abs(at - vt) <= cfg.seekDrift) return;

    setAudioTime(vt);
  }

  function normalizeAudioRate() {
    if (!useExternalAudio) return;

    const base = getVideoPlaybackRate();

    try {
      if (Math.abs((audioEl.playbackRate || 1) - base) > 0.001) {
        audioEl.playbackRate = base;
      }
    } catch {}
  }

  function applySoftDriftCorrection() {
    if (!useExternalAudio) return;

    if (isVideoPaused() || isAudioPaused()) {
      normalizeAudioRate();
      return;
    }

    const vt = getVideoTime();
    const at = getAudioTime();

    if (!isFinite(vt) || !isFinite(at)) return;

    const drift = vt - at;
    const absDrift = Math.abs(drift);
    const base = getVideoPlaybackRate();

    if (absDrift >= cfg.hardDrift) {
      setAudioTime(vt);
      try {
        audioEl.playbackRate = base;
      } catch {}
      return;
    }

    if (absDrift >= cfg.softDrift) {
      const offset = Math.max(
        -cfg.maxRateOffset,
        Math.min(cfg.maxRateOffset, drift * 0.12)
      );

      try {
        audioEl.playbackRate = Math.max(0.9, Math.min(1.1, base + offset));
      } catch {}
      return;
    }

    normalizeAudioRate();
  }

  async function requestPlay(reason = "play") {
    targetPlaying = true;
    updateMediaSessionPlaybackState();
    clearWaitResumeTimer();

    const localOp = ++opSerial;

    if (!videoCanPlayNow()) return;

    const videoStarted = await safeVideoPlay(localOp);
    if (!videoStarted || localOp !== opSerial || !targetPlaying) return;

    if (!useExternalAudio) return;

    setAudioToVideoTime(true);
    syncExternalVolumeFromPlayer();

    if (!startupJoined && performance.now() <= startupJoinDeadline) {
      if (!audioCanPlayNow()) return;
    }

    const audioStarted = await safeAudioPlay(localOp);
    if (localOp !== opSerial || !targetPlaying) return;

    if (audioStarted) {
      startupJoined = true;
      setAudioToVideoTime(true);
      normalizeAudioRate();
    }
  }

  function requestPause(reason = "pause") {
    targetPlaying = false;
    updateMediaSessionPlaybackState();
    ++opSerial;
    clearWaitResumeTimer();
    safeAudioPause();
    safeVideoPause();
    normalizeAudioRate();
  }

  async function repairFromVideoMaster(reason = "repair") {
    if (!useExternalAudio) return;

    const now = performance.now();
    if (now - lastRepairAt < cfg.repairCooldownMs) return;
    lastRepairAt = now;

    if (!targetPlaying || seeking || restarting) return;

    const localOp = ++opSerial;

    setAudioToVideoTime(true);
    normalizeAudioRate();

    if (isVideoPaused() && videoCanPlayNow()) {
      const videoStarted = await safeVideoPlay(localOp);
      if (!videoStarted || localOp !== opSerial || !targetPlaying) return;
    }

    if (isAudioPaused() && audioCanPlayNow()) {
      await safeAudioPlay(localOp);
      if (localOp !== opSerial || !targetPlaying) return;
    }

    setAudioToVideoTime(true);
    syncExternalVolumeFromPlayer();
  }

  function scheduleResumeFromWaiting() {
    clearWaitResumeTimer();

    waitResumeTimer = setTimeout(() => {
      waitResumeTimer = null;

      if (!targetPlaying || seeking || restarting) return;
      if (!videoCanPlayNow()) return;

      requestPlay("waiting-resume").catch(() => {});
    }, cfg.waitResumeDelayMs);
  }

  function handleSeekStart() {
    seeking = true;
    ++opSerial;
    clearWaitResumeTimer();
    safeAudioPause();
  }

  function handleSeekEnd() {
    const wasTargetPlaying = targetPlaying;
    setAudioToVideoTime(true);
    normalizeAudioRate();
    seeking = false;

    if (wasTargetPlaying) {
      requestPlay("seek-end").catch(() => {});
    }
  }

  async function restartLoop() {
    if (restarting) return;

    restarting = true;
    clearEndedRestartTimer();

    try {
      ++opSerial;
      safeAudioPause();
      safeVideoPause();
      setVideoTime(0);
      setAudioTime(0);
      normalizeAudioRate();

      if (targetPlaying) {
        await requestPlay("loop-restart");
      }
    } finally {
      restarting = false;
    }
  }

  function syncTick() {
    syncExternalVolumeFromPlayer();
    updateMediaSessionPosition();
    markVideoProgress();
    markAudioProgress();

    if (!useExternalAudio) return;
    if (seeking || restarting) return;

    const videoPaused = isVideoPaused();
    const audioPaused = isAudioPaused();
    const hidden = document.visibilityState === "hidden";
    const now = performance.now();

    if (!targetPlaying) {
      if (!audioPaused) safeAudioPause();
      if (!videoPaused) safeVideoPause();
      return;
    }

    if (videoPaused && !audioPaused) {
      safeAudioPause();
      return;
    }

    if (!videoPaused && audioPaused) {
      if (now - lastAudioRestartAt >= cfg.audioRestartCooldownMs && audioCanPlayNow()) {
        lastAudioRestartAt = now;
        requestPlay("audio-paused-self").catch(() => {});
      }
      return;
    }

    if (videoPaused && audioPaused) {
      if (videoCanPlayNow()) requestPlay("both-paused").catch(() => {});
      return;
    }

    if (!hidden) {
      applySoftDriftCorrection();
    } else {
      const vt = getVideoTime();
      const at = getAudioTime();

      if (isFinite(vt) && isFinite(at) && Math.abs(vt - at) > cfg.hardDrift) {
        setAudioTime(vt);
      }
    }

    const videoStuck =
      !videoPaused &&
      now - lastVideoProgressAt > 2200 &&
      getVideoReadyState() >= 2;

    const audioStuck =
      !audioPaused &&
      now - lastAudioProgressAt > 2200 &&
      getAudioReadyState() >= 2;

    if (videoStuck || audioStuck) {
      repairFromVideoMaster(videoStuck ? "video-stuck" : "audio-stuck").catch(() => {});
    }
  }

  function startSyncLoop() {
    stopSyncLoop();

    syncTimer = setInterval(syncTick, cfg.syncIntervalMs);

    const native = getNativeVideoEl();
    if (native && typeof native.requestVideoFrameCallback === "function") {
      const onFrame = (_now, meta) => {
        if (meta && isFinite(Number(meta.mediaTime))) {
          lastStableVideoTime = Number(meta.mediaTime);
          lastVideoProgressAt = performance.now();
        } else {
          markVideoProgress();
        }

        rvfcHandle = native.requestVideoFrameCallback(onFrame);
      };

      rvfcHandle = native.requestVideoFrameCallback(onFrame);
    }
  }

  function stopSyncLoop() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }

    const native = getNativeVideoEl();
    if (
      native &&
      rvfcHandle != null &&
      typeof native.cancelVideoFrameCallback === "function"
    ) {
      try {
        native.cancelVideoFrameCallback(rvfcHandle);
      } catch {}
    }

    rvfcHandle = null;
  }

  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: document.title || "Video",
        artist: typeof authorchannelname !== "undefined" ? authorchannelname : "",
        artwork: vidKey
          ? [
              {
                src: `https://i.ytimg.com/vi/${vidKey}/default.jpg`,
                sizes: "120x90",
                type: "image/jpeg"
              },
              {
                src: `https://i.ytimg.com/vi/${vidKey}/mqdefault.jpg`,
                sizes: "320x180",
                type: "image/jpeg"
              },
              {
                src: `https://i.ytimg.com/vi/${vidKey}/hqdefault.jpg`,
                sizes: "480x360",
                type: "image/jpeg"
              },
              {
                src: `https://i.ytimg.com/vi/${vidKey}/maxresdefault.jpg`,
                sizes: "1280x720",
                type: "image/jpeg"
              }
            ]
          : []
      });
    } catch {}

    updateMediaSessionPlaybackState();

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        requestPlay("media-session-play").catch(() => {});
      });
    } catch {}

    try {
      navigator.mediaSession.setActionHandler("pause", () => {
        requestPause("media-session-pause");
      });
    } catch {}

    try {
      navigator.mediaSession.setActionHandler("stop", () => {
        requestPause("media-session-stop");
      });
    } catch {}

    try {
      navigator.mediaSession.setActionHandler("seekforward", details => {
        const offset = Number(details?.seekOffset) || 10;
        const duration = getVideoDuration();
        const target = Math.min(
          getVideoTime() + offset,
          isFinite(duration) ? duration : getVideoTime() + offset
        );

        setVideoTime(target);
        if (useExternalAudio) setAudioTime(target);
        handleSeekEnd();
      });
    } catch {}

    try {
      navigator.mediaSession.setActionHandler("seekbackward", details => {
        const offset = Number(details?.seekOffset) || 10;
        const target = Math.max(0, getVideoTime() - offset);

        setVideoTime(target);
        if (useExternalAudio) setAudioTime(target);
        handleSeekEnd();
      });
    } catch {}

    try {
      navigator.mediaSession.setActionHandler("seekto", details => {
        if (!details || typeof details.seekTime !== "number") return;

        const duration = getVideoDuration();
        const target = Math.max(
          0,
          Math.min(isFinite(duration) ? duration : details.seekTime, details.seekTime)
        );

        setVideoTime(target);
        if (useExternalAudio) setAudioTime(target);
        handleSeekEnd();
      });
    } catch {}
  }

  function bindCoreEvents() {
    player.on("volumechange", () => {
      if (performance.now() < ignoreVolumeMirrorUntil) return;
      syncExternalVolumeFromPlayer();
    });

    player.on("ratechange", () => {
      normalizeAudioRate();
    });

    player.on("play", () => {
      if (videoEventsGuarded()) return;

      targetPlaying = true;
      updateMediaSessionPlaybackState();

      if (useExternalAudio) {
        requestPlay("player-play-event").catch(() => {});
      }
    });

    player.on("pause", () => {
      if (videoEventsGuarded()) return;
      if (seeking || restarting) return;
      requestPause("player-pause-event");
    });

    player.on("seeking", () => {
      handleSeekStart();
    });

    player.on("seeked", () => {
      handleSeekEnd();
    });

    player.on("waiting", () => {
      if (!targetPlaying || restarting || seeking) return;

      if (useExternalAudio) safeAudioPause();
      scheduleResumeFromWaiting();
    });

    player.on("canplay", () => {
      if (!startupJoined && useExternalAudio && audioCanPlayNow()) {
        startupJoined = true;
      }

      if (targetPlaying) {
        scheduleResumeFromWaiting();
      }
    });

    player.on("playing", () => {
      markVideoProgress();

      if (targetPlaying && useExternalAudio && isAudioPaused()) {
        requestPlay("player-playing").catch(() => {});
      }
    });

    player.on("ended", () => {
      clearEndedRestartTimer();

      if (restarting) return;

      if (shouldLoop()) {
        endedRestartTimer = setTimeout(() => {
          restartLoop().catch(() => {});
        }, 0);
        return;
      }

      requestPause("video-ended");
    });

    if (!useExternalAudio) return;

    audioEl.preload = "auto";

    try {
      audioEl.load();
    } catch {}

    audioEl.addEventListener("play", () => {
      if (audioEventsGuarded()) return;

      if (!targetPlaying) {
        safeAudioPause();
        return;
      }

      markAudioProgress();
    });

    audioEl.addEventListener("pause", () => {
      if (audioEventsGuarded()) return;
      if (!targetPlaying || seeking || restarting) return;

      if (!isVideoPaused()) {
        requestPlay("audio-paused-unexpected").catch(() => {});
      }
    });

    audioEl.addEventListener("waiting", () => {
      if (!targetPlaying || seeking || restarting) return;
      scheduleResumeFromWaiting();
    });

    audioEl.addEventListener("canplay", () => {
      if (!startupJoined && videoCanPlayNow()) startupJoined = true;

      if (targetPlaying) {
        scheduleResumeFromWaiting();
      }
    });

    audioEl.addEventListener("playing", () => {
      markAudioProgress();
      setAudioToVideoTime(false);
      normalizeAudioRate();
    });

    audioEl.addEventListener("ended", () => {
      if (restarting) return;

      if (shouldLoop()) {
        restartLoop().catch(() => {});
        return;
      }

      requestPause("audio-ended");
    });

    audioEl.addEventListener("seeking", () => {
      if (!seeking) return;
      safeAudioPause();
    });

    audioEl.addEventListener("seeked", () => {
      if (!seeking) return;
      setAudioToVideoTime(false);
    });
  }

  function bindVisibilityRecovery() {
    window.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") return;
        if (!targetPlaying || !useExternalAudio) return;

        const now = performance.now();
        if (now - lastVisibilityRepairAt < cfg.visibilityRepairCooldownMs) return;

        lastVisibilityRepairAt = now;
        requestPlay("visibility-visible").catch(() => {});
      },
      { passive: true, capture: true }
    );

    window.addEventListener(
      "pageshow",
      event => {
        if (!event?.persisted) return;
        if (!targetPlaying || !useExternalAudio) return;
        requestPlay("pageshow").catch(() => {});
      },
      { passive: true, capture: true }
    );

    document.addEventListener(
      "resume",
      () => {
        if (!targetPlaying || !useExternalAudio) return;
        requestPlay("document-resume").catch(() => {});
      },
      { passive: true, capture: true }
    );
  }

  function cleanup() {
    clearWaitResumeTimer();
    clearEndedRestartTimer();
    stopSyncLoop();
  }

  setupTitleBar();
  setupMediaSession();
  bindCoreEvents();
  bindVisibilityRecovery();
  syncExternalVolumeFromPlayer();
  startSyncLoop();

  window.addEventListener("beforeunload", cleanup, { passive: true });

  if (wantsAutoplay()) {
    targetPlaying = true;
    updateMediaSessionPlaybackState();
    requestPlay("startup-autoplay").catch(() => {});
  } else if (!useExternalAudio) {
    updateMediaSessionPlaybackState();
  }
});


document.addEventListener('keydown', function(event) {
    // Ignore key presses if typing in an input or textarea
    if (event.target.tagName.toLowerCase() === 'input' || event.target.tagName.toLowerCase() === 'textarea') {
        return;
    }

     const videoElement = document.querySelector('.video-js');
    if (!videoElement) return;
    const player = videojs(videoElement);

    // Handle the shortcuts
    switch (event.key.toLowerCase()) {
        case 'f': // Fullscreen
            if (!player.isFullscreen()) {
                player.requestFullscreen();
            } else {
                player.exitFullscreen();
            }
            break;

        case ' ': // Spacebar
        case 'k': 
            event.preventDefault(); // Stops the page from scrolling down
            if (player.paused()) {
                player.play();
            } else {
                player.pause();
            }
            break;

        case 'm': // Mute toggle
            player.muted(!player.muted());
            break;

        case 'arrowright':
        case 'l': 
            player.currentTime(player.currentTime() + 10); // Skip forward 10s
            break;

        case 'arrowleft':
        case 'j': 
            player.currentTime(player.currentTime() - 10); // Skip back 10s
            break;

        case 'arrowup': 
            event.preventDefault(); // Stops the page from scrolling up
            // Increase volume by 0.1 (max 1.0)
            player.volume(Math.min(1, player.volume() + 0.1)); 
            break;

        case 'arrowdown': 
            event.preventDefault(); // Stops the page from scrolling down
            // Decrease volume by 0.1 (min 0)
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
/* ---------------------------------------------
   PokeTube Video.js UI — improved for bright/white scenes
   - Uses adaptive “glass” surfaces that stay readable on light frames
   - Adds subtle borders + shadows + text outlines
   - Keeps your gradient brand progress color
---------------------------------------------- */

:root{
  /* Brand */
  --poke-accent-1: #ff0045;
  --poke-accent-2: #ff0e55;
  --poke-accent-3: #ff1d79;

  /* Adaptive glass (works on bright scenes too) */
  --glass-bg: rgba(20, 20, 20, 0.38);
  --glass-bg-hover: rgba(20, 20, 20, 0.46);
  --glass-border: rgba(255, 255, 255, 0.22);
  --glass-border-strong: rgba(255, 255, 255, 0.30);
  --glass-shadow: 0 10px 30px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.10);

  /* “Light scene rescue” layer (a tiny dark wash that helps on whites) */
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