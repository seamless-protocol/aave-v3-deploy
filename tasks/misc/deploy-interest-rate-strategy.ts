import { task } from "hardhat/config";
import { parseUnits } from "ethers/lib/utils";
import { IInterestRateStrategyParams } from "../../helpers/types";
import {
  getPoolAddressesProvider,
} from "../../helpers/contract-getters";

/*
  Example command:

  HARDHAT_NETWORK=base-tenderly npx hardhat deploy-interest-rate-stretegy \
    --name testInterestRateStrategy \
    --optimalusageratio 0.9 \
    --basevariableborrowrate 0 \
    --variablerateslope1 0.04 \
    --variablerateslope2 0.6 \
    --stablerateslope1 0.005 \
    --stablerateslope2 0.6 \
    --basestablerateoffset 0.01 \
    --stablerateexcessoffset 0.08 \
    --optimalstabletototaldebtratio 0.2
 */

task(`deploy-interest-rate-stretegy`)
  .addParam("name")
  .addParam("optimalusageratio") // percent as decimal
  .addParam("basevariableborrowrate") // percent as decimal
  .addParam("variablerateslope1") // percent as decimal
  .addParam("variablerateslope2") // percent as decimal
  .addParam("stablerateslope1") // percent as decimal
  .addParam("stablerateslope2") // percent as decimal
  .addParam("basestablerateoffset") // percent as decimal
  .addParam("stablerateexcessoffset") // percent as decimal
  .addParam("optimalstabletototaldebtratio") // percent as decimal
  .setAction(
    async (
      { 
        name, 
        optimalusageratio, 
        basevariableborrowrate, 
        variablerateslope1, 
        variablerateslope2, 
        stablerateslope1, 
        stablerateslope2, 
        basestablerateoffset, 
        stablerateexcessoffset, 
        optimalstabletototaldebtratio, 
      }: { 
        name: string,
        optimalusageratio: string,
        basevariableborrowrate: string,
        variablerateslope1: string,
        variablerateslope2: string,
        stablerateslope1: string,
        stablerateslope2: string,
        basestablerateoffset: string,
        stablerateexcessoffset: string,
        optimalstabletototaldebtratio: string,
      }, 
      { deployments, getNamedAccounts, ...hre }
    ) => {
      console.log("  - Parsing parameters for new InterestRateStrategy");
      const rateStrategy: IInterestRateStrategyParams = {
        name: name,
        optimalUsageRatio: parseUnits(optimalusageratio, 27).toString(),
        baseVariableBorrowRate: parseUnits(basevariableborrowrate, 27).toString(),
        variableRateSlope1: parseUnits(variablerateslope1, 27).toString(),
        variableRateSlope2: parseUnits(variablerateslope2, 27).toString(),
        stableRateSlope1: parseUnits(stablerateslope1, 27).toString(),
        stableRateSlope2: parseUnits(stablerateslope2, 27).toString(),
        baseStableRateOffset: parseUnits(basestablerateoffset, 27).toString(),
        stableRateExcessOffset: parseUnits(stablerateexcessoffset, 27).toString(),
        optimalStableToTotalDebtRatio: parseUnits(optimalstabletototaldebtratio, 27).toString(),
      };

      const { deployer } = await getNamedAccounts();
      const poolAddressesProvider = await getPoolAddressesProvider();

      console.log("  - Deploying a new instance of InterestRateStrategy");
      const deployArgs = [
        poolAddressesProvider.address,
        rateStrategy.optimalUsageRatio,
        rateStrategy.baseVariableBorrowRate,
        rateStrategy.variableRateSlope1,
        rateStrategy.variableRateSlope2,
        rateStrategy.stableRateSlope1,
        rateStrategy.stableRateSlope2,
        rateStrategy.baseStableRateOffset,
        rateStrategy.stableRateExcessOffset,
        rateStrategy.optimalStableToTotalDebtRatio,
      ];
      const fixedInterestStrategy = await deployments.deploy(
        `ReserveStrategy-${rateStrategy.name}`,
        {
          from: deployer,
          args: deployArgs,
          contract: "DefaultReserveInterestRateStrategy",
          log: true,
          deterministicDeployment: hre.ethers.utils.formatBytes32String(
            rateStrategy.name
          ),
        }
      );
      console.log(
        "  - Deployed new Reserve Interest Strategy at",
        fixedInterestStrategy.address
      );
    }
  );