/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getSenderInfo } from '../../helpers/mails';
import { sendCommunication } from '../communication';
import { getCommonUserByPersonIds, createCommonUsersByPersonIds } from '../../../auth/server/services/common-user';
import { getPersonIdsGroupedByTemplateType } from '../../api/actions/resident';
import { overridePersonsWithContactInfo } from '../person';
import logger from '../../../common/helpers/logger';
import { getTenant } from '../tenantService';

const sendCommInvite = async (ctx, { emailInfo, action, personIds, personsOverride }) => {
  const { partyId, propertyId, section, context, communicationCategory } = emailInfo;

  await sendCommunication(ctx, {
    partyId,
    propertyTemplate: {
      propertyId,
      section,
      action,
    },
    personIds,
    personsOverride,
    context,
    communicationCategory,
  });
};

export const sendResidentsInviteEmail = async (ctx, emailInfo) => {
  logger.trace({ ctx, emailInfo }, 'send residents invite email');

  const authUser = await getSenderInfo(ctx, emailInfo);
  const { settings: tenantSettings, name: tenantName } = await getTenant(ctx);
  const extendedCtx = { ...ctx, authUser, tenantSettings, tenantName };

  const commonUsers = await getCommonUserByPersonIds(ctx, emailInfo.personIds);
  const { newRegistrationPersonIds, invitePersonIds, commonUsersToCreate } = getPersonIdsGroupedByTemplateType(emailInfo.personIds, commonUsers);
  commonUsersToCreate.length && (await createCommonUsersByPersonIds(ctx, commonUsersToCreate));

  const overridePersons = await overridePersonsWithContactInfo(ctx, emailInfo.personIds);
  const invitePersonsOverride = overridePersons.filter(({ id }) => invitePersonIds.includes(id));
  const newRegistrationPersonsOverride = overridePersons.filter(({ id }) => newRegistrationPersonIds.includes(id));

  if (newRegistrationPersonIds.length) {
    await sendCommInvite(extendedCtx, {
      emailInfo,
      action: emailInfo.actions.newResidentInvite,
      personIds: newRegistrationPersonIds,
      personsOverride: newRegistrationPersonsOverride,
    });
  }

  if (invitePersonIds.length) {
    await sendCommInvite(extendedCtx, {
      emailInfo,
      action: emailInfo.actions.invite,
      personIds: invitePersonIds,
      personsOverride: invitePersonsOverride,
    });
  }
};
