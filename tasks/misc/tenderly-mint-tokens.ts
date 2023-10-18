import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/utilities/tx";
import { getPoolConfiguratorProxy } from "../../helpers/contract-getters";
import { MULTISIG_ADDRESS } from "../../helpers";
import { type HttpNetworkUserConfig } from "hardhat/types";

/**
  HARDHAT_NETWORK=base npx hardhat tenderly-mint-token \
    --admin 0x4200000000000000000000000000000000000010 \
    --token 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22 \
    --recipient 0x0 \
    --amount 100000000000000000000000
**/

task(`tenderly-mint-token`)
  .addParam("admin") // address of admin or bridge
  .addParam("token") // address of token
  .addParam("recipient") // address of recipient
  .addParam("amount") // amount to mint
  .setAction(
    async (
      { admin, token, recipient, amount }: 
      { 
        admin: string,
        token: string, 
        recipient: string, 
        amount: string, 
      }, hre
    ) => {
      if (hre.network.name && hre.network.name.toLowerCase() === "base") {
        const config = hre.network.config as HttpNetworkUserConfig;

        if (config.url !== undefined) {
          hre.ethers.provider = new hre.ethers.providers.JsonRpcProvider(config.url);
        }

        const Minter = await ethers.getContractAt(["function mint(address _to, uint256 _amount)"], token);
        const adminSigner = await hre.ethers.getSigner(admin);
        console.log("  - Using signer:", await adminSigner.getAddress());
        await waitForTx(await Minter.connect(adminSigner).mint(recipient, amount));
      } else {
        console.log("  - Task only for base tenderly forks");
      }
    }
  );
