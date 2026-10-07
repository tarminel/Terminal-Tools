# WDT (Web Domain Tool) v2

A powerful, zero-dependency Node.js domain reconnaissance tool for authorized penetration testing and bug bounty recon. Runs entirely from the terminal with no API keys required.

## Features

| Module | What it does |
|---|---|
| DNS Records | A, AAAA, MX, NS, TXT, CNAME, SOA lookup |
| Reverse DNS | PTR records for resolved IPs |
| HTTP Headers | Server, security headers, CDN detection |
| Port Scanner | 20 common ports (FTP, SSH, HTTP, DB ports, etc.) |
| SSL Certificate | Issuer, validity, SANs, expiry warning |
| Subdomain Finder | Bruteforce ~50 common subdomains via DNS |
| Technology Detection | CMS, JS frameworks, analytics, CDN, payment providers |
| WHOIS Lookup | Registrar, dates, nameservers (no external API) |
| Robots.txt & Sitemap | Parse disallow rules, sitemap URL count |
| WAF Detection | Cloudflare, Sucuri, Akamai, Imperva, AWS WAF |
| Directory Bruteforce | ~60 paths with false-positive filtering |
| Email Harvesting | Regex extraction across multiple pages |
| External Assets | Third-party scripts, iframes, external links |
| HTTP Version | HTTP/1.1, HTTP/2, HTTP/3 (QUIC) via Alt-Svc |
| Cookie Analysis | HttpOnly, Secure, SameSite flag audit |
| Redirect Chain | Full HTTP→HTTPS redirect trace with timing |
| Meta Tags / OG | Title, description, og:*, twitter:card, canonical |
| Latency Measurement | 3-run avg/min/max with quality rating |
| DNS Propagation | Check across Google, Cloudflare, OpenDNS, Quad9 |
| Banner Grabbing | Raw banner from open ports (FTP, SSH, SMTP, HTTP) |
| JSON Report | Optional full report export to `.json` |

## Requirements

- Node.js v14+
- No npm packages — uses only Node.js built-in modules (`dns`, `net`, `https`, `http`, `tls`)

## Installation

```bash
git clone https://github.com/tarminel/Terminal-Tools/tree/main/Website%20Domain%20Tool

node WDT_V2.js <domain>
```
•• no `npm install` needed

**Examples:**

```bash
node WDT_V2.js example.com
node WDT_V2.js namecheap.com
node WDT_V2.js google.com
```

At the end of the scan, you'll be prompted to save a full JSON report:

```
💾 Save full report as JSON? (Y/N):
```

The report is saved as `recon_<domain>_<timestamp>.json`.

## Output Example

```
🔍 Domain Recon: example.com

━━━ DNS Records ━━━
  ✔ A (IPv4): 93.184.216.34
  ✔ MX: mail.example.com (priority: 10)
  ✔ NS: a.iana-servers.net, b.iana-servers.net
  ...

━━━ Port Scan (common ports) ━━━
  scanning 93.184.216.34...

  ✔ 80/HTTP: OPEN
  ✔ 443/HTTPS: OPEN
  ✘ 22/SSH: closed
  ...
```

## False Positive Filtering (Directory Bruteforce)

The directory bruteforce module first sends two requests to random non-existent paths to establish a baseline (status code + response size). Any path that returns the same status and a similar response size as the baseline is automatically filtered out — avoids flooding results with WAF generic 403/404 responses.

## Supported WHOIS TLDs

Built-in WHOIS server map for: `.com`, `.net`, `.org`, `.io`, `.co`, `.bd`, `.info`, `.biz`, `.me`, `.tv`, `.us`, `.uk`, `.de`, `.app`, `.dev`

Falls back to `whois.nic.<tld>` for unlisted TLDs.

## Legal Notice

This tool is intended for **authorized security testing only** — bug bounty programs, penetration tests with written permission, or your own infrastructure. Scanning domains without permission may be illegal in your jurisdiction.