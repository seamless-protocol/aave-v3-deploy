import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/utilities/tx";
import {
  POOL_ADDRESSES_PROVIDER_ID,
  PRICE_ORACLE_SENTINEL_ID,
} from "../../helpers/deploy-ids";
import {
  PoolAddressesProvider,
} from "../../typechain";
import { MULTISIG_ADDRESS } from "../../helpers/constants";
import { type HttpNetworkUserConfig } from "hardhat/types";

/*
  Example command:

  HARDHAT_NETWORK=base npx hardhat tenderly-set-price-oracle-sentinel
 */

task(`tenderly-set-price-oracle-sentinel`)
.setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const config = hre.network.config as HttpNetworkUserConfig;
  if (config.url !== undefined) {
    hre.ethers.provider = new hre.ethers.providers.JsonRpcProvider(config.url);
  }

  const accounts = await hre.ethers.getSigners();
  const seamlessMultisig = MULTISIG_ADDRESS[hre.network.name];
  const seamlessMultisigSigner = await hre.ethers.getSigner(seamlessMultisig);

  // Fund multisig with ETH for impersonation calls
  const balanceAccounts = accounts.map(a => a.address);
  balanceAccounts.push(seamlessMultisig);
  await ethers.provider.send("tenderly_setBalance", [
    balanceAccounts,
    hre.ethers.utils.hexValue(hre.ethers.utils.parseUnits("10000", "ether").toHexString()),
  ]);

  const addressProviderArtifact = await hre.deployments.get(
    POOL_ADDRESSES_PROVIDER_ID
  );
  const addressProvider = (await hre.ethers.getContractAt(
    addressProviderArtifact.abi,
    addressProviderArtifact.address
  )).connect(seamlessMultisigSigner) as PoolAddressesProvider;

  const artifact = await hre.deployments.get(PRICE_ORACLE_SENTINEL_ID);

  const tx = await waitForTx(
    await addressProvider.setPriceOracleSentinel(artifact.address)
  );
  console.log(
    `  - Set PriceOracleSentinel at ${artifact.address} as PriceOracleSentinel in PoolAddressProvider`,
    `\n    - Tx hash: ${tx.transactionHash}`
  );
});
