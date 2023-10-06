import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/utilities/tx";
import { getPoolConfiguratorProxy } from "../../helpers/contract-getters";
import { MULTISIG_ADDRESS } from "../../helpers";
import { type HttpNetworkUserConfig } from "hardhat/types";

/**
  Example command: cbETH <> WETH in same category, using cbETH/ETH oracle
  
  HARDHAT_NETWORK=base-tenderly npx hardhat tenderly-set-e-mode \
    --oracle 0x806b4ac04501c29769051e42783cf04dce41440b \
    --categoryid 1 \
    --ltv 9000 \
    --liquidationthreshold 9300 \
    --liquidationbonus 10200 \
    --label ETH-emodes \
    --assets 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22,0x4200000000000000000000000000000000000006
**/

task(`tenderly-set-e-mode`, `Setups e-mode category and assets`)
  .addParam("oracle") // oracle address for emode asset category
  .addParam("categoryid") // category for group of emode assets, above 0!
  .addParam("ltv") // in basis points
  .addParam("liquidationthreshold") // in basis points
  .addParam("liquidationbonus") // in basis points
  .addParam("label")
  .addParam("assets") // csv string of `underlying` listed asset addresses
  .setAction(
    async (
      { oracle, categoryid, ltv, liquidationthreshold, liquidationbonus, label, assets }: 
      { 
        oracle: string,
        categoryid: string, 
        ltv: string, 
        liquidationthreshold: string,
        liquidationbonus: string,
        label: string,
        assets: string,
      }, hre
    ) => {
      const seamlessMultisig = MULTISIG_ADDRESS[hre.network.name];
      if (hre.network.name && hre.network.name.toLowerCase() === "base-tenderly") {
        const config = hre.network.config as HttpNetworkUserConfig;

        if (config.url !== undefined) {
          hre.ethers.provider = new hre.ethers.providers.JsonRpcProvider(config.url);
        }

        const seamlessMultisigSigner = await hre.ethers.getSigner(seamlessMultisig);
        console.log("  - Using signer:", await seamlessMultisigSigner.getAddress());

        const poolConfigurator = (await getPoolConfiguratorProxy()).connect(seamlessMultisigSigner);
        console.log("  - Using pool configurator:", poolConfigurator.address);

        await waitForTx(
          await poolConfigurator.setEModeCategory(
            categoryid,
            ltv,
            liquidationthreshold,
            liquidationbonus,
            oracle,
            label
          )
        );

        console.log("- Added E-Mode:");
        console.log("  - Label:", label);
        console.log("  - Id:", categoryid);
        console.log("  - LTV:", ltv);
        console.log("  - LQT:", liquidationthreshold);
        console.log("  - LQB:", liquidationbonus);
        console.log("  - Oracle:", oracle);

        const categoryAssets = assets.split(",");
        for (let assetIndex in categoryAssets) {
          const assetAddress = categoryAssets[assetIndex];
          await waitForTx(
            await poolConfigurator.setAssetEModeCategory(assetAddress, categoryid)
          );
          console.log("  - Added", assetAddress, "asset to E-Mode", label);
        }
      } else {
        console.log("  - Task only for tenderly networks");
      }
    }
  );
