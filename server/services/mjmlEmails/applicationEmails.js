/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { CommunicationContext } from '../../../common/enums/communicationTypes';
import { sendCommunication } from '../communication';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPersonApplication } from '../../../rentapp/server/services/person-application';
import { getApplicationInvoice } from '../../../rentapp/server/services/application-invoices';
import { loadPartyAgent } from '../../dal/partyRepo';
import logger from '../../../common/helpers/logger';
import { getActivePartyMemberByPartyIdAndPersonId } from '../party';
import { TemplateNames } from '../../../common/enums/templateTypes';
import { ServiceError } from '../../common/errors';
import { getTenant } from '../tenantService';

export const sendAccountCompleteRegistrationEmail = async (ctx, emailInfo) => {
  logger.trace({ ctx, emailInfo }, 'send account complete registration email');
  const { templateName, partyId, invoiceId, host } = emailInfo;

  const invoice = await getApplicationInvoice(ctx, { id: invoiceId });
  const { personApplicationId, quoteId, propertyId } = invoice;

  const personApplication = await getPersonApplication(ctx, personApplicationId);
  const personId = personApplication.personId;

  const { settings: tenantSettings, name: tenantName } = await getTenant(ctx);
  const authUser = await loadPartyAgent({ ...ctx, tenantName }, partyId);
  const extendedCtx = { ...ctx, tenantName, tenantSettings, authUser, hostname: host };

  return await sendCommunication(extendedCtx, {
    templateName,
    partyId,
    personIds: [personId],
    templateArgs: { quoteId, propertyId },
    context: CommunicationContext.PREFER_EMAIL,
    communicationCategory: DALTypes.CommunicationCategory.APPLICATION_COMPLETE_REGISTRATION,
    shouldNotNotifyMailSent: true,
  });
};

export const sendApplicationDeclinedMsg = async (ctx, applicationData, emailTemplateName) => {
  logger.trace({ ctx, applicationData, emailTemplateName }, 'send application declined email/sms');
  const { partyId, personIds, sender } = applicationData;

  const { settings: tenantSettings, name: tenantName } = await getTenant(ctx);
  const extendedCtx = { ...ctx, tenantName, tenantSettings, sender };

  return await sendCommunication(extendedCtx, {
    templateName: emailTemplateName,
    partyId,
    personIds,
    context: CommunicationContext.PREFER_EMAIL_AND_SMS,
    communicationCategory: DALTypes.CommunicationCategory.APPLICATION_DECLINED,
  });
};

const getPersonIdsByType = (partyMembers, type) => partyMembers.filter(({ memberType }) => memberType === type).map(({ personId }) => personId);

const sendInvitationsToGuarantors = async (ctx, { guarantorsPersonIds, quoteId, baseData }) => {
  if (!guarantorsPersonIds.length) return null;

  return await sendCommunication(ctx, {
    ...baseData,
    personIds: guarantorsPersonIds,
    context: CommunicationContext.REQUIRE_EMAIL,
    templateName: quoteId ? TemplateNames.RESIDENT_TO_GUARANTOR_QUOTE_TEMPLATE : TemplateNames.RESIDENT_TO_GUARANTOR_APPLICATION_INVITE_TEMPLATE,
  });
};

const sendInvitationsToResidentsAndOccupants = async (ctx, { residentsPersonIds, partyId, quoteId, personApplication, baseData }) => {
  if (!residentsPersonIds.length) return null;

  if (quoteId) {
    const senderPartyMember = await getActivePartyMemberByPartyIdAndPersonId(ctx, partyId, personApplication.personId);
    const templateName =
      senderPartyMember.memberType === DALTypes.MemberType.OCCUPANT
        ? TemplateNames.OCCUPANT_TO_RESIDENT_QUOTE_TEMPLATE
        : TemplateNames.RESIDENT_TO_RESIDENT_QUOTE_TEMPLATE;

    return await sendCommunication(ctx, {
      ...baseData,
      personIds: residentsPersonIds,
      context: CommunicationContext.REQUIRE_EMAIL,
      templateName,
    });
  }

  return await sendCommunication(ctx, {
    ...baseData,
    personIds: residentsPersonIds,
    context: CommunicationContext.PREFER_EMAIL,
    templateName: TemplateNames.RESIDENT_TO_RESIDENT_APPLICATION_INVITE_TEMPLATE,
  });
};

export const sendInvitationsEmails = async (ctx, { partyId, personApplication, quoteId, propertyId, partyMembers }) => {
  const guarantorsPersonIds = getPersonIdsByType(partyMembers, DALTypes.MemberType.GUARANTOR);
  const residentsPersonIds = getPersonIdsByType(partyMembers, DALTypes.MemberType.RESIDENT);

  const { settings: tenantSettings, name: tenantName } = await getTenant(ctx);
  const extendedCtx = { ...ctx, tenantName, tenantSettings, hostname: ctx.host };

  const baseData = {
    partyId,
    templateArgs: { quoteId, personApplicationId: personApplication.id, propertyId },
    communicationCategory: DALTypes.CommunicationCategory.APPLICATION_INVITE,
  };

  await sendInvitationsToGuarantors(extendedCtx, { guarantorsPersonIds, quoteId, baseData });
  await sendInvitationsToResidentsAndOccupants(extendedCtx, { residentsPersonIds, partyId, quoteId, personApplication, baseData });
};

export const sendSelfServiceApplicationEmail = async (ctx, { partyId, personIds = [], propertyId, createdFromCommId }) => {
  logger.trace({ ctx, partyId, personIds }, 'Sending self-service application email');

  if (!partyId || !personIds.length) {
    throw new ServiceError({
      token: 'PRECONDITION_FAILED',
      status: 412,
      data: {
        partyId,
        personIds,
      },
    });
  }

  return await sendCommunication(ctx, {
    partyId,
    templateArgs: { propertyId, createdFromCommId },
    personIds,
    context: CommunicationContext.PREFER_EMAIL_AND_SMS,
    templateName: TemplateNames.SELF_APPLICATION_INVITE_TEMPLATE,
    communicationCategory: DALTypes.CommunicationCategory.APPLICATION_INVITE,
  });
};
