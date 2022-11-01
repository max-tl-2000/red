/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getLeaseById, getLeaseSignatureStatuses } from '../../dal/leaseRepo';
import { getQuoteById } from '../quotes';
import { getSenderInfo } from '../../helpers/mails';
import { loadPartyMemberByIds } from '../../dal/partyRepo';
import { sendCommunication } from '../communication';
import { CommunicationContext } from '../../../common/enums/communicationTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import logger from '../../../common/helpers/logger';
import { getTenant } from '../tenantService';

export const sendSignLeaseMail = async (ctx, emailInfo) => {
  logger.trace({ ctx, emailInfo }, 'send sign lease email');

  const { partyId, emailTemplateNames, leaseId, partyMemberIds, messageType } = emailInfo;
  const templateName = emailTemplateNames.contractSentTemplateName;
  const partyMembers = await loadPartyMemberByIds(ctx, partyMemberIds);
  const personIds = partyMembers.map(({ personId }) => personId);

  const { quoteId } = await getLeaseById(ctx, leaseId);
  const { inventoryId } = await getQuoteById(ctx, quoteId);

  const sender = await getSenderInfo(ctx, emailInfo);
  const { settings: tenantSettings, name: tenantName } = await getTenant(ctx);
  const extendedCtx = { ...ctx, sender, tenantSettings, tenantName };

  return await sendCommunication(extendedCtx, {
    templateName,
    partyId,
    personIds,
    templateArgs: {
      inventoryId,
      leaseId,
    },
    messageType,
    context: CommunicationContext.REQUIRE_EMAIL,
    communicationCategory: DALTypes.CommunicationCategory.LEASE,
  });
};

export const sendVoidedLeaseMail = async (ctx, emailInfo) => {
  logger.trace({ ctx, emailInfo }, 'send void lease email');

  const { partyId, emailTemplateNames, leaseId, to, messageType } = emailInfo;
  const templateName = emailTemplateNames.contractVoidedTemplateName;

  const { quoteId } = await getLeaseById(ctx, leaseId);
  const { inventoryId } = await getQuoteById(ctx, quoteId);

  const partyMembers = await loadPartyMemberByIds(ctx, to);
  const personIds = partyMembers.map(({ personId }) => personId);

  const authUser = await getSenderInfo(ctx, emailInfo);
  const { settings: tenantSettings, name: tenantName } = await getTenant(ctx);
  const extendedCtx = { ...ctx, authUser, tenantSettings, tenantName };

  return await sendCommunication(extendedCtx, {
    templateName,
    partyId,
    personIds,
    templateArgs: {
      inventoryId,
    },
    messageType,
    context: CommunicationContext.REQUIRE_EMAIL,
    communicationCategory: DALTypes.CommunicationCategory.LEASE,
  });
};

export const sendExecutedLeaseMail = async (ctx, emailInfo) => {
  logger.trace({ ctx, emailInfo }, 'send executed lease email');

  const { partyId, emailTemplateNames, leaseId, messageType } = emailInfo;
  const templateName = emailTemplateNames.contractExecutedTemplateName;

  // We only send the executed emails to digitally signed contracts (SIGNED and not WET_SIGNED)
  const leaseSignatures = (await getLeaseSignatureStatuses(ctx, leaseId)).filter(s => s.partyMemberId && s.status === DALTypes.LeaseSignatureStatus.SIGNED);
  const partyMemberIds = leaseSignatures.map(signature => signature.partyMemberId);
  const partyMembers = await loadPartyMemberByIds(ctx, partyMemberIds);
  const membersWithEmail = partyMembers.filter(pm => !!pm.contactInfo.defaultEmail);
  const personIds = membersWithEmail.map(({ personId }) => personId);

  const { quoteId } = await getLeaseById(ctx, leaseId);
  const { inventoryId } = await getQuoteById(ctx, quoteId);

  const authUser = await getSenderInfo(ctx, emailInfo);
  const { settings: tenantSettings, name: tenantName } = await getTenant(ctx);
  const extendedCtx = { ...ctx, authUser, tenantSettings, tenantName };

  return await sendCommunication(extendedCtx, {
    templateName,
    partyId,
    personIds,
    templateArgs: {
      inventoryId,
      leaseId,
    },
    messageType,
    context: CommunicationContext.REQUIRE_EMAIL,
    communicationCategory: DALTypes.CommunicationCategory.LEASE,
  });
};
