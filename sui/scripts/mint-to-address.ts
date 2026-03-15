import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import * as dotenv from 'dotenv';

dotenv.config();

const PKG = '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96';
const RECIPIENT = process.argv[2] || '0xf08a11c219701c2be9e94b75a392c21d6c910363febf15af00fd1b8c5e015a63';
const AMOUNT = 1_000_000_000_000; // 1000 tokens (9 decimals)

async function main() {
  const privateKey = process.env.SUI_PRIVATE_KEY;
  if (!privateKey) throw new Error('SUI_PRIVATE_KEY not set');

  const { secretKey } = decodeSuiPrivateKey(privateKey);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');
  const client = new SuiClient({ url: rpcUrl });

  const deployer = keypair.getPublicKey().toSuiAddress();
  console.log('Deployer:', deployer);
  console.log('Recipient:', RECIPIENT);

  const owned = await client.getOwnedObjects({ owner: deployer, options: { showType: true } });

  const tkaObj = owned.data.find((o: any) => o.data?.type?.includes('TreasuryCap') && o.data?.type?.includes(PKG + '::test_token_a::TEST_TOKEN_A'));
  const tkbObj = owned.data.find((o: any) => o.data?.type?.includes('TreasuryCap') && o.data?.type?.includes(PKG + '::test_token_b::TEST_TOKEN_B'));

  if (!tkaObj || !tkbObj) {
    console.error('TreasuryCap not found');
    return;
  }

  console.log('TKA cap:', tkaObj.data!.objectId);
  console.log('TKB cap:', tkbObj.data!.objectId);

  // Mint TKA
  console.log('\n1. Minting sTKA...');
  const txA = new TransactionBlock();
  txA.moveCall({
    target: `${PKG}::test_token_a::mint`,
    arguments: [
      txA.object(tkaObj.data!.objectId),
      txA.pure(AMOUNT),
      txA.pure(RECIPIENT),
    ],
  });
  const rA = await client.signAndExecuteTransactionBlock({ signer: keypair, transactionBlock: txA });
  console.log('   ✅ sTKA minted:', rA.digest);

  // Mint TKB
  console.log('\n2. Minting sTKB...');
  const txB = new TransactionBlock();
  txB.moveCall({
    target: `${PKG}::test_token_b::mint`,
    arguments: [
      txB.object(tkbObj.data!.objectId),
      txB.pure(AMOUNT),
      txB.pure(RECIPIENT),
    ],
  });
  const rB = await client.signAndExecuteTransactionBlock({ signer: keypair, transactionBlock: txB });
  console.log('   ✅ sTKB minted:', rB.digest);

  // Verify
  const tka = await client.getBalance({ owner: RECIPIENT, coinType: `${PKG}::test_token_a::TEST_TOKEN_A` });
  const tkb = await client.getBalance({ owner: RECIPIENT, coinType: `${PKG}::test_token_b::TEST_TOKEN_B` });
  console.log(`\nRecipient balances:`);
  console.log(`  sTKA: ${Number(tka.totalBalance) / 1e9}`);
  console.log(`  sTKB: ${Number(tkb.totalBalance) / 1e9}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
