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
  const VIDEO_CONFIG = {
    controls: true,
    autoplay: false,
    preload: 'auto',
    errorDisplay: false,
    playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3],
  };

  const video = videojs('video', VIDEO_CONFIG);
  const videoEl = document.getElementById('video');
  const audio = document.getElementById('aud');

  const urlParams = new URLSearchParams(window.location.search);
  const qualityParam = urlParams.get("quality") || "";
  const vidKey = urlParams.get('v') || "";
  const forceLoopParam = urlParams.get("loop");

  const SYNC_CONFIG = {
    maxDrift: 0.25,
    maxDriftAtHighSpeed: 0.45,
    highSpeedThreshold: 1.5,
    syncIntervalMs: 100,
    stallTimeoutMs: 500,
    resumeGracePeriodMs: 300,
  };

  let state = {
    intendedPlaying: false,
    isSeeking: false,
    isBuffering: false,
    isStalled: false,
    startupPhase: true,
    firstPlayCommitted: false,
    userMuted: false,
    userVolume: 1.0,
    playbackRate: 1.0,
    loopDesired: false,
    hasExternalAudio: false,
    syncIntervalId: null,
    stallTimerId: null,
    resumeTimerId: null
  };

  try {
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
  } catch (e) {}

  video.ready(() => {
    const metaTitle = document.querySelector('meta[name="title"]')?.content || "";
    const metaDesc = document.querySelector('meta[name="twitter:description"]')?.content || "";
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

    const handleFullscreen = () => {
      const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
      if (isFullscreen) {
        createTitleBar();
      } else {
        removeTitleBar();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreen, { passive: true });
    document.addEventListener("webkitfullscreenchange", handleFullscreen, { passive: true });
    handleFullscreen();
  });

  const checkLoopDesired = () => {
    state.loopDesired = !!videoEl.loop || videoEl.hasAttribute('loop') || forceLoopParam === "1" || forceLoopParam === "true" || window.forceLoop === true;
    return state.loopDesired;
  };

  try {
    videoEl.loop = false;
    videoEl.removeAttribute?.('loop');
    if (audio) {
      audio.loop = false;
      audio.removeAttribute?.('loop');
    }
  } catch (e) {}

  const clampVolume = (val) => Math.max(0, Math.min(1, Number(val) || 0));

  const extractAudioSource = () => {
    if (!audio) return null;
    const srcAttr = audio.getAttribute('src');
    if (srcAttr) return srcAttr;
    const sourceChild = audio.querySelector('source');
    if (sourceChild && sourceChild.getAttribute('src')) return sourceChild.getAttribute('src');
    if (audio.currentSrc) return audio.currentSrc;
    return null;
  };

  const videoSrcObj = video.src();
  const videoSrc = Array.isArray(videoSrcObj) ? (videoSrcObj[0] && videoSrcObj[0].src) : videoSrcObj;
  state.hasExternalAudio = !!audio && audio.tagName === 'AUDIO' && !!extractAudioSource();

  const isMediaReady = (mediaElement) => {
    try {
      return mediaElement && Number(mediaElement.readyState) >= 3; 
    } catch (e) {
      return false;
    }
  };

  const bothMediaReady = () => {
    if (!state.hasExternalAudio) return isMediaReady(videoEl);
    return isMediaReady(videoEl) && isMediaReady(audio);
  };

  const updateMediaSessionState = () => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state.intendedPlaying ? 'playing' : 'paused';
    } catch (e) {}
  };

  const updateMediaSessionPosition = () => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    try {
      const duration = Number(video.duration()) || 0;
      const position = Number(video.currentTime()) || 0;
      const playbackRate = Number(video.playbackRate()) || 1;
      
      if (duration > 0 && position >= 0 && position <= duration) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: playbackRate,
          position: position
        });
      }
    } catch (e) {}
  };

  const setupMediaSession = () => {
    if (!('mediaSession' in navigator)) return;
    
    const artworkData = vidKey ? [
      { src: `https://i.ytimg.com/vi/${vidKey}/default.jpg`, sizes: "120x90", type: "image/jpeg" },
      { src: `https://i.ytimg.com/vi/${vidKey}/mqdefault.jpg`, sizes: "320x180", type: "image/jpeg" },
      { src: `https://i.ytimg.com/vi/${vidKey}/hqdefault.jpg`, sizes: "480x360", type: "image/jpeg" },
      { src: `https://i.ytimg.com/vi/${vidKey}/sddefault.jpg`, sizes: "640x480", type: "image/jpeg" },
      { src: `https://i.ytimg.com/vi/${vidKey}/maxresdefault.jpg`, sizes: "1280x720", type: "image/jpeg" }
    ] : [];

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: document.title || 'Video',
        artist: typeof authorchannelname !== "undefined" ? authorchannelname : "",
        artwork: artworkData
      });
    } catch (e) {}

    updateMediaSessionState();

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        dispatchPlay();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        dispatchPause();
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = Number(details?.seekOffset) || 10;
        const target = Math.min((video.currentTime() || 0) + offset, Number(video.duration()) || 0);
        executeSeek(target);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = Number(details?.seekOffset) || 10;
        const target = Math.max((video.currentTime() || 0) - offset, 0);
        executeSeek(target);
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (!details || typeof details.seekTime !== 'number') return;
        const target = Math.max(0, Math.min(Number(video.duration()) || 0, details.seekTime));
        executeSeek(target);
      });
    } catch (e) {}
  };

  const uiErrorIndicator = document.getElementById('loopedIndicator');
  
  const showBufferingUI = () => {
    if (!uiErrorIndicator) return;
    uiErrorIndicator.textContent = "Buffering...";
    uiErrorIndicator.style.display = 'block';
    uiErrorIndicator.style.width = 'fit-content';
  };

  const hideBufferingUI = () => {
    if (!uiErrorIndicator) return;
    uiErrorIndicator.style.display = 'none';
  };

  const synchronizeVolume = () => {
    if (!state.hasExternalAudio) return;
    try {
      const vidMuted = typeof video.muted === 'function' ? video.muted() : videoEl.muted;
      const vidVol = typeof video.volume === 'function' ? video.volume() : videoEl.volume;
      
      state.userMuted = !!vidMuted;
      state.userVolume = clampVolume(vidVol);
      
      audio.muted = state.userMuted;
      audio.volume = state.userMuted ? 0 : state.userVolume;
    } catch (e) {}
  };

  const synchronizePlaybackRate = () => {
    try {
      const currentRate = Number(video.playbackRate()) || 1;
      state.playbackRate = currentRate;
      if (state.hasExternalAudio) {
        audio.playbackRate = currentRate;
      }
      updateMediaSessionPosition();
    } catch (e) {}
  };

  const executeSeek = (targetTime) => {
    if (!isFinite(targetTime)) return;
    state.isSeeking = true;
    try {
      video.currentTime(targetTime);
      if (state.hasExternalAudio) {
        audio.currentTime = targetTime;
      }
    } catch (e) {}
  };

  const alignPlayheads = (force = false) => {
    if (!state.hasExternalAudio || state.isSeeking) return;
    try {
      const vidTime = Number(video.currentTime());
      const audTime = Number(audio.currentTime);
      
      if (!isFinite(vidTime) || !isFinite(audTime)) return;

      const drift = Math.abs(vidTime - audTime);
      const activeThreshold = state.playbackRate >= SYNC_CONFIG.highSpeedThreshold 
        ? SYNC_CONFIG.maxDriftAtHighSpeed 
        : SYNC_CONFIG.maxDrift;

      if (force || drift > activeThreshold) {
        audio.currentTime = vidTime;
      }
    } catch (e) {}
  };

  const performActualPlay = async () => {
    if (state.isSeeking || state.isBuffering) return;
    
    let videoPromise;
    let audioPromise;
    
    try {
      videoPromise = video.play();
    } catch (e) {}

    if (state.hasExternalAudio) {
      try {
        audioPromise = audio.play();
      } catch (e) {}
    }

    try {
      if (videoPromise && typeof videoPromise.then === 'function') {
        await videoPromise;
      }
      if (audioPromise && typeof audioPromise.then === 'function') {
        await audioPromise;
      }
    } catch (e) {
      handlePlaybackFailure();
    }
  };

  const performActualPause = () => {
    try {
      video.pause();
    } catch (e) {}
    
    if (state.hasExternalAudio) {
      try {
        audio.pause();
      } catch (e) {}
    }
  };

  const dispatchPlay = () => {
    state.intendedPlaying = true;
    updateMediaSessionState();
    
    if (state.hasExternalAudio && !bothMediaReady()) {
      handleStallCondition();
      return;
    }
    
    hideBufferingUI();
    alignPlayheads(true);
    performActualPlay();
  };

  const dispatchPause = () => {
    state.intendedPlaying = false;
    updateMediaSessionState();
    hideBufferingUI();
    performActualPause();
    alignPlayheads(true);
  };

  const handlePlaybackFailure = () => {
    if (!state.intendedPlaying) return;
    performActualPause();
    setTimeout(() => {
      if (state.intendedPlaying && bothMediaReady()) {
        performActualPlay();
      }
    }, 250);
  };

  const handleStallCondition = () => {
    if (!state.intendedPlaying || state.isSeeking) return;
    
    state.isBuffering = true;
    performActualPause();
    
    if (!state.stallTimerId) {
      state.stallTimerId = setTimeout(() => {
        if (state.isBuffering && state.intendedPlaying) {
          showBufferingUI();
        }
      }, SYNC_CONFIG.stallTimeoutMs);
    }
  };

  const handleRecoveryCondition = () => {
    if (!state.isBuffering) return;
    
    if (bothMediaReady()) {
      clearTimeout(state.stallTimerId);
      state.stallTimerId = null;
      
      if (state.resumeTimerId) {
        clearTimeout(state.resumeTimerId);
      }
      
      state.resumeTimerId = setTimeout(() => {
        state.isBuffering = false;
        hideBufferingUI();
        if (state.intendedPlaying) {
          alignPlayheads(true);
          performActualPlay();
        }
      }, SYNC_CONFIG.resumeGracePeriodMs);
    }
  };

  const startSyncWatchdog = () => {
    if (state.syncIntervalId) {
      clearInterval(state.syncIntervalId);
    }
    
    state.syncIntervalId = setInterval(() => {
      if (state.isSeeking) return;

      if (state.intendedPlaying) {
        if (!state.isBuffering && !bothMediaReady()) {
          handleStallCondition();
          return;
        }

        if (state.isBuffering && bothMediaReady()) {
          handleRecoveryCondition();
        }

        if (!state.isBuffering) {
          const vidPaused = video.paused();
          const audPaused = state.hasExternalAudio ? audio.paused : false;

          if (vidPaused && !audPaused && state.hasExternalAudio) {
            audio.pause();
            performActualPlay(); 
          } else if (!vidPaused && audPaused && state.hasExternalAudio) {
            audio.play().catch(() => {});
          } else if (vidPaused && audPaused && bothMediaReady()) {
            performActualPlay();
          }

          alignPlayheads(false);
          
          if (state.hasExternalAudio && audio.playbackRate !== state.playbackRate) {
            audio.playbackRate = state.playbackRate;
          }
        }
      } else {
        const vidPaused = video.paused();
        const audPaused = state.hasExternalAudio ? audio.paused : true;
        
        if (!vidPaused || !audPaused) {
          performActualPause();
        }
      }
      
      updateMediaSessionPosition();

    }, SYNC_CONFIG.syncIntervalMs);
  };

  const stopSyncWatchdog = () => {
    if (state.syncIntervalId) {
      clearInterval(state.syncIntervalId);
      state.syncIntervalId = null;
    }
  };

  const performLoopReset = () => {
    state.isSeeking = true;
    performActualPause();
    
    try {
      video.currentTime(0);
      if (state.hasExternalAudio) {
        audio.currentTime = 0;
      }
    } catch (e) {}

    setTimeout(() => {
      state.isSeeking = false;
      if (state.intendedPlaying) {
        alignPlayheads(true);
        performActualPlay();
      }
    }, 50);
  };

  const wireVideoEvents = () => {
    video.on('play', () => {
      if (!state.intendedPlaying) {
        dispatchPlay();
      }
    });

    video.on('pause', () => {
      if (state.intendedPlaying && !state.isBuffering && !state.isSeeking && video.currentTime() < video.duration() - 0.5) {
        dispatchPause();
      }
    });

    video.on('seeking', () => {
      state.isSeeking = true;
      if (state.hasExternalAudio) {
        try {
          audio.currentTime = video.currentTime();
        } catch (e) {}
      }
    });

    video.on('seeked', () => {
      state.isSeeking = false;
      alignPlayheads(true);
      
      if (state.intendedPlaying) {
        if (bothMediaReady()) {
          performActualPlay();
        } else {
          handleStallCondition();
        }
      } else {
        performActualPause();
      }
      updateMediaSessionPosition();
    });

    video.on('waiting', handleStallCondition);
    video.on('stalled', handleStallCondition);
    
    video.on('playing', () => {
      if (state.isBuffering) {
        handleRecoveryCondition();
      } else {
        hideBufferingUI();
      }
    });

    video.on('canplay', handleRecoveryCondition);
    video.on('canplaythrough', handleRecoveryCondition);

    video.on('volumechange', synchronizeVolume);
    video.on('ratechange', synchronizePlaybackRate);

    video.on('ended', () => {
      if (checkLoopDesired()) {
        performLoopReset();
      } else {
        dispatchPause();
      }
    });

    videoEl.addEventListener('waiting', handleStallCondition);
    videoEl.addEventListener('stalled', handleStallCondition);
    videoEl.addEventListener('playing', () => hideBufferingUI());
    videoEl.addEventListener('canplay', handleRecoveryCondition);
    videoEl.addEventListener('canplaythrough', handleRecoveryCondition);
  };

  const wireAudioEvents = () => {
    if (!state.hasExternalAudio) return;

    audio.addEventListener('play', () => {
      if (!state.intendedPlaying) {
        dispatchPlay();
      }
    });

    audio.addEventListener('pause', () => {
      if (state.intendedPlaying && !state.isBuffering && !state.isSeeking && audio.currentTime < audio.duration - 0.5) {
        dispatchPause();
      }
    });

    audio.addEventListener('waiting', handleStallCondition);
    audio.addEventListener('stalled', handleStallCondition);
    
    audio.addEventListener('playing', () => {
      if (state.isBuffering) {
        handleRecoveryCondition();
      } else {
        hideBufferingUI();
      }
    });

    audio.addEventListener('canplay', handleRecoveryCondition);
    audio.addEventListener('canplaythrough', handleRecoveryCondition);

    audio.addEventListener('ended', () => {
      if (checkLoopDesired()) {
        performLoopReset();
      } else {
        dispatchPause();
      }
    });
  };

  const wireVisibilityAndUnload = () => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        
      } else {
        if (state.intendedPlaying) {
          if (!state.syncIntervalId) {
            startSyncWatchdog();
          }
          if (bothMediaReady()) {
            alignPlayheads(true);
            performActualPlay();
          } else {
            handleStallCondition();
          }
        }
      }
    }, { passive: true });

    window.addEventListener('pagehide', () => {
      stopSyncWatchdog();
      performActualPause();
    }, { passive: true });
  };

  const initializeCore = () => {
    if (qualityParam !== "medium" && state.hasExternalAudio) {
      synchronizeVolume();
      synchronizePlaybackRate();
      wireVideoEvents();
      wireAudioEvents();
      wireVisibilityAndUnload();
      setupMediaSession();
      startSyncWatchdog();
      state.startupPhase = false;
    } else {
      wireVisibilityAndUnload();
      setupMediaSession();
      
      video.on('play', () => {
        state.intendedPlaying = true;
        updateMediaSessionState();
      });
      
      video.on('pause', () => {
        state.intendedPlaying = false;
        updateMediaSessionState();
      });
      
      video.on('ended', () => {
        if (checkLoopDesired()) {
          video.currentTime(0);
          video.play();
        } else {
          state.intendedPlaying = false;
          updateMediaSessionState();
        }
      });
    }
  };

  initializeCore();
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


 // https://codeberg.org/ashley/poke/src/branch/main/src/libpoketube/libpoketube-youtubei-objects.json


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
const youtubeobjects = "https://codeberg.org/ashley/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json"
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
  youtubeobjects: "https://codeberg.org/ashley/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json",
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
 const customVideoJsUI = document.createElement('style');
customVideoJsUI.innerHTML = `

.vjs-title-bar-description {
  background: #0007;
  width: fit-content;
  border-radius: 1em;
  padding: 1em;
  font-family: "poketube flex";
  font-weight: 600;
  font-stretch: semi-expanded;
}

.vjs-title-bar {
  background: none !important;
  border-radius: 16px;
  overflow: hidden;
}
.vjs-title-bar-title {
  font-family: "PokeTube Flex", sans-serif !important;
  font-stretch: ultra-expanded;
  font-weight: 1000;
  font-size: 1.5em;
}
.vjs-play-progress{background-image:linear-gradient(to right,#ff0045,#ff0e55,#ff1d79)}.video-js .vjs-control-bar{bottom:12px!important}.vjs-poster{border-radius:16px}.vjs-poster img{border-radius:16px}.vjs-control-bar{background:transparent!important;border:none!important;box-shadow:none!important;display:flex!important;align-items:center!important;gap:2px;padding:6px 10px;border-radius:16px}.vjs-fullscreen-control,.vjs-remaining-time{background-color:transparent!important}.vjs-control-bar .vjs-button{width:38px;height:38px;min-width:38px;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08));-webkit-backdrop-filter:blur(12px) saturate(160%);backdrop-filter:blur(12px) saturate(160%);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.10);display:inline-flex;align-items:center;justify-content:center;margin:0 6px;transition:transform 0.12s ease,box-shadow 0.2s ease,background 0.2s ease;vertical-align:middle}.vjs-control-bar .vjs-button:hover{background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,.12));box-shadow:0 10px 28px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.16);transform:translateY(-1px)}.vjs-control-bar .vjs-button:active{transform:translateY(0)}.vjs-control-bar .vjs-button:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(255,0,90,.35),inset 0 0 0 1px rgba(255,255,255,.2)}.vjs-control-bar .vjs-icon-placeholder:before{font-size:18px;line-height:38px}.vjs-current-time,.vjs-duration,.vjs-remaining-time,.vjs-time-divider{background:transparent;padding:0 8px;border-radius:999px;box-shadow:none;margin:0;height:38px;line-height:1;display:inline-flex;align-items:center}.vjs-progress-control{flex:1 1 auto;display:flex!important;align-items:center!important;margin:0 6px;padding:0;height:38px}.vjs-progress-control .vjs-progress-holder{height:8px!important;border-radius:999px!important;background:transparent!important;border:none;box-shadow:none;position:relative;margin:0;width:100%}.vjs-progress-control .vjs-progress-holder::before{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08));-webkit-backdrop-filter:blur(12px) saturate(160%);backdrop-filter:blur(12px) saturate(160%);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.10);pointer-events:none}.vjs-progress-control .vjs-load-progress,.vjs-progress-control .vjs-play-progress{position:relative;z-index:1;border-radius:inherit!important}.vjs-progress-control .vjs-play-progress{background-image:linear-gradient(to right,#ff0045,#ff0e55,#ff1d79)!important}.vjs-progress-control .vjs-slider-handle{width:14px!important;height:14px!important;border-radius:50%!important;background:#fff!important;border:1px solid rgba(255,255,255,.9);box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 0 3px rgba(255,0,90,.20);top:-4px!important;z-index:2}.vjs-volume-panel{gap:8px;align-items:center!important;padding:0;height:38px}.vjs-volume-bar{height:6px!important;border-radius:999px!important;background:#2c2c2c!important;border:none;box-shadow:none;position:relative}.vjs-volume-level{border-radius:inherit!important;background-image:linear-gradient(to right,#ff0045,#ff1d79)!important}.vjs-volume-bar .vjs-slider-handle{width:12px!important;height:12px!important;border-radius:50%!important;background:#fff!important;border:1px solid rgba(255,255,255,.9);top:-3px!important;box-shadow:0 4px 14px rgba(0,0,0,.3),0 0 0 3px rgba(255,0,90,.18)}@media (max-width:640px){.video-js .vjs-control-bar{bottom:10px!important}.vjs-control-bar{gap:8px;padding:6px 8px}.vjs-control-bar .vjs-button{width:34px;height:34px;min-width:34px}.vjs-control-bar .vjs-icon-placeholder:before{font-size:16px;line-height:34px}.vjs-current-time,.vjs-duration,.vjs-remaining-time,.vjs-time-divider{height:34px}.vjs-progress-control{height:34px}.vjs-progress-control .vjs-slider-handle{width:12px!important;height:12px!important;top:-3px!important}}
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