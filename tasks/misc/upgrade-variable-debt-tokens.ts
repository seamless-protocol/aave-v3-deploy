import { loadPoolConfig } from "../../helpers/market-config-helpers";
import { POOL_ADMIN } from "../../helpers/constants";
import {
  getVariableDebtToken,
  getPoolAddressesProvider,
} from "../../helpers/contract-getters";
import {
  VARIABLE_DEBT_TOKEN_IMPL_ID,
  INCENTIVES_PROXY_ID,
  POOL_ADDRESSES_PROVIDER_ID,
  TREASURY_PROXY_ID,
} from "../../helpers/deploy-ids";
import { getAddressFromJson } from "../../helpers/utilities/tx";
import { getAaveProtocolDataProvider } from "../../helpers/contract-getters";
import { waitForTx } from "../../helpers/utilities/tx";
import { getPoolConfiguratorProxy } from "../../helpers/contract-getters";
import { task } from "hardhat/config";
import { FORK } from "../../helpers/hardhat-config-helpers";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../helpers/env";

// Returns true if tokens upgraded, false if not

task(`upgrade-variable-debt-tokens`)
  .addParam("revision")
  .setAction(
    async ({ revision }, { deployments, getNamedAccounts, ...hre }) => {
      const { deployer } = await getNamedAccounts();
      const network = FORK ? FORK : hre.network.name;

      const admin = POOL_ADMIN[network];

      if (!MARKET_NAME) {
        console.error("Missing MARKET_NAME env variable. Exiting.");
        return false;
      }
      const { ATokenNamePrefix, SymbolPrefix } = await loadPoolConfig(
        MARKET_NAME
      );

      const poolAddressesProvider = await getPoolAddressesProvider(
        await getAddressFromJson(network, POOL_ADDRESSES_PROVIDER_ID)
      );

      const treasury = await getAddressFromJson(network, TREASURY_PROXY_ID);

      const incentivesController = await getAddressFromJson(
        network,
        INCENTIVES_PROXY_ID
      );
      const protocolDataProvider = await getAaveProtocolDataProvider(
        await poolAddressesProvider.getPoolDataProvider()
      );

      const poolConfigurator = await getPoolConfiguratorProxy(
        await poolAddressesProvider.getPoolConfigurator()
      );

      const reserves = await protocolDataProvider.getAllReservesTokens();

      const newAtokenArtifact = await deployments.deploy(VARIABLE_DEBT_TOKEN_IMPL_ID, {
        contract: "VariableDebtToken",
        from: deployer,
        args: [await poolAddressesProvider.getPool()],
        ...COMMON_DEPLOY_PARAMS,
      });

      const deployedRevision = await (
        await (await getVariableDebtToken(newAtokenArtifact.address)).DEBT_TOKEN_REVISION()
      ).toString();

      console.log("deployedRevision", deployedRevision, "revision", revision, deployedRevision !== revision)

      if (deployedRevision !== revision) {
        console.error(
          `- Deployed VariableDebtToken implementation revision ${deployedRevision} does not match expected revision ${revision}`
        );
        return false;
      }

      for (let x = 0; x < reserves.length; x++) {
        const [symbol, asset] = reserves[x];
        const normalizedSymbol = symbol.replace("USDBC", "USDbC");

        console.log(`- Updating s${normalizedSymbol}...`);
        console.log("newImplementation: ", newAtokenArtifact.address);

        const args = {
          asset,
          incentivesController,
          name: `Seamless Variable Debt ${normalizedSymbol}`,
          symbol: `variableDebtSeam${normalizedSymbol}`,
          implementation: newAtokenArtifact.address,
          params: [],
        };

        if (deployer !== admin) {
          const calldata = poolConfigurator.interface.encodeFunctionData("updateVariableDebtToken", [args]);
          console.warn(
            `- VariableDebtToken deployed, execute update from multisig. Args: ${JSON.stringify(args)}, To: ${poolConfigurator.address}, Call data: ${calldata}`
          );
          continue;
        }

        try {
          await waitForTx(
            await poolConfigurator.updateVariableDebtToken(args)
          );
          console.log(`  - Updated implementation of variableDebtSeam${normalizedSymbol}`);
        } catch (e) {
          console.error("failed to updateVariableDebtToken skipping. Error: ", e);
          throw e;
        }
      }
    }
  );
