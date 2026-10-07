#!/usr/bin/env node

const dns = require("dns").promises;
const net = require("net");
const https = require("https");
const http = require("http");
const tls = require("tls");

const domain = process.argv[2];

if (!domain) {
  console.error("Usage: node domain-recon.js <domain>");
  process.exit(1);
}

const COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function c(color, text) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function section(title) {
  console.log("\n" + c("cyan", c("bold", `━━━ ${title} ━━━`)));
}

function ok(label, value) {
  console.log(`  ${c("green", "✔")} ${c("bold", label)}: ${value}`);
}

function warn(label, value) {
  console.log(`  ${c("yellow", "!")} ${c("bold", label)}: ${value}`);
}

function fail(label, msg) {
  console.log(`  ${c("red", "✘")} ${c("bold", label)}: ${c("dim", msg)}`);
}

const COMMON_PORTS = [
  { port: 21, name: "FTP" },
  { port: 22, name: "SSH" },
  { port: 23, name: "Telnet" },
  { port: 25, name: "SMTP" },
  { port: 53, name: "DNS" },
  { port: 80, name: "HTTP" },
  { port: 110, name: "POP3" },
  { port: 143, name: "IMAP" },
  { port: 443, name: "HTTPS" },
  { port: 465, name: "SMTPS" },
  { port: 587, name: "SMTP (submission)" },
  { port: 993, name: "IMAPS" },
  { port: 995, name: "POP3S" },
  { port: 3306, name: "MySQL" },
  { port: 3389, name: "RDP" },
  { port: 5432, name: "PostgreSQL" },
  { port: 6379, name: "Redis" },
  { port: 8080, name: "HTTP-Alt" },
  { port: 8443, name: "HTTPS-Alt" },
  { port: 27017, name: "MongoDB" },
];

function scanPort(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function fetchHeaders(domain) {
  return new Promise((resolve) => {
    const tryFetch = (protocol, cb) => {
      const mod = protocol === "https" ? https : http;
      const req = mod.request(
        { hostname: domain, path: "/", method: "HEAD", timeout: 5000 },
        (res) => cb(null, res.headers, res.statusCode)
      );
      req.on("error", (e) => cb(e));
      req.on("timeout", () => { req.destroy(); cb(new Error("timeout")); });
      req.end();
    };

    tryFetch("https", (err, headers, status) => {
      if (!err) return resolve({ headers, status, proto: "HTTPS" });
      tryFetch("http", (err2, headers2, status2) => {
        if (!err2) return resolve({ headers: headers2, status: status2, proto: "HTTP" });
        resolve(null);
      });
    });
  });
}

function getSSLCert(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect(443, domain, { servername: domain, timeout: 5000 }, () => {
      const cert = socket.getPeerCertificate(true);
      socket.destroy();
      if (!cert || !cert.subject) return resolve(null);
      resolve(cert);
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => { socket.destroy(); resolve(null); });
  });
}

const COMMON_SUBDOMAINS = [
  "www", "mail", "ftp", "smtp", "pop", "imap", "webmail",
  "admin", "portal", "api", "dev", "staging", "test", "beta",
  "app", "dashboard", "cpanel", "whm", "blog", "shop", "store",
  "m", "mobile", "cdn", "static", "assets", "media", "img",
  "vpn", "remote", "ns1", "ns2", "mx", "mx1", "mx2",
  "autodiscover", "autoconfig", "git", "gitlab", "jenkins",
  "status", "monitor", "help", "support", "docs",
];

async function findSubdomains(domain) {
  const found = [];
  const checks = COMMON_SUBDOMAINS.map(async (sub) => {
    const full = `${sub}.${domain}`;
    try {
      const ips = await dns.resolve4(full);
      found.push({ sub: full, ips });
    } catch {  }
  });
  await Promise.all(checks);
  return found;
}

function fetchBody(domain) {
  return new Promise((resolve) => {
    const tryFetch = (protocol, cb) => {
      const mod = protocol === "https" ? https : http;
      let body = "";
      const req = mod.request(
        { hostname: domain, path: "/", method: "GET", timeout: 8000 },
        (res) => {
          res.setEncoding("utf8");
          res.on("data", (chunk) => { body += chunk; if (body.length > 50000) res.destroy(); });
          res.on("end", () => cb(null, body, res.headers));
          res.on("close", () => cb(null, body, res.headers));
        }
      );
      req.on("error", (e) => cb(e));
      req.on("timeout", () => { req.destroy(); cb(new Error("timeout")); });
      req.end();
    };

    tryFetch("https", (err, body, headers) => {
      if (!err) return resolve({ body, headers });
      tryFetch("http", (err2, body2, headers2) => {
        if (!err2) return resolve({ body: body2, headers: headers2 });
        resolve(null);
      });
    });
  });
}

function detectTech(body, headers) {
  const techs = [];
  const b = (body || "").toLowerCase();
  const h = JSON.stringify(headers || "").toLowerCase();

if (b.includes("wp-content") || b.includes("wp-includes")) techs.push("WordPress");
  if (b.includes("joomla")) techs.push("Joomla");
  if (b.includes("drupal")) techs.push("Drupal");
  if (b.includes("shopify")) techs.push("Shopify");
  if (b.includes("wix.com") || b.includes("wixsite")) techs.push("Wix");
  if (b.includes("squarespace")) techs.push("Squarespace");
  if (b.includes("webflow")) techs.push("Webflow");
  if (b.includes("ghost.io") || b.includes("ghostcdn")) techs.push("Ghost");

if (b.includes("react") || b.includes("__react")) techs.push("React");
  if (b.includes("vue.js") || b.includes("__vue")) techs.push("Vue.js");
  if (b.includes("angular") || b.includes("ng-version")) techs.push("Angular");
  if (b.includes("next.js") || b.includes("/_next/")) techs.push("Next.js");
  if (b.includes("nuxt") || b.includes("/_nuxt/")) techs.push("Nuxt.js");
  if (b.includes("svelte")) techs.push("Svelte");
  if (b.includes("jquery")) techs.push("jQuery");
  if (b.includes("bootstrap")) techs.push("Bootstrap");
  if (b.includes("tailwind")) techs.push("Tailwind CSS");

if (b.includes("google-analytics") || b.includes("gtag(") || b.includes("ga('")) techs.push("Google Analytics");
  if (b.includes("googletagmanager")) techs.push("Google Tag Manager");
  if (b.includes("facebook.net/en_us/fbevents")) techs.push("Facebook Pixel");
  if (b.includes("hotjar")) techs.push("Hotjar");
  if (b.includes("intercom")) techs.push("Intercom");
  if (b.includes("crisp.chat")) techs.push("Crisp Chat");

if (h.includes('"server":"nginx"') || h.includes('"server": "nginx"')) techs.push("Nginx");
  if (h.includes('"server":"apache"') || h.includes('"server": "apache"')) techs.push("Apache");
  if (h.includes("x-powered-by\":\"php")) techs.push("PHP");
  if (h.includes("x-powered-by\":\"express")) techs.push("Express.js");
  if (h.includes("x-powered-by\":\"asp.net")) techs.push("ASP.NET");
  if (h.includes("x-powered-by\":\"next.js")) techs.push("Next.js");

if (h.includes("cf-ray")) techs.push("Cloudflare");
  if (h.includes("x-amz") || h.includes("amazonaws")) techs.push("AWS");
  if (h.includes("x-azure")) techs.push("Azure");
  if (h.includes("x-vercel")) techs.push("Vercel");
  if (h.includes("x-netlify")) techs.push("Netlify");
  if (h.includes("x-github")) techs.push("GitHub Pages");

if (b.includes("stripe.com")) techs.push("Stripe");
  if (b.includes("paypal.com")) techs.push("PayPal");
  if (b.includes("sslcommerz")) techs.push("SSLCommerz");
  if (b.includes("bkash") || b.includes("bKash")) techs.push("bKash");

  return [...new Set(techs)]; 
}

const WHOIS_SERVERS = {
  com: "whois.verisign-grs.com",
  net: "whois.verisign-grs.com",
  org: "whois.pir.org",
  io:  "whois.nic.io",
  co:  "whois.nic.co",
  bd:  "whois.btcl.net.bd",
  info:"whois.afilias.net",
  biz: "whois.biz",
  me:  "whois.nic.me",
  tv:  "whois.nic.tv",
  us:  "whois.nic.us",
  uk:  "whois.nic.uk",
  de:  "whois.denic.de",
  app: "whois.nic.google",
  dev: "whois.nic.google",
};

function whoisQuery(domain) {
  return new Promise((resolve) => {
    const tld = domain.split(".").pop().toLowerCase();
    const server = WHOIS_SERVERS[tld] || `whois.nic.${tld}`;

    const socket = new net.Socket();
    let data = "";
    socket.setTimeout(8000);
    socket.connect(43, server, () => {
      socket.write(domain + "\r\n");
    });
    socket.on("data", (chunk) => { data += chunk.toString(); });
    socket.on("end", () => resolve({ data, server }));
    socket.on("timeout", () => { socket.destroy(); resolve({ data, server }); });
    socket.on("error", () => resolve(null));
  });
}

function parseWhois(raw) {
  const info = {};
  const patterns = {
    "Registrar":       /registrar:\s*(.+)/i,
    "Registrant Org":  /registrant\s*org(?:anization)?:\s*(.+)/i,
    "Registrant Name": /registrant\s*name:\s*(.+)/i,
    "Registrant Email":/(registrant\s*email|registrant.*email):\s*(.+)/i,
    "Created":         /creat(?:ed|ion)\s*(?:date)?:\s*(.+)/i,
    "Updated":         /updat(?:ed)\s*(?:date)?:\s*(.+)/i,
    "Expires":         /expir(?:y|es|ation)\s*(?:date)?:\s*(.+)/i,
    "Status":          /domain\s*status:\s*(.+)/i,
    "DNSSEC":          /dnssec:\s*(.+)/i,
    "Name Server":     /name\s*server:\s*(.+)/i,
  };

  for (const [key, regex] of Object.entries(patterns)) {
    const match = raw.match(regex);
    if (match) {
      info[key] = (match[2] || match[1]).trim().split("\n")[0].trim();
    }
  }

const nsMatches = [...raw.matchAll(/name\s*server:\s*(.+)/gi)];
  if (nsMatches.length > 1) {
    info["Name Servers"] = nsMatches.map(m => m[1].trim()).join(", ");
    delete info["Name Server"];
  }

const statusMatches = [...raw.matchAll(/domain\s*status:\s*(.+)/gi)];
  if (statusMatches.length > 1) {
    info["Status"] = statusMatches.map(m => m[1].trim().split(" ")[0]).join(", ");
  }

  return info;
}

function fetchUrl(domain, path) {
  return new Promise((resolve) => {
    const options = { hostname: domain, path, method: "GET", timeout: 6000 };
    let body = "";
    const req = https.request(options, (res) => {
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; if (body.length > 20000) res.destroy(); });
      res.on("end", () => resolve({ status: res.statusCode, body }));
      res.on("close", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function parseRobots(body) {
  const lines = body.split("\n").map(l => l.trim()).filter(Boolean);
  const disallowed = [];
  const allowed = [];
  const sitemaps = [];
  let currentAgent = "*";

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const [key, ...rest] = line.split(":");
    const val = rest.join(":").trim();
    if (!val) continue;

    const k = key.trim().toLowerCase();
    if (k === "user-agent") currentAgent = val;
    else if (k === "disallow" && val) disallowed.push(val);
    else if (k === "allow" && val) allowed.push(val);
    else if (k === "sitemap") sitemaps.push(val);
  }

  return { disallowed, allowed, sitemaps };
}

async function detectWAF(domain) {
  const wafs = [];
  const normal = await new Promise((resolve) => {
    const req = https.request({ hostname: domain, path: "/", method: "GET", timeout: 6000 }, (res) => {
      resolve({ headers: res.headers, status: res.statusCode });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
  if (!normal) return wafs;
  const h = JSON.stringify(normal.headers).toLowerCase();

  if (h.includes("cf-ray") || h.includes("cf-cache-status")) wafs.push("Cloudflare");
  if (h.includes("x-sucuri-id") || h.includes("x-sucuri-cache")) wafs.push("Sucuri");
  if (h.includes("x-akamai") || h.includes("akamai-origin-hop")) wafs.push("Akamai");
  if (h.includes("x-iinfo") || h.includes("incap_ses")) wafs.push("Imperva Incapsula");
  if (h.includes("x-protected-by")) wafs.push("Protected: " + (normal.headers["x-protected-by"] || "unknown"));
  if (normal.headers["server"]) {
    const srv = normal.headers["server"].toLowerCase();
    if (srv.includes("awselb") || srv.includes("aws")) wafs.push("AWS WAF/ELB");
    if (srv.includes("ddos-guard")) wafs.push("DDoS-Guard");
  }

const triggered = await new Promise((resolve) => {
    const req = https.request({
      hostname: domain,
      path: "/?id=1'OR'1'='1&cmd=<script>alert(1)</script>",
      method: "GET", timeout: 6000,
      headers: { "User-Agent": "() { :; }; /bin/bash -i" }
    }, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });

  if (triggered && [403, 406, 429, 503].includes(triggered.status)) {
    if (wafs.length === 0) wafs.push(`WAF triggered (HTTP ${triggered.status} on malicious payload)`);
  }

  return [...new Set(wafs)];
}

const DIR_LIST = [
  "/admin", "/administrator", "/admin.php", "/admin/login", "/wp-admin",
  "/login", "/signin", "/dashboard", "/panel", "/control",
  "/api", "/api/v1", "/api/v2", "/api/docs", "/swagger", "/graphql",
  "/config", "/.env", "/.git", "/.git/config",
  "/backup", "/backup.zip", "/db.sql", "/database.sql",
  "/phpinfo.php", "/info.php", "/test.php", "/debug",
  "/uploads", "/files", "/static", "/assets", "/media",
  "/wp-login.php", "/wp-config.php", "/xmlrpc.php",
  "/server-status", "/.htaccess",
  "/console", "/actuator", "/actuator/health", "/actuator/env",
  "/metrics", "/health", "/status", "/version",
  "/register", "/signup", "/forgot-password",
  "/auth", "/oauth", "/callback", "/logout",
  "/.well-known/security.txt", "/security.txt",
];

function probePath(domain, path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: domain, path, method: "GET", timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" }
    }, (res) => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ path, status: res.statusCode, size: body.length, body, redirect: res.headers["location"] }));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function dirBruteforce(domain) {
  const found = [];

const r1 = "/nonexistent_" + Math.random().toString(36).slice(2);
  const r2 = "/fake_" + Math.random().toString(36).slice(2) + ".php";
  const [b1, b2] = await Promise.all([probePath(domain, r1), probePath(domain, r2)]);

  const baselineStatuses = new Set();
  const baselineSizes = [];
  [b1, b2].forEach(b => { if (b) { baselineStatuses.add(b.status); baselineSizes.push(b.size); } });
  const avgBaselineSize = baselineSizes.length
    ? Math.round(baselineSizes.reduce((a, x) => a + x, 0) / baselineSizes.length) : 0;

  console.log(c("dim", `  baseline: HTTP ${[...baselineStatuses].join("/")} | avg size: ${avgBaselineSize}b\n`));

const BATCH = 10;
  for (let i = 0; i < DIR_LIST.length; i += BATCH) {
    const batch = DIR_LIST.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(p => probePath(domain, p)));

    for (const r of results) {
      if (!r) continue;
      if (![200, 201, 301, 302, 401, 403].includes(r.status)) continue;

const sameStatus = baselineStatuses.has(r.status);
      const sizeDiff = Math.abs(r.size - avgBaselineSize);
      if (sameStatus && sizeDiff < 300) continue; 

let note = "";
      if (r.status === 200) {
        
        const bodyTrimmed = (r.body || "").trim();
        if (bodyTrimmed.length === 0) {
          note = "200 but empty response — likely executed server-side (safe, not exposed)";
        } else {
          note = "ACCESSIBLE!";
        }
      }
      else if (r.status === 401) note = "AUTH REQUIRED — endpoint exists!";
      else if (r.status === 403 && !sameStatus) note = "REAL 403 — file exists but blocked";
      else if (r.status === 403 && sameStatus) note = "possibly WAF generic block";
      else if ([301, 302].includes(r.status)) note = "REDIRECT → " + (r.redirect || "?");

      found.push({ ...r, note });
    }
  }
  return found;
}

function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  return [...new Set(text.match(emailRegex) || [])].filter(e =>
    !e.includes("example.com") && !e.includes("sentry.io") &&
    !e.endsWith(".png") && !e.endsWith(".jpg") &&
    !e.includes("@2x") && e.length < 80
  );
}

async function harvestEmails(domain) {
  const allEmails = new Set();
  const paths = ["/", "/contact", "/about", "/team", "/support", "/help", "/privacy", "/terms"];
  for (const path of paths) {
    const res = await fetchUrl(domain, path);
    if (res && res.body) extractEmails(res.body).forEach(e => allEmails.add(e));
  }
  return [...allEmails];
}

const KNOWN_SERVICES = {
  "google-analytics.com": "📊 Google Analytics",
  "googletagmanager.com": "📊 Google Tag Manager",
  "facebook.net": "📘 Facebook SDK/Pixel",
  "connect.facebook.net": "📘 Facebook Connect",
  "hotjar.com": "🔥 Hotjar",
  "intercom.io": "💬 Intercom",
  "crisp.chat": "💬 Crisp",
  "tawk.to": "💬 Tawk.to",
  "stripe.com": "💳 Stripe",
  "paypal.com": "💳 PayPal",
  "cdn.jsdelivr.net": "📦 jsDelivr CDN",
  "cdnjs.cloudflare.com": "📦 cdnjs",
  "fonts.googleapis.com": "🔤 Google Fonts",
  "maps.googleapis.com": "🗺 Google Maps",
  "recaptcha.net": "🛡 reCAPTCHA",
  "hcaptcha.com": "🛡 hCaptcha",
  "sentry.io": "🐛 Sentry",
  "amplitude.com": "📊 Amplitude",
  "mixpanel.com": "📊 Mixpanel",
  "segment.com": "📊 Segment",
  "youtube.com": "▶️ YouTube Embed",
  "vimeo.com": "▶️ Vimeo",
};

function extractExternalAssets(body, domain) {
  const scripts = new Set();
  const links = new Set();
  const iframes = new Set();

  const scriptMatches = [...body.matchAll(/src=["']?(https?:\/\/[^"'\s>]+)/gi)];
  scriptMatches.forEach(m => {
    try { const h = new URL(m[1]).hostname; if (!h.includes(domain)) scripts.add(h); } catch {}
  });

  const linkMatches = [...body.matchAll(/href=["']?(https?:\/\/[^"'\s>]+)/gi)];
  linkMatches.forEach(m => {
    try { const h = new URL(m[1]).hostname; if (!h.includes(domain)) links.add(h); } catch {}
  });

  const iframeMatches = [...body.matchAll(/iframe[^>]+src=["']?(https?:\/\/[^"'\s>]+)/gi)];
  iframeMatches.forEach(m => {
    try { iframes.add(new URL(m[1]).hostname); } catch {}
  });

  return { scripts: [...scripts], links: [...links], iframes: [...iframes] };
}

async function detectHTTPVersion(domain) {
  const result = { http2: false, http3: false, altSvc: null };
  await new Promise((resolve) => {
    const req = https.request({
      hostname: domain, path: "/", method: "HEAD", timeout: 6000
    }, (res) => {
      const altSvc = res.headers["alt-svc"] || "";
      result.altSvc = altSvc || null;
      if (altSvc.includes("h3") || altSvc.includes('h3-')) result.http3 = true;
      
      if (res.httpVersion === "2.0" || res.headers["x-firefox-spdy"] === "h2") result.http2 = true;
      if (altSvc.includes("h2")) result.http2 = true;
      resolve();
    });
    req.on("error", resolve);
    req.on("timeout", () => { req.destroy(); resolve(); });
    req.end();
  });
  return result;
}

async function analyzeCookies(domain) {
  const cookies = [];
  await new Promise((resolve) => {
    const req = https.request({
      hostname: domain, path: "/", method: "GET", timeout: 6000,
      headers: { "User-Agent": "Mozilla/5.0" }
    }, (res) => {
      const rawCookies = res.headers["set-cookie"] || [];
      rawCookies.forEach(raw => {
        const parts = raw.split(";").map(p => p.trim());
        const nameVal = parts[0];
        const name = nameVal.split("=")[0];
        const flags = parts.slice(1).map(p => p.toLowerCase());
        cookies.push({
          name,
          httpOnly: flags.some(f => f === "httponly"),
          secure: flags.some(f => f === "secure"),
          sameSite: flags.find(f => f.startsWith("samesite"))?.split("=")[1] || null,
          expires: flags.find(f => f.startsWith("expires"))?.split("=").slice(1).join("=") || null,
          path: flags.find(f => f.startsWith("path="))?.split("=")[1] || "/",
        });
      });
      resolve();
    });
    req.on("error", resolve);
    req.on("timeout", () => { req.destroy(); resolve(); });
    req.end();
  });
  return cookies;
}

function followRedirects(url, maxHops = 10) {
  return new Promise((resolve) => {
    const chain = [];
    const follow = (currentUrl, hops) => {
      if (hops > maxHops) return resolve(chain);
      let parsed;
      try { parsed = new URL(currentUrl); } catch { return resolve(chain); }
      const mod = parsed.protocol === "https:" ? https : http;
      const start = Date.now();
      const req = mod.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "HEAD", timeout: 5000,
        headers: { "User-Agent": "Mozilla/5.0" }
      }, (res) => {
        const ms = Date.now() - start;
        chain.push({ url: currentUrl, status: res.statusCode, ms });
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers["location"]) {
          let next = res.headers["location"];
          if (next.startsWith("/")) next = `${parsed.protocol}//${parsed.hostname}${next}`;
          follow(next, hops + 1);
        } else {
          resolve(chain);
        }
      });
      req.on("error", () => { chain.push({ url: currentUrl, status: "error", ms: 0 }); resolve(chain); });
      req.on("timeout", () => { req.destroy(); chain.push({ url: currentUrl, status: "timeout", ms: 0 }); resolve(chain); });
      req.end();
    };
    follow(url, 0);
  });
}

function extractMetaTags(body) {
  const meta = {};
  const tags = [
    { key: "title", regex: /<title[^>]*>([^<]+)<\/title>/i },
    { key: "description", regex: /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i },
    { key: "og:title", regex: /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i },
    { key: "og:description", regex: /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i },
    { key: "og:image", regex: /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i },
    { key: "og:type", regex: /<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i },
    { key: "twitter:card", regex: /<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']+)["']/i },
    { key: "viewport", regex: /<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']+)["']/i },
    { key: "robots", regex: /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i },
    { key: "generator", regex: /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i },
    { key: "canonical", regex: /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i },
  ];
  tags.forEach(({ key, regex }) => {
    const m = body.match(regex);
    if (m) meta[key] = m[1].trim().slice(0, 200);
  });
  return meta;
}

// ─── Response Time / Latency ──────────────────────────────────────────────────
async function measureLatency(domain, runs = 3) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    await new Promise((resolve) => {
      const req = https.request({
        hostname: domain, path: "/", method: "HEAD", timeout: 8000
      }, (res) => { res.resume(); resolve(Date.now() - start); });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.end();
    }).then(ms => { if (ms) times.push(ms); });
  }
  if (!times.length) return null;
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const min = Math.min(...times);
  const max = Math.max(...times);
  return { avg, min, max, times };
}

// ─── DNS Propagation Check ────────────────────────────────────────────────────
const GLOBAL_DNS = [
  { name: "Google (8.8.8.8)", ip: "8.8.8.8" },
  { name: "Cloudflare (1.1.1.1)", ip: "1.1.1.1" },
  { name: "OpenDNS (208.67.222.222)", ip: "208.67.222.222" },
  { name: "Quad9 (9.9.9.9)", ip: "9.9.9.9" },
  { name: "AlternateDNS (76.76.19.19)", ip: "76.76.19.19" },
];

function queryDNSServer(domain, serverIP) {
  return new Promise((resolve) => {
    const resolver = new dns.Resolver();
    resolver.setServers([serverIP]);
    resolver.resolve4(domain, (err, addrs) => {
      if (err) resolve(null);
      else resolve(addrs);
    });
  });
}

// ─── Banner Grabbing ──────────────────────────────────────────────────────────
function grabBanner(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let banner = "";
    socket.setTimeout(timeout);
    socket.connect(port, host, () => {
      // Send probe for HTTP
      if (port === 80 || port === 8080) {
        socket.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
      } else if (port === 21) {
        // FTP sends banner automatically
      } else if (port === 22) {
        // SSH sends banner automatically
      } else if (port === 25 || port === 587) {
        // SMTP sends banner automatically
      }
    });
    socket.on("data", (data) => {
      banner += data.toString().slice(0, 500);
      socket.destroy();
    });
    socket.on("end", () => resolve(banner.trim() || null));
    socket.on("close", () => resolve(banner.trim() || null));
    socket.on("timeout", () => { socket.destroy(); resolve(null); });
    socket.on("error", () => resolve(null));
  });
}

// ─── Robots.txt Improved Parser ───────────────────────────────────────────────
function parseRobotsImproved(body) {
  const lines = body.split("\n").map(l => l.trim()).filter(Boolean);
  const groups = [];
  let current = null;
  const sitemaps = [];

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    if (!val) continue;

    if (key === "user-agent") {
      if (!current || current.disallowed.length > 0 || current.allowed.length > 0) {
        current = { agents: [val], disallowed: [], allowed: [] };
        groups.push(current);
      } else {
        current.agents.push(val);
      }
    } else if (key === "disallow" && current) {
      current.disallowed.push(val);
    } else if (key === "allow" && current) {
      current.allowed.push(val);
    } else if (key === "sitemap") {
      sitemaps.push(val);
    }
  }
  return { groups, sitemaps };
}

// ─── JSON Report ──────────────────────────────────────────────────────────────
function askSaveReport(reportData) {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(c("cyan", "\n💾 Save full report as JSON? (Y/N): "));
    rl.once("line", (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === "y") {
        const fs = require("fs");
        const filename = `recon_${domain.replace(/\./g, "_")}_${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(reportData, null, 2));
        ok("Report saved", filename);
        resolve(true);
      } else {
        console.log(c("dim", "  Report not saved."));
        resolve(false);
      }
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(c("bold", `\n🔍 Domain Recon: ${c("cyan", domain)}`));

  // 1. DNS Lookups
  section("DNS Records");

  try {
    const aRecords = await dns.resolve4(domain);
    ok("A (IPv4)", aRecords.join(", "));
  } catch { fail("A (IPv4)", "not found"); }

  try {
    const aaaaRecords = await dns.resolve6(domain);
    ok("AAAA (IPv6)", aaaaRecords.join(", "));
  } catch { fail("AAAA (IPv6)", "not found"); }

  try {
    const mx = await dns.resolveMx(domain);
    const sorted = mx.sort((a, b) => a.priority - b.priority);
    ok("MX", sorted.map(r => `${r.exchange} (priority: ${r.priority})`).join("\n        "));
  } catch { fail("MX", "not found"); }

  try {
    const ns = await dns.resolveNs(domain);
    ok("NS", ns.join(", "));
  } catch { fail("NS", "not found"); }

  try {
    const txt = await dns.resolveTxt(domain);
    txt.forEach((r, i) => ok(`TXT[${i}]`, r.join("")));
  } catch { fail("TXT", "not found"); }

  try {
    const cname = await dns.resolveCname(domain);
    ok("CNAME", cname.join(", "));
  } catch { fail("CNAME", "not found or not applicable"); }

  try {
    const soa = await dns.resolveSoa(domain);
    ok("SOA", `nsname=${soa.nsname}, hostmaster=${soa.hostmaster}, serial=${soa.serial}`);
  } catch { fail("SOA", "not found"); }

  // Reverse DNS
  try {
    const ips = await dns.resolve4(domain);
    section("Reverse DNS (PTR)");
    for (const ip of ips) {
      try {
        const ptr = await dns.reverse(ip);
        ok(ip, ptr.join(", "));
      } catch {
        warn(ip, "no PTR record");
      }
    }
  } catch {}

  // 2. HTTP Headers
  section("HTTP Headers & Server Info");
  const result = await fetchHeaders(domain);
  if (result) {
    ok("Protocol", result.proto);
    ok("Status Code", result.status);
    const interesting = ["server", "x-powered-by", "x-frame-options",
      "content-security-policy", "strict-transport-security",
      "x-content-type-options", "x-xss-protection", "via",
      "cf-ray", "x-cache", "set-cookie", "location"];
    for (const h of interesting) {
      if (result.headers[h]) ok(h, result.headers[h]);
    }
    // CDN/Cloudflare detection
    if (result.headers["cf-ray"]) warn("CDN", "Cloudflare detected");
    else if (result.headers["via"]) warn("CDN/Proxy", result.headers["via"]);
  } else {
    fail("HTTP/HTTPS", "could not connect");
  }

  // 3. Port Scan
  section("Port Scan (common ports)");
  let resolvedIP;
  try { [resolvedIP] = await dns.resolve4(domain); } catch {}

  const target = resolvedIP || domain;
  console.log(c("dim", `  scanning ${target}...\n`));

  const results = await Promise.all(
    COMMON_PORTS.map(async ({ port, name }) => ({
      port, name, open: await scanPort(target, port),
    }))
  );

  const open = results.filter(r => r.open);
  const closed = results.filter(r => !r.open);

  open.forEach(r => ok(`${r.port}/${r.name}`, "OPEN"));
  closed.forEach(r => console.log(`  ${c("dim", `✘ ${r.port}/${r.name}: closed`)}`));

  // 4. SSL Certificate
  section("SSL Certificate");
  const cert = await getSSLCert(domain);
  if (cert) {
    const sub = cert.subject;
    const iss = cert.issuer;
    const valid_from = new Date(cert.valid_from);
    const valid_to = new Date(cert.valid_to);
    const daysLeft = Math.floor((valid_to - Date.now()) / (1000 * 60 * 60 * 24));

    ok("Subject CN", sub.CN || "n/a");
    ok("Issued To", sub.O || sub.CN || "n/a");
    ok("Issuer", `${iss.O || ""} (${iss.CN || ""})`);
    ok("Valid From", valid_from.toDateString());
    if (daysLeft > 30) ok("Valid Until", `${valid_to.toDateString()} (${daysLeft} days left)`);
    else if (daysLeft > 0) warn("Valid Until", `${valid_to.toDateString()} (⚠ only ${daysLeft} days left!)`);
    else fail("Valid Until", `EXPIRED on ${valid_to.toDateString()}`);

    if (cert.subjectaltname) {
      const sans = cert.subjectaltname.split(", ").map(s => s.replace("DNS:", "")).slice(0, 10);
      ok("SANs (alt domains)", sans.join(", ") + (cert.subjectaltname.split(", ").length > 10 ? "..." : ""));
    }
  } else {
    fail("SSL", "could not retrieve certificate");
  }

  // 5. Subdomain Finder
  section("Subdomain Finder");
  console.log(c("dim", `  checking ${COMMON_SUBDOMAINS.length} common subdomains...\n`));
  const subdomains = await findSubdomains(domain);
  if (subdomains.length > 0) {
    subdomains.forEach(s => ok(s.sub, s.ips.join(", ")));
  } else {
    warn("Result", "no common subdomains found (may be behind Cloudflare or private)");
  }

  // 6. Technology Detection
  section("Technology Detection");
  console.log(c("dim", `  fetching page body...\n`));
  const bodyResult = await fetchBody(domain);
  if (bodyResult) {
    const techs = detectTech(bodyResult.body, bodyResult.headers);
    if (techs.length > 0) {
      techs.forEach(t => ok("Detected", t));
    } else {
      warn("Result", "no known technologies detected");
    }
  } else {
    fail("Tech Detection", "could not fetch page body");
  }

  // 7. WHOIS Lookup
  section("WHOIS Lookup");
  console.log(c("dim", `  querying whois server...\n`));
  const whoisResult = await whoisQuery(domain);
  if (whoisResult && whoisResult.data) {
    const info = parseWhois(whoisResult.data);
    if (Object.keys(info).length > 0) {
      for (const [key, val] of Object.entries(info)) {
        if (key === "Expires") {
          const expDate = new Date(val);
          const daysLeft = Math.floor((expDate - Date.now()) / (1000 * 60 * 60 * 24));
          if (!isNaN(daysLeft)) {
            if (daysLeft > 60) ok(key, `${val} (${daysLeft} days left)`);
            else if (daysLeft > 0) warn(key, `${val} ⚠ only ${daysLeft} days left! Renew soon!`);
            else fail(key, `DOMAIN EXPIRED! ${val}`);
          } else {
            ok(key, val);
          }
        } else {
          ok(key, val);
        }
      }
    } else {
      warn("WHOIS", `got response from ${whoisResult.server} but could not parse fields`);
      // show raw first 800 chars
      const raw = whoisResult.data.replace(/\r/g, "").split("\n")
        .filter(l => l.trim() && !l.trim().startsWith("%") && !l.trim().startsWith("#"))
        .slice(0, 15)
        .join("\n");
      if (raw) console.log(c("dim", raw.split("\n").map(l => "    " + l).join("\n")));
    }
  } else {
    fail("WHOIS", "could not connect to WHOIS server");
  }

  // 8. Robots.txt & Sitemap
  section("Robots.txt & Sitemap");

  const robotsRes = await fetchUrl(domain, "/robots.txt");
  if (robotsRes && robotsRes.status === 200) {
    ok("robots.txt", `found (HTTP ${robotsRes.status})`);
    const parsed = parseRobots(robotsRes.body);

    if (parsed.disallowed.length > 0) {
      const shown = parsed.disallowed.slice(0, 15);
      ok("Disallowed paths", `${parsed.disallowed.length} total`);
      shown.forEach(p => console.log(`    ${c("yellow", "→")} ${p}`));
      if (parsed.disallowed.length > 15) console.log(c("dim", `    ... and ${parsed.disallowed.length - 15} more`));
    }

    if (parsed.allowed.length > 0) {
      ok("Allowed paths", parsed.allowed.slice(0, 5).join(", "));
    }

    if (parsed.sitemaps.length > 0) {
      ok("Sitemaps in robots.txt", parsed.sitemaps.join(", "));
    }
  } else if (robotsRes && robotsRes.status === 404) {
    warn("robots.txt", "not found (404) — no crawl rules set");
  } else {
    fail("robots.txt", "could not fetch");
  }

  // Check common sitemap paths
  const sitemapPaths = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap/sitemap.xml"];
  for (const sp of sitemapPaths) {
    const smRes = await fetchUrl(domain, sp);
    if (smRes && smRes.status === 200) {
      // Count URLs in sitemap
      const urlCount = (smRes.body.match(/<url>/gi) || []).length;
      const locCount = (smRes.body.match(/<loc>/gi) || []).length;
      const sitemapCount = (smRes.body.match(/<sitemap>/gi) || []).length;
      ok(`Sitemap (${sp})`, `found — ${urlCount || locCount} URLs${sitemapCount ? `, ${sitemapCount} sub-sitemaps` : ""}`);

      // Show first few URLs
      const locs = [...smRes.body.matchAll(/<loc>(.*?)<\/loc>/gi)].slice(0, 5);
      locs.forEach(m => console.log(`    ${c("dim", "→")} ${m[1]}`));
      if (locCount > 5) console.log(c("dim", `    ... and ${locCount - 5} more URLs`));
      break;
    }
  }

  // 9. WAF Detection
  section("WAF Detection");
  console.log(c("dim", `  probing for firewall signatures...\n`));
  const wafs = await detectWAF(domain);
  if (wafs.length > 0) {
    wafs.forEach(w => ok("WAF/CDN", w));
  } else {
    warn("WAF", "no known WAF detected — may be unprotected or using unknown WAF");
  }

  // 10. Directory Bruteforce
  section("Directory Bruteforce");
  console.log(c("dim", `  checking ${DIR_LIST.length} paths (with false-positive filter)...\n`));
  const dirs = await dirBruteforce(domain);
  if (dirs.length > 0) {
    dirs.forEach(r => {
      const statusColor = r.status === 200 ? "green"
        : r.status === 401 ? "cyan"
        : r.status === 403 ? "yellow"
        : "dim";
      const icon = r.status === 200 ? "🟢" : r.status === 401 ? "🔵" : r.status === 403 ? "🟡" : "⬛";
      console.log(`  ${icon} ${c("bold", r.path)} ${c(statusColor, "[" + r.status + "]")} ${c("dim", r.note || "")} ${c("dim", r.size ? "(" + r.size + "b)" : "")}`);
    });
  } else {
    ok("Result", "no real findings after false-positive filtering (WAF likely returning generic responses)");
  }

  // 11. Email Harvesting
  section("Email Harvesting");
  console.log(c("dim", `  scanning pages for email addresses...\n`));
  const emails = await harvestEmails(domain);
  if (emails.length > 0) {
    emails.forEach(e => ok("Email", e));
  } else {
    warn("Result", "no emails found (may be obfuscated or image-based)");
  }

  // 12. External Links & Third-party Scripts
  section("External Links & Third-party Scripts");
  if (bodyResult && bodyResult.body) {
    const assets = extractExternalAssets(bodyResult.body, domain);

    if (assets.scripts.length > 0) {
      ok("External Scripts", `${assets.scripts.length} third-party hosts`);
      assets.scripts.forEach(host => {
        const label = KNOWN_SERVICES[host] || host;
        console.log(`    ${c("yellow", "→")} ${label}`);
      });
    } else {
      warn("Scripts", "no external scripts found");
    }

    if (assets.iframes.length > 0) {
      ok("Iframes", assets.iframes.join(", "));
    }

    if (assets.links.length > 0) {
      const unique = assets.links.slice(0, 15);
      ok("External Links", `${assets.links.length} unique domains`);
      unique.forEach(h => {
        const label = KNOWN_SERVICES[h] || h;
        console.log(`    ${c("dim", "→")} ${label}`);
      });
      if (assets.links.length > 15) console.log(c("dim", `    ... and ${assets.links.length - 15} more`));
    }
  } else {
    fail("External Assets", "page body not available");
  }

  // 13. HTTP Version Detection
  section("HTTP Version Detection");
  const httpVer = await detectHTTPVersion(domain);
  ok("HTTP/1.1", "supported (baseline)");
  ok("HTTP/2", httpVer.http2 ? "✅ supported" : "not detected");
  ok("HTTP/3 (QUIC)", httpVer.http3 ? "✅ supported" : "not detected");
  if (httpVer.altSvc) ok("Alt-Svc Header", httpVer.altSvc.slice(0, 120));

  // 14. Cookie Analysis
  section("Cookie Analysis");
  const cookies = await analyzeCookies(domain);
  if (cookies.length > 0) {
    ok("Cookies Found", cookies.length);
    cookies.forEach(ck => {
      const flags = [];
      if (ck.httpOnly) flags.push(c("green", "HttpOnly✓"));
      else flags.push(c("red", "HttpOnly✗"));
      if (ck.secure) flags.push(c("green", "Secure✓"));
      else flags.push(c("red", "Secure✗"));
      if (ck.sameSite) flags.push(c("green", `SameSite=${ck.sameSite}`));
      else flags.push(c("yellow", "SameSite✗"));
      console.log(`    ${c("bold", ck.name)}: ${flags.join(" | ")}`);
    });
  } else {
    warn("Cookies", "no Set-Cookie headers on homepage");
  }

  // 15. Redirect Chain
  section("Redirect Chain");
  const chain = await followRedirects(`http://${domain}`);
  if (chain.length > 0) {
    chain.forEach((hop, i) => {
      const icon = i === chain.length - 1 ? "🏁" : "↪";
      console.log(`  ${icon} [${hop.status}] ${hop.url} ${c("dim", hop.ms ? `(${hop.ms}ms)` : "")}`);
    });
    const httpToHttps = chain.some(h => h.url.startsWith("http://")) && chain.some(h => h.url.startsWith("https://"));
    if (httpToHttps) ok("HTTP→HTTPS", "redirect confirmed ✅");
  } else {
    warn("Redirect", "could not trace chain");
  }

  // 16. Meta Tags / Open Graph
  section("Meta Tags & Open Graph");
  if (bodyResult && bodyResult.body) {
    const meta = extractMetaTags(bodyResult.body);
    if (Object.keys(meta).length > 0) {
      Object.entries(meta).forEach(([k, v]) => ok(k, v));
    } else {
      warn("Meta", "no meta tags found");
    }
  } else {
    fail("Meta Tags", "page body unavailable");
  }

  // 17. Response Time / Latency
  section("Response Time & Latency");
  console.log(c("dim", `  measuring latency (3 requests)...\n`));
  const latency = await measureLatency(domain);
  if (latency) {
    const color = latency.avg < 300 ? "green" : latency.avg < 800 ? "yellow" : "red";
    ok("Average", c(color, `${latency.avg}ms`));
    ok("Min / Max", `${latency.min}ms / ${latency.max}ms`);
    ok("Rating", latency.avg < 200 ? "🚀 Excellent" : latency.avg < 500 ? "✅ Good" : latency.avg < 1000 ? "⚠️ Moderate" : "🐢 Slow");
  } else {
    fail("Latency", "could not measure");
  }

  // 18. DNS Propagation
  section("DNS Propagation Check");
  console.log(c("dim", `  querying ${GLOBAL_DNS.length} global DNS servers...\n`));
  const dnsResolver = new (require("dns").Resolver)();
  const propagationResults = await Promise.all(
    GLOBAL_DNS.map(async (srv) => {
      const resolver = new (require("dns").Resolver)();
      resolver.setServers([srv.ip]);
      return new Promise((resolve) => {
        resolver.resolve4(domain, (err, addrs) => {
          resolve({ name: srv.name, ips: err ? null : addrs });
        });
      });
    })
  );
  const allIPs = propagationResults.filter(r => r.ips).map(r => r.ips.sort().join(","));
  const consistent = allIPs.length > 1 && allIPs.every(ip => ip === allIPs[0]);
  propagationResults.forEach(r => {
    if (r.ips) ok(r.name, r.ips.join(", "));
    else warn(r.name, "no response");
  });
  if (consistent) ok("Propagation", "✅ Consistent across all servers");
  else warn("Propagation", "⚠️ Different IPs from different servers (may still be propagating)");

  // 19. Robots.txt Improved
  section("Robots.txt (Detailed)");
  const robotsRes2 = await fetchUrl(domain, "/robots.txt");
  if (robotsRes2 && robotsRes2.status === 200) {
    const parsed2 = parseRobotsImproved(robotsRes2.body);
    parsed2.groups.forEach(g => {
      console.log(`\n  ${c("bold", "User-agent:")} ${g.agents.join(", ")}`);
      if (g.disallowed.length > 0) {
        g.disallowed.slice(0, 8).forEach(p => console.log(`    ${c("red", "Disallow:")} ${p}`));
        if (g.disallowed.length > 8) console.log(c("dim", `    ... and ${g.disallowed.length - 8} more`));
      }
      if (g.allowed.length > 0) {
        g.allowed.forEach(p => console.log(`    ${c("green", "Allow:")}    ${p}`));
      }
    });
    if (parsed2.sitemaps.length > 0) {
      console.log("");
      parsed2.sitemaps.forEach(s => ok("Sitemap", s));
    }
  } else {
    warn("robots.txt", "not found or unreachable");
  }

  // 20. Banner Grabbing (open ports only)
  section("Banner Grabbing");
  const openPortsForBanner = open.filter(p => [21, 22, 25, 80, 8080].includes(p.port));
  if (openPortsForBanner.length > 0) {
    for (const p of openPortsForBanner) {
      const banner = await grabBanner(resolvedIP || domain, p.port);
      if (banner) {
        ok(`Port ${p.port} (${p.name})`, banner.split("\n")[0].slice(0, 100));
      } else {
        warn(`Port ${p.port} (${p.name})`, "no banner");
      }
    }
  } else {
    warn("Banner", "no applicable open ports for banner grabbing");
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  section("Summary");
  const reportData = {
    domain,
    scannedAt: new Date().toISOString(),
    resolvedIP,
    openPorts: open.map(r => `${r.port}/${r.name}`),
    ssl: cert ? {
      issuer: cert.issuer?.O,
      validUntil: cert.valid_to,
      daysLeft: Math.floor((new Date(cert.valid_to) - Date.now()) / (1000 * 60 * 60 * 24))
    } : null,
    technologies: bodyResult ? detectTech(bodyResult.body, bodyResult.headers) : [],
    redirectChain: chain,
    latency,
    waf: wafs,
    dirFindings: dirs.map(d => ({ path: d.path, status: d.status, note: d.note })),
    emails,
    cookies,
    metaTags: bodyResult ? extractMetaTags(bodyResult.body) : {},
    dnsPropagation: propagationResults,
  };

  if (resolvedIP) ok("Resolved IP", resolvedIP);
  ok("Open Ports", open.length > 0 ? open.map(r => `${r.port} (${r.name})`).join(", ") : "none");
  if (cert) {
    const dl = Math.floor((new Date(cert.valid_to) - Date.now()) / (1000 * 60 * 60 * 24));
    ok("SSL", dl > 0 ? `Valid — ${dl} days left` : "EXPIRED ⚠️");
  }
  if (latency) ok("Latency", `avg ${latency.avg}ms`);
  ok("WAF", wafs.length > 0 ? wafs.join(", ") : "none detected");
  ok("Technologies", reportData.technologies.length > 0 ? reportData.technologies.join(", ") : "none detected");
  ok("Emails Found", emails.length > 0 ? emails.join(", ") : "none");
  ok("Dir Findings", dirs.length > 0 ? dirs.map(d => d.path).join(", ") : "none after filtering");

  console.log("\n" + c("dim", "Done.\n"));

  // JSON Save prompt
  await askSaveReport(reportData);
}

main().catch(err => {
  console.error(c("red", "Error: ") + err.message);
  process.exit(1);
});
