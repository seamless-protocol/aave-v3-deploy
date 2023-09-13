import { getReserveAddress, getRewardAddress, getOracleByAsset, isTestnetMarket } from "../../helpers/market-config-helpers";
import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/utilities/tx";
import {
  ConfigNames,
  loadPoolConfig,
  isIncentivesEnabled,
} from "../../helpers/market-config-helpers";
import {
  INCENTIVES_PULL_REWARDS_STRATEGY_ID,
  INCENTIVES_PROXY_ID,
} from "./../../helpers/deploy-ids";
import { getEmissionManager, getReserveTokensAddresses, getPullRewardsStrategy, getERC20 } from "../../helpers/contract-getters";
import { MARKET_NAME, COMMON_DEPLOY_PARAMS } from "../../helpers/env";
import { FORK } from "../../helpers/hardhat-config-helpers";
import { AssetType, TransferStrategy, eNetwork } from "../../helpers/types";
import { RewardsDataTypes } from "../../typechain/@aave/periphery-v3/contracts/rewards/RewardsController";
import {
  INCENTIVES_REWARDS_VAULT,
  POOL_ADMIN,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
} from "../../helpers/constants";

task(
  `setup-incentives-emissions`,
  `Setups rewards incentives emissions from configuration`
).setAction(async (_, hre,) => {
  const { deployer, incentivesEmissionManager, incentivesRewardsVault } = await hre.getNamedAccounts();
  const network = FORK ? FORK : (hre.network.name as eNetwork);
  const config = await loadPoolConfig(MARKET_NAME as ConfigNames);
  const rewardsVault = INCENTIVES_REWARDS_VAULT[network] ?? incentivesRewardsVault;
  const admin = POOL_ADMIN[network] ?? incentivesEmissionManager;

  if (!isIncentivesEnabled(config)) {
    console.log("Incentives not enabled for this network.");
    return;
  }

  const incentivesConfigurator = (await getEmissionManager()).connect(
    await hre.ethers.getSigner(incentivesEmissionManager)
  );

  const { address: rewardsProxyAddress } = await hre.deployments.get(
    INCENTIVES_PROXY_ID
  );

  const transferStrategyArtifact = await hre.deployments.deploy(INCENTIVES_PULL_REWARDS_STRATEGY_ID, {
    contract: "PullRewardsTransferStrategy",
    from: deployer,
    args: [
      rewardsProxyAddress,
      admin,
      rewardsVault,
    ],
    ...COMMON_DEPLOY_PARAMS,
  });

  let incentiveConfigList: RewardsDataTypes.RewardsConfigInputStruct[] = [];
  const incentivesInput = config.IncentivesConfig.incentivesInput[network] || [];
  for (let incentive of incentivesInput) {
    if (incentive.transferStrategy !== TransferStrategy.PullRewardsStrategy) {
      console.warn("transferStrategy is not PullRewardsStrategy");
      continue;
    }

    let assetAddress = await getReserveAddress(config, incentive.asset);

    const { aTokenAddress, stableDebtTokenAddress, variableDebtTokenAddress } = await getReserveTokensAddresses(assetAddress);

    if (incentive.assetType === AssetType.AToken) {
      assetAddress = aTokenAddress;
    } else if (incentive.assetType === AssetType.VariableDebtToken) {
      assetAddress = variableDebtTokenAddress;
    } else if (incentive.assetType === AssetType.StableDebtToken) {
      assetAddress = stableDebtTokenAddress;
    } else {
      console.warn(`invalid asset type ${incentive.assetType}`);
      continue;
    }

    const rewardAddress = await getRewardAddress(config, incentive.reward);

    let oracleAddress: string;
    try {
      oracleAddress = await getOracleByAsset(config, incentive.reward);
    } catch(e) {
      const price = MOCK_CHAINLINK_AGGREGATORS_PRICES[incentive.reward];
      if (!price) {
        throw `[ERROR] Missing mock price for asset ${incentive.reward} at MOCK_CHAINLINK_AGGREGATORS_PRICES constant located at src/constants.ts`;
      }
      const artifact = await hre.deployments.deploy("MockAggregator", {
        from: deployer,
        args: [price],
      });

      oracleAddress = artifact.address;
    }

    const incentiveConfig: RewardsDataTypes.RewardsConfigInputStruct = {
      totalSupply: 0,
      emissionPerSecond: incentive.emissionPerSecond,
      distributionEnd: Math.floor(Date.now() / 1000) + incentive.duration,
      asset: assetAddress,
      reward: rewardAddress,
      rewardOracle: oracleAddress,
      transferStrategy: transferStrategyArtifact.address
    };

    console.log("  - setting incentive :", JSON.stringify(incentiveConfig));

    if (isTestnetMarket(config)) {
      const rewardToken = await getERC20(rewardAddress);

      await waitForTx(
        await rewardToken.connect(await hre.ethers.getSigner(incentivesRewardsVault)).approve(transferStrategyArtifact.address, hre.ethers.constants.MaxUint256)
      );
    }

    const emissionAdmin = await incentivesConfigurator.getEmissionAdmin(incentiveConfig.reward);
    if (emissionAdmin !== incentivesEmissionManager) {
      console.log(" - Not emission admin, executed configureAssets from emissionAdmin multisig: ", emissionAdmin);
      console.log(" - incentiveConfig: ", incentiveConfig);
      const calldata = incentivesConfigurator.interface.encodeFunctionData("configureAssets", [[incentiveConfig]]);
      console.log(" - Calldata: ", calldata);
    } else {
      await waitForTx(
        await incentivesConfigurator.setEmissionAdmin(incentiveConfig.reward, incentivesEmissionManager)
      );
  
      incentiveConfigList.push(incentiveConfig);
    }
  }

  if (incentiveConfigList.length) {
    await waitForTx(
      await incentivesConfigurator.configureAssets(incentiveConfigList)
    );

    console.log(
      "- Successfully setup incentives, make sure to perform an ERC20 approve from the rewardsVault [", incentivesRewardsVault ,"] to the PullRewardsTransferStrategy [", transferStrategyArtifact.address, "]"
    );
  } else {
    console.log(
      "- None of the assets has incentives enabled at market configuration"
    );
  }
});
