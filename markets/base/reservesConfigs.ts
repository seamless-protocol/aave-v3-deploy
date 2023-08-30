import { eContractid, IReserveParams } from "../../helpers/types";

import {
  rateStrategyVolatileOne,
  rateStrategyStableOne,
} from "./rateStrategies";

export const strategyUSDbC: IReserveParams = {
  strategy: rateStrategyStableOne,
  baseLTVAsCollateral: "7700",
  liquidationThreshold: "8000",
  liquidationBonus: "10500",
  liquidationProtocolFee: "0",
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  flashLoanEnabled: false,
  reserveDecimals: "6",
  aTokenImpl: eContractid.AToken,
  reserveFactor: "0",
  supplyCap: "0",
  borrowCap: "6500000",
  debtCeiling: "0",
  borrowableIsolation: false,
};

export const strategyWETH: IReserveParams = {
  strategy: rateStrategyVolatileOne,
  baseLTVAsCollateral: "7500",
  liquidationThreshold: "8000",
  liquidationBonus: "10500",
  liquidationProtocolFee: "0",
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  flashLoanEnabled: false,
  reserveDecimals: "18",
  aTokenImpl: eContractid.AToken,
  reserveFactor: "0",
  supplyCap: "0",
  borrowCap: "4000",
  debtCeiling: "0", 
  borrowableIsolation: false,
};
