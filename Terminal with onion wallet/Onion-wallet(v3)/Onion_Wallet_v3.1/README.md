# MeshWallet v2 — Multi-Chain CLI Wallet

Tor-routable, no-API-key, terminal-based crypto wallet.

## Supported Chains

### EVM Chains (ethers.js)
| Chain | Symbol | Notes |
|-------|--------|-------|
| Ethereum | ETH | |
| Polygon | POL | (ex-MATIC) |
| BNB Smart Chain | BNB | |
| Arbitrum One | ETH | L2 |
| Optimism | ETH | L2 |
| Base | ETH | L2 |
| Avalanche C-Chain | AVAX | |
| Fantom | FTM | |
| CELO | CELO | |
| Hyperliquid | HYPE | |

### Non-EVM Chains (v2 নতুন)
| Chain | Symbol | Library | API |
|-------|--------|---------|-----|
| Bitcoin | BTC | bitcoinjs-lib | Blockchair + Blockstream |
| Litecoin | LTC | bitcoinjs-lib | Blockchair |
| Solana | SOL | tweetnacl + ed25519-hd-key | Solana RPC |
| Tron | TRX | ethereumjs/wallet + bs58check | TronGrid |

## Install

```bash
npm install
node index.js
```

## Key Derivation Paths (BIP44)

| Chain | Path |
|-------|------|
| ETH / EVM | m/44'/60'/0'/0/N |
| BTC | m/44'/0'/0'/0/N |
| LTC | m/44'/2'/0'/0/N |
| SOL | m/44'/501'/N'/0' |
| TRX | m/44'/195'/0'/0/N |

**একটাই seed phrase → সব chain এর address automatically derive হয়।**

## Tor Support

```bash
# Tor daemon চালু করো
tor &
# তারপর MeshWallet এ Tor Toggle ON করো (port 9050)
```

## Security Notes
- Private keys / seed phrases locally `~/.meshwallet/wallet.json` এ save হয়
- কোনো remote server এ কিছু যায় না
- DNS leakও হয় না (socks5h:// protocol)
