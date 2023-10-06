import {
  IAaveConfiguration,
  tEthereumAddress,
} from "../../helpers/types";
import { task } from "hardhat/config";
import { type HttpNetworkUserConfig } from "hardhat/types";
import { BigNumberish } from "ethers";
import { eNetwork } from "../../helpers/types";
import { waitForTx } from "../../helpers/utilities/tx";
import {
  PoolConfigurator,
  PoolAddressesProvider,
  Pool,
  AaveProtocolDataProvider,
} from "../../typechain";
import {
  getAaveOracle,
  getEmissionManager,
} from "../../helpers/contract-getters";
import {
  ATOKEN_IMPL_ID,
  L2_POOL_IMPL_ID,
  POOL_ADDRESSES_PROVIDER_ID,
  POOL_CONFIGURATOR_IMPL_ID,
  POOL_CONFIGURATOR_PROXY_ID,
  POOL_DATA_PROVIDER,
  POOL_IMPL_ID,
  STABLE_DEBT_TOKEN_IMPL_ID,
  VARIABLE_DEBT_TOKEN_IMPL_ID,
  ATOKEN_PREFIX,
  STABLE_DEBT_PREFIX,
  VARIABLE_DEBT_PREFIX,
} from "../../helpers/deploy-ids";
import {
  ConfigNames,
  getTreasuryAddress,
  loadPoolConfig,
  isL2PoolSupported,
} from "../../helpers/market-config-helpers";
import { MARKET_NAME } from "../../helpers/env";
import { ZERO_ADDRESS, MULTISIG_ADDRESS } from "../../helpers/constants";

/**
  Example command:
  
  HARDHAT_NETWORK=base-tenderly npx hardhat tenderly-new-listing \
    --underlying 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22 \
    --symbol cbETH \
    --decimals 18 \
    --strategy 0xbc5D91f0688150886043308cC4fe15a712268593 \
    --baseltv 6700 \
    --liquidationthreshold 7400 \
    --liquidationbonus 10750 \
    --liquidationprotocolfee 0 \
    --reservefactor 1500 \
    --borrowcap 100 \
    --supplycap 1000 \
    --chainlinkoracle 0xd7818272b9e248357d13057aab0b417af31e817d
**/


task(`tenderly-new-listing`)
  .addParam("underlying") // address
  .addParam("symbol") // asset symbol
  .addParam("decimals")
  .addParam("strategy") // address
  .addParam("baseltv") // as basis point
  .addParam("liquidationthreshold") // as basis point
  .addParam("liquidationbonus") // as basis point
  .addParam("liquidationprotocolfee") // as basis point
  .addParam("reservefactor") // as basis point
  .addParam("borrowcap") // human readable value, scaled by decimals
  .addParam("supplycap") // human readable value, scaled by decimals
  .addParam("chainlinkoracle") // address
  .setAction(
    async (
      { underlying, symbol, decimals, strategy, baseltv, liquidationthreshold, liquidationbonus, liquidationprotocolfee, reservefactor, borrowcap, supplycap, chainlinkoracle }: 
      { 
        underlying: tEthereumAddress, 
        symbol: string, 
        decimals: string, 
        strategy: tEthereumAddress, 
        baseltv: string,
        liquidationthreshold: string,
        liquidationbonus: string,
        liquidationprotocolfee: string,
        reservefactor: string,
        borrowcap: string,
        supplycap: string,
        chainlinkoracle: tEthereumAddress,
      }, 
      { deployments, getNamedAccounts, ...hre }
    ) => {
      const accounts = await hre.ethers.getSigners();
      const seamlessMultisig = MULTISIG_ADDRESS[hre.network.name];
      if (hre.network.name && hre.network.name.toLowerCase() === "base-tenderly") {
        const config = hre.network.config as HttpNetworkUserConfig;

        if (config.url !== undefined) {
          hre.ethers.provider = new hre.ethers.providers.JsonRpcProvider(config.url);
        }

        // Fund multisig with ETH for impersonation calls
        const balanceAccounts = accounts.map(a => a.address);
        balanceAccounts.push(seamlessMultisig);
        await ethers.provider.send("tenderly_setBalance", [
          balanceAccounts,
          hre.ethers.utils.hexValue(hre.ethers.utils.parseUnits("10000", "ether").toHexString()),
        ]);

        // Initialize new listing reserves
        const { deployer } = await getNamedAccounts();
        const poolConfig = (await loadPoolConfig(
          MARKET_NAME as ConfigNames
        )) as IAaveConfiguration;

        const seamlessMultisigSigner = await hre.ethers.getSigner(seamlessMultisig);
        const proxyArtifact = await deployments.get(POOL_CONFIGURATOR_PROXY_ID);
        const configuratorArtifact = await deployments.get(
          POOL_CONFIGURATOR_IMPL_ID
        );
        const configurator = (
          await hre.ethers.getContractAt(
            configuratorArtifact.abi,
            proxyArtifact.address
          )
        ).connect(seamlessMultisigSigner) as PoolConfigurator;

        const treasuryAddress = await getTreasuryAddress(poolConfig, hre.network.name as eNetwork);
        const incentivesController = await deployments.get("IncentivesProxy");

        // TODO: support for delegation aware atokens: reference helpers/init-helpers.ts?
        const aTokenImplementationAddress = (await deployments.get(ATOKEN_IMPL_ID)).address;
        const stableDebtTokenImplementationAddress = (await deployments.get(STABLE_DEBT_TOKEN_IMPL_ID)).address;
        const variableDebtTokenImplementationAddress = await (await deployments.get(VARIABLE_DEBT_TOKEN_IMPL_ID)).address;

        let initInputParams: {
          aTokenImpl: string;
          stableDebtTokenImpl: string;
          variableDebtTokenImpl: string;
          underlyingAssetDecimals: BigNumberish;
          interestRateStrategyAddress: string;
          underlyingAsset: string;
          treasury: string;
          incentivesController: string;
          underlyingAssetName: string;
          aTokenName: string;
          aTokenSymbol: string;
          variableDebtTokenName: string;
          variableDebtTokenSymbol: string;
          stableDebtTokenName: string;
          stableDebtTokenSymbol: string;
          params: string;
        }[] = [];

        initInputParams.push({
          aTokenImpl: aTokenImplementationAddress,
          stableDebtTokenImpl: stableDebtTokenImplementationAddress,
          variableDebtTokenImpl: variableDebtTokenImplementationAddress,
          underlyingAssetDecimals: decimals,
          interestRateStrategyAddress: strategy,
          underlyingAsset: underlying,
          treasury: treasuryAddress,
          incentivesController: incentivesController.address,
          underlyingAssetName: symbol,
          aTokenName: `Seamless ${symbol}`,
          aTokenSymbol: `s${symbol}`,
          variableDebtTokenName: `Seamless Variable Debt ${symbol}`,
          variableDebtTokenSymbol: `variableDebtSeam${symbol}`,
          stableDebtTokenName: `Seamless Stable Debt ${symbol}`,
          stableDebtTokenSymbol: `stableDebtSeam${symbol}`,
          params: "0x10", // TODO: revisit `params` argument
        });

        const addressProviderArtifact = await deployments.get(
          POOL_ADDRESSES_PROVIDER_ID
        );
        const addressProvider = (await hre.ethers.getContractAt(
          addressProviderArtifact.abi,
          addressProviderArtifact.address
        )) as PoolAddressesProvider;

        const poolArtifact = await deployments.get(isL2PoolSupported(poolConfig) ? L2_POOL_IMPL_ID : POOL_IMPL_ID);
        const pool = (await hre.ethers.getContractAt(
            poolArtifact.abi,
            await addressProvider.getPool()
        )) as any as Pool;
        const poolReserve = await pool.getReserveData(underlying);

        const protocolDataArtifact = await deployments.get(POOL_DATA_PROVIDER);
        const protocolDataProvider = (await hre.ethers.getContractAt(
          protocolDataArtifact.abi,
          (await deployments.get(POOL_DATA_PROVIDER)).address
        )) as AaveProtocolDataProvider;

        if (poolReserve.aTokenAddress === ZERO_ADDRESS) {
          // Initialize reserve
          const tx = await waitForTx(
            await configurator.initReserves(initInputParams)
          );
          console.log(
            `  - Reserve ready for: ${symbol}`,
            `\n    - Tx hash: ${tx.transactionHash}`
          );

          // Save new listing artifacts
          const aTokenArtifact = await deployments.getExtendedArtifact("AToken");
          const variableDebtTokenArtifact = await deployments.getExtendedArtifact("VariableDebtToken");
          const stableDebtTokenArtifact = await deployments.getExtendedArtifact("StableDebtToken");

          const { aTokenAddress, variableDebtTokenAddress, stableDebtTokenAddress } =
            await protocolDataProvider.getReserveTokensAddresses(underlying);

          await deployments.save(`${symbol}${ATOKEN_PREFIX}`, {
            address: aTokenAddress,
            ...aTokenArtifact,
          });
          await deployments.save(`${symbol}${VARIABLE_DEBT_PREFIX}`, {
            address: variableDebtTokenAddress,
            ...variableDebtTokenArtifact,
          });
          await deployments.save(`${symbol}${STABLE_DEBT_PREFIX}`, {
            address: stableDebtTokenAddress,
            ...stableDebtTokenArtifact,
          });
          console.log(`  - Saved ${symbol}${ATOKEN_PREFIX} at ${aTokenAddress}`);
          console.log(`  - Saved ${symbol}${VARIABLE_DEBT_PREFIX} at ${variableDebtTokenAddress}`);
          console.log(`  - Saved ${symbol}${STABLE_DEBT_PREFIX} at ${stableDebtTokenAddress}`);
        } else {
          console.log(`- Skipping init of ${symbol} at ${underlying} is already initialized`);
        }

        const { usageAsCollateralEnabled: alreadyEnabled } =
          await protocolDataProvider.getReserveConfigurationData(underlying);

        if (!alreadyEnabled) {
          // Configure reserve
          await configurator.configureReserveAsCollateral(
            underlying,
            baseltv,
            liquidationthreshold,
            liquidationbonus
          );

          // Assumes we list to allow borrowing
          await configurator.setReserveBorrowing(underlying, true);
          await configurator.setBorrowCap(underlying, borrowcap);
          await configurator.setReserveStableRateBorrowing(underlying, false);  
          await configurator.setReserveFlashLoaning(underlying, false);
          await configurator.setSupplyCap(underlying, supplycap);
          await configurator.setReserveFactor(underlying, reservefactor);
          await configurator.setLiquidationProtocolFee(underlying, liquidationprotocolfee)

          console.log(`  - Configured reserve ${symbol} at ${underlying} as collateral`)
          console.log(`    - Set borrow cap to ${borrowcap}`)
          console.log(`    - Set supply cap to ${supplycap}`)
          console.log(`    - Set reserve factor to ${reservefactor}`)

          const aaveOracle = (await getAaveOracle()).connect(seamlessMultisigSigner);
          await waitForTx(await aaveOracle.setAssetSources([underlying], [chainlinkoracle]));
          console.log(`  - Configured Chainlink oracle for ${symbol} to ${chainlinkoracle}`)

          // TODO: emissions setup via separate task or use `tasks/misc/setup-rewards-incentives.ts`
          // TODO: emode setup via separate task or use `tasks/misc/setup-e-modes.ts`
        } else {
          console.log(
            `- Reserve ${symbol} at ${underlying} is already enabled as collateral, skipping`
          );
        }
      } else {
        console.log("  - Task only for tenderly networks");
      }
    }
  );