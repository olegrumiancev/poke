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
  const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
    windowMs: 15 * 1000, // 25 second window
    max: 150, // limit each IP to 200 requests per 30 seconds
});
  initlog("Loaded limitter");
  
  var app = modules.express();
  app.use(limiter);
  app.use(ieBlockMiddleware);
  initlog("Loaded express.js");
  app.engine("html", require("ejs").renderFile);
  initlog("Loaded EJS");
  app.use(modules.express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
  app.use(modules.useragent.express());
  app.use(modules.express.json()); // for parsing application/json
  
// ── Ultra-Smart Trust Proxy Engine ────────────────────────────────
(function configureTrustProxy() {
  const os = require("os");
  const http = require("http");
  const net = require("net");
  const path = require("path");

  const PRIVATE_CIDRS = [
    "loopback",
    "linklocal",
    "uniquelocal",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
  ];

  // ─── .env loading (only if file exists) ────────────────────────
  const dotenvPath = path.resolve(process.cwd(), ".env");
  let dotenvLoaded = false;

  try {
    fs.accessSync(dotenvPath, fs.constants.F_OK);
    // .env exists — try to load it
    try {
      require("dotenv").config({ path: dotenvPath });
      dotenvLoaded = true;
      initlog("[trust-proxy] .env file found and loaded");
    } catch (e) {
      // dotenv package not installed — that's fine, skip it
      initlog("[trust-proxy] .env file found but dotenv not installed — reading raw");
      // Minimal manual parse as fallback
      try {
        const raw = fs.readFileSync(dotenvPath, "utf8");
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq === -1) continue;
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          // Strip surrounding quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
        dotenvLoaded = true;
        initlog("[trust-proxy] .env manually parsed OK");
      } catch (readErr) {
        initlog("[trust-proxy] ⚠ Failed to read .env: " + readErr.message);
      }
    }
  } catch {
     initlog("[trust-proxy] No .env file found — using system env only");
  }

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

   let confirmedProxy = null;

  function installProbe(app) {
    let probed = false;

    app.use(function trustProxyProbe(req, res, next) {
      if (probed) return next();

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

      const remoteIsPrivate = isPrivateIP(req.socket.remoteAddress?.replace("::ffff:", "") || "");

      if (headerScore >= 3 && remoteIsPrivate) {
        if (confirmedProxy !== true) {
          confirmedProxy = true;
          app.set("trust proxy", buildTrustFunction());
          initlog("[trust-proxy] ✓ PROBE CONFIRMED: real proxy detected (score: " + headerScore + ")");
          logProxyHeaders(req);
        }
      } else if (headerScore >= 3 && !remoteIsPrivate) {
        initlog("[trust-proxy] ⚠ WARNING: proxy headers from PUBLIC IP " +
          req.socket.remoteAddress + " — ignoring (possible spoof)");
      }

      probed = true;
      next();
    });
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

  // ─── Build the trust function ──────────────────────────────────
  function buildTrustFunction() {
    return function smartTrustProxy(addr) {
      const ip = addr.replace("::ffff:", "");
      return isPrivateIP(ip);
    };
  }

  // ─── User override via env var (only if env was available) ─────
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
    app.set("trust proxy", buildTrustFunction());
    initlog("[trust-proxy] ✓ Auto-enabled (confidence: " + totalConfidence + ")");
  } else {
    app.set("trust proxy", false);
    initlog("[trust-proxy] △ Low confidence — starting disabled, probe will upgrade if real proxy detected");
  }

  installProbe(app);

  setInterval(() => {
    const freshEnv = detectEnvSignals();
    const freshFs = detectFilesystemSignals();
    const freshScore = freshEnv.length * 3 + freshFs.length * 2;

    if (freshScore >= 2 && confirmedProxy === null) {
      confirmedProxy = true;
      app.set("trust proxy", buildTrustFunction());
      initlog("[trust-proxy] ✓ Periodic re-check upgraded trust proxy (score: " + freshScore + ")");
    }
  }, 60_000).unref();

})();
  
  var toobusy = require("toobusy-js");

  const renderTemplate = async (res, req, template, data = {}) => {
    res.render(
      modules.path.resolve(`${templateDir}${modules.path.sep}${template}`),
      Object.assign(data)
    );
  };

  // Set check interval to a faster value. This will catch more latency spikes
  // but may cause the check to be too sensitive.
  toobusy.interval(110);

  toobusy.maxLag(3500);

  app.use(function (req, res, next) {
    if (toobusy()) {
      res.send(503, "I'm busy right now, sorry.");
    } else {
      next();
    }
  });

  toobusy.onLag(function (currentLag) {
    process.exit(1);
    console.log("Event loop lag detected! Latency: " + currentLag + "ms");
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

  initPokeTube();
})();
