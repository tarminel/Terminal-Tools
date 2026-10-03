

import { ethers } from "ethers";
import { SocksProxyAgent } from "socks-proxy-agent";
import http from "http";
import https from "https";

let savedDirectGetUrl = null; 

function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function rawRequest(url, method, headers, body, agent) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch (e) {
      reject(e);
      return;
    }
    const lib = target.protocol === "https:" ? https : http;
    const req = lib.request(target, { method: method || "GET", headers, agent }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function makeTorGetUrlFunc(port) {
  const agent = new SocksProxyAgent(`socks5h://127.0.0.1:${port}`);
  return async (req ) => {
    const bodyBuf = req.body ? Buffer.from(req.body) : undefined;
    return rawRequest(req.url, req.method, req.headers, bodyBuf, agent);
  };
}

export function enableTor(port) {
  if (!savedDirectGetUrl) {
    savedDirectGetUrl = ethers.FetchRequest.createGetUrlFunc();
  }
  ethers.FetchRequest.registerGetUrl(makeTorGetUrlFunc(port));
}

export function disableTor() {
  if (savedDirectGetUrl) {
    ethers.FetchRequest.registerGetUrl(savedDirectGetUrl);
  }
}

export async function checkTorConnection(port) {
  const getUrl = makeTorGetUrlFunc(port);
  const res = await withTimeout(
    getUrl({
      url: "https://check.torproject.org/api/ip",
      method: "GET",
      headers: { "User-Agent": "meshwallet" },
    }),
    8000
  );
  const json = JSON.parse(Buffer.from(res.body).toString("utf8"));
  return json; 
}
