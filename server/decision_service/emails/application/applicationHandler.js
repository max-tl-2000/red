/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import logger from '../../../../common/helpers/logger';
import { getPropertySettings } from '../../../dal/propertyRepo';
import { getCommsTemplateByPropertyIdAndTemplateSetting } from '../../../dal/commsTemplateRepo';
import { TemplateSections, TemplateActions } from '../../../../common/enums/templateTypes';

const defaultResponse = {};

export const processApplicationEmail = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id, propertyId: party.assignedPropertyId }, 'process application events');

  const applicationEvent = party.events.find(ev => [DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED].includes(ev.event));
  if (!applicationEvent) return defaultResponse;

  const { applicationStatus, skipEmail } = applicationEvent.metadata;
  if (applicationStatus !== DALTypes.PromotionStatus.CANCELED || skipEmail) return defaultResponse;

  const propertySettings = await getPropertySettings(ctx, party.assignedPropertyId);
  if (!propertySettings?.applicationReview?.sendAALetterOnDecline) {
    logger.trace({ ctx }, 'sendApplicationDeclinedEmail disabled from propertySettings');
    return defaultResponse;
  }

  const template = await getCommsTemplateByPropertyIdAndTemplateSetting(ctx, party.assignedPropertyId, {
    section: TemplateSections.SCREENING,
    action: TemplateActions.DECLINE_AA_LETTER,
  });

  const { promoterUserId: senderId } = applicationEvent.metadata;

  const activeMembers = party.members.filter(({ partyMember }) => !partyMember.endDate);

  return {
    emailInfo: {
      partyId: party.id,
      personIds: activeMembers.map(({ partyMember }) => partyMember.personId),
      type: applicationEvent.event,
      senderId,
      templateName: template?.name,
    },
  };
};
