# 🧅 Onion Wallet

> A privacy-first, multi-chain CLI crypto wallet — Tor-native, no API keys required, runs entirely from your terminal.



![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)




![License](https://img.shields.io/badge/license-ISC-blue)




![Chains](https://img.shields.io/badge/chains-EVM%20%2B%20BTC%20%2B%20LTC%20%2B%20SOL%20%2B%20TRX-orange)



---

## ✨ Features

- 🔷 **EVM Support** — Ethereum, BNB Chain, Polygon, Arbitrum, Optimism, Base, Avalanche, Fantom, CELO, Hyperliquid
- ₿ **Non-EVM Support** — Bitcoin, Litecoin, Solana, Tron
- 🧅 **Tor Tunnel** — Route all traffic through Tor (SOCKS5 proxy, DNS leak-free)
- 📲 **QR Code** — Show any wallet address as a terminal QR code
- 📜 **Transaction History** — Paginated (20 per page), works on all chains
- 🔑 **One Seed Phrase** — Derives addresses for all chains automatically (BIP44)
- 💾 **Fully Offline Keys** — Private keys and seed phrase stored locally only (`~/.onionwallet/`)
- 📤 **Send & Receive** — Native coins and ERC-20 tokens
- 🪙 **Token Support** — ERC-20 balance check and transfer on all EVM chains

---

## 📦 Install

```bash
https://github.com/tarminel/Terminal-Tools/tree/main/Terminal%20with%20onion%20wallet
cd Onion_Wallet_v2
npm install
node index.js
```

---

## 🚀 Usage

```bash
node index.js
# or after npm link:
onionwallet
```

On first run, you'll be prompted to:
- **Create** a new wallet (generates a 12-word seed phrase)
- **Import** from an existing seed phrase (12 or 24 words)
- **Import** from a private key (EVM only)

---

## 🌐 Supported Chains

### EVM Chains
| Chain | Symbol | Explorer |
|---|---|---|
| Ethereum | ETH | etherscan.io |
| BNB Smart Chain | BNB | bscscan.com |
| Polygon | POL | polygonscan.com |
| Arbitrum One | ETH | arbiscan.io |
| Optimism | ETH | optimistic.etherscan.io |
| Base | ETH | basescan.org |
| Avalanche C-Chain | AVAX | snowtrace.io |
| Fantom | FTM | ftmscan.com |
| CELO | CELO | celoscan.io |
| Hyperliquid | HYPE | explorer.hyperliquid.xyz |

### Non-EVM Chains
| Chain | Symbol | API Used |
|---|---|---|
| Bitcoin | BTC | Blockstream + Blockchair |
| Litecoin | LTC | Blockchair |
| Solana | SOL | Solana RPC (public) |
| Tron | TRX | TronGrid |

---

## 🔑 Key Derivation (BIP44)

One seed phrase → all addresses, automatically:

| Chain | Derivation Path |
|---|---|
| ETH / EVM | `m/44'/60'/0'/0/N` |
| Bitcoin | `m/44'/0'/0'/0/N` |
| Litecoin | `m/44'/2'/0'/0/N` |
| Solana | `m/44'/501'/N'/0'` |
| Tron | `m/44'/195'/0'/0/N` |

---

## 🧅 Tor Setup

```bash
# Install Tor
sudo apt install tor   # Debian/Ubuntu/Parrot OS
brew install tor       # macOS

# Start Tor daemon
tor &

# In Onion Wallet → select "Turn on Tor tunnel" → port 9050
```

> Tor Browser users: use port `9150` instead.

All HTTP requests go through `socks5h://` — DNS queries also route through Tor, preventing leaks.

---

## 📜 Transaction History

- Shows **20 transactions per page**
- Navigation:
  - `N` + Enter → Next 20 transactions
  - `P` + Enter → Previous 20 transactions
  - `B` + Enter → Back to main menu

---

## 🔒 Security

- Private keys and seed phrases **never leave your device**
- Everything stored locally at `~/.onionwallet/wallet.json`
- No telemetry, no analytics, no third-party accounts required
- Tor support prevents IP-based tracking
- User-Agent set to `onionwallet` (not browser fingerprint)

> ⚠️ **Always back up your seed phrase offline.** If you lose it and your device is wiped, your funds are unrecoverable.

---

## 🛠️ Dependencies

| Package | Purpose |
|---|---|
| `ethers` | EVM wallet and transactions |
| `bitcoinjs-lib` | BTC / LTC signing |
| `bip39` / `bip32` | Seed phrase and HD key derivation |
| `tweetnacl` + `ed25519-hd-key` | Solana keypair |
| `bs58check` | Tron address encoding |
| `inquirer` | Interactive terminal UI |
| `chalk` | Terminal colors |
| `ora` | Spinners |
| `qrcode` | Terminal QR code |
| `socks-proxy-agent` | Tor SOCKS5 proxy |

---

## 📁 Project Structure

```
onion-wallet/
├── index.js              # Entry point
└── src/
    ├── menus.js          # All interactive menus
    ├── wallet.js         # EVM wallet logic
    ├── btc-wallet.js     # BTC / LTC logic
    ├── sol-wallet.js     # Solana logic
    ├── trx-wallet.js     # Tron logic
    ├── networks.js       # Chain configs and RPC URLs
    ├── storage.js        # Local wallet file I/O
    ├── settings.js       # Settings (Tor toggle etc.)
    ├── tor.js            # Tor proxy setup
    └── ui.js             # Print helpers, banners
```

---

## 📄 License

ISC © 2026