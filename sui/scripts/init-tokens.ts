import { readFileSync } from 'fs';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import * as dotenv from 'dotenv';

dotenv.config();

interface DeploymentInfo {
  packageId: string;
  deployer: string;
}

async function main() {
  console.log('🪙 Minting test tokens...\n');

  // Load deployment info
  let deploymentInfo: DeploymentInfo;
  try {
    const data = readFileSync(`${__dirname}/../deployment-info.json`, 'utf8');
    deploymentInfo = JSON.parse(data);
  } catch (error) {
    console.error('❌ deployment-info.json not found. Run npm run deploy first.');
    process.exit(1);
  }

  const { packageId, deployer } = deploymentInfo;

  // Validate environment
  const mnemonic = process.env.SUI_MNEMONIC;
  const privateKey = process.env.SUI_PRIVATE_KEY;

  if (!mnemonic && !privateKey) {
    throw new Error('Either SUI_MNEMONIC or SUI_PRIVATE_KEY must be set in .env file');
  }

  // Setup client
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');
  const client = new SuiClient({ url: rpcUrl });

  // Derive keypair from mnemonic or private key
  let keypair: Ed25519Keypair;
  if (privateKey) {
    const { secretKey } = decodeSuiPrivateKey(privateKey);
    keypair = Ed25519Keypair.fromSecretKey(secretKey);
  } else {
    keypair = Ed25519Keypair.deriveKeypair(mnemonic!);
  }

  const address = keypair.getPublicKey().toSuiAddress();

  console.log(`👤 Address: ${address}`);
  console.log(`📦 Package: ${packageId}\n`);

  // Find TreasuryCap objects for both tokens
  console.log('🔍 Finding TreasuryCap objects...');

  const ownedObjects = await client.getOwnedObjects({
    owner: address,
    options: {
      showType: true,
      showContent: true,
    },
  });

  const tkaCapObject = ownedObjects.data.find((obj) =>
    obj.data?.type?.includes(`${packageId}::test_token_a::TEST_TOKEN_A`)
  );

  const tkbCapObject = ownedObjects.data.find((obj) =>
    obj.data?.type?.includes(`${packageId}::test_token_b::TEST_TOKEN_B`)
  );

  if (!tkaCapObject || !tkbCapObject) {
    console.error('❌ TreasuryCap objects not found');
    console.log('   Make sure tokens were deployed correctly');
    process.exit(1);
  }

  const tkaCapId = tkaCapObject.data?.objectId!;
  const tkbCapId = tkbCapObject.data?.objectId!;

  console.log(`  ✅ TKA TreasuryCap: ${tkaCapId}`);
  console.log(`  ✅ TKB TreasuryCap: ${tkbCapId}\n`);

  // Mint tokens
  const mintAmount = 1_000_000_000_000; // 1000 tokens (with 9 decimals)

  console.log(`💰 Minting ${mintAmount / 1_000_000_000} tokens to ${address}...\n`);

  // Mint TKA
  console.log('1. Minting sTKA...');
  const mintTkaTx = new TransactionBlock();
  mintTkaTx.moveCall({
    target: `${packageId}::test_token_a::mint`,
    arguments: [
      mintTkaTx.object(tkaCapId),
      mintTkaTx.pure(mintAmount),
      mintTkaTx.pure(address),
    ],
  });

  const tkaMintResult = await client.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: mintTkaTx,
  });

  console.log(`   ✅ Transaction: ${tkaMintResult.digest}`);

  // Mint TKB
  console.log('\n2. Minting sTKB...');
  const mintTkbTx = new TransactionBlock();
  mintTkbTx.moveCall({
    target: `${packageId}::test_token_b::mint`,
    arguments: [
      mintTkbTx.object(tkbCapId),
      mintTkbTx.pure(mintAmount),
      mintTkbTx.pure(address),
    ],
  });

  const tkbMintResult = await client.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: mintTkbTx,
  });

  console.log(`   ✅ Transaction: ${tkbMintResult.digest}`);

  // Verify balances
  console.log('\n✨ Checking balances...');

  const tkaBalance = await client.getBalance({
    owner: address,
    coinType: `${packageId}::test_token_a::TEST_TOKEN_A`,
  });

  const tkbBalance = await client.getBalance({
    owner: address,
    coinType: `${packageId}::test_token_b::TEST_TOKEN_B`,
  });

  console.log(`  sTKA: ${Number(tkaBalance.totalBalance) / 1_000_000_000}`);
  console.log(`  sTKB: ${Number(tkbBalance.totalBalance) / 1_000_000_000}`);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 TOKENS MINTED SUCCESSFULLY');
  console.log('='.repeat(60));
  console.log('Coin Types (for frontend):');
  console.log(`  sTKA: ${packageId}::test_token_a::TEST_TOKEN_A`);
  console.log(`  sTKB: ${packageId}::test_token_b::TEST_TOKEN_B`);
  console.log('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Token minting failed:', error);
    process.exit(1);
  });
