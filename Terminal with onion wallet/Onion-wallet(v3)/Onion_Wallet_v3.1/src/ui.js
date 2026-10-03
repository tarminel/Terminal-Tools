

import chalk from "chalk";

export function printBanner() {
  console.log("");
  console.log(chalk.cyan("╔══════════════════════════════════════════════════════════╗"));
  console.log(chalk.cyan("║") + chalk.bold.white("     ₿  Onion Wallet  — Multi-Chain Crypto Wallet         ") + chalk.cyan("║"));
  console.log(chalk.cyan("║") + chalk.gray("  ETH·POL·BNB·ARB·OP·BASE·AVAX·FTM·CELO·HYPE           ") + chalk.cyan("║"));
  console.log(chalk.cyan("║") + chalk.yellow("  BTC · LTC · SOL · TRX                                 ") + chalk.cyan("║"));
  console.log(chalk.cyan("╚══════════════════════════════════════════════════════════╝"));
  console.log("");
}

export function printSection(title) {
  console.log("");
  console.log(chalk.bold.yellow(`  ══ ${title} ══`));
  console.log("");
}

export function printWalletInfo(walletData) {
  const accounts = walletData?.accounts || [];
  printSection("Wallet Info");
  accounts.forEach((acc) => {
    console.log(
      chalk.gray("  ") + chalk.bold.green(`[${acc.label}]`) + chalk.gray(`  idx=${acc.index}`)
    );
    console.log(chalk.gray("    EVM Address : ") + chalk.white(acc.address));
    console.log("");
  });
  if (walletData?.mnemonic) {
    console.log(chalk.gray("  Seed phrase : ") + chalk.red("[hidden — use 'Show Seed Phrase' to reveal]"));
    console.log(chalk.gray("  BTC/LTC/SOL/TRX addresses derived from same seed on demand."));
  } else {
    console.log(chalk.gray("  Seed phrase : ") + chalk.gray("N/A (private-key import — EVM only)"));
  }
  console.log("");
}

export function printBalanceTable(results) {
  printSection("Balances");
  const C1 = 22, C2 = 8, C3 = 20;
  console.log(
    chalk.bold.gray("  " + "Network".padEnd(C1)) +
    chalk.bold.gray("Symbol".padEnd(C2)) +
    chalk.bold.gray("Balance")
  );
  console.log(chalk.gray("  " + "─".repeat(C1 + C2 + C3)));

  results.forEach((r) => {
    const net = r.network.padEnd(C1);
    const sym = r.symbol.padEnd(C2);
    let bal;
    if (r.error) {
      bal = r.reason === "timeout"
        ? chalk.yellow("timeout")
        : chalk.red("rpc error");
    } else {
      const f = parseFloat(r.balance);
      bal = f === 0 ? chalk.gray("0.0") : chalk.green(f.toFixed(6));
    }
    console.log(chalk.gray("  ") + chalk.white(net) + chalk.cyan(sym) + bal);
  });
  console.log("");
}

export function printSeedPhrase(mnemonic) {
  const words = mnemonic.split(" ");
  printSection("⚠  Seed Phrase — KEEP THIS SECRET");
  console.log(chalk.red("  NEVER share this with anyone.\n"));
  words.forEach((word, i) => {
    const num = String(i + 1).padStart(2, " ");
    process.stdout.write(chalk.gray(`  ${num}. `) + chalk.bold.white(word.padEnd(12)));
    if ((i + 1) % 4 === 0) process.stdout.write("\n");
  });
  console.log("\n");
}

export function printTxResult(tx, networkKey, NETWORKS) {
  const net = NETWORKS[networkKey];
  printSection("Transaction Sent");
  console.log(chalk.gray("  Hash    : ") + chalk.green(tx.hash));
  console.log(chalk.gray("  Network : ") + chalk.white(net.name));
  if (net.explorer) {
    console.log(chalk.gray("  Explorer: ") + chalk.cyan(`${net.explorer}/tx/${tx.hash}`));
  }
  console.log("");
}

export function success(msg) {
  console.log("\n" + chalk.bold.green("  ✔  ") + chalk.white(msg) + "\n");
}

export function error(msg) {
  console.log("\n" + chalk.bold.red("  ✖  ") + chalk.red(msg) + "\n");
}

export function info(msg) {
  console.log(chalk.gray("  ℹ  ") + chalk.gray(msg));
}
