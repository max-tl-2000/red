/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatten from 'lodash/flatten';
import difference from 'lodash/difference';
import { DALTypes } from '../../../../common/enums/DALTypes';
import logger from '../../../../common/helpers/logger';
import * as appSettings from '../../../services/appSettings';

const getEmailTemplateNamesForPersonApplicationInvites = async ctx => {
  logger.trace({ ctx }, 'getEmailTemplatesForPersonApplicationInviteEmail');
  const personAppInviteEmailTemplateSettingNames = Object.values(DALTypes.PersonApplicationInviteEmailTemplateSettings);
  const templateSettings = await appSettings.getMultipleAppSettingsByName(ctx, personAppInviteEmailTemplateSettingNames);
  const getAppSettingValue = settingName => (templateSettings.find(s => s.key === settingName) || {}).value;
  return {
    residentToGuarantorAppInviteTemplateName: getAppSettingValue(DALTypes.PersonApplicationInviteEmailTemplateSettings.ResidentToGuarantorApplicationInvite),
    residentToResidentAppInviteTemplateName: getAppSettingValue(DALTypes.PersonApplicationInviteEmailTemplateSettings.ResidentToResidentApplicationInvite),
    occupantToResidentAppInviteTemplateName: getAppSettingValue(DALTypes.PersonApplicationInviteEmailTemplateSettings.OccupantToResidentApplicationInvite),
  };
};

const getPartyMembersToExcludeByType = (party, { newPartyMembersIds, senderPersonId, newMembersTypeToExclude, senderType }) => {
  const senderPartyMember = party.members.find(({ partyMember }) => partyMember.personId === senderPersonId);
  const newPartyMembersByType = party.members.filter(
    ({ partyMember }) => newPartyMembersIds.includes(partyMember.id) && partyMember.memberType === newMembersTypeToExclude,
  );

  return senderPartyMember.partyMember.memberType === senderType ? newPartyMembersByType.map(member => member.partyMember.id) : [];
};

export const processPersonApplicationInviteEmail = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'process received person application invite event');

  const personApplicationInviteEvent = party.events.find(ev => [DALTypes.PartyEventType.PERSON_TO_PERSON_APPLICATION_INVITE].includes(ev.event));
  if (!personApplicationInviteEvent) return {};

  const { newMembersIds, personId, quoteId } = personApplicationInviteEvent.metadata;
  if (!newMembersIds.length || !personId) return {};

  const isRequestFromQuote = !!quoteId;

  const memberIdsToExcludeFromComm = [];
  const excludePartyMembers = async (templateName, senderType, newMembersTypeToExclude) => {
    const emailTemplateEnabled = await appSettings.getAppSettingValue(ctx, templateName);
    if (emailTemplateEnabled !== 'true' && isRequestFromQuote) {
      logger.trace({ ctx }, `${templateName} disabled from AppSettings`);
      memberIdsToExcludeFromComm.push(
        getPartyMembersToExcludeByType(party, {
          senderPersonId: personId,
          newPartyMembersIds: newMembersIds,
          senderType,
          newMembersTypeToExclude,
        }),
      );
    }
  };

  await excludePartyMembers('SendResidentToGuarantorApplicationInviteEmail', DALTypes.MemberType.RESIDENT, DALTypes.MemberType.GUARANTOR);
  await excludePartyMembers('SendResidentToResidentApplicationInviteEmail', DALTypes.MemberType.RESIDENT, DALTypes.MemberType.RESIDENT);
  await excludePartyMembers('SendOccupantToResidentApplicationInviteEmail', DALTypes.MemberType.OCCUPANT, DALTypes.MemberType.RESIDENT);

  const memberIdsToSendCommunication = difference(newMembersIds, flatten(memberIdsToExcludeFromComm));
  if (!memberIdsToSendCommunication.length) return {};

  const templateNames = await getEmailTemplateNamesForPersonApplicationInvites(ctx);
  return {
    emailInfo: {
      party: {
        id: party.id,
        userId: party.userId,
      },
      type: personApplicationInviteEvent.event,
      ...personApplicationInviteEvent.metadata,
      quoteId,
      newMembersIds: memberIdsToSendCommunication,
      templateNames,
    },
  };
};
