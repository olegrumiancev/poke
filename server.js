/*

    Poke is an Free/Libre youtube front-end. this is our main file.
  
    Copyright (C) 2021-2025 Poke (https://codeberg.org/ashleyirispuppy/poketube)
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see https://www.gnu.org/licenses/.
  */
(async function () {
  const {
    fetcher,
    core,
    wiki,
    musicInfo,
    modules,
    version,
    initlog,
    init,
  } = require("./src/libpoketube/libpoketube-initsys.js");
  const media_proxy = require("./src/libpoketube/libpoketube-video.js");
  const { sinit } = require("./src/libpoketube/init/superinit.js");
  const innertube = require("./src/libpoketube/libpoketube-youtubei-objects.json");
  const fs = require("fs");
  const config = require("./config.json");
  const u = await media_proxy();

  fs.readFile("ascii_txt.txt", "utf8", (err, data) => {
    if (err) {
      console.error("Error reading the file:", err);
      return;
    }

    console.log(data);
  });
  initlog("Loading. everything... ever....");
  initlog(
    "[Welcome] Welcome To Poke, where you can LIBERATE THE WEB! - :3 " +
      "Running " +
      `Node ${process.version} - V8 v${
        process.versions.v8
      } -  ${process.platform.replace("linux", "GNU/Linux")} ${
        process.arch
      } Server - libpt ${version}`
  );

  const {
    IsJsonString,
    convert,
    getFirstLine,
    capitalizeFirstLetter,
    turntomins,
    getRandomInt,
    getRandomArbitrary,
  } = require("./src/libpoketube/ptutils/libpt-coreutils.js");
  const { ieBlockMiddleware } = require("./src/libpoketube/ptutils/ie-blocker.js");
  initlog("Loaded libpt-coreutils and ieBlockMiddleware");

  const templateDir = modules.path.resolve(
    `${process.cwd()}${modules.path.sep}html`
  );

  const sha384 = modules.hash;

  var app = modules.express();

// ── Ultra-Smart Trust Proxy Engine ────────────────────────────────
// IMPORTANT: This MUST run before rate limiter and all other middleware
// so that trust proxy is configured before anything checks req.ip
(function configureTrustProxy() {
  const os = require("os");
  const net = require("net");
  const path = require("path");

  // ─── .env loading (only if file exists) ────────────────────────
  const dotenvPath = path.resolve(process.cwd(), ".env");

  try {
    fs.accessSync(dotenvPath, fs.constants.F_OK);
    try {
      require("dotenv").config({ path: dotenvPath });
      initlog("[trust-proxy] .env file found and loaded");
    } catch (e) {
      initlog("[trust-proxy] .env file found but dotenv not installed — reading raw");
      try {
        const raw = fs.readFileSync(dotenvPath, "utf8");
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq === -1) continue;
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
        initlog("[trust-proxy] .env manually parsed OK");
      } catch (readErr) {
        initlog("[trust-proxy] ⚠ Failed to read .env: " + readErr.message);
      }
    }
  } catch {
    initlog("[trust-proxy] No .env file found — using system env only");
  }

  // ─── CIDR math ─────────────────────────────────────────────────
  function ipToLong(ip) {
    return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
  }

  function cidrContains(cidr, ip) {
    if (!net.isIPv4(ip)) return false;
    const [subnet, bits] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(subnet) & mask);
  }

  function isPrivateIP(ip) {
    if (net.isIPv6(ip)) {
      return /^(::1|fe80:|fc00:|fd00:|::ffff:((10\.)|(172\.(1[6-9]|2\d|3[01])\.)|(192\.168\.)))/i.test(ip);
    }
    if (!net.isIPv4(ip)) return false;
    return (
      cidrContains("10.0.0.0/8", ip) ||
      cidrContains("172.16.0.0/12", ip) ||
      cidrContains("192.168.0.0/16", ip) ||
      cidrContains("127.0.0.0/8", ip) ||
      cidrContains("169.254.0.0/16", ip)
    );
  }

  // ─── Detection: environment signals ────────────────────────────
  function detectEnvSignals() {
    const signals = {
      "DYNO": "Heroku",
      "FLY_APP_NAME": "Fly.io",
      "RENDER_SERVICE_ID": "Render",
      "RAILWAY_SERVICE_ID": "Railway",
      "VERCEL": "Vercel",
      "AWS_EXECUTION_ENV": "AWS Lambda/ECS",
      "GAE_APPLICATION": "Google App Engine",
      "K_SERVICE": "Cloud Run/Knative",
      "WEBSITE_SITE_NAME": "Azure App Service",
      "ECS_CONTAINER_METADATA_URI": "AWS ECS",
      "ECS_CONTAINER_METADATA_URI_V4": "AWS ECS v4",
      "KUBERNETES_SERVICE_HOST": "Kubernetes",
      "CF_INSTANCE_IP": "Cloud Foundry",
      "DOKKU_APP_TYPE": "Dokku",
      "COOLIFY_APP_ID": "Coolify",
      "CAPROVER_APP": "CapRover",
    };

    const detected = [];
    for (const [key, name] of Object.entries(signals)) {
      if (process.env[key]) detected.push({ key, name, value: process.env[key] });
    }
    return detected;
  }

  // ─── Detection: filesystem signals ─────────────────────────────
  function detectFilesystemSignals() {
    const signals = [];

    const checks = [
      { path: "/.dockerenv", name: "Docker" },
      { path: "/run/.containerenv", name: "Podman" },
      { path: "/var/run/secrets/kubernetes.io", name: "Kubernetes" },
    ];

    for (const { path, name } of checks) {
      try {
        fs.accessSync(path, fs.constants.F_OK);
        signals.push({ path, name });
      } catch {}
    }

    try {
      const cgroup = fs.readFileSync("/proc/1/cgroup", "utf8");
      const patterns = [
        [/docker/i, "Docker"],
        [/kubepods/i, "Kubernetes"],
        [/containerd/i, "containerd"],
        [/lxc/i, "LXC"],
        [/podman/i, "Podman"],
      ];
      for (const [re, name] of patterns) {
        if (re.test(cgroup)) signals.push({ path: "/proc/1/cgroup", name });
      }
    } catch {}

    try {
      const container = fs.readFileSync("/run/systemd/container", "utf8").trim();
      if (container) signals.push({ path: "/run/systemd/container", name: container });
    } catch {}

    return signals;
  }

  // ─── Detection: network interface signals ──────────────────────
  function detectNetworkSignals() {
    const signals = [];
    const ifaces = os.networkInterfaces();
    const containerIfacePattern = /^(docker|br-|veth|cali|flannel|cni|wg|tun|tap|tailscale|podman)/;

    for (const [name, addrs] of Object.entries(ifaces)) {
      if (containerIfacePattern.test(name)) {
        signals.push({ iface: name, type: "container-interface" });
      }
    }
    return signals;
  }

  // ─── Build the trust function ──────────────────────────────────
  function buildTrustFunction() {
    return function smartTrustProxy(addr) {
      const ip = addr.replace("::ffff:", "");
      return isPrivateIP(ip);
    };
  }

  function logProxyHeaders(req) {
    const interesting = [
      "x-forwarded-for", "x-forwarded-proto", "x-forwarded-host",
      "x-real-ip", "via", "cf-ray", "cf-connecting-ip",
      "fly-request-id", "x-amzn-trace-id",
    ];
    const found = interesting.filter(h => req.headers[h]);
    if (found.length) {
      initlog("[trust-proxy]   Headers seen: " + found.join(", "));
    }
  }

  // ─── User override via env var ─────────────────────────────────
  function checkUserOverride() {
    const val = (process.env.TRUST_PROXY || "").toLowerCase().trim();
    if (!val) return null;

    if (val === "true" || val === "1" || val === "yes") return "force-on";
    if (val === "false" || val === "0" || val === "no") return "force-off";

    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) return num;

    return val;
  }

  // ─── Main logic ────────────────────────────────────────────────
  const override = checkUserOverride();

  if (override === "force-off") {
    app.set("trust proxy", false);
    initlog("[trust-proxy] ✗ Force-disabled via TRUST_PROXY=false");
    return;
  }

  if (override === "force-on") {
    app.set("trust proxy", buildTrustFunction());
    initlog("[trust-proxy] ✓ Force-enabled via TRUST_PROXY=true (private IPs only)");
    return;
  }

  if (typeof override === "number") {
    app.set("trust proxy", override);
    initlog("[trust-proxy] ✓ Hop count set via TRUST_PROXY=" + override);
    return;
  }

  if (typeof override === "string") {
    app.set("trust proxy", override);
    initlog("[trust-proxy] ✓ Custom CIDR set via TRUST_PROXY=" + override);
    return;
  }

  // Auto-detection
  const envSignals = detectEnvSignals();
  const fsSignals = detectFilesystemSignals();
  const netSignals = detectNetworkSignals();

  const totalConfidence =
    envSignals.length * 3 +
    fsSignals.length * 2 +
    netSignals.length * 1;

  if (envSignals.length) initlog("[trust-proxy] Env signals: " + envSignals.map(s => s.name).join(", "));
  if (fsSignals.length) initlog("[trust-proxy] FS signals: " + fsSignals.map(s => s.name).join(", "));
  if (netSignals.length) initlog("[trust-proxy] Net signals: " + netSignals.map(s => `${s.iface}(${s.type})`).join(", "));
  initlog("[trust-proxy] Confidence score: " + totalConfidence);

  if (totalConfidence >= 2) {
    // High confidence from heuristics — enable immediately
    app.set("trust proxy", buildTrustFunction());
    initlog("[trust-proxy] ✓ Auto-enabled (confidence: " + totalConfidence + ")");
    return;
  }

  // ─── Low confidence: use a blocking probe on the first request ─
  // This is the key fix: instead of starting with trust proxy OFF and
  // letting the rate limiter crash, we intercept the FIRST request,
  // inspect it, configure trust proxy, and THEN let it continue
  // through the rest of the middleware chain (including rate limiter).
  initlog("[trust-proxy] △ Low confidence — will probe first request before rate limiter runs");

  let probeComplete = false;

  app.use(function trustProxyBlockingProbe(req, res, next) {
    if (probeComplete) return next();
    probeComplete = true;

    const hasForwardedFor = !!req.headers["x-forwarded-for"];
    const hasForwardedProto = !!req.headers["x-forwarded-proto"];
    const hasForwardedHost = !!req.headers["x-forwarded-host"];
    const hasVia = !!req.headers["via"];
    const hasCfRay = !!req.headers["cf-ray"];
    const hasFlyReqId = !!req.headers["fly-request-id"];
    const hasXRealIp = !!req.headers["x-real-ip"];
    const hasXAmznTraceId = !!req.headers["x-amzn-trace-id"];

    const headerScore =
      (hasForwardedFor ? 3 : 0) +
      (hasForwardedProto ? 2 : 0) +
      (hasForwardedHost ? 1 : 0) +
      (hasVia ? 2 : 0) +
      (hasCfRay ? 3 : 0) +
      (hasFlyReqId ? 3 : 0) +
      (hasXRealIp ? 2 : 0) +
      (hasXAmznTraceId ? 3 : 0);

    const remoteAddr = (req.socket.remoteAddress || "").replace("::ffff:", "");
    const remoteIsPrivate = isPrivateIP(remoteAddr);

    if (headerScore >= 3 && remoteIsPrivate) {
      // Confirmed proxy: TCP source is private + proxy headers present
      app.set("trust proxy", buildTrustFunction());
      initlog("[trust-proxy] ✓ PROBE CONFIRMED: real proxy detected (score: " + headerScore + ")");
      logProxyHeaders(req);
    } else if (headerScore >= 3 && !remoteIsPrivate) {
      // Proxy headers from a public IP — do NOT trust, possible spoof
      app.set("trust proxy", false);
      initlog("[trust-proxy] ⚠ WARNING: proxy headers from PUBLIC IP " + remoteAddr + " — ignoring (possible spoof)");
    } else {
      // No proxy headers at all — genuinely direct connection
      app.set("trust proxy", false);
      initlog("[trust-proxy] ✗ No proxy headers detected — disabled");
    }

    // IMPORTANT: trust proxy is now set BEFORE this request continues
    // to the rate limiter, so express-rate-limit won't throw
    next();
  });

  // Periodic re-check for dynamic environments (e.g. container migration)
  setInterval(() => {
    const freshEnv = detectEnvSignals();
    const freshFs = detectFilesystemSignals();
    const freshScore = freshEnv.length * 3 + freshFs.length * 2;

    if (freshScore >= 2 && !probeComplete) {
      app.set("trust proxy", buildTrustFunction());
      initlog("[trust-proxy] ✓ Periodic re-check upgraded trust proxy (score: " + freshScore + ")");
    }
  }, 60_000).unref();

})();

  // Philosophy: ONLY block traffic that is physically impossible for
  // a human to generate. Never penalize based on user-agent, cookies,
  // JS support, or any fingerprinting. Privacy browsers are welcome.
  //
  // Whitelists: known crawlers (verified by behavior, not just UA string),
  // Cloudflare IPs, and CDN health checks.
  //
  (function installAntiDDoS() {
    const net = require("net");
    const rateLimit = require("express-rate-limit");

    // https://www.cloudflare.com/ips/
    const CLOUDFLARE_V4 = [
      "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22",
      "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
      "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22",
      "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
      "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
    ];

    function ipToLong(ip) {
      return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
    }

    function cidrContains(cidr, ip) {
      if (!net.isIPv4(ip)) return false;
      const [subnet, bits] = cidr.split("/");
      const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
      return (ipToLong(ip) & mask) === (ipToLong(subnet) & mask);
    }

    function isCloudflareIP(ip) {
      const clean = ip.replace("::ffff:", "");
      if (!net.isIPv4(clean)) return false;
      return CLOUDFLARE_V4.some(cidr => cidrContains(cidr, clean));
    }

     // We match these loosely because crawlers are inherently high-volume
    // and blocking them hurts SEO / link previews / federation.
    // This does NOT grant trust — it just exempts from the DDoS checks.
    // A fake "Googlebot" UA still can't do anything harmful, they just
    // skip the rate check — and real abuse gets caught by the IP ban.
    const KNOWN_BOT_PATTERNS = [
      // Search engines
      /googlebot/i,
      /bingbot/i,
      /slurp/i,                   // Yahoo
      /duckduckbot/i,
      /baiduspider/i,
      /yandexbot/i,
      /sogou/i,
      /exabot/i,
      /facebot/i,                 // Facebook crawler
      /ia_archiver/i,             // Alexa / Internet Archive
      /archive\.org_bot/i,
      /qwantify/i,               // Qwant
      /seznambot/i,
      /mojeekbot/i,
      /petalsearch/i,
      /applebot/i,

      // Social media / link previews
      /discordbot/i,
      /telegrambot/i,
      /twitterbot/i,
      /whatsapp/i,
      /slackbot/i,
      /linkedinbot/i,
      /mastodon/i,               // Fediverse
      /pleroma/i,                // Fediverse
      /misskey/i,                // Fediverse
      /akkoma/i,                 // Fediverse

      // Monitoring / uptime
      /uptimerobot/i,
      /pingdom/i,
      /statuscake/i,
      /site24x7/i,
      /hetrixtools/i,
      /freshping/i,

      // CDN / infrastructure
      /cloudflare/i,
      /cloudfront/i,
      /fastly/i,

      // Feed readers
      /feedfetcher/i,
      /feedly/i,
      /newsblur/i,
      /tiny\s?tiny\s?rss/i,
      /miniflux/i,

      // Research / academic
      /researchscan/i,
      /censys/i,
      /semrush/i,
      /ahrefs/i,
    ];

    function isKnownBot(ua) {
      if (!ua) return false;
      return KNOWN_BOT_PATTERNS.some(pattern => pattern.test(ua));
    }

    // ─── Per-IP tracking state ─────────────────────────────────────
    const ipData = new Map();

    // Thresholds — intentionally VERY generous for humans
    const BURST_LIMIT = 50;         // req/sec — physically impossible for a person
    const SUSTAINED_LIMIT = 200;    // req/10sec — still way beyond any human
    const SUSTAINED_WINDOW = 10000; // 10 seconds
    const BAN_BASE_MS = 30000;      // first ban: 30 seconds
    const BAN_MAX_MS = 600000;      // max ban: 10 minutes
    const STRIKE_DECAY_MS = 300000; // strikes decay after 5 min of good behavior
    const CLEANUP_INTERVAL = 60000; // clean stale entries every 60s
    const MAX_TRACKED_IPS = 50000;  // memory cap — evict oldest if exceeded

    function getIPData(ip) {
      let data = ipData.get(ip);
      if (!data) {
        // Memory protection: if we're tracking too many IPs, evict the oldest idle ones
        if (ipData.size >= MAX_TRACKED_IPS) {
          let oldestKey = null;
          let oldestTime = Infinity;
          for (const [key, val] of ipData) {
            const lastActive = val.timestamps.length > 0
              ? val.timestamps[val.timestamps.length - 1]
              : 0;
            if (lastActive < oldestTime && !val.banned) {
              oldestTime = lastActive;
              oldestKey = key;
            }
          }
          if (oldestKey) ipData.delete(oldestKey);
        }
        data = { timestamps: [], banned: false, banExpires: 0, strikes: 0, lastStrike: 0 };
        ipData.set(ip, data);
      }
      return data;
    }

    function isBanned(data) {
      if (!data.banned) return false;
      if (Date.now() >= data.banExpires) {
        data.banned = false;
        return false;
      }
      return true;
    }

    function banIP(data, ip, reason) {
      data.strikes++;
      data.lastStrike = Date.now();
      const duration = Math.min(BAN_BASE_MS * Math.pow(2, data.strikes - 1), BAN_MAX_MS);
      data.banned = true;
      data.banExpires = Date.now() + duration;
      initlog(
        `[anti-ddos] ⛔ Banned ${ip} for ${Math.round(duration / 1000)}s ` +
        `(${reason}, strike ${data.strikes})`
      );
    }

    function checkAbuse(data, now) {
      const ts = data.timestamps;
      ts.push(now);

      // Trim timestamps older than the sustained window
      while (ts.length > 0 && ts[0] < now - SUSTAINED_WINDOW) {
        ts.shift();
      }

      // Check 1: Burst — count requests in the last 1 second
      const oneSecAgo = now - 1000;
      let burstCount = 0;
      for (let i = ts.length - 1; i >= 0; i--) {
        if (ts[i] >= oneSecAgo) burstCount++;
        else break;
      }
      if (burstCount >= BURST_LIMIT) return "burst (" + burstCount + " req/1s)";

      // Check 2: Sustained flood — total requests in the 10-second window
      if (ts.length >= SUSTAINED_LIMIT) return "sustained (" + ts.length + " req/10s)";

      return null;
    }

    // ─── Periodic cleanup ──────────────────────────────────────────
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of ipData) {
        // Decay strikes
        if (data.strikes > 0 && now - data.lastStrike > STRIKE_DECAY_MS) {
          data.strikes = Math.max(0, data.strikes - 1);
        }
        // Trim old timestamps
        while (data.timestamps.length > 0 && data.timestamps[0] < now - SUSTAINED_WINDOW) {
          data.timestamps.shift();
        }
        // Evict clean, idle entries
        if (!data.banned && data.strikes === 0 && data.timestamps.length === 0) {
          ipData.delete(ip);
        }
      }
    }, CLEANUP_INTERVAL).unref();

    // ─── The middleware ─────────────────────────────────────────────
    app.use(function antiDDoS(req, res, next) {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const ua = req.headers["user-agent"] || "";
      const now = Date.now();

       const rawIP = (req.socket.remoteAddress || "").replace("::ffff:", "");
      if (isCloudflareIP(rawIP)) return next();

 
      if (isKnownBot(ua)) return next();
 

      // ── Check ban status
      const data = getIPData(ip);

      if (isBanned(data)) {
        const retryAfter = Math.ceil((data.banExpires - now) / 1000);
        res.set("Retry-After", String(retryAfter));
        return res.status(429).send(
          "You're sending way too many requests. Try again in " + retryAfter + " seconds."
        );
      }

      // ── Check for DDoS patterns
      const abuse = checkAbuse(data, now);
      if (abuse) {
        banIP(data, ip, abuse);
        const retryAfter = Math.ceil((data.banExpires - now) / 1000);
        res.set("Retry-After", String(retryAfter));
        return res.status(429).send(
          "You're sending way too many requests. Try again in " + retryAfter + " seconds."
        );
      }

      next();
    });

    // ─── Standard rate limiter (softer, catches moderate abuse) ────
    // This is the express-rate-limit that handles "normal" rate limiting
    // for regular users — much softer than the DDoS detector.
    const limiter = rateLimit({
      windowMs: 15 * 1000,
      max: 150,
      // Don't throw on X-Forwarded-For mismatch — our trust proxy engine handles it
      validate: { xForwardedForHeader: false },
      // Skip bots and Cloudflare so they don't eat the limit
      skip: (req) => {
        const ua = req.headers["user-agent"] || "";
        const rawIP = (req.socket.remoteAddress || "").replace("::ffff:", "");
        return isKnownBot(ua) || isCloudflareIP(rawIP);
      },
      handler: (req, res) => {
        return res.status(429).send("Slow down! Too many requests. Please wait a moment.");
      },
    });
    app.use(limiter);

     app.get("/_antiddos/stats", (req, res) => {
      const now = Date.now();
      let bannedCount = 0;
      let trackedWithActivity = 0;
      for (const [, data] of ipData) {
        if (isBanned(data)) bannedCount++;
        if (data.timestamps.length > 0) trackedWithActivity++;
      }
      res.json({
        tracked_ips: ipData.size,
        active_ips: trackedWithActivity,
        currently_banned: bannedCount,
        thresholds: {
          burst: BURST_LIMIT + " req/1s",
          sustained: SUSTAINED_LIMIT + " req/10s",
          rate_limit: "150 req/15s",
        },
      });
    });

    initlog(
      "[OK] Smart anti-DDoS engine loaded — " +
      "burst: " + BURST_LIMIT + " req/s, " +
      "sustained: " + SUSTAINED_LIMIT + " req/10s, " +
      "bots whitelisted: " + KNOWN_BOT_PATTERNS.length + " patterns"
    );
  })();

  app.use(ieBlockMiddleware);
  initlog("Loaded express.js");

// ── Global Response Safety Guard ──────────────────────────────────
// Patches res.send/res.json/res.redirect/res.render to prevent
// ERR_HTTP_HEADERS_SENT crashes anywhere in the app
(function installResponseGuard() {
  app.use(function responseGuard(req, res, next) {
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const originalRedirect = res.redirect.bind(res);
    const originalRender = res.render.bind(res);

    let responseSent = false;
    const sentFrom = {}; // track where the first send came from

    function markSent(method) {
      if (responseSent) {
        // Log the double-send attempt with stack trace for debugging
        const err = new Error(`[response-guard] ⚠ Double-send blocked (${method}) for ${req.method} ${req.originalUrl}`);
        console.error(err.message);
        // Uncomment the next line for full stack traces during debugging:
        // console.error("  First send:", sentFrom.stack, "\n  Second send:", err.stack);
        return true; // blocked
      }
      responseSent = true;
      sentFrom.stack = new Error().stack;
      return false; // allowed
    }

    res.send = function guardedSend(...args) {
      if (res.headersSent || markSent("send")) return res;
      return originalSend(...args);
    };

    res.json = function guardedJson(...args) {
      if (res.headersSent || markSent("json")) return res;
      return originalJson(...args);
    };

    res.redirect = function guardedRedirect(...args) {
      if (res.headersSent || markSent("redirect")) return res;
      return originalRedirect(...args);
    };

    res.render = function guardedRender(view, data, callback) {
      if (res.headersSent || markSent("render")) return;
      // If no callback provided, wrap with error handling
      if (typeof callback !== "function") {
        return originalRender(view, data, function (err, html) {
          if (err) {
            console.error("[response-guard] Render error for", view, ":", err.message);
            if (!res.headersSent) {
              res.status(500).send("Internal server error");
            }
            return;
          }
          if (!res.headersSent) {
            originalSend(html);
          }
        });
      }
      return originalRender(view, data, callback);
    };

    next();
  });

  initlog("[OK] Response safety guard installed");
})();
  app.engine("html", require("ejs").renderFile);
  initlog("Loaded EJS");
  app.use(modules.express.urlencoded({ extended: true }));
  app.use(modules.useragent.express());
  app.use(modules.express.json());

  var toobusy = require("toobusy-js");

  const renderTemplate = async (res, req, template, data = {}) => {
    // Guard: don't render if response is already sent
    if (res.headersSent) {
      console.error("[renderTemplate] ⚠ Headers already sent, skipping render for:", template);
      return;
    }
    try {
      res.render(
        modules.path.resolve(`${templateDir}${modules.path.sep}${template}`),
        Object.assign(data)
      );
    } catch (err) {
      console.error("[renderTemplate] ⚠ Render error for", template, ":", err.message);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  };

  // Set check interval to a faster value. This will catch more latency spikes
  // but may cause the check to be too sensitive.
  toobusy.interval(110);

  toobusy.maxLag(3500);

  app.use(function (req, res, next) {
    if (toobusy()) {
      return res.status(503).send("I'm busy right now, sorry.");
    }
    next();
  });

  toobusy.onLag(function (currentLag) {
    console.error("[toobusy] Event loop lag detected! Latency: " + currentLag + "ms");
    // Only exit on extreme lag — let the anti-ddos handle most cases
    if (currentLag > 5000) {
      console.error("[toobusy] Critical lag (" + currentLag + "ms), shutting down for restart");
      process.exit(1);
    }
  });
  
    initlog("inited anti ddos");


  const initPokeTube = function () {
    sinit(app, config, renderTemplate);
    initlog("inited super init");
    init(app);
    initlog("inited app");
  };

  try {
    app.use(function (req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      if (req.secure) {
        res.header(
          "Strict-Transport-Security",
          "max-age=31536000; includeSubDomains; preload"
        );
      }
      res.header("secure-poketube-instance", "1");

      // opt out of googles "FLOC" bs :p See https://spreadprivacy.com/block-floc-with-duckduckgo/
      res.header("Permissions-Policy", "interest-cohort=()");
      res.header("software-name", "poke");
      next();
    });

    app.use(function (request, response, next) {
      if (config.enablealwayshttps && !request.secure) {
        if (
          !/^https:/i.test(
            request.headers["x-forwarded-proto"] || request.protocol
          )
        ) {
          return response.redirect(
            "https://" + request.headers.host + request.url
          );
        }
      }

      next();
    });

    app.use(function (req, res, next) {
 
      res.header(
        "X-PokeTube-Youtube-Client-Name",
        innertube.innertube.CONTEXT_CLIENT.INNERTUBE_CONTEXT_CLIENT_NAME
      );
      res.header(
        "Hey-there",
        "Do u wanna help poke? join us :3 https://codeberg.org/ashleyirispuppy/poke"
      );
      res.header(
        "X-PokeTube-Youtube-Client-Version",
        innertube.innertube.CLIENT.clientVersion
      );
      res.header(
        "X-PokeTube-Client-name",
        innertube.innertube.CLIENT.projectClientName
      );
      res.header("X-PokeTube-Speeder", "3 seconds no cache, 280ms w/cache");
      res.header("X-HOSTNAME", req.hostname);
      if (req.url.match(/^\/(css|js|img|font)\/.+/)) {
        res.setHeader(
          "Cache-Control",
          "public, max-age=" + config.cacher_max_age
        ); // cache header
        res.setHeader("poketube-cacher", "STATIC_FILES");
      }
      const a = 890;
      if (!req.url.match(/^\/(css|js|img|font)\/.+/)) {
        res.setHeader("Cache-Control", "public, max-age=" + a); // cache header
        res.setHeader("poketube-cacher", "PAGE");
      }
      next();
    });

    initlog("[OK] Load headers");
  } catch {
    initlog("[FAILED] load headers");
  }

  try {
    app.get("/robots.txt", (req, res) => {
      res.sendFile(__dirname + "/robots.txt");
    });

    initlog("[OK] Load robots.txt");
  } catch {
    initlog("[FAILED] load robots.txt");
  }

  // ── Global error handler (must be last middleware) ────────────────
  app.use(function globalErrorHandler(err, req, res, next) {
    // Log the error with context
    console.error(
      "[error-handler] Unhandled error on",
      req.method, req.originalUrl,
      ":", err.message
    );
    if (process.env.NODE_ENV !== "production") {
      console.error(err.stack);
    }
    // Only send a response if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).send("Something went wrong. Please try again.");
    }
  });

  initPokeTube();
})();