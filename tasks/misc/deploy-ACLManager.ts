import { task } from "hardhat/config";
import { COMMON_DEPLOY_PARAMS }  from "../../helpers/env";
import {
  ACL_MANAGER_ID,
} from "../../helpers/deploy-ids";

task(
  `deploy-ACLManager`,
  `Deploys the ACLManager contract`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  console.log(`\n- ACLManager deployment`);
  const { deployer } = await hre.getNamedAccounts();
  console.log("deployer: ", deployer);
  const artifact = await hre.deployments.deploy(ACL_MANAGER_ID, {
    from: deployer,
    contract: "ACLManager",
    args: ["0x0E02EB705be325407707662C6f6d3466E939f3a0"],
    ...COMMON_DEPLOY_PARAMS
  });

  console.log("ACLManager deployed at:", artifact.address);
  console.log(`\tFinished ACLManager deployment`);
});
