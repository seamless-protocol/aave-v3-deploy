import { AssetType, eBaseNetwork, IAaveConfiguration, TransferStrategy } from "./../../helpers/types";
import AaveMarket from "../aave";
import {
  strategyUSDbC,
  strategyWETH,
} from "./reservesConfigs";
import {
  rateStrategyVolatileOne,
  rateStrategyStableOne,
} from "./rateStrategies";
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
    USDBC: strategyUSDbC,
    WETH: strategyWETH,
  },
  ReserveAssets: {
    [eBaseNetwork.main]: {
      USDBC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
      WETH: "0x4200000000000000000000000000000000000006",
    },
    [eBaseNetwork.testnet]: {
      USDBC: ZERO_ADDRESS,
      WETH: ZERO_ADDRESS,
    },
  },
  IncentivesConfig: {
    enabled: {
      [eBaseNetwork.main]: true,
      [eBaseNetwork.testnet]: true,
    },
    rewards: {
      [eBaseNetwork.main]: {
        SEAM: "", // TODO
      },
      [eBaseNetwork.testnet]: {
        SEAM: "0x980d0cbb2e314c496b808cac88a8a4e8893161e1",
        USDBC: ZERO_ADDRESS,
      },
    },
    rewardsOracle: {},
    incentivesInput: {
      [eBaseNetwork.main]: [
        {
          emissionPerSecond: "240000000000000000",
          duration: 2592000,
          asset: "WETH",
          assetType: AssetType.VariableDebtToken,
          reward: "SEAM",
          rewardOracle: "0",
          transferStrategy: TransferStrategy.PullRewardsStrategy,
          transferStrategyParams: "0",
        },
        {
          emissionPerSecond: "240000000000000000",
          duration: 2592000,
          asset: "USDBC",
          assetType: AssetType.VariableDebtToken,
          reward: "SEAM",
          rewardOracle: "0",
          transferStrategy: TransferStrategy.PullRewardsStrategy,
          transferStrategyParams: "0",
        }
      ],
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
  EModes: {},
  ChainlinkAggregator: {
    [eBaseNetwork.main]: {
      USDBC: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B",
      WETH: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    },
  },
  RateStrategies: {
    rateStrategyVolatileOne,
    rateStrategyStableOne,
  },
};

export default BaseConfig;
