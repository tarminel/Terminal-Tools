

import inquirer from "inquirer";
import ora from "ora";
import { ethers } from "ethers";
import qrcode from "qrcode";
import { NETWORKS, NETWORK_KEYS, NON_EVM_CHAINS, NON_EVM_KEYS } from "./networks.js";
import {
  createWallet, importFromMnemonic, importFromPrivateKey,
  getBalance, sendCoin, getTokenBalance, sendToken, addAccount,
  getEVMTransactions,
} from "./wallet.js";
import { loadWallet, saveWallet, deleteWallet, walletFilePath } from "./storage.js";
import { loadSettings, saveSettings } from "./settings.js";
import { enableTor, disableTor, checkTorConnection } from "./tor.js";
import {
  printBanner, printWalletInfo, printBalanceTable,
  printSeedPhrase, printTxResult, success, error, info, printSection,
} from "./ui.js";
import chalk from "chalk";

async function getBTCWallet()  { return import("./btc-wallet.js"); }
async function getSOLWallet()  { return import("./sol-wallet.js"); }
async function getTRXWallet()  { return import("./trx-wallet.js"); }

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

export async function firstRunSetup() {
  printBanner();
  console.log(chalk.yellow("  No wallet found. Let's get started!\n"));

  const { action } = await inquirer.prompt([{
    type: "select",
    name: "action",
    message: "What would you like to do?",
    choices: [
      { name: "🆕  Create a new wallet (generates seed phrase)", value: "create" },
      { name: "📥  Import from seed phrase (12 or 24 words)",    value: "mnemonic" },
      { name: "🔑  Import from private key (EVM only)",          value: "privatekey" },
      { name: "❌  Exit",                                        value: "exit" },
    ],
  }]);

  if (action === "exit") { console.log(chalk.gray("\n  Goodbye!\n")); process.exit(0); }

  if (action === "create") {
    const spinner = ora("Generating wallet...").start();
    const data = await createWallet();
    spinner.succeed("Wallet created!");
    printSeedPhrase(data.mnemonic);
    success(`Wallet saved to: ${walletFilePath()}`);
    info("Write down your seed phrase and store it safely offline.");
    info("One seed phrase → EVM (ETH/BNB/POL), BTC, LTC, SOL, TRX — all derived.");
    await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to continue..." }]);
    return data;
  }

  if (action === "mnemonic") {
    const { phrase } = await inquirer.prompt([{
      type: "input",
      name: "phrase",
      message: "Enter your 12/24-word seed phrase:",
      validate: (v) => v.trim().split(" ").length >= 12 ? true : "Need at least 12 words",
    }]);
    const spinner = ora("Importing...").start();
    try {
      const data = await importFromMnemonic(phrase);
      spinner.succeed("Wallet imported!");
      success(`EVM Address: ${data.address}`);
      return data;
    } catch (e) { spinner.fail(e.message); process.exit(1); }
  }

  if (action === "privatekey") {
    const { pk } = await inquirer.prompt([{
      type: "password",
      name: "pk",
      message: "Enter your private key (0x...):",
      mask: "*",
      validate: (v) => v.trim().length > 0 ? true : "Required",
    }]);
    const spinner = ora("Importing...").start();
    try {
      const data = await importFromPrivateKey(pk);
      spinner.succeed("Wallet imported! (EVM only — no BTC/SOL/TRX without seed phrase)");
      success(`Address: ${data.address}`);
      return data;
    } catch (e) { spinner.fail(e.message); process.exit(1); }
  }
}

async function selectAccount(walletData) {
  if (walletData.accounts.length === 1) return walletData.accounts[0];
  const { idx } = await inquirer.prompt([{
    type: "select",
    name: "idx",
    message: "Select account:",
    choices: walletData.accounts.map((a) => ({
      name: `${a.label}  (${a.address.slice(0, 10)}...)`,
      value: a.index,
    })),
  }]);
  return walletData.accounts[idx];
}

async function selectNetwork(message = "Select network:") {
  const { key } = await inquirer.prompt([{
    type: "select",
    name: "key",
    message,
    choices: NETWORK_KEYS.map((k) => ({
      name: `${NETWORKS[k].name}  (${NETWORKS[k].symbol})`,
      value: k,
    })),
  }]);
  return key;
}

async function selectNonEVMChain(message = "Select chain:") {
  const { key } = await inquirer.prompt([{
    type: "select",
    name: "key",
    message,
    choices: NON_EVM_KEYS.map((k) => ({
      name: `${NON_EVM_CHAINS[k].name}  (${NON_EVM_CHAINS[k].symbol})`,
      value: k,
    })),
  }]);
  return key;
}

async function getNonEVMAddress(walletData, chainKey) {
  const chain = NON_EVM_CHAINS[chainKey];
  if (!walletData.mnemonic) {
    throw new Error(`Need a seed phrase to derive ${chain.name} address.`);
  }

const cacheKey = `${chainKey}Addresses`;
  if (walletData[cacheKey]?.[0]) {
    return walletData[cacheKey][0];
  }

let derived;
  if (chain.type === "utxo") {
    const { deriveUTXOAddress } = await getBTCWallet();
    derived = deriveUTXOAddress(walletData.mnemonic, chainKey, 0);
  } else if (chain.type === "solana") {
    const { deriveSolanaKeypair } = await getSOLWallet();
    derived = deriveSolanaKeypair(walletData.mnemonic, 0);
  } else if (chain.type === "tron") {
    const { deriveTronAddress } = await getTRXWallet();
    derived = deriveTronAddress(walletData.mnemonic, 0);
  }

if (!walletData[cacheKey]) walletData[cacheKey] = {};
  walletData[cacheKey][0] = derived;
  await saveWallet(walletData);

  return derived;
}

async function menuNonEVMAddress(walletData) {
  const chainKey = await selectNonEVMChain("Show address for:");
  const chain = NON_EVM_CHAINS[chainKey];

  const spinner = ora(`Deriving ${chain.name} address...`).start();
  try {
    const derived = await getNonEVMAddress(walletData, chainKey);
    spinner.succeed("Done");
    printSection(`${chain.name} Address`);
    console.log(chalk.gray("  Address : ") + chalk.bold.green(derived.address));
    if (chain.type === "utxo") {
      console.log(chalk.gray("  WIF Key : ") + chalk.red("[hidden — needed to sign transactions]"));
    }
    console.log("");
    info(`This address is derived from your seed phrase (index 0, BIP44).`);
  } catch (e) {
    spinner.fail(e.message);
  }
  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return..." }]);
}

async function menuNonEVMBalance(walletData) {
  const chainKey = await selectNonEVMChain("Check balance for:");
  const chain = NON_EVM_CHAINS[chainKey];

  const spinner = ora(`Deriving ${chain.name} address...`).start();
  let derived;
  try {
    derived = await getNonEVMAddress(walletData, chainKey);
    spinner.text = `Fetching ${chain.name} balance...`;

    let balance;
    if (chain.type === "utxo") {
      const { getUTXOBalance } = await getBTCWallet();
      balance = await withTimeout(getUTXOBalance(derived.address, chainKey), 15000);
    } else if (chain.type === "solana") {
      const { getSolanaBalance } = await getSOLWallet();
      balance = await withTimeout(getSolanaBalance(derived.address), 15000);
    } else if (chain.type === "tron") {
      const { getTronBalance } = await getTRXWallet();
      balance = await withTimeout(getTronBalance(derived.address), 15000);
    }

    spinner.succeed("Done");
    printSection(`${chain.name} Balance`);
    console.log(chalk.gray("  Address : ") + chalk.white(derived.address));
    console.log(chalk.gray("  Balance : ") + chalk.bold.green(`${parseFloat(balance).toFixed(8)} ${chain.symbol}`));
    console.log("");
  } catch (e) {
    spinner.fail(e.message);
  }
  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return..." }]);
}

async function menuNonEVMSend(walletData) {
  const chainKey = await selectNonEVMChain("Send on which chain:");
  const chain = NON_EVM_CHAINS[chainKey];

  let derived;
  const spinner = ora(`Deriving ${chain.name} address...`).start();
  try {
    derived = await getNonEVMAddress(walletData, chainKey);
    spinner.succeed(`From: ${derived.address.slice(0, 16)}...`);
  } catch (e) {
    spinner.fail(e.message);
    await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter..." }]);
    return;
  }

  const { to, amount } = await inquirer.prompt([
    {
      type: "input",
      name: "to",
      message: `Recipient ${chain.symbol} address:`,
      validate: (v) => v.trim().length > 10 ? true : "Enter a valid address",
    },
    {
      type: "input",
      name: "amount",
      message: `Amount (${chain.symbol}):`,
      validate: (v) => (!isNaN(parseFloat(v)) && parseFloat(v) > 0) ? true : "Enter a positive number",
    },
  ]);

  const { confirm } = await inquirer.prompt([{
    type: "confirm",
    name: "confirm",
    message: chalk.yellow(`Send ${amount} ${chain.symbol} to ${to.slice(0, 16)}... on ${chain.name}?`),
    default: false,
  }]);

  if (!confirm) { info("Cancelled."); return; }

  const sendSpinner = ora("Broadcasting transaction...").start();
  try {
    let result;
    if (chain.type === "utxo") {
      const { sendUTXO } = await getBTCWallet();
      result = await sendUTXO(derived.privateKey, to.trim(), parseFloat(amount), chainKey);
    } else if (chain.type === "solana") {
      const { sendSolana } = await getSOLWallet();
      result = await sendSolana(derived.secretKey, to.trim(), parseFloat(amount));
    } else if (chain.type === "tron") {
      const { sendTron } = await getTRXWallet();
      result = await sendTron(derived.privateKey, to.trim(), parseFloat(amount));
    }

    sendSpinner.succeed("Transaction sent!");
    printSection("Transaction Sent");
    console.log(chalk.gray("  TxID    : ") + chalk.green(result.txid));
    if (result.explorer) {
      console.log(chalk.gray("  Explorer: ") + chalk.cyan(result.explorer));
    }
    if (result.fee) {
      console.log(chalk.gray("  Fee     : ") + chalk.yellow(`${result.fee} ${chain.symbol}`));
    }
    console.log("");
  } catch (e) {
    sendSpinner.fail(e.message);
  }
  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return..." }]);
}

async function printQR(address, label) {
  printSection(`${label} — QR Code`);
  console.log(chalk.gray("  Address : ") + chalk.bold.green(address));
  console.log("");
  try {
    const qr = await qrcode.toString(address, { type: "terminal", small: true });
    console.log(qr);
  } catch (e) {
    error(`QR generate failed: ${e.message}`);
  }
  console.log("");
}

async function menuQRCode(walletData) {
  const { chainType } = await inquirer.prompt([{
    type: "select",
    name: "chainType",
    message: "QR code for which chain?",
    choices: [
      { name: "🔷  EVM (ETH / BNB / POL...)", value: "evm" },
      { name: "₿   BTC / LTC / SOL / TRX",   value: "nonevem" },
    ],
  }]);

  if (chainType === "evm") {
    const account = await selectAccount(walletData);
    await printQR(account.address, `EVM — ${account.label}`);
  } else {
    const chainKey = await selectNonEVMChain("Show QR for:");
    const chain = NON_EVM_CHAINS[chainKey];
    const spinner = ora(`Deriving ${chain.name} address...`).start();
    try {
      const derived = await getNonEVMAddress(walletData, chainKey);
      spinner.succeed("Done");
      await printQR(derived.address, `${chain.name}`);
    } catch (e) {
      spinner.fail(e.message);
    }
  }

  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return..." }]);
}

function printTxTable(txs, page, symbol) {
  printSection(`Transactions — Page ${page}`);
  if (!txs.length) {
    console.log(chalk.gray("  No transactions found on this page.\n"));
    return;
  }
  const w = { hash: 14, dir: 4, value: 14, time: 22, status: 10 };
  const head =
    chalk.bold.white("  " + "TxHash".padEnd(w.hash)) +
    chalk.bold.white("  " + "Type".padEnd(w.dir)) +
    chalk.bold.white("  " + `Amount(${symbol})`.padEnd(w.value)) +
    chalk.bold.white("  " + "Time".padEnd(w.time)) +
    chalk.bold.white("  Status");
  console.log(head);
  console.log(chalk.gray("  " + "─".repeat(72)));

  for (const tx of txs) {
    const shortHash = (tx.hash || "").slice(0, 12) + "...";
    const dir = tx.direction || (tx.from ? "—" : "—");
    const dirColor = dir === "IN" ? chalk.green : dir === "OUT" ? chalk.red : chalk.gray;
    const statusColor = tx.status === "success" || tx.status === "confirmed"
      ? chalk.green : tx.status === "pending" ? chalk.yellow : chalk.red;

    console.log(
      "  " + chalk.cyan(shortHash.padEnd(w.hash)) +
      "  " + dirColor((dir).padEnd(w.dir)) +
      "  " + chalk.white((tx.value || "—").padEnd(w.value)) +
      "  " + chalk.gray((tx.timestamp || "—").padEnd(w.time)) +
      "  " + statusColor(tx.status || "—")
    );
  }
  console.log("");
  console.log(chalk.gray("  [N] Next page   [B] Back to menu"));
  console.log("");
}

async function paginatedTxLoop(fetchFn, symbol) {
  let page = 1;
  while (true) {
    const spinner = ora("Fetching transactions...").start();
    let txs = [];
    try {
      txs = await fetchFn(page);
      spinner.succeed(`Page ${page} loaded (${txs.length} txs)`);
    } catch (e) {
      spinner.fail(e.message);
      await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return..." }]);
      return;
    }

    printTxTable(txs, page, symbol);

    const { nav } = await inquirer.prompt([{
      type: "input",
      name: "nav",
      message: "Enter N (next), P (prev) or B (back):",
    }]);

    const key = nav.trim().toUpperCase();
    if (key === "N") {
      if (txs.length < 20) {
        info("No more transactions.");
      } else {
        page++;
      }
    } else if (key === "P") {
      if (page > 1) page--;
      else info("Already on page 1.");
    } else {
      return;
    }
  }
}

async function menuEVMTransactions(walletData) {
  const account = await selectAccount(walletData);
  const networkKey = await selectNetwork("Select network for transactions:");
  const net = NETWORKS[networkKey];

  if (!net.explorerApi) {
    error(`${net.name} does not have an explorer API configured.`);
    await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter..." }]);
    return;
  }

  await paginatedTxLoop(
    (page) => getEVMTransactions(account.address, networkKey, page, 20),
    net.symbol
  );
}

async function menuNonEVMTransactions(walletData) {
  const chainKey = await selectNonEVMChain("Transaction history for:");
  const chain = NON_EVM_CHAINS[chainKey];

  const spinner = ora(`Deriving ${chain.name} address...`).start();
  let derived;
  try {
    derived = await getNonEVMAddress(walletData, chainKey);
    spinner.succeed(`Address: ${derived.address.slice(0, 20)}...`);
  } catch (e) {
    spinner.fail(e.message);
    await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter..." }]);
    return;
  }

  if (chain.type === "utxo") {
    const { getUTXOTransactions } = await getBTCWallet();
    await paginatedTxLoop(
      (page) => getUTXOTransactions(derived.address, chainKey, page, 20),
      chain.symbol
    );
  } else if (chain.type === "solana") {
    const { getSolanaTransactions } = await getSOLWallet();
    await paginatedTxLoop(
      (page) => getSolanaTransactions(derived.address, page, 20),
      chain.symbol
    );
  } else if (chain.type === "tron") {
    const { getTronTransactions } = await getTRXWallet();
    await paginatedTxLoop(
      (page) => getTronTransactions(derived.address, page, 20),
      chain.symbol
    );
  }
}

async function menuCheckBalances(walletData) {
  const account = await selectAccount(walletData);
  const spinner = ora("Fetching balances across all EVM networks...").start();

  const results = await Promise.all(
    NETWORK_KEYS.map(async (key) => {
      try {
        const balance = await withTimeout(getBalance(account.address, key), 15000);
        return { network: NETWORKS[key].name, symbol: NETWORKS[key].symbol, balance };
      } catch (e) {
        return {
          network: NETWORKS[key].name,
          symbol: NETWORKS[key].symbol,
          balance: "0.0",
          error: true,
          reason: e.message === "timeout" ? "timeout" : "rpc error",
        };
      }
    })
  );

  spinner.succeed("Done");
  printBalanceTable(results);
  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return to menu..." }]);
}

async function menuBalanceSingle(walletData) {
  const account = await selectAccount(walletData);
  const networkKey = await selectNetwork();
  const spinner = ora(`Fetching ${NETWORKS[networkKey].name} balance...`).start();
  try {
    const bal = await withTimeout(getBalance(account.address, networkKey), 15000);
    spinner.succeed("Done");
    printSection(`${NETWORKS[networkKey].name} Balance`);
    console.log(chalk.gray("  Address : ") + chalk.white(account.address));
    console.log(chalk.gray("  Balance : ") + chalk.bold.green(`${parseFloat(bal).toFixed(8)} ${NETWORKS[networkKey].symbol}`));
    console.log("");
  } catch (e) {
    spinner.fail(e.message);
  }
  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return to menu..." }]);
}

async function menuSendCoin(walletData) {
  const account = await selectAccount(walletData);
  const networkKey = await selectNetwork("Select network to send on:");

  const { to, amount } = await inquirer.prompt([
    {
      type: "input",
      name: "to",
      message: "Recipient address (0x...):",
      validate: (v) => ethers.isAddress(v.trim()) ? true : "Invalid address",
    },
    {
      type: "input",
      name: "amount",
      message: `Amount (${NETWORKS[networkKey].symbol}):`,
      validate: (v) => (!isNaN(parseFloat(v)) && parseFloat(v) > 0) ? true : "Enter a positive number",
    },
  ]);

  const { confirm } = await inquirer.prompt([{
    type: "confirm",
    name: "confirm",
    message: chalk.yellow(`Send ${amount} ${NETWORKS[networkKey].symbol} to ${to.slice(0, 12)}... on ${NETWORKS[networkKey].name}?`),
    default: false,
  }]);

  if (!confirm) { info("Cancelled."); return; }

  const spinner = ora("Broadcasting transaction...").start();
  try {
    const tx = await sendCoin(account.privateKey, to, amount, networkKey);
    spinner.succeed("Transaction sent!");
    printTxResult(tx, networkKey, NETWORKS);
    const ws = ora("Waiting for confirmation...").start();
    const receipt = await tx.wait(1);
    ws.succeed(`Confirmed in block ${receipt.blockNumber}`);
  } catch (e) {
    spinner.fail(e.message);
  }
  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return to menu..." }]);
}

async function menuTokenBalance(walletData) {
  const account = await selectAccount(walletData);
  const networkKey = await selectNetwork();
  const { tokenAddr } = await inquirer.prompt([{
    type: "input",
    name: "tokenAddr",
    message: "Token contract address:",
    validate: (v) => ethers.isAddress(v.trim()) ? true : "Invalid address",
  }]);
  const spinner = ora("Fetching token balance...").start();
  try {
    const token = await withTimeout(getTokenBalance(account.address, tokenAddr.trim(), networkKey), 15000);
    spinner.succeed("Done");
    printSection("Token Balance");
    console.log(chalk.gray("  Token   : ") + chalk.white(`${token.name} (${token.symbol})`));
    console.log(chalk.gray("  Balance : ") + chalk.bold.green(`${token.balance} ${token.symbol}`));
    console.log(chalk.gray("  Wallet  : ") + chalk.white(account.address));
    console.log("");
  } catch (e) {
    spinner.fail(e.message);
  }
  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return to menu..." }]);
}

async function menuSendToken(walletData) {
  const account = await selectAccount(walletData);
  const networkKey = await selectNetwork();

  const { tokenAddr, to, amount } = await inquirer.prompt([
    { type: "input", name: "tokenAddr", message: "Token contract address:", validate: (v) => ethers.isAddress(v.trim()) ? true : "Invalid address" },
    { type: "input", name: "to",        message: "Recipient address:",       validate: (v) => ethers.isAddress(v.trim()) ? true : "Invalid address" },
    { type: "input", name: "amount",    message: "Amount:", validate: (v) => (!isNaN(parseFloat(v)) && parseFloat(v) > 0) ? true : "Positive number" },
  ]);

  const { confirm } = await inquirer.prompt([{
    type: "confirm",
    name: "confirm",
    message: chalk.yellow(`Send ${amount} tokens to ${to.slice(0, 12)}...?`),
    default: false,
  }]);

  if (!confirm) { info("Cancelled."); return; }

  const spinner = ora("Broadcasting...").start();
  try {
    const tx = await sendToken(account.privateKey, tokenAddr.trim(), to.trim(), amount, networkKey);
    spinner.succeed("Token transfer sent!");
    printTxResult(tx, networkKey, NETWORKS);
  } catch (e) {
    spinner.fail(e.message);
  }
  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return to menu..." }]);
}

async function menuShowSeed(walletData) {
  if (!walletData.mnemonic) {
    error("This wallet was imported with a private key — no seed phrase stored.");
    await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter..." }]);
    return;
  }
  const { confirm } = await inquirer.prompt([{
    type: "confirm",
    name: "confirm",
    message: chalk.red("Are you sure? Never show this on screen in public!"),
    default: false,
  }]);
  if (confirm) {
    printSeedPhrase(walletData.mnemonic);
    await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to hide and return..." }]);
  }
}

async function menuAddAccount(walletData) {
  const { label } = await inquirer.prompt([{
    type: "input",
    name: "label",
    message: "Label for new account:",
    default: `Account ${walletData.accounts.length + 1}`,
  }]);
  const spinner = ora("Deriving account...").start();
  try {
    const acc = await addAccount(label);
    spinner.succeed("Account added!");
    success(`${acc.label}: ${acc.address}`);
  } catch (e) {
    spinner.fail(e.message);
  }
  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return..." }]);
}

async function menuWipeWallet() {
  const { confirm1 } = await inquirer.prompt([{
    type: "input",
    name: "confirm1",
    message: chalk.red('Type "DELETE" to wipe your wallet from this device:'),
  }]);
  if (confirm1 !== "DELETE") { info("Cancelled."); return; }
  await deleteWallet();
  success("Wallet wiped from local storage.");
  info("Your funds are still safe — restore with your seed phrase anytime.");
  process.exit(0);
}

async function menuToggleTor(settings) {
  const turningOn = !settings.torEnabled;

  if (!turningOn) {
    disableTor();
    await saveSettings({ torEnabled: false });
    success("Tor tunnel turned OFF. Traffic now goes out directly again.");
    await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return..." }]);
    return;
  }

  const { port } = await inquirer.prompt([{
    type: "input",
    name: "port",
    message: "Tor SOCKS5 port (9050 = tor daemon, 9150 = Tor Browser):",
    default: String(settings.torPort || 9050),
    validate: (v) => (/^\d+$/.test(v) ? true : "Enter a port number"),
  }]);
  const torPort = parseInt(port, 10);

  enableTor(torPort);

  const spinner = ora("Checking Tor connection...").start();
  try {
    const result = await checkTorConnection(torPort);
    if (result.IsTor) {
      spinner.succeed(`Tor tunnel turned ON — exiting via ${result.IP}`);
      await saveSettings({ torEnabled: true, torPort });
    } else {
      spinner.warn("Connected, but check.torproject.org says this isn't a Tor exit — proxy may be misconfigured.");
      await saveSettings({ torEnabled: true, torPort });
    }
  } catch (e) {
    spinner.fail(`Couldn't reach Tor on 127.0.0.1:${torPort} (${e.message}).`);
    info("Make sure Tor is running on that port, then try again.");
    disableTor();
  }

  await inquirer.prompt([{ type: "input", name: "_", message: "Press Enter to return..." }]);
}

export async function mainMenu() {
  const walletData = await loadWallet();
  const settings = await loadSettings();

  printBanner();
  printWalletInfo(walletData);

  const torLabel = settings.torEnabled
    ? "🧅  Tor tunnel: ON  (turn off)"
    : "🧅  Turn on Tor tunnel";

  const { choice } = await inquirer.prompt([{
    type: "select",
    name: "choice",
    message: "What do you want to do?",
    choices: [
      new inquirer.Separator(chalk.bold.white("  ── EVM Chains (ETH/BNB/POL/AVAX...) ──")),
      { name: "💰  Check all balances (all EVM networks)",      value: "balances_all" },
      { name: "📊  Check balance on one EVM network",           value: "balance_one" },
      { name: "📤  Send native coin (ETH / POL / BNB...)",     value: "send" },
      { name: "🪙  Check ERC-20 token balance",                 value: "token_balance" },
      { name: "📨  Send ERC-20 token",                         value: "send_token" },
      new inquirer.Separator(chalk.bold.white("  ── Non-EVM Chains (BTC/LTC/SOL/TRX) ──")),
      { name: "₿   Show BTC / LTC / SOL / TRX address",        value: "nonevmaddr" },
      { name: "📊  Check BTC / LTC / SOL / TRX balance",       value: "nonevmbal" },
      { name: "📤  Send BTC / LTC / SOL / TRX",                value: "nonevmsend" },
      { name: "📋  Transaction history (BTC/LTC/SOL/TRX)",     value: "nonevmtxs" },
      new inquirer.Separator(chalk.bold.white("  ── Transactions ──")),
      { name: "📜  EVM transaction history",                    value: "evmtxs" },
      new inquirer.Separator(chalk.bold.white("  ── Wallet ──")),
      { name: "📲  Show address QR code",                       value: "qrcode" },
      { name: "➕  Add account (derive from seed)",             value: "add_account" },
      { name: "🔐  Show seed phrase",                           value: "seed" },
      new inquirer.Separator(),
      { name: torLabel,                                          value: "toggle_tor" },
      new inquirer.Separator(),
      { name: "🗑   Wipe wallet from this device",              value: "wipe" },
      { name: "🚪  Exit",                                       value: "exit" },
    ],
    pageSize: 18,
  }]);

  switch (choice) {
    case "balances_all":  await menuCheckBalances(walletData);   break;
    case "balance_one":   await menuBalanceSingle(walletData);   break;
    case "send":          await menuSendCoin(walletData);        break;
    case "token_balance": await menuTokenBalance(walletData);    break;
    case "send_token":    await menuSendToken(walletData);       break;
    case "nonevmaddr":    await menuNonEVMAddress(walletData);       break;
    case "nonevmbal":     await menuNonEVMBalance(walletData);       break;
    case "nonevmsend":    await menuNonEVMSend(walletData);          break;
    case "nonevmtxs":     await menuNonEVMTransactions(walletData);  break;
    case "evmtxs":        await menuEVMTransactions(walletData);     break;
    case "qrcode":        await menuQRCode(walletData);              break;
    case "add_account":   await menuAddAccount(walletData);          break;
    case "seed":          await menuShowSeed(walletData);            break;
    case "toggle_tor":    await menuToggleTor(settings);         break;
    case "wipe":          await menuWipeWallet();                break;
    case "exit":
      console.log(chalk.gray("\n  Goodbye!\n"));
      process.exit(0);
  }
}
