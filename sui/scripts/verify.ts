import { readFileSync } from 'fs';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import * as dotenv from 'dotenv';

dotenv.config();

interface DeploymentInfo {
  packageId: string;
  orderBookObjectId: string;
  deployer: string;
}

async function main() {
  console.log('🔍 Verifying SUI deployment...\n');

  // Load deployment info
  let deploymentInfo: DeploymentInfo;
  try {
    const data = readFileSync(`${__dirname}/../deployment-info.json`, 'utf8');
    deploymentInfo = JSON.parse(data);
  } catch (error) {
    console.error('❌ deployment-info.json not found. Run npm run deploy first.');
    process.exit(1);
  }

  const { packageId, orderBookObjectId, deployer } = deploymentInfo;

  // Setup client
  const client = new SuiClient({ url: getFullnodeUrl('testnet') });

  console.log('📦 Checking package...');
  try {
    const packageObj = await client.getObject({
      id: packageId,
      options: { showContent: true },
    });

    if (packageObj.data) {
      console.log('  ✅ Package exists');
      console.log(`     ${packageId}`);
    } else {
      console.log('  ❌ Package not found');
    }
  } catch (error) {
    console.log('  ❌ Failed to fetch package');
  }

  console.log('\n📖 Checking OrderBook...');
  if (orderBookObjectId) {
    try {
      const orderBookObj = await client.getObject({
        id: orderBookObjectId,
        options: { showContent: true, showType: true },
      });

      if (orderBookObj.data) {
        console.log('  ✅ OrderBook exists');
        console.log(`     ${orderBookObjectId}`);
        console.log(`     Type: ${orderBookObj.data.type}`);
      } else {
        console.log('  ❌ OrderBook not found');
      }
    } catch (error) {
      console.log('  ❌ Failed to fetch OrderBook');
    }
  } else {
    console.log('  ⚠️  OrderBook ID not set in deployment-info.json');
  }

  console.log('\n🪙 Checking token modules...');

  // Try to find TreasuryCap objects
  const ownedObjects = await client.getOwnedObjects({
    owner: deployer,
    options: { showType: true },
  });

  const tkaCapObject = ownedObjects.data.find((obj) =>
    obj.data?.type?.includes('test_token_a::TEST_TOKEN_A')
  );

  const tkbCapObject = ownedObjects.data.find((obj) =>
    obj.data?.type?.includes('test_token_b::TEST_TOKEN_B')
  );

  if (tkaCapObject) {
    console.log('  ✅ sTKA token deployed');
    console.log(`     ${packageId}::test_token_a::TEST_TOKEN_A`);
  } else {
    console.log('  ❌ sTKA token not found');
  }

  if (tkbCapObject) {
    console.log('  ✅ sTKB token deployed');
    console.log(`     ${packageId}::test_token_b::TEST_TOKEN_B`);
  } else {
    console.log('  ❌ sTKB token not found');
  }

  // Check balances
  console.log('\n💰 Checking deployer balances...');

  const suiBalance = await client.getBalance({ owner: deployer });
  console.log(`  SUI: ${Number(suiBalance.totalBalance) / 1_000_000_000}`);

  if (tkaCapObject) {
    try {
      const tkaBalance = await client.getBalance({
        owner: deployer,
        coinType: `${packageId}::test_token_a::TEST_TOKEN_A`,
      });
      console.log(`  sTKA: ${Number(tkaBalance.totalBalance) / 1_000_000_000}`);
    } catch (error) {
      console.log(`  sTKA: 0 (not minted yet)`);
    }
  }

  if (tkbCapObject) {
    try {
      const tkbBalance = await client.getBalance({
        owner: deployer,
        coinType: `${packageId}::test_token_b::TEST_TOKEN_B`,
      });
      console.log(`  sTKB: ${Number(tkbBalance.totalBalance) / 1_000_000_000}`);
    } catch (error) {
      console.log(`  sTKB: 0 (not minted yet)`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Network:  SUI Testnet`);
  console.log(`Package:  ${packageId}`);
  console.log(`Deployer: ${deployer}`);
  console.log(`\nExplorer Links:`);
  console.log(`  Package: https://suiexplorer.com/object/${packageId}?network=testnet`);
  if (orderBookObjectId) {
    console.log(`  OrderBook: https://suiexplorer.com/object/${orderBookObjectId}?network=testnet`);
  }
  console.log('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
