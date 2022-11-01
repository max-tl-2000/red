/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { getTenantData, updateTenantPhoneNumbers } from '../../dal/tenantsRepo';
import { getInactivePrograms } from '../../dal/programsRepo';
import { PhoneOwnerType } from '../../../common/enums/enums.js';

const logger = loggerModule.child({ subType: 'detachProgramPhoneNumbersHandler' });

export const detachProgramPhoneNumbers = async payload => {
  const { msgCtx, tenantId } = payload;
  const ctx = { tenantId, ...msgCtx };
  logger.time({ ctx }, 'Recurring Jobs - detachProgramPhoneNumbers duration');

  let processed;

  try {
    const dbInactivePrograms = await getInactivePrograms(ctx);

    if (dbInactivePrograms.length > 0) {
      const tenant = await getTenantData(ctx);
      const tenantPhoneNumbers = tenant.metadata.phoneNumbers;

      const allUsedProgramPhoneNumbers = tenantPhoneNumbers.filter(p => p.isUsed && p.ownerType === PhoneOwnerType.PROGRAM);
      const newProgramPhoneNumbersToDetach = dbInactivePrograms.filter(p => allUsedProgramPhoneNumbers.some(apn => apn.ownerId === p.id));

      logger.trace(
        { ctx },
        newProgramPhoneNumbersToDetach.map(p => ({ programName: p.name, phoneNumber: p.directPhoneIdentifier })),
        'detaching phone numbers for programs',
      );
      const updatedTenantPhoneNumbers = tenantPhoneNumbers.map(p =>
        newProgramPhoneNumbersToDetach.some(pd => pd.directPhoneIdentifier === p.phoneNumber) ? { phoneNumber: p.phoneNumber } : p,
      );
      await updateTenantPhoneNumbers(ctx, tenant, updatedTenantPhoneNumbers);
    }
    processed = true;
    logger.trace({ ctx }, 'detachProgramPhoneNumbers - done');
  } catch (error) {
    logger.error({ ctx, error }, 'detachProgramPhoneNumbers - error');
    processed = false;
  }

  logger.timeEnd({ ctx }, 'Recurring Jobs - detachProgramPhoneNumbers duration');

  return { processed };
};
