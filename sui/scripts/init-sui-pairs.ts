import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { readFileSync, writeFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const PKG = '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96';
const SUI_TYPE = '0x2::sui::SUI';
const TKA = `${PKG}::test_token_a::TEST_TOKEN_A`;
const TKB = `${PKG}::test_token_b::TEST_TOKEN_B`;

async function createPair(
  client: SuiClient,
  keypair: Ed25519Keypair,
  coinA: string,
  coinB: string,
  label: string
): Promise<string> {
  console.log(`\nCreating OrderBookPair<${label}>...`);
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${PKG}::order_book::init_pair`,
    typeArguments: [coinA, coinB],
    arguments: [],
  });
  const result = await client.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: tx,
    options: { showObjectChanges: true, showEffects: true },
  });

  const pairObj = result.objectChanges?.find(
    (c: any) => c.type === 'created' && c.objectType?.includes('OrderBookPair')
  );
  const pairId = (pairObj as any)?.objectId;
  if (!pairId) throw new Error(`Could not find created pair ID for ${label}`);
  console.log(`  ✅ ${label}: ${pairId}`);
  return pairId;
}

async function main() {
  const privateKey = process.env.SUI_PRIVATE_KEY;
  if (!privateKey) throw new Error('SUI_PRIVATE_KEY not set');

  const { secretKey } = decodeSuiPrivateKey(privateKey);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');
  const client = new SuiClient({ url: rpcUrl });

  console.log('Deployer:', keypair.getPublicKey().toSuiAddress());

  const suiTka = await createPair(client, keypair, SUI_TYPE, TKA, 'SUI→TKA');
  const tkaSui = await createPair(client, keypair, TKA, SUI_TYPE, 'TKA→SUI');
  const suiTkb = await createPair(client, keypair, SUI_TYPE, TKB, 'SUI→TKB');
  const tkbSui = await createPair(client, keypair, TKB, SUI_TYPE, 'TKB→SUI');

  // Update deployment-info.json
  const deploymentPath = `${__dirname}/../deployment-info.json`;
  const info = JSON.parse(readFileSync(deploymentPath, 'utf8'));
  info.orderBookPairSUITKA = suiTka;
  info.orderBookPairTKASUI = tkaSui;
  info.orderBookPairSUITKB = suiTkb;
  info.orderBookPairTKBSUI = tkbSui;
  writeFileSync(deploymentPath, JSON.stringify(info, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ SUI Native Pairs Deployed');
  console.log('='.repeat(60));
  console.log(`  SUI→TKA: ${suiTka}`);
  console.log(`  TKA→SUI: ${tkaSui}`);
  console.log(`  SUI→TKB: ${suiTkb}`);
  console.log(`  TKB→SUI: ${tkbSui}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
