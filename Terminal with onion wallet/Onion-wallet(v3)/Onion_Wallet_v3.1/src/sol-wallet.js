

import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import nacl from "tweetnacl";
import fetch from "node-fetch";
import bs58 from "bs58";

const SOL_RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
];

const LAMPORTS_PER_SOL = 1_000_000_000;

export function deriveSolanaKeypair(mnemonic, index = 0) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const path = `m/44'/501'/${index}'/0'`;
  const { key } = derivePath(path, seed.toString("hex"));
  const keypair = nacl.sign.keyPair.fromSeed(key);
  const publicKey = bs58.encode(Buffer.from(keypair.publicKey));
  const secretKey = bs58.encode(Buffer.from(keypair.secretKey));
  return { address: publicKey, secretKey, index };
}

async function solRpc(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  for (const url of SOL_RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "meshwallet" },
        body,
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (e) {
      
    }
  }
  throw new Error("All Solana RPC endpoints failed");
}

export async function getSolanaBalance(address) {
  const result = await solRpc("getBalance", [address, { commitment: "finalized" }]);
  const lamports = result?.value ?? result ?? 0;
  return (lamports / LAMPORTS_PER_SOL).toFixed(9);
}

export async function sendSolana(secretKeyB58, toAddress, amountSOL) {
  
  const secretKey = bs58.decode(secretKeyB58);
  const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
  const fromAddress = bs58.encode(Buffer.from(keypair.publicKey));

  const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);

const { value: { blockhash, lastValidBlockHeight } } = await solRpc(
    "getLatestBlockhash", [{ commitment: "finalized" }]
  );

const fromPubkey = keypair.publicKey;
  const toPubkey = bs58.decode(toAddress);
  const systemProgram = new Uint8Array(32); 

const blockhashBytes = bs58.decode(blockhash);

const accountKeys = [fromPubkey, toPubkey, systemProgram];

const instrData = Buffer.alloc(12);
  instrData.writeUInt32LE(2, 0); 
  instrData.writeBigUInt64LE(BigInt(lamports), 4);

const instruction = Buffer.concat([
    Buffer.from([2]),          
    Buffer.from([2]),          
    Buffer.from([0, 1]),       
    Buffer.from([instrData.length]),
    instrData,
  ]);

const header = Buffer.from([1, 0, 1]);

function compactArray(arr) {
    const len = Buffer.alloc(1);
    len[0] = arr.length;
    return Buffer.concat([len, ...arr.map((a) => Buffer.from(a))]);
  }

  const message = Buffer.concat([
    header,
    compactArray(accountKeys),
    blockhashBytes,
    Buffer.from([1]),   
    instruction,
  ]);

const signature = nacl.sign.detached(message, secretKey);

const tx = Buffer.concat([
    Buffer.from([1]),
    Buffer.from(signature),
    message,
  ]);

  const encoded = tx.toString("base64");
  const result = await solRpc("sendTransaction", [
    encoded,
    { encoding: "base64", preflightCommitment: "finalized" },
  ]);

  return {
    txid: result,
    explorer: `https://solscan.io/tx/${result}`,
  };
}
