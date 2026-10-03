

import { ethers } from "ethers";
import * as bip39 from "bip39";
import { NETWORKS } from "./networks.js";
import { saveWallet, loadWallet } from "./storage.js";

function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function makeProvider(url, net) {
  return new ethers.JsonRpcProvider(
    url,
    net.chainId,
    { staticNetwork: ethers.Network.from(net.chainId), polling: false }
  );
}

export async function getProvider(networkKey) {
  const net = NETWORKS[networkKey];
  if (!net) throw new Error(`Unknown network: ${networkKey}`);
  const urls = [net.rpc, ...(net.rpcFallbacks || [])];

  const attempts = urls.map(async (url) => {
    const provider = makeProvider(url, net);
    try {
      await withTimeout(provider.getBlockNumber(), 7000);
      return provider;
    } catch (e) {
      provider.destroy();
      throw e;
    }
  });

  try {
    return await Promise.any(attempts);
  } catch (aggregateErr) {
    const reasons = (aggregateErr.errors || [])
      .map((e) => e?.message || String(e))
      .join("; ");
    throw new Error(`All RPC endpoints failed for ${net.name}: ${reasons || "unknown error"}`);
  }
}

function deriveWallet(mnemonic, index = 0) {
  return ethers.HDNodeWallet.fromPhrase(
    mnemonic,
    undefined,
    `m/44'/60'/0'/0/${index}`
  );
}

export async function createWallet() {
  const mnemonic = bip39.generateMnemonic(128); 
  const hd = deriveWallet(mnemonic, 0);
  const data = {
    createdAt: new Date().toISOString(),
    mnemonic,
    address: hd.address,
    privateKey: hd.privateKey,
    accounts: [{
      index: 0,
      address: hd.address,
      privateKey: hd.privateKey,
      label: "Account 1",
    }],
    
    btcAddresses: {},
    solAddresses: {},
    trxAddresses: {},
  };
  await saveWallet(data);
  return data;
}

export async function importFromMnemonic(mnemonic) {
  const clean = mnemonic.trim();
  if (!bip39.validateMnemonic(clean)) throw new Error("Invalid mnemonic phrase!");
  const hd = deriveWallet(clean, 0);
  const data = {
    createdAt: new Date().toISOString(),
    importedAt: new Date().toISOString(),
    mnemonic: clean,
    address: hd.address,
    privateKey: hd.privateKey,
    accounts: [{
      index: 0,
      address: hd.address,
      privateKey: hd.privateKey,
      label: "Account 1",
    }],
    btcAddresses: {},
    solAddresses: {},
    trxAddresses: {},
  };
  await saveWallet(data);
  return data;
}

export async function importFromPrivateKey(pk) {
  try {
    const w = new ethers.Wallet(pk.trim());
    const data = {
      createdAt: new Date().toISOString(),
      importedAt: new Date().toISOString(),
      mnemonic: null,
      address: w.address,
      privateKey: w.privateKey,
      accounts: [{
        index: 0,
        address: w.address,
        privateKey: w.privateKey,
        label: "Account 1 (imported)",
      }],
      btcAddresses: {},
      solAddresses: {},
      trxAddresses: {},
    };
    await saveWallet(data);
    return data;
  } catch {
    throw new Error("Invalid private key!");
  }
}

export async function addAccount(label) {
  const data = await loadWallet();
  if (!data?.mnemonic) throw new Error("Need a mnemonic wallet to derive accounts.");
  const idx = data.accounts.length;
  const hd = deriveWallet(data.mnemonic, idx);
  data.accounts.push({
    index: idx,
    address: hd.address,
    privateKey: hd.privateKey,
    label: label || `Account ${idx + 1}`,
  });
  await saveWallet(data);
  return data.accounts[idx];
}

export async function getBalance(address, networkKey) {
  const provider = await getProvider(networkKey);
  const raw = await provider.getBalance(address);
  return ethers.formatEther(raw);
}

export async function sendCoin(fromPrivateKey, toAddress, amount, networkKey) {
  const provider = await getProvider(networkKey);
  const signer = new ethers.Wallet(fromPrivateKey, provider);
  if (!ethers.isAddress(toAddress)) throw new Error("Invalid recipient address");
  const value = ethers.parseEther(String(amount));
  const balance = await provider.getBalance(signer.address);
  if (balance < value) throw new Error("Insufficient balance");
  return signer.sendTransaction({ to: toAddress, value });
}

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export async function getTokenBalance(address, tokenAddress, networkKey) {
  const provider = await getProvider(networkKey);
  const c = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [raw, decimals, symbol, name] = await Promise.all([
    c.balanceOf(address),
    c.decimals(),
    c.symbol(),
    c.name(),
  ]);
  return { name, symbol, balance: ethers.formatUnits(raw, decimals), decimals, tokenAddress };
}

export async function sendToken(fromPrivateKey, tokenAddress, toAddress, amount, networkKey) {
  const provider = await getProvider(networkKey);
  const signer = new ethers.Wallet(fromPrivateKey, provider);
  const c = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const decimals = await c.decimals();
  const value = ethers.parseUnits(String(amount), decimals);
  return c.transfer(toAddress, value);
}
