/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { generateConcessionArray, MONTH_30, MONTH_31 } from './quotes-concessions-commons-test';
import { getFixedAmount } from '../../helpers/quotes';
import { DALTypes } from '../../../common/enums/DALTypes';
export const PARKING_INDOOR = 'Parking Indoor';
export const WATER = 'Water';
export const TRASH = 'Trash';
export const SEWER = 'Sewer';
export const GAS = 'Gas';
export const UTILITIES_SECTION = 'utilities';
export const PARKING_SECTION = 'parking';
export const WATER_PRICE = 25;
export const TRASH_PRICE = 20;
export const GAS_PRICE = 25;
export const SEWER_PRICE = 10;
export const PARKING_INDOOR_PRICE = 138;
export const UTILITIES_SUM = WATER_PRICE + TRASH_PRICE + GAS_PRICE + SEWER_PRICE;
export const UTILITIES_SUM_1_DAY_31MONTH =
  getFixedAmount((WATER_PRICE / MONTH_31) * 1, 2) +
  getFixedAmount((TRASH_PRICE / MONTH_31) * 1, 2) +
  getFixedAmount((SEWER_PRICE / MONTH_31) * 1, 2) +
  getFixedAmount((GAS_PRICE / MONTH_31) * 1, 2);
export const UTILITIES_SUM_15_DAYS_30MONTH =
  getFixedAmount((WATER_PRICE / MONTH_30) * 15, 2) +
  getFixedAmount((TRASH_PRICE / MONTH_30) * 15, 2) +
  getFixedAmount((SEWER_PRICE / MONTH_30) * 15, 2) +
  getFixedAmount((GAS_PRICE / MONTH_30) * 15, 2);
export const UTILITIES_SUM_16_DAYS_31MONTH =
  getFixedAmount((WATER_PRICE / MONTH_31) * 16, 2) +
  getFixedAmount((TRASH_PRICE / MONTH_31) * 16, 2) +
  getFixedAmount((SEWER_PRICE / MONTH_31) * 16, 2) +
  getFixedAmount((GAS_PRICE / MONTH_31) * 16, 2);
export const PARKING_INDOOR_15_DAYS_30MONTH = getFixedAmount((PARKING_INDOOR_PRICE / MONTH_30) * 15, 2);

export const generateFee = ({
  id,
  name,
  price,
  selected,
  quoteSectionName = UTILITIES_SECTION,
  concessions,
  quantity = 1,
  servicePeriod = DALTypes.ServicePeriod.MONTH,
  feeType = DALTypes.FeeType.SERVICE,
  quotePaymentScheduleFlag = false,
}) => {
  const concessionsArray = concessions ? generateConcessionArray(concessions) : null;
  const fee = {
    id,
    name,
    amount: price * quantity,
    price,
    selected,
    quoteSectionName,
    quantity,
    concessions: concessionsArray,
    servicePeriod,
    feeType,
    quotePaymentScheduleFlag,
  };
  return fee;
};

export const generateUtilitiesAndParkingFeeWithConcessions = (concessions, quantity) => {
  const quantityIncreased = quantity || 1;
  const fees = [
    generateFee({
      id: 1,
      name: WATER,
      price: WATER_PRICE,
      selected: true,
      concessions: [],
      quotePaymentScheduleFlag: true,
    }),
    generateFee({
      id: 2,
      name: TRASH,
      price: TRASH_PRICE,
      selected: true,
      concessions: [],
      quotePaymentScheduleFlag: true,
    }),
    generateFee({
      id: 3,
      name: GAS,
      price: GAS_PRICE,
      selected: true,
      concessions: [],
      quotePaymentScheduleFlag: true,
    }),
    generateFee({
      id: 4,
      name: SEWER,
      price: SEWER_PRICE,
      selected: true,
      concessions: [],
      quotePaymentScheduleFlag: true,
    }),
    generateFee({
      id: 5,
      name: PARKING_INDOOR,
      price: PARKING_INDOOR_PRICE,
      selected: true,
      concessions,
      quantity: quantityIncreased,
      quotePaymentScheduleFlag: true,
    }),
  ];
  return { fees };
};
