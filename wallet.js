const { mnemonicToSeedSync } = require('bip39');
const { generateMnemonic } = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const { ElectrumExplorer } = require('@bitcoinerlab/explorer');
const path = require('path');
const fs = require('fs').promises; 

const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

// File to store the mnemonic
const mnemonicFile = path.join(__dirname, 'mnemonic.txt');
console.log(mnemonicFile)

async function getMnemonic() {
  try {
    const mnemonic = await fs.readFile(mnemonicFile, 'utf8');
    console.log("Retrieved existing mnemonic seed...");
    return mnemonic;
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

(async () => {
  //console.log("Generating mnemonic seed...");
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
      network: bitcoin.networks.testnet
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

  await blockchain.connect();
  let totalBalance = 0;
  for (const address of addresses) {
    const utxos = await blockchain.fetchTxHistory({address: address});
    const balance = await blockchain.fetchAddress(address);
    totalBalance += balance.balance;
  }
  console.log(`Balance: ${totalBalance} satoshis (${totalBalance / 100000000} BTC)`);

  // Step 6: Verify funding
  if (totalBalance > 0) {
    console.log("Funding confirmed—wallet is active.");
  } else {
    console.log("No funds detected—continue funding.");
  }

  await blockchain.close();
})();







// console.log("\nSynchronizing with testnet...");
// const blockchain = new ElectrumExplorer({
//   network: bitcoin.networks.testnet,
//   host: 'electrum.blockstream.info',
//   port: 60002,
//   protocol: 'ssl',
// });

// (async () => {
//   await blockchain.connect();
//   let totalBalance = 0;
//   for (const address of addresses) {
//     const utxos = await blockchain.fetchTxHistory({address: address});
//     const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
//     totalBalance += balance;
//   }
//   console.log(`Balance: ${totalBalance} satoshis (${totalBalance / 100000000} BTC)`);

//   // Step 6: Verify funding
//   if (totalBalance > 0) {
//     console.log("Funding confirmed—wallet is active.");
//   } else {
//     console.log("No funds detected—continue funding.");
//   }

//   await blockchain.close();
// })();