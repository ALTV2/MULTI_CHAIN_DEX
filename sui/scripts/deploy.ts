import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import * as dotenv from 'dotenv';

dotenv.config();

interface DeploymentInfo {
  network: string;
  packageId: string;
  orderBookObjectId: string;
  deployer: string;
  deployedAt: string;
  supportedChains: number[];
}

async function main() {
  console.log('🚀 Deploying Multi-Chain DEX contracts to SUI testnet...\n');

  // Validate environment
  const mnemonic = process.env.SUI_MNEMONIC;
  const privateKey = process.env.SUI_PRIVATE_KEY;

  if (!mnemonic && !privateKey) {
    throw new Error('Either SUI_MNEMONIC or SUI_PRIVATE_KEY must be set in .env file');
  }

  // Build package
  console.log('📦 Building Move package...');
  try {
    execSync('sui move build', { cwd: __dirname + '/..', stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Build failed');
    process.exit(1);
  }

  // Setup client
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');
  const client = new SuiClient({ url: rpcUrl });

  // Derive keypair from mnemonic or private key
  let keypair: Ed25519Keypair;
  if (privateKey) {
    // Decode bech32 encoded private key
    const { secretKey } = decodeSuiPrivateKey(privateKey);
    keypair = Ed25519Keypair.fromSecretKey(secretKey);
  } else {
    keypair = Ed25519Keypair.deriveKeypair(mnemonic!);
  }

  const address = keypair.getPublicKey().toSuiAddress();

  console.log(`\n👤 Deployer: ${address}`);

  // Check balance
  const balance = await client.getBalance({ owner: address });
  const balanceSUI = Number(balance.totalBalance) / 1_000_000_000;
  console.log(`💰 Balance: ${balanceSUI.toFixed(4)} SUI`);

  if (balanceSUI < 0.1) {
    console.warn('⚠️  Low balance! Get testnet SUI from https://faucet.sui.io/');
  }

  // Read compiled modules
  const compiledModulesPath = `${__dirname}/../build/multi_chain_dex/bytecode_modules`;
  const modulesDir = require('fs').readdirSync(compiledModulesPath);

  const compiledModules = modulesDir
    .filter((file: string) => file.endsWith('.mv'))
    .map((file: string) => {
      const path = `${compiledModulesPath}/${file}`;
      return Array.from(readFileSync(path));
    });

  console.log(`\n📝 Publishing ${compiledModules.length} modules...`);

  // Create publish transaction
  const tx = new TransactionBlock();
  const [upgradeCap] = tx.publish({
    modules: compiledModules,
    dependencies: [
      '0x0000000000000000000000000000000000000000000000000000000000000001', // std
      '0x0000000000000000000000000000000000000000000000000000000000000002', // sui
    ],
  });

  // Transfer upgrade capability to deployer
  tx.transferObjects([upgradeCap], tx.pure(address));

  // Execute transaction
  console.log('⏳ Waiting for transaction confirmation...');
  const result = await client.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });

  console.log(`✅ Transaction successful: ${result.digest}`);

  // Extract package ID
  const packageId = result.objectChanges?.find(
    (change) => change.type === 'published'
  )?.packageId;

  if (!packageId) {
    throw new Error('Failed to extract package ID from transaction');
  }

  console.log(`\n📦 Package ID: ${packageId}`);

  // Find created objects (OrderBook should be created by init function)
  const createdObjects = result.objectChanges?.filter(
    (change) => change.type === 'created'
  );

  console.log(`\n📋 Created ${createdObjects?.length || 0} objects:`);
  createdObjects?.forEach((obj: any, i: number) => {
    console.log(`  ${i + 1}. ${obj.objectType}: ${obj.objectId}`);
  });

  // Find OrderBook object
  const orderBookObject = createdObjects?.find((obj: any) =>
    obj.objectType?.includes('cross_chain_order_book::OrderBook')
  );

  const orderBookObjectId = orderBookObject?.objectId || '';

  if (!orderBookObjectId) {
    console.warn('⚠️  OrderBook object not found in created objects');
    console.warn('   You may need to manually call init functions');
  } else {
    console.log(`\n📖 OrderBook Object ID: ${orderBookObjectId}`);
  }

  // Add supported chains to CrossChainOrderBook
  console.log('\n🔗 Adding supported chains...');

  try {
    const addChainTx = new TransactionBlock();

    // Add Ethereum Sepolia (11155111)
    addChainTx.moveCall({
      target: `${packageId}::cross_chain_order_book::add_supported_chain`,
      arguments: [
        addChainTx.object(orderBookObjectId),
        addChainTx.pure(11155111),
      ],
    });

    // Add Polygon Amoy (80002)
    addChainTx.moveCall({
      target: `${packageId}::cross_chain_order_book::add_supported_chain`,
      arguments: [
        addChainTx.object(orderBookObjectId),
        addChainTx.pure(80002),
      ],
    });

    const chainResult = await client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: addChainTx,
    });

    console.log(`  ✅ Added Ethereum Sepolia (11155111)`);
    console.log(`  ✅ Added Polygon Amoy (80002)`);
    console.log(`  Transaction: ${chainResult.digest}`);
  } catch (error: any) {
    console.error('  ⚠️  Failed to add chains:', error.message);
  }

  // Save deployment info
  const deploymentInfo: DeploymentInfo = {
    network: 'testnet',
    packageId,
    orderBookObjectId,
    deployer: address,
    deployedAt: new Date().toISOString(),
    supportedChains: [11155111, 80002], // Sepolia, Polygon Amoy
  };

  writeFileSync(
    `${__dirname}/../deployment-info.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log('\n💾 Deployment info saved to deployment-info.json');

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Network:          SUI Testnet`);
  console.log(`Package ID:       ${packageId}`);
  console.log(`OrderBook ID:     ${orderBookObjectId || 'N/A'}`);
  console.log(`Deployer:         ${address}`);
  console.log(`Explorer:         https://suiexplorer.com/object/${packageId}?network=testnet`);
  console.log('='.repeat(60));

  console.log('\n📝 Next steps:');
  console.log('  1. Run: npm run init-tokens');
  console.log('  2. Update frontend/lib/contracts/addresses.ts with package ID');
  console.log('  3. Test contracts with: sui client call ...');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
