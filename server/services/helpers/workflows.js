/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { formatMoment } from '../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';
import { getUserFullNameById } from '../../dal/usersRepo';
import { getTeamById } from '../../dal/teamsRepo';
import { logEntityAdded, logEntityRemoved, logEntity } from '../activityLogService';
import { COMPONENT_TYPES, ACTIVITY_TYPES, SUB_COMPONENT_TYPES } from '../../../common/enums/activityLogTypes';
import { getFullName } from '../importActiveLeases/process-data/helpers';
import { vacateReasonTranslationMapping } from '../../../common/enums/vacateReasons';

const logger = loggerModule.child({ subType: 'workflowHelper' });

export const logActiveLeasePartyCreated = async (ctx, party, options) => {
  logger.trace({ ctx, partyId: party.id, options }, 'log ActiveLeaseParty created');

  const { id, workflowName, state, userId, ownerTeam: ownerTeamId } = party;
  const partyOwnerTeam = ownerTeamId && (await getTeamById(ctx, ownerTeamId));
  const partyOwner = userId && (await getUserFullNameById(ctx, userId));

  const entity = {
    id,
    workflowName,
    state,
    partyOwner,
    ownerTeam: ownerTeamId,
    ownerTeamDisplayName: partyOwnerTeam?.displayName,
    createdByType: DALTypes.CreatedByType.SYSTEM,
  };

  return await logEntityAdded(ctx, { entity, component: COMPONENT_TYPES.PARTY, options });
};

export const logPartyMemberCreated = async (ctx, createdMember) => {
  logger.trace({ ctx, createdMember }, 'log PartyMember created');

  const entity = { ...createdMember, createdByType: DALTypes.CreatedByType.SYSTEM };

  return await logEntityAdded(ctx, { entity, component: COMPONENT_TYPES.GUEST });
};

export const logPartyMemberRemoved = async (ctx, removedMember) => {
  logger.trace({ ctx, removedMember }, 'log PartyMember removed');

  const entity = { ...removedMember, createdByType: DALTypes.CreatedByType.SYSTEM };

  await logEntityRemoved(ctx, entity, COMPONENT_TYPES.GUEST);
};

export const logPartyMemberUpdated = async (ctx, { partyId, emails, phones, existingMember }) => {
  logger.trace({ ctx, partyId, updatedEmail: emails, updatedPhone: phones, existingMember }, 'log PartyMember updated');
  const existingEmails =
    existingMember?.contactInfo?.emails.map(e => {
      if (emails.length) return { ...e, isPrimary: false };
      return { ...e };
    }) || [];
  const existingPhones =
    existingMember?.contactInfo?.phones.map(p => {
      if (phones.length) return { ...p, isPrimary: false };
      return { ...p };
    }) || [];

  const contactInfo = {
    emails: emails.concat(existingEmails),
    phones: phones.concat(existingPhones),
  };

  const entity = { partyId, contactInfo, createdByType: DALTypes.CreatedByType.SYSTEM };

  await logEntity(ctx, { entity, activityType: ACTIVITY_TYPES.UPDATE, component: COMPONENT_TYPES.GUEST });
};

export const logPartyMemberMoved = async (ctx, partyMember) => {
  logger.trace({ ctx, ...partyMember }, 'log PartyMember moved');
  const { receivedResident, to, from, dbMember } = partyMember;
  const fullName = getFullName(receivedResident);

  const hasPreferredName = !!dbMember.preferredName;

  const entity = {
    id: dbMember.partyId,
    name: fullName,
    preferredName: hasPreferredName ? fullName : '',
    to,
    from,
    createdByType: DALTypes.CreatedByType.SYSTEM,
  };

  await logEntity(ctx, { entity, activityType: ACTIVITY_TYPES.UPDATE, component: COMPONENT_TYPES.PARTY, subComponent: SUB_COMPONENT_TYPES.MOVED });
};

export const logMovingOutParty = async (ctx, activeLeaseParty) => {
  logger.trace({ ctx, ...activeLeaseParty }, 'log ActiveLeaseParty movedOut');

  const { id, noticeDate, vacateDate, reason, timezone } = activeLeaseParty;

  const entity = {
    id,
    createdByType: DALTypes.CreatedByType.SYSTEM,
    requestedBy: DALTypes.CreatedByType.SYSTEM,
    dateOfTheNotice: formatMoment(noticeDate, { format: MONTH_DATE_YEAR_FORMAT, timezone }),
    vacateDate: formatMoment(vacateDate, { format: MONTH_DATE_YEAR_FORMAT, timezone }),
    notes: t(vacateReasonTranslationMapping[reason]),
  };

  await logEntity(ctx, { entity, activityType: ACTIVITY_TYPES.MOVEOUT, component: COMPONENT_TYPES.PARTY });
};

export const logCancelMovingOutParty = async (ctx, activeLeaseParty) => {
  logger.trace({ ctx, ...activeLeaseParty }, 'log ActiveLeaseParty cancelMoveOut');

  const entity = { id: activeLeaseParty.id, movingOutStatus: 'Canceled', createdByType: DALTypes.CreatedByType.SYSTEM };

  await logEntity(ctx, { entity, activityType: ACTIVITY_TYPES.MOVEOUT, component: COMPONENT_TYPES.PARTY });
};

export const logLeaseEndDateChanged = async (ctx, activeLeaseData) => {
  logger.trace({ ctx, ...activeLeaseData }, 'log updated lease end date');

  const { partyId, newLeaseEndDate, timezone } = activeLeaseData;

  const entity = {
    id: partyId,
    newLeaseEndDate: formatMoment(newLeaseEndDate, { format: MONTH_DATE_YEAR_FORMAT, timezone }),
    createdByType: DALTypes.CreatedByType.SYSTEM,
  };

  await logEntity(ctx, { entity, activityType: ACTIVITY_TYPES.UPDATE, component: COMPONENT_TYPES.PARTY });
};
