import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/utilities/tx";
import { getPoolConfiguratorProxy } from "../../helpers/contract-getters";
import { MULTISIG_ADDRESS } from "../../helpers";
import { type HttpNetworkUserConfig } from "hardhat/types";
import { getEmissionManager, getReserveTokensAddresses } from "../../helpers/contract-getters";
import {
  INCENTIVES_PULL_REWARDS_STRATEGY_ID,
} from "./../../helpers/deploy-ids";
import { AssetType, TransferStrategy, eNetwork } from "../../helpers/types";
import { MARKET_NAME } from "../../helpers/env";
import {
  ConfigNames,
  loadPoolConfig,
  getReserveAddress,
  getRewardAddress,
  getOracleByAsset,
} from "../../helpers/market-config-helpers";
import {
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  INCENTIVES_REWARDS_VAULT,
} from "../../helpers/constants";
import { RewardsDataTypes } from "../../typechain/@aave/periphery-v3/contracts/rewards/RewardsController";

/**
  HARDHAT_NETWORK=base npx hardhat tenderly-set-emissions \
    --transferstrategy 0 \
    --assettype 1 \
    --underlying 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22 \
    --rewardsymbol SEAM \
    --emissionpersecond 240000000000000000 \
    --duration 2592000
**/

task(`tenderly-set-emissions`)
  .addParam("transferstrategy") // string of enum value: 1, 2
  .addParam("assettype") // string of enum value: 1, 2, 3
  .addParam("underlying") // address of underlying asset market to add rewards to
  .addParam("rewardsymbol") // from markets/base/config
  .addParam("emissionpersecond")
  .addParam("duration") // seconds
  .setAction(
    async (
      { transferstrategy, assettype, underlying, rewardsymbol, emissionpersecond, duration }: 
      { 
        transferstrategy: string,
        assettype: string,
        underlying: string,
        rewardsymbol: string,
        emissionpersecond: string,
        duration: string,
      }, hre
    ) => {
      const seamlessMultisig = MULTISIG_ADDRESS[hre.network.name];
      if (hre.network.name && hre.network.name.toLowerCase() === "base") {
        const hre_config = hre.network.config as HttpNetworkUserConfig;

        if (hre_config.url !== undefined) {
          hre.ethers.provider = new hre.ethers.providers.JsonRpcProvider(hre_config.url);
        }

        let incentiveConfigList: RewardsDataTypes.RewardsConfigInputStruct[] = [];

        const config = await loadPoolConfig(MARKET_NAME as ConfigNames);

        if (transferstrategy !== TransferStrategy.PullRewardsStrategy.toString()) {
          console.warn("transferstrategy is not PullRewardsStrategy");
        }

        const incentivesConfigurator = (await getEmissionManager()).connect(
          await hre.ethers.getSigner(seamlessMultisig)
        );

        const transferStrategyArtifact = await hre.deployments.get(INCENTIVES_PULL_REWARDS_STRATEGY_ID);

        let assetAddress = underlying;

        const { aTokenAddress, stableDebtTokenAddress, variableDebtTokenAddress } = await getReserveTokensAddresses(assetAddress);

        if (assettype === AssetType.AToken.toString()) {
          assetAddress = aTokenAddress;
        } else if (assettype === AssetType.VariableDebtToken.toString()) {
          assetAddress = variableDebtTokenAddress;
        } else if (assettype === AssetType.StableDebtToken.toString()) {
          assetAddress = stableDebtTokenAddress;
        } else {
          console.warn(`invalid asset type ${assettype}`);
        }

        const rewardAddress = await getRewardAddress(config, rewardsymbol);

        let oracleAddress: string;
        try {
          oracleAddress = await getOracleByAsset(config, rewardsymbol);
        } catch(e) {
          const price = MOCK_CHAINLINK_AGGREGATORS_PRICES[rewardsymbol];
          if (!price) {
            throw `[ERROR] Missing mock price for asset ${rewardsymbol} at MOCK_CHAINLINK_AGGREGATORS_PRICES constant located at src/constants.ts`;
          }
          const artifact = await hre.deployments.get("MockAggregator");

          oracleAddress = artifact.address;
        }

        const incentiveConfig: RewardsDataTypes.RewardsConfigInputStruct = {
          totalSupply: 0,
          emissionPerSecond: emissionpersecond,
          distributionEnd: Math.floor(Date.now() / 1000) + parseInt(duration, 10),
          asset: assetAddress,
          reward: rewardAddress,
          rewardOracle: oracleAddress,
          transferStrategy: transferStrategyArtifact.address
        };

        console.log("  - setting incentive :", JSON.stringify(incentiveConfig));

        const emissionAdmin = await incentivesConfigurator.getEmissionAdmin(incentiveConfig.reward);
        if (emissionAdmin !== seamlessMultisig) {
          console.log(" - Not emission admin, executed configureAssets from emissionAdmin multisig: ", emissionAdmin);
          console.log(" - incentiveConfig: ", incentiveConfig);
          const calldata = incentivesConfigurator.interface.encodeFunctionData("configureAssets", [[incentiveConfig]]);
          console.log(" - Calldata: ", calldata);
        } else {
          incentiveConfigList.push(incentiveConfig);
          await waitForTx(
            await incentivesConfigurator.configureAssets(incentiveConfigList)
          );

          const rewardsVault = INCENTIVES_REWARDS_VAULT[hre.network.name];
          console.log(
            "- Successfully setup incentives, make sure to perform an ERC20 approve from the rewardsVault [", rewardsVault ,"] to the PullRewardsTransferStrategy [", transferStrategyArtifact.address, "]"
          );
        }
      } else {
        console.log("  - Task only for base tenderly forks");
      }
    }
  );
