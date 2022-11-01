/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import * as dal from '../../dal/person-application-repo';
import { getPartyApplicationByPartyId, createPartyApplication } from '../../dal/party-application-repo';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'personApplicationService' });

// TODO: all these methods should go inside the person-Application service.
// This file was created to fix circular dependencies, but we only extracted required functions in another file. So it was not the proper fix.

export const existsPersonApplication = async (ctx, personId, partyId) => await dal.existsPersonApplication(ctx, personId, partyId);

const preparePersonApplicationForCopy = async (ctx, personApplication, partyId) => {
  let partyApplication = await getPartyApplicationByPartyId(ctx, partyId);
  if (!partyApplication) {
    partyApplication = await createPartyApplication(ctx, { partyId });
  }

  const { id, applicantId, ...restProperties } = personApplication;
  return {
    ...restProperties,
    partyId,
    partyApplicationId: partyApplication.id,
    applicantId: newId(),
    id: personApplication.id,
  };
};

export const createPersonApplication = async (ctx, personApplication, partyId, maskSSN) => {
  const personApplicationToSave = await preparePersonApplicationForCopy(ctx, personApplication, partyId);
  return await dal.createPersonApplication(ctx, personApplicationToSave, {}, maskSSN);
};

export const copyPersonApplication = async (ctx, personApplication, partyId) => {
  const personApplicationToCopy = await preparePersonApplicationForCopy(ctx, personApplication, partyId);
  logger.trace(
    {
      ctx,
      personId: personApplication.personId,
      partyId: personApplication.partyId,
      id: personApplication.id,
      targetPartyId: partyId,
    },
    'copyPersonApplication',
  );
  const personApplicationCopied = await dal.copyPersonApplication(ctx, personApplicationToCopy);
  logger.trace({ ctx, personApplicationId: personApplication.id, newPersonApplicationId: personApplicationCopied.id }, 'copyPersonApplication result');
  return personApplicationCopied;
};

export const transformDALToApplicationsData = (applications, maskSsn) => dal.transformDALToApplicationsData(applications, maskSsn);
