

export const NETWORKS = {
  ethereum: {
    name: "Ethereum",
    symbol: "ETH",
    chainId: 1,
    rpc: "https://cloudflare-eth.com",
    rpcFallbacks: [
      "https://rpc.ankr.com/eth",
      "https://ethereum.publicnode.com",
      "https://ethereum-rpc.publicnode.com",
      "https://1rpc.io/eth",
    ],
    explorer: "https://etherscan.io",
    decimals: 18,
  },
  polygon: {
    name: "Polygon",
    symbol: "POL",
    chainId: 137,
    rpc: "https://polygon.llamarpc.com",
    rpcFallbacks: [
      "https://rpc.ankr.com/polygon",
      "https://polygon.publicnode.com",
      "https://polygon-bor-rpc.publicnode.com",
      "https://1rpc.io/matic",
    ],
    explorer: "https://polygonscan.com",
    decimals: 18,
  },
  celo: {
    name: "CELO",
    symbol: "CELO",
    chainId: 42220,
    rpc: "https://forno.celo.org",
    rpcFallbacks: [
      "https://rpc.ankr.com/celo",
      "https://celo.publicnode.com",
      "https://celo.drpc.org",
    ],
    explorer: "https://celoscan.io",
    decimals: 18,
  },
  hyperliquid: {
    name: "Hyperliquid",
    symbol: "HYPE",
    chainId: 998,
    rpc: "https://rpc.hyperliquid.xyz/evm",
    rpcFallbacks: [],
    explorer: "https://explorer.hyperliquid.xyz",
    decimals: 18,
  },
  bsc: {
    name: "BNB Smart Chain",
    symbol: "BNB",
    chainId: 56,
    rpc: "https://bsc-dataseed1.binance.org",
    rpcFallbacks: [
      "https://bsc-dataseed2.binance.org",
      "https://rpc.ankr.com/bsc",
      "https://bsc.publicnode.com",
      "https://bsc-rpc.publicnode.com",
      "https://1rpc.io/bnb",
    ],
    explorer: "https://bscscan.com",
    decimals: 18,
  },
  arbitrum: {
    name: "Arbitrum One",
    symbol: "ETH",
    chainId: 42161,
    rpc: "https://arb1.arbitrum.io/rpc",
    rpcFallbacks: [
      "https://rpc.ankr.com/arbitrum",
      "https://arbitrum.publicnode.com",
      "https://arbitrum-one-rpc.publicnode.com",
      "https://1rpc.io/arb",
    ],
    explorer: "https://arbiscan.io",
    decimals: 18,
  },
  optimism: {
    name: "Optimism",
    symbol: "ETH",
    chainId: 10,
    rpc: "https://mainnet.optimism.io",
    rpcFallbacks: [
      "https://rpc.ankr.com/optimism",
      "https://optimism.publicnode.com",
      "https://optimism-rpc.publicnode.com",
      "https://1rpc.io/op",
    ],
    explorer: "https://optimistic.etherscan.io",
    decimals: 18,
  },
  base: {
    name: "Base",
    symbol: "ETH",
    chainId: 8453,
    rpc: "https://mainnet.base.org",
    rpcFallbacks: [
      "https://rpc.ankr.com/base",
      "https://base.publicnode.com",
      "https://base-rpc.publicnode.com",
      "https://1rpc.io/base",
    ],
    explorer: "https://basescan.org",
    decimals: 18,
  },
  avalanche: {
    name: "Avalanche C-Chain",
    symbol: "AVAX",
    chainId: 43114,
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    rpcFallbacks: [
      "https://rpc.ankr.com/avalanche",
      "https://avalanche.publicnode.com",
      "https://avalanche-c-chain-rpc.publicnode.com",
      "https://1rpc.io/avax/c",
    ],
    explorer: "https://snowtrace.io",
    decimals: 18,
  },
  fantom: {
    name: "Fantom",
    symbol: "FTM",
    chainId: 250,
    rpc: "https://rpc.ankr.com/fantom",
    rpcFallbacks: [
      "https://fantom.publicnode.com",
      "https://fantom-rpc.publicnode.com",
      "https://fantom.drpc.org",
      "https://1rpc.io/ftm",
    ],
    explorer: "https://ftmscan.com",
    decimals: 18,
  },
};

export const NETWORK_KEYS = Object.keys(NETWORKS);

export const NON_EVM_CHAINS = {
  bitcoin:  { name: "Bitcoin",  symbol: "BTC", type: "utxo",   module: "btc-wallet" },
  litecoin: { name: "Litecoin", symbol: "LTC", type: "utxo",   module: "btc-wallet" },
  solana:   { name: "Solana",   symbol: "SOL", type: "solana", module: "sol-wallet" },
  tron:     { name: "Tron",     symbol: "TRX", type: "tron",   module: "trx-wallet" },
};

export const NON_EVM_KEYS = Object.keys(NON_EVM_CHAINS);
