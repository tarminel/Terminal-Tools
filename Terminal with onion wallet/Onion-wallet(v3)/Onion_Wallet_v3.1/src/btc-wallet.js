

import * as bip39 from "bip39";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { BIP32Factory } from "bip32";
import fetch from "node-fetch";

const bip32 = BIP32Factory(ecc);

export const UTXO_NETWORKS = {
  bitcoin: {
    name: "Bitcoin",
    symbol: "BTC",
    network: bitcoin.networks.bitcoin,
    coinType: 0,        
    blockchair: "bitcoin",
    apiBase: "https://api.blockchair.com/bitcoin",
    fallbackApi: "https://blockstream.info/api",
    explorer: "https://blockchair.com/bitcoin/transaction",
    decimals: 8,        
    unit: "BTC",
    satFactor: 1e8,
  },
  litecoin: {
    name: "Litecoin",
    symbol: "LTC",
    network: {
      ...bitcoin.networks.bitcoin,
      messagePrefix: "\x19Litecoin Signed Message:\n",
      bech32: "ltc",
      bip32: { public: 0x019da462, private: 0x019d9cfe },
      pubKeyHash: 0x30,
      scriptHash: 0x32,
      wif: 0xb0,
    },
    coinType: 2,
    blockchair: "litecoin",
    apiBase: "https://api.blockchair.com/litecoin",
    fallbackApi: null,
    explorer: "https://blockchair.com/litecoin/transaction",
    decimals: 8,
    unit: "LTC",
    satFactor: 1e8,
  },
};

export function deriveUTXOAddress(mnemonic, coinKey, index = 0) {
  const net = UTXO_NETWORKS[coinKey];
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, net.network);
  
  const child = root.derivePath(`m/44'/${net.coinType}'/0'/0/${index}`);
  const { address } = bitcoin.payments.p2pkh({
    pubkey: Buffer.from(child.publicKey),
    network: net.network,
  });
  return {
    address,
    privateKey: child.toWIF(),
    publicKey: child.publicKey.toString("hex"),
    index,
  };
}

export async function getUTXOBalance(address, coinKey) {
  const net = UTXO_NETWORKS[coinKey];

try {
    const res = await fetch(
      `${net.apiBase}/dashboards/address/${address}?limit=0`,
      { headers: { "User-Agent": "meshwallet" }, timeout: 10000 }
    );
    if (res.ok) {
      const data = await res.json();
      const sat = data?.data?.[address]?.address?.balance ?? 0;
      return (sat / net.satFactor).toFixed(8);
    }
  } catch (_) {}

if (net.fallbackApi) {
    const res = await fetch(`${net.fallbackApi}/address/${address}`, {
      headers: { "User-Agent": "meshwallet" }, timeout: 10000,
    });
    if (!res.ok) throw new Error(`Blockstream API error ${res.status}`);
    const data = await res.json();
    const sat =
      (data.chain_stats?.funded_txo_sum ?? 0) -
      (data.chain_stats?.spent_txo_sum ?? 0);
    return (sat / net.satFactor).toFixed(8);
  }

  throw new Error(`Could not reach any ${net.name} API`);
}

async function getUTXOs(address, coinKey) {
  const net = UTXO_NETWORKS[coinKey];

  if (net.fallbackApi) {
    
    const res = await fetch(`${net.fallbackApi}/address/${address}/utxo`, {
      headers: { "User-Agent": "meshwallet" },
    });
    if (!res.ok) throw new Error(`UTXO fetch failed: ${res.status}`);
    const utxos = await res.json();
    return utxos.map((u) => ({
      txid: u.txid,
      vout: u.vout,
      value: u.value, 
    }));
  }

const res = await fetch(
    `${net.apiBase}/outputs?q=recipient(${address}),is_spent(false)`,
    { headers: { "User-Agent": "meshwallet" } }
  );
  if (!res.ok) throw new Error(`UTXO fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((o) => ({
    txid: o.transaction_hash,
    vout: o.index,
    value: o.value,
  }));
}

async function fetchRawTx(txid, coinKey) {
  const net = UTXO_NETWORKS[coinKey];
  if (net.fallbackApi) {
    const res = await fetch(`${net.fallbackApi}/tx/${txid}/hex`);
    if (!res.ok) throw new Error(`Raw tx fetch failed: ${res.status}`);
    return res.text();
  }
  const res = await fetch(`${net.apiBase}/raw/transaction/${txid}`, {
    headers: { "User-Agent": "meshwallet" },
  });
  if (!res.ok) throw new Error(`Raw tx fetch failed: ${res.status}`);
  const j = await res.json();
  return j.data?.[txid]?.raw_transaction;
}

async function getFeeRate(coinKey) {
  const net = UTXO_NETWORKS[coinKey];
  try {
    if (net.fallbackApi) {
      
      const res = await fetch(`${net.fallbackApi}/fee-estimates`);
      const data = await res.json();
      return Math.ceil(data["6"] || 10); 
    }
    
    const res = await fetch(`${net.apiBase}/stats`, {
      headers: { "User-Agent": "meshwallet" },
    });
    const data = await res.json();
    return Math.ceil(data?.data?.suggested_transaction_fee_per_byte_sat || 10);
  } catch {
    return 10; 
  }
}

async function broadcastTx(txHex, coinKey) {
  const net = UTXO_NETWORKS[coinKey];

  if (net.fallbackApi) {
    
    const res = await fetch(`${net.fallbackApi}/tx`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "User-Agent": "meshwallet" },
      body: txHex,
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Broadcast failed: ${msg}`);
    }
    return res.text(); 
  }

const form = new URLSearchParams({ data: txHex });
  const res = await fetch(`${net.apiBase}/push/transaction`, {
    method: "POST",
    headers: { "User-Agent": "meshwallet" },
    body: form,
  });
  if (!res.ok) throw new Error(`Broadcast failed: ${res.status}`);
  const data = await res.json();
  return data?.data?.transaction_hash || "broadcast ok";
}

export async function sendUTXO(wif, toAddress, amountBTC, coinKey) {
  const net = UTXO_NETWORKS[coinKey];
  bitcoin.initEccLib(ecc);

const keyPair = bitcoin.ECPair.fromWIF(wif, net.network);
  const { address: fromAddress } = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey,
    network: net.network,
  });

const utxos = await getUTXOs(fromAddress, coinKey);
  if (!utxos.length) throw new Error("No spendable UTXOs found");

  const satTarget = Math.round(amountBTC * net.satFactor);
  const feeRate = await getFeeRate(coinKey);
  const estimatedFee = feeRate * 250; 

let totalIn = 0;
  const selected = [];
  for (const utxo of utxos) {
    selected.push(utxo);
    totalIn += utxo.value;
    if (totalIn >= satTarget + estimatedFee) break;
  }
  if (totalIn < satTarget + estimatedFee) {
    throw new Error(
      `Insufficient balance. Need ${((satTarget + estimatedFee) / net.satFactor).toFixed(8)} ${net.symbol}, have ${(totalIn / net.satFactor).toFixed(8)}`
    );
  }

const psbt = new bitcoin.Psbt({ network: net.network });

  for (const utxo of selected) {
    const rawHex = await fetchRawTx(utxo.txid, coinKey);
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      nonWitnessUtxo: Buffer.from(rawHex, "hex"),
    });
  }

psbt.addOutput({ address: toAddress, value: satTarget });

const change = totalIn - satTarget - estimatedFee;
  if (change > 546) { 
    psbt.addOutput({ address: fromAddress, value: change });
  }

selected.forEach((_, i) => psbt.signInput(i, keyPair));
  psbt.finalizeAllInputs();

  const txHex = psbt.extractTransaction().toHex();
  const txid = await broadcastTx(txHex, coinKey);
  return { txid, fee: estimatedFee / net.satFactor, explorer: `${net.explorer}/${txid}` };
}
