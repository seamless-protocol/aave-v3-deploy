import { getReserveAddress, getRewardAddress, getOracleByAsset, isTestnetMarket } from "../../helpers/market-config-helpers";
import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/utilities/tx";
import {
  ConfigNames,
  loadPoolConfig,
  isIncentivesEnabled,
} from "../../helpers/market-config-helpers";
import { getEmissionManager, getReserveTokensAddresses, getPullRewardsStrategy, getERC20 } from "../../helpers/contract-getters";
import { MARKET_NAME } from "../../helpers/env";
import { FORK } from "../../helpers/hardhat-config-helpers";
import { AssetType, TransferStrategy, eNetwork } from "../../helpers/types";
import { RewardsDataTypes } from "../../typechain/@aave/periphery-v3/contracts/rewards/RewardsController";

task(
  `setup-incentives-emissions`,
  `Setups rewards incentives emissions from configuration`
).setAction(async (_, hre,) => {
  const { incentivesEmissionManager, incentivesRewardsVault } = await hre.getNamedAccounts();
  const network = FORK ? FORK : (hre.network.name as eNetwork);
  const config = await loadPoolConfig(MARKET_NAME as ConfigNames);

  if (!isIncentivesEnabled(config)) {
    console.log("Incentives not enabled for this network.");
    return;
  }

  const incentivesConfigurator = (await getEmissionManager()).connect(
    await hre.ethers.getSigner(incentivesEmissionManager)
  );

  const transferStrategy = await getPullRewardsStrategy();

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

    const oracleAddress = await getOracleByAsset(config, incentive.reward);

    const incentiveConfig: RewardsDataTypes.RewardsConfigInputStruct = {
      totalSupply: 0,
      emissionPerSecond: incentive.emissionPerSecond,
      distributionEnd: Math.floor(Date.now() / 1000) + incentive.duration,
      asset: assetAddress,
      reward: rewardAddress,
      rewardOracle: oracleAddress,
      transferStrategy: transferStrategy.address
    };

    console.log("  - setting incentive :", JSON.stringify(incentiveConfig));

    if (isTestnetMarket(config)) {
      const rewardToken = await getERC20(rewardAddress);

      await waitForTx(
        await rewardToken.connect(await hre.ethers.getSigner(incentivesRewardsVault)).approve(transferStrategy.address, hre.ethers.constants.MaxUint256)
      );
    }

    await waitForTx(
      await incentivesConfigurator.setEmissionAdmin(incentiveConfig.reward, incentivesEmissionManager)
    );

    incentiveConfigList.push(incentiveConfig);
  }

  if (incentiveConfigList.length) {
    await waitForTx(
      await incentivesConfigurator.configureAssets(incentiveConfigList)
    );

    console.log(
      "- Successfully setup incentives, make sure to perform an ERC20 approve from the rewardsVault [", incentivesRewardsVault ,"] to the PullRewardsTransferStrategy [", transferStrategy.address, "]"
    );
  } else {
    console.log(
      "- None of the assets has incentives enabled at market configuration"
    );
  }
});
