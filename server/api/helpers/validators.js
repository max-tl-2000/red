/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../common/errors';
import { isUuid as utilsIsUuid } from '../../common/utils';
import { isValidPhoneNumber } from '../../helpers/phoneUtils';
import { validatePrimaryEmail } from '../../services/person';
import { loadPartyById } from '../../services/party';
import { exists } from '../../database/factory';
import { toMoment, isValidTimezone, DATE_ISO_FORMAT, parseAsInTimezone, stringRepresentsADateWithoutTime } from '../../../common/helpers/moment-utils';
import { admin } from '../../common/schemaConstants';
import { getTenantData } from '../../dal/tenantsRepo';
import { getTeamsByNames } from '../../dal/teamsRepo';
import { getPartyLeases } from '../../dal/leaseRepo';
import { loadProgramForIncomingCommByEmail, loadProgramByMarketingSessionId } from '../../dal/programsRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { looksLikeAPhoneNumber } from '../../../common/helpers/phone-utils';

const throwIfNot = validator => (...args) => {
  const errorToken = args.pop();
  if (!validator(...args)) throw new ServiceError({ token: errorToken, status: 400 });
};

export const defined = throwIfNot(value => !!value);

const isValidDateTime = d => {
  try {
    return toMoment(d).isValid();
  } catch (err) {
    return false;
  }
};
const isValidDate = d => stringRepresentsADateWithoutTime(d) && parseAsInTimezone(d, { format: DATE_ISO_FORMAT, timezone: 'utc' }).isValid();

export const date = throwIfNot(({ year, month, day }) => !Number.isNaN(Date.parse(`${year}/${month}/${day}`)));
export const validDate = throwIfNot(isValidDate);
export const validDateTime = throwIfNot(isValidDateTime);
export const validDateOrDateTime = throwIfNot(d => isValidDateTime(d) || isValidDate(d));
export const validTimezone = throwIfNot(tz => isValidTimezone(tz));

export const validCalendarSlotDuration = throwIfNot(duration => {
  const parsedDuration = parseInt(duration, 10);
  const validSlotDurations = [30, 60, 90, 120];

  return parsedDuration && validSlotDurations.includes(parsedDuration);
});

export const phoneNumbers = throwIfNot(contactInfo => !contactInfo || contactInfo.phones.every(({ value }) => isValidPhoneNumber(value)));
export const lookslikeANumber = throwIfNot(contactInfo => !contactInfo || contactInfo.phones.every(({ value }) => looksLikeAPhoneNumber(value)));

export const validTenant = throwIfNot(async tenantId => !!(await getTenantData({ tenantId: admin.id }, tenantId)));

export const validTenantWithCtx = throwIfNot(async (ctx, tenantId) => !!(await getTenantData(ctx, tenantId)));

export const validTeamName = throwIfNot(async (ctx, teamName) => !!(await getTeamsByNames(ctx, [teamName])).length);

export const isUuid = id => utilsIsUuid(id);

export const uuid = throwIfNot(isUuid);

export const array = throwIfNot(arg => Array.isArray(arg) && arg.length);

export const validateEnum = throwIfNot((enums, value) => {
  enums = Array.isArray(enums) ? enums : Object.values(enums);
  return enums.includes(value);
});

export const team = async (ctx, id) => {
  uuid(id, 'INCORRECT_TEAM_ID');

  if (ctx.tenantId && !(await exists(ctx.tenantId, 'Teams', id))) {
    throw new ServiceError({ token: 'TEAM_NOT_FOUND', status: 404 });
  }
};

export const party = async (ctx, id) => {
  uuid(id, 'INCORRECT_PARTY_ID');

  if (ctx.tenantId && !(await exists(ctx, 'Party', id))) {
    throw new ServiceError({ token: 'PARTY_NOT_FOUND', status: 404 });
  }
};

export const partyGroupId = async (ctx, pGroupId) => {
  uuid(pGroupId, 'INCORRECT_PARTY_GROUP_ID');

  if (ctx.tenantId && !(await exists(ctx.tenantId, 'Party', pGroupId, 'partyGroupId'))) {
    throw new ServiceError({ token: 'PARTY_NOT_FOUND', status: 404 });
  }
};

export const person = async (ctx, personId) => {
  uuid(personId, 'INCORRECT_PERSON_ID');

  if (!(await exists(ctx.tenantId, 'Person', personId))) {
    throw new ServiceError({ token: 'PERSON_NOT_FOUND', status: 404 });
  }
};

export const property = async (ctx, propertyId) => {
  uuid(propertyId, 'INCORRECT_PROPERTY_ID');

  if (!(await exists(ctx.tenantId, 'Property', propertyId))) {
    throw new ServiceError({ token: 'PROPERTY_NOT_FOUND', status: 404 });
  }
};

export const marketingLayoutGroup = async (ctx, id) => {
  uuid(id, 'INCORRECT_MARKETING_LAYOUT_GROUP_ID');

  if (!(await exists(ctx.tenantId, 'MarketingLayoutGroup', id))) {
    throw new ServiceError({ token: 'MARKETING_LAYOUT_GROUP_NOT_FOUND', status: 404 });
  }
};

export const inventory = async (ctx, id) => {
  uuid(id, 'INCORRECT_INVENTORY_ID');

  if (!(await exists(ctx, 'Inventory', id))) {
    throw new ServiceError({ token: 'INVENTORY_NOT_FOUND', status: 404 });
  }
};

export const inventoryGroup = async (ctx, id) => {
  uuid(id, 'INCORRECT_INVENTORY_GROUP_ID');

  if (!(await exists(ctx.tenantId, 'InventoryGroup', id))) {
    throw new ServiceError({ token: 'INVENTORY_GROUP_NOT_FOUND', status: 404 });
  }
};

export const partyMember = async (ctx, partyMemberId) => {
  uuid(partyMemberId, 'INCORRECT_PARTY_MEMBER_ID');

  if (!(await exists(ctx.tenantId, 'PartyMember', partyMemberId))) {
    throw new ServiceError({ token: 'PARTY_MEMBER_NOT_FOUND', status: 404 });
  }
};

export const partyAdditionalInfo = async (ctx, additionalInfoId) => {
  uuid(additionalInfoId, 'INCORRECT_PARTY_ADDITIONALINFO_ID');

  if (!(await exists(ctx.tenantId, 'Party_AdditionalInfo', additionalInfoId))) {
    throw new ServiceError({ token: 'PARTY_ADDITIONALINFO_NOT_FOUND', status: 404 });
  }
};

export const partyQuotePromotion = async (ctx, quotePromotionId) => {
  uuid(quotePromotionId, 'INCORRECT_PARTY_QUOTE_PROMOTION_ID');

  if (!(await exists(ctx.tenantId, 'PartyQuotePromotions', quotePromotionId))) {
    throw new ServiceError({ token: 'PARTY_QUOTE_PROMOTION_NOT_FOUND', status: 404 });
  }
};

export const primaryEmail = async (ctx, { personId, contactInfo }) => {
  const { defaultEmail = '' } = contactInfo || {};
  await validatePrimaryEmail(ctx, personId, defaultEmail);
};

export const mergePartySession = async (ctx, sessionId) => {
  uuid(sessionId, 'INCORRECT_SESSION_ID');

  if (!(await exists(ctx.tenantId, 'MergePartySessions', sessionId))) {
    throw new ServiceError({ token: 'MERGE_PARTY_SESSION_NOT_FOUND', status: 404 });
  }
};

export const partyMatch = async (ctx, matchId) => {
  uuid(matchId, 'INCORRECT_MATCH_ID');

  if (!(await exists(ctx.tenantId, 'MergePartyMatches', matchId))) {
    throw new ServiceError({ token: 'MERGE_PARTY_MATCH_NOT_FOUND', status: 404 });
  }
};

export const program = async (ctx, { programEmail, marketingSessionId }) => {
  if (!marketingSessionId && !programEmail) {
    throw new ServiceError({ token: 'MISSING_PROGRAM_EMAIL_OR_SESSION_ID', status: 400 });
  }
  marketingSessionId && uuid(marketingSessionId, 'INCORRECT_MARKETING_SESSION_ID');
  const programByMarketingSessionId = marketingSessionId && (await loadProgramByMarketingSessionId(ctx, marketingSessionId));
  const programByProgramMail = programEmail && (await loadProgramForIncomingCommByEmail(ctx, programEmail, { includeInactive: true }));

  if (!programByMarketingSessionId && !programByProgramMail) {
    throw new ServiceError({ token: 'PROGRAM_NOT_FOUND', status: 404 });
  }
};

export const noPromotedOrExecutedLease = async (req, partyId) => {
  const leases = await getPartyLeases(req, partyId);
  const hasPromotedOrExecutedLease = leases.some(l => l.status === DALTypes.LeaseStatus.EXECUTED || l.status === DALTypes.LeaseStatus.SUBMITTED);
  if (hasPromotedOrExecutedLease) {
    throw new ServiceError({
      token: 'SUBMITTED_OR_EXECUTED_LEASE_EXISTS',
      status: 412,
    });
  }
};

export const validateWorkflowType = async (req, partyId, validWorkflows) => {
  const { workflowName } = await loadPartyById(req, partyId);
  const isValidWorkflow = validWorkflows.includes(workflowName);
  if (!isValidWorkflow) {
    throw new ServiceError({
      token: 'INVALID_WORKFLOW_FOR_ACTION',
      status: 412,
    });
  }
};
