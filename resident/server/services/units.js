/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getLeaseInfoForPerson } from '../dal/lease-repo';
import loggerInstance from '../../../common/helpers/logger';
import { getResidentState } from '../helpers/resident';
import { getPaymentProvider } from '../helpers/paymentHelpers';
import { getAptexxSettingsByPropertyId } from '../dal/property-repo';

const logger = loggerInstance.child({ subType: 'Resident - PaymentService' });

let getGetLeaseInfoForPersonFunc = getLeaseInfoForPerson;

const getGetLeaseInfoForPersonFunction = () => getGetLeaseInfoForPersonFunc;

export const setGetLeaseInfoForPersonFunction = func => {
  getGetLeaseInfoForPersonFunc = func;
};

export const getUnitsInfo = async (ctx, { propertyId, personId, commonUserId, testDataUnits }) => {
  logger.trace({ ctx, personId, commonUserId, propertyId }, 'getUnitsInfo started');

  const leaseInfoList = await getGetLeaseInfoForPersonFunction()(ctx, personId, propertyId);
  const { propertyId: aptexxAccountId } = await getAptexxSettingsByPropertyId(ctx, propertyId);
  const paymentProvider = await getPaymentProvider(ctx, testDataUnits);
  const leaseInfoListWithIntegration = await Promise.all(
    leaseInfoList.map(async leaseInfo => {
      let { aptexxData } = leaseInfo;
      if (!aptexxData) {
        aptexxData = await paymentProvider.getStoredAptexxData(ctx, leaseInfo, aptexxAccountId, true);
      }
      return { ...leaseInfo, aptexxData };
    }),
  );

  const units = leaseInfoListWithIntegration.map(leaseInfo => {
    const { inventoryId: id, partyState, partyWorkflowState, personExternalId, ...rest } = leaseInfo;
    const residentState = getResidentState({ partyWorkflowState, partyState });

    return { id, residentState, personExternalId, ...rest };
  });

  logger.trace({ ctx, personId, commonUserId, propertyId, units }, 'getUnitsInfo result');
  return units;
};
