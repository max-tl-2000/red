/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import logger from '../../../common/helpers/logger';
import * as appSettings from '../../services/appSettings';

const getEmailTemplateNamesForLeases = async ctx => {
  logger.trace({ ctx }, 'getEmailTemplateForLeaseEmail');
  const contractEmailTemplateSettingNames = Object.values(DALTypes.ContractEmailTemplateSettings);
  const templateSettings = await appSettings.getMultipleAppSettingsByName(ctx, contractEmailTemplateSettingNames);
  const getAppSettingValue = settingName => (templateSettings.find(s => s.key === settingName) || {}).value;
  return {
    contractSentTemplateName: getAppSettingValue(DALTypes.ContractEmailTemplateSettings.ContractSent),
    contractVoidedTemplateName: getAppSettingValue(DALTypes.ContractEmailTemplateSettings.ContractVoided),
    contractExecutedTemplateName: getAppSettingValue(DALTypes.ContractEmailTemplateSettings.ContractExecuted),
  };
};

const doesLeaseHaveWetSignedEnvelope = (members, signatures) => {
  const activeResidents = members.filter(({ partyMember }) => partyMember.memberType === DALTypes.MemberType.RESIDENT && !partyMember.endDate);
  const partyMemberIds = activeResidents.map(({ partyMember }) => partyMember.id);

  return signatures.some(signature => partyMemberIds.includes(signature.partyMemberId) && signature.status === DALTypes.LeaseSignatureStatus.WET_SIGNED);
};

export const processLeaseEmail = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'process lease events');
  const leaseEvent = party.events.find(ev =>
    [
      DALTypes.PartyEventType.LEASE_VOIDED,
      DALTypes.PartyEventType.LEASE_VERSION_CREATED,
      DALTypes.PartyEventType.LEASE_EXECUTED,
      DALTypes.PartyEventType.LEASE_SENT,
    ].includes(ev.event),
  );
  if (!leaseEvent) return {};

  if (
    [DALTypes.PartyEventType.LEASE_VOIDED, DALTypes.PartyEventType.LEASE_VERSION_CREATED].includes(leaseEvent.event) &&
    !(leaseEvent.metadata.sentToOrSignedBy?.length > 0)
  ) {
    logger.warn({ ctx, partyId: party.id, event: leaseEvent.event, leaseId: leaseEvent.metadata.leaseId }, 'Empty recipients list found. Skip email sending');
    return {};
  }

  const sendLeaseVoidedEmailEnabled = await appSettings.getAppSettingValue(ctx, 'SendLeaseVoidedEmail');
  if (
    [DALTypes.PartyEventType.LEASE_VOIDED, DALTypes.PartyEventType.LEASE_VERSION_CREATED].includes(leaseEvent.event) &&
    sendLeaseVoidedEmailEnabled !== 'true'
  ) {
    return {};
  }

  const sendLeaseExecutedEmailEnabled = await appSettings.getAppSettingValue(ctx, 'SendLeaseExecutedEmail');
  if (leaseEvent.event === DALTypes.PartyEventType.LEASE_EXECUTED && sendLeaseExecutedEmailEnabled !== 'true') return {};

  const sendLeaseSentEmailEnabled = await appSettings.getAppSettingValue(ctx, 'SendLeaseSentEmail');
  if (leaseEvent.event === DALTypes.PartyEventType.LEASE_SENT && sendLeaseSentEmailEnabled !== 'true') return {};

  const lease = party.leases.find(l => l.id === leaseEvent.metadata.leaseId);

  if (
    [DALTypes.PartyEventType.LEASE_EXECUTED, DALTypes.PartyEventType.LEASE_SENT].includes(leaseEvent.event) &&
    doesLeaseHaveWetSignedEnvelope(party.members, lease.signatures)
  ) {
    return {};
  }

  const emailTemplateNames = await getEmailTemplateNamesForLeases(ctx);
  return {
    emailInfo: {
      senderId: leaseEvent.userId,
      partyId: lease.partyId,
      leaseId: lease.id,
      partyMemberIds: leaseEvent.metadata.partyMemberIds,
      type: leaseEvent.event,
      to: leaseEvent.metadata.sentToOrSignedBy,
      emailTemplateNames,
    },
  };
};
