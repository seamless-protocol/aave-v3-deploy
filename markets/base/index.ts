import { AssetType, eBaseNetwork, IAaveConfiguration, TransferStrategy } from "./../../helpers/types";
import AaveMarket from "../aave";
import {
  strategyUSDC,
  strategyWETH,
} from "./reservesConfigs";
import { ZERO_ADDRESS } from "../../helpers";

export const BaseConfig: IAaveConfiguration = {
  ...AaveMarket,
  ProviderId: 30,
  MarketId: "Base Seamless Market",
  ATokenNamePrefix: "Base",
  StableDebtTokenNamePrefix: "Base",
  VariableDebtTokenNamePrefix: "Base",
  SymbolPrefix: "Base",
  ReservesConfig: {
    //DAI: strategyDAI,
    USDC: strategyUSDC,
    WETH: strategyWETH,
    // CBETH: strategyWETH, // TODO
  },
  ReserveAssets: {
    [eBaseNetwork.main]: {
      // DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      USDC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
      WETH: "0x4200000000000000000000000000000000000006",
      // CBETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    },
    [eBaseNetwork.testnet]: {
      // DAI: ZERO_ADDRESS,
      USDC: ZERO_ADDRESS,
      WETH: ZERO_ADDRESS,
      // CBETH: ZERO_ADDRESS,
    },
  },
  IncentivesConfig: {
    enabled: {
      [eBaseNetwork.testnet]: true,
    },
    rewards: {
      [eBaseNetwork.testnet]: {
        SEAM: "0x980d0cbb2e314c496b808cac88a8a4e8893161e1",
        USDC: ZERO_ADDRESS,
      },
    },
    rewardsOracle: {},
    incentivesInput: {
      [eBaseNetwork.testnet]: [
        {
          emissionPerSecond: "100",
          duration: 7890000,
          asset: "WETH",
          assetType: AssetType.AToken,
          reward: "SEAM",
          rewardOracle: "0",
          transferStrategy: TransferStrategy.PullRewardsStrategy,
          transferStrategyParams: "0",
        }
      ],
    },
  },
  EModes: {
    // StableEMode: {
    //   id: "1",
    //   ltv: "9700",
    //   liquidationThreshold: "9750",
    //   liquidationBonus: "10100",
    //   label: "Stablecoins",
    //   assets: ["USDC", "DAI"],
    // },
  },
  ChainlinkAggregator: {
    [eBaseNetwork.main]: {
      // DAI: "0x591e79239a7d679378eC8c847e5038150364C78F",
      USDC: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B",
      WETH: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
      // CBETH: "0x806b4Ac04501c29769051e42783cF04dCE41440b",
      // TODO: need price feed for SEAM
    },
  },
};

export default BaseConfig;
