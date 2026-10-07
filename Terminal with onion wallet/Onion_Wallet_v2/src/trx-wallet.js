

import * as bip39 from "bip39";
import { hdkey } from "@ethereumjs/wallet";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import bs58check from "bs58check";
import fetch from "node-fetch";

const TRON_GRID_URLS = [
  "https://api.trongrid.io",
  "https://api.shasta.trongrid.io", 
];
const MAIN_URL = "https://api.trongrid.io";

const SUN_PER_TRX = 1_000_000;

export function deriveTronAddress(mnemonic, index = 0) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = hdkey.fromMasterSeed(seed);
  const child = root.derivePath(`m/44'/195'/0'/0/${index}`);
  const privateKey = child.getWallet().getPrivateKeyString(); 
  const publicKey = child.getWallet().getPublicKey();

const pubkeyBytes = Buffer.from(publicKey);
  const hash = Buffer.from(keccak256(pubkeyBytes));
  const tronBytes = Buffer.concat([Buffer.from([0x41]), hash.slice(12)]);
  const address = bs58check.encode(tronBytes);

  return { address, privateKey, index };
}

async function tronPost(path, body) {
  const res = await fetch(`${MAIN_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "onionwallet",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Tron API error ${res.status}: ${path}`);
  return res.json();
}

async function tronGet(path) {
  const res = await fetch(`${MAIN_URL}${path}`, {
    headers: { "User-Agent": "onionwallet" },
  });
  if (!res.ok) throw new Error(`Tron API error ${res.status}`);
  return res.json();
}

export async function getTronBalance(address) {
  const data = await tronGet(`/v1/accounts/${address}`);
  const sun = data?.data?.[0]?.balance ?? 0;
  return (sun / SUN_PER_TRX).toFixed(6);
}

export async function getTronTransactions(address, page = 1, pageSize = 20) {
  const minTimestamp = 0;
  const url = `${MAIN_URL}/v1/accounts/${address}/transactions` +
    `?limit=${pageSize}&min_timestamp=${minTimestamp}&order_by=block_timestamp,desc`;

  const res = await fetch(url, { headers: { "User-Agent": "onionwallet" } });
  if (!res.ok) throw new Error(`Tron API error: ${res.status}`);
  const data = await res.json();

  const txs = data?.data || [];
  return txs.map((tx) => {
    const raw = tx.raw_data?.contract?.[0]?.parameter?.value || {};
    const amountSun = raw.amount || 0;
    return {
      hash:      tx.txID,
      from:      raw.owner_address || "unknown",
      to:        raw.to_address || "unknown",
      value:     (amountSun / SUN_PER_TRX).toFixed(6),
      symbol:    "TRX",
      timestamp: tx.block_timestamp
        ? new Date(tx.block_timestamp).toLocaleString()
        : "unknown",
      status:    tx.ret?.[0]?.contractRet === "SUCCESS" ? "success" : "failed",
    };
  });
}

export async function sendTron(privateKeyHex, toAddress, amountTRX) {
  const { ethers } = await import("ethers");
  const sun = Math.round(amountTRX * SUN_PER_TRX);

const unsigned = await tronPost("/wallet/createtransaction", {
    to_address: toAddress,
    owner_address: privateKeyToTronAddress(privateKeyHex),
    amount: sun,
  });

  if (unsigned.Error) throw new Error(unsigned.Error);

const txID = unsigned.txID;
  const rawData = unsigned.raw_data_hex;
  const signerWallet = new ethers.Wallet("0x" + privateKeyHex);
  const sig = signerWallet.signingKey.sign(Buffer.from(txID, "hex"));
  const signature = sig.r.slice(2) + sig.s.slice(2) + (sig.v === 27 ? "1b" : "1c");

const broadcast = await tronPost("/wallet/broadcasttransaction", {
    ...unsigned,
    signature: [signature],
  });

  if (!broadcast.result) throw new Error(broadcast.message || "Broadcast failed");

  return {
    txid: txID,
    explorer: `https://tronscan.org/#/transaction/${txID}`,
  };
}

function privateKeyToTronAddress(hexKey) {
  const { keccak256 } = require("ethereum-cryptography/keccak.js");

const { ethers } = require("ethers");
  const wallet = new ethers.Wallet("0x" + hexKey);
  const ethAddr = wallet.address.toLowerCase().slice(2);
  const tronBytes = Buffer.concat([
    Buffer.from([0x41]),
    Buffer.from(ethAddr, "hex"),
  ]);
  return bs58check.encode(tronBytes);
}
