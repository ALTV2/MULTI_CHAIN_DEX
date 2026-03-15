import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { readFileSync, writeFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const PKG = '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96';
const TKA = `${PKG}::test_token_a::TEST_TOKEN_A`;
const TKB = `${PKG}::test_token_b::TEST_TOKEN_B`;

async function main() {
  const privateKey = process.env.SUI_PRIVATE_KEY;
  if (!privateKey) throw new Error('SUI_PRIVATE_KEY not set');

  const { secretKey } = decodeSuiPrivateKey(privateKey);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');
  const client = new SuiClient({ url: rpcUrl });

  const deployer = keypair.getPublicKey().toSuiAddress();
  console.log('Deployer:', deployer);

  // Create OrderBookPair<TKA, TKB>
  console.log('\n1. Creating OrderBookPair<TKA, TKB>...');
  const txAB = new TransactionBlock();
  txAB.moveCall({
    target: `${PKG}::order_book::init_pair`,
    typeArguments: [TKA, TKB],
    arguments: [],
  });
  const resultAB = await client.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: txAB,
    options: { showObjectChanges: true, showEffects: true },
  });
  console.log('   ✅ TX:', resultAB.digest);

  const pairABObj = resultAB.objectChanges?.find(
    (c: any) => c.type === 'created' && c.objectType?.includes('OrderBookPair')
  );
  const pairABId = (pairABObj as any)?.objectId;
  console.log('   OrderBookPair<TKA,TKB>:', pairABId);

  // Create OrderBookPair<TKB, TKA>
  console.log('\n2. Creating OrderBookPair<TKB, TKA>...');
  const txBA = new TransactionBlock();
  txBA.moveCall({
    target: `${PKG}::order_book::init_pair`,
    typeArguments: [TKB, TKA],
    arguments: [],
  });
  const resultBA = await client.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: txBA,
    options: { showObjectChanges: true, showEffects: true },
  });
  console.log('   ✅ TX:', resultBA.digest);

  const pairBAObj = resultBA.objectChanges?.find(
    (c: any) => c.type === 'created' && c.objectType?.includes('OrderBookPair')
  );
  const pairBAId = (pairBAObj as any)?.objectId;
  console.log('   OrderBookPair<TKB,TKA>:', pairBAId);

  if (!pairABId || !pairBAId) {
    console.error('❌ Could not find created pair IDs in transaction effects');
    console.log('AB changes:', JSON.stringify(resultAB.objectChanges, null, 2));
    console.log('BA changes:', JSON.stringify(resultBA.objectChanges, null, 2));
    process.exit(1);
  }

  // Update deployment-info.json
  const deploymentPath = `${__dirname}/../deployment-info.json`;
  const info = JSON.parse(readFileSync(deploymentPath, 'utf8'));
  info.orderBookPairTKATKB = pairABId;
  info.orderBookPairTKBTKA = pairBAId;
  writeFileSync(deploymentPath, JSON.stringify(info, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ SUI Same-Chain Order Book Pairs Deployed');
  console.log('='.repeat(60));
  console.log(`  OrderBookPair<TKA,TKB>: ${pairABId}`);
  console.log(`  OrderBookPair<TKB,TKA>: ${pairBAId}`);
  console.log('='.repeat(60));
  console.log('\nAdd to frontend/lib/contracts/addresses.ts:');
  console.log(`  orderBookPairTKATKB: '${pairABId}' as const,`);
  console.log(`  orderBookPairTKBTKA: '${pairBAId}' as const,`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
