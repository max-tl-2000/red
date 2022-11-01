/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { VIEW_MODEL_TYPES } from './enums';
import { getRenewalRentMatrixQuery } from '../../dal/rmsPricingRepo';
import { updateTermWithMatrixRents } from '../../../common/helpers/quotes';
import { formatMoney, Currency } from '../../../common/money-formatter';
import nullish from '../../../common/helpers/nullish';
import { toMoment } from '../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_LONG_FORMAT } from '../../../common/date-constants';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = (ctx, { quoteId, inventoryId, partyId }) => getRenewalRentMatrixQuery(ctx, { quoteId, inventoryId, partyId }).toString();

const findLowestRentTermInRentMatrix = rentMatrix =>
  Object.keys(rentMatrix).reduce(
    (acc, termLength) => {
      const leaseTerm = rentMatrix[termLength];

      Object.keys(leaseTerm).forEach(startDate => {
        const currentRent = parseFloat(leaseTerm[startDate].rent);
        if (acc.lowestRent === null || currentRent <= acc.lowestRent) {
          acc.lowestRent = currentRent;
          acc.lowestRentTerm = termLength;
        }
      });
      return acc;
    },
    { lowestRent: null, lowestRentTerm: null },
  );

export const prerequisites = ({ rentMatrix, frozenRentMatrix, leaseStartDate, activeLeaseEndDate }, { timezone }) => {
  const finalRentMatrix = frozenRentMatrix || rentMatrix;
  const renewalStartDate = activeLeaseEndDate && toMoment(activeLeaseEndDate, { timezone }).add(1, 'days');
  const startDate = leaseStartDate || renewalStartDate;

  const rollOverPeriodAmount = (updateTermWithMatrixRents({ termLength: '1' }, startDate, finalRentMatrix, timezone) || {}).adjustedMarketRent;

  const { lowestRent: bestBaseRentAmount, lowestRentTerm: bestBaseRentTerm } = findLowestRentTermInRentMatrix(finalRentMatrix);

  return { rollOverPeriodAmount, bestBaseRentAmount, bestBaseRentTerm, renewalStartDate: toMoment(startDate, { timezone }) };
};

export const tokensMapping = {
  startDate: ({ renewalStartDate }) => renewalStartDate.format(MONTH_DATE_YEAR_LONG_FORMAT),
  'rollOverPeriod.leaseTerm': () => 'month-to-month',
  'rollOverPeriod.baseRent': ({ rollOverPeriodAmount }) => {
    if (nullish(rollOverPeriodAmount)) return rollOverPeriodAmount;

    const { result: amountFormatted } = formatMoney({ amount: rollOverPeriodAmount, currency: Currency.USD.code });
    return amountFormatted;
  },
  'baseRent.best': ({ bestBaseRentAmount }) => {
    if (nullish(bestBaseRentAmount)) return bestBaseRentAmount;

    const { result: amountFormatted } = formatMoney({ amount: bestBaseRentAmount, currency: Currency.USD.code });
    return amountFormatted;
  },
  'leaseTerm.best': ({ bestBaseRentAmount, bestBaseRentTerm }) => {
    if (nullish(bestBaseRentAmount)) return null;

    return bestBaseRentTerm;
  },
};
