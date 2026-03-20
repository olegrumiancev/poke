// in the beginning.... god made mrrprpmnaynayaynaynayanyuwuuuwmauwnwanwaumawp :p
 
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

// "It takes a lot of hard work to make something simple." ~ Steve Jobs 
document.addEventListener("DOMContentLoaded", () => {
  const video = videojs("video", {
    controls: true,
    autoplay: true,
    preload: "auto",
    errorDisplay: false
  });
  const qs = new URLSearchParams(window.location.search);
  const qua = qs.get("quality") || "";
  const vidKey = qs.get("v") || "";
  const videoEl = document.getElementById("video");
  const audio = document.getElementById("aud");
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
      const inner = video?.el?.()?.querySelector?.("video");
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
  function getVideoPaused() {
    try {
      if (typeof video.paused === "function") return !!video.paused();
    } catch {}
    try {
      return !!getVideoNode().paused;
    } catch {}
    return true;
  }
  function getVideoReadyState() {
    try {
      return Number(getVideoNode().readyState || 0);
    } catch {}
    return 0;
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
          if (typeof navigator.userAgentData?.mobile === "boolean") {
            return navigator.userAgentData.mobile;
          }
        } catch {}
        try {
          return navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches;
        } catch {}
        return false;
      })();
      const chromiumOnlyBrowser = isChromium;
      const problemMobileBrowser = (isChromium && mobile) || isIosWebKit;
      const useBgControllerRetry = !isFirefox && (isChromium || isIosWebKit);
      return {
        mobile: !!mobile,
        ios: !!isIosWebKit,
        android: !!(isChromium && mobile && !isIosWebKit),
                    isFirefox: !!isFirefox,
                    isChromium: !!isChromium,
                    androidChromium: !!(isChromium && mobile && !isIosWebKit),
                    iosWebKitLike: !!isIosWebKit,
                    problemMobileBrowser: !!problemMobileBrowser,
                    desktopChromiumLike: !!(isChromium && !mobile),
                    chromiumOnlyBrowser: !!chromiumOnlyBrowser,
                    useBgControllerRetry: !!useBgControllerRetry
      };
    } catch {
      return {
        mobile: false, ios: false, android: false, isFirefox: false, isChromium: false,
        androidChromium: false, iosWebKitLike: false, problemMobileBrowser: false,
        desktopChromiumLike: false, chromiumOnlyBrowser: false, useBgControllerRetry: false
      };
    }
  })();
  const pickAudioSrc = () => {
    const s = audio?.getAttribute?.("src");
    if (s) return s;
    const child = audio?.querySelector?.("source");
    if (child?.getAttribute?.("src")) return child.getAttribute("src");
    if (audio?.currentSrc) return audio.currentSrc;
    return null;
  };
  const hasExternalAudio = !!audio && audio.tagName === "AUDIO" && !!pickAudioSrc();
  // isMuxedVideo: true when the video is a single muxed file (audio+video combine
  const isMuxedVideo = (() => {
    if (qua === "medium") return true;
    // Also detect quality=low, quality=sd, etc.
    const quaLower = qua.toLowerCase();
    if (quaLower === "low" || quaLower === "sd" || quaLower === "sd360" || quaLower === "sd480" ||
        quaLower === "360" || quaLower === "480" || quaLower === "360p" || quaLower === "480p") return true;
    try {
      // Helper: check if a label string indicates SD/muxed content
      const isSDLabel = (lbl) => {
        if (!lbl) return false;
        const l = lbl.toLowerCase().trim();
        return l === "sd360" || l === "sd480" ||
          l.startsWith("sd") ||
          l === "360p" || l === "480p" || l === "240p" || l === "144p" ||
          l.includes("360") || l.includes("480") || l.includes("240") || l.includes("144") ||
          l.includes("mux") || l.includes("muxed") || l === "low" || l === "medium";
      };

      // Check all <source> children of the video element for SD/muxed labels
      // First pass: only selected sources
      const sources = videoEl?.querySelectorAll?.("source") || [];
      let hasSelectedSource = false;
      for (const src of sources) {
        const selected = src.getAttribute("selected");
        if (selected === "true" || selected === "selected" || selected === "") {
          hasSelectedSource = true;
          if (isSDLabel(src.getAttribute("label") || src.getAttribute("res") ||
                        src.getAttribute("data-quality") || src.getAttribute("data-label"))) return true;
        }
      }
      // Second pass: if no source has selected="true", check ALL sources
      // (some setups don't set selected attribute — if all sources are SD, it's muxed)
      if (!hasSelectedSource && sources.length > 0) {
        let allSD = true;
        for (const src of sources) {
          const lbl = src.getAttribute("label") || src.getAttribute("res") ||
                      src.getAttribute("data-quality") || src.getAttribute("data-label") || "";
          if (lbl && !isSDLabel(lbl)) { allSD = false; break; }
          if (!lbl) { allSD = false; break; } // unknown label = can't assume SD
        }
        if (allSD && sources.length > 0) return true;
        // Also check the currently-active source (first source or src attribute)
        const activeSrc = videoEl.currentSrc || videoEl.getAttribute("src") || "";
        // URL-based detection: SD URLs often contain resolution markers
        if (activeSrc) {
          const urlLower = activeSrc.toLowerCase();
          if (/[/_.-](360p?|480p?|240p?|144p?|sd)[/_.-]/.test(urlLower)) return true;
          if (/quality[=_](medium|low|sd)/.test(urlLower)) return true;
        }
      }
      // Also check video.js sources API if available
      if (typeof video?.currentSources === "function") {
        const vjsSrcs = video.currentSources() || [];
        for (const s of vjsSrcs) {
          if (isSDLabel(s.label || s.res || "")) return true;
        }
      }
      // Check video.js currentSource label
      try {
        if (typeof video?.currentSource === "function") {
          const cs = video.currentSource();
          if (cs && isSDLabel(cs.label || cs.res || "")) return true;
        }
      } catch {}
      // Check if audio element has no real distinct source from the video.
      // If audio src === video src (same muxed file in both elements), or audio src is
      // empty/blank/missing, there is no separate audio stream to synchronize.
      if (audio) {
        const aSrc = (audio.getAttribute?.("src") || audio.currentSrc || "").trim();
        const vSrc = (videoEl?.getAttribute?.("src") || videoEl?.currentSrc || "").trim();
        // Empty, whitespace-only, or bare href (just the page URL) → no audio stream
        if (!aSrc || aSrc === "" || aSrc === window.location.href) return true;
        // Audio src is a blob: with no real content, or data: URI → likely placeholder
        if (aSrc.startsWith("blob:") && aSrc.length < 20) return true;
        if (aSrc.startsWith("data:")) return true;
        // Audio and video pointing at the same file → muxed
        if (aSrc && vSrc && aSrc === vSrc) return true;
        // Also check video.js current src
        try {
          const vjsVSrc = (typeof video?.currentSrc === "function" ? video.currentSrc() : video?.currentSrc || "");
          if (aSrc && vjsVSrc && aSrc === vjsVSrc) return true;
        } catch {}
        // Check if audio element is in error state already (src set but invalid)
        try {
          if (audio.error && audio.error.code) return true;
          if (audio.networkState === 3) return true; // NETWORK_NO_SOURCE
        } catch {}
      }
    } catch {}
    return false;
  })();
  let coupledMode = hasExternalAudio && !isMuxedVideo;
  // When audio element exists but has no source (e.g. quality=medium sets src=""),
  // silence and disable it immediately so it can never interfere with video playback,
  // audio focus/session, or event handling.
  if (!coupledMode && audio) {
    try { audio.muted = true; audio.volume = 0; } catch {}
    try { audio.preload = "none"; } catch {}
    // Ensure it can never accidentally play
    try { if (!audio.paused) audio.pause(); } catch {}
  }
  let _userExplicitLoop = false;
  function isLoopDesired() {
    return _userExplicitLoop ||
    qs.get("loop") === "1" ||
    qs.get("loop") === "true" ||
    window.forceLoop === true;
  }
  // Check if loop attribute was set in HTML before we override anything
  try { if (videoEl.loop || videoEl.hasAttribute("loop")) _userExplicitLoop = true; } catch {}
  try { if (audio && (audio.loop || audio.hasAttribute("loop"))) _userExplicitLoop = true; } catch {}
  if (!isLoopDesired()) {
    try { videoEl.loop = false; videoEl.removeAttribute?.("loop"); } catch {}
    try { if (audio) { audio.loop = false; audio.removeAttribute?.("loop"); } } catch {}
  }

  // --- loop prevention
  function enforceNoLoop(el) {
    if (!el) return;
    // Only strip loop if user doesn't want it
    if (!isLoopDesired()) {
      try { el.loop = false; el.removeAttribute("loop"); } catch {}
    }
    try {
      const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "loop") ||
                   Object.getOwnPropertyDescriptor(el, "loop");
      if (desc) {
        Object.defineProperty(el, "loop", {
          get() { return isLoopDesired(); },
          set(v) {
            if (v) {
              // User or code is requesting loop — track it
              _userExplicitLoop = true;
              if (desc.set) desc.set.call(el, true);
            } else {
              // Setting loop=false — only honour if NOT desired
              if (!isLoopDesired()) {
                _userExplicitLoop = false;
                if (desc.set) desc.set.call(el, false);
                try { el.removeAttribute("loop"); } catch {}
              }
            }
          },
          configurable: true
        });
      }
    } catch {}
    try {
      const obs = new MutationObserver(mutations => {
        for (const m of mutations) {
          if (m.type === "attributes" && m.attributeName === "loop") {
            if (el.hasAttribute("loop") && !isLoopDesired()) {
              el.removeAttribute("loop");
            }
          }
        }
      });
      obs.observe(el, { attributes: true, attributeFilter: ["loop"] });
    } catch {}
  }
  enforceNoLoop(videoEl);
  if (audio) enforceNoLoop(audio);
  // Also intercept video.js loop() method if it exists
  try {
    if (typeof video.loop === "function") {
      const origLoop = video.loop.bind(video);
      video.loop = function(val) {
        if (arguments.length === 0) return isLoopDesired();
        if (val) { _userExplicitLoop = true; return origLoop(true); }
        if (!isLoopDesired()) { _userExplicitLoop = false; return origLoop(false); }
        return origLoop(isLoopDesired());
      };
    }
  } catch {}
  // Intercept inner video element too (video.js may create a new one)
  try {
    const vjsEl = video?.el?.()?.querySelector?.("video");
    if (vjsEl && vjsEl !== videoEl) enforceNoLoop(vjsEl);
  } catch {}
  video.ready(() => {
    // Enforce loop prevention on any inner video element video.js may have created
    try {
      const vjsInner = video?.el?.()?.querySelector?.("video");
      if (vjsInner && vjsInner !== videoEl) enforceNoLoop(vjsInner);
    } catch {}

    const metaTitle = document.querySelector('meta[name="title"]')?.content || "";
    const metaDesc = document.querySelector('meta[name="twitter:description"]')?.content || "";
    let stats = "";
    const statsMatch = metaDesc.match(/👍\s*[\d.KMB]+\s*(?:\|)?\s*👎\s*[\d.KMB]+\s*(?:\|)?\s*📈\s*[\d.KMB]+\s*(?:Views?)?/i);
    if (statsMatch) {
      stats = statsMatch[0].replace(/\s*\|\s*/g, " | ").trim();
    }
    const createTitleBar = () => {
      const existing = video.getChild("TitleBar");
      if (!existing) {
        const titleBar = video.addChild("TitleBar");
        titleBar.update({ title: metaTitle, description: stats });
      }
    };
    const removeTitleBar = () => {
      const existing = video.getChild("TitleBar");
      if (existing) video.removeChild(existing);
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

  const state = {
    intendedPlaying: false,
    playSessionId: 0,
    restarting: false,
    syncing: false,
    seeking: false,
    seekId: 0,
    seekWantedPlaying: false,
    startupPhase: true,
    startupPrimed: !coupledMode,
    startupKickDone: false,
    startupKickInFlight: false,
    firstPlayCommitted: false,
    firstSeekDone: false,
    audioEverStarted: false,
    userMutedVideo: false,
    userMutedAudio: false,
    strictBufferHold: false,
    strictBufferReason: "",
    strictBufferHoldFrames: 0,
    strictBufferHoldConfirmed: false,
    videoWaiting: false,
    suppressEndedUntil: 0,
    isProgrammaticVideoPlay: false,
    isProgrammaticVideoPause: false,
    isProgrammaticAudioPlay: false,
    isProgrammaticAudioPause: false,
    audioEventsSquelchedUntil: 0,
    audioPlayInFlight: null,
    audioPlayGeneration: 0,
    audioPlayUntil: 0,
    audioPauseUntil: 0,
    startupAudioHoldUntil: 0,
    userPauseUntil: 0,
    userPauseLockUntil: 0,
    userPlayUntil: 0,
    mediaForcedPauseUntil: 0,
    pauseEventGuardUntil: 0,
    mediaPlayTxnUntil: 0,
    mediaPauseTxnUntil: 0,
    mediaLockUntil: 0,
    hiddenMediaPlayUntil: 0,
    chromiumAudioStartLockUntil: 0,
    chromiumPauseGuardUntil: 0,
    chromiumBgSettlingUntil: 0,
    lastMediaAction: "",
    lastMediaActionTs: 0,
    syncTimer: null,
    syncScheduledAt: 0,
    fastSyncUntil: 0,
    bgResumeRetryTimer: null,
    resumeAfterBufferTimer: null,
    mediaSessionActionSerial: 0,
    mediaPositionNextAt: 0,
    bgHiddenSince: 0,
    bgHiddenBaseVT: 0,
    bgHiddenBaseAT: 0,
    bgHiddenBaseRate: 1,
    bgHiddenWasPlaying: false,
    resumeOnVisible: false,
    bgAutoResumeSuppressed: false,
    bgCatchUpCooldownUntil: 0,
    bgResumeInFlight: false,
    seekResumeInFlight: false,
    seekFinalizeTimer: null,
    seekWatchdogTimer: null,
    lastAT: 0,
    audioLastProgressTs: 0,
    lastVT: 0,
    lastVTts: 0,
    audioKickCooldownUntil: 0,
    videoRepairing: false,
    videoRepairCooldownUntil: 0,
    hardPauseVerifySerial: 0,
    startupPrimeStartedAt: performance.now(),
                          lastKnownGoodVT: 0,
                          lastKnownGoodVTts: 0,
                          startupAutoplayRetryTimer: null,
                          startupAutoplayRetryCount: 0,
                          driftStableFrames: 0,
                          lastDrift: 0,
                          bgTransitionInProgress: false,
                          audioRateNudgeActive: false,
                          audioRateNudgeUntil: 0,
                          syncConvergenceCount: 0,
                          lastSyncDrift: 0,
                          backgroundPauseBlocked: false,
                          mediaControlPending: false,
                          initialSyncComplete: false,
                          audioPopPreventUntil: 0,
                          audioFading: false,
                          audioFadeTarget: 1,
                          audioLastPlayPauseTs: 0,
                          initialSyncDone: false,
                          bufferHoldIntendedPlaying: false,
                          mediaSessionInitiatedPlay: false,
                          pendingSeekTarget: null,
                          playRequestedDuringSeek: false,
                          seekCompleted: false,
                          audioVolumeBeforePause: 1,
                          stateChangeCooldownUntil: 0,
                          audioFadeCompleteUntil: 0,
                          chromiumBgPauseBlockedUntil: 0,
                          tabVisibilityChangeUntil: 0,
                          audioGainSmoothUntil: 0,
                          chromiumBgPauseBlockedUntilExtended: 0,
                          visibilityTransitionActive: false,
                          visibilityTransitionUntil: 0,
                          lastVisibilityState: "visible",
                          bgPauseSuppressionCount: 0,
                          bgPauseSuppressionResetAt: 0,
                          mediaSessionPauseBlockedUntil: 0,
                          rapidToggleDetected: false,
                          rapidToggleUntil: 0,
                          altTabTransitionActive: false,
                          altTabTransitionUntil: 0,
                          lastFocusLoss: 0,
                          focusLossCount: 0,
                          focusLossResetAt: 0,
                          chromiumAutoPauseBlockedUntil: 0,
                          chromiumPauseEventSuppressedUntil: 0,
                          lastPauseEventTs: 0,
                          pauseEventCount: 0,
                          pauseEventResetAt: 0,
                          visibilityStableUntil: 0,
                          focusStableUntil: 0,
                          mediaSessionOverrideActive: false,
                          audioVolumeLocked: false,
                          audioSafeMuteUntil: 0,
                          seekAudioSyncPending: false,
                          seekAudioSyncTime: 0,
                          seekAudioSyncUntil: 0,
                          bgPlaybackAllowed: true,
                          startupBgRetryCount: 0,
                          bgPlayAttempted: false,
                          audioVolumeBeforeTimeChange: 1,
                          audioZeroVolumeConfirmed: false,
                          rapidPlayPauseCount: 0,
                          rapidPlayPauseResetAt: 0,
                          // Separate user-click spam tracker — only counts deliberate pointer/key events,
                          // NOT background/auto play-pause events. Used for audio protection.
                          userClickSpamCount: 0,
                          userClickSpamWindowStart: 0,
                          userClickSpamActive: false,
                          userClickSpamUntil: 0,
                          audioPlayAttemptCount: 0,
                          audioPlayAttemptResetAt: 0,
                          backgroundAutoplayTriggered: false,
                          audioStartupPlayAttempted: false,
                          audioStartupPlayRetries: 0,
                          audioForcePlayTimer: null,
                          wakeupTimer: null,
                          startupZeroed: false,
                          startupPlaySettleUntil: 0,
                          startupPlaySettled: false,
                          startupKickAttempts: 0,
                          userGesturePauseIntent: false,
                          pageFullyLoaded: document.readyState === "complete",
                          bgAudioStartQueued: false,
                          bbtabRetryTimer: null,
                          bbtabRetryRafId: null,
                          bbtabRetryCount: 0,
                          bbtabAudioSyncTimer: null,
                          bbtabVideoConfirmedAt: 0,
                          bbtabAudioSyncDone: false,       // true after first audio sync attempt in retry loop
                          bbtabAudioFallbackDone: false,   // true after fallback audio retry (600ms after video confirmed)
lastUserActionTime: 0,
loopPreventionCooldownUntil: 0,
seekCooldownUntil: 0,
volumeSaveScheduled: false,
lastBgReturnAt: 0,
tabReturnGen: 0,
tabReturnImmuneUntil: 0,
tabReturnAudioMuted: false,
tabReturnSettleTimer: null,
bgSuppressionSessionCount: 0,
// NEW: Heartbeat & stall recovery
heartbeatTimer: null,
lastHeartbeatAt: 0,
videoStallSince: 0,
audioStallSince: 0,
stallRecoveryUntil: 0,
networkOnline: typeof navigator.onLine === "boolean" ? navigator.onLine : true,
networkRecoverUntil: 0,
audioContextUnlocked: false,
mediaErrorCount: 0,
mediaErrorCooldownUntil: 0,
lastConsistencyCheckAt: 0,
consistencyCheckPendingPlayUntil: 0,
// Background silent time sync — prevents seek handler from firing during bg progress-bar sync
bgSilentTimeSyncing: false,
bgSilentTimeSyncTimer: null,
// Timestamp when strictBufferHold last became true — used to force-clear stuck holds
bufferHoldSince: 0,
// Was audio paused because video entered a waiting/stall state?
videoStallAudioPaused: false,
// Timestamp when videoStallAudioPaused became true (for the stall watchdog)
stallAudioPausedSince: 0,
// Last time the stall watchdog ran
lastStallWatchdogAt: 0,
// After a video stall pauses audio, don't allow audio resume until this timestamp.
// This prevents the rapid play/pause loop when video fires playing with thin buffer.
stallAudioResumeHoldUntil: 0,
audioPausedSince: 0,
seekTargetTime: 0,
videoSyncRetryTs: 0,
// User intent presets — set immediately on pointer events,
// consumed by play/pause handlers for bulletproof non-coupled/quality=medium support
userPauseIntentPresetAt: 0,
userPlayIntentPresetAt: 0,
_stallAudioPauseTimer: null,
seekBuffering: false,
seekBufferResumeTimer: null,
_allowAudioTimeWrite: false
  };

  // Gate audio.play() — block during seeking/seekBuffering so nothing can restart audio mid-seek.
  if (audio && typeof audio.play === "function") {
    const _origAudioPlay = audio.play.bind(audio);
    audio.play = function() {
      if (state.seeking || state.seekBuffering) return Promise.resolve();
      return _origAudioPlay();
    };
  }
  // Gate audio.currentTime — during seeking, only allow writes from the seeking/seeked handlers
  // (they set _allowAudioTimeWrite=true). All other writes are blocked to prevent desync.
  if (audio) {
    state._allowAudioTimeWrite = false;
    const _audioCtDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
    if (_audioCtDesc && _audioCtDesc.set) {
      const _origSet = _audioCtDesc.set;
      const _origGet = _audioCtDesc.get;
      Object.defineProperty(audio, "currentTime", {
        get() { return _origGet.call(this); },
        set(v) {
          if ((state.seeking || state.seekBuffering) && !state._allowAudioTimeWrite) return;
          _origSet.call(this, v);
        },
        configurable: true
      });
    }
  }

  const BackgroundPlaybackManager = (() => {
    const PHASE = { STABLE_FG: 0, GOING_BG: 1, STABLE_BG: 2, RETURNING: 3 };
    let _phase = PHASE.STABLE_FG;
    let _phaseAt = 0;
    let _returnSessionId = 0;
    let _returnSuppressedUntil = 0;
    let _returnTimer = null;

    // Exponential backoff state
    let _bgResumeAttempts = 0;
    let _bgResumeBackoffUntil = 0;

    // "Stable playing" state: audio played cleanly for >2s before this pause
    let _stablePlayingSince = 0;
    let _wasStableBeforePause = false;

    const SPURIOUS_BURST_MS  = platform.chromiumOnlyBrowser ? 1200 : 500;
    const RETURN_SUPPRESS_MS = platform.chromiumOnlyBrowser ? 10000 : 5000;
    const BG_RESUME_BASE_MS  = 800;
    const BG_RESUME_MAX_MS   = 32000;

    function _backoffMs() {
      // 0s, 0.8s, 1.6s, 3.2s, 6.4s, 12.8s, 25.6s, 32s, 32s…
      if (_bgResumeAttempts === 0) return 0;
      return Math.min(BG_RESUME_BASE_MS * Math.pow(2, _bgResumeAttempts - 1), BG_RESUME_MAX_MS);
    }
    function _clearReturnTimer() {
      if (_returnTimer) { clearTimeout(_returnTimer); _returnTimer = null; }
    }

    // --- stable-audio tracking (called by heartbeat)
    function markAudioPlayingStable() {
      if (!_stablePlayingSince) _stablePlayingSince = now();
    }
    function markAudioNotPlaying() {
      _stablePlayingSince = 0;
    }
    function wasStableBeforeCurrentPause() { return _wasStableBeforePause; }

    // --- lifecycle hooks
    function onBecomeBackground() {
      if (_phase === PHASE.STABLE_BG) return;
      _clearReturnTimer();
      _phase = PHASE.GOING_BG;
      _phaseAt = now();
      _wasStableBeforePause = (_stablePlayingSince > 0 && (now() - _stablePlayingSince) > 2000);
      setTimeout(() => {
        if (_phase === PHASE.GOING_BG) { _phase = PHASE.STABLE_BG; _phaseAt = now(); }
      }, 200);
    }

    function onBecomeForeground() {
      _clearReturnTimer();
      _returnSessionId++;
      const mySession = _returnSessionId;
      _phase = PHASE.RETURNING;
      _phaseAt = now();
      _returnSuppressedUntil = now() + RETURN_SUPPRESS_MS;
      // Fresh foreground session → reset all backoff state
      _bgResumeAttempts = 0;
      _bgResumeBackoffUntil = 0;
      _stablePlayingSince = 0;
      _wasStableBeforePause = false;
      _returnTimer = setTimeout(() => {
        if (_returnSessionId !== mySession) return;
        _phase = PHASE.STABLE_FG;
        _phaseAt = now();
        _returnTimer = null;
      }, RETURN_SUPPRESS_MS + 300);
    }

    // --- state queries
    function isBackground() {
      return _phase === PHASE.STABLE_BG || _phase === PHASE.GOING_BG;
    }
    function isReturning() { return _phase === PHASE.RETURNING; }
    function isAnyTransition() {
      return _phase === PHASE.GOING_BG || _phase === PHASE.RETURNING;
    }

    // Primary gate: should ANY non-user-action pause event be suppressed?
    function shouldSuppressAutoPause() {
      if (_phase === PHASE.STABLE_BG || _phase === PHASE.GOING_BG) return true;
      if (now() < _returnSuppressedUntil) return true;
      return false;
    }

    // Is a very recent pointer/keyboard event active on the visible page?
    // Extended to 2000ms so it covers slow transitions and delayed RAF callbacks.
    function isUserPauseImmediate() {
      return (now() - state.lastUserActionTime) < 2000 && document.visibilityState === 'visible';
    }
    function isUserPlayImmediate() {
      return (now() - state.lastUserActionTime) < 2000 && document.visibilityState === 'visible';
    }

    // --- exponential backoff for background resume
    function canAttemptBgResume() {
      if (!isBackground()) return true;
      return now() >= _bgResumeBackoffUntil;
    }
    function trackBgResumeAttempt() {
      _bgResumeAttempts++;
      _bgResumeBackoffUntil = now() + _backoffMs();
    }
    function resetBgResumeBackoff() {
      _bgResumeAttempts = 0;
      _bgResumeBackoffUntil = 0;
    }

    function getPhaseLabel() {
      return ['STABLE_FG','GOING_BG','STABLE_BG','RETURNING'][_phase] || '?';
    }

    return {
      onBecomeBackground, onBecomeForeground,
      isBackground, isReturning, isAnyTransition,
      shouldSuppressAutoPause,
      isUserPauseImmediate, isUserPlayImmediate,
      canAttemptBgResume, trackBgResumeAttempt, resetBgResumeBackoff,
      markAudioPlayingStable, markAudioNotPlaying, wasStableBeforeCurrentPause,
      getPhaseLabel,
    };
  })();

  // --- BackgroundPlaybackManagerManager (BPMM)
  const BackgroundPlaybackManagerManager = (() => {
    let _oscillationCount = 0;
    let _oscillationWindowStart = 0;
    let _oscillationLockUntil = 0;
    let _bgPlayIntent = true;

    const OSCILLATION_WINDOW_MS = 10000; // 10s window
    const MAX_OSCILLATIONS = 5;          // 5 forced cycles → lock
    const OSCILLATION_LOCK_MS = 20000;   // 20s lock before retrying

    function _trackOscillation() {
      const nowTs = now();
      if ((nowTs - _oscillationWindowStart) > OSCILLATION_WINDOW_MS) {
        _oscillationCount = 0;
        _oscillationWindowStart = nowTs;
      }
      _oscillationCount++;
      if (_oscillationCount >= MAX_OSCILLATIONS) {
        _oscillationLockUntil = nowTs + OSCILLATION_LOCK_MS;
        _oscillationCount = 0;
        _oscillationWindowStart = nowTs;
        return true; // oscillating — lock it
      }
      return false;
    }

    // Should we attempt a background resume right now?
    function shouldAttemptBgResume() {
      if (!_bgPlayIntent) return false;
      if (now() < _oscillationLockUntil) return false;
      if (!BackgroundPlaybackManager.canAttemptBgResume()) return false;
      return true;
    }

    // Called when a browser-forced bg pause/resume cycle is detected
    function onBrowserForcedPause() {
      if (_trackOscillation()) {
        // Oscillating too fast — stop attempting bg resume
        _bgPlayIntent = false;
        return false; // caller should set resumeOnVisible instead
      }
      return true; // caller may still attempt resume (with BPM backoff)
    }

    // Called when background playback SUCCEEDS (both tracks actually playing)
    function onBgPlaySuccess() {
      _oscillationCount = 0;
      _oscillationWindowStart = 0;
      _oscillationLockUntil = 0;
      BackgroundPlaybackManager.resetBgResumeBackoff();
    }

    // Called on every foreground return — reset all oscillation state
    function onForegroundReturn() {
      _bgPlayIntent = true;
      _oscillationCount = 0;
      _oscillationWindowStart = 0;
      _oscillationLockUntil = 0;
    }

    function setBgPlayIntent(val) { _bgPlayIntent = !!val; }

    return {
      shouldAttemptBgResume, onBrowserForcedPause, onBgPlaySuccess, onForegroundReturn,
      setBgPlayIntent,
    };
  })();

  // --- VisibilityGuard (VG)
  const VisibilityGuard = (() => {
    let _suppressUntil   = 0;
    let _tabHiddenAt     = 0;
    let _tabVisibleAt    = 0;
    let _lastPlayCalledAt = 0;

    // How long to suppress non-user pauses after each event type.
    const HIDE_SUPPRESS_MS       = 400;
    const SHOW_GRACE_MS          = 8000;
    const POST_PLAY_SUPPRESS_MS  = 3000;

    function _extend(ms) {
      _suppressUntil = Math.max(_suppressUntil, performance.now() + ms);
    }

    // Called the moment the page becomes hidden (visibilitychange → hidden OR blur)
    function onTabHide() {
      _tabHiddenAt = performance.now();
      _extend(HIDE_SUPPRESS_MS);
    }

    // Called the moment the page becomes visible (visibilitychange → visible OR focus)
    function onTabShow() {
      _tabVisibleAt = performance.now();
      _extend(SHOW_GRACE_MS);
    }

    // Called every time our own code issues a play() call.
    // Prevents the browser's "I paused because autoplay policy" response from
    // immediately killing intendedPlaying after we just set it.
    function onPlayCalled() {
      _lastPlayCalledAt = performance.now();
      _extend(POST_PLAY_SUPPRESS_MS);
    }

    // Called only when user explicitly pauses (markUserPauseIntent, MediaSession pause).
    // Clears suppression so the user's intent is respected immediately.
    function onUserPause() {
      _suppressUntil = 0;
    }

    // Primary gate: should we ignore this non-user-initiated pause event?
    function shouldSuppress() {
      return performance.now() < _suppressUntil;
    }

    // Is the page currently in a tab-return grace window?
    function isInReturnGrace() {
      return _tabVisibleAt > 0 && (performance.now() - _tabVisibleAt) < SHOW_GRACE_MS;
    }

    // Explicit extend (e.g. for BFCache restore or device wakeup)
    function extendMs(ms) { _extend(ms); }

    function getTabHiddenAt()  { return _tabHiddenAt;  }
    function getTabVisibleAt() { return _tabVisibleAt; }

    return {
      onTabHide, onTabShow, onPlayCalled, onUserPause,
      shouldSuppress, isInReturnGrace, extendMs,
      getTabHiddenAt, getTabVisibleAt,
    };
  })();



  // --- MediumQualityManager
  const MediumQualityManager = (() => {
    const enabled = !coupledMode;

    let _intentPaused = false;  // true = user wants video stopped
    let _lastUserPauseAt = 0;
    let _lastUserPlayAt = 0;
    let _pauseSerial = 0;       // incremented on every user pause, used to detect stale resumes

    const INTENT_WINDOW_MS = 120000; // 2min -- effectively sticky until user plays again

    function markUserPaused() {
      if (!enabled) return;
      _intentPaused = true;
      _lastUserPauseAt = performance.now();
      _pauseSerial++;
    }

    function markUserPlayed() {
      if (!enabled) return;
      _intentPaused = false;
      _lastUserPlayAt = performance.now();
    }

    // True when user has explicitly paused within the last INTENT_WINDOW_MS.
    // Used to block automatic resumes (runSync watchdog, "playing" event override, etc).
    function userRecentlyPaused() {
      return _intentPaused && (performance.now() - _lastUserPauseAt) < INTENT_WINDOW_MS;
    }

    // True when user has explicitly played within the last INTENT_WINDOW_MS.
    // Used to block automatic pause-coercion from background/transition guards.
    function userRecentlyPlayed() {
      return !_intentPaused && (performance.now() - _lastUserPlayAt) < INTENT_WINDOW_MS;
    }

    // Primary guard: should any automatic video resume be blocked right now?
    // Call this before execProgrammaticVideoPlay() or setting intendedPlaying=true
    // in response to non-user events in non-coupled mode.
    function shouldBlockAutoResume() {
      if (!enabled) return false;
      return userRecentlyPaused();
    }

    // Has the pause intent expired? Used by runSync to know when it's safe to
    // try restarting a stalled video (e.g. network recovery after a long stall).
    function intentExpired() {
      if (!enabled) return true;
      if (!_intentPaused) return true;
      return (performance.now() - _lastUserPauseAt) >= INTENT_WINDOW_MS;
    }

    function getPauseSerial() { return _pauseSerial; }

    return {
      get enabled() { return enabled; },
                                markUserPaused,
                                markUserPlayed,
                                userRecentlyPaused,
                                userRecentlyPlayed,
                                shouldBlockAutoResume,
                                intentExpired,
                                getPauseSerial,
                                get intentPaused() { return _intentPaused; },
    };
  })();


  // --- PlaybackStabilityManager
  const PlaybackStabilityManager = (() => {
    let _lastCorrectionAt = 0;
    let _correctionCount = 0;
    let _correctionWindowStart = 0;
    let _lastCheckedVT = -1;
    let _lastCheckedVTAt = 0;
    let _frozenSince = 0;          // when video appears frozen (position stuck)
  let _lastAutoResumeSuppressedAt = 0;

  const CORRECTION_COOLDOWN_MS = 1200;  // minimum gap between corrections
  const MAX_CORRECTIONS_IN_WINDOW = 4;  // max corrections per 10s window
  const CORRECTION_WINDOW_MS = 10000;
  const FROZEN_THRESHOLD_MS = 4000;     // video stuck at same position for 4s = frozen
  const FROZEN_THRESHOLD_POS = 0.05;    // position change < 0.05s = frozen

  function _canCorrect() {
    if ((performance.now() - _lastCorrectionAt) < CORRECTION_COOLDOWN_MS) return false;
    const n = performance.now();
    if ((n - _correctionWindowStart) > CORRECTION_WINDOW_MS) {
      _correctionCount = 0;
      _correctionWindowStart = n;
    }
    return _correctionCount < MAX_CORRECTIONS_IN_WINDOW;
  }

  function _markCorrection() {
    _lastCorrectionAt = performance.now();
    const n = performance.now();
    if ((n - _correctionWindowStart) > CORRECTION_WINDOW_MS) {
      _correctionCount = 0;
      _correctionWindowStart = n;
    }
    _correctionCount++;
  }

  // Called from heartbeat. Checks actual vs intended state and corrects if safe.
  function check(stateRef, getVideoPausedFn, execPlayFn, execPauseFn) {
    if (!stateRef || !getVideoPausedFn) return;
    try {
      const n = performance.now();
      // Tab-return immunity: skip all corrections during the immune window
      if (stateRef.tabReturnImmuneUntil > n) return;
      const videoPaused = getVideoPausedFn();
      const intending = stateRef.intendedPlaying;
      const isHidden = document.visibilityState === "hidden";
      const inGrace = (n - stateRef.lastBgReturnAt) < 8000;
      const isSeeking = stateRef.seeking || stateRef.syncing || stateRef.restarting;
      const isInFlight = stateRef.bgResumeInFlight || stateRef.seekResumeInFlight;

      // Track frozen playback (position not advancing despite intendedPlaying)
      try {
        if (!coupledMode && intending && !videoPaused && !isHidden && !isSeeking) {
          let vt = 0;
          try { vt = Number(stateRef.lastVT || 0); } catch {}
          if (Math.abs(vt - _lastCheckedVT) < FROZEN_THRESHOLD_POS && _lastCheckedVT >= 0) {
            if (!_frozenSince) _frozenSince = n;
          } else {
            _frozenSince = 0;
            _lastCheckedVT = vt;
            _lastCheckedVTAt = n;
          }
        } else {
          _frozenSince = 0;
        }
      } catch {}

      // Correction 1: Video should be playing but is unexpectedly paused
      if (intending && videoPaused && !isHidden && !inGrace && !isSeeking && !isInFlight) {
        // Check all blocking conditions before attempting a correction
        const noUserPause = !stateRef.userPauseUntil || n >= stateRef.userPauseUntil;
        const noMediumBlock = !MediumQualityManager.shouldBlockAutoResume();
        const noMediaForced = !stateRef.mediaForcedPauseUntil || n >= stateRef.mediaForcedPauseUntil;
        const notInStartupHold = !stateRef.strictBufferHold;

        if (noUserPause && noMediumBlock && noMediaForced && notInStartupHold && _canCorrect()) {
          try { execPlayFn && execPlayFn(); } catch {}
          _markCorrection();
        }
      }

      // Correction 2: Video should be paused but is unexpectedly playing
      if (!intending && !videoPaused && !isSeeking &&
        !stateRef.isProgrammaticVideoPlay && !isInFlight) {
        // Only correct if we're confident this isn't a transient/buffering resume
        const notInTxn = n >= (stateRef.mediaLockUntil || 0);
      const notInStartupGrace = stateRef.firstPlayCommitted;
      if (notInTxn && notInStartupGrace && _canCorrect()) {
        try { execPauseFn && execPauseFn(); } catch {}
        _markCorrection();
      }
        }

        // Correction 3: Detect if autoplay keep-alive is fighting a user pause (non-coupled)
        if (!coupledMode && !intending && !videoPaused && !isSeeking) {
          _lastAutoResumeSuppressedAt = n;
        }
    } catch {}
  }

  function getLastCorrectionAge() {
    return performance.now() - _lastCorrectionAt;
  }

  function isFrozen() {
    return _frozenSince > 0 && (performance.now() - _frozenSince) > FROZEN_THRESHOLD_MS;
  }

  function resetFrozen() { _frozenSince = 0; }

  function onUserAction() {
    // Reset oscillation counters on deliberate user interaction
    _correctionCount = 0;
    _correctionWindowStart = 0;
  }

  return {
    check,
    isFrozen,
    resetFrozen,
    onUserAction,
    getLastCorrectionAge,
  };
  })();


  // --- BringBackToTabManager (BBTM)
  const BringBackToTabManager = (() => {
    // How long to hold the lock after a tab-return event.
    // 3500ms covers Chromium's longest observed spurious-pause burst (~800ms)
    // with a generous safety margin for slow machines and Firefox.
    const LOCK_DURATION_MS = 3500;

    // After video is confirmed playing, how long to continue absorbing late
    // spurious pauses. Runs CONCURRENTLY with the main lock — does not replace it.
    const POST_PLAY_SETTLE_MS = 2000;

    let _lockUntil           = 0;
    let _postPlaySettleUntil = 0;
    let _returnTs            = 0;  // timestamp of the most recent tab-return event
    let _videoConfirmedAt    = 0;  // when video was first confirmed playing this return
    let _lateArrivalCount    = 0;  // how many pause events arrived after video confirmed

    function isLocked() {
      return now() < _lockUntil || now() < _postPlaySettleUntil;
    }

    // Called the instant the tab becomes visible.
    function onTabReturn() {
      _returnTs            = now();
      _lockUntil           = now() + LOCK_DURATION_MS;
      _postPlaySettleUntil = 0;
      _videoConfirmedAt    = 0;
      _lateArrivalCount    = 0;
    }

    // Called once the video is confirmed playing after a return.
    // v2: does NOT drain _lockUntil — main lock runs to natural expiry.
    // Only sets _postPlaySettleUntil as an ADDITIONAL protection layer.
    function onVideoConfirmedPlaying() {
      if (_returnTs === 0) return; // not in a return sequence
      if (!_videoConfirmedAt) _videoConfirmedAt = now();
      // Post-play settle window starts from confirmation time, runs 2s
      _postPlaySettleUntil = Math.max(_postPlaySettleUntil, now() + POST_PLAY_SETTLE_MS);
      // Main lock stays: _lockUntil is NOT drained here (v2 change)
    }

    // Called each time a pause event is suppressed after video was already confirmed.
    // Adaptively extends both windows so late-arriving pauses keep getting absorbed.
    function onLateArrivedPause() {
      _lateArrivalCount++;
      if (_lateArrivalCount <= 8) {
        _lockUntil           = Math.max(_lockUntil,           now() + 400);
        _postPlaySettleUntil = Math.max(_postPlaySettleUntil, now() + 600);
      }
    }

    // Called when the user explicitly pauses — cancel immediately so their
    // pause isn't swallowed.
    function onUserPause() {
      _lockUntil           = 0;
      _postPlaySettleUntil = 0;
      _returnTs            = 0;
      _videoConfirmedAt    = 0;
      _lateArrivalCount    = 0;
    }

    // Extend both windows by ms (e.g. when audio is still catching up).
    function extendLock(ms) {
      if (_returnTs === 0) return;
      _lockUntil           = Math.max(_lockUntil,           now() + ms);
      _postPlaySettleUntil = Math.max(_postPlaySettleUntil, now() + ms);
    }

    // Hard cancel (e.g. page unload, error recovery).
    function cancelLock() {
      _lockUntil           = 0;
      _postPlaySettleUntil = 0;
      _returnTs            = 0;
      _videoConfirmedAt    = 0;
      _lateArrivalCount    = 0;
    }

    // How long ago (ms) was the last tab return? Used by retry loop.
    function timeSinceReturn() {
      return _returnTs > 0 ? (now() - _returnTs) : Infinity;
    }

    function isVideoConfirmed()    { return _videoConfirmedAt > 0; }
    function getLateArrivalCount() { return _lateArrivalCount; }

    return {
      isLocked, onTabReturn, onVideoConfirmedPlaying, onLateArrivedPause,
      onUserPause, cancelLock, extendLock, timeSinceReturn,
      isVideoConfirmed, getLateArrivalCount,
    };
  })();


  // --- QuantumReturnOrchestrator (QRO)
  const QuantumReturnOrchestrator = (() => {
    let _snapshot          = null;  // {ts, vPos, aPos, wasPlaying}
    let _returnTs          = 0;     // when we last returned to foreground
    let _preemptiveFired   = false; // did preemptive play() fire this return?
    let _bgPlayConfirmed   = false; // bg playback confirmed still running on return
    let _audioPreAligned   = false; // did we pre-align audio before play()?

    // --- background entry
    // Snapshot state the instant the page hides. Called from visibilitychange
    // hidden branch AND from the blur handler for maximum coverage.
    function snapshotState() {
      try {
        const vPos = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
        const aPos = (coupledMode && audio) ? (Number(audio.currentTime) || vPos) : null;
        _snapshot = {
          ts:         performance.now(),
                                     vPos,
                                     aPos,
                                     wasPlaying: state.intendedPlaying,
        };
      } catch {}
    }

    // --- foreground return: pre-emptive play
    function preemptivePlay() {
      if (!state.intendedPlaying) return;
      _returnTs        = performance.now();
      _preemptiveFired = false;
      _audioPreAligned = false;
      _bgPlayConfirmed = false;

      try {
        const vn = getVideoNode();
        if (vn && typeof vn.play === 'function') {
          vn.play().catch(() => {});
          _preemptiveFired = true;
        }
        if (coupledMode && audio && !state.tabReturnAudioMuted) {
          try {
            const vt = Number(video.currentTime()) || 0;
            if (isFinite(vt) && Math.abs((audio.currentTime || 0) - vt) > 0.15) {
              audio.currentTime = vt;
              _audioPreAligned = true;
            }
          } catch {}
          if (audio.paused) {
            cancelActiveFade();
            audio.play().catch(() => {});
          }
        }
      } catch {}
    }

    // --- continuity assessment
    // Called by the retry loop on first success tick. Determines whether
    // background playback was alive (position advanced) or killed.
    function assessContinuity() {
      if (!_snapshot) return;
      try {
        const vNow    = (() => { try { return Number(video.currentTime()); } catch { return NaN; } })();
        const elapsed = (performance.now() - _snapshot.ts) / 1000;
        // If video is significantly ahead of where it was when we went BG,
        // background playback was running (rare but possible on some platforms).
        if (isFinite(vNow) && (vNow - _snapshot.vPos) > (elapsed * 0.5)) {
          _bgPlayConfirmed = true;
        }
      } catch {}
    }

    function getSnapshot()        { return _snapshot; }
    function getReturnAge()       { return _returnTs ? (performance.now() - _returnTs) : Infinity; }
    function wasBgPlayConfirmed() { return _bgPlayConfirmed; }
    function wasPreemptiveFired() { return _preemptiveFired; }

    return {
      snapshotState, preemptivePlay, assessContinuity,
      getSnapshot, getReturnAge, wasBgPlayConfirmed, wasPreemptiveFired,
    };
  })();




  // ═══════════════════════════════════════════════════════════════════════════
  const UltraStabilizer = (() => {
    // --- shared nano-clock
    const _now = () => performance.now();

    // --- 1. AudioVideoLockstepGuard (AVLG)
    const AVLG = (() => {
      let _videoHasPlayed    = false; // video fired "playing" at least once
      let _audioHasPlayed    = false; // audio fired "playing" at least once
      let _lockReleasedAt    = 0;     // when the startup lock was lifted
      let _startupLockActive = true;  // stays true until video plays or timeout
      let _videoStallCount   = 0;
      let _audioStallCount   = 0;
      let _audioBlockLog     = 0;     // how many times we blocked audio (debug)

    // The lock is released when video plays OR after 12s (failsafe)
    const STARTUP_LOCK_TIMEOUT_MS = 12000;
    const _startTs = _now();

    function _maybeReleaseLock() {
      if (!_startupLockActive) return;
      if (_videoHasPlayed) {
        _startupLockActive = false;
        _lockReleasedAt = _now();
      } else if ((_now() - _startTs) > STARTUP_LOCK_TIMEOUT_MS) {
        // Failsafe: release after timeout to not block forever
        _startupLockActive = false;
        _lockReleasedAt = _now();
      }
    }

    function onVideoPlaying() {
      _videoHasPlayed = true;
      _videoStallCount = 0;
      _maybeReleaseLock();
    }

    function onAudioPlaying() {
      _audioHasPlayed = true;
      _audioStallCount = 0;
    }

    function onVideoStall() { _videoStallCount++; }
    function onAudioStall() { _audioStallCount++; }

    // Primary gate: return true → caller must NOT play audio right now
    function shouldBlockAudio() {
      _maybeReleaseLock();
      if (!_startupLockActive) return false;
      if (!coupledMode) return false; // only matters in coupled A/V mode
      if (_videoHasPlayed) return false;
      // Video not yet playing → block audio
      _audioBlockLog++;
      return true;
    }

    function isVideoConfirmedPlaying() { return _videoHasPlayed; }
    function isAudioConfirmedPlaying() { return _audioHasPlayed; }
    function getAudioBlockCount()      { return _audioBlockLog;   }
    function isStartupLockActive()     { return _startupLockActive; }

    // Force-release for edge cases (e.g. muxed mode toggle)
    function forceRelease() { _startupLockActive = false; _lockReleasedAt = _now(); }

    return {
      onVideoPlaying, onAudioPlaying, onVideoStall, onAudioStall,
      shouldBlockAudio, isVideoConfirmedPlaying, isAudioConfirmedPlaying,
      getAudioBlockCount, isStartupLockActive, forceRelease,
    };
    })();

    // --- 2. StartupSequencer
    // State machine that tracks the startup phase with strict ordering.
    // Phases: COLD → VIDEO_LOADING → VIDEO_READY → VIDEO_PLAYING → BOTH_COMMITTED → STABLE
    const StartupSequencer = (() => {
      const PHASE = {
        COLD: 0, VIDEO_LOADING: 1, VIDEO_READY: 2,
        VIDEO_PLAYING: 3, BOTH_COMMITTED: 4, STABLE: 5,
      };
      let _phase = PHASE.COLD;
      let _phaseAt = _now();
      let _videoReadyStateAtStart = 0;
      let _audioReadyStateAtStart = 0;
      let _videoPlayedAt  = 0;
      let _audioPlayedAt  = 0;
      let _bothCommittedAt = 0;
      let _stableAt        = 0;
      const STABILITY_WINDOW_MS = 2000; // both must play for 2s to reach STABLE

      function _advance(newPhase) {
        if (newPhase > _phase) { _phase = newPhase; _phaseAt = _now(); }
      }

      function onVideoLoading()  { _advance(PHASE.VIDEO_LOADING); }
      function onVideoReady()    {
        _videoReadyStateAtStart = (() => { try { return Number(getVideoNode().readyState || 0); } catch { return 0; } })();
        _advance(PHASE.VIDEO_READY);
      }
      function onVideoPlaying()  {
        _videoPlayedAt = _now();
        _advance(PHASE.VIDEO_PLAYING);
        // Once video plays, audio is permitted — immediately try to advance
        if (_audioPlayedAt > 0) _checkBothCommitted();
      }
      function onAudioPlaying()  {
        _audioPlayedAt = _now();
        _checkBothCommitted();
      }
      function _checkBothCommitted() {
        if (!coupledMode) { _advance(PHASE.BOTH_COMMITTED); return; }
        if (_videoPlayedAt > 0 && _audioPlayedAt > 0) {
          _bothCommittedAt = _now();
          _advance(PHASE.BOTH_COMMITTED);
        }
      }

      // Called from periodic tick
      function tick() {
        if (_phase === PHASE.BOTH_COMMITTED && (_now() - _bothCommittedAt) > STABILITY_WINDOW_MS) {
          _stableAt = _now();
          _advance(PHASE.STABLE);
        }
        // Failsafe: after 15s always mark stable
        if (_phase < PHASE.STABLE && (_now() - _phaseAt) > 15000) {
          _advance(PHASE.STABLE);
        }
      }

      function shouldBlockAudioAtStartup() {
        if (!coupledMode) return false;
        // Block audio if video has not yet fired "playing"
        return _phase < PHASE.VIDEO_PLAYING;
      }

      function isStable()          { return _phase >= PHASE.STABLE; }
      function isBothCommitted()   { return _phase >= PHASE.BOTH_COMMITTED; }
      function getPhaseLabel()     {
        return ['COLD','VIDEO_LOADING','VIDEO_READY','VIDEO_PLAYING','BOTH_COMMITTED','STABLE'][_phase] || '?';
      }
      function getPhaseAge()       { return _now() - _phaseAt; }

      return {
        onVideoLoading, onVideoReady, onVideoPlaying, onAudioPlaying,
        tick, shouldBlockAudioAtStartup, isStable, isBothCommitted,
        getPhaseLabel, getPhaseAge,
      };
    })();

    // --- 3. BufferHealthMonitor
    // Every tick, measures buffered-seconds-ahead for video and audio.
    // Maintains a rolling 8-sample window; calculates health score 0-100.
    const BufferHealthMonitor = (() => {
      const WINDOW = 8;
      const _vBuf = new Array(WINDOW).fill(0);
      const _aBuf = new Array(WINDOW).fill(0);
      let _idx = 0;
      let _videoScore = 100;
      let _audioScore = 100;
      let _lastCheckAt = 0;
      const CHECK_INTERVAL_MS = 600;

      function _bufferedAheadVideo() {
        try {
          const vNode = getVideoNode();
          const ct = Number(vNode.currentTime || 0);
          const tb = vNode.buffered;
          let best = 0;
          for (let i = 0; i < tb.length; i++) {
            if (tb.start(i) <= ct + 0.1) best = Math.max(best, tb.end(i) - ct);
          }
          return best;
        } catch { return 0; }
      }

      function _bufferedAheadAudio() {
        if (!coupledMode || !audio) return 999;
        try {
          const ct = Number(audio.currentTime || 0);
          const tb = audio.buffered;
          let best = 0;
          for (let i = 0; i < tb.length; i++) {
            if (tb.start(i) <= ct + 0.1) best = Math.max(best, tb.end(i) - ct);
          }
          return best;
        } catch { return 0; }
      }

      function _scoreFromSamples(samples) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        const recent = samples.slice(-3).reduce((a, b) => a + b, 0) / 3;
        // 0→0, 0.5→40, 2→80, 5→100
        const avgScore = Math.min(100, avg * 20);
        const recentScore = Math.min(100, recent * 20);
        return Math.round(avgScore * 0.4 + recentScore * 0.6);
      }

      function tick() {
        if ((_now() - _lastCheckAt) < CHECK_INTERVAL_MS) return;
        _lastCheckAt = _now();
        _vBuf[_idx % WINDOW] = _bufferedAheadVideo();
        _aBuf[_idx % WINDOW] = _bufferedAheadAudio();
        _idx++;
        _videoScore = _scoreFromSamples(_vBuf);
        _audioScore = _scoreFromSamples(_aBuf);
      }

      function getVideoScore()    { return _videoScore; }
      function getAudioScore()    { return _audioScore; }
      function getCombinedScore() { return Math.min(_videoScore, coupledMode ? _audioScore : 100); }
      function isHealthy()        { return getCombinedScore() >= 40; }
      function getVideoAheadSec() { return _vBuf[(_idx - 1 + WINDOW) % WINDOW]; }
      function getAudioAheadSec() { return _aBuf[(_idx - 1 + WINDOW) % WINDOW]; }

      return { tick, getVideoScore, getAudioScore, getCombinedScore, isHealthy, getVideoAheadSec, getAudioAheadSec };
    })();

    // --- 4. DriftSupervisor
    // Second-layer drift detection on top of runSync. Runs at high frequency
    // and catches edge cases the main sync loop misses.
    const DriftSupervisor = (() => {
      const HISTORY_LEN = 12;
      const _driftHistory = new Array(HISTORY_LEN).fill(0);
      let _dIdx           = 0;
      let _lastCheckAt    = 0;
      let _currentDriftMs = 0;
      let _runawayCount   = 0;   // consecutive checks where drift is growing
      let _criticalCount  = 0;   // consecutive checks where drift > critical threshold
      let _correctionCount = 0;
      let _lastCorrectionAt = 0;
      const CHECK_INTERVAL_MS    = 300;
      const CRITICAL_DRIFT_MS    = 400;  // 400ms A/V drift = critical
      const RUNAWAY_THRESHOLD    = 5;    // 5 consecutive growing-drift checks = runaway
      const CRITICAL_THRESHOLD   = 3;    // 3 consecutive critical checks = correct
      const CORRECTION_COOLDOWN  = 2000; // min ms between UltraStabilizer drift corrections

      function tick() {
        if (!coupledMode || !audio) return;
        if ((_now() - _lastCheckAt) < CHECK_INTERVAL_MS) return;
        _lastCheckAt = _now();

        let driftMs = 0;
        try {
          const vt = Number(video.currentTime()) || 0;
          const at = Number(audio.currentTime) || 0;
          driftMs = Math.abs(at - vt) * 1000;
        } catch { return; }

        const prev = _driftHistory[(_dIdx - 1 + HISTORY_LEN) % HISTORY_LEN];
        _driftHistory[_dIdx % HISTORY_LEN] = driftMs;
        _dIdx++;
        _currentDriftMs = driftMs;

        // Runaway detection: drift increasing monotonically
        if (driftMs > prev && prev > 100) _runawayCount++;
        else _runawayCount = 0;

        // Critical accumulation
        if (driftMs > CRITICAL_DRIFT_MS) _criticalCount++;
        else _criticalCount = Math.max(0, _criticalCount - 1);

        // Auto-correct: if drift is critical AND stable (not already correcting)
        if (_criticalCount >= CRITICAL_THRESHOLD && (_now() - _lastCorrectionAt) > CORRECTION_COOLDOWN) {
          _attemptCorrection();
        }
      }

      function _attemptCorrection() {
        try {
          // Only correct during stable foreground playback
          if (document.visibilityState !== "visible") return;
          if (!state.intendedPlaying) return;
          if (state.seeking || state.syncing || state.restarting) return;
          if (BringBackToTabManager.isLocked()) return;
          const vt = Number(video.currentTime()) || 0;
          const at = Number(audio.currentTime) || 0;
          if (Math.abs(at - vt) > 0.3) {
            // safeSetAudioTime is a function declaration and is hoisted
            safeSetAudioTime(vt);
            _correctionCount++;
            _lastCorrectionAt = _now();
            _criticalCount = 0;
          }
        } catch {}
      }

      function getDriftMs()      { return _currentDriftMs; }
      function isDriftCritical() { return _criticalCount >= CRITICAL_THRESHOLD; }
      function isDriftRunaway()  { return _runawayCount >= RUNAWAY_THRESHOLD; }
      function getAvgDriftMs() {
        return _driftHistory.reduce((a, b) => a + b, 0) / HISTORY_LEN;
      }

      return { tick, getDriftMs, isDriftCritical, isDriftRunaway, getAvgDriftMs };
    })();

    // --- 5. StallRecoveryEngine
    const StallRecoveryEngine = (() => {
      let _videoPosSamples   = [];
      let _audioTimeSamples  = [];
      let _videoStallSince   = 0;
      let _audioStallSince   = 0;
      let _lastRecoveryAt    = 0;
      let _recoveryAttempts  = 0;
      let _inRecovery        = false;
      let _lastSampleAt      = 0;

      const SAMPLE_INTERVAL_MS  = 800;
      const VIDEO_STALL_MS      = 3500;
      const AUDIO_STALL_MS      = 3000;
      const RECOVERY_COOLDOWN   = 6000;
      const MAX_ATTEMPTS        = 4;
      const SAMPLE_WINDOW       = 5;

      function _samplePositions() {
        if ((_now() - _lastSampleAt) < SAMPLE_INTERVAL_MS) return;
        _lastSampleAt = _now();
        try {
          const vt = Number(video.currentTime()) || 0;
          _videoPosSamples.push({ t: _now(), pos: vt });
          if (_videoPosSamples.length > SAMPLE_WINDOW) _videoPosSamples.shift();
        } catch {}
        if (coupledMode && audio) {
          try {
            const at = Number(audio.currentTime) || 0;
            _audioTimeSamples.push({ t: _now(), pos: at });
            if (_audioTimeSamples.length > SAMPLE_WINDOW) _audioTimeSamples.shift();
          } catch {}
        }
      }

      function _isVideoPositionFrozen() {
        if (_videoPosSamples.length < 3) return false;
        const oldest = _videoPosSamples[0];
        const newest = _videoPosSamples[_videoPosSamples.length - 1];
        const elapsed = newest.t - oldest.t;
        const moved   = Math.abs(newest.pos - oldest.pos);
        return elapsed > VIDEO_STALL_MS && moved < 0.08;
      }

      function _isAudioTimeFrozen() {
        if (!coupledMode || _audioTimeSamples.length < 3) return false;
        const oldest = _audioTimeSamples[0];
        const newest = _audioTimeSamples[_audioTimeSamples.length - 1];
        const elapsed = newest.t - oldest.t;
        const moved   = Math.abs(newest.pos - oldest.pos);
        return elapsed > AUDIO_STALL_MS && moved < 0.08;
      }

      function tick() {
        _samplePositions();
        if (!state.intendedPlaying || _inRecovery) return;
        if ((_now() - _lastRecoveryAt) < RECOVERY_COOLDOWN) return;
        if (state.seeking || state.syncing || state.strictBufferHold) return;
        if (document.visibilityState === "hidden") return;

        const videoPaused = getVideoPaused();

        // Video freeze: video supposedly playing but position frozen
        if (!videoPaused && _isVideoPositionFrozen()) {
          if (!_videoStallSince) _videoStallSince = _now();
          if ((_now() - _videoStallSince) > VIDEO_STALL_MS) {
            _triggerVideoRecovery("freeze");
            return;
          }
        } else {
          _videoStallSince = 0;
        }

        // Audio silence stall: audio playing but currentTime not advancing
        if (coupledMode && audio && !audio.paused && _isAudioTimeFrozen()) {
          if (!_audioStallSince) _audioStallSince = _now();
          if ((_now() - _audioStallSince) > AUDIO_STALL_MS) {
            _triggerAudioRecovery("time-freeze");
            return;
          }
        } else {
          _audioStallSince = 0;
        }
      }

      function _triggerVideoRecovery(reason) {
        if (_recoveryAttempts >= MAX_ATTEMPTS) return;
        if (!state.intendedPlaying) return;
        _inRecovery = true;
        _recoveryAttempts++;
        _lastRecoveryAt = _now();
        _videoPosSamples = [];
        _audioTimeSamples = [];
        try {
          const vt = Number(video.currentTime()) || 0;
          // Stage 1: just re-issue play
          execProgrammaticVideoPlay();
          setTimeout(() => {
            _inRecovery = false;
            // Stage 2: if still frozen, do a tiny seek
            if (getVideoPaused() && state.intendedPlaying) {
              try { video.currentTime(Math.max(0, vt + 0.1)); } catch {}
              setTimeout(() => {
                try { execProgrammaticVideoPlay(); } catch {}
              }, 200);
            }
          }, 1200);
        } catch { _inRecovery = false; }
      }

      function _triggerAudioRecovery(reason) {
        if (!coupledMode || !audio) return;
        _inRecovery = true;
        _recoveryAttempts++;
        _lastRecoveryAt = _now();
        _audioTimeSamples = [];
        try {
          const vt = Number(video.currentTime()) || 0;
          safeSetAudioTime(vt);
          execProgrammaticAudioPlay({ force: true, squelchMs: 400, minGapMs: 0 }).catch(() => {});
          setTimeout(() => { _inRecovery = false; }, 1500);
        } catch { _inRecovery = false; }
      }

      function onSeekStart() { _videoPosSamples = []; _audioTimeSamples = []; _videoStallSince = 0; _audioStallSince = 0; }
      function onRecovery()  { _inRecovery = false; _videoPosSamples = []; _audioTimeSamples = []; }
      function resetAttempts() { _recoveryAttempts = 0; }

      return { tick, onSeekStart, onRecovery, resetAttempts };
    })();

    // --- 6. AudioContextReviver
    // Keeps the Web Audio API context in 'running' state. A suspended context
    // causes audio to silently stop on some browsers/OS combos.
    const AudioContextReviver = (() => {
      let _ctx = null;
      let _lastReviveAt = 0;
      let _reviveCount = 0;
      const REVIVE_COOLDOWN_MS = 3000;

      function _findContext() {
        if (_ctx) return _ctx;
        try {
          // Try to find or create an AudioContext
          if (typeof AudioContext !== "undefined") {
            _ctx = new AudioContext();
          } else if (typeof webkitAudioContext !== "undefined") {
            _ctx = new webkitAudioContext(); // eslint-disable-line new-cap
          }
        } catch {}
        return _ctx;
      }

      function revive() {
        if ((_now() - _lastReviveAt) < REVIVE_COOLDOWN_MS) return;
        const ctx = _findContext();
        if (!ctx) return;
        if (ctx.state === "suspended") {
          ctx.resume().then(() => {
            _lastReviveAt = _now();
            _reviveCount++;
          }).catch(() => {});
        }
      }

      function onUserGesture() {
        // User gestures are the only reliable way to unlock AudioContext
        const ctx = _findContext();
        if (!ctx) return;
        if (ctx.state !== "running") {
          ctx.resume().catch(() => {});
          _lastReviveAt = _now();
        }
      }

      function tick() {
        if (!coupledMode || !audio) return;
        if (!state.intendedPlaying) return;
        revive();
      }

      function getState() {
        const ctx = _ctx;
        return ctx ? ctx.state : "no-context";
      }

      return { revive, onUserGesture, tick, getState };
    })();

    // --- 7. PositionFreezeDetector
    // Maintains a sample history of video playback position. Detects when the
    // position is stuck at the same value for too long while supposedly playing.
    const PositionFreezeDetector = (() => {
      const SAMPLES = 6;
      let _positions    = new Array(SAMPLES).fill(-1);
      let _timestamps   = new Array(SAMPLES).fill(0);
      let _idx          = 0;
      let _frozenSince  = 0;
      let _lastSampleAt = 0;

      const SAMPLE_MS       = 1000;   // sample every 1s
      const FREEZE_POS_DELTA = 0.05; // < 0.05s movement = frozen
      const FREEZE_CONFIRM_MS = 5000; // 5s of no movement = confirmed freeze

      function sample() {
        if ((_now() - _lastSampleAt) < SAMPLE_MS) return;
        _lastSampleAt = _now();
        try {
          const pos = Number(video.currentTime()) || 0;
          _positions[_idx % SAMPLES]  = pos;
          _timestamps[_idx % SAMPLES] = _now();
          _idx++;
        } catch {}
      }

      function isFrozen() {
        if (!state.intendedPlaying || getVideoPaused()) return false;
        if (state.seeking || state.syncing || state.strictBufferHold) return false;
        if (document.visibilityState === "hidden") return false;
        if (_idx < SAMPLES) return false; // not enough samples
        const oldest = _positions[_idx % SAMPLES];
        const newest = _positions[(_idx - 1 + SAMPLES) % SAMPLES];
        if (oldest < 0 || newest < 0) return false;
        const timeDelta = _timestamps[(_idx - 1 + SAMPLES) % SAMPLES] - _timestamps[_idx % SAMPLES];
        const posDelta  = Math.abs(newest - oldest);
        if (posDelta < FREEZE_POS_DELTA && timeDelta > FREEZE_CONFIRM_MS) {
          if (!_frozenSince) _frozenSince = _now();
          return (_now() - _frozenSince) > FREEZE_CONFIRM_MS;
        }
        _frozenSince = 0;
        return false;
      }

      function getFrozenDurationMs() {
        return _frozenSince > 0 ? (_now() - _frozenSince) : 0;
      }

      function onSeekStart() {
        _positions.fill(-1);
        _timestamps.fill(0);
        _idx = 0;
        _frozenSince = 0;
      }

      function tick() { sample(); }

      return { tick, isFrozen, getFrozenDurationMs, onSeekStart };
    })();

    // --- 8. AudioSilenceGuard
    const AudioSilenceGuard = (() => {
      let _lastAT         = -1;
      let _lastATAt       = 0;
      let _silentSince    = 0;
      let _silenceFixed   = 0;
      let _checkCount     = 0;
      let _lastCheckAt    = 0;
      const CHECK_MS      = 2500;
      const SILENT_CONF_MS = 5000; // must be silent for 5s to trigger action

      function tick() {
        if (!coupledMode || !audio) return;
        if ((_now() - _lastCheckAt) < CHECK_MS) return;
        _lastCheckAt = _now();
        _checkCount++;

        if (!state.intendedPlaying || audio.paused) {
          _silentSince = 0;
          _lastAT = -1;
          return;
        }

        const at = Number(audio.currentTime) || 0;

        // Case 1: volume is zero or muted despite intending to play
        if (coupledMode && !audio.muted && audio.volume < 0.02) {
          softUnmuteAudio(100).catch(() => {});
          _silenceFixed++;
          return;
        }

        // Case 2: currentTime not advancing despite audio.paused=false
        if (_lastAT >= 0 && at > 0) {
          const timeDelta = _now() - _lastATAt;
          const posDelta  = Math.abs(at - _lastAT);
          const expectedDelta = timeDelta / 1000;
          if (posDelta < expectedDelta * 0.1 && timeDelta > CHECK_MS * 0.8) {
            // Audio "playing" but time not advancing → ghost audio
            if (!_silentSince) _silentSince = _now();
            if ((_now() - _silentSince) > SILENT_CONF_MS) {
              _fixSilence();
            }
          } else {
            _silentSince = 0;
          }
        }
        _lastAT   = at;
        _lastATAt = _now();
      }

      function _fixSilence() {
        _silentSince = 0;
        _silenceFixed++;
        if (!coupledMode || !audio || !state.intendedPlaying) return;
        try {
          const vt = Number(video.currentTime()) || 0;
          squelchAudioEvents(600);
          safeSetAudioTime(vt);
          audio.pause();
          setTimeout(() => {
            if (!state.intendedPlaying) return;
            execProgrammaticAudioPlay({ force: true, squelchMs: 600, minGapMs: 0 }).catch(() => {});
          }, 200);
        } catch {}
      }

      function isDetectedSilent() {
        return _silentSince > 0 && (_now() - _silentSince) > SILENT_CONF_MS;
      }

      function getFixCount() { return _silenceFixed; }

      return { tick, isDetectedSilent, getFixCount };
    })();

    // --- 9. ReadyStateWatcher
    // Tracks readyState for both streams and detects unexpected drops
    // (e.g. from HAVE_ENOUGH_DATA down to HAVE_METADATA or lower during playback).
    const ReadyStateWatcher = (() => {
      let _lastVRS         = 0;
      let _lastARS         = 0;
      let _vrsDrop         = false;
      let _arsDrop         = false;
      let _vrsDropAt       = 0;
      let _arsDropAt       = 0;
      let _vrsDropCount    = 0;
      let _arsDropCount    = 0;
      let _lastCheckAt     = 0;
      const CHECK_MS       = 400;
      const DROP_RECOVER_MS = 3000;

      function tick() {
        if ((_now() - _lastCheckAt) < CHECK_MS) return;
        _lastCheckAt = _now();

        try {
          const vrs = Number(getVideoNode().readyState || 0);
          if (_lastVRS >= 3 && vrs < 2 && !state.seeking) {
            _vrsDrop = true;
            _vrsDropAt = _now();
            _vrsDropCount++;
          } else if (vrs >= 3 && _vrsDrop) {
            _vrsDrop = false;
          }
          _lastVRS = vrs;
        } catch {}

        if (coupledMode && audio) {
          try {
            const ars = Number(audio.readyState || 0);
            if (_lastARS >= 3 && ars < 2 && !audio.paused) {
              _arsDrop = true;
              _arsDropAt = _now();
              _arsDropCount++;
              // Immediately pause audio if video is fine — don't play with partial buffer
              if (!getVideoPaused() && state.intendedPlaying && !state.strictBufferHold) {
                execProgrammaticAudioPause(800);
                armResumeAfterBuffer(8000);
              }
            } else if (ars >= 3 && _arsDrop) {
              _arsDrop = false;
            }
            _lastARS = ars;
          } catch {}
        }

        // Auto-clear stale drop flags
        if (_vrsDrop && (_now() - _vrsDropAt) > DROP_RECOVER_MS) _vrsDrop = false;
        if (_arsDrop && (_now() - _arsDropAt) > DROP_RECOVER_MS) _arsDrop = false;
      }

      function hasVideoRsDrop()  { return _vrsDrop; }
      function hasAudioRsDrop()  { return _arsDrop; }
      function getVideoRS()      { return _lastVRS; }
      function getAudioRS()      { return _lastARS; }
      function getVrsDropCount() { return _vrsDropCount; }
      function getArsDropCount() { return _arsDropCount; }

      return { tick, hasVideoRsDrop, hasAudioRsDrop, getVideoRS, getAudioRS, getVrsDropCount, getArsDropCount };
    })();

    // --- 10. PlaybackRateGuard
    // Enforces that video.playbackRate === 1.0 unless the player explicitly
    // changed it (e.g. audio rate nudge). Silent rate drift causes A/V desync.
    const PlaybackRateGuard = (() => {
      let _lastCheckAt   = 0;
      let _correctionCount = 0;
      let _lastCorrectionAt = 0;
      const CHECK_MS         = 2000;
      const RATE_TOLERANCE   = 0.005;
      const CORRECTION_COOLDOWN = 3000;

      function tick() {
        if ((_now() - _lastCheckAt) < CHECK_MS) return;
        _lastCheckAt = _now();
        if (state.audioRateNudgeActive) return; // player intentionally adjusting rate
        if (state.seeking || state.syncing) return;
        if ((_now() - _lastCorrectionAt) < CORRECTION_COOLDOWN) return;
        try {
          const vNode = getVideoNode();
          const rate = Number(vNode.playbackRate);
          if (isFinite(rate) && Math.abs(rate - 1.0) > RATE_TOLERANCE) {
            vNode.playbackRate = 1.0;
            try { video.playbackRate(1.0); } catch {}
            _correctionCount++;
            _lastCorrectionAt = _now();
          }
        } catch {}
        // Also enforce audio rate if it drifted
        if (coupledMode && audio && !state.audioRateNudgeActive) {
          try {
            const aRate = Number(audio.playbackRate);
            if (isFinite(aRate) && Math.abs(aRate - 1.0) > RATE_TOLERANCE) {
              audio.playbackRate = 1.0;
              _correctionCount++;
            }
          } catch {}
        }
      }

      function getCorrectionCount() { return _correctionCount; }

      return { tick, getCorrectionCount };
    })();

    // --- 11. NetworkRecoveryHandler
    // Handles online/offline transitions and triggers smart recovery.
    const NetworkRecoveryHandler = (() => {
      let _offlineSince   = 0;
      let _backOnlineAt   = 0;
      let _offlineCount   = 0;
      let _recoveryTimer  = null;

      function onOffline() {
        _offlineSince = _now();
        _offlineCount++;
        // Clear any pending retry timers — no point retrying while offline
        if (_recoveryTimer) { clearTimeout(_recoveryTimer); _recoveryTimer = null; }
      }

      function onOnline() {
        _backOnlineAt = _now();
        const offlineDuration = _offlineSince > 0 ? (_now() - _offlineSince) : 0;
        _offlineSince = 0;

        // Don't immediately retry — give network 500ms to stabilize
        const retryDelay = offlineDuration > 5000 ? 1200 : 500;
        if (_recoveryTimer) clearTimeout(_recoveryTimer);
        _recoveryTimer = setTimeout(() => {
          _recoveryTimer = null;
          if (!state.intendedPlaying) return;
          // Trigger a full sync after network recovery
          try { scheduleSync(0); } catch {}
          // If video is stalled, arm buffer recovery
          if (getVideoPaused() && !state.strictBufferHold) {
            try { armResumeAfterBuffer(10000); } catch {}
          }
        }, retryDelay);
      }

      function isOffline()     { return _offlineSince > 0; }
      function getOfflineCount() { return _offlineCount; }
      function getOfflineDurationMs() { return _offlineSince > 0 ? (_now() - _offlineSince) : 0; }

      return { onOffline, onOnline, isOffline, getOfflineCount, getOfflineDurationMs };
    })();

    // --- 12. GhostAudioKiller
    const GhostAudioKiller = (() => {
      let _ghostDetectedAt = 0;
      let _killCount       = 0;
      let _lastCheckAt     = 0;
      const CHECK_MS           = 1500;
      const CONFIRM_MS         = 600;  // must see ghost for 600ms before acting

      function tick() {
        if (!coupledMode || !audio) return;
        if ((_now() - _lastCheckAt) < CHECK_MS) return;
        _lastCheckAt = _now();

        if (!state.intendedPlaying) return;
        if (state.seeking || state.syncing || state.restarting) return;
        if (BringBackToTabManager.isLocked()) return;
        if (document.visibilityState === "hidden" || !isWindowFocused()) return;
        if (isVisibilityTransitionActive()) return;
        if (inBgReturnGrace()) return;

        const vPaused = getVideoPaused();
        const aPaused = !!audio.paused;

        // Ghost: audio playing but video paused in stable foreground
        if (!aPaused && vPaused) {
          if (!_ghostDetectedAt) { _ghostDetectedAt = _now(); return; }
          if ((_now() - _ghostDetectedAt) > CONFIRM_MS) {
            _killGhostAudio();
          }
        } else {
          _ghostDetectedAt = 0;
        }
      }

      function _killGhostAudio() {
        _ghostDetectedAt = 0;
        _killCount++;
        try { execProgrammaticAudioPause(500); } catch {}
        // Also try to re-start both together
        setTimeout(() => {
          if (!state.intendedPlaying) return;
          try { scheduleSync(0); } catch {}
        }, 300);
      }

      function getKillCount() { return _killCount; }

      return { tick, getKillCount };
    })();

    // --- 13. HealthScoreTracker
    // Aggregates all subsystem signals into a 0-100 health score.
    // Triggers escalating interventions when score drops.
    const HealthScoreTracker = (() => {
      let _score           = 100;
      let _lastScore       = 100;
      let _scoreAt         = 0;
      let _interventions   = 0;
      let _lastInterventionAt = 0;
      const INTERVENTION_COOLDOWN = 8000;

      function compute() {
        let score = 100;

        // Buffer health (30% weight)
        const bufScore = BufferHealthMonitor.getCombinedScore();
        score -= (100 - bufScore) * 0.30;

        // Drift (20% weight)
        const driftMs = DriftSupervisor.getDriftMs();
        if (driftMs > 200)  score -= 10;
        if (driftMs > 500)  score -= 15;
        if (driftMs > 1000) score -= 20;
        if (DriftSupervisor.isDriftRunaway()) score -= 15;

        // Position freeze (20% weight)
        if (PositionFreezeDetector.isFrozen()) score -= 25;

        // ReadyState drops (15% weight)
        if (ReadyStateWatcher.hasVideoRsDrop()) score -= 10;
        if (ReadyStateWatcher.hasAudioRsDrop()) score -= 10;

        // Network (15% weight)
        if (NetworkRecoveryHandler.isOffline()) score -= 20;

        // Silence guard
        if (AudioSilenceGuard.isDetectedSilent()) score -= 20;

        _lastScore = _score;
        _score = Math.max(0, Math.min(100, Math.round(score)));
        _scoreAt = _now();
        return _score;
      }

      function tick() {
        compute();
        _maybeIntervene();
      }

      function _maybeIntervene() {
        if ((_now() - _lastInterventionAt) < INTERVENTION_COOLDOWN) return;
        if (!state.intendedPlaying || state.seeking || state.syncing) return;
        if (document.visibilityState === "hidden") return;

        if (_score < 20) {
          // Critical: trigger full sync
          _interventions++;
          _lastInterventionAt = _now();
          try { scheduleSync(0); } catch {}
          try { setFastSync(2000); } catch {}
        } else if (_score < 40) {
          // Poor: trigger sync
          _interventions++;
          _lastInterventionAt = _now();
          try { scheduleSync(100); } catch {}
        }
      }

      function getScore()          { return _score; }
      function getLastScore()      { return _lastScore; }
      function getInterventions()  { return _interventions; }
      function isHealthy()         { return _score >= 60; }
      function isCritical()        { return _score < 20; }

      return { tick, getScore, getLastScore, getInterventions, isHealthy, isCritical };
    })();

    // --- 14. MicroSyncScheduler
    const MicroSyncScheduler = (() => {
      let _lastFireAt  = 0;
      let _pendingRaf  = null;
      let _fastUntil   = 0;

      const HEALTHY_INTERVAL_MS  = 3000;
      const DRIFT_INTERVAL_MS    = 400;
      const CRITICAL_INTERVAL_MS = 150;
      const POST_TAB_FAST_MS     = 2500;

      function tick() {
        if (!coupledMode) return; // non-coupled mode managed by existing heartbeat
        if (!state.intendedPlaying) return;

        const score = HealthScoreTracker.getScore();
        const drift = DriftSupervisor.getDriftMs();

        let interval = HEALTHY_INTERVAL_MS;
        if (drift > 300 || score < 40) interval = DRIFT_INTERVAL_MS;
        if (score < 20)                interval = CRITICAL_INTERVAL_MS;
        if (_now() < _fastUntil)       interval = Math.min(interval, DRIFT_INTERVAL_MS);

        if ((_now() - _lastFireAt) >= interval) {
          _lastFireAt = _now();
          try { scheduleSync(0); } catch {}
        }
      }

      function onTabReturn() {
        _fastUntil = _now() + POST_TAB_FAST_MS;
      }

      return { tick, onTabReturn };
    })();

    // ════════════════════════════════════════════════════════════════════════
    function onVideoPlaying() {
      AVLG.onVideoPlaying();
      StartupSequencer.onVideoPlaying();
    }
    function onAudioPlaying() {
      AVLG.onAudioPlaying();
      StartupSequencer.onAudioPlaying();
    }
    function onVideoStall() {
      AVLG.onVideoStall();
      StallRecoveryEngine.onRecovery(); // reset samples on stall event
    }
    function onAudioStall() {
      AVLG.onAudioStall();
    }
    function onSeekStart() {
      StallRecoveryEngine.onSeekStart();
      PositionFreezeDetector.onSeekStart();
    }
    function onSeekEnd() {
      StallRecoveryEngine.onSeekStart(); // fresh samples after seek
      PositionFreezeDetector.onSeekStart();
    }
    function onVisibilityChange(isVisible) {
      if (isVisible) {
        AudioContextReviver.revive();
        MicroSyncScheduler.onTabReturn();
        StartupSequencer.tick();
      }
    }
    function onUserAction() {
      AudioContextReviver.onUserGesture();
      StallRecoveryEngine.resetAttempts();
    }
    function onNetworkOnline()  { NetworkRecoveryHandler.onOnline();  }
    function onNetworkOffline() { NetworkRecoveryHandler.onOffline(); }

    // --- heartbeat tick (called every ~1.5s from setupHeartbeat)
    function tick() {
      try { BufferHealthMonitor.tick(); }   catch {}
      try { DriftSupervisor.tick(); }       catch {}
      try { StallRecoveryEngine.tick(); }   catch {}
      try { AudioContextReviver.tick(); }   catch {}
      try { PositionFreezeDetector.tick(); } catch {}
      try { AudioSilenceGuard.tick(); }     catch {}
      try { ReadyStateWatcher.tick(); }     catch {}
      try { PlaybackRateGuard.tick(); }     catch {}
      try { GhostAudioKiller.tick(); }      catch {}
      try { HealthScoreTracker.tick(); }    catch {}
      try { MicroSyncScheduler.tick(); }    catch {}
      try { StartupSequencer.tick(); }      catch {}
    }

    // --- fast tick (called every ~200ms during active sync / fast mode)
    function fastTick() {
      try { DriftSupervisor.tick(); }       catch {}
      try { ReadyStateWatcher.tick(); }     catch {}
      try { BufferHealthMonitor.tick(); }   catch {}
    }

    // --- primary gates (safe to call from any event handler)
    function shouldBlockAudioAtStartup() {
      // Gate 1: AVLG — video must have played at least once
      if (AVLG.shouldBlockAudio()) return true;
      // Gate 2: StartupSequencer — video must be in VIDEO_PLAYING phase
      if (StartupSequencer.shouldBlockAudioAtStartup()) return true;
      return false;
    }

    function isAudioSilent()    { return AudioSilenceGuard.isDetectedSilent(); }
    function isVideoFrozen()    { return PositionFreezeDetector.isFrozen(); }
    function getHealthScore()   { return HealthScoreTracker.getScore(); }
    function isHealthy()        { return HealthScoreTracker.isHealthy(); }
    function getDriftMs()       { return DriftSupervisor.getDriftMs(); }
    function getBufferScore()   { return BufferHealthMonitor.getCombinedScore(); }
    function getStartupPhase()  { return StartupSequencer.getPhaseLabel(); }
    function isStartupStable()  { return StartupSequencer.isStable(); }
    function isOffline()        { return NetworkRecoveryHandler.isOffline(); }

    // --- startup: mark video/audio as fully loaded and ready
    function notifyVideoLoadeddata()   { StartupSequencer.onVideoReady(); }
    function notifyVideoLoading()      { StartupSequencer.onVideoLoading(); }
    function forceStartupRelease()     { AVLG.forceRelease(); }

    return {
      // Event hooks
      onVideoPlaying, onAudioPlaying,
      onVideoStall, onAudioStall,
      onSeekStart, onSeekEnd,
      onVisibilityChange, onUserAction,
      onNetworkOnline, onNetworkOffline,
      // Ticks
      tick, fastTick,
      // Gates
      shouldBlockAudioAtStartup,
      isAudioSilent, isVideoFrozen,
      // Metrics
      getHealthScore, isHealthy, getDriftMs, getBufferScore,
      getStartupPhase, isStartupStable, isOffline,
      // Startup helpers
      notifyVideoLoadeddata, notifyVideoLoading, forceStartupRelease,
    };
  })();


  const EPS = 1.0;
  const HAVE_FUTURE_DATA = 3;
  const HAVE_ENOUGH_DATA = 4;
  const STRICT_BUFFER_AHEAD_SEC = 0.25;
  const STARTUP_BUFFER_AHEAD_SEC = 1.0;
  const MICRO_DRIFT = 0.08;
  const BIG_DRIFT = 1.5;
  const BIG_DRIFT_BACKGROUND = 6.0;
  const MAX_RATE_NUDGE = 0.003;
  const DRIFT_PERSIST_CYCLES = 3;
  const AUDIO_FADE_DURATION_MS = 120;
  const AUDIO_SAFE_FADE_DURATION_MS = 150;
  const MIN_PLAY_PAUSE_GAP_MS = 150;
  const SEEK_READY_TIMEOUT_MS = 3000;
  const SEEK_WATCHDOG_MS = 6000; // max time to wait for seeked event before force-finalizing
  const STATE_CHANGE_COOLDOWN_MS = 100;
  const CHROMIUM_BG_PAUSE_BLOCK_MS = 6000;
  const TAB_VISIBILITY_STABLE_MS = 3500;
  const VISIBILITY_TRANSITION_MS = 1200; // reduced from 4500 — inBgReturnGrace(8s) handles the rest
  const MAX_BG_PAUSE_SUPPRESSIONS = 200;
  const ALT_TAB_TRANSITION_MS = 3500;
  const FOCUS_LOSS_RESET_MS = 12000;
  const CHROMIUM_PAUSE_EVENT_SUPPRESS_MS = 10000;
  const PAUSE_EVENT_RESET_MS = 15000;
  const MAX_PAUSE_EVENTS_BEFORE_BLOCK = 3;
  const AUDIO_POP_PREVENT_MS = 800;
  const SEEK_AUDIO_SYNC_DELAY_MS = 150;
  const SEEK_AUDIO_RESUME_DELAY_MS = 100;
  const RAPID_PLAY_PAUSE_WINDOW_MS = 2000;
  // Increased from 10→20: spurious play/pause events fire during tab switches, buffering, seeks.
  const MAX_RAPID_PLAY_PAUSE = 20;
  // User-initiated spam detection — separate from the loop detector which counts all events.
  // Only pointer/keyboard events count toward this. Audio protection only fires for genuine spam.
  const USER_SPAM_CLICK_WINDOW_MS = 1200;  // window to count user clicks in
  const USER_SPAM_CLICK_THRESHOLD = 5;     // ≥5 user clicks in 1.2s = spam
  const USER_SPAM_ACTIVE_MS = 1500;        // how long spam state stays active after threshold
  const MAX_AUDIO_PLAY_ATTEMPTS = 8;
  const AUDIO_PLAY_ATTEMPT_RESET_MS = 5000;
  const AUDIO_STARTUP_PLAY_RETRY_MS = 300;
  const MAX_AUDIO_STARTUP_RETRIES = 20;
  const STARTUP_SETTLE_MS = 3500;
  const LOOP_DETECTION_WINDOW_MS = 2000;
  // Increased from 6→14: 6 events fires too easily during tab switches / buffering states.
  // 14 is still well below any real infinite loop scenario.
  const MAX_LOOP_EVENTS = 14;
  const LOOP_COOLDOWN_MS = 4000;
  const BG_RETURN_GRACE_MS = 8000;
  const TAB_RETURN_AUDIO_RETRY_DELAY_MS = 300;
  // Tab-return wakeup delay: Chromium fires a burst of spurious pause events for ~800ms after
  // tab becomes visible. We must not attempt resume until this burst has fully settled.
  const BG_RETURN_WAKEUP_DELAY_CHROMIUM_MS = 950;
  const BG_RETURN_WAKEUP_DELAY_OTHER_MS = 300;
  // Minimum bgResumeRetry delay on Chromium during tab-return grace window
  const BG_RESUME_MIN_DELAY_CHROMIUM_MS = 950;
  // If strictBufferHold stays active this long but media is actually ready, force-clear it
  const BUFFER_HOLD_MAX_MS = 20000;
  const HEARTBEAT_INTERVAL_MS = 1500;
  const AUDIO_STALL_TIMEOUT_MS = 4500;
  const VIDEO_STALL_TIMEOUT_MS = 4500;
  const WAKE_DETECT_THRESHOLD_MS = 8000;
  const CONSISTENCY_CHECK_MIN_INTERVAL_MS = 3000;
  const STALL_RECOVERY_COOLDOWN_MS = 5000;
  // How long (ms) to hold audio paused after a video stall before allowing any resume.
  // 200ms is enough to prevent re-triggering while giving the browser time to stabilize.
  const MIN_STALL_AUDIO_RESUME_MS = 200;
  // Minimum readyState the VIDEO element must report before audio can resume after a stall.
  // HAVE_FUTURE_DATA (3) means the browser has decoded enough to play for at least a moment.
  // We do NOT use bufferedAhead here — readyState is more reliable and faster to become true.
  const MIN_STALL_VIDEO_RS = 3; // HAVE_FUTURE_DATA
  // If videoStallAudioPaused has been set for this long but video is playing fine, force-clear.
  const STALL_WATCHDOG_MS = 5000;
  // How often to run the stall-state watchdog check in the heartbeat
  const STALL_WATCHDOG_CHECK_INTERVAL_MS = 2000;
  const AUDIO_STUCK_RESTART_MS = 2500;
  const AUDIO_STUCK_HARD_MS = 5000;
  const SEEK_FINALIZE_DELAY_MS = 50;

  const clamp01 = v => Math.max(0, Math.min(1, Number(v)));

  function clearStartupAutoplayRetryTimer() {
    if (state.startupAutoplayRetryTimer) {
      clearTimeout(state.startupAutoplayRetryTimer);
      state.startupAutoplayRetryTimer = null;
    }
  }

  const VOLUME_STORAGE_KEY = "videoPlayerVolume";
  const MUTED_STORAGE_KEY = "videoPlayerMuted";
  function loadSavedVolume() {
    try {
      const savedVol = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (savedVol !== null) {
        const vol = parseFloat(savedVol);
        if (!isNaN(vol) && vol >= 0 && vol <= 1) {
          video.volume(vol);
        }
      }
      const savedMuted = localStorage.getItem(MUTED_STORAGE_KEY);
      if (savedMuted !== null) {
        const muted = savedMuted === "true";
        video.muted(muted);
      }
    } catch {}
  }
  function saveVolume() {
    if (state.volumeSaveScheduled) return;
    state.volumeSaveScheduled = true;
    setTimeout(() => {
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(video.volume()));
        localStorage.setItem(MUTED_STORAGE_KEY, String(video.muted()));
      } catch {}
      state.volumeSaveScheduled = false;
    }, 200);
  }

  function isHiddenBackground() {
    return document.visibilityState === "hidden";
  }

  function inBgReturnGrace() {
    return (now() - state.lastBgReturnAt) < BG_RETURN_GRACE_MS;
  }

  if (!state.pageFullyLoaded) {
    window.addEventListener("load", () => {
      state.pageFullyLoaded = true;
      if (coupledMode && state.startupPhase && !state.startupPrimed) {
        maybePrimeStartup();
        scheduleStartupAutoplayKick();
        forceAudioStartupPlay();
      } else if (!coupledMode && wantsStartupAutoplay()) {
        scheduleSync(0);
      }
    }, { once: true, passive: true });
  }

  function pageLoadedForAutoplay() {
    return state.pageFullyLoaded;
  }
  function isWindowFocused() {
    try { return typeof document.hasFocus === "function" ? document.hasFocus() : true; } catch { return true; }
  }

  function now() { return performance.now(); }
  function isTabReturnImmune() { return state.tabReturnImmuneUntil > now(); }

  // --- tab-return audio freeze
  // On tab return: DON'T mute. Instead, freeze audio so retry shots can't
  // re-seek it (which causes echo). Audio keeps playing at current volume.
  // After 400ms, do ONE position sync if needed.
  function beginTabReturnAudioMute() {
    if (!coupledMode || !audio) return;
    if (state.tabReturnSettleTimer) clearTimeout(state.tabReturnSettleTimer);
    // Don't freeze audio at all — just sync position immediately and let it keep playing.
    // Freezing causes a noticeable silence gap on every tab return.
    state.tabReturnAudioMuted = false;
    try {
      const vt = Number(video.currentTime()) || 0;
      const at = Number(audio.currentTime) || 0;
      if (isFinite(vt) && Math.abs(at - vt) > 0.3) audio.currentTime = vt;
    } catch {}
    if (audio.paused && state.intendedPlaying) { try { audio.play().catch(() => {}); } catch {} }
    try {
      const tv = targetVolFromVideo();
      if (Math.abs(audio.volume - tv) > 0.02) audio.volume = tv;
    } catch {}
  }

  function cancelTabReturnAudioMute() {
    if (state.tabReturnSettleTimer) {
      clearTimeout(state.tabReturnSettleTimer);
      state.tabReturnSettleTimer = null;
    }
    state.tabReturnAudioMuted = false;
  }

  // --- pause intercept + event-level suppression
  // Two layers of protection during tab-return immunity:
  // 1. Replace .pause() with a no-op so no code can pause the video
  // 2. Capture "pause" events on the element and swallow them + re-play,
  //    so browser-internal pauses (not via .pause()) also get caught
  let _pauseInterceptActive = false;
  let _origVideoPause = null;
  let _origAudioPause = null;
  let _origVjsPause = null;
  let _pauseInterceptTimer = null;
  let _pauseEventSuppressor = null;
  let _audioPauseEventSuppressor = null;
  let _playLockRafId = null;
  let _playLockTimer = null;

  // Capturing listener on the video element that eats pause events during immunity.
  // This fires before video.js's own listener, so video.js never sees the pause.
  function _videoPauseEventSuppressor(e) {
    if (!(state.tabReturnImmuneUntil > now())) return; // not immune, let it through
    if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) return; // user pause
    // Swallow the event entirely
    e.stopImmediatePropagation();
    // Immediately counter-play so there's zero visible freeze
    try {
      const vn = getVideoNode();
      if (vn && vn.paused && _origVideoPause) {
        // Use the original play, not the element's current one
        vn.play().catch(() => {});
      }
    } catch {}
  }

  function _audioEventPauseSuppressor(e) {
    if (!(state.tabReturnImmuneUntil > now())) return;
    if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) return;
    e.stopImmediatePropagation();
    try { if (audio && audio.paused) audio.play().catch(() => {}); } catch {}
  }

  // rAF play-lock: keep calling play() every frame for ~600ms so even if the
  // browser pauses internally between frames, the gap is at most one frame (~16ms)
  function _startPlayLock() {
    _stopPlayLock();
    const startTime = now();
    const lockDuration = 600;
    const pump = () => {
      if (now() - startTime > lockDuration || !(state.tabReturnImmuneUntil > now())) {
        _playLockRafId = null;
        return;
      }
      if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) {
        _playLockRafId = null;
        return;
      }
      if (state.intendedPlaying) {
        try {
          const vn = getVideoNode();
          if (vn && vn.paused) vn.play().catch(() => {});
          if (coupledMode && audio && audio.paused) audio.play().catch(() => {});
        } catch {}
      }
      _playLockRafId = requestAnimationFrame(pump);
    };
    _playLockRafId = requestAnimationFrame(pump);
  }

  function _stopPlayLock() {
    if (_playLockRafId) { cancelAnimationFrame(_playLockRafId); _playLockRafId = null; }
    if (_playLockTimer) { clearTimeout(_playLockTimer); _playLockTimer = null; }
  }

  function engagePauseIntercept() {
    if (_pauseInterceptActive) return;
    _pauseInterceptActive = true;

    // Layer 1: replace .pause() with no-op on native elements
    const vn = getVideoNode();
    if (vn) {
      _origVideoPause = vn.pause.bind(vn);
      vn.pause = function() {
        if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) {
          return _origVideoPause();
        }
      };
    }
    // Also intercept video.js wrapper's pause method
    if (video && typeof video.pause === 'function' && !_origVjsPause) {
      _origVjsPause = video.pause.bind(video);
      video.pause = function() {
        if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) {
          return _origVjsPause();
        }
      };
    }
    if (coupledMode && audio) {
      _origAudioPause = audio.pause.bind(audio);
      audio.pause = function() {
        if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) {
          return _origAudioPause();
        }
      };
    }

    // Layer 2: capture pause events on the elements and swallow them
    if (vn && !_pauseEventSuppressor) {
      _pauseEventSuppressor = _videoPauseEventSuppressor;
      vn.addEventListener('pause', _pauseEventSuppressor, { capture: true });
      // Also attach to videoEl if it's different
      if (videoEl && videoEl !== vn) {
        videoEl.addEventListener('pause', _pauseEventSuppressor, { capture: true });
      }
    }
    if (coupledMode && audio && !_audioPauseEventSuppressor) {
      _audioPauseEventSuppressor = _audioEventPauseSuppressor;
      audio.addEventListener('pause', _audioPauseEventSuppressor, { capture: true });
    }

    // Layer 3: rAF play-lock for the first 600ms — keeps play() firing every frame
    if (state.intendedPlaying) _startPlayLock();

    // Auto-disengage after immunity expires
    if (_pauseInterceptTimer) clearTimeout(_pauseInterceptTimer);
    _pauseInterceptTimer = setTimeout(disengagePauseIntercept, 3200);
  }

  function disengagePauseIntercept() {
    if (!_pauseInterceptActive) return;
    _pauseInterceptActive = false;
    if (_pauseInterceptTimer) { clearTimeout(_pauseInterceptTimer); _pauseInterceptTimer = null; }
    _stopPlayLock();

    // Restore native .pause() methods
    const vn = getVideoNode();
    if (vn && _origVideoPause) {
      try { vn.pause = HTMLMediaElement.prototype.pause; } catch {}
    }
    if (audio && _origAudioPause) {
      try { audio.pause = HTMLMediaElement.prototype.pause; } catch {}
    }
    // Restore video.js wrapper
    if (_origVjsPause) {
      try { video.pause = _origVjsPause; } catch {}
      _origVjsPause = null;
    }
    _origVideoPause = null;
    _origAudioPause = null;

    // Remove event-level suppressors
    if (_pauseEventSuppressor) {
      try {
        if (vn) vn.removeEventListener('pause', _pauseEventSuppressor, { capture: true });
        if (videoEl && videoEl !== vn) videoEl.removeEventListener('pause', _pauseEventSuppressor, { capture: true });
      } catch {}
      _pauseEventSuppressor = null;
    }
    if (_audioPauseEventSuppressor) {
      try { if (audio) audio.removeEventListener('pause', _audioPauseEventSuppressor, { capture: true }); } catch {}
      _audioPauseEventSuppressor = null;
    }
  }

  // --- smooth tab welcome-back management
  // Consolidates the tab-return smoothness logic that was previously spread
  // across the visibilitychange, focus, and blur handlers. Each handler still
  // does its own platform-specific or manager-specific work, but delegates
  // the shared "make playback seamless across tab switches" bookkeeping here.
  const SmoothTabWelcomeBackManagement = {

    // Called when the tab becomes active again (from visibilitychange→visible
    // or from the focus event). Sets up immunity, intercepts pause, starts
    // audio sync, and kicks off the bring-back-to-tab retry machinery.
    onTabReturn() {
      state.tabReturnGen++;

      if (this.shouldResume()) {
        state.tabReturnImmuneUntil = now() + 3000;
        engagePauseIntercept();
        beginTabReturnAudioMute();
      }

      // Reset rapid play/pause counters so spurious tab-switch events
      // don't accidentally trigger loop detection
      state.rapidPlayPauseCount = 0;
      state.rapidPlayPauseResetAt = now();
      state.rapidToggleDetected = false;
      state.rapidToggleUntil = 0;
      state.loopPreventionCooldownUntil = 0;

      // Clear alt-tab flags that were set by the preceding blur event
      state.altTabTransitionActive = false;
      state.altTabTransitionUntil = 0;

      // If we should be playing, do it right away
      if (state.intendedPlaying) {
        this.instantPlay();
        startBringBackRetry();
        executeSeamlessWakeup();
      }
    },

    // Called when the tab goes away (from blur or visibilitychange→hidden).
    // Cancels in-flight tab-return work and snapshots state for QRO.
    onTabLeave() {
      state.tabReturnGen++;
      state.tabReturnImmuneUntil = 0;
      disengagePauseIntercept();
      cancelTabReturnAudioMute();
      this.clearTimers();
      try { QuantumReturnOrchestrator.snapshotState(); } catch {}
    },

    // Called from markUserPauseIntent — the user deliberately paused, so we
    // drop all tab-return smoothness machinery immediately.
    onUserPause() {
      state.tabReturnImmuneUntil = 0;
      disengagePauseIntercept();
      cancelTabReturnAudioMute();
    },

    // True while the tab-return immunity window is still open
    isImmune() {
      return now() < state.tabReturnImmuneUntil;
    },

    // Decides whether we should treat this tab-return as one where playback
    // needs to resume: either the user left while playing, or startup
    // autoplay hasn't committed yet.
    shouldResume() {
      return state.intendedPlaying ||
             state.resumeOnVisible ||
             state.bgHiddenWasPlaying ||
             (!state.firstPlayCommitted && wantsStartupAutoplay());
    },

    // Fires play() on both video and audio immediately, no timers or rAF.
    instantPlay() {
      try {
        const _vn = getVideoNode();
        if (_vn && _vn.paused) _vn.play().catch(() => {});
        if (coupledMode && audio && audio.paused) audio.play().catch(() => {});
      } catch {}
    },

    // Cancels all bring-back-to-tab and wakeup timers
    clearTimers() {
      if (state.bbtabRetryRafId) { cancelAnimationFrame(state.bbtabRetryRafId); state.bbtabRetryRafId = null; }
      if (state.bbtabRetryTimer) { clearTimeout(state.bbtabRetryTimer); state.bbtabRetryTimer = null; }
      if (state.bbtabAudioSyncTimer) { clearTimeout(state.bbtabAudioSyncTimer); state.bbtabAudioSyncTimer = null; }
      if (state.wakeupTimer) { clearTimeout(state.wakeupTimer); state.wakeupTimer = null; }
    },

    // Full reset — clears timers and all tab-return state
    clearAll() {
      this.clearTimers();
      state.tabReturnImmuneUntil = 0;
      disengagePauseIntercept();
      cancelTabReturnAudioMute();
    }
  };

  function markMediaAction(type) {
    state.lastMediaAction = type;
    state.lastMediaActionTs = now();
  }
  function mediaActionRecently(type, ms = 1200) {
    return state.lastMediaAction === type && (now() - state.lastMediaActionTs) < ms;
  }
  function setFastSync(ms = 1200) {
    state.fastSyncUntil = Math.max(state.fastSyncUntil, now() + Math.max(0, Number(ms) || 0));
    scheduleSync(0);
  }
  function fastSyncActive() { return now() < state.fastSyncUntil; }
  function setPauseEventGuard(ms = 1000) {
    state.pauseEventGuardUntil = Math.max(state.pauseEventGuardUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function shouldIgnorePauseEvents() { return now() < state.pauseEventGuardUntil; }
  function setMediaPlayTxn(ms = 1400) {
    state.mediaPlayTxnUntil = Math.max(state.mediaPlayTxnUntil, now() + Math.max(0, Number(ms) || 0));
    state.mediaLockUntil = Math.max(state.mediaLockUntil, now() + Math.min(ms, 900));
  }
  function setMediaPauseTxn(ms = 1000) {
    state.mediaPauseTxnUntil = Math.max(state.mediaPauseTxnUntil, now() + Math.max(0, Number(ms) || 0));
    state.mediaLockUntil = Math.max(state.mediaLockUntil, now() + Math.min(ms, 800));
  }
  function mediaPlayTxnActive() { return now() < state.mediaPlayTxnUntil; }
  function mediaPauseTxnActive() { return now() < state.mediaPauseTxnUntil; }
  function mediaActionLocked() { return now() < state.mediaLockUntil; }
  function inMediaTxnWindow() { return mediaActionLocked() || mediaPlayTxnActive() || mediaPauseTxnActive(); }
  function setMediaSessionForcedPause(ms = 2600) {
    state.mediaForcedPauseUntil = Math.max(state.mediaForcedPauseUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function clearMediaSessionForcedPause() { state.mediaForcedPauseUntil = 0; }
  function mediaSessionForcedPauseActive() { return now() < state.mediaForcedPauseUntil; }

  function markUserPauseIntent(ms = 1800) {
    VisibilityGuard.onUserPause();
    SmoothTabWelcomeBackManagement.onUserPause(); // drop tab-return smoothness on explicit pause
    state.userPauseIntentPresetAt = now();
    state.userPlayIntentPresetAt = 0;
    state.userGesturePauseIntent = true;
    state.firstPlayCommitted = true;
    state.startupKickDone = true;
    state.startupPhase = false;
    state.playSessionId = (state.playSessionId || 0) + 1;
    MediumQualityManager.markUserPaused(); // MQM: record authoritative user pause intent
    PlaybackStabilityManager.onUserAction();
    try { UltraStabilizer.onUserAction(); } catch {}
    BringBackToTabManager.onUserPause(); // cancel any tab-return lock — user is in control
    clearStartupAutoplayRetryTimer();
    state.lastUserActionTime = now();
    state.bgSuppressionSessionCount = 0;
    state.bgPauseSuppressionCount = 0;

    cancelActiveFade();
    state.audioPlayGeneration++;
    state.rapidPlayPauseCount = 0;
    state.rapidToggleDetected = false;
    state.rapidToggleUntil = 0;
    state.loopPreventionCooldownUntil = 0;

    setTimeout(() => { state.userGesturePauseIntent = false; }, 2000);
    const until = now() + Math.max(0, Number(ms) || 0);
    state.userPauseUntil = Math.max(state.userPauseUntil, until);
    state.userPauseLockUntil = Math.max(state.userPauseLockUntil, until + 300);
    state.userPlayUntil = 0;
    state.intendedPlaying = false;
    state.bufferHoldIntendedPlaying = false;
    state.startupPlaySettled = true;
    updateMediaSessionPlaybackState();
    if (platform.chromiumOnlyBrowser) {
      state.chromiumPauseGuardUntil = Math.max(state.chromiumPauseGuardUntil, until + 250);
      state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, until + 450);
      state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, until + 200);
    }
  }

  function markUserPlayIntent(ms = 1800) {
    state.userPlayIntentPresetAt = now(); // reinforce preset
    state.userPauseIntentPresetAt = 0;    // clear opposite
    state.lastUserActionTime = now();
    state.bgSuppressionSessionCount = 0;
    state.bgPauseSuppressionCount = 0;
    state.rapidPlayPauseCount = 0;
    state.rapidToggleDetected = false;
    state.rapidToggleUntil = 0;
    state.loopPreventionCooldownUntil = 0;
    MediumQualityManager.markUserPlayed(); // MQM: clear any pending pause intent
    PlaybackStabilityManager.onUserAction();
    try { UltraStabilizer.onUserAction(); } catch {}
    const until = now() + Math.max(0, Number(ms) || 0);
    state.userPlayUntil = Math.max(state.userPlayUntil, until);
    state.userPauseUntil = 0;
    state.userPauseLockUntil = 0;
    clearMediaSessionForcedPause();
    state.intendedPlaying = true;
    state.bufferHoldIntendedPlaying = true;
    state.firstPlayCommitted = true;
    state.startupKickDone = true;
    state.startupPhase = false;
    state.playSessionId = (state.playSessionId || 0) + 1;
    state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
    clearStartupAutoplayRetryTimer();
    markMediaAction("play");
    setFastSync(1800);
    setMediaPlayTxn(900);
    updateMediaSessionPlaybackState();
    state.audioPauseUntil = 0;
    state.audioPlayUntil = 0;
    state.startupAudioHoldUntil = 0;
    state.audioPausedSince = 0;
    // Cancel any ongoing pause fade immediately — if pauseHard() was fading audio out,
    // this stops the fade callback from re-pausing audio after play() succeeds.
    cancelActiveFade();
    state.isProgrammaticAudioPause = false;
    if (platform.chromiumOnlyBrowser) {
      state.chromiumPauseGuardUntil = 0;
      state.chromiumBgSettlingUntil = 0;
      state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, now() + 120);
    }
  }
  function userPauseIntentActive() { return now() < state.userPauseUntil; }
  function userPauseLockActive() { return now() < state.userPauseLockUntil; }
  function userPlayIntentActive() { return now() < state.userPlayUntil; }
  function setHiddenMediaSessionPlay(ms = 5000) {
    if (!platform.chromiumOnlyBrowser) return;
    state.hiddenMediaPlayUntil = Math.max(state.hiddenMediaPlayUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function hiddenMediaSessionPlayActive() { return platform.chromiumOnlyBrowser && now() < state.hiddenMediaPlayUntil; }
  function clearHiddenMediaSessionPlay() { state.hiddenMediaPlayUntil = 0; }
  function chromiumPauseGuardActive() { return platform.chromiumOnlyBrowser && now() < state.chromiumPauseGuardUntil; }
  function chromiumAudioStartLocked() { return platform.chromiumOnlyBrowser && now() < state.chromiumAudioStartLockUntil; }
  function chromiumBgSettlingActive() { return platform.chromiumOnlyBrowser && now() < state.chromiumBgSettlingUntil; }
  function chromiumBgPauseBlocked() {
    if (!platform.chromiumOnlyBrowser) return false;
    if (state.startupPhase && !state.firstPlayCommitted) return false;
    return now() < state.chromiumBgPauseBlockedUntil ||
    now() < state.chromiumBgPauseBlockedUntilExtended ||
    now() < state.chromiumAutoPauseBlockedUntil;
  }
  function setChromiumBgPauseBlock(ms = CHROMIUM_BG_PAUSE_BLOCK_MS) {
    if (!platform.chromiumOnlyBrowser) return;
    state.chromiumBgPauseBlockedUntil = Math.max(state.chromiumBgPauseBlockedUntil, now() + ms);
    state.chromiumBgPauseBlockedUntilExtended = Math.max(state.chromiumBgPauseBlockedUntilExtended, now() + (ms * 1.5));
  }
  function setChromiumAutoPauseBlock(ms = 8000) {
    if (!platform.chromiumOnlyBrowser) return;
    state.chromiumAutoPauseBlockedUntil = Math.max(state.chromiumAutoPauseBlockedUntil, now() + ms);
  }
  function setChromiumPauseEventSuppress(ms = CHROMIUM_PAUSE_EVENT_SUPPRESS_MS) {
    if (!platform.chromiumOnlyBrowser) return;
    state.chromiumPauseEventSuppressedUntil = Math.max(state.chromiumPauseEventSuppressedUntil, now() + ms);
  }
  function chromiumPauseEventSuppressed() { return platform.chromiumOnlyBrowser && now() < state.chromiumPauseEventSuppressedUntil; }

  // Was comparing `now() > state.pauseEventResetAt` which is nearly always true since it starts at 0
  function trackPauseEvent() {
    state.lastPauseEventTs = now();
    if ((now() - state.pauseEventResetAt) > PAUSE_EVENT_RESET_MS) {
      state.pauseEventCount = 0;
      state.pauseEventResetAt = now();
    }
    state.pauseEventCount++;
    if (state.pauseEventCount >= MAX_PAUSE_EVENTS_BEFORE_BLOCK) {
      setChromiumPauseEventSuppress(CHROMIUM_PAUSE_EVENT_SUPPRESS_MS);
      state.pauseEventCount = 0;
      state.pauseEventResetAt = now();
    }
  }
  function shouldBlockPauseEvent() {
    if (chromiumPauseEventSuppressed()) return true;
    if (state.pauseEventCount >= MAX_PAUSE_EVENTS_BEFORE_BLOCK) return true;
    return false;
  }
  function setStartupAudioHold(ms = 450) {
    state.startupAudioHoldUntil = Math.max(state.startupAudioHoldUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function startupAudioHoldActive() { return now() < state.startupAudioHoldUntil; }
  function squelchAudioEvents(ms = 450) {
    state.audioEventsSquelchedUntil = now() + Math.max(0, Number(ms) || 0);
  }
  function audioEventsSquelched() { return now() < state.audioEventsSquelchedUntil; }
  function isVisibilityTransitionActive() {
    return state.visibilityTransitionActive ||
    now() < state.visibilityTransitionUntil ||
    state.altTabTransitionActive ||
    now() < state.altTabTransitionUntil;
  }
  function isAltTabTransitionActive() { return state.altTabTransitionActive || now() < state.altTabTransitionUntil; }
  function isVisibilityStable() { return now() >= state.visibilityStableUntil; }
  function isFocusStable() { return now() >= state.focusStableUntil; }
  function shouldTreatVisiblePauseAsUserPause() {
    return document.visibilityState === "visible" && (userPauseIntentActive() || userPauseLockActive());
  }

  function startupSettleActive() {
    if (state.startupPlaySettled) return false;
    if (state.userGesturePauseIntent) return false;
    return now() < state.startupPlaySettleUntil;
  }

  function incrementRapidPlayPause() {
    if (state.seeking || state.seekBuffering) return;
    if (state.tabReturnImmuneUntil > now()) return;
    if (inBgReturnGrace() || document.visibilityState === "hidden") return;
    if (!state.firstPlayCommitted) return;
    const nowTs = now();
    if ((nowTs - state.rapidPlayPauseResetAt) > RAPID_PLAY_PAUSE_WINDOW_MS) {
      state.rapidPlayPauseCount = 0;
      state.rapidPlayPauseResetAt = nowTs;
    }
    state.rapidPlayPauseCount++;
  }

  // detectLoop no longer fires during seek/sync operations to prevent false positives
  function detectLoop() {
    if (state.seeking || state.syncing || state.restarting || state.seekBuffering) return false;
    if (!state.firstPlayCommitted) return false;
    if (inBgReturnGrace()) return false;
    if (document.visibilityState === "hidden") return false;
    // Never fire during tab-return or startup immunity
    if (state.tabReturnImmuneUntil > now()) return false;
    if (now() < state.loopPreventionCooldownUntil) return true;
    if ((now() - state.lastUserActionTime) < 1500) return false;
    if (state.rapidPlayPauseCount >= MAX_LOOP_EVENTS) {
      state.loopPreventionCooldownUntil = now() + LOOP_COOLDOWN_MS;
      return true;
    }
    return false;
  }

  function shouldIgnorePauseAsTransient() {
    if (mediaSessionForcedPauseActive()) return false;
    if (userPauseIntentActive() || userPauseLockActive()) return false;
    if (detectLoop()) return true;
    if (inBgReturnGrace()) return true;

    if (
      document.visibilityState === "visible" &&
      isWindowFocused() &&
      isVisibilityStable() &&
      isFocusStable() &&
      !state.isProgrammaticVideoPause &&
      !state.isProgrammaticAudioPause &&
      !state.seeking &&
      !state.syncing &&
      !inBgReturnGrace() &&
      now() >= state.tabVisibilityChangeUntil
    ) {
      return false;
    }

    if (startupSettleActive()) return true;
    if (document.visibilityState === "hidden") return true;
    if (!isWindowFocused()) return true;
    if (isVisibilityTransitionActive()) return true;
    if (isAltTabTransitionActive()) return true;
    if (!isVisibilityStable()) return true;
    if (!isFocusStable()) return true;
    if (now() < state.tabVisibilityChangeUntil) return true;
    if (shouldBlockPauseEvent()) return true;
    if (chromiumPauseEventSuppressed()) return true;
    if (platform.chromiumOnlyBrowser && chromiumBgPauseBlocked()) return true;
    if (fastSyncActive()) return true;
    if (state.isProgrammaticVideoPlay || state.isProgrammaticAudioPlay) return true;
    if (now() < state.audioPlayUntil) return true;
    if (mediaActionRecently("play", 260)) return true;
    if (state.rapidToggleDetected && now() < state.rapidToggleUntil) return true;
    if (inMediaTxnWindow()) return true;
    if (mediaActionRecently("play", 2200)) return true;
    if (shouldIgnorePauseEvents()) return true;
    if (platform.chromiumOnlyBrowser) {
      // Was comparing `now() > state.bgPauseSuppressionResetAt` which is nearly always true
      if ((now() - state.bgPauseSuppressionResetAt) > 10000) {
        state.bgPauseSuppressionCount = 0;
        state.bgPauseSuppressionResetAt = now();
      }
      state.bgPauseSuppressionCount++;
      if (state.bgPauseSuppressionCount <= MAX_BG_PAUSE_SUPPRESSIONS) return true;
    }
    return false;
  }

  function enforceAudioPlayback(force = false) {
    if (!coupledMode || !audio) return;
    if (!state.intendedPlaying) return;
    if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
    if (state.seeking || state.restarting || state.syncing) return;
    const vPaused = getVideoPaused();
    const aPaused = !!audio.paused;
    if (!vPaused && !aPaused) { state.audioPausedSince = 0; return; }
    if (!vPaused && aPaused) {
      if (!state.audioPausedSince) state.audioPausedSince = now();
      const stuckMs = now() - state.audioPausedSince;
      const hardBypass = force || stuckMs > AUDIO_STUCK_HARD_MS;
      // Reduced from 2500ms → 1000ms: audio stuck for 1s with video playing
      // is already audible. React faster to avoid silent-video segments.
      const softBypass = stuckMs > Math.min(AUDIO_STUCK_RESTART_MS, 1000);
      if (!hardBypass && !softBypass) return;
      if (!hardBypass && state.strictBufferHold) return;
      if (!hardBypass && state.videoWaiting) return;
      const vtNow = Number(video.currentTime()) || 0;
      const vNode = getVideoNode();
      const bufAhead = bufferedAhead(vNode, vtNow);
      const vRS = Number(vNode.readyState || 0);
      if (!hardBypass && bufAhead < 0.5) return; // require 0.5s buffer ahead
      if (!hardBypass && vRS < MIN_STALL_VIDEO_RS) return;
      state.isProgrammaticAudioPause = false;
      state.videoStallAudioPaused = false;
      state.stallAudioResumeHoldUntil = 0;
      state.audioPauseUntil = 0;
      state.stallAudioPausedSince = 0;
      if (hardBypass) state.audioEventsSquelchedUntil = 0;
      safeSetAudioTime(vtNow);
      execProgrammaticAudioPlay({ squelchMs: 400, force: true, minGapMs: 0 })
      .then(ok => {
        if (ok) {
          state.audioPausedSince = 0;
          softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
        } else if (hardBypass && !getVideoPaused() && state.intendedPlaying) {
          // Audio can't start even with hard bypass — pause video to
          // maintain A/V contract. armResumeAfterBuffer restarts both.
          execProgrammaticVideoPause();
          armResumeAfterBuffer(6000);
        }
      })
      .catch(() => {});
    }
  }


  function getVideoMutedState() {
    try { if (typeof video.muted === "function") return !!video.muted(); } catch {}
    try { return !!getVideoNode().muted; } catch {}
    return false;
  }
  function setVideoMutedState(val) {
    try { if (typeof video.muted === "function") video.muted(!!val); } catch {}
    try { getVideoNode().muted = !!val; } catch {}
    try { videoEl.muted = !!val; } catch {}
  }
  function targetVolFromVideo() {
    const vVol = clamp01(typeof video.volume === "function" ? video.volume() : (videoEl.volume ?? 1));
    const vMuted = !!(typeof video.muted === "function" ? video.muted() : videoEl.muted);
    return (vMuted || state.userMutedVideo) ? 0 : vVol;
  }
  let activeVolumeFade = null;
  function cancelActiveFade() {
    if (activeVolumeFade) {
      cancelAnimationFrame(activeVolumeFade);
      activeVolumeFade = null;
    }
    state.audioFading = false;
  }

  function fadeAndPauseAudio(fadeMs, onDone) {
    if (!audio) { if (onDone) onDone(); return; }
    if (audio.paused || audio.volume < 0.015) {
      try { if (!audio.paused) audio.pause(); } catch {}
      if (onDone) onDone();
      return;
    }
    cancelActiveFade();
    const startVol = clamp01(audio.volume);
    const startTs = performance.now();
    const duration = Math.max(10, Number(fadeMs) || AUDIO_FADE_DURATION_MS);
    const step = () => {
      const rawT = Math.min(1, (performance.now() - startTs) / duration);
      const easeT = 0.5 * (1 - Math.cos(Math.PI * rawT));
      try { audio.volume = Math.max(0, startVol * (1 - easeT)); } catch {}
      if (rawT < 1) {
        activeVolumeFade = requestAnimationFrame(step);
      } else {
        activeVolumeFade = null;
        try { audio.volume = 0; audio.pause(); } catch {}
        if (onDone) onDone();
      }
    };
    activeVolumeFade = requestAnimationFrame(step);
  }

  async function doVolumeFade(targetVol, ms = AUDIO_SAFE_FADE_DURATION_MS) {
    if (!audio) return;
    cancelActiveFade();
    const from = clamp01(audio.volume);
    const target = clamp01(targetVol);
    if (document.visibilityState === "hidden" || ms <= 0 || Math.abs(target - from) < 0.001 || audio.paused) {
      try { audio.volume = target; } catch {}
      return;
    }
    const start = now();
    state.audioFading = true;
    return new Promise(resolve => {
      const step = () => {
        if (audio.paused) {
          try { audio.volume = target; } catch {}
          activeVolumeFade = null;
          state.audioFading = false;
          state.audioFadeCompleteUntil = now() + AUDIO_POP_PREVENT_MS;
          resolve();
          return;
        }
        const rawT = Math.min(1, (now() - start) / ms);
        const easeT = 0.5 * (1 - Math.cos(Math.PI * rawT));
        const val = from + (target - from) * easeT;
        try { audio.volume = clamp01(val); } catch {}
        if (rawT < 1) {
          activeVolumeFade = requestAnimationFrame(step);
        } else {
          activeVolumeFade = null;
          state.audioFading = false;
          state.audioFadeCompleteUntil = now() + AUDIO_POP_PREVENT_MS;
          resolve();
        }
      };
      activeVolumeFade = requestAnimationFrame(step);
    });
  }

  async function softUnmuteAudio(ms = AUDIO_SAFE_FADE_DURATION_MS) {
    if (!audio) return;
    const target = targetVolFromVideo();
    if (Math.abs(clamp01(audio.volume) - target) < 0.02 && !state.audioFading) return;
    state.audioFading = true;
    await doVolumeFade(target, ms);
    state.audioFading = false;
  }

  async function fadeAudioOut(ms = AUDIO_SAFE_FADE_DURATION_MS) {
    if (!audio) return;
    state.audioFading = true;
    state.audioVolumeBeforePause = clamp01(audio.volume);
    await doVolumeFade(0, ms);
    state.audioFading = false;
    state.audioFadeCompleteUntil = now() + AUDIO_POP_PREVENT_MS;
  }

  async function fadeAudioIn(ms = AUDIO_SAFE_FADE_DURATION_MS) {
    if (!audio) return;
    state.audioFading = true;
    await doVolumeFade(targetVolFromVideo(), ms);
    state.audioFading = false;
    state.audioFadeCompleteUntil = now() + AUDIO_POP_PREVENT_MS;
  }

  function updateAudioGainImmediate() {
    if (!audio) return;
    if (state.audioFading) return;
    try {
      const target = clamp01(targetVolFromVideo());
      // During tab-return, don't jump volume — fade to prevent pop
      if (inBgReturnGrace() && audio.volume < target - 0.05) {
        softUnmuteAudio(120).catch(() => {});
        return;
      }
      cancelActiveFade();
      audio.volume = target;
    } catch {}
  }

  function forceUnmuteForPlaybackIfAllowed() {
    if (!state.intendedPlaying) return;
    try { if (!state.userMutedVideo && getVideoMutedState()) setVideoMutedState(false); } catch {}
    try { if (audio && !state.userMutedAudio && audio.muted) audio.muted = false; } catch {}
  }

  function checkRapidPlayPause() {
    // NOTE: This function is called from audio play path.
    if (state.userClickSpamActive && now() < state.userClickSpamUntil) {
      return true;
    }
    state.userClickSpamActive = false;
    return false;
  }

  // Track a deliberate user play/pause click for spam detection.
  // Call this from onPressStart / onKeyDown (NOT from event handlers for background events).
  function trackUserClickForSpam() {
    const nowTs = now();
    if ((nowTs - state.userClickSpamWindowStart) > USER_SPAM_CLICK_WINDOW_MS) {
      state.userClickSpamCount = 0;
      state.userClickSpamWindowStart = nowTs;
    }
    state.userClickSpamCount++;
    if (state.userClickSpamCount >= USER_SPAM_CLICK_THRESHOLD) {
      state.userClickSpamActive = true;
      state.userClickSpamUntil = nowTs + USER_SPAM_ACTIVE_MS;
      state.userClickSpamCount = 0;
      state.userClickSpamWindowStart = nowTs;
      return true;
    }
    return false;
  }

  function checkAudioPlayAttempt() {
    const nowTs = now();
    if ((nowTs - state.audioPlayAttemptResetAt) > AUDIO_PLAY_ATTEMPT_RESET_MS) {
      state.audioPlayAttemptCount = 0;
      state.audioPlayAttemptResetAt = nowTs;
    }
    state.audioPlayAttemptCount++;
    if (state.audioPlayAttemptCount >= MAX_AUDIO_PLAY_ATTEMPTS) {
      return false;
    }
    return true;
  }

  function safeSetCT(media, t) {
    try {
      if (media && isFinite(t) && t >= 0) media.currentTime = t;
    } catch {}
  }

  function safeSetAudioTime(t) {
    if (!audio) return;
    try {
      if (isFinite(t) && t >= 0) {
        // Never seek audio to 0 after first play unless explicitly restarting/looping
        if (t < 0.5 && state.firstPlayCommitted && !state.restarting && !isLoopDesired()) {
          const currentAt = Number(audio.currentTime) || 0;
          if (currentAt > 2) return; // audio is well into playback, don't reset to 0
        }
        const timeDiff = Math.abs((audio.currentTime || 0) - t);
        if (timeDiff > 0.05) {
          audio.currentTime = t;
        }
      }
    } catch {}
  }

  async function quietSeekAudio(t) {
    if (!audio || !coupledMode) return;
    try {
      if (!isFinite(t) || t < 0) return;
      const timeDiff = Math.abs((audio.currentTime || 0) - t);
      if (timeDiff <= 0.05) return;

      const wasPlaying = !audio.paused && audio.volume > 0.01 && !state.audioFading;

      if (wasPlaying) {
        await doVolumeFade(0, 60);
        // Pause the actual audio element before seeking. Without this the browser
        // keeps its decode buffer pointing at the old position and briefly replays it
        // (the "repeat last 0.5s" artifact) when the seek completes.
        state.isProgrammaticAudioPause = true;
        try { audio.pause(); } catch {}
        setTimeout(() => { state.isProgrammaticAudioPause = false; }, 300);
      } else {
        cancelActiveFade();
      }

      safeSetAudioTime(t);

      if (wasPlaying && state.intendedPlaying) {
        await new Promise(r => setTimeout(r, 25));
        if (!state.intendedPlaying) return;
        if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
        // Clear programmatic pause flag before play attempt
        state.isProgrammaticAudioPause = false;
        state.isProgrammaticAudioPlay = true;
        try {
          const p = audio.play();
          if (p && p.catch) p.catch(() => {});
          setTimeout(() => { state.isProgrammaticAudioPlay = false; }, 400);
        } catch {
          state.isProgrammaticAudioPlay = false;
        }
        softUnmuteAudio(120).catch(() => {});
        // Multi-stage safety net for stuck audio after quiet seek
        const _qsSession = state.playSessionId;
        [150, 400, 800].forEach(_qsDelay => {
          setTimeout(() => {
            if (_qsSession !== state.playSessionId || !state.intendedPlaying) return;
            if (!audio.paused || getVideoPaused() || state.seeking) return;
            if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
            state.isProgrammaticAudioPause = false;
            state.audioEventsSquelchedUntil = 0;
            state.audioPauseUntil = 0;
            const _vt = Number(video.currentTime()) || 0;
            safeSetAudioTime(_vt);
            execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
            softUnmuteAudio(100).catch(() => {});
          }, _qsDelay);
        });
      }
    } catch {}
  }

  function resetAudioPlaybackRate() {
    if (!audio) return;
    try {
      const baseRate = Number(video.playbackRate()) || 1;
      if (Math.abs((audio.playbackRate || baseRate) - baseRate) > 0.0001) {
        audio.playbackRate = baseRate;
      }
    } catch {}
    state.driftStableFrames = 0;
    state.lastDrift = 0;
    state.audioRateNudgeActive = false;
    state.audioRateNudgeUntil = 0;
    state.syncConvergenceCount = 0;
    state.lastSyncDrift = 0;
  }

  function enforcePlaybackRateSync() {
    if (!coupledMode || !audio) return;
    if (state.audioRateNudgeActive && now() < state.audioRateNudgeUntil) return;
    try {
      const targetRate = Number(video.playbackRate()) || 1;
      const currentRate = Number(audio.playbackRate) || 1;
      if (Math.abs(currentRate - targetRate) > 0.0005) {
        audio.playbackRate = targetRate;
      }
    } catch {}
  }

  function safeSetVideoTime(t) {
    try { if (isFinite(t) && t >= 0) video.currentTime(t); } catch {}
    try { safeSetCT(videoEl, t); } catch {}
    try {
      const v = getVideoNode();
      if (v && v !== videoEl) safeSetCT(v, t);
    } catch {}
  }

  // Silently update video.currentTime to match audio position when in the backgro
  function bgSilentSyncVideoTime(t) {
    if (!isFinite(t) || t < 0) return;
    // Never silently sync video to 0 after first play (unless looping)
    if (t < 0.5 && state.firstPlayCommitted && !state.restarting && !isLoopDesired()) {
      const vt = Number(videoEl.currentTime) || 0;
      if (vt > 2) return;
    }
    try {
      const vt = Number(videoEl.currentTime) || 0;
      if (Math.abs(vt - t) < 0.12) return;
      // Cancel any pending clear so we don't accidentally clear while a new sync is pending
      if (state.bgSilentTimeSyncTimer) {
        clearTimeout(state.bgSilentTimeSyncTimer);
        state.bgSilentTimeSyncTimer = null;
      }
      state.bgSilentTimeSyncing = true;
      videoEl.currentTime = t;
      try {
        const v = getVideoNode();
        if (v && v !== videoEl) v.currentTime = t;
      } catch {}
      // Update lastKnownGoodVT so tab-return resume starts from the correct position
      state.lastKnownGoodVT = t;
      state.lastKnownGoodVTts = now();
    } catch {}
    // Clear flag after generous delay — seek events are asynchronous
    state.bgSilentTimeSyncTimer = setTimeout(() => {
      state.bgSilentTimeSyncing = false;
      state.bgSilentTimeSyncTimer = null;
    }, 500);
  }

  function timeInBuffered(media, t) {
    try {
      const br = media.buffered;
      if (!br || br.length === 0 || !isFinite(t)) return false;
      for (let i = 0; i < br.length; i++) {
        const s = br.start(i) - EPS;
        const e = br.end(i) + EPS;
        if (t >= s && t <= e) return true;
      }
    } catch {}
    return false;
  }

  function bufferedAhead(media, t) {
    try {
      const br = media.buffered;
      if (!br || br.length === 0 || !isFinite(t)) return 0;
      for (let i = 0; i < br.length; i++) {
        const s = br.start(i) - EPS;
        const e = br.end(i) + EPS;
        if (t >= s && t <= e) return Math.max(0, e - t);
      }
    } catch {}
    return 0;
  }

  function canPlaySmoothAt(media, t, minAhead = STRICT_BUFFER_AHEAD_SEC) {
    try {
      if (!media || !isFinite(t)) return false;
      const rs = Number(media.readyState || 0);
      const ahead = bufferedAhead(media, t);
      if (rs >= HAVE_ENOUGH_DATA) return true;
      if (rs >= HAVE_FUTURE_DATA && ahead >= Math.min(0.10, minAhead)) return true;
      if (t < 0.5 && rs >= 2 && ahead >= Math.min(0.10, minAhead)) return true;
      return ahead >= minAhead;
    } catch { return false; }
  }

  function canPlayAt(media, t) {
    try {
      if (!media || !isFinite(t)) return false;
      const rs = Number(media.readyState || 0);
      if (rs >= 3) return true;
      if (t < 0.5 && rs >= 2) return true;
      return timeInBuffered(media, t);
    } catch { return false; }
  }

  function canStartAudioAt(t) {
    if (!coupledMode || !audio) return false;
    try {
      const rs = Number(audio.readyState || 0);
      if (rs >= 2) return true;
      return canPlayAt(audio, t);
    } catch { return false; }
  }

  function bothPlayableAt(t) {
    if (!coupledMode) return true;
    const v = getVideoNode();
    return canPlaySmoothAt(v, t, STRICT_BUFFER_AHEAD_SEC) && canPlaySmoothAt(audio, t, STRICT_BUFFER_AHEAD_SEC);
  }

  function bothStartupBufferedAt(t) {
    if (!coupledMode) return true;
    const v = getVideoNode();
    return canPlaySmoothAt(v, t, STARTUP_BUFFER_AHEAD_SEC) && canPlaySmoothAt(audio, t, STARTUP_BUFFER_AHEAD_SEC);
  }

  function shouldBlockNewAudioStart() {
    if (!coupledMode) return false;
    if (state.seeking || state.seekBuffering) return true;
    if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return true;
    // During tab-return grace, don't block audio even if video is momentarily paused
    if (inBgReturnGrace() || BringBackToTabManager.isLocked()) return false;

    if (getVideoPaused() && !isHiddenBackground()) return true;

    if (state.startupPhase && !state.firstPlayCommitted) return false;

    // These checks must run BEFORE the bgPlaybackAllowed early-return (bgPlaybackAllowed is always true).
    // Block audio when video is actively buffering/stalled.
    if (state.videoWaiting) return true; // block audio while video is buffering regardless of visibility
    if (state.videoStallAudioPaused) return true;
    if (now() < state.stallAudioResumeHoldUntil) return true;

    if (state.audioPausedSince > 0 && (now() - state.audioPausedSince) > AUDIO_STUCK_HARD_MS) return false;
    if (state.bgPlaybackAllowed) return false;
    const allowHiddenBootstrap =
    (document.visibilityState === "hidden" && (hiddenMediaSessionPlayActive() || state.mediaSessionInitiatedPlay));
    if (document.visibilityState === "hidden" && !allowHiddenBootstrap) return true;
    if (chromiumPauseGuardActive() && !allowHiddenBootstrap) return true;
    if (chromiumAudioStartLocked() && !allowHiddenBootstrap) return true;
    if (chromiumBgSettlingActive() && getVideoPaused() && !allowHiddenBootstrap) return true;
    if (!allowHiddenBootstrap) {
      if (getVideoPaused()) return true;
      if (state.videoWaiting) return true;
      const rs = getVideoReadyState();
      if (!fastSyncActive() && rs < 2) return true;
    }
    return false;
  }

  function updateMediaSessionPlaybackState() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state.intendedPlaying ? "playing" : "paused";
    } catch {}
  }

  function maybeUpdateMediaSessionPosition(vt) {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (now() < state.mediaPositionNextAt) return;
    state.mediaPositionNextAt = now() + 1000;
    try {
      navigator.mediaSession.setPositionState({
        duration: Number(video.duration()) || 0,
                                              playbackRate: Number(video.playbackRate()) || 1,
                                              position: vt
      });
    } catch {}
  }

  function updateLastKnownGoodVT() {
    try {
      const vt = Number(video.currentTime());
      if (isFinite(vt) && vt > 0.1) {
        state.lastKnownGoodVT = vt;
        state.lastKnownGoodVTts = now();
      }
    } catch {}
  }

  function getBestResumePosition() {
    try {
      const vt = Number(video.currentTime());
      const at = coupledMode && audio ? Number(audio.currentTime) : NaN;
      const bothAtStart = (vt < 0.5) && (!isFinite(at) || at < 0.5);
      const hasSaved = state.lastKnownGoodVT > 0.5 && (now() - state.lastKnownGoodVTts) < 5000 && bothAtStart;
      if (hasSaved) return state.lastKnownGoodVT;
      if (isFinite(at) && at > 0.5 && (!isFinite(vt) || at > vt + 0.3)) return at;
      if (isFinite(vt) && vt > 0) return vt;
      if (isFinite(at) && at > 0) return at;
      return 0;
    } catch {
      return 0;
    }
  }

  function execProgrammaticVideoPause() {
    state.isProgrammaticVideoPause = true;
    try { video.pause(); } catch {}
    try { videoEl.pause(); } catch {}
    try {
      const v = getVideoNode();
      if (v && v !== videoEl && !v.paused) v.pause();
    } catch {}
    try {
      const inner = video?.el?.()?.querySelector?.("video");
      if (inner && !inner.paused) inner.pause();
    } catch {}
    setTimeout(() => { state.isProgrammaticVideoPause = false; }, 500);
  }

  function execProgrammaticVideoPlay() {
    VisibilityGuard.onPlayCalled(); // VG: suppress spurious pause after our play()
state.isProgrammaticVideoPlay = true;
try {
  let p = null;
  try { p = video.play(); } catch {}
  if (!p) {
    try {
      const v = getVideoNode();
      if (v) p = v.play();
    } catch {}
  }
  if (p && p.catch) p.catch(() => {});
  Promise.resolve(p).finally(() => {
    setTimeout(() => { state.isProgrammaticVideoPlay = false; }, 500);
  });
  return p;
} catch (e) {
  state.isProgrammaticVideoPlay = false;
  throw e;
}
  }

  async function execProgrammaticAudioPause(ms = 500) {
    if (!coupledMode || !audio) return;
    const until = now() + Math.max(300, Number(ms) || 0);
    state.audioPauseUntil = Math.max(state.audioPauseUntil, until);
    state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + 250);
    state.isProgrammaticAudioPause = true;
    state.audioPlayGeneration++;

    try { squelchAudioEvents(ms); } catch {}
    try { resetAudioPlaybackRate(); } catch {}

    if (!audio.paused && audio.volume > 0.015) {
      await doVolumeFade(0, AUDIO_FADE_DURATION_MS);
    }
    cancelActiveFade();
    try { audio.pause(); } catch {}

    setTimeout(() => { state.isProgrammaticAudioPause = false; }, 500);
  }

  async function execProgrammaticAudioPlay(opts = {}) {
    const { squelchMs = 500, minGapMs = 300, force = false } = opts;
    if (!coupledMode || !audio || typeof audio.play !== "function") return false;

    // Never start audio during seeking or seek-buffering.
    // Only finalizeSeekSync/playTogether may restart audio after seek completes.
    if (state.seeking || state.seekBuffering) return false;

    if (getVideoPaused() && !isHiddenBackground()) return false;

    // Cancel any active volume fade before attempting to play.
    if (force) {
      cancelActiveFade();
      state.isProgrammaticAudioPause = false;
    }

    const myGeneration = state.audioPlayGeneration;
    const mySession = state.playSessionId;

    if (!force && checkRapidPlayPause()) return !audio.paused;
    if (!force && !checkAudioPlayAttempt()) return !audio.paused;
    if (!force && !audio.paused) return true;

    const timeSinceLastPlayPause = now() - state.audioLastPlayPauseTs;
    if (!force && timeSinceLastPlayPause < MIN_PLAY_PAUSE_GAP_MS) {
      if (!audio.paused) softUnmuteAudio(80).catch(() => {});
      return !audio.paused;
    }
    if (now() < state.stateChangeCooldownUntil && !force) return !audio.paused;
    if (now() < state.audioFadeCompleteUntil && !force) return !audio.paused;
    if (shouldBlockNewAudioStart()) return false;
    const t = now();
    if (!force && t < state.audioPauseUntil) return !audio.paused;
    if (!force && t < state.audioPlayUntil) return !audio.paused;
    if (state.audioPlayInFlight) {
      try { await state.audioPlayInFlight; } catch {}
      return !audio.paused;
    }
    state.audioPlayUntil = t + Math.max(0, Number(minGapMs) || 0);
    state.audioPauseUntil = 0;
    state.isProgrammaticAudioPlay = true;
    resetAudioPlaybackRate();
    try {
      squelchAudioEvents(squelchMs);

      const audioActuallyPaused = audio.paused;
      if (audioActuallyPaused) {
        cancelActiveFade();
        audio.volume = 0;
      }

      const p = audio.play();
      // Race audio.play() against a 4s timeout -- some browsers hang the play() promise
      // indefinitely (e.g. network stall during autoplay), which would block all future audio starts.
      const playTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error("audio-play-timeout")), 4000));
      state.audioPlayInFlight = Promise.race([Promise.resolve(p), playTimeout]);
      state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + Math.max(400, squelchMs));
      state.audioLastPlayPauseTs = now();
      state.stateChangeCooldownUntil = now() + STATE_CHANGE_COOLDOWN_MS;

      if (audioActuallyPaused) {
        fadeAudioIn(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
      } else {
        updateAudioGainImmediate();
      }

      try {
        await state.audioPlayInFlight;
      } catch {
        updateAudioGainImmediate();
        return false;
      }

      // Check generation AND session after every await
      if (state.audioPlayGeneration !== myGeneration || !state.intendedPlaying || mySession !== state.playSessionId) {
        try { squelchAudioEvents(400); audio.pause(); } catch {}
        return false;
      }

      if (shouldBlockNewAudioStart() || userPauseLockActive()) {
        try { squelchAudioEvents(350); } catch {}
        try { audio.pause(); } catch {}
        return false;
      }

      if (!audio.paused) state.audioEverStarted = true;
      return !audio.paused;
    } finally {
      state.audioPlayInFlight = null;
      setTimeout(() => { state.isProgrammaticAudioPlay = false; }, 500);
    }
  }

  async function ensureUnmutedIfNotUserMuted() {
    if (state.startupPhase) {
      if (state.intendedPlaying) forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      return;
    }
    await softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS);
  }

  async function softAlignAudioTo(t) {
    if (!coupledMode) return;
    await quietSeekAudio(t);
  }

  function clearResumeAfterBufferTimer() {
    if (state.resumeAfterBufferTimer) {
      clearTimeout(state.resumeAfterBufferTimer);
      state.resumeAfterBufferTimer = null;
    }
  }

  function clearBgResumeRetryTimer() {
    if (state.bgResumeRetryTimer) {
      clearTimeout(state.bgResumeRetryTimer);
      state.bgResumeRetryTimer = null;
    }
  }

  function clearSeekSyncFinalizeTimer() {
    if (state.seekFinalizeTimer) {
      clearTimeout(state.seekFinalizeTimer);
      state.seekFinalizeTimer = null;
    }
  }
  function clearSeekWatchdog() {
    if (state.seekWatchdogTimer) {
      clearTimeout(state.seekWatchdogTimer);
      state.seekWatchdogTimer = null;
    }
  }

  function cancelBackgroundResumeState() {
    state.resumeOnVisible = false;
    state.bgAutoResumeSuppressed = false;
    state.bgHiddenWasPlaying = false;
    state.bgHiddenSince = 0;
    clearBgResumeRetryTimer();
  }

  function clearSyncLoop() {
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      state.syncTimer = null;
    }
    state.syncScheduledAt = 0;
  }

  function scheduleSync(minDelay = null) {
    let delay;
    if (typeof minDelay === "number") {
      delay = Math.max(0, minDelay);
    } else if (document.visibilityState === "hidden") {
      delay = platform.useBgControllerRetry ? 1200 : 1500;
    } else if (fastSyncActive() || state.syncing || state.seeking || state.videoWaiting || state.strictBufferHold) {
      delay = 200;
    } else if (state.intendedPlaying) {
      delay = 500;
    } else {
      delay = 1000;
    }
    const targetAt = now() + delay;
    if (state.syncTimer && state.syncScheduledAt <= targetAt) return;
    if (state.syncTimer) clearTimeout(state.syncTimer);
    state.syncScheduledAt = targetAt;
    state.syncTimer = setTimeout(runSync, delay);
  }

  async function kickAudio() {
    if (!coupledMode) return;
    try {
      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);
      const target = isFinite(vt) ? vt : (isFinite(at) ? at : 0);
      await execProgrammaticAudioPause(600);
      safeSetAudioTime(target);
      await new Promise(r => setTimeout(r, 100));
      if (state.intendedPlaying && !getVideoPaused() && !userPauseLockActive() && !shouldBlockNewAudioStart()) {
        resetAudioPlaybackRate();
        await execProgrammaticAudioPlay({ squelchMs: 600, force: true, minGapMs: 0 }).catch(() => false);
        softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
      }
    } catch {}
  }

  async function kickVideo() {
    if (state.videoRepairing) return;
    if (now() < state.videoRepairCooldownUntil) return;
    state.videoRepairing = true;
    state.videoRepairCooldownUntil = now() + 4000;
    try {
      const v = getVideoNode();
      const t = Number(video.currentTime()) || 0;
      execProgrammaticAudioPause(900);
      execProgrammaticVideoPause();
      const nudge = Math.max(0, t + 0.001);
      try {
        safeSetCT(videoEl, nudge);
        if (v && v !== videoEl) safeSetCT(v, nudge);
      } catch {}
      await new Promise(r => setTimeout(r, 120));
      try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
      if (!getVideoPaused()) {
        const vt = Number(video.currentTime()) || t;
        safeSetAudioTime(vt);
        if (!shouldBlockNewAudioStart()) {
          await execProgrammaticAudioPlay({ squelchMs: 900, force: true, minGapMs: 0 }).catch(() => false);
        }
        softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
      }
    } finally {
      state.videoRepairing = false;
    }
  }

  function scheduleBgResumeRetry(delay = 400) {
    if (!platform.useBgControllerRetry) return;
    if (mediaSessionForcedPauseActive()) return;
    if (userPauseLockActive()) return;
    // Don't schedule bgResumeRetry if the wakeup timer is already pending —
    // competing resume attempts cause the visible play→pause stutter on tab return.
    if (state.wakeupTimer) return;
    // BPMM gate: if oscillation circuit-breaker is active, don't schedule retry
    // (we'll resume on foreground return instead)
    if (!BackgroundPlaybackManagerManager.shouldAttemptBgResume()) {
      if (state.intendedPlaying) state.resumeOnVisible = true;
      return;
    }
    clearBgResumeRetryTimer();
    // On Chromium tab return, enforce a minimum delay matching the spurious-pause burst window.
    // Attempting resume before this window expires causes a visible play→pause→play stutter.
    let effectiveDelay = delay;
    if (platform.chromiumOnlyBrowser && inBgReturnGrace()) {
      effectiveDelay = Math.max(delay, BG_RESUME_MIN_DELAY_CHROMIUM_MS);
    }
    state.bgResumeRetryTimer = setTimeout(() => {
      if (!state.intendedPlaying || state.restarting || state.seeking || state.syncing) return;
      if (userPauseLockActive()) return;
      if (isHiddenBackground()) {
        state.resumeOnVisible = true;
        return;
      }
      playTogether().catch(() => {});
    }, effectiveDelay);
  }

  function waitForReadyStateOrCanPlay(media, minRS = 3, timeoutMs = 2500) {
    return new Promise(resolve => {
      let done = false;
      let to = null;
      const finish = ok => {
        if (done) return;
        done = true;
        try { if (to) clearTimeout(to); } catch {}
        try { media.removeEventListener("canplay", onEvt); } catch {}
        try { media.removeEventListener("canplaythrough", onEvt); } catch {}
        try { media.removeEventListener("loadeddata", onEvt); } catch {}
        try { media.removeEventListener("seeked", onEvt); } catch {}
        resolve(!!ok);
      };
      const onEvt = () => {
        try { if (Number(media.readyState || 0) >= minRS) finish(true); } catch {}
      };
      try { if (Number(media.readyState || 0) >= minRS) return resolve(true); } catch {}
      try { media.addEventListener("canplay", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("canplaythrough", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("loadeddata", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("seeked", onEvt, { once: true, passive: true }); } catch {}
      to = setTimeout(() => finish(false), timeoutMs);
    });
  }

  function noteBackgroundEntry() {
    if (!coupledMode || !platform.useBgControllerRetry) return;
    state.bgHiddenSince = now();
    if (!state.intendedPlaying) {
      state.bgHiddenWasPlaying = false;
      return;
    }
    state.bgHiddenWasPlaying = true;
    try { state.bgHiddenBaseVT = Number(video.currentTime()) || 0; } catch { state.bgHiddenBaseVT = 0; }
    try { state.bgHiddenBaseAT = Number(audio.currentTime) || state.bgHiddenBaseVT; } catch { state.bgHiddenBaseAT = state.bgHiddenBaseVT; }
    try { state.bgHiddenBaseRate = Number(video.playbackRate()) || 1; } catch { state.bgHiddenBaseRate = 1; }
    // Save lastKnownGoodVT precisely when going to background
    updateLastKnownGoodVT();
  }

  async function seamlessBgCatchUp() {
    if (!coupledMode || !platform.useBgControllerRetry) return;
    if (!state.intendedPlaying) return;
    if (state.restarting || state.seeking || state.syncing) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;
    if (now() < state.bgCatchUpCooldownUntil) return;
    if (state.bgResumeInFlight) return;
    if (!state.firstPlayCommitted && wantsStartupAutoplay() &&
      (state.startupAutoplayRetryTimer || state.startupKickInFlight)) {
      return;
      }
      state.bgResumeInFlight = true;
    state.bgCatchUpCooldownUntil = now() + 50; // minimal cooldown for fastest bg recovery

    const mySession = state.playSessionId;

    try {
      const atNow = Number(audio.currentTime);
      const vtNow = Number(video.currentTime());
      const aPausedNow = !!audio.paused;
      const vPausedNow = getVideoPaused();

      // Abort if session changed while we were getting times
      if (mySession !== state.playSessionId || !state.intendedPlaying) return;

      if (!aPausedNow && !vPausedNow && isFinite(atNow) && isFinite(vtNow)) {
        const drift = Math.abs(vtNow - atNow);
        if (drift < 2.0) {
          state.bgHiddenWasPlaying = false;
          state.resumeOnVisible = false;
          setFastSync(1500);
          scheduleSync(0);
          return;
        }
        // Both playing but drift > 2s (audio ahead of video from background playback).
        bgSilentSyncVideoTime(atNow);
        if (mySession !== state.playSessionId || !state.intendedPlaying) return;
        state.bgHiddenWasPlaying = false;
        state.resumeOnVisible = false;
        setFastSync(1500);
        scheduleSync(0);
        return;
      }

      if (!aPausedNow && isFinite(atNow)) {
        if (mySession !== state.playSessionId || !state.intendedPlaying) return;
        const inBg = isHiddenBackground();
        if (isFinite(vtNow) && Math.abs(vtNow - atNow) > 0.12) {
          if (inBg) {
            // Background: silently update video time to keep progress bar in sync.
            // Full seek machinery MUST NOT fire in background (causes watchdog timeouts,
            // state.seeking stuck, etc.) — bgSilentSyncVideoTime bypasses all of that.
            bgSilentSyncVideoTime(atNow);
          } else {
            // For small drift (≤ BIG_DRIFT = 1.5s): just restart video from its
            if (isFinite(vtNow) && isFinite(atNow) && Math.abs(vtNow - atNow) > BIG_DRIFT) {
              bgSilentSyncVideoTime(atNow);
              // Brief settle before restarting video
              await new Promise(r => setTimeout(r, 25));
              if (mySession !== state.playSessionId || !state.intendedPlaying) return;
            }
          }
        }
        if (!inBg && vPausedNow && !state.isProgrammaticVideoPlay) {
          execProgrammaticVideoPlay();
        }
        state.bgHiddenWasPlaying = false;
        state.resumeOnVisible = false;
        setFastSync(1500);
        scheduleSync(0);
        return;
      }

      if (mySession !== state.playSessionId || !state.intendedPlaying) return;

      // Both paused — this is the main tab-return resume case.
      // Determine best resume position: prefer audio (it played in background),
      // then video, then lastKnownGoodVT.
      const bestPos = (() => {
        if (isFinite(atNow) && atNow > 0.5) return atNow;
        if (isFinite(vtNow) && vtNow > 0.5) return vtNow;
        if (state.lastKnownGoodVT > 0.5) return state.lastKnownGoodVT;
        return 0;
      })();

      state.bgHiddenWasPlaying = false;
      state.resumeOnVisible = false;

      // Sync both tracks to best position before resuming
      if (bestPos > 0.1) {
        if (isFinite(vtNow) && Math.abs(vtNow - bestPos) > 0.3) safeSetVideoTime(bestPos);
        if (coupledMode && isFinite(atNow) && Math.abs(atNow - bestPos) > 0.1) safeSetAudioTime(bestPos);
        // Brief settle after seek
        await new Promise(r => setTimeout(r, 40));
        if (mySession !== state.playSessionId || !state.intendedPlaying) return;
      }

      if (!state.firstPlayCommitted && wantsStartupAutoplay()) {
        forceZeroBeforeFirstPlay();
      }

      // BPMM gate: prevents play→pause→play oscillation in background.
      // Uses exponential backoff + oscillation circuit-breaker.
      if (!BackgroundPlaybackManagerManager.shouldAttemptBgResume()) {
        state.resumeOnVisible = true;
        return;
      }
      BackgroundPlaybackManager.trackBgResumeAttempt();
      await playTogether().catch(() => {});
      // Track success: if both tracks are now playing, reset backoff
      if (coupledMode) {
        if (state.intendedPlaying && !getVideoPaused() && audio && !audio.paused) {
          BackgroundPlaybackManagerManager.onBgPlaySuccess();
        } else if (!getVideoPaused() || (audio && !audio.paused)) {
          // Partial success — at least one track playing, don't backoff hard
        } else {
          // Complete failure — BPMM already tracked the attempt
          BackgroundPlaybackManagerManager.onBrowserForcedPause();
        }
      } else if (!getVideoPaused() && state.intendedPlaying) {
        BackgroundPlaybackManagerManager.onBgPlaySuccess();
      }
    } finally {
      state.bgResumeInFlight = false;
    }
  }

  function armResumeAfterBuffer(timeoutMs = 9000) {
    if (!coupledMode) {
      // Non-coupled mode: simpler buffer-wait — just wait for video readyState
      if (!state.intendedPlaying || state.restarting || state.seeking) return;
      const vNode = getVideoNode();
      if (!vNode) return;
      let ncDone = false;
      const ncResume = () => {
        if (ncDone) return;
        ncDone = true;
        try { vNode.removeEventListener("canplay", ncCheck); } catch {}
        try { vNode.removeEventListener("canplaythrough", ncCheck); } catch {}
        try { clearTimeout(ncTimeout); } catch {}
        try { clearInterval(ncPoll); } catch {}
        if (!state.intendedPlaying || state.restarting || state.seeking) return;
        state.strictBufferHold = false; state.bufferHoldSince = 0;
        state.strictBufferReason = "";
        if (getVideoPaused()) execProgrammaticVideoPlay();
      };
      const ncCheck = () => {
        if (Number(vNode.readyState || 0) >= HAVE_FUTURE_DATA) ncResume();
      };
      // Already ready?
      if (Number(vNode.readyState || 0) >= HAVE_FUTURE_DATA) { ncResume(); return; }
      try { vNode.addEventListener("canplay", ncCheck, { passive: true }); } catch {}
      try { vNode.addEventListener("canplaythrough", ncCheck, { passive: true }); } catch {}
      const ncPoll = setInterval(ncCheck, 500);
      const ncTimeout = setTimeout(ncResume, timeoutMs);
      return;
    }
    if (!state.intendedPlaying || state.restarting || state.seeking || state.syncing) return;
    if (mediaSessionForcedPauseActive()) return;
    clearResumeAfterBufferTimer();
    const v = getVideoNode();
    let cleaned = false;
    let pollTimer = null;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
      try { v.removeEventListener("canplay", onReady); } catch {}
      try { v.removeEventListener("playing", onReady); } catch {}
      try { audio.removeEventListener("canplay", onReady); } catch {}
      try { audio.removeEventListener("playing", onReady); } catch {}
    };
    const tryKick = () => {
      if (!state.intendedPlaying || state.restarting || state.seeking || state.syncing) {
        cleanup(); return;
      }
      if (mediaSessionForcedPauseActive() || userPauseLockActive()) {
        cleanup(); return;
      }
      // Stall hold must have expired before we resume
      if (now() < state.stallAudioResumeHoldUntil) return;

      const vtNow = Number(video.currentTime());
      const atNow = Number(audio.currentTime);
      const checkTime = Math.max(vtNow, atNow || 0);
      const inBg = document.visibilityState === "hidden" || !isWindowFocused();
      const vNode = getVideoNode();
      // Primary gate: readyState ≥ HAVE_FUTURE_DATA (3) — more reliable than bufferedAhead
      const vRS = Number(vNode.readyState || 0);
      const videoReady = vRS >= HAVE_FUTURE_DATA;
      const ready = inBg
      ? (canPlayAt(vNode, checkTime) && canPlayAt(audio, checkTime))
      : (videoReady && bothPlayableAt(checkTime));
      if (!ready) return;
      state.strictBufferHold = false; state.bufferHoldSince = 0;
      state.strictBufferReason = "";
      state.strictBufferHoldFrames = 0;
      state.strictBufferHoldConfirmed = false;
      // Clear stall-pause state so shouldBlockNewAudioStart() allows audio through
      state.videoStallAudioPaused = false;
      state.stallAudioPausedSince = 0;
      state.stallAudioResumeHoldUntil = 0;
      setFastSync(1600);
      cleanup();
      if (!inMediaTxnWindow()) playTogether().catch(() => {});
      else scheduleSync(200);
    };
      const onReady = () => { requestAnimationFrame(tryKick); };
      try { v.addEventListener("canplay", onReady, { passive: true }); } catch {}
      try { v.addEventListener("playing", onReady, { passive: true }); } catch {}
      try { audio.addEventListener("canplay", onReady, { passive: true }); } catch {}
      try { audio.addEventListener("playing", onReady, { passive: true }); } catch {}
      const poll = () => {
        if (cleaned) return;
        tryKick();
        // Use a much longer poll interval in background — polling aggressively
        // triggers rapid play→pause→play oscillation when the browser keeps
        // auto-pausing. canplay/playing events fire anyway when media is ready.
        const pollInterval = isHiddenBackground() ? 2000 : 350;
        if (!cleaned) pollTimer = setTimeout(poll, pollInterval);
      };
        pollTimer = setTimeout(poll, isHiddenBackground() ? 1500 : 200);
        state.resumeAfterBufferTimer = setTimeout(() => {
          cleanup();
          state.resumeAfterBufferTimer = null;
          if (state.intendedPlaying && !state.restarting && !state.seeking && !userPauseLockActive()) {
            const vtNow = Number(video.currentTime());
            const atNow = coupledMode && audio ? Number(audio.currentTime) : vtNow;
            const checkTime = Math.max(vtNow, atNow || 0);
            const inBg2 = document.visibilityState === "hidden" || !isWindowFocused();
            const videoNode = getVideoNode();
            const vRS2 = Number(videoNode.readyState || 0);
            // Use readyState as primary gate (more reliable than bufferedAhead)
            const videoReady = vRS2 >= HAVE_FUTURE_DATA || canPlayAt(videoNode, checkTime);
            const rdy = inBg2
            ? (canPlayAt(videoNode, checkTime) && (!coupledMode || canPlayAt(audio, checkTime)))
            : (videoReady && bothPlayableAt(checkTime));
            // Force-clear buffer hold on timeout if video reports ready (audio may lag behind)
            if (rdy || videoReady) {
              state.strictBufferHold = false; state.bufferHoldSince = 0;
              state.strictBufferReason = "";
              state.strictBufferHoldFrames = 0;
              state.strictBufferHoldConfirmed = false;
              state.videoStallAudioPaused = false;
              state.stallAudioPausedSince = 0;
              state.stallAudioResumeHoldUntil = 0;
              playTogether().catch(() => {});
            }
          }
        }, Math.max(2000, Number(timeoutMs) || 0));
  }

  function clearPendingPlayResumesForPause() {
    state.userPlayIntentPresetAt = 0;  // cancel any pending play preset
    cancelActiveFade();
    state.audioPlayGeneration++;

    clearHiddenMediaSessionPlay();
    clearBgResumeRetryTimer();
    clearResumeAfterBufferTimer();
    cancelBackgroundResumeState();
    state.strictBufferHold = false; state.bufferHoldSince = 0;
    state.strictBufferReason = "";
    state.strictBufferHoldFrames = 0;
    state.strictBufferHoldConfirmed = false;
    // Clear stall-pause state — user explicitly paused, so these locks no longer apply
    state.videoStallAudioPaused = false;
    state.stallAudioPausedSince = 0;
    state.stallAudioResumeHoldUntil = 0;
    state.startupAudioHoldUntil = 0;
    state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + 400);
    setPauseEventGuard(1600);
    setMediaPauseTxn(1600);
    if (platform.chromiumOnlyBrowser) {
      state.chromiumPauseGuardUntil = Math.max(state.chromiumPauseGuardUntil, now() + 2000);
      state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, now() + 2200);
      state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + 1600);
    }
  }

  function queueHardPauseVerification(msList = [0, 120, 300, 600, 1000]) {
    const serial = ++state.hardPauseVerifySerial;
    for (const delay of msList) {
      setTimeout(() => {
        if (serial !== state.hardPauseVerifySerial) return;
        if (state.intendedPlaying || userPlayIntentActive()) return;
        if (startupSettleActive()) return;
        try { if (!getVideoPaused()) execProgrammaticVideoPause(); } catch {}
        try { if (coupledMode && !audio.paused) execProgrammaticAudioPause(500); } catch {}
        clearSyncLoop();
      }, delay);
    }
  }

  function pauseHard() {
    state.userPauseIntentPresetAt = 0;
    disengagePauseIntercept();
    clearSeekBuffering();
    clearHiddenMediaSessionPlay();
    clearBgResumeRetryTimer();
    clearResumeAfterBufferTimer();

    state.isProgrammaticVideoPause = true;
    try { video.pause(); } catch {}
    try { videoEl.pause(); } catch {}
    try {
      const v = getVideoNode();
      if (v && v !== videoEl && !v.paused) v.pause();
    } catch {}
    try {
      const inner = video?.el?.()?.querySelector?.("video");
      if (inner && !inner.paused) inner.pause();
    } catch {}
    setTimeout(() => { state.isProgrammaticVideoPause = false; }, 500);

    if (coupledMode && audio) {
      state.audioPauseUntil = Math.max(state.audioPauseUntil, now() + 300);
      state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + 250);
      state.audioPlayGeneration++;
      state.isProgrammaticAudioPause = true;

      if (!audio.paused && audio.volume > 0.015) {
        // Guard the fade callback: if intendedPlaying became true before the fade
        // completes (user pressed play immediately), abort the pause.
        const pauseSession = state.playSessionId;
        fadeAndPauseAudio(AUDIO_FADE_DURATION_MS, () => {
          // Only pause if nothing changed since we started the fade
          if (state.playSessionId !== pauseSession || state.intendedPlaying) {
            setTimeout(() => { state.isProgrammaticAudioPause = false; }, 100);
            return;
          }
          setTimeout(() => { state.isProgrammaticAudioPause = false; }, 200);
        });
      } else {
        cancelActiveFade();
        try { audio.pause(); } catch {}
        setTimeout(() => { state.isProgrammaticAudioPause = false; }, 300);
      }
    } else if (!coupledMode && audio && !audio.paused) {
      // Non-coupled mode (e.g. quality=medium): audio element exists but has no source.
      // Keep it permanently silent — it must never play anything.
      try { audio.muted = true; audio.volume = 0; audio.pause(); } catch {}
    }

    clearSyncLoop();
    if (!state.intendedPlaying) queueHardPauseVerification();
  }

  function pauseTogether() {
    if (detectLoop()) {
      state.intendedPlaying = false;
      pauseHard();
      return;
    }
    // Allow immediate user actions through startupSettle gate
    const _immediateAction = BackgroundPlaybackManager.isUserPauseImmediate();
    if (startupSettleActive() && !_immediateAction && !userPauseIntentActive() && !mediaSessionForcedPauseActive()) return;
    state.intendedPlaying = false;
    state.bufferHoldIntendedPlaying = false;
    state.resumeOnVisible = false;
    state.bgHiddenWasPlaying = false;
    state.tabReturnImmuneUntil = 0;
    disengagePauseIntercept();
    state.strictBufferHold = false; state.bufferHoldSince = 0;
    state.strictBufferReason = "";
    state.strictBufferHoldFrames = 0;
    state.strictBufferHoldConfirmed = false;
    state.playSessionId = (state.playSessionId || 0) + 1;
    updateMediaSessionPlaybackState();
    if (!state.syncing && !state.seeking) pauseHard();
    else queueHardPauseVerification();
  }

  // Always seek both tracks to 0 before first play, unconditionally.
  // The browser can pre-buffer a background tab's video at a non-zero position;
  // the old "give up if vt > 0.5" logic caused autoplay to start mid-video.
  function forceZeroBeforeFirstPlay() {
    // Only run ONCE, and never after play has started
    if (state.startupZeroed || state.firstPlayCommitted) return;
    state.startupZeroed = true;
    try { video.currentTime(0); } catch {}
    try {
      safeSetCT(videoEl, 0);
      const v = getVideoNode();
      if (v && v !== videoEl) safeSetCT(v, 0);
    } catch {}
    if (coupledMode && audio) {
      try { audio.currentTime = 0; } catch {}
    }
    state.lastKnownGoodVT = 0;
    state.lastKnownGoodVTts = now();
  }

  function ensureStartupZeroed() { forceZeroBeforeFirstPlay(); }

  async function playTogether() {
    state.userPlayIntentPresetAt = 0;
    // Never trigger loop detection during tab-return immunity
    if (!(state.tabReturnImmuneUntil > now()) && detectLoop()) {
      state.intendedPlaying = false;
      pauseHard();
      return;
    }

    if (!coupledMode) {
      if (!state.intendedPlaying && state.firstPlayCommitted) return;
      if (MediumQualityManager.intentPaused && state.firstPlayCommitted) {
        if (!getVideoPaused()) execProgrammaticVideoPause();
        state.intendedPlaying = false;
        updateMediaSessionPlaybackState();
        return;
      }
      if (getVideoPaused()) {
        try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
      }
      state.intendedPlaying = !getVideoPaused();
      updateMediaSessionPlaybackState();
      setFastSync(1600);
      scheduleSync(0);
      return;
    }
    if (state.syncing || state.restarting) return;
    if (mediaSessionForcedPauseActive()) return;
    if (userPauseLockActive()) return;

    const mySession = state.playSessionId;
    state.syncing = true;
    setFastSync(2400);
    try {
      if (!state.intendedPlaying || mySession !== state.playSessionId) return;

      if (!state.firstPlayCommitted && wantsStartupAutoplay()) {
        forceZeroBeforeFirstPlay();
      }

      const vtStart = Number(video.currentTime()) || 0;
      if (state.startupPhase && !state.startupPrimed) {
        safeSetAudioTime(vtStart);
      }
      forceUnmuteForPlaybackIfAllowed();
      const inBackground = document.visibilityState === "hidden" || !isWindowFocused();
      // On tab return, don't apply strict buffer gate — video was playing in background and has buffer
      const bypassBufferForBgReturn = inBgReturnGrace();
      const blockOnBuffer =
      !bypassBufferForBgReturn &&
      !inBackground &&
      !startupSettleActive() &&
      (state.startupPrimed || state.audioEverStarted) &&
      (state.audioEverStarted ? !bothPlayableAt(vtStart) : !canPlaySmoothAt(getVideoNode(), vtStart, STRICT_BUFFER_AHEAD_SEC));
      if (blockOnBuffer) {
        state.strictBufferHold = true;
        if (!state.bufferHoldSince) state.bufferHoldSince = now();
        state.strictBufferReason = "strict-play-gate";
        state.bufferHoldIntendedPlaying = state.intendedPlaying;
        execProgrammaticVideoPause();
        execProgrammaticAudioPause(600);
        await quietSeekAudio(vtStart);
        armResumeAfterBuffer(10000);
        return;
      }
      state.strictBufferHold = false; state.bufferHoldSince = 0;
      state.strictBufferReason = "";
      state.strictBufferHoldFrames = 0;
      state.strictBufferHoldConfirmed = false;
      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);

      const inBgDrift = document.visibilityState === "hidden" || !isWindowFocused() || inBgReturnGrace();
      // inBgReturnGrace: don't seek audio during the tab-return grace window.
      // seamlessBgCatchUp (fired by executeSeamlessWakeup) handles drift correction
      // after the spurious-pause burst has subsided (950ms on Chromium, 300ms others).
      if (!inBgDrift && isFinite(vt) && isFinite(at) && Math.abs(at - vt) > 0.25) {
        await quietSeekAudio(vt);
      }

      // Re-check after await
      if (!state.intendedPlaying || mySession !== state.playSessionId) return;

      let videoOk = true;
      let audioOk = true;
      let vPlayP = null;
      let aPlayP = null;

      if (getVideoPaused()) {
        try {
          vPlayP = execProgrammaticVideoPlay();
        } catch {}
      }

      if (coupledMode && audio && audio.paused) {
        const vNow = Number(video.currentTime()) || 0;
        const canKickFirstAudio = !state.audioEverStarted && canStartAudioAt(vNow);
        const shouldHoldAudio =
        state.strictBufferHold ||
        shouldBlockNewAudioStart() ||
        // UltraStabilizer gate: block audio until video has fired its first "playing" event.
        // This prevents the audio-without-video race at startup.
        UltraStabilizer.shouldBlockAudioAtStartup() ||
        (document.visibilityState === "visible" && state.videoWaiting && state.startupPhase && !state.audioEverStarted);

        if (shouldHoldAudio) {
          if (state.videoWaiting) armResumeAfterBuffer(10000);
        } else if (!canKickFirstAudio && startupAudioHoldActive()) {
          // hold
        } else {
          safeSetAudioTime(vNow);
          aPlayP = execProgrammaticAudioPlay({
            squelchMs: canKickFirstAudio ? 300 : 400,
            minGapMs: canKickFirstAudio ? 0 : 100,
            force: true
          });
        }
      } else if (coupledMode && audio && !audio.paused) {
        if (!state.audioFading) {
          const targetVol = targetVolFromVideo();
          if (Math.abs(audio.volume - targetVol) > 0.02) {
            softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
          }
        }
      }

      if (vPlayP && vPlayP.then) await vPlayP.catch(() => {});
      videoOk = !getVideoPaused();

      if (!state.intendedPlaying || userPauseLockActive() || mySession !== state.playSessionId) {
        if (!getVideoPaused()) execProgrammaticVideoPause();
        if (coupledMode && !audio.paused) execProgrammaticAudioPause(100);
        return;
      }

      if (aPlayP) {
        audioOk = await aPlayP.catch(() => false);
      } else {
        audioOk = coupledMode ? !audio.paused : true;
      }

      if (!state.intendedPlaying || userPauseLockActive() || mySession !== state.playSessionId) {
        if (!getVideoPaused()) execProgrammaticVideoPause();
        if (coupledMode && !audio.paused) execProgrammaticAudioPause(100);
        return;
      }

      if (videoOk) {
        forceUnmuteForPlaybackIfAllowed();
        if (coupledMode && audio && (audio.paused || audio.volume < 0.05)) {
          softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
        }
      }

      if (!videoOk && !audioOk) {
        if (isHiddenBackground() && state.intendedPlaying) {
          state.resumeOnVisible = true;
        } else if (!state.firstPlayCommitted || (state.startupPhase && !state.audioEverStarted)) {
          // --- startup guard for dual-fail
          armResumeAfterBuffer(8000);
        } else {
          state.intendedPlaying = false;
          state.playSessionId = (state.playSessionId || 0) + 1;
          pauseHard();
          updateMediaSessionPlaybackState();
        }
        return;
      } else if (!videoOk && audioOk) {
        if (isHiddenBackground() && state.bgPlaybackAllowed) {
          // ok — audio-only background playback is allowed
        } else if (inBgReturnGrace() && !isHiddenBackground()) {
          // Tab return: audio is going, video just needs a moment — retry video instead of stopping audio
          const retrySession = mySession;
          setTimeout(() => {
            if (!state.intendedPlaying || retrySession !== state.playSessionId) return;
            if (!getVideoPaused()) return;
            execProgrammaticVideoPlay();
          }, TAB_RETURN_AUDIO_RETRY_DELAY_MS);
        } else if (state.startupPhase || !state.audioEverStarted) {
          // During startup: keep intendedPlaying=true. Audio started but video failed —
          // pause audio and arm buffer retry. The startup mechanism handles the restart.
          // Setting intendedPlaying=false here creates the visible first-30s oscillation.
          execProgrammaticAudioPause(600);
          armResumeAfterBuffer(8000);
        } else if (document.visibilityState !== "hidden" && isWindowFocused()) {
          execProgrammaticAudioPause(600);
          state.intendedPlaying = false;
          state.playSessionId = (state.playSessionId || 0) + 1;
          updateMediaSessionPlaybackState();
        } else if (coupledMode) {
          execProgrammaticAudioPause(600);
          if (state.startupPhase && !state.firstPlayCommitted) {
            forceZeroBeforeFirstPlay();
          }
          if (state.intendedPlaying) state.resumeOnVisible = true;
        }
      } else if (videoOk && !audioOk) {
        if (coupledMode && isHiddenBackground() && state.intendedPlaying) {
          state.resumeOnVisible = true;
        }
      }

      const vp = getVideoPaused();
      const ap = !!audio.paused;
      if (!vp && ap && !state.strictBufferHold && !state.videoWaiting) {
        const cur = Number(video.currentTime()) || 0;
        if (!shouldBlockNewAudioStart() && canStartAudioAt(cur)) {
          safeSetAudioTime(cur);
          const audioStarted = await execProgrammaticAudioPlay({ squelchMs: 450, force: true, minGapMs: 0 }).catch(() => false);

          if (!state.intendedPlaying || userPauseLockActive() || mySession !== state.playSessionId) {
            if (!getVideoPaused()) execProgrammaticVideoPause();
            if (coupledMode && !audio.paused) execProgrammaticAudioPause(100);
            return;
          }

          if (!audioStarted && !state.strictBufferHold && !state.videoWaiting && !shouldBlockNewAudioStart()) {
            if (coupledMode) {
              if (inBgReturnGrace() && !isHiddenBackground()) {
                // Tab return: video is playing fine — just retry audio after a brief delay
                // Never pause video or abandon intendedPlaying during bg return grace
                const retrySession = mySession;
                setTimeout(() => {
                  if (!state.intendedPlaying || retrySession !== state.playSessionId) return;
                  if (getVideoPaused()) return;
                  execProgrammaticAudioPlay({ force: true, squelchMs: 500, minGapMs: 0 }).catch(() => {});
                  softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
                }, TAB_RETURN_AUDIO_RETRY_DELAY_MS);
              } else if (state.startupPhase || !state.audioEverStarted) {
                // Prevent first-30s play/pause oscillation:
                execProgrammaticVideoPause();
                forceZeroBeforeFirstPlay();
                armResumeAfterBuffer(8000);
              } else {
                execProgrammaticVideoPause();
                if (isHiddenBackground()) {
                  state.resumeOnVisible = true;
                } else {
                  state.intendedPlaying = false;
                  state.playSessionId = (state.playSessionId || 0) + 1;
                  updateMediaSessionPlaybackState();
                }
              }
            } else if (document.visibilityState !== "hidden" && isWindowFocused()) {
              execProgrammaticVideoPause();
              state.intendedPlaying = false;
              state.playSessionId = (state.playSessionId || 0) + 1;
              updateMediaSessionPlaybackState();
            }
          }
        } else if (!shouldBlockNewAudioStart()) {
          if (coupledMode) {
            execProgrammaticVideoPause();
            if (state.startupPhase && !state.firstPlayCommitted) {
              forceZeroBeforeFirstPlay();
            }
            if (isHiddenBackground()) {
              state.resumeOnVisible = true;
            } else {
              armResumeAfterBuffer(10000);
            }
          } else if (document.visibilityState !== "hidden" && isWindowFocused()) {
            execProgrammaticVideoPause();
            armResumeAfterBuffer(10000);
          }
        }
      }
      if (vp && !ap) {
        if (document.visibilityState === "hidden" || !isWindowFocused() || isVisibilityTransitionActive() || isAltTabTransitionActive()) {
          // Background / transition: video paused but audio still playing.
          // Silently update video.currentTime so the progress bar stays correct,
          // without triggering full seek machinery (which can deadlock in background).
          bgSilentSyncVideoTime(Number(audio.currentTime));
        } else {
          // Foreground stable: video paused but audio playing is not allowed — pause audio.
          execProgrammaticAudioPause(600);
        }
      }
      if (!state.audioFading && audio.volume < 0.05 && !audio.paused) {
        softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
      }
      if (!state.firstPlayCommitted) {
        if (!getVideoPaused() && (!coupledMode || !audio.paused)) {
          state.startupKickDone = true;
          state.firstPlayCommitted = true;
          clearStartupAutoplayRetryTimer();
          setTimeout(() => { state.startupPhase = false; }, 1200);
          setTimeout(() => { state.startupPlaySettled = true; }, STARTUP_SETTLE_MS);
        }
      }
      updateMediaSessionPlaybackState();
      scheduleSync(0);
    } finally {
      state.syncing = false;
    }
  }

  function clearSeekBuffering() {
    state.seekBuffering = false;
    if (state.seekBufferResumeTimer) {
      clearTimeout(state.seekBufferResumeTimer);
      state.seekBufferResumeTimer = null;
    }
  }

  function startSeekBufferWait(forCoupled) {
    const wantedPlaying = state.seekWantedPlaying && state.intendedPlaying;
    if (!wantedPlaying) return false;

    const vNode = getVideoNode();
    const vRS = Number(vNode?.readyState || 0);

    // Also check buffered ranges at the seek position
    const seekPos = Number(video.currentTime()) || 0;
    let hasBufferAtPos = false;
    try {
      const buf = vNode.buffered;
      for (let i = 0; i < buf.length; i++) {
        if (buf.start(i) <= seekPos + 0.2 && buf.end(i) > seekPos) {
          hasBufferAtPos = true;
          break;
        }
      }
    } catch {}

    // If buffer covers the seek position, don't wait — readyState may briefly drop after seek
    if (hasBufferAtPos) return false;
    if (vRS >= HAVE_FUTURE_DATA) return false;

    // Enter seek-buffering state
    state.seekBuffering = true;
    state.strictBufferHold = true;
    if (!state.bufferHoldSince) state.bufferHoldSince = now();
    state.strictBufferReason = forCoupled ? "seek-buffer" : "seek-buffer-nc";
    state.bufferHoldIntendedPlaying = true;
    state.loopPreventionCooldownUntil = now() + 8000;

    let done = false;
    const resume = () => {
      if (done) return;
      done = true;
      try { vNode.removeEventListener("canplay", onReady); } catch {}
      try { vNode.removeEventListener("canplaythrough", onReady); } catch {}
      try { vNode.removeEventListener("playing", onReady); } catch {}
      try { clearTimeout(fallbackTimer); } catch {}
      try { clearInterval(pollTimer); } catch {}
      state.seekBuffering = false;
      state.seekBufferResumeTimer = null;
      state.strictBufferHold = false;
      state.bufferHoldSince = 0;
      state.strictBufferReason = "";
      state.strictBufferHoldFrames = 0;
      state.strictBufferHoldConfirmed = false;
      if (!state.intendedPlaying || state.restarting) return;
      // Final audio sync before resume
      if (coupledMode && audio) {
        const _vt = Number(video.currentTime()) || 0;
        if (isFinite(_vt)) { try { audio.currentTime = _vt; } catch {} }
      }
      if (forCoupled) {
        state.seekResumeInFlight = true;
        state.videoWaiting = false;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        state.audioPauseUntil = 0;
        state.audioEventsSquelchedUntil = 0;
        state.isProgrammaticAudioPause = false;
        playTogether().catch(() => {}).finally(() => { state.seekResumeInFlight = false; });
      } else {
        state.isProgrammaticVideoPlay = true;
        try { video.play(); } catch {}
        try { videoEl.play(); } catch {}
        try {
          const inner = video?.el?.()?.querySelector?.("video");
          if (inner) inner.play().catch(() => {});
        } catch {}
        setTimeout(() => { state.isProgrammaticVideoPlay = false; }, 500);
        updateMediaSessionPlaybackState();
      }
    };
    const onReady = () => {
      const rs = Number(vNode?.readyState || 0);
      if (rs >= HAVE_FUTURE_DATA) resume();
    };
    try { vNode.addEventListener("canplay", onReady, { passive: true }); } catch {}
    try { vNode.addEventListener("canplaythrough", onReady, { passive: true }); } catch {}
    try { vNode.addEventListener("playing", onReady, { passive: true }); } catch {}
    const pollTimer = setInterval(() => {
      if (done) { clearInterval(pollTimer); return; }
      const rs = Number(vNode?.readyState || 0);
      let buffered = false;
      try {
        const pos = Number(video.currentTime()) || 0;
        const buf = vNode.buffered;
        for (let i = 0; i < buf.length; i++) {
          if (buf.start(i) <= pos + 0.1 && buf.end(i) >= pos + 0.2) { buffered = true; break; }
        }
      } catch {}
      if (rs >= HAVE_FUTURE_DATA || buffered) resume();
    }, 300);
    const fallbackTimer = setTimeout(resume, 10000);
    state.seekBufferResumeTimer = fallbackTimer;
    return true;
  }

  async function finalizeSeekSync(currentSeekId) {
    if (!coupledMode) {
      if (state.seekId !== currentSeekId) return;
      const wantedPlaying = state.seekWantedPlaying && state.intendedPlaying;

      // Bridge seeking→seekBuffering with zero gap so no events leak through
      if (wantedPlaying) {
        state.seekBuffering = true;
        state.strictBufferHold = true;
        state.bufferHoldIntendedPlaying = true;
      }

      state.seeking = false;
      state.firstSeekDone = true;
      state.pendingSeekTarget = null;
      state.seekCompleted = true;
      state.seekCooldownUntil = now() + 600;
      setFastSync(2200);

      if (wantedPlaying) {
        if (startSeekBufferWait(false)) return;
        // startSeekBufferWait returned false = buffer already ready. Clear seekBuffering.
        state.seekBuffering = false;
        state.strictBufferHold = false;
        state.bufferHoldSince = 0;
        state.strictBufferReason = "";
        state.strictBufferHoldFrames = 0;
        state.strictBufferHoldConfirmed = false;
        // Always issue play() — video may be paused OR stalled after seek
        state.isProgrammaticVideoPlay = true;
        try { video.play(); } catch {}
        try { videoEl.play(); } catch {}
        try {
          const inner = video?.el?.()?.querySelector?.("video");
          if (inner && inner !== videoEl) inner.play().catch(() => {});
        } catch {}
        setTimeout(() => { state.isProgrammaticVideoPlay = false; }, 500);
      }
      scheduleSync(0);
      return;
    }
    if (state.restarting || !state.seeking || state.seekId !== currentSeekId) return;

    const v = getVideoNode();
    const vtAtFinalize = Number(video.currentTime());

    // Sync audio to exact video position — bypass gate
    if (isFinite(vtAtFinalize) && coupledMode && audio) {
      const atCurrent = Number(audio.currentTime);
      if (Math.abs(atCurrent - vtAtFinalize) > 0.05) {
        state._allowAudioTimeWrite = true;
        try { audio.currentTime = vtAtFinalize; } catch {}
        state._allowAudioTimeWrite = false;
      }
    }

    if (!state.seekWantedPlaying || !state.intendedPlaying) {
      execProgrammaticVideoPause();
      execProgrammaticAudioPause(600);
      if (state.seekId === currentSeekId) {
        state.seeking = false;
        state.firstSeekDone = true;
        state.seekCompleted = true;
        state.audioPlayUntil = 0;
        state.audioPauseUntil = 0;
        state.pendingSeekTarget = null;
        state.seekCooldownUntil = now() + 600;
      }
      return;
    }

    // Wait for readyState ≥ 3 for both tracks simultaneously (parallel, not serial)
    const [vReady, aReady] = await Promise.all([
      waitForReadyStateOrCanPlay(v, 3, SEEK_READY_TIMEOUT_MS),
                                               waitForReadyStateOrCanPlay(audio, 3, SEEK_READY_TIMEOUT_MS)
    ]);

    if (!state.seeking || state.seekId !== currentSeekId) return;
    if (state.pendingSeekTarget != null) state.pendingSeekTarget = null;

    if (!state.seekWantedPlaying || !state.intendedPlaying || mediaSessionForcedPauseActive()) {
      execProgrammaticVideoPause();
      execProgrammaticAudioPause(600);
      if (state.seekId === currentSeekId) {
        state.seeking = false;
        state.firstSeekDone = true;
        state.seekCompleted = true;
        state.audioPlayUntil = 0;
        state.audioPauseUntil = 0;
        state.seekCooldownUntil = now() + 600;
      }
      return;
    }

    if (!(vReady && aReady)) {
      const vtCheck = Number(video.currentTime());
      // Check buffer ranges directly — readyState can briefly drop after seek even when buffered
      const alreadyReady = isFinite(vtCheck) && (bothPlayableAt(vtCheck) ||
        (timeInBuffered(getVideoNode(), vtCheck) && (!audio || timeInBuffered(audio, vtCheck))));
      if (!alreadyReady) {
        // Set seekBuffering BEFORE clearing seeking — no gap for events to sneak through
        state.seekBuffering = true;
        state.strictBufferHold = true;
        state.bufferHoldIntendedPlaying = true;
        if (state.seekId === currentSeekId) {
          state.seeking = false;
          state.firstSeekDone = true;
          state.seekCompleted = true;
          state.seekCooldownUntil = now() + 600;
        }
        startSeekBufferWait(true);
        return;
      }
    }

    state.strictBufferHold = false; state.bufferHoldSince = 0;
    state.strictBufferReason = "";
    state.strictBufferHoldFrames = 0;
    state.strictBufferHoldConfirmed = false;

    // Final position sync before resuming — direct set, bypass gate
    const vt2 = Number(video.currentTime());
    if (isFinite(vt2) && coupledMode && audio) {
      const at2 = Number(audio.currentTime);
      if (Math.abs(at2 - vt2) > 0.05) {
        state._allowAudioTimeWrite = true;
        try { audio.currentTime = vt2; } catch {}
        state._allowAudioTimeWrite = false;
      }
    }

    if (state.seekId !== currentSeekId) return;

    state.seekCooldownUntil = now() + 600;
    setFastSync(2600);

    if (state.seekId === currentSeekId) {
      state.seeking = false;
      state.firstSeekDone = true;
      state.seekCompleted = true;
      state.audioPlayUntil = 0;
      state.audioPauseUntil = 0;
    }

    state.seekResumeInFlight = true;
    try {
      if (state.playRequestedDuringSeek || state.seekWantedPlaying) {
        state.playRequestedDuringSeek = false;
        state.seekWantedPlaying = false;
        // Aggressively clear all blocking state before audio restart
        state.videoWaiting = false;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        state.audioPauseUntil = 0;
        state.audioEventsSquelchedUntil = 0;
        state.isProgrammaticAudioPause = false;
        state.audioPausedSince = 0;
        state.audioPlayGeneration++;
        state.strictBufferHold = false;
        state.bufferHoldSince = 0;
        state.strictBufferReason = "";
        state.strictBufferHoldFrames = 0;
        state.strictBufferHoldConfirmed = false;
        state.audioPlayUntil = 0; // also clear audio play fence
        state.startupAudioHoldUntil = 0; // clear startup hold
        state.stateChangeCooldownUntil = 0; // clear cooldown
        state.audioFadeCompleteUntil = 0; // clear fade wait
        cancelActiveFade();
        await ensureUnmutedIfNotUserMuted().catch(() => {});
        if (state.seekId === currentSeekId || !state.seeking) {
          await playTogether().catch(() => {});
        }
      }
      // Post-seek audio guarantee with aggressive retry windows
      const _seekGuaranteeSession = state.playSessionId;
      [100, 250, 500, 900, 1500, 2500].forEach(delay => {
        setTimeout(() => {
          if (state.playSessionId !== _seekGuaranteeSession) return;
          if (!state.intendedPlaying || state.seeking || state.restarting) return;
          if (!coupledMode || !audio) return;
          if (!audio.paused || getVideoPaused()) return;
          if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
          state.audioEventsSquelchedUntil = 0;
          state.isProgrammaticAudioPause = false;
          state.audioPauseUntil = 0;
          state.videoStallAudioPaused = false;
          state.stallAudioResumeHoldUntil = 0;
          const vt = Number(video.currentTime()) || 0;
          state._allowAudioTimeWrite = true;
          try { if (isFinite(vt)) audio.currentTime = vt; } catch {}
          state._allowAudioTimeWrite = false;
          execProgrammaticAudioPlay({ squelchMs: 300, force: true, minGapMs: 0 })
          .then(ok => { if (ok) softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {}); })
          .catch(() => {});
        }, delay);
      });
      scheduleSync(0);
    } finally {
      state.seekResumeInFlight = false;
    }
  }

  function scheduleSeekFinalize(delay = 0, seekId) {
    clearSeekSyncFinalizeTimer();
    state.seekFinalizeTimer = setTimeout(() => {
      state.seekFinalizeTimer = null;
      finalizeSeekSync(seekId).catch(() => {});
    }, delay);
  }

  function wantsStartupAutoplay() {
    try {
      const q = (qs.get("autoplay") || "").toLowerCase();
      if (q === "1" || q === "true" || q === "yes") return true;
    } catch {}
    try { if (window.forceAutoplay === true) return true; } catch {}
    try { if (videoEl?.autoplay || videoEl?.hasAttribute?.("autoplay")) return true; } catch {}
    try {
      if (typeof video.autoplay === "function") {
        const a = video.autoplay();
        if (a === true || a === "play" || a === "muted" || a === "any") return true;
      }
    } catch {}
    return false;
  }

  function startupAutoplayPauseGraceActive() {
    return wantsStartupAutoplay() &&
    !state.firstPlayCommitted &&
    (now() - state.startupPrimeStartedAt) < 4000;
  }

  function startupBufferReadyLoose() {
    if (!coupledMode) return true;
    if (document.visibilityState === "hidden" || !isWindowFocused()) return true;
    const t0 = Number(video.currentTime()) || 0;
    const vNode = getVideoNode();
    const vOk = Number(vNode.readyState || 0) >= 2 || canPlayAt(vNode, t0);
    const aOk = canStartAudioAt(t0);
    return vOk && aOk;
  }

  function bothReadyForStartupKick() {
    if (!coupledMode) return true;
    if (document.visibilityState === "hidden" || !isWindowFocused()) return true;
    const t0 = Number(video.currentTime()) || 0;
    const vNode = getVideoNode();
    const vRS = Number(vNode.readyState || 0);
    const aRS = Number(audio ? audio.readyState : 0);

    if (vRS >= HAVE_FUTURE_DATA && aRS >= HAVE_FUTURE_DATA) return true;
    if (vRS >= 2 && aRS >= 2 && canPlayAt(vNode, t0) && canStartAudioAt(t0)) return true;
    return false;
  }

  function scheduleStartupAutoplayKick() {
    if (!coupledMode) return;
    if (state.startupKickDone || state.startupKickInFlight || state.firstPlayCommitted) return;
    if (!state.startupPrimed) return;
    if (!wantsStartupAutoplay() && !state.intendedPlaying) return;
    if (mediaSessionForcedPauseActive()) return;
    if (!pageLoadedForAutoplay()) return;
    if (state.bgResumeInFlight) return;

    state.startupKickInFlight = true;
    clearStartupAutoplayRetryTimer();
    setTimeout(async () => {
      try {
        if (!state.startupPrimed || mediaSessionForcedPauseActive() || state.firstPlayCommitted) return;

        if (!bothReadyForStartupKick()) {
          state.startupKickInFlight = false;
          scheduleStartupAutoplayRetry();
          return;
        }

        clearMediaSessionForcedPause();
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        state.strictBufferHold = false; state.bufferHoldSince = 0;
        state.strictBufferReason = "";
        state.strictBufferHoldFrames = 0;
        state.strictBufferHoldConfirmed = false;
        state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 3000);
        updateMediaSessionPlaybackState();
        setPauseEventGuard(1800);
        setMediaPlayTxn(2200);
        setFastSync(2600);

        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
        state.startupPlaySettled = false;

        forceZeroBeforeFirstPlay();

        await playTogether().catch(() => {});

        const isEffectivelyPaused = coupledMode ? (getVideoPaused() && !!audio.paused) : getVideoPaused();

        if (isEffectivelyPaused) {
          if (!state.strictBufferHold) {
            state.resumeOnVisible = false;
            scheduleStartupAutoplayRetry();
          }
          return;
        }

        state.startupKickDone = true;
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          setTimeout(() => { state.startupPhase = false; }, 1200);
        }
        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
      } finally {
        state.startupKickInFlight = false;
      }
    }, 0);
  }

  function scheduleStartupAutoplayRetry() {
    if (state.startupKickDone || state.startupKickInFlight || state.firstPlayCommitted) return;
    if (!state.intendedPlaying && !wantsStartupAutoplay()) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;
    if (!pageLoadedForAutoplay()) return;

    clearStartupAutoplayRetryTimer();
    const count = state.startupAutoplayRetryCount;
    if (count >= 20) return;
    // Cap index at array length to avoid undefined delay falling through to || 5000 wrong index
    const delays = [150, 300, 500, 900, 1500, 2000, 2500, 3000, 4000, 5000];
    const delay = delays[Math.min(count, delays.length - 1)];
    state.startupAutoplayRetryCount++;
    state.startupAutoplayRetryTimer = setTimeout(async () => {
      state.startupAutoplayRetryTimer = null;
      if (state.startupKickDone || state.startupKickInFlight || state.firstPlayCommitted) return;
      if (!state.intendedPlaying && !wantsStartupAutoplay()) return;
      if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;
      if (state.bgResumeInFlight) {
        scheduleStartupAutoplayRetry();
        return;
      }

      const hasLooseBuffer = startupBufferReadyLoose();

      if (!hasLooseBuffer) {
        scheduleStartupAutoplayRetry();
        return;
      }
      // If we just returned to the tab (tab is visible, retry count was reset),
      // always reset the startupPrimed state to allow kick to fire immediately.
      if (document.visibilityState === "visible" && !state.startupPrimed) {
        maybePrimeStartup();
        if (!state.startupPrimed) {
          scheduleStartupAutoplayRetry();
          return;
        }
      }
      state.startupKickInFlight = true;
      try {
        clearMediaSessionForcedPause();
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        state.strictBufferHold = false; state.bufferHoldSince = 0;
        state.strictBufferReason = "";
        state.strictBufferHoldFrames = 0;
        state.strictBufferHoldConfirmed = false;
        state.startupPrimed = true;
        state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 3000);
        if (!coupledMode) MediumQualityManager.markUserPlayed();
        updateMediaSessionPlaybackState();
        setPauseEventGuard(1800);
        setMediaPlayTxn(2200);
        setFastSync(2600);

        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
        state.startupPlaySettled = false;

        forceZeroBeforeFirstPlay();

        await playTogether().catch(() => {});

        const isEffectivelyPaused = coupledMode ? (getVideoPaused() && !!audio.paused) : getVideoPaused();

        if (isEffectivelyPaused) {
          if (!state.strictBufferHold) {
            state.resumeOnVisible = false;
            scheduleStartupAutoplayRetry();
          }
          return;
        }

        state.startupKickDone = true;
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          setTimeout(() => { state.startupPhase = false; }, 1200);
        }
        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
      } finally {
        state.startupKickInFlight = false;
      }
    }, delay);
  }

  function maybePrimeStartup() {
    if (!coupledMode) return;
    if (state.restarting || state.startupPrimed) return;
    if (!pageLoadedForAutoplay()) return;
    const t0 = Number(video.currentTime()) || 0;
    const primeWait = now() - state.startupPrimeStartedAt;
    const inBg = document.visibilityState === "hidden" || !isWindowFocused();
    if (!bothStartupBufferedAt(t0)) {
      const bgReady = inBg;
      const looseReady = canPlayAt(getVideoNode(), t0) && canStartAudioAt(t0);
      if (!bgReady && !(looseReady && primeWait > 1800)) {
        state.strictBufferHold = true;
        if (!state.bufferHoldSince) state.bufferHoldSince = now();
        state.strictBufferReason = "startup-buffer";
        return;
      }
    }
    state.startupPrimed = true;
    state.strictBufferHold = false; state.bufferHoldSince = 0;
    state.strictBufferReason = "";
    state.strictBufferHoldFrames = 0;
    state.strictBufferHoldConfirmed = false;
    state.firstSeekDone = true;
    const t = Number(video.currentTime());
    const at = Number(audio.currentTime);
    if (isFinite(t) && isFinite(at) && Math.abs(at - t) > 0.15) {
      safeSetAudioTime(t);
    }
    softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
    if (bothReadyForStartupKick()) {
      scheduleStartupAutoplayKick();
    } else {
      scheduleStartupAutoplayRetry();
    }
    setTimeout(() => {
      if (!state.firstPlayCommitted) state.startupPhase = false;
    }, 3500);
  }

  function evaluateBufferHoldNeed(vt, at) {
    if (!state.intendedPlaying || state.seeking || state.syncing) return false;
    if (!state.audioEverStarted && state.startupPhase) return false;
    if (startupSettleActive()) return false;
    if (document.visibilityState === "hidden" || !isWindowFocused()) return false;
    const checkTime = Math.max(vt, at || 0);
    const vNode = getVideoNode();
    const aNeedsBuffer = !canPlaySmoothAt(audio, checkTime, STRICT_BUFFER_AHEAD_SEC);
    const vLacksData = !canPlaySmoothAt(vNode, checkTime, STRICT_BUFFER_AHEAD_SEC);
    const isSuspended = getVideoPaused();
    const vNeedsBuffer = vLacksData || (!isSuspended && state.videoWaiting);
    if (vNeedsBuffer || aNeedsBuffer) {
      state.strictBufferHoldFrames = (state.strictBufferHoldFrames || 0) + 1;
      if (state.strictBufferHoldFrames >= 2) {
        state.strictBufferHoldConfirmed = true;
        return true;
      }
      return false;
    } else {
      state.strictBufferHoldFrames = 0;
      state.strictBufferHoldConfirmed = false;
      return false;
    }
  }

  async function runSync() {
    state.syncTimer = null;
    state.syncScheduledAt = 0;
    enforcePlaybackRateSync();

    // PAGE-LOAD GATE: never attempt autoplay-driven startup before window.load.
    if (!pageLoadedForAutoplay() && !state.firstPlayCommitted && wantsStartupAutoplay()) {
      scheduleSync();
      return;
    }

    if (!coupledMode) {
      // Keep audio silent in non-coupled mode
      if (audio && !audio.paused) {
        try { audio.muted = true; audio.volume = 0; audio.pause(); } catch {}
      }
      // MQM enforcement -- if user paused, force video paused and stop sync
      if (MediumQualityManager.intentPaused && state.firstPlayCommitted) {
        if (!getVideoPaused()) execProgrammaticVideoPause();
        state.intendedPlaying = false;
        scheduleSync();
        return;
      }
      // Non-coupled: if intendedPlaying but video somehow stopped, restart it.
      // Guards: don't restart during user-initiated pauses, background transitions,
      // or when a seek/sync operation is in flight.
      if (state.intendedPlaying && getVideoPaused() &&
        !state.seekBuffering && !state.seeking &&
        !userPauseLockActive() && !userPauseIntentActive() &&
        !mediaSessionForcedPauseActive() &&
        !BackgroundPlaybackManager.shouldSuppressAutoPause() &&
        !MediumQualityManager.shouldBlockAutoResume() &&
        state.userPauseIntentPresetAt === 0 &&
        !state.userGesturePauseIntent) {
        // Triple-guard for non-coupled auto-resume
        if (!MediumQualityManager.intentPaused &&
          (now() - state.lastUserActionTime) > 2000) {
          try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
          }
        }
        scheduleSync();
        return;
    }
    if (state.restarting) {
      scheduleSync(); return;
    }
    const vtRaw = Number(video.currentTime());
    const atRaw = Number(audio.currentTime);
    if (!isFinite(vtRaw) || !isFinite(atRaw)) {
      scheduleSync(); return;
    }
    let vt = vtRaw;
    let at = atRaw;
    const vPaused = getVideoPaused();
    const aPaused = !!audio.paused;

    // Audio must never play when video is paused (except during tab-return immunity)
    if (!BringBackToTabManager.isLocked() && !state.seekBuffering && !(state.tabReturnImmuneUntil > now())) {
      if (!aPaused && vPaused && !isHiddenBackground() && !state.intendedPlaying) {
        execProgrammaticAudioPause(100);
      } else if (!aPaused && vPaused && !isHiddenBackground() &&
        !state.strictBufferHold && !state.videoWaiting &&
        !state.seeking && !state.syncing &&
        !state.bgPlaybackAllowed) {
        execProgrammaticAudioPause(100);
        }
    }

    const inBgDrift = document.visibilityState === "hidden" || !isWindowFocused() || inBgReturnGrace();
    // inBgReturnGrace: suppress all drift-correction seeks for 8s after tab return so the
    // wakeup timer (seamlessBgCatchUp) can handle position sync without racing runSync.
    const skipDrift = now() < state.seekCooldownUntil;

    if (!vPaused && vt > 0 && getVideoReadyState() >= HAVE_FUTURE_DATA) {
      // Only clear videoWaiting when the browser has decoded enough to sustain playback.
      // readyState < 3 means the browser is running on fumes — clearing here would let
      // audio restart before video re-fires "waiting", causing the audio-while-buffering gap.
      state.videoWaiting = false;
    }

    // Guard with !state.startupKickInFlight so this path never races with
    if (state.intendedPlaying && !vPaused && vt > 0.5) {
      if (!state.firstPlayCommitted && !state.startupKickInFlight) {
        state.firstPlayCommitted = true;
        state.startupKickDone = true;
        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
        clearStartupAutoplayRetryTimer();
        setTimeout(() => { state.startupPhase = false; }, 1200);
      }
    }

    if (state.intendedPlaying && !state.restarting && !state.seeking && !state.syncing && !skipDrift) {
      if (state.audioEverStarted && !audio.paused && !inBgDrift) {
        if (Math.abs(at - vt) > 0.25) {
          await quietSeekAudio(vt);
          at = vt;
        }
      }
    }
    if (state.intendedPlaying && !getVideoPaused() && vt > 0.1) {
      updateLastKnownGoodVT();
    }

    if (state.intendedPlaying && !audio.paused && !state.userMutedVideo && !state.userMutedAudio) {
      try { if (audio.muted) audio.muted = false; } catch {}
      if (!state.audioFading) {
        const target = clamp01(targetVolFromVideo());
        if (audio.volume < 0.05 && target > 0.05) {
          softUnmuteAudio(200).catch(() => {});
        } else if (Math.abs(audio.volume - target) > 0.05) {
          updateAudioGainImmediate();
        }
      }
    }

    const needsHold = evaluateBufferHoldNeed(vt, at);
    if (needsHold && !state.strictBufferHold) {
      state.strictBufferHold = true;
      if (!state.bufferHoldSince) state.bufferHoldSince = now();
      state.strictBufferReason = "buffer-starved";
      state.bufferHoldSince = now();
      state.bufferHoldIntendedPlaying = state.intendedPlaying;
      if (!getVideoPaused()) execProgrammaticVideoPause();
      if (!audio.paused) execProgrammaticAudioPause(600);
      resetAudioPlaybackRate();
      armResumeAfterBuffer(10000);
    } else if (!needsHold && state.strictBufferHold) {
      state.strictBufferHold = false; state.bufferHoldSince = 0;
      state.strictBufferReason = "";
      state.strictBufferHoldFrames = 0;
      state.strictBufferHoldConfirmed = false;
      resetAudioPlaybackRate();
      setFastSync(1200);
    }
    const isTransientState = document.visibilityState === "hidden" ||
    !isWindowFocused() ||
    isVisibilityTransitionActive() ||
    isAltTabTransitionActive() ||
    (platform.chromiumOnlyBrowser && chromiumBgPauseBlocked());

    if (state.intendedPlaying && !state.restarting && !state.seeking && !state.syncing) {
      if (state.strictBufferHold) {
        if (!vPaused) execProgrammaticVideoPause();
        if (!aPaused) execProgrammaticAudioPause(500);
      } else if (isTransientState) {
        if (vPaused && aPaused) {
          if (isHiddenBackground()) {
            if (!state.resumeOnVisible) {
              state.resumeOnVisible = true;
            }
            if (state.firstPlayCommitted && state.startupKickDone && !state.bgResumeInFlight &&
              BackgroundPlaybackManagerManager.shouldAttemptBgResume()) {
              seamlessBgCatchUp().catch(() => {});
              }
          } else {
            // Don't schedule a bgResumeRetry if executeSeamlessWakeup is already pending —
            // competing resume attempts produce the visible play→pause stutter on tab return.
            // The wakeup timer handles it with the correct platform delay.
            if (!state.bgResumeInFlight && !state.wakeupTimer) {
              // Notify BPMM of possible browser-forced pause in transition state
              if (BackgroundPlaybackManager.isAnyTransition() && !inBgReturnGrace()) {
                BackgroundPlaybackManagerManager.onBrowserForcedPause();
              }
              scheduleBgResumeRetry(inBgReturnGrace() ? BG_RESUME_MIN_DELAY_CHROMIUM_MS : 400);
            }
          }
        } else if (vPaused && !aPaused) {
          // Audio is playing but video is paused in background/transition.
          if (isHiddenBackground()) {
            // Silent sync: update video.currentTime without triggering seek machinery
            bgSilentSyncVideoTime(at);
            // Also try to restart the video in background (may fail, that's OK)
            if (!state.bgResumeInFlight && !state.isProgrammaticVideoPlay && !state.seeking) {
              // Don't spam — only try if video is significantly behind audio
              if (Math.abs(at - vt) > 1.0) {
                execProgrammaticVideoPlay();
              }
            }
          } else {
            // Tab is being restored (altTab/focus transition): let the return-grace
            if (Math.abs(at - vt) > BIG_DRIFT) bgSilentSyncVideoTime(at);
            if (!state.bgResumeInFlight) {
              scheduleBgResumeRetry(inBgReturnGrace() ? 80 : 200);
            }
          }
        } else if (!vPaused && aPaused) {
          // Video is running but audio paused during a transition — kick audio
          // (only if not in a stall hold — stall recovery is handled via armResumeAfterBuffer)
          const inStallHold = state.videoStallAudioPaused || now() < state.stallAudioResumeHoldUntil;
          if (!inStallHold && !state.bgResumeInFlight && !shouldBlockNewAudioStart() && inBgReturnGrace()) {
            safeSetAudioTime(vt);
            execProgrammaticAudioPlay({ squelchMs: 450, minGapMs: 0, force: true }).catch(() => false);
          }
        }
      } else {
        if (!vPaused && aPaused) {
          const stallHoldActive = state.videoStallAudioPaused || now() < state.stallAudioResumeHoldUntil;
          if (!state.audioPausedSince) state.audioPausedSince = now();
          if (!stallHoldActive && !shouldBlockNewAudioStart() && !state.bgResumeInFlight) {
            safeSetAudioTime(vt);
            execProgrammaticAudioPlay({ squelchMs: 450, minGapMs: 0, force: true }).catch(() => false);
          } else {
            enforceAudioPlayback();
          }
        } else if (!vPaused && !aPaused) {
          // Catch audio playing while video is buffering (videoWaiting set between runSync cycles).
          // This is a safety net — the waiting handler is the primary fix, but runSync
          // provides a ~500ms backstop for any edge case that slips through.
          if (state.videoWaiting && coupledMode && !aPaused) {
            state.videoStallAudioPaused = true;
            state.stallAudioPausedSince = now();
            state.audioPausedSince = 0;
            state.stallAudioResumeHoldUntil = now() + MIN_STALL_AUDIO_RESUME_MS;
            cancelActiveFade();
            state.isProgrammaticAudioPause = true;
            state.audioPlayGeneration++;
            squelchAudioEvents(5200);
            state.audioPauseUntil = Math.max(state.audioPauseUntil, now() + 5000);
            try { audio.volume = 0; audio.pause(); } catch {}
            setTimeout(() => { state.isProgrammaticAudioPause = false; }, 500);
          }
          state.audioPausedSince = 0;
          state.videoSyncRetryTs = 0;
        } else if (vPaused && !aPaused) {
          if (!state.videoSyncRetryTs) state.videoSyncRetryTs = now();
          if (!state.isProgrammaticVideoPlay && !mediaPlayTxnActive() && !chromiumPauseGuardActive()) {
            execProgrammaticVideoPlay();
            if ((now() - state.videoSyncRetryTs) > 800) {
              execProgrammaticAudioPause(600);
              state.videoSyncRetryTs = 0;
            }
          }
        } else if (vPaused && aPaused) {
          if (!inMediaTxnWindow() && !userPauseLockActive() && !chromiumPauseGuardActive() && !state.bgResumeInFlight && !state.seekResumeInFlight) {
            if (isHiddenBackground()) {
              state.resumeOnVisible = true;
            } else {
              // Sync audio position to video before resuming both to avoid A/V drift pop
              if (isFinite(vt) && isFinite(at) && Math.abs(at - vt) > 0.25) {
                safeSetAudioTime(vt);
              }
              playTogether().catch(() => {});
            }
          }
        } else {
          if (skipDrift) {
            // in seek cooldown
          } else {
            const drift = vt - at;
            const absDrift = Math.abs(drift);
            const activeBigDrift = inBgDrift ? BIG_DRIFT_BACKGROUND : BIG_DRIFT;
            if (absDrift > activeBigDrift) {
              resetAudioPlaybackRate();
              // Big drift: video is authoritative in foreground; seek audio to video
              await quietSeekAudio(vt);
              resetAudioPlaybackRate();
              state.driftStableFrames = 0;
              setFastSync(1600);
            } else if (absDrift > 0.5 && !inBgDrift) {
              await quietSeekAudio(vt);
              resetAudioPlaybackRate();
              state.driftStableFrames = 0;
              setFastSync(1200);
            } else if (absDrift > MICRO_DRIFT) {
              const sameDirection = (drift > 0) === (state.lastDrift > 0);
              if (sameDirection) state.driftStableFrames = (state.driftStableFrames || 0) + 1;
              else state.driftStableFrames = 0;
              state.lastDrift = drift;
              if (state.driftStableFrames >= DRIFT_PERSIST_CYCLES) {
                enforcePlaybackRateSync();
                const baseRate = Number(video.playbackRate()) || 1;
                const nudge = Math.max(-MAX_RATE_NUDGE, Math.min(MAX_RATE_NUDGE, drift * 0.02));
                try {
                  audio.playbackRate = baseRate + nudge;
                  state.audioRateNudgeActive = true;
                  state.audioRateNudgeUntil = now() + 900;
                } catch {}
              }
            } else {
              if (state.audioRateNudgeActive && now() > state.audioRateNudgeUntil) {
                resetAudioPlaybackRate();
              }
              state.syncConvergenceCount = (state.syncConvergenceCount || 0) + 1;
              if (state.syncConvergenceCount >= 8) resetAudioPlaybackRate();
            }
          }
        }
      }
    } else if (!state.intendedPlaying && !state.restarting && !state.seeking && !state.syncing) {
      if (!vPaused) execProgrammaticVideoPause();
      if (!aPaused) {
        state.isProgrammaticAudioPause = true;
        if (audio.volume > 0.015) {
          fadeAndPauseAudio(AUDIO_FADE_DURATION_MS, () => {
            setTimeout(() => { state.isProgrammaticAudioPause = false; }, 200);
          });
        } else {
          cancelActiveFade();
          try { audio.pause(); } catch {}
          setTimeout(() => { state.isProgrammaticAudioPause = false; }, 300);
        }
      }
    }
    maybeUpdateMediaSessionPosition(vt);

    // Audio stall detection
    if (!aPaused && state.intendedPlaying) {
      if (Math.abs(at - state.lastAT) > 0.002) {
        state.lastAT = at;
        state.audioLastProgressTs = now();
        state.audioStallSince = 0;
      } else {
        if (!state.audioLastProgressTs) state.audioLastProgressTs = now();
        const canKickAudio =
        !state.seeking && !state.syncing &&
        !mediaActionLocked() && !state.strictBufferHold &&
        !state.videoWaiting && !state.videoStallAudioPaused &&
        now() >= state.stallAudioResumeHoldUntil &&
        now() >= state.audioKickCooldownUntil &&
        !userPauseLockActive() && !shouldBlockNewAudioStart();
        if (canKickAudio && (now() - state.audioLastProgressTs) > 3500) {
          state.audioKickCooldownUntil = now() + 3800;
          kickAudio().catch(() => {});
          state.audioLastProgressTs = now();
        }
      }
    } else {
      state.lastAT = at;
      state.audioLastProgressTs = now();
      state.audioStallSince = 0;
    }

    // Video stall detection - extended to all platforms, not just mobile
    if (state.intendedPlaying && !vPaused) {
      if (Math.abs(vt - state.lastVT) < 0.001) {
        if (state.videoStallSince === 0) state.videoStallSince = now();
        // Was `!state.userPauseLockActive` (wrong - accessing non-existent property), now correct function call
        const shouldRepair =
        (now() - state.lastVTts) > VIDEO_STALL_TIMEOUT_MS &&
        !state.videoRepairing &&
        now() < state.stallRecoveryUntil === false &&
        getVideoReadyState() >= 2 &&
        !state.strictBufferHold &&
        !userPauseLockActive() &&
        document.visibilityState === "visible";
        if (shouldRepair) {
          state.stallRecoveryUntil = now() + STALL_RECOVERY_COOLDOWN_MS;
          kickVideo().catch(() => {});
          state.lastVTts = now();
          state.videoStallSince = 0;
        }
      } else {
        state.lastVT = vt;
        state.lastVTts = now();
        state.videoStallSince = 0;
      }
    } else {
      state.lastVT = vt;
      state.lastVTts = now();
      state.videoStallSince = 0;
    }
    scheduleSync();
  }

  // --- heartbeat: detects device sleep/wake, persistent stalls, and state inconsistency
  function setupHeartbeat() {
    state.lastHeartbeatAt = now();
    const beat = () => {
      const nowTs = now();
      const elapsed = nowTs - state.lastHeartbeatAt;
      state.lastHeartbeatAt = nowTs;

      // --- loop attribute enforcement
      if (!isLoopDesired()) {
        try { if (videoEl.loop) { videoEl.loop = false; videoEl.removeAttribute("loop"); } } catch {}
        try { if (audio && audio.loop) { audio.loop = false; audio.removeAttribute("loop"); } } catch {}
      }

      // --- non-coupled MQM enforcement
      // If user paused in non-coupled mode, ensure video stays paused every heartbeat.
      // This catches any async path that restarted video between heartbeat ticks.
      if (!coupledMode && MediumQualityManager.intentPaused && state.firstPlayCommitted) {
        if (!getVideoPaused()) { execProgrammaticVideoPause(); }
        state.intendedPlaying = false;
      }

      // --- BPM stable-audio tracking
      if (coupledMode && audio && !audio.paused && state.intendedPlaying &&
        !state.videoWaiting && !state.videoStallAudioPaused) {
        BackgroundPlaybackManager.markAudioPlayingStable();
        } else {
          BackgroundPlaybackManager.markAudioNotPlaying();
        }

        // Detect device wakeup from sleep (large heartbeat gap means the JS was frozen)
        if (elapsed > WAKE_DETECT_THRESHOLD_MS) {
          state.lastBgReturnAt = nowTs;
          VisibilityGuard.onTabShow(); // VG: device wake = tab return, extend grace window
          if (platform.chromiumOnlyBrowser) {
            setChromiumBgPauseBlock(CHROMIUM_BG_PAUSE_BLOCK_MS);
            setChromiumPauseEventSuppress(BG_RETURN_GRACE_MS);
            setChromiumAutoPauseBlock(BG_RETURN_GRACE_MS);
            state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, nowTs + 2000);
          }
          state.pauseEventCount = 0;
          state.pauseEventResetAt = nowTs;
          if (state.intendedPlaying) {
            state.resumeOnVisible = true;
            executeSeamlessWakeup();
          }
        }

        // Consistency check: if intendedPlaying but both paused for a suspiciously long time
        // and we're in a stable visible+focused context → force resume
        if (
          state.intendedPlaying &&
          !state.seeking && !state.syncing && !state.restarting &&
          !state.strictBufferHold && !state.videoWaiting &&
          !userPauseLockActive() && !mediaSessionForcedPauseActive() &&
          !inMediaTxnWindow() && !inBgReturnGrace() &&
          !isVisibilityTransitionActive() && !isAltTabTransitionActive() &&
          document.visibilityState === "visible" && isWindowFocused() &&
          isVisibilityStable() && isFocusStable() &&
          now() >= state.tabVisibilityChangeUntil &&
          (nowTs - state.lastConsistencyCheckAt) > CONSISTENCY_CHECK_MIN_INTERVAL_MS
        ) {
          state.lastConsistencyCheckAt = nowTs;
          const vPaused = getVideoPaused();
          const aPaused = coupledMode ? (audio ? !!audio.paused : true) : false;
          const bothPaused = vPaused && (coupledMode ? aPaused : true);

          if (bothPaused && (nowTs - state.lastUserActionTime) > 3000 &&
            !MediumQualityManager.shouldBlockAutoResume() &&
            !MediumQualityManager.intentPaused &&
            !state.userGesturePauseIntent) {
            state.consistencyCheckPendingPlayUntil = nowTs + 2000;
          playTogether().catch(() => {});
            }
        }

        // Enhanced background sync with aggressive retry
        if (state.intendedPlaying && isHiddenBackground() && !state.seeking) {
          const aPausedBg = audio ? !!audio.paused : true;
          const vPausedBg = getVideoPaused();
          if (!aPausedBg && vPausedBg && !state.bgSilentTimeSyncing) {
            const atBg = Number(audio.currentTime);
            if (isFinite(atBg) && atBg > 0.1) bgSilentSyncVideoTime(atBg);
            if (!state.isProgrammaticVideoPlay && !state.bgResumeInFlight) {
              try { const vn = getVideoNode(); if (vn) vn.play().catch(() => {}); } catch {}
            }
          } else if (aPausedBg && vPausedBg && !state.bgResumeInFlight &&
            BackgroundPlaybackManagerManager.shouldAttemptBgResume() &&
            now() >= state.bgCatchUpCooldownUntil &&
            !userPauseLockActive() && !mediaSessionForcedPauseActive()) {
            seamlessBgCatchUp().catch(() => {});
            } else if (!aPausedBg && !vPausedBg) {
              const atSync = Number(audio.currentTime);
              const vtSync = Number(video.currentTime());
              if (isFinite(atSync) && isFinite(vtSync) && Math.abs(atSync - vtSync) > 3.0 &&
                !state.bgSilentTimeSyncing) {
                bgSilentSyncVideoTime(atSync);
                }
            }
        }
        if (!coupledMode && state.intendedPlaying && isHiddenBackground() &&
          getVideoPaused() && !state.seeking && !state.bgResumeInFlight &&
          !userPauseLockActive() && !mediaSessionForcedPauseActive() &&
          !MediumQualityManager.shouldBlockAutoResume() &&
          !MediumQualityManager.intentPaused) {
          try {
            VisibilityGuard.onPlayCalled();
            const vn = getVideoNode();
            if (vn) vn.play().catch(() => {});
          } catch {}
          }

          // Stuck buffer hold recovery: if strictBufferHold has been active for too long
          // but video actually reports it's ready, force-clear it and attempt resume.
          // This fixes "buffered in bar but won't play" when audio buffering is slower than video.
          if (state.strictBufferHold && state.intendedPlaying && !state.seeking && !state.restarting &&
            document.visibilityState === "visible" && state.bufferHoldSince > 0) {
            const holdDuration = nowTs - state.bufferHoldSince;
          const videoNode = getVideoNode();
          const videoActuallyReady = Number(videoNode.readyState || 0) >= HAVE_FUTURE_DATA;
          // Force-clear after BUFFER_HOLD_MAX_MS regardless, or after 6s if video is ready
          if (holdDuration > BUFFER_HOLD_MAX_MS || (holdDuration > 6000 && videoActuallyReady)) {
            state.strictBufferHold = false; state.bufferHoldSince = 0;
            state.strictBufferReason = "";
            state.strictBufferHoldFrames = 0;
            state.strictBufferHoldConfirmed = false;
            state.videoStallAudioPaused = false;
            state.stallAudioPausedSince = 0;
            state.stallAudioResumeHoldUntil = 0;
            clearResumeAfterBufferTimer();
            if (!inMediaTxnWindow() && !userPauseLockActive()) {
              playTogether().catch(() => {});
            }
          }
            }

            // --- stall watchdog
            if (coupledMode && state.videoStallAudioPaused && state.intendedPlaying &&
              !state.seeking && !state.syncing && !state.restarting &&
              state.stallAudioPausedSince > 0 &&
              (nowTs - state.lastStallWatchdogAt) > STALL_WATCHDOG_CHECK_INTERVAL_MS) {
              state.lastStallWatchdogAt = nowTs;
            const stallDuration = nowTs - state.stallAudioPausedSince;
            const vNodeWd = getVideoNode();
            const vRSWd = Number(vNodeWd.readyState || 0);
            const videoPlayingFine = !getVideoPaused() && !state.videoWaiting && vRSWd >= MIN_STALL_VIDEO_RS;
            if (stallDuration > STALL_WATCHDOG_MS || (stallDuration > 2000 && videoPlayingFine)) {
              // Stall held too long — video is fine, audio just got stuck
              state.videoStallAudioPaused = false;
              state.stallAudioPausedSince = 0;
              state.stallAudioResumeHoldUntil = 0;
              if (document.visibilityState === "visible" && isWindowFocused() &&
                state.intendedPlaying && !userPauseLockActive() && !shouldBlockNewAudioStart()) {
                const vtWd = Number(video.currentTime()) || 0;
              safeSetAudioTime(vtWd);
              execProgrammaticAudioPlay({ squelchMs: 400, force: true, minGapMs: 0 })
              .then(ok => { if (ok) softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {}); })
              .catch(() => {});
                }
            }
              }

              // Orphaned A/V enforcement: if in foreground and one track is playing without the other,
              // and it's not a deliberate state (seeking, syncing, stall, etc.), resolve it.
              if (coupledMode && state.intendedPlaying && !state.seeking && !state.syncing && !state.restarting &&
                !state.strictBufferHold && !state.videoWaiting && !state.videoStallAudioPaused &&
                now() >= state.stallAudioResumeHoldUntil && !inBgReturnGrace() &&
                document.visibilityState === "visible" && isWindowFocused() &&
                isVisibilityStable() && !isVisibilityTransitionActive() && !isAltTabTransitionActive()) {
                const vPausedHb = getVideoPaused();
              const aPausedHb = audio ? !!audio.paused : true;
              if (!vPausedHb && aPausedHb && !state.seeking && !state.restarting && !state.syncing) {
                // Video playing but audio stuck — use enforceAudioPlayback (has stuck-timer bypass)
                enforceAudioPlayback();
              } else if (!vPausedHb && aPausedHb && !shouldBlockNewAudioStart()) {
                // Video playing without audio — check readyState before restarting audio
                const vNodeHb = getVideoNode();
                if (Number(vNodeHb.readyState || 0) >= MIN_STALL_VIDEO_RS) {
                  const vtHb = Number(video.currentTime()) || 0;
                  safeSetAudioTime(vtHb);
                  execProgrammaticAudioPlay({ squelchMs: 400, force: true, minGapMs: 0 }).catch(() => {});
                }
              } else if (vPausedHb && !aPausedHb && !state.isProgrammaticAudioPlay) {
                // Audio playing without video — restart video
                if (!mediaPlayTxnActive() && !chromiumPauseGuardActive()) {
                  execProgrammaticVideoPlay();
                }
              }
                }

                // --- PlaybackStabilityManager check
                // Runs every heartbeat to detect and correct state mismatches between
                // intended play state and actual video play state. Rate-limited internally.
                if (state.firstPlayCommitted && !state.startupPhase &&
                  !MediumQualityManager.shouldBlockAutoResume() &&
                  !MediumQualityManager.intentPaused) {
                  PlaybackStabilityManager.check(
                    state,
                    getVideoPaused,
                    execProgrammaticVideoPlay,
                    execProgrammaticVideoPause
                  );
                  }

                  // --- UltraStabilizer heartbeat tick
                  // Runs all 14 stabilization subsystems (buffer health, drift supervisor,
                  // stall recovery, silence guard, readyState watcher, rate guard, etc.)
                  try { UltraStabilizer.tick(); } catch {}

                  state.heartbeatTimer = setTimeout(beat, HEARTBEAT_INTERVAL_MS);
    };
    state.heartbeatTimer = setTimeout(beat, HEARTBEAT_INTERVAL_MS);
  }

  // --- iOS AudioContext unlock (must be called from a user gesture)
  function tryUnlockAudioContext() {
    if (state.audioContextUnlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      if (ctx.state === "running") {
        state.audioContextUnlocked = true;
        ctx.close().catch(() => {});
        return;
      }
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.resume().then(() => {
        state.audioContextUnlocked = true;
        ctx.close().catch(() => {});
      }).catch(() => {
        try { ctx.close(); } catch {}
      });
    } catch {}
  }

  // --- media error recovery
  function setupMediaErrorHandlers() {
    const onVideoError = (e) => {
      if (!state.intendedPlaying || state.restarting) return;
      if (now() < state.mediaErrorCooldownUntil) return;
      state.mediaErrorCount++;
      state.mediaErrorCooldownUntil = now() + 4000;
      // Soft recovery: re-arm buffer wait
      if (state.mediaErrorCount <= 3) {
        armResumeAfterBuffer(8000);
      }
    };
    const onAudioError = (e) => {
      if (!coupledMode || !audio) return;
      if (!state.intendedPlaying || state.restarting) return;
      if (now() < state.mediaErrorCooldownUntil) return;
      state.mediaErrorCount++;
      state.mediaErrorCooldownUntil = now() + 4000;
      if (state.mediaErrorCount <= 3) {
        setTimeout(() => {
          if (state.intendedPlaying && !state.restarting) kickAudio().catch(() => {});
        }, 500);
      }
    };
    try { videoEl.addEventListener("error", onVideoError, { passive: true }); } catch {}
    if (audio) {
      try { audio.addEventListener("error", onAudioError, { passive: true }); } catch {}
    }
    // Stalled event: browser ran out of data and stalled the decode
    const onVideoStalled = () => {
      if (!state.intendedPlaying) return;
      state.videoWaiting = true;
      scheduleSync(200);
    };
    const onAudioStalled = () => {
      try { UltraStabilizer.onAudioStall(); } catch {}
      if (!coupledMode || !state.intendedPlaying) return;
      scheduleSync(200);
    };
    try { videoEl.addEventListener("stalled", onVideoStalled, { passive: true }); } catch {}
    if (audio) {
      try { audio.addEventListener("stalled", onAudioStalled, { passive: true }); } catch {}
    }
    // Network online recovery
    window.addEventListener("online", () => {
      state.networkOnline = true;
      state.mediaErrorCount = 0;
      state.mediaErrorCooldownUntil = 0;
      try { UltraStabilizer.onNetworkOnline(); } catch {}
      if (state.intendedPlaying && document.visibilityState === "visible") {
        setTimeout(() => {
          if (state.intendedPlaying && !state.restarting) playTogether().catch(() => {});
        }, 800);
      }
    }, { passive: true });
    window.addEventListener("offline", () => {
      state.networkOnline = false;
      try { UltraStabilizer.onNetworkOffline(); } catch {}
    }, { passive: true });
  }

  function setupUserPauseIntentDetection() {
    const root = video?.el?.() || videoEl || document;
    let pendingTechTogglePausedState = null;
    const getTargetEl = target => {
      try { return target && target.nodeType === 1 ? target : null; } catch {}
      return null;
    };
    const isPrimaryActivation = event => {
      try {
        if (event?.type === "pointerdown") {
          if (event.isPrimary === false) return false;
          if (event.pointerType === "mouse" && typeof event.button === "number" && event.button !== 0) return false;
        } else if (event?.type === "mousedown") {
          if (typeof event.button === "number" && event.button !== 0) return false;
        }
      } catch {}
      return true;
    };
    const isPlayControlTarget = target => {
      try {
        const el = getTargetEl(target);
        return !!el?.closest?.(".vjs-play-control, .vjs-big-play-button");
      } catch {}
      return false;
    };
    const isTechSurfaceTarget = target => {
      try {
        const el = getTargetEl(target);
        if (!el) return false;
        if (el.closest?.(".vjs-control-bar, .vjs-menu, .vjs-menu-content, .vjs-slider, .vjs-control")) return false;
        return !!el.closest?.(".vjs-tech, video");
      } catch {}
      return false;
    };
    const onPressStart = event => {
      if (!isPrimaryActivation(event)) return;
      // Unlock AudioContext on first user gesture (critical for iOS)
      tryUnlockAudioContext();
      // IMMEDIATELY record the action time. This is critical for non-coupled mode (quality=medium):
      // the media play/pause event fires before the RAF in onClick sets the intent markers,
      // so the play handler must see a recent lastUserActionTime to allow the event through.
      state.lastUserActionTime = now();
      // Track user clicks for spam detection (only deliberate pointer events count).
      // This is the ONLY place we track clicks for audio spam protection.
      if (isPlayControlTarget(event.target) || isTechSurfaceTarget(event.target)) {
        trackUserClickForSpam();
      }
      // Pre-set user intent presets immediately on every pointer event.
      // These are consumed by video.on('play'/'pause') for bulletproof intent
      // detection regardless of visibility/transition state (fixes quality=medium).
      if (!getVideoPaused()) {
        // Video currently playing → user probably wants to pause
        state.userPauseIntentPresetAt = now();
      } else {
        // Video currently paused → user probably wants to play
        state.userPlayIntentPresetAt = now();
      }
      if (isPlayControlTarget(event.target)) {
        pendingTechTogglePausedState = null;
        if (getVideoPaused()) markUserPlayIntent();
        else {
          markUserPauseIntent();
          clearPendingPlayResumesForPause();
        }
        return;
      }
      if (isTechSurfaceTarget(event.target)) {
        pendingTechTogglePausedState = getVideoPaused();
        if (!getVideoPaused()) {
          // User tapped video surface while playing → pause intent.
          state.userPauseUntil = Math.max(state.userPauseUntil, now() + 1200);
        }
        // Tentative intent for non-coupled mode: since play() fires before the RAF in onClick,
        // pre-set intendedPlaying so the play handler doesn't reject the event.
        if (!coupledMode) {
          if (getVideoPaused()) {
            // Video is paused → user wants to play
            state.intendedPlaying = true;
            state.userPlayUntil = now() + 600;
          } else {
            // Video is playing -> user wants to pause
            // Set intendedPlaying=false IMMEDIATELY on pointerdown so no async
            // path can re-enable it before the pause event fires.
            state.intendedPlaying = false;
            state.bufferHoldIntendedPlaying = false;
            // Also mark MQM immediately so shouldBlockAutoResume()=true
            // BEFORE any async "play"/"playing" events can check it.
            MediumQualityManager.markUserPaused();
            state.userGesturePauseIntent = true;
            setTimeout(() => { state.userGesturePauseIntent = false; }, 2000);
          }
        }
        return;
      }
      pendingTechTogglePausedState = null;
    };
    const onClick = event => {
      if (isPlayControlTarget(event.target)) { pendingTechTogglePausedState = null; return; }
      if (!isTechSurfaceTarget(event.target)) { pendingTechTogglePausedState = null; return; }
      const wasPaused = pendingTechTogglePausedState;
      pendingTechTogglePausedState = null;
      if (typeof wasPaused !== "boolean") return;
      requestAnimationFrame(() => {
        const paused = getVideoPaused();
        if (wasPaused && !paused) {
          markUserPlayIntent(1200);
        } else if (!wasPaused && paused) {
          markUserPauseIntent(1200);
          clearPendingPlayResumesForPause();
        }
      });
    };
    const onKeyDown = event => {
      // Unlock AudioContext on keyboard interaction too
      tryUnlockAudioContext();
      const code = event.code || event.key || "";
      if (code === "Space" || code === "KeyK" || code === "MediaPlayPause") {
        if (getVideoPaused()) markUserPlayIntent();
        else {
          markUserPauseIntent();
          clearPendingPlayResumesForPause();
        }
      } else if (code === "MediaPause" || code === "MediaStop") {
        markUserPauseIntent();
        clearPendingPlayResumesForPause();
      }
    };
    try {
      if ("PointerEvent" in window) {
        root.addEventListener("pointerdown", onPressStart, { capture: true, passive: true });
      } else {
        root.addEventListener("mousedown", onPressStart, { capture: true, passive: true });
        root.addEventListener("touchstart", onPressStart, { capture: true, passive: true });
      }
    } catch {}
    try { root.addEventListener("click", onClick, { capture: true, passive: true }); } catch {}
    try { document.addEventListener("keydown", onKeyDown, true); } catch {}
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
    updateMediaSessionPlaybackState();
    const handlePauseLike = () => {
      markMediaAction("pause");
      setMediaSessionForcedPause(4000);
      markUserPauseIntent(3500);
      clearPendingPlayResumesForPause();
      setPauseEventGuard(2800);
      setMediaPauseTxn(2800);
      state.intendedPlaying = false;
      state.bufferHoldIntendedPlaying = false;
      state.strictBufferHold = false; state.bufferHoldSince = 0;
      state.strictBufferReason = "";
      state.strictBufferHoldFrames = 0;
      state.strictBufferHoldConfirmed = false;
      state.startupAudioHoldUntil = 0;
      state.syncing = false;
      state.resumeOnVisible = false;
      state.mediaSessionInitiatedPlay = false;
      clearHiddenMediaSessionPlay();
      cancelBackgroundResumeState();
      updateMediaSessionPlaybackState();
      pauseHard();
    };
    try {
      navigator.mediaSession.setActionHandler("play", () => {
        const serial = ++state.mediaSessionActionSerial;
        clearMediaSessionForcedPause();
        state.mediaSessionInitiatedPlay = true;
        markMediaAction("play");
        markUserPlayIntent(1800); // also calls cancelActiveFade + clears isProgrammaticAudioPause
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        // Backup: cancel fade again in case pauseHard's fade timer is still running
        cancelActiveFade();
        state.isProgrammaticAudioPause = false;
        state.audioEventsSquelchedUntil = 0; // clear squelch so audio can start
        updateMediaSessionPlaybackState();
        setPauseEventGuard(2800);
        setMediaPlayTxn(2800);
        setFastSync(2800);
        state.audioPauseUntil = 0;
        state.audioPlayUntil = 0;
        state.startupAudioHoldUntil = 0;
        const resumePos = getBestResumePosition();
        const currentVT = (() => { try { return Number(video.currentTime()); } catch { return 0; } })();
        const currentAT = coupledMode ? (() => { try { return Number(audio.currentTime); } catch { return 0; } })() : resumePos;
        const needsSeek = resumePos > 0.5 && (currentVT < 0.5 || currentAT < 0.5 || Math.abs(resumePos - currentVT) > 1.0);
        if (needsSeek) {
          squelchAudioEvents(800);
          safeSetVideoTime(resumePos);
        } else if (coupledMode && isFinite(currentVT) && isFinite(currentAT) && Math.abs(currentAT - currentVT) > 0.5) {
          squelchAudioEvents(600);
          safeSetAudioTime(currentVT);
        }
        resetAudioPlaybackRate();
        let playPromise = null;
        let audioPromise = null;
        try { playPromise = execProgrammaticVideoPlay(); } catch {}
        if (coupledMode) {
          try { audioPromise = execProgrammaticAudioPlay({ squelchMs: 700, minGapMs: 0, force: true }); } catch {}
        }
        Promise.allSettled([playPromise, audioPromise]).finally(() => {
          if (serial !== state.mediaSessionActionSerial) return;
          setTimeout(() => {
            if (serial !== state.mediaSessionActionSerial) return;
            if (!state.intendedPlaying || userPauseLockActive()) return;
            playTogether().catch(() => {});
          }, 0);
        });
      });
      navigator.mediaSession.setActionHandler("pause", handlePauseLike);
      try { navigator.mediaSession.setActionHandler("stop", handlePauseLike); } catch {}
      navigator.mediaSession.setActionHandler("seekforward", d => {
        const inc = Number(d?.seekOffset) || 10;
        const newTime = Math.min((video.currentTime() || 0) + inc, Number(video.duration()) || 0);
        state.pendingSeekTarget = newTime;
        state.seekWantedPlaying = state.intendedPlaying;
        video.currentTime(newTime);
      });
      navigator.mediaSession.setActionHandler("seekbackward", d => {
        const dec = Number(d?.seekOffset) || 10;
        const newTime = Math.max((video.currentTime() || 0) - dec, 0);
        state.pendingSeekTarget = newTime;
        state.seekWantedPlaying = state.intendedPlaying;
        video.currentTime(newTime);
      });
      navigator.mediaSession.setActionHandler("seekto", d => {
        if (!d || typeof d.seekTime !== "number") return;
        const newTime = Math.max(0, Math.min(Number(video.duration()) || 0, d.seekTime));
        state.pendingSeekTarget = newTime;
        state.seekWantedPlaying = state.intendedPlaying;
        video.currentTime(newTime);
      });
    } catch {}
  }

  function bindCommonMediaEvents() {
    video.on("ratechange", () => {
      if (!coupledMode) return;
      try {
        const newRate = Number(video.playbackRate()) || 1;
        audio.playbackRate = newRate;
        state.driftStableFrames = 0;
        state.lastDrift = 0;
        state.audioRateNudgeActive = false;
        state.audioRateNudgeUntil = 0;
      } catch {}
    });
    video.on("play", () => {
      if (state.seeking || state.seekBuffering) return;
      // TAB RETURN + STARTUP IMMUNITY: accept play if we were playing or during startup.
      // Never override an explicit user pause.
      if (state.tabReturnImmuneUntil > now() && (state.intendedPlaying || !state.firstPlayCommitted)) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        if (!coupledMode) MediumQualityManager.markUserPlayed();
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          clearStartupAutoplayRetryTimer();
          setTimeout(() => { state.startupPhase = false; }, 500);
        }
        updateMediaSessionPlaybackState();
        return;
      }

      if (!coupledMode) {
        if (MediumQualityManager.intentPaused && state.firstPlayCommitted) {
          execProgrammaticVideoPause();
          return;
        }
        // User preset play intent (set on pointerdown) → accept
        if (state.userPlayIntentPresetAt > 0 && (now() - state.userPlayIntentPresetAt) < 2000) {
          state.userPlayIntentPresetAt = 0;
          MediumQualityManager.markUserPlayed();
          state.intendedPlaying = true;
          state.bufferHoldIntendedPlaying = true;
          state.playSessionId++;
          if (!state.firstPlayCommitted) {
            state.firstPlayCommitted = true;
            state.startupKickDone = true;
            state.startupPhase = false;
          }
          clearMediaSessionForcedPause();
          markMediaAction("play");
          forceUnmuteForPlaybackIfAllowed();
          updateMediaSessionPlaybackState();
          return;
        }
        // Our own programmatic play (bg resume, stall recovery) → accept silently
        if (state.isProgrammaticVideoPlay) {
          if (!state.intendedPlaying && state.firstPlayCommitted) {
            // Programmatic play but user paused → override it
            execProgrammaticVideoPause();
          }
          return;
        }
        // Startup autoplay (before user has ever interacted) → accept
        if (!state.firstPlayCommitted && wantsStartupAutoplay()) {
          state.intendedPlaying = true;
          state.bufferHoldIntendedPlaying = true;
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          state.startupPhase = false;
          markMediaAction("play");
          forceUnmuteForPlaybackIfAllowed();
          updateMediaSessionPlaybackState();
          return;
        }
        // intendedPlaying already true → accept (expected, e.g. bg resume)
        if (state.intendedPlaying) {
          updateMediaSessionPlaybackState();
          return;
        }
        // Anything else: unexpected play while user intended pause → reject
        execProgrammaticVideoPause();
        return;
      }
      // --- coupled mode: user play intent (checked first)
      if (!state.isProgrammaticVideoPlay && state.userPlayIntentPresetAt > 0 &&
        (now() - state.userPlayIntentPresetAt) < 2000 &&
        document.visibilityState === "visible") {
        state.userPlayIntentPresetAt = 0; // consume
        MediumQualityManager.markUserPlayed(); // MQM: clear any pending pause block
        state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
      state.playSessionId++;
      state.audioPausedSince = 0;
      clearMediaSessionForcedPause();
      markMediaAction("play");
      setFastSync(2200);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      if (!state.firstPlayCommitted && !state.startupKickInFlight) {
        state.firstPlayCommitted = true; state.startupKickDone = true;
        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
        clearStartupAutoplayRetryTimer();
        setTimeout(() => { state.startupPhase = false; }, 1200);
      }
      if (coupledMode) { playTogether().catch(() => {}); } else { scheduleSync(0); }
      return;
        }
        if (!state.isProgrammaticVideoPlay && !state.isProgrammaticAudioPlay) incrementRapidPlayPause();
        if (detectLoop()) {
          state.intendedPlaying = false;
          pauseHard();
          return;
        }

        const isUserAction = (now() - state.lastUserActionTime) < 1500;

        if (isUserAction || userPlayIntentActive() || wantsStartupAutoplay()) {
          // PAGE-LOAD GATE — skip if startup autoplay is desired
          if (!isUserAction && !userPlayIntentActive() && !pageLoadedForAutoplay() && !wantsStartupAutoplay()) {
            execProgrammaticVideoPause();
            return;
          }

          // --- SD/medium play/pause handling
          if (!coupledMode && MediumQualityManager.shouldBlockAutoResume()) {
            execProgrammaticVideoPause();
            return;
          }
          if (!coupledMode && !state.intendedPlaying && !userPlayIntentActive() &&
            state.firstPlayCommitted) {
            // intendedPlaying=false + no play intent = user paused. Don't override.
            execProgrammaticVideoPause();
          return;
            }
            // After first play committed, wantsStartupAutoplay() alone must not
            // override a user pause. Only allow if there's actual user play intent.
            if (state.firstPlayCommitted && !state.intendedPlaying &&
              !isUserAction && !userPlayIntentActive()) {
              execProgrammaticVideoPause();
            return;
              }

              state.intendedPlaying = true;
              state.bufferHoldIntendedPlaying = true;
              state.playSessionId++;
              state.audioPausedSince = 0;
              clearMediaSessionForcedPause();

              if (!state.firstPlayCommitted && !state.startupKickInFlight) {
                state.firstPlayCommitted = true;
                state.startupKickDone = true;
                state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
                clearStartupAutoplayRetryTimer();
                setTimeout(() => { state.startupPhase = false; }, 1200);
              }

              markMediaAction("play");
              setFastSync(2200);
              forceUnmuteForPlaybackIfAllowed();
              updateAudioGainImmediate();
              updateMediaSessionPlaybackState();

              if (coupledMode) {
                if (!state.startupPrimed) {
                  maybePrimeStartup();
                  scheduleSync(0);
                  return;
                }
                if (state.startupKickInFlight && !state.startupKickDone) {
                  scheduleSync(0);
                  return;
                }
                if (!audio.paused && state.audioEverStarted) {
                  const vt = Number(video.currentTime());
                  const at = Number(audio.currentTime);
                  if (Math.abs(vt - at) > 0.25) quietSeekAudio(vt).catch(() => {});
                  scheduleSync(0);
                  return;
                }
                playTogether().catch(() => {});
              } else {
                scheduleSync(0);
              }
              return;
        }

        if (state.isProgrammaticVideoPlay || state.restarting || state.seeking) return;
        // Tab-return immunity: never pause a play event during the immune window
        if (state.tabReturnImmuneUntil > now()) return;

        if (!coupledMode && state.intendedPlaying) {
          scheduleSync(0);
          return;
        }

        if (!state.intendedPlaying || (!coupledMode && MediumQualityManager.shouldBlockAutoResume())) {
          execProgrammaticVideoPause();
        }
    });

    video.on("pause", () => {
      if (state.seeking || state.seekBuffering) return;
      // Immunity check: after tab return, reject pause events if we were playing or in startup.
      // Never fight the user's explicit pause.
      if (state.tabReturnImmuneUntil > now() &&
          (state.intendedPlaying || !state.firstPlayCommitted) &&
          !(state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000)) {
        const _vn = getVideoNode();
        if (_vn && typeof _vn.play === 'function') _vn.play().catch(() => {});
        return;
      }

      if (!coupledMode) {
        if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) {
          state.userPauseIntentPresetAt = 0;
          MediumQualityManager.markUserPaused();
          state.intendedPlaying = false;
          state.bufferHoldIntendedPlaying = false;
          state.playSessionId++;
          state.videoWaiting = false;
          state.userGesturePauseIntent = true;
          setTimeout(() => { state.userGesturePauseIntent = false; }, 2000);
          updateMediaSessionPlaybackState();
          pauseHard();
          // Verify pause took effect after a tick
          setTimeout(() => {
            if (!state.intendedPlaying && !getVideoPaused()) pauseHard();
          }, 50);
          return;
        }
        // 2. Our own programmatic pause → accept silently
        if (state.isProgrammaticVideoPause) return;
        // 3. User gesture pause intent (set on pointerdown) → honour
        if (state.userGesturePauseIntent) {
          state.intendedPlaying = false;
          state.bufferHoldIntendedPlaying = false;
          MediumQualityManager.markUserPaused();
          pauseHard();
          return;
        }
        // 4. User already in paused-intent state → accept (expected)
        if (MediumQualityManager.intentPaused || !state.intendedPlaying) return;
        // 5. intendedPlaying=true but browser paused us → counter-play if suppressed
        if (inBgReturnGrace() || BringBackToTabManager.isLocked() ||
          VisibilityGuard.shouldSuppress() || isVisibilityTransitionActive() ||
          isAltTabTransitionActive()) {
          VisibilityGuard.onPlayCalled();
          const _vn = getVideoNode();
          if (_vn && typeof _vn.play === "function") _vn.play().catch(() => {});
          return;
        }
        // 6. Page hidden → flag for resume on return
        if (document.visibilityState === "hidden") {
          if (platform.useBgControllerRetry) state.resumeOnVisible = true;
          return;
        }
        // 7. Genuine foreground pause we can't explain → honour it
        state.intendedPlaying = false;
        state.bufferHoldIntendedPlaying = false;
        state.playSessionId++;
        updateMediaSessionPlaybackState();
        pauseHard();
        return;
      }
      // --- coupled mode: user pause intent (checked first)
      // If user clicked within 2000ms and video was playing at click time, this
      // is definitively user-initiated pause. Bypass EVERY other guard.
      if (!state.isProgrammaticVideoPause && state.userPauseIntentPresetAt > 0 &&
        (now() - state.userPauseIntentPresetAt) < 2000 &&
        document.visibilityState === "visible") {
        state.userPauseIntentPresetAt = 0;
      MediumQualityManager.markUserPaused();
      state.intendedPlaying = false;
      state.bufferHoldIntendedPlaying = false;
      state.playSessionId++;
      state.videoWaiting = false;
      updateMediaSessionPlaybackState();
      pauseHard();
      return;
        }

        // --- immediate counter-play helper
        const _shouldCounterPlay = () =>
        state.intendedPlaying &&
        !state.videoWaiting &&
        !state.seeking &&
        !state.seekResumeInFlight &&
        !state.bgResumeInFlight &&
        !mediaSessionForcedPauseActive();

        const _counterPlay = () => {
          VisibilityGuard.onPlayCalled();
          const vn = getVideoNode();
          if (vn && typeof vn.play === 'function') vn.play().catch(() => {});
        };

        // --- suppressed-context detection
        const _isSuppressedContext =
        BringBackToTabManager.isLocked() ||
        VisibilityGuard.shouldSuppress() ||
        inBgReturnGrace() ||
        isVisibilityTransitionActive() ||
        isAltTabTransitionActive() ||
        document.visibilityState !== "visible";

        // Loop detection & rapid-toggle counting only for events we can't explain.
        if (!_isSuppressedContext && !state.isProgrammaticVideoPause && !state.isProgrammaticAudioPause) {
          incrementRapidPlayPause();
        }
        if (!_isSuppressedContext && detectLoop()) {
          state.intendedPlaying = false;
          pauseHard();
          return;
        }

        // --- user action detection
        const isUserAction = (now() - state.lastUserActionTime) < 1500 &&
        document.visibilityState === "visible" &&
        !isVisibilityTransitionActive() &&
        !isAltTabTransitionActive() &&
        now() >= state.tabVisibilityChangeUntil &&
        !inBgReturnGrace();

        // isUserPauseImmediate: pointer event < 600ms ago on visible page.
        const isImmediateUserAction = BackgroundPlaybackManager.isUserPauseImmediate();

        if (isImmediateUserAction || isUserAction || userPauseIntentActive() || userPauseLockActive()) {
          state.intendedPlaying = false;
          state.bufferHoldIntendedPlaying = false;
          state.playSessionId++;
          state.videoWaiting = false;
          updateMediaSessionPlaybackState();
          pauseHard();
          return;
        }

        // --- BBTM lock: definitive spurious-pause zone
        // We are inside the tab-return spurious-pause burst window.
        // IMMEDIATELY counter-play so the video is only paused for microseconds.
        if (BringBackToTabManager.isLocked()) {
          if (BringBackToTabManager.isVideoConfirmed()) {
            BringBackToTabManager.onLateArrivedPause();
          }
          if (_shouldCounterPlay()) _counterPlay();
          return;
        }

        // --- tab-return grace window (8s) - must be before transition block
        if (inBgReturnGrace() && !mediaSessionForcedPauseActive()) {
          if (_shouldCounterPlay()) {
            state.resumeOnVisible = true;
            _counterPlay();
          }
          return;
        }

        // --- actually hidden
        // Page is not visible at all. Don't fight the browser — flag for resume.
        if (document.visibilityState === "hidden") {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          return;
        }

        // --- visible but mid-transition (alt-tab blur or early visibilitychange)
        if (isVisibilityTransitionActive() || isAltTabTransitionActive()) {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (_shouldCounterPlay()) _counterPlay();
          return;
        }

        // --- wakeup timer active
        // A resume is already scheduled. IMMEDIATELY counter-play in case the wakeup
        // timer's play() call hasn't fired yet — close that gap.
        if (state.wakeupTimer && state.intendedPlaying && !mediaSessionForcedPauseActive()) {
          if (_shouldCounterPlay()) _counterPlay();
          return;
        }

        // --- chromium background pause block
        if (platform.chromiumOnlyBrowser && chromiumBgPauseBlocked()) {
          if (_shouldCounterPlay()) _counterPlay();
          return;
        }

        // --- in-flight operations
        // An existing play/seek/resume/buffer-wait operation owns responsibility for
        // restarting playback. Counter-play would race with it — use scheduleSync instead.
        if (state.isProgrammaticVideoPlay || state.seekResumeInFlight || state.bgResumeInFlight ||
          state.videoWaiting || (platform.chromiumOnlyBrowser && chromiumPauseEventSuppressed())) {
          scheduleSync(200);
        return;
          }

          // --- BPM background/transition gate
          // BackgroundPlaybackManager says we're in a bg/transition phase.
          // IMMEDIATELY counter-play so the video resumes as soon as the gate passes.
          if (BackgroundPlaybackManager.shouldSuppressAutoPause() && !mediaSessionForcedPauseActive()) {
            if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
            if (_shouldCounterPlay()) _counterPlay();
            return;
          }

          // --- startup guard
          if (!state.firstPlayCommitted && state.intendedPlaying && !mediaSessionForcedPauseActive()) {
            scheduleSync(300);
            return;
          }

          // --- programmatic pause guard
          // The caller who issued execProgrammaticVideoPause() will restart playback.
          // Don't counter-play here — use scheduleSync so the caller stays in control.
          if (state.isProgrammaticVideoPause && state.intendedPlaying) {
            scheduleSync(200);
            return;
          }

          // --- VisibilityGuard final catch-all
          if (state.intendedPlaying && VisibilityGuard.shouldSuppress() && !mediaSessionForcedPauseActive()) {
            state.resumeOnVisible = true;
            if (_shouldCounterPlay()) _counterPlay();
            return;
          }

          // --- final unfocused gate
          // Backup check: tab is not focused — this cannot be a user pause.
          // IMMEDIATELY counter-play so we resume the instant focus returns.
          if (state.intendedPlaying && !mediaSessionForcedPauseActive() &&
            (document.visibilityState === "hidden" || !isWindowFocused())) {
            state.resumeOnVisible = true;
          if (_shouldCounterPlay()) _counterPlay();
          return;
            }

            // --- real user pause
            // All guards passed. This is a real, unexplained pause on a focused, visible,
            // stable page with no transition or grace window active. Honour it.
            state.intendedPlaying = false;
            state.bufferHoldIntendedPlaying = false;
            state.playSessionId++;
            updateMediaSessionPlaybackState();
            pauseHard();
    });

    video.on("waiting", () => {
      try { UltraStabilizer.onVideoStall(); } catch {}
      state.videoWaiting = true;
      state.videoStallSince = state.videoStallSince || now();
      if (!state.intendedPlaying || state.restarting) return;
      if (!state.startupPrimed || state.startupKickInFlight || (state.startupPhase && !state.firstPlayCommitted)) return;

      // Defer audio pause by 150ms — micro-stalls (<150ms) won't kill audio.
      // Never kill audio during tab-return immunity — browser stalls are expected.
      if (coupledMode && audio && !audio.paused && !state.seeking && !state.seekResumeInFlight && !state.seekBuffering && !(state.tabReturnImmuneUntil > now())) {
        // Pause audio immediately — no delay. Hearing audio without video is worse
        // than a brief audio cut on micro-stalls.
        if (state._stallAudioPauseTimer) { clearTimeout(state._stallAudioPauseTimer); state._stallAudioPauseTimer = null; }
        state.videoStallAudioPaused = true;
        state.stallAudioPausedSince = now();
        state.audioPausedSince = 0;
        state.stallAudioResumeHoldUntil = now() + MIN_STALL_AUDIO_RESUME_MS;
        state.bufferHoldIntendedPlaying = true;
        cancelActiveFade();
        state.isProgrammaticAudioPause = true;
        state.audioPlayGeneration++;
        squelchAudioEvents(600);
        state.audioPauseUntil = Math.max(state.audioPauseUntil, now() + 600);
        try { audio.volume = 0; audio.pause(); } catch {}
        setTimeout(() => { state.isProgrammaticAudioPause = false; }, 300);
      }

      if (platform.useBgControllerRetry && state.intendedPlaying) {
        state.resumeOnVisible = true;
      }
      scheduleSync(0);
    });
    video.on("playing", () => {
      if (state._stallAudioPauseTimer) {
        clearTimeout(state._stallAudioPauseTimer);
        state._stallAudioPauseTimer = null;
      }
      if (state.seeking || state.seekBuffering) {
        state.videoWaiting = false;
        state.videoStallSince = 0;
        return;
      }
      // Tab-return immunity: video is playing — that's exactly what we want. Accept it.
      if (state.tabReturnImmuneUntil > now() && (state.intendedPlaying || !state.firstPlayCommitted)) {
        state.videoWaiting = false;
        state.videoStallSince = 0;
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        if (!coupledMode) MediumQualityManager.markUserPlayed();
        updateMediaSessionPlaybackState();
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          state.startupPhase = false;
          clearStartupAutoplayRetryTimer();
        }
        return;
      }
      if (!coupledMode) {
        try { UltraStabilizer.onVideoPlaying(); } catch {}
        if (MediumQualityManager.intentPaused && state.firstPlayCommitted) {
          execProgrammaticVideoPause();
          return;
        }
        if (!state.intendedPlaying && state.firstPlayCommitted && state.lastUserActionTime > 0) {
          execProgrammaticVideoPause();
          return;
        }
        // Commit first play
        if (!state.firstPlayCommitted) {
          if (wantsStartupAutoplay() || pageLoadedForAutoplay() || (state.lastUserActionTime > 0 && (now() - state.lastUserActionTime) < 2000)) {
            state.firstPlayCommitted = true;
            state.startupKickDone = true;
            state.startupPhase = false;
          } else {
            execProgrammaticVideoPause();
            return;
          }
        }
        state.intendedPlaying = true;
        state.videoWaiting = false;
        state.videoStallSince = 0;
        updateLastKnownGoodVT();
        updateMediaSessionPlaybackState();
        return;
      }
      // --- coupled mode: UltraStabilizer: notify video playing
      try { UltraStabilizer.onVideoPlaying(); } catch {}
      // Only clear videoWaiting when the browser truly has enough data (readyState >= 3).
      // playing can fire with readyState=2 during thin-buffer situations; clearing here
      // would allow audio to restart before the next "waiting" arrives.
      if (getVideoReadyState() >= HAVE_FUTURE_DATA) {
        state.videoWaiting = false;
      }
      state.startupAudioHoldUntil = 0;
      state.videoStallSince = 0;

      if (!state.firstPlayCommitted && !state.startupKickInFlight) {
        if (wantsStartupAutoplay() || pageLoadedForAutoplay() || state.lastUserActionTime > 0 && (now() - state.lastUserActionTime) < 2000) {
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
          clearStartupAutoplayRetryTimer();
          setTimeout(() => { state.startupPhase = false; }, 1200);
        } else {
          // Page not loaded + no user gesture → autoplay fired too early. Pause.
          execProgrammaticVideoPause();
          return;
        }
      }

      if ((!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) && !userPlayIntentActive() && !(state.tabReturnImmuneUntil > now())) {
        // --- never let autoplay override an explicit user pause
        const userExplicitlyPaused =
        userPauseLockActive() ||        // userPauseLockUntil fence still active
        userPauseIntentActive() ||      // userPauseUntil fence still active
        state.userPauseIntentPresetAt > 0 ||  // preset set on pointerdown
        MediumQualityManager.shouldBlockAutoResume() || // MQM tracks user pause for 4s
        // Once startup has completed, intendedPlaying=false means the user (or a
        // system event) explicitly paused. A stale "playing" event must never override this.
        // Before firstPlayCommitted, autoplay is legitimate. After it, paused=user's intent.
        (state.firstPlayCommitted && !state.intendedPlaying) ||
        // MQM guard -- if MQM says user recently paused, always honour it.
        MediumQualityManager.shouldBlockAutoResume() ||
        // In non-coupled mode, intendedPlaying=false is always authoritative
        // after the user has interacted at least once (lastUserActionTime > 0).
        (!coupledMode && !state.intendedPlaying && state.lastUserActionTime > 0);

        if (userExplicitlyPaused) {
          // User pause is authoritative — override autoplay
          execProgrammaticVideoPause();
          return;
        }
        if (wantsStartupAutoplay() || (now() - state.startupPrimeStartedAt) < 2600) {
          // PAGE-LOAD GATE: autoplay recovery must also wait for window.load.
          if (!pageLoadedForAutoplay()) {
            execProgrammaticVideoPause();
            return;
          }
          clearMediaSessionForcedPause();
          state.intendedPlaying = true;
          state.bufferHoldIntendedPlaying = true;
          markMediaAction("play");
          updateMediaSessionPlaybackState();
        } else {
          execProgrammaticVideoPause();
          return;
        }
      }
      updateLastKnownGoodVT();
      if (platform.chromiumOnlyBrowser) {
        state.chromiumAudioStartLockUntil = 0;
        state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + 500);
      }
      setFastSync(2000);

      // --- stall-recovery audio resume
      if (coupledMode && audio && state.videoStallAudioPaused && state.intendedPlaying &&
        !state.seeking && !state.syncing) {
        const vtNow = Number(video.currentTime()) || 0;
      const vRS = Number(getVideoNode().readyState || 0);
      const holdExpired = now() >= state.stallAudioResumeHoldUntil;

      if (holdExpired && vRS >= MIN_STALL_VIDEO_RS && !shouldBlockNewAudioStart()) {
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        state.audioPauseUntil = 0;
        state.audioEventsSquelchedUntil = 0;
        safeSetAudioTime(vtNow);
        execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 })
        .then(ok => { if (ok) softUnmuteAudio(50).catch(() => {}); })
        .catch(() => {});
      } else {
        // Video readyState still low or hold active — wait for genuine buffer readiness.
        // armResumeAfterBuffer polls readyState and fires playTogether() when ready.
        armResumeAfterBuffer(8000);
        scheduleSync(0);
        return;
      }
        } else if (coupledMode && audio && audio.paused && state.intendedPlaying &&
          !state.seeking && !state.syncing && !state.strictBufferHold &&
          !state.videoStallAudioPaused && !shouldBlockNewAudioStart()) {
          // Audio paused for a non-stall reason (seek, tab return) — normal resume path
          if ((state.startupKickInFlight && !state.startupKickDone) || state.seekResumeInFlight) {
            scheduleSync(0);
          } else {
            playTogether().catch(() => {});
          }
          } else {
            state.videoStallAudioPaused = false;
            scheduleSync(0);
          }

          // --- audio kill-switch: pause video if audio doesn't start within 700ms
          if (coupledMode && audio && state.intendedPlaying && !state.seeking && !state.syncing) {
            const _ksSession = state.playSessionId;
            setTimeout(() => {
              // Abort if session changed or state is no longer valid
              if (state.playSessionId !== _ksSession) return;
              if (!state.intendedPlaying || getVideoPaused()) return;
              if (!audio.paused) return; // audio is playing — all good
              if (state.seeking || state.syncing || state.restarting) return;
              if (state.videoWaiting || state.videoStallAudioPaused) return;
              if (now() < state.stallAudioResumeHoldUntil) return;
              if (BackgroundPlaybackManager.isBackground()) return; // handled by bg manager
              // One last try: force-start audio from current video position
              const _vtNow = Number(video.currentTime()) || 0;
              safeSetAudioTime(_vtNow);
              execProgrammaticAudioPlay({ squelchMs: 400, force: true, minGapMs: 0 })
              .then(started => {
                if (state.playSessionId !== _ksSession) return;
                if (started) {
                  softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
                  return;
                }
                // --- don't pause video during startup
                if (!state.audioEverStarted) {
                  armResumeAfterBuffer(6000);
                  return;
                }
                // Audio truly can't start right now — pause video to keep A/V contract.
                // armResumeAfterBuffer will restart both once audio is ready.
                if (!getVideoPaused() && state.intendedPlaying &&
                  state.playSessionId === _ksSession && !state.seeking) {
                  execProgrammaticVideoPause();
                armResumeAfterBuffer(6000);
                  }
              })
              .catch(() => {
                if (state.playSessionId !== _ksSession) return;
                // Same guard as .then: don't pause video during startup.
                if (!state.audioEverStarted) { armResumeAfterBuffer(6000); return; }
                if (!getVideoPaused() && state.intendedPlaying &&
                  state.playSessionId === _ksSession && !state.seeking) {
                  execProgrammaticVideoPause();
                armResumeAfterBuffer(6000);
                  }
              });
            }, 1000);
          }
    });
    if (!coupledMode) return;
    const onAudioPlay = () => {
      if (isTabReturnImmune()) return; // never fight audio during tab return
      if (!state.isProgrammaticAudioPlay && !state.isProgrammaticVideoPlay) incrementRapidPlayPause();
      if (detectLoop()) {
        state.intendedPlaying = false;
        pauseHard();
        return;
      }

      if (audioEventsSquelched() || state.restarting || state.isProgrammaticAudioPlay || state.isProgrammaticVideoPlay) return;
      if (now() < state.audioPlayUntil || now() < state.audioPauseUntil) return;
      if ((!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive() || shouldBlockNewAudioStart()) && !userPlayIntentActive()) {
        try { squelchAudioEvents(400); } catch {}
        try { audio.pause(); } catch {}
        return;
      }

      state.audioEverStarted = true;
      state.audioStallSince = 0;
      if (!state.firstPlayCommitted && !state.startupKickInFlight) {
        state.firstPlayCommitted = true;
        state.startupKickDone = true;
        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
        clearStartupAutoplayRetryTimer();
        setTimeout(() => { state.startupPhase = false; }, 1200);
      }

      clearMediaSessionForcedPause();
      state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
      markMediaAction("play");
      setFastSync(2000);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      if (!state.startupPrimed) {
        maybePrimeStartup();
        scheduleSync(0);
        return;
      }
      if ((state.startupKickInFlight && !state.startupKickDone) || state.seekResumeInFlight) {
        scheduleSync(0);
        return;
      }
      if (!state.syncing && !state.seeking && getVideoPaused()) {
        if (isHiddenBackground() && state.bgPlaybackAllowed) {
          scheduleSync(0);
        } else {
          playTogether().catch(() => {});
        }
      } else {
        scheduleSync(0);
      }
    };
    const onAudioPause = () => {
      if (isTabReturnImmune()) return; // never fight audio during tab return
      if (!state.isProgrammaticAudioPause && !state.isProgrammaticVideoPause) incrementRapidPlayPause();
      if (detectLoop()) {
        state.intendedPlaying = false;
        pauseHard();
        return;
      }

      if (audioEventsSquelched() || state.restarting || state.isProgrammaticAudioPause || state.isProgrammaticVideoPause) return;
      if (now() < state.audioPauseUntil || now() < state.audioPlayUntil) return;

      // Snapshot grace state at event-fire time. RAF can run up to 300ms later;
      // a pause event that fired at T=7.9s would miss inBgReturnGrace() inside
      // the RAF (which runs at T=8.1s) and be misclassified as a user pause.
      const _inGraceAtPauseFire = inBgReturnGrace();

      requestAnimationFrame(() => {
        if (state.seeking || state.restarting || state.isProgrammaticAudioPause) return;
        if (audio && !audio.paused) return;

        // --- BringBackToTab hard lock
        // Inside the tab-return window, audio pause events are spurious.
        // The retry loop handles audio simultaneously now (no 150ms delay).
        if (BringBackToTabManager.isLocked()) {
          // Track late arrivals for adaptive lock extension
          if (BringBackToTabManager.isVideoConfirmed()) {
            BringBackToTabManager.onLateArrivedPause();
          }
          return;
        }

        // --- VisibilityGuard: primary gate for audio pause suppression
        if (state.intendedPlaying && VisibilityGuard.shouldSuppress() && !mediaSessionForcedPauseActive()) {
          if (platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (!state.isProgrammaticAudioPause && !state.videoWaiting && !state.seeking) {
            execProgrammaticAudioPlay({ squelchMs: 0, force: true, minGapMs: 0 }).catch(() => {});
          }
          return;
        }

        // --- tab-return grace / background suppress: restart audio immediately
        const _audioShouldRestart = () =>
        state.intendedPlaying &&
        !state.isProgrammaticAudioPause &&
        !state.videoWaiting &&
        !state.videoStallAudioPaused &&
        !state.seeking &&
        !mediaSessionForcedPauseActive() &&
        !userPauseLockActive() &&
        !shouldBlockNewAudioStart();

        const _restartAudio = () => {
          execProgrammaticAudioPlay({ squelchMs: 0, force: true, minGapMs: 0 }).catch(() => {});
        };

        if (_inGraceAtPauseFire || inBgReturnGrace()) {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (_audioShouldRestart()) _restartAudio();
          return;
        }
        if (isVisibilityTransitionActive() || isAltTabTransitionActive()) {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          // Tab is visible mid-transition — restart audio immediately
          if (document.visibilityState === "visible" && _audioShouldRestart()) _restartAudio();
          return;
        }
        if (!isVisibilityStable() || !isFocusStable()) {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (document.visibilityState === "visible" && _audioShouldRestart()) _restartAudio();
          return;
        }
        if (now() < state.tabVisibilityChangeUntil) {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (document.visibilityState === "visible" && _audioShouldRestart()) _restartAudio();
          return;
        }
        // Track oscillation: if BPM says suppress but we got here anyway,
        // it means the browser fired a pause that slipped through grace guards.
        if (BackgroundPlaybackManager.shouldSuppressAutoPause() && state.intendedPlaying) {
          BackgroundPlaybackManagerManager.onBrowserForcedPause();
          if (platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (document.visibilityState === "visible" && _audioShouldRestart()) _restartAudio();
          return;
        }

        trackPauseEvent();

        if (document.visibilityState === "visible" && isWindowFocused()) {
          if (!userPauseIntentActive() && !userPauseLockActive() &&
            (state.isProgrammaticVideoPlay || state.seekResumeInFlight || state.bgResumeInFlight ||
            mediaPlayTxnActive() || fastSyncActive() || state.videoWaiting ||
            (platform.chromiumOnlyBrowser && chromiumPauseEventSuppressed()) ||
            BackgroundPlaybackManager.shouldSuppressAutoPause())) {
            if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
            scheduleSync(200);
            return;
            }
            state.intendedPlaying = false;
          state.bufferHoldIntendedPlaying = false;
          state.playSessionId = (state.playSessionId || 0) + 1;
          updateMediaSessionPlaybackState();
          pauseHard();
          return;
        }

        if (shouldTreatVisiblePauseAsUserPause()) {
          state.intendedPlaying = false;
          state.bufferHoldIntendedPlaying = false;
          state.playSessionId = (state.playSessionId || 0) + 1;
          updateMediaSessionPlaybackState();
          pauseHard();
          return;
        }

        if (platform.chromiumOnlyBrowser && chromiumBgPauseBlocked()) return;
        if (startupSettleActive() && document.visibilityState === "visible" && isWindowFocused()) return;

        if (shouldIgnorePauseAsTransient()) {
          if (state.intendedPlaying && platform.useBgControllerRetry) {
            if (!state.startupKickDone && (state.startupKickInFlight || state.startupAutoplayRetryTimer)) {
              // kick in flight
            } else if (!state.startupKickDone && !state.startupKickInFlight) {
              scheduleStartupAutoplayRetry();
            } else {
              state.resumeOnVisible = true;
            }
          }
          return;
        }
        if (startupAutoplayPauseGraceActive()) {
          maybePrimeStartup();
          scheduleStartupAutoplayKick();
          return;
        }
        if (mediaSessionForcedPauseActive()) return;
        if (state.intendedPlaying && platform.useBgControllerRetry) {
          if (state.startupKickInFlight || (!state.startupKickDone && state.startupAutoplayRetryTimer)) {
            return;
          }
          noteBackgroundEntry();
          state.resumeOnVisible = true;
          return;
        }
        pauseTogether();
      });
    };
    const onReadyish = () => {
      // Never attempt to start playback from a media-ready event before page load.
      if (!pageLoadedForAutoplay() && !state.firstPlayCommitted) return;
      maybePrimeStartup();
      if (!state.intendedPlaying || state.restarting || state.seeking) return;
      if (mediaSessionForcedPauseActive()) return;
      const t = Number(video.currentTime());
      if (bothPlayableAt(t) || (!state.audioEverStarted && canStartAudioAt(t))) {
        if (!inMediaTxnWindow()) {
          scheduleSync(0);
        }
      }
    };
    audio.addEventListener("play", onAudioPlay, { passive: true });
    audio.addEventListener("playing", () => { try { UltraStabilizer.onAudioPlaying(); } catch {} }, { passive: true });
    audio.addEventListener("pause", onAudioPause, { passive: true });
    audio.addEventListener("seeking", () => {
      // Only react if this is a user-initiated audio seek, not our programmatic sync
      if (state.restarting || !state.seeking) return;
      if (state.seekCompleted || state.seekBuffering) return;
      // Don't pause — the video seeked handler owns the flow
    }, { passive: true });
    audio.addEventListener("seeked", () => {
      if (state.restarting || !state.seeking) return;
      if (state.seekCompleted || state.seekBuffering) return;
      // Don't schedule finalize — video's seeked handler does that
    }, { passive: true });
    audio.addEventListener("ended", () => {
      if (state.restarting) return;
      if (state.seeking || state.seekBuffering) return;
      if (now() < state.suppressEndedUntil) return;
      try {
        const dur = Number(video.duration()) || 0;
        const ct = Number(audio.currentTime) || 0;
        if (dur > 1 && ct < dur - 2) return;
        if (dur > 5 && ct < 1) return;
      } catch {}
      if (isLoopDesired()) { restartLoop().catch(() => {}); return; }
      // Hard stop — bypass pauseTogether's startupSettle guard
      state.intendedPlaying = false;
      state.bufferHoldIntendedPlaying = false;
      state.resumeOnVisible = false;
      state.bgHiddenWasPlaying = false;
      state.tabReturnImmuneUntil = 0;
      disengagePauseIntercept();
      state.playSessionId++;
      updateMediaSessionPlaybackState();
      pauseHard();
    }, { passive: true });
      audio.addEventListener("canplay", onReadyish, { passive: true });
      audio.addEventListener("canplaythrough", onReadyish, { passive: true });
      audio.addEventListener("loadeddata", onReadyish, { passive: true });
      videoEl.addEventListener("canplay", () => {
        state.videoWaiting = false;
        state.videoStallSince = 0;
        // Cancel deferred stall audio pause if video recovered quickly
        if (state._stallAudioPauseTimer) {
          clearTimeout(state._stallAudioPauseTimer);
          state._stallAudioPauseTimer = null;
        }
        onReadyish();
      }, { passive: true });
      videoEl.addEventListener("canplaythrough", onReadyish, { passive: true });
      videoEl.addEventListener("loadeddata", () => { try { UltraStabilizer.notifyVideoLoadeddata(); } catch {} onReadyish(); }, { passive: true });

      videoEl.addEventListener("loadedmetadata", () => {
        if (state.startupPhase && !state.firstPlayCommitted && wantsStartupAutoplay()) {
          forceZeroBeforeFirstPlay();
        }
      }, { once: true, passive: true });

      video.on("seeking", () => {
        try { UltraStabilizer.onSeekStart(); } catch {}
        if (state.restarting) return;
        if (state.bgSilentTimeSyncing) return;
        clearSeekBuffering();
        state.seekId++;
        const currentSeekId = state.seekId;
        state.strictBufferHold = false; state.bufferHoldSince = 0;
        state.strictBufferReason = "";
        state.strictBufferHoldFrames = 0;
        state.strictBufferHoldConfirmed = false;
        state.seeking = true;
        state.seekWantedPlaying = state.intendedPlaying;
        state.playRequestedDuringSeek = state.intendedPlaying;
        state.seekCompleted = false;
        state.firstSeekDone = true;
        // Reset rapid-play-pause counter — seek events should never feed loop detection
        state.rapidPlayPauseCount = 0;
        state.rapidPlayPauseResetAt = now();
        state.loopPreventionCooldownUntil = 0;

        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
          clearStartupAutoplayRetryTimer();
          setTimeout(() => { state.startupPhase = false; }, 1200);
        }

        clearSeekSyncFinalizeTimer();
        clearSeekWatchdog();
        // Get seek target from multiple sources — video.js currentTime() may
        // not reflect the target yet during 'seeking', so also check the native element.
        const vjsTime = Number(video.currentTime());
        const nativeTime = Number(videoEl.currentTime);
        const innerEl = video?.el?.()?.querySelector?.("video");
        const innerTime = innerEl ? Number(innerEl.currentTime) : NaN;
        // Use pendingSeekTarget if it was set by mediaSession/keyboard handlers,
        // otherwise pick the most likely seek target (they should all agree after seeking fires)
        const seekTime = state.pendingSeekTarget != null ? Number(state.pendingSeekTarget) :
          isFinite(nativeTime) ? nativeTime :
          isFinite(vjsTime) ? vjsTime :
          isFinite(innerTime) ? innerTime : 0;
        state.pendingSeekTarget = seekTime;
        state.lastKnownGoodVT = seekTime;
        state.lastKnownGoodVTts = now();
        state.seekCooldownUntil = now() + 2000;

        state.videoWaiting = false;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        state.audioPauseUntil = 0;
        state.audioPausedSince = 0;
        state.isProgrammaticAudioPause = false;
        state.stateChangeCooldownUntil = 0;
        state.audioFadeCompleteUntil = 0;
        state.audioEventsSquelchedUntil = 0;
        state.audioPlayUntil = 0;
        state.strictBufferHold = false;
        state.bufferHoldSince = 0;

        const watchdogSeekId = state.seekId;
        state.seekWatchdogTimer = setTimeout(() => {
          state.seekWatchdogTimer = null;
          if (state.seeking && state.seekId === watchdogSeekId) {
            scheduleSeekFinalize(0, watchdogSeekId);
          }
        }, SEEK_WATCHDOG_MS);

        // Immediately pause+mute audio. Actual time sync happens in 'seeked'.
        if (coupledMode && audio) {
          squelchAudioEvents(600);
          try {
            cancelActiveFade();
            audio.volume = 0;
            if (!audio.paused) audio.pause();
          } catch {}
        }

        if (!state.intendedPlaying) {
          execProgrammaticVideoPause();
        }

        state.driftStableFrames = 0;
        state.lastDrift = 0;
        setFastSync(2600);
        scheduleSync(0);
      });
      video.on("seeked", () => {
        if (state.restarting) return;
        clearSeekWatchdog();
        state.isProgrammaticAudioPause = false;
        state.audioPausedSince = 0;
        state.audioPauseUntil = 0;
        state.audioEventsSquelchedUntil = 0;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        // Get the definitive seek target — video.currentTime() is reliable after seeked
        const newTime = Number(video.currentTime());
        state.lastKnownGoodVT = newTime;
        state.lastKnownGoodVTts = now();
        state.pendingSeekTarget = newTime;
        if (coupledMode && audio && isFinite(newTime) && newTime >= 0) {
          // Allow our writes through the currentTime gate
          state._allowAudioTimeWrite = true;
          try { audio.currentTime = newTime; } catch {}
          const _seekedId = state.seekId;
          setTimeout(() => {
            if (state.seekId !== _seekedId) return;
            state._allowAudioTimeWrite = true;
            try {
              const drift = Math.abs((audio.currentTime || 0) - newTime);
              if (drift > 0.15) audio.currentTime = newTime;
            } catch {}
            state._allowAudioTimeWrite = false;
          }, 80);
          state._allowAudioTimeWrite = false;
        }
        state.driftStableFrames = 0;
        state.lastDrift = 0;
        scheduleSeekFinalize(SEEK_FINALIZE_DELAY_MS, state.seekId);
      });
      video.on("ended", () => {
        if (state.restarting) return;
        if (state.seeking || state.seekBuffering) return;
        if (now() < state.suppressEndedUntil) return;
        try {
          const dur = Number(video.duration()) || 0;
          const ct = Number(video.currentTime()) || 0;
          if (dur > 1 && ct < dur - 2) return;
          if (dur > 5 && ct < 1) return;
        } catch {}
        if (isLoopDesired()) { restartLoop().catch(() => {}); return; }
        // Hard stop — bypass pauseTogether's startupSettle guard
        state.intendedPlaying = false;
        state.bufferHoldIntendedPlaying = false;
        state.resumeOnVisible = false;
        state.bgHiddenWasPlaying = false;
        state.tabReturnImmuneUntil = 0;
        disengagePauseIntercept();
        state.playSessionId++;
        updateMediaSessionPlaybackState();
        pauseHard();
      });
  }

  async function restartLoop() {
    // Only restart if loop is explicitly desired
    if (!isLoopDesired()) { pauseTogether(); return; }
    if (state.restarting) return;
    state.restarting = true;
    try {
      clearSyncLoop();
      pauseHard();
      const startAt = 0;
      state.suppressEndedUntil = now() + 1400;
      state.lastKnownGoodVT = 0;
      state.lastKnownGoodVTts = now();
      safeSetCT(videoEl, startAt);
      if (coupledMode) safeSetAudioTime(startAt);
      state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
      markMediaAction("play");
      setFastSync(2400);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      await ensureUnmutedIfNotUserMuted();
      await new Promise(r => requestAnimationFrame(r));
      await playTogether();
    } finally {
      state.restarting = false;
    }
  }

  // --- BringBackToTab retry engine
  function startBringBackRetry() {
    if (state.bbtabRetryRafId)    { cancelAnimationFrame(state.bbtabRetryRafId); state.bbtabRetryRafId = null; }
    if (state.bbtabRetryTimer)    { clearTimeout(state.bbtabRetryTimer);         state.bbtabRetryTimer    = null; }
    if (state.bbtabAudioSyncTimer){ clearTimeout(state.bbtabAudioSyncTimer);     state.bbtabAudioSyncTimer = null; }

    // Only allow if: was playing, OR resume flagged, OR startup hasn't committed yet
    if (!state.intendedPlaying && !state.resumeOnVisible &&
        !(wantsStartupAutoplay() && !state.firstPlayCommitted)) return;
    const bbtGen = state.tabReturnGen;

    BringBackToTabManager.onTabReturn();

    // --- shot 1: immediate rAF
    // Save audio state ONCE at entry — don't touch volume if audio is already running
    const _audioWasPaused = coupledMode && audio ? !!audio.paused : true;
    const _savedVol = coupledMode && audio ? (audio.volume || targetVolFromVideo()) : 1;

    state.bbtabRetryRafId = requestAnimationFrame(() => {
      state.bbtabRetryRafId = null;
      if (state.tabReturnGen !== bbtGen) return;
      if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
      if (!state.intendedPlaying && !state.firstPlayCommitted && wantsStartupAutoplay()) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
      }
      if (!state.intendedPlaying) return;

      VisibilityGuard.onPlayCalled();
      const vn = getVideoNode();
      if (vn && typeof vn.play === 'function') vn.play().catch(() => {});
      if (coupledMode && audio) {
        const vtNow = (() => { try { return Number(video.currentTime()); } catch { return 0; } })();
        if (isFinite(vtNow)) safeSetAudioTime(vtNow);
        if (audio.paused) {
          cancelActiveFade();
          audio.play().catch(() => {});
        }
      }
    });

    // --- shot 1.25: 80ms quick-check
    setTimeout(() => {
      if (state.tabReturnGen !== bbtGen) return;
      if (!state.intendedPlaying && !state.firstPlayCommitted && wantsStartupAutoplay()) { state.intendedPlaying = true; state.bufferHoldIntendedPlaying = true; }
      if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
      if (!getVideoPaused()) {
        BringBackToTabManager.onVideoConfirmedPlaying();
        if (coupledMode && audio && !state.tabReturnAudioMuted && audio.paused && !state.isProgrammaticAudioPause) {
          const vtEarly = (() => { try { return Number(video.currentTime()); } catch { return 0; } })();
          safeSetAudioTime(vtEarly);
          execProgrammaticAudioPlay({ squelchMs: 0, force: true, minGapMs: 0 }).catch(() => {});
        }
        return;
      }
      VisibilityGuard.onPlayCalled();
      const vnE = getVideoNode();
      if (vnE && typeof vnE.play === 'function') vnE.play().catch(() => {});
    }, 80);

    // --- shot 1.5: 200ms intermediate
    setTimeout(() => {
      if (state.tabReturnGen !== bbtGen) return;
      if (!state.intendedPlaying && !state.firstPlayCommitted && wantsStartupAutoplay()) { state.intendedPlaying = true; state.bufferHoldIntendedPlaying = true; }
      if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
      if (!getVideoPaused()) {
        BringBackToTabManager.onVideoConfirmedPlaying();
        if (coupledMode && audio && !state.tabReturnAudioMuted && audio.paused && !state.isProgrammaticAudioPause) {
          const vtMid = (() => { try { return Number(video.currentTime()); } catch { return 0; } })();
          safeSetAudioTime(vtMid);
          execProgrammaticAudioPlay({ squelchMs: 0, force: true, minGapMs: 0 }).catch(() => {});
        }
        return;
      }
      VisibilityGuard.onPlayCalled();
      const vn = getVideoNode();
      if (vn && typeof vn.play === 'function') vn.play().catch(() => {});
      if (coupledMode && audio && !state.tabReturnAudioMuted && audio.paused) {
        audio.play().catch(() => {});
      }
    }, 200);

    // --- shot 2: 700ms fallback
    state.bbtabRetryTimer = setTimeout(() => {
      state.bbtabRetryTimer = null;
      if (state.tabReturnGen !== bbtGen) return;
      if (!state.intendedPlaying && !state.firstPlayCommitted && wantsStartupAutoplay()) { state.intendedPlaying = true; state.bufferHoldIntendedPlaying = true; }
      if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
      const vPaused = getVideoPaused();
      if (!vPaused) {
        BringBackToTabManager.onVideoConfirmedPlaying();
        try { QuantumReturnOrchestrator.assessContinuity(); } catch {}
        if (coupledMode && audio && !state.tabReturnAudioMuted) {
          const vt = (() => { try { return Number(video.currentTime()); } catch { return NaN; } })();
          const at = Number(audio.currentTime) || 0;
          if (isFinite(vt) && isFinite(at) && Math.abs(at - vt) > 0.5) {
            try { audio.currentTime = vt; } catch {}
          }
          if (audio.paused && !state.isProgrammaticAudioPause) {
            execProgrammaticAudioPlay({ squelchMs: 0, force: true, minGapMs: 0 }).catch(() => {});
          }
          softUnmuteAudio(200).catch(() => {});
        }
        setFastSync(800);
        scheduleSync(0);
        return;
      }
      VisibilityGuard.onPlayCalled();
      if (coupledMode) {
        state.bgCatchUpCooldownUntil = 0;
        seamlessBgCatchUp().catch(() => {});
      } else {
        execProgrammaticVideoPlay();
      }
      setFastSync(1200);
      scheduleSync(0);
    }, 700);
  }

  // _doBringBackRetry is no longer used but kept as a no-op to avoid errors.
  function _doBringBackRetry() {}

  function executeSeamlessWakeup() {
    if (!state.intendedPlaying && !state.resumeOnVisible &&
        !(wantsStartupAutoplay() && !state.firstPlayCommitted)) return;
    if (state.wakeupTimer) return;
    clearTimeout(state.wakeupTimer);
    state.wakeupTimer = null;

    const wakeDelay = platform.chromiumOnlyBrowser ? 50 : 30;
    const myGen = state.tabReturnGen;

    state.wakeupTimer = setTimeout(() => {
      state.wakeupTimer = null;
      if (state.tabReturnGen !== myGen) return; // stale — user alt-tabbed again
      if (!state.intendedPlaying) return;
      if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;

      // Reset BPMM oscillation state before catch-up. If a previous bg session
      // hit the oscillation lock, it would block seamlessBgCatchUp from retrying.
      BackgroundPlaybackManagerManager.onForegroundReturn();

      state.audioPausedSince = 0;
      if (coupledMode) {
        const vPaused = getVideoPaused();
        const aPaused = audio ? !!audio.paused : true;
        if (!vPaused && !aPaused) {
          // Both already playing (background playback succeeded) — just sync drift
          const vtNow = Number(video.currentTime());
          const atNow = Number(audio ? audio.currentTime : vtNow);
          if (isFinite(vtNow) && isFinite(atNow) && Math.abs(vtNow - atNow) < 2.0) {
            setFastSync(1500);
            scheduleSync(0);
            return;
          }
        }
        // One or both paused — perform full catch-up
        seamlessBgCatchUp().catch(() => {});
      } else {
        // Non-coupled: only resume if we were playing or in startup
        if (state.tabReturnImmuneUntil > now() && !state.firstPlayCommitted) MediumQualityManager.markUserPlayed();
        if (getVideoPaused() && state.intendedPlaying && !userPauseLockActive() &&
          !MediumQualityManager.intentPaused) {
          playTogether().catch(() => {});
          } else {
            scheduleSync(0);
          }
      }

      [300, 600, 1200, 2000].forEach(retryDelay => {
        setTimeout(() => {
          if (state.tabReturnGen !== myGen) return;
          if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
          if (!getVideoPaused()) {
            if (coupledMode && audio && !state.tabReturnAudioMuted && audio.paused && !state.isProgrammaticAudioPause &&
              !shouldBlockNewAudioStart()) {
              const vtRetry = Number(video.currentTime()) || 0;
            safeSetAudioTime(vtRetry);
            execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
            softUnmuteAudio(200).catch(() => {});
              }
              return;
          }
          if (state.bgResumeInFlight || state.seekResumeInFlight) return;
          state.bgCatchUpCooldownUntil = 0;
          if (coupledMode) {
            seamlessBgCatchUp().catch(() => {});
          } else if (!userPauseLockActive()) {
            execProgrammaticVideoPlay();
            setFastSync(1000);
            scheduleSync(0);
          }
        }, retryDelay);
      });
    }, wakeDelay);
  }

  function setupVisibilityLifecycle() {
    try {
      document.addEventListener("freeze", () => {
        if (!platform.useBgControllerRetry) return;
        if (state.intendedPlaying) {
          noteBackgroundEntry();
          state.resumeOnVisible = true;
          clearSyncLoop();
        }
      }, { passive: true, capture: true });
      document.addEventListener("resume", () => {
        if (!platform.useBgControllerRetry) return;
        executeSeamlessWakeup();
      }, { passive: true, capture: true });
    } catch {}
    try {
      window.addEventListener("pageshow", e => {
        if (!platform.useBgControllerRetry) return;
        // BFCache restore or normal page show
        if (e && e.persisted) {
          // Back-forward cache restoration — treat as wakeup
          state.lastBgReturnAt = now();
          VisibilityGuard.onTabShow(); // VG: BFCache restore = tab return
          if (platform.chromiumOnlyBrowser) {
            setChromiumBgPauseBlock(CHROMIUM_BG_PAUSE_BLOCK_MS);
            setChromiumPauseEventSuppress(BG_RETURN_GRACE_MS);
          }
          executeSeamlessWakeup();
        }
        if (state.startupPhase && !state.startupPrimed && pageLoadedForAutoplay()) {
          maybePrimeStartup();
          scheduleStartupAutoplayKick();
        }
      }, { passive: true, capture: true });
      // iOS pagehide — save state before the page may be frozen
      window.addEventListener("pagehide", e => {
        if (state.intendedPlaying) {
          updateLastKnownGoodVT();
          if (platform.useBgControllerRetry) {
            noteBackgroundEntry();
            state.resumeOnVisible = true;
          }
        }
      }, { passive: true, capture: true });
    } catch {}
    window.addEventListener("visibilitychange", () => {
      const newState = document.visibilityState;
      state.lastVisibilityState = newState;
      state.visibilityTransitionActive = true;
      state.visibilityTransitionUntil = now() + VISIBILITY_TRANSITION_MS;
      state.visibilityStableUntil = now() + VISIBILITY_TRANSITION_MS;
      state.tabVisibilityChangeUntil = now() + TAB_VISIBILITY_STABLE_MS;
      if (newState === "visible") {
        // Let the tab-return manager handle immunity, intercept, rapid counter
        // resets, alt-tab flag clearing, instant play, and bbtab/wakeup retry.
        SmoothTabWelcomeBackManagement.onTabReturn();

        try { QuantumReturnOrchestrator.preemptivePlay(); } catch {}
        VisibilityGuard.onTabShow();

        state.lastBgReturnAt = now();
        BackgroundPlaybackManager.onBecomeForeground();
        BackgroundPlaybackManagerManager.onForegroundReturn(); // reset oscillation counters
        // Arm the BringBackToTab lock before any pause events fire
        if (state.intendedPlaying) BringBackToTabManager.onTabReturn();
        try { UltraStabilizer.onVisibilityChange(true); } catch {}

        clearHiddenMediaSessionPlay();
        state.bgAutoResumeSuppressed = false;
        state.startupAudioHoldUntil = 0;
        state.bgTransitionInProgress = false;
        state.bgPauseSuppressionCount = 0;
        state.bgPauseSuppressionResetAt = now();
        state.pauseEventCount = 0;
        state.pauseEventResetAt = now();
        state.mediaErrorCount = 0;

        if (platform.chromiumOnlyBrowser) {
          state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + 400);
          state.chromiumAudioStartLockUntil = 0; // Don't block audio on tab return
          state.mediaSessionPauseBlockedUntil = Math.max(state.mediaSessionPauseBlockedUntil, now() + 800);
          setChromiumPauseEventSuppress(800);
          setChromiumBgPauseBlock(800);
          setChromiumAutoPauseBlock(800);
        }

        // Also reset focusStableUntil — on tab return, focus is immediately stable.
        state.focusStableUntil = 0;

        state.startupAutoplayRetryCount = 0;
        state.bgAudioStartQueued = false;

        // Force position to 0 on tab return if startup hasn't committed yet
        if (!state.firstPlayCommitted && wantsStartupAutoplay()) {
          forceZeroBeforeFirstPlay();
        }

        if (state.intendedPlaying) {
          // instantPlay + startBringBackRetry + executeSeamlessWakeup already
          // called by SmoothTabWelcomeBackManagement.onTabReturn() above.

          if (platform.useBgControllerRetry) {
            state.resumeOnVisible = false;
            state.bgHiddenWasPlaying = false;

            // If startup hasn't committed yet, also wake the startup machinery so it
            // can run its sequencing (AVLG check, audio startup, etc.) alongside the
            // direct play() above. One will succeed first; the other is a no-op.
            if (!state.firstPlayCommitted && wantsStartupAutoplay() && !state.startupKickInFlight) {
              if (!state.startupAutoplayRetryTimer) {
                scheduleStartupAutoplayRetry();
              }
            }
          } else {
            state.resumeOnVisible = false;
            state.bgHiddenWasPlaying = false;
            setFastSync(800);
            scheduleSync(0);
          }

          if (coupledMode && !state.audioEverStarted && !getVideoPaused()) {
            setTimeout(() => {
              if (!state.intendedPlaying || state.audioEverStarted) return;
              if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
              const vt = Number(video.currentTime()) || 0;
              quietSeekAudio(vt).catch(() => {});
              execProgrammaticAudioPlay({ squelchMs: 600, force: true, minGapMs: 0 })
              .then(ok => { if (ok) state.audioEverStarted = true; })
              .catch(() => {});
            }, 350);
          }

          // Smooth fade-in: audio started at vol 0 to prevent pop — fade to target
          if (coupledMode && audio) {
            setTimeout(() => {
              if (!state.intendedPlaying) return;
              if (audio.paused) return;
              softUnmuteAudio(120).catch(() => {});
            }, 80);
          }
        }
        // Startup retry on tab-return: kick the startup kick regardless.
        if (wantsStartupAutoplay() && pageLoadedForAutoplay()) {
          state.startupAutoplayRetryCount = 0;
          if (!state.startupKickDone && !state.firstPlayCommitted) {
            if (!state.startupAutoplayRetryTimer && !state.startupKickInFlight) {
              scheduleStartupAutoplayKick();
            }
          }
        }
        setTimeout(() => { state.visibilityTransitionActive = false; }, VISIBILITY_TRANSITION_MS);
      } else {
        // Let tab-return manager clean up: bumps gen, clears immunity,
        // disengages intercept, cancels audio mute, clears timers, snapshots QRO.
        SmoothTabWelcomeBackManagement.onTabLeave();
        updateLastKnownGoodVT();
        VisibilityGuard.onTabHide();
        BackgroundPlaybackManager.onBecomeBackground();
        state.bgTransitionInProgress = true;
        if (platform.useBgControllerRetry) {
          noteBackgroundEntry();
          state.bgAutoResumeSuppressed = true;
          if (state.intendedPlaying) state.resumeOnVisible = true;
        } else {
          state.bgAutoResumeSuppressed = false;
          if (coupledMode && state.intendedPlaying) {
            noteBackgroundEntry();
            state.resumeOnVisible = true;
            state.bgHiddenWasPlaying = true;
          } else {
            state.resumeOnVisible = false;
            state.bgHiddenWasPlaying = false;
          }
        }
        // If the startup kick was in-flight when we hid, release the lock so a
        if (!state.firstPlayCommitted && state.startupKickInFlight) {
          state.startupKickInFlight = false;
        }
      }
    }, { passive: true, capture: true });
    window.addEventListener("blur", () => {
      // Let tab-return manager clean up: bumps gen, clears immunity,
      // disengages intercept, cancels audio mute, clears timers, snapshots QRO.
      SmoothTabWelcomeBackManagement.onTabLeave();
      VisibilityGuard.onTabHide();
      BackgroundPlaybackManager.onBecomeBackground();
      if (!platform.chromiumOnlyBrowser) return;
      state.lastFocusLoss = now();
      state.focusLossCount++;
      if ((now() - state.focusLossResetAt) > FOCUS_LOSS_RESET_MS) {
        state.focusLossCount = 1;
        state.focusLossResetAt = now() + FOCUS_LOSS_RESET_MS;
      }
      if (state.focusLossCount >= 1 && state.intendedPlaying) {
        state.altTabTransitionActive = true;
        state.altTabTransitionUntil = now() + ALT_TAB_TRANSITION_MS;
        state.focusStableUntil = now() + ALT_TAB_TRANSITION_MS;
        setChromiumAutoPauseBlock(ALT_TAB_TRANSITION_MS + 2000);
        setChromiumBgPauseBlock(CHROMIUM_BG_PAUSE_BLOCK_MS);
        // Use ALT_TAB_TRANSITION_MS (3500ms) instead of CHROMIUM_PAUSE_EVENT_SUPPRESS_M
        setChromiumPauseEventSuppress(ALT_TAB_TRANSITION_MS);
      }
    }, { passive: true, capture: true });
    window.addEventListener("focus", () => {
      // Let tab-return manager handle immunity, intercept, rapid counter resets,
      // alt-tab flag clearing, instant play, and bbtab/wakeup retry.
      SmoothTabWelcomeBackManagement.onTabReturn();

      try { QuantumReturnOrchestrator.preemptivePlay(); } catch {}
      VisibilityGuard.onTabShow();
      BackgroundPlaybackManager.onBecomeForeground();
      BackgroundPlaybackManagerManager.onForegroundReturn(); // reset oscillation state

      state.lastBgReturnAt = Math.max(state.lastBgReturnAt, now());
      state.focusStableUntil = now() + 300;
      state.pauseEventCount = 0;
      state.pauseEventResetAt = now();

      if (platform.chromiumOnlyBrowser) {
        setChromiumPauseEventSuppress(BG_RETURN_GRACE_MS);
        setChromiumAutoPauseBlock(BG_RETURN_GRACE_MS);
        setChromiumBgPauseBlock(CHROMIUM_BG_PAUSE_BLOCK_MS);
      }

      if (state.intendedPlaying) {
        // instantPlay + startBringBackRetry + executeSeamlessWakeup already
        // called by SmoothTabWelcomeBackManagement.onTabReturn() above.
        BringBackToTabManager.onTabReturn();
        if (document.visibilityState !== "visible") {
          // Tab still hidden (focus fired before visibilitychange) — defer.
          // The visibilitychange→visible handler will handle the rest.
          state.resumeOnVisible = true;
        }
      }
    }, { passive: true, capture: true });
    window.addEventListener("beforeunload", () => {
      clearBgResumeRetryTimer();
      clearResumeAfterBufferTimer();
      clearSeekSyncFinalizeTimer();
      clearSeekWatchdog();
      clearStartupAutoplayRetryTimer();
      clearAudioForcePlayTimer();
      clearTimeout(state.wakeupTimer);
      clearTimeout(state.heartbeatTimer);
      clearTimeout(state.bgSilentTimeSyncTimer);
      if (state.bbtabRetryRafId) { cancelAnimationFrame(state.bbtabRetryRafId); state.bbtabRetryRafId = null; }
      if (state.bbtabRetryTimer) { clearTimeout(state.bbtabRetryTimer); state.bbtabRetryTimer = null; }
      if (state.bbtabAudioSyncTimer) { clearTimeout(state.bbtabAudioSyncTimer); state.bbtabAudioSyncTimer = null; }
      clearSyncLoop();
    });
  }

  function forceAudioStartupPlay() {
    if (!coupledMode || !audio || state.audioStartupPlayAttempted) return;
    if (!state.intendedPlaying && !wantsStartupAutoplay()) return;
    if (state.startupPrimed && state.firstPlayCommitted) return;
    if (!pageLoadedForAutoplay()) return;
    state.audioStartupPlayAttempted = true;
    const tryPlay = () => {
      if (state.audioStartupPlayRetries >= MAX_AUDIO_STARTUP_RETRIES) return;
      if (!audio || (!state.intendedPlaying && !wantsStartupAutoplay())) return;
      // Once the startup kick has committed play (firstPlayCommitted=true), the norma
      if (state.firstPlayCommitted) return;
      if (!audio.paused) {
        state.audioEverStarted = true;
        return;
      }
      if (state.startupKickInFlight) {
        // The startup kick is running playTogether which already handles audio startup
        // via execProgrammaticAudioPlay. Competing with it causes extra play/pause events
        // and increment the rapid-play-pause counter. Back off significantly.
        state.audioStartupPlayRetries++;
        state.audioForcePlayTimer = setTimeout(tryPlay, AUDIO_STARTUP_PLAY_RETRY_MS * 4);
        return;
      }
      const rs = Number(audio.readyState || 0);
      if (rs < 2) {
        state.audioStartupPlayRetries++;
        state.audioForcePlayTimer = setTimeout(tryPlay, AUDIO_STARTUP_PLAY_RETRY_MS);
        return;
      }
      // --- UltraStabilizer startup gate
      const vrs = getVideoReadyState();
      if (UltraStabilizer.shouldBlockAudioAtStartup() || vrs < 3) {
        state.audioStartupPlayRetries++;
        state.audioForcePlayTimer = setTimeout(tryPlay, AUDIO_STARTUP_PLAY_RETRY_MS);
        return;
      }
      try {
        audio.volume = 0;
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        squelchAudioEvents(800);
        const p = audio.play();
        if (p && p.then) {
          p.then(() => {
            state.audioEverStarted = true;
            state.audioStartupPlayRetries = 0;
            fadeAudioIn(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
          }).catch(() => {
            state.audioStartupPlayRetries++;
            state.audioForcePlayTimer = setTimeout(tryPlay, AUDIO_STARTUP_PLAY_RETRY_MS);
          });
        }
      } catch {
        state.audioStartupPlayRetries++;
        state.audioForcePlayTimer = setTimeout(tryPlay, AUDIO_STARTUP_PLAY_RETRY_MS);
      }
    };
    state.audioForcePlayTimer = setTimeout(tryPlay, 150);
  }

  function clearAudioForcePlayTimer() {
    if (state.audioForcePlayTimer) {
      clearTimeout(state.audioForcePlayTimer);
      state.audioForcePlayTimer = null;
    }
  }

  // Force video to zero at startup before any play to prevent mid-video start
  if (wantsStartupAutoplay() && !state.firstPlayCommitted) {
    try {
      videoEl.currentTime = 0;
      if (audio) audio.currentTime = 0;
    } catch {}

    // Continuously enforce t=0 while loading in background — browsers can buffer/seek
    // to non-zero keyframes before we start playing. Remove once first play committed.
    const enforceStartAtZero = () => {
      if (state.firstPlayCommitted) {
        try { videoEl.removeEventListener("timeupdate", enforceStartAtZero); } catch {}
        return;
      }
      const vt = Number(videoEl.currentTime) || 0;
      if (vt > 0.5) {
        try { video.currentTime(0); } catch {}
        try { videoEl.currentTime = 0; } catch {}
        if (audio) try { audio.currentTime = 0; } catch {}
      }
    };
    try { videoEl.addEventListener("timeupdate", enforceStartAtZero, { passive: true }); } catch {}
    // Also clean up if user manually seeks before playing
    try {
      videoEl.addEventListener("seeking", () => {
        try { videoEl.removeEventListener("timeupdate", enforceStartAtZero); } catch {}
      }, { once: true, passive: true });
    } catch {}
  }

  setupUserPauseIntentDetection();
  setupMediaSession();
  bindCommonMediaEvents();
  setupVisibilityLifecycle();
  setupMediaErrorHandlers();
  setupHeartbeat();

  loadSavedVolume();

  if (coupledMode) {
    try {
      audio.preload = "auto";
      audio.load();
    } catch {}
    const maybeStart = () => maybePrimeStartup();
    const bindStartupOnce = (el, type) => {
      const fn = () => {
        if (state.startupPrimed) {
          try { el.removeEventListener(type, fn); } catch {}
          return;
        }
        maybeStart();
        if (state.startupPrimed) {
          try { el.removeEventListener(type, fn); } catch {}
        }
      };
      try { el.addEventListener(type, fn, { passive: true }); } catch {}
    };
    bindStartupOnce(audio, "loadeddata");
    bindStartupOnce(audio, "loadedmetadata");
    bindStartupOnce(audio, "canplay");
    bindStartupOnce(audio, "playing", () => {
      clearAudioForcePlayTimer();
      state.audioStartupPlayRetries = 0;
    });
    bindStartupOnce(videoEl, "loadeddata");
    bindStartupOnce(videoEl, "loadedmetadata");
    bindStartupOnce(videoEl, "canplay");
  }
  video.on("volumechange", () => {
    if (!state.audioFading) {
      updateAudioGainImmediate();
    }
    state.userMutedVideo = !!video.muted();
    saveVolume();
  });
  if (coupledMode) {
    try {
      audio.addEventListener("volumechange", () => {
        state.userMutedAudio = !!audio.muted;
        saveVolume();
      }, { passive: true });
    } catch {}
  }

  // --- runtime SD/muxed detection
  if (coupledMode && audio) {
    let audioAlive = false;
    const markAudioAlive = () => { audioAlive = true; };
    // Any of these events means audio has real data
    try { audio.addEventListener("loadeddata", markAudioAlive, { once: true, passive: true }); } catch {}
    try { audio.addEventListener("canplay", markAudioAlive, { once: true, passive: true }); } catch {}
    try { audio.addEventListener("playing", markAudioAlive, { once: true, passive: true }); } catch {}
    try { audio.addEventListener("timeupdate", markAudioAlive, { once: true, passive: true }); } catch {}

    const switchToNonCoupled = (reason) => {
      if (!coupledMode) return; // already switched
      coupledMode = false;
      // Silence and disable the dead audio element
      try { audio.muted = true; audio.volume = 0; } catch {}
      try { audio.preload = "none"; } catch {}
      try { if (!audio.paused) audio.pause(); } catch {}
      // Enable MQM (it checks !coupledMode internally via enabled flag, but since
      // coupledMode was true at construction, we need to re-enable the startup path)
      state.startupPrimed = true;
      // If video was stuck waiting for audio, unblock it
      state.videoStallAudioPaused = false;
      state.stallAudioPausedSince = 0;
      state.stallAudioResumeHoldUntil = 0;
      state.strictBufferHold = false;
      state.bufferHoldSince = 0;
      state.strictBufferReason = "";
      // If intendedPlaying, kick video to start
      if (state.intendedPlaying || wantsStartupAutoplay()) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          state.startupPhase = false;
        }
        execProgrammaticVideoPlay();
      }
      scheduleSync(0);
    };

    // Audio error → immediate switch
    const onAudioError = () => {
      if (audioAlive) return; // had data before error, don't switch
      switchToNonCoupled("audio-error");
    };
    try { audio.addEventListener("error", onAudioError, { once: true, passive: true }); } catch {}
    try {
      const srcEl = audio.querySelector?.("source");
      if (srcEl) srcEl.addEventListener("error", onAudioError, { once: true, passive: true });
    } catch {}

    // Timeout: if audio never produces data within 8s, switch
    setTimeout(() => {
      if (!audioAlive && coupledMode) {
        // Check one more time: maybe it loaded but we missed the event
        try {
          const rs = Number(audio.readyState || 0);
          const dur = Number(audio.duration || 0);
          if (rs >= 2 || (isFinite(dur) && dur > 0)) { audioAlive = true; return; }
        } catch {}
        switchToNonCoupled("audio-timeout");
      }
    }, 8000);

    // Also check at 3s for faster detection of obviously dead audio
    setTimeout(() => {
      if (!audioAlive && coupledMode) {
        try {
          const ns = audio.networkState;
          const rs = Number(audio.readyState || 0);
          // networkState 3 = NETWORK_NO_SOURCE, or readyState stuck at 0
          if (ns === 3 || (rs === 0 && audio.error)) {
            switchToNonCoupled("audio-dead-early");
          }
        } catch {}
      }
    }, 3000);
  }

  state.bgPlaybackAllowed = true;
  state.backgroundAutoplayTriggered = true;
  setTimeout(() => {
    if (coupledMode && state.startupPhase && !state.startupPrimed && pageLoadedForAutoplay()) {
      maybePrimeStartup();
      scheduleStartupAutoplayKick();
      forceAudioStartupPlay();
    }
  }, 100);
  // Only schedule the initial sync tick if the page is already fully loaded.
  if (pageLoadedForAutoplay()) {
    scheduleSync(0);
  }
  // else: window.load handler triggers maybePrimeStartup + scheduleSync via
  // the coupledMode branch, or scheduleSync(0) directly for non-coupled.
});


(function () {
    function isTypingTarget(el) {
        if (!el || !(el instanceof Element)) return false;

        if (el.matches('.search-bar, #fname, input[name="query"]')) return true;
        if (el.closest('form[action="/search"]')) return true;
        if (el.isContentEditable) return true;

        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'textarea' || tag === 'select') return true;

        if (tag === 'input') {
            const type = (el.getAttribute('type') || 'text').toLowerCase();

            const allowedNonTypingInputs = new Set([
                'button',
                'checkbox',
                'color',
                'file',
                'hidden',
                'image',
                'radio',
                'range',
                'reset',
                'submit'
            ]);

            return !allowedNonTypingInputs.has(type);
        }

        if (
            el.matches(
                '[contenteditable], [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]'
            )
        ) {
            return true;
        }

        const parentTypingEl = el.closest(
            '.search-bar, #fname, input[name="query"], form[action="/search"], textarea, select, input, [contenteditable], [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]'
        );

        return !!parentTypingEl;
    }

    function getPlayer() {
        const videoElement = document.querySelector('.video-js');
        if (!videoElement || typeof videojs === 'undefined') return null;
        return videojs.getPlayer(videoElement) || videojs(videoElement);
    }

    document.addEventListener('keydown', function (event) {
        if (event.defaultPrevented) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.isComposing || event.keyCode === 229) return;

        const target = event.target;
        const active = document.activeElement;
        const searchInput = document.querySelector('.search-bar, #fname, input[name="query"]');

        if (isTypingTarget(target) || isTypingTarget(active)) return;
        if (searchInput && active === searchInput) return;
        if (searchInput && searchInput.matches(':focus, :focus-within')) return;

        const player = getPlayer();
        if (!player) return;

        const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';

        switch (key) {
            case 'f':
                event.preventDefault();
                if (player.isFullscreen()) {
                    player.exitFullscreen();
                } else {
                    player.requestFullscreen();
                }
                break;

            case 'k':
            case ' ':
            case 'spacebar':
                event.preventDefault();
                if (player.paused()) {
                    player.play();
                } else {
                    player.pause();
                }
                break;

            case 'm':
                event.preventDefault();
                player.muted(!player.muted());
                break;

            case 'arrowright':
            case 'l':
                event.preventDefault();
                player.currentTime(Math.min(player.duration() || Infinity, player.currentTime() + 10));
                break;

            case 'arrowleft':
            case 'j':
                event.preventDefault();
                player.currentTime(Math.max(0, player.currentTime() - 10));
                break;

            case 'arrowup':
                event.preventDefault();
                if (player.muted() && player.volume() === 0) {
                    player.muted(false);
                }
                player.volume(Math.min(1, Math.round((player.volume() + 0.1) * 10) / 10));
                break;

            case 'arrowdown':
                event.preventDefault();
                player.volume(Math.max(0, Math.round((player.volume() - 0.1) * 10) / 10));
                if (player.volume() === 0) {
                    player.muted(true);
                }
                break;
        }
    });
})(); 

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
  ANDROID_USER_AGENT:
    "com.google.android.youtube/20.20.41 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
  ANDROID_SDK_VERSION: 36,
  ANDROID_VERSION: "16",

  ANDROID_TS_APP_VERSION: "1.9",
  ANDROID_TS_USER_AGENT:
    "com.google.android.youtube/1.9 (Linux; U; Android 16; US) gzip",

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
      version: "2.20250917.02.00",
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
const base_player_old_old_old_old_old = "https://www.youtube.com/s/player/0004de42/player_ias.vflset/en_US/base.js";

const hey = " please dont use the above player base stuff!! tyyyyyyyy <3 "
const youtubeobjects = "https://codeberg.org/ashleyirispuppy/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json"
const watchURl = "https://youtube.com/watch"
const base_player = "https://www.youtube.com/s/player/140dafda/player_ias.vflset/en_US/base.js";
const base_player_poketube = "https://poketube.fun/s/player/140dafda/player_ias.vflset/en_US/base.js";

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
customVideoJsUI.innerHTML = `:root{--poke-accent-1:#ff0045;--poke-accent-2:#ff0e55;--poke-accent-3:#ff1d79;--glass-bg:rgba(20, 20, 20, 0.38);--glass-bg-hover:rgba(20, 20, 20, 0.46);--glass-border:rgba(255, 255, 255, 0.22);--glass-border-strong:rgba(255, 255, 255, 0.30);--glass-shadow:0 10px 30px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.10);--scene-contrast-wash:rgba(0,0,0,0.10);--ui-text:rgba(255,255,255,0.96);--ui-text-soft:rgba(255,255,255,0.86);--ui-text-shadow:0 1px 2px rgba(0,0,0,0.65);--ui-text-outline:0 0 1px rgba(0,0,0,0.70);--r-outer:16px;--r-pill:999px;--r-bubble:1em;--btn:38px;--btn-mobile:34px;--bar-bottom:12px;--bar-bottom-mobile:10px}.video-js,.video-js .vjs-poster,.video-js .vjs-poster img,.video-js .vjs-tech{border-radius:var(--r-outer) !important}.vjs-title-bar{background:none !important;border-radius:var(--r-outer);overflow:hidden}.vjs-title-bar-title{font-family:"PokeTube Flex", sans-serif !important;font-stretch:ultra-expanded;font-weight:1000;font-size:1.5em;color:var(--ui-text) !important;text-shadow:var(--ui-text-shadow);-webkit-text-stroke:0.35px rgba(0,0,0,0.35)}.vjs-title-bar-description{width:fit-content;border-radius:var(--r-bubble);padding:1em;font-family:"PokeTube Flex", "poketube flex", sans-serif;font-weight:600;font-stretch:semi-expanded;color:var(--ui-text);text-shadow:var(--ui-text-shadow);filter: drop-shadow(0 8px 22px rgba(0,0,0,0.25));background:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)), linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)), var(--glass-bg);border:1px solid var(--glass-border);-webkit-backdrop-filter: blur(14px) saturate(170%);backdrop-filter: blur(14px) saturate(170%)}.video-js .vjs-control-bar{bottom:var(--bar-bottom) !important}.vjs-control-bar{background:transparent !important;border:none !important;box-shadow:none !important;display:flex !important;align-items:center !important;gap:2px;padding:6px 10px;border-radius:var(--r-outer);background:linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05)), linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)) !important;-webkit-backdrop-filter: blur(12px) saturate(160%);backdrop-filter: blur(12px) saturate(160%);border:1px solid rgba(255,255,255,0.12) !important;box-shadow:0 12px 34px rgba(0,0,0,0.26) !important}.vjs-control-bar .vjs-button{width:var(--btn);height:var(--btn);min-width:var(--btn);border-radius:50%;background:linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)), linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)), var(--glass-bg);-webkit-backdrop-filter: blur(12px) saturate(160%);backdrop-filter: blur(12px) saturate(160%);border:1px solid var(--glass-border);box-shadow:var(--glass-shadow);display:inline-flex;align-items:center;justify-content:center;margin:0 6px;transition:transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;vertical-align:middle}.vjs-control-bar .vjs-button:hover{background:linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.12)), linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.12)), var(--glass-bg-hover);border-color:var(--glass-border-strong);box-shadow:0 12px 32px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(255,255,255,0.16);transform:translateY(-1px)}.vjs-control-bar .vjs-button:active{transform:translateY(0)}.vjs-control-bar .vjs-button:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(255,0,90,0.35), inset 0 0 0 1px rgba(255,255,255,0.20), 0 12px 34px rgba(0,0,0,0.32);border-color:rgba(255,255,255,0.30)}.vjs-control-bar .vjs-icon-placeholder:before{font-size:18px;line-height:var(--btn);color:var(--ui-text);text-shadow:var(--ui-text-shadow);filter: drop-shadow(var(--ui-text-outline))}.vjs-current-time,.vjs-duration,.vjs-remaining-time,.vjs-time-divider{background:transparent;padding:0 8px;border-radius:var(--r-pill);box-shadow:none;margin:0;height:var(--btn);line-height:1;display:inline-flex;align-items:center;color:var(--ui-text-soft) !important;text-shadow:var(--ui-text-shadow)}.vjs-fullscreen-control,.vjs-remaining-time{background-color:transparent !important}.vjs-progress-control{flex:1 1 auto;display:flex !important;align-items:center !important;margin:0 6px;padding:0;height:var(--btn)}.vjs-progress-control .vjs-progress-holder{height:8px !important;border-radius:var(--r-pill) !important;background:transparent !important;border:none;box-shadow:none;position:relative;margin:0;width:100%;overflow:hidden}.vjs-progress-control .vjs-progress-holder::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)), linear-gradient(180deg, rgba(0,0,0,0.14), rgba(0,0,0,0.14)), rgba(20,20,20,0.34);-webkit-backdrop-filter: blur(12px) saturate(160%);backdrop-filter: blur(12px) saturate(160%);border:1px solid rgba(255,255,255,0.18);box-shadow:0 8px 24px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.10);pointer-events:none}.vjs-progress-control .vjs-load-progress,.vjs-progress-control .vjs-play-progress{position:relative;z-index:1;border-radius:inherit !important}.vjs-play-progress,.vjs-progress-control .vjs-play-progress{background-image:linear-gradient(to right, var(--poke-accent-1), var(--poke-accent-2), var(--poke-accent-3)) !important}.vjs-progress-control .vjs-slider-handle{width:14px !important;height:14px !important;border-radius:50% !important;background:rgba(255,255,255,0.95) !important;border:1px solid rgba(255,255,255,0.95);box-shadow:0 8px 20px rgba(0,0,0,0.35), 0 0 0 3px rgba(255,0,90,0.22);top:-4px !important;z-index:2}.vjs-volume-panel{gap:8px;align-items:center !important;padding:0;height:var(--btn)}.vjs-volume-bar{height:6px !important;border-radius:var(--r-pill) !important;background:linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06)), linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18)), rgba(18,18,18,0.40) !important;border:1px solid rgba(255,255,255,0.16);box-shadow:0 8px 20px rgba(0,0,0,0.20);position:relative;overflow:hidden}.vjs-volume-level{border-radius:inherit !important;background-image:linear-gradient(to right, var(--poke-accent-1), var(--poke-accent-3)) !important}.vjs-volume-bar .vjs-slider-handle{width:12px !important;height:12px !important;border-radius:50% !important;background:rgba(255,255,255,0.95) !important;border:1px solid rgba(255,255,255,0.95);top:-3px !important;box-shadow:0 6px 16px rgba(0,0,0,0.28), 0 0 0 3px rgba(255,0,90,0.20)}@media (max-width: 640px){.video-js .vjs-control-bar{bottom:var(--bar-bottom-mobile) !important}.vjs-control-bar{gap:8px;padding:6px 8px}.vjs-control-bar .vjs-button{width:var(--btn-mobile);height:var(--btn-mobile);min-width:var(--btn-mobile)}.vjs-control-bar .vjs-icon-placeholder:before{font-size:16px;line-height:var(--btn-mobile)}.vjs-current-time,.vjs-duration,.vjs-remaining-time,.vjs-time-divider{height:var(--btn-mobile)}.vjs-progress-control{height:var(--btn-mobile)}.vjs-progress-control .vjs-slider-handle{width:12px !important;height:12px !important;top:-3px !important}}@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){.vjs-control-bar,.vjs-control-bar .vjs-button,.vjs-progress-control .vjs-progress-holder::before,.vjs-title-bar-description,.vjs-volume-bar{-webkit-backdrop-filter: none !important;backdrop-filter: none !important;background:rgba(18,18,18,0.72) !important;border-color:rgba(255,255,255,0.18) !important}}`;


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
	styles.textContent = `.vjs-control-bar {z-index: 21;}`;
	document.body.append(styles);
}