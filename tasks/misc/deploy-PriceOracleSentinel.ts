import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/utilities/tx";
import {
  POOL_ADDRESSES_PROVIDER_ID,
  PRICE_ORACLE_SENTINEL_ID,
} from "../../helpers/deploy-ids";
import { COMMON_DEPLOY_PARAMS } from "../../helpers/env";
import {
  PoolAddressesProvider,
} from "../../typechain";
import { MULTISIG_ADDRESS } from "../../helpers/constants";
import { type HttpNetworkUserConfig } from "hardhat/types";

/*
  Example command:

  HARDHAT_NETWORK=base npx hardhat deploy-PriceOracleSentinel \
    --sequencer 0xBCF85224fc0756B9Fa45aA7892530B47e10b6433 \
    --graceperiod 3600
 */

task(
  `deploy-PriceOracleSentinel`,
  `Deploys the PriceOracleSentinel contract`
)
.addParam("sequencer") // address of sequencer
.addParam("graceperiod") // in seconds
.setAction(async ({ sequencer, graceperiod }: { sequencer: string, graceperiod: string,}, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const addressProviderArtifact = await hre.deployments.get(
    POOL_ADDRESSES_PROVIDER_ID
  );

  console.log(`\n- PriceOracleSentinel deployment`);
  const { deployer } = await hre.getNamedAccounts();

  const artifact = await hre.deployments.deploy(PRICE_ORACLE_SENTINEL_ID, {
    from: deployer,
    args: [
        addressProviderArtifact.address,
        sequencer,
        graceperiod,
    ],
    ...COMMON_DEPLOY_PARAMS,
    contract: "PriceOracleSentinel",
  });

  console.log("PriceOracleSentinel deployed at:", artifact.address);
  console.log(`\tFinished PriceOracleSentinel deployment`);
});
