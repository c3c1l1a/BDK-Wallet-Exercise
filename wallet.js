const { generateMnemonic, mnemonicToSeedSync } = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const { ElectrumExplorer } = require('@bitcoinerlab/explorer');
const fs = require('fs').promises; // For file I/O
const path = require('path');

// Initialize BIP32 and bitcoinjs-lib with tiny-secp256k1
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

// File to store the mnemonic
const mnemonicFile = path.join(__dirname, 'mnemonic.txt');

// Function to get or generate the mnemonic
async function getMnemonic() {
  try {
    const mnemonic = await fs.readFile(mnemonicFile, 'utf8');
    console.log("Retrieved existing mnemonic seed...");
    return mnemonic.trim();
  } catch (error) {
    if (error.code === 'ENOENT') { // File doesn’t exist
      console.log("Generating new mnemonic seed...");
      const mnemonic = generateMnemonic(128); // 12 words
      await fs.writeFile(mnemonicFile, mnemonic, 'utf8');
      console.log(`Mnemonic saved to ${mnemonicFile}: ${mnemonic}`);
      return mnemonic;
    }
    throw error; // Other errors (e.g., permissions)
  }
}

// Main wallet logic
(async () => {
  const mnemonic = await getMnemonic();
  console.log(`Mnemonic: ${mnemonic}`);

  const seed = mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, bitcoin.networks.testnet);
  const pathBase = "m/84'/1'/0'/0";

  console.log("\nGenerated Addresses:");
  const addresses = [];
  for (let i = 0; i < 3; i++) {
    const child = root.derivePath(`${pathBase}/${i}`);
    const pubkey = child.publicKey;
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(pubkey),
      network: bitcoin.networks.testnet,
    });
    console.log(`Address ${i + 1}: ${address}`);
    addresses.push(address);
  }

  console.log("\nSynchronizing with testnet...");
  const blockchain = new ElectrumExplorer({
    network: bitcoin.networks.testnet,
    host: 'electrum.blockstream.info',
    port: 60002,
    protocol: 'ssl',
  });

  try {
    await blockchain.connect();
    let totalBalance = 0;
    for (const address of addresses) {
      const utxos = await blockchain.fetchUtxos(address);
      const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
      totalBalance += balance;
    }
    console.log(`Balance: ${totalBalance} satoshis (${totalBalance / 100000000} BTC)`);

    if (totalBalance > 0) {
      console.log("Funding confirmed—wallet is active.");
    } else {
      console.log("No funds detected—continue funding.");
    }
  } catch (error) {
    console.error("Error during sync:", error);
  } finally {
    await blockchain.disconnect();
  }
})();