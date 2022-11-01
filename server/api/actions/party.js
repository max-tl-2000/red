/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import pick from 'lodash/pick';
import set from 'lodash/set';
import capitalize from 'lodash/capitalize';

import request from 'superagent';
import { mapSeries } from 'bluebird';
import * as partyRepo from '../../dal/partyRepo';
import { setRenewalPartyGroup } from '../../services/renewalV1Migration';
import { getActiveExternalInfoByParty } from '../../dal/exportRepo';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { removePersonsFromResidentsList, getPersonById } from '../../services/person';
import { ServiceError, BadRequestError } from '../../common/errors';
import * as validators from '../helpers/validators';
import { formatPhoneNumbers } from '../helpers/formatters';
import { exists } from '../../database/factory';
import { logEntity } from '../../services/activityLogService';
import { COMPONENT_TYPES, ACTIVITY_TYPES, SUB_COMPONENT_TYPES } from '../../../common/enums/activityLogTypes';
import { validateUser } from './users';
import { validateTeam } from './teams';
import { DALTypes } from '../../../common/enums/DALTypes';
import * as partyService from '../../services/party';
import * as mergePartiesService from '../../services/mergeParties/mergePartiesService';
import * as applicationService from '../../services/applications';
import * as quotePromotionService from '../../services/quotePromotions';
import { createImpersonationToken } from '../../helpers/auth';
import { allowedToReviewApplication } from '../../../common/acd/access';
import { sendApplicationLinkToContact } from '../../services/communication';
import { exportParty as exportPartyFile, exportPartyFromHtml as exportPartyFileFromHtml } from '../../services/partyExport';
import { getObjectKeysAsArray } from '../../common/utils';
import { setCachedEntity, getCachedEntity } from '../../helpers/cacheHelper';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import logger from '../../../common/helpers/logger';
import { isMissingLegalNameOnPartyMember, getMissingNamesOnPartyMember, isResident } from '../../../common/helpers/party-utils';
import { LA_TIMEZONE, DATE_ONLY_FORMAT } from '../../../common/date-constants';
import { isCorporateLeaseType } from '../../services/helpers/party';
import { getTenantScreeningVersion } from '../../services/tenantService';
import { getScreeningVersion } from '../../../rentapp/server/helpers/screening-helper';
import { getTeamById } from '../../dal/teamsRepo';
import { formatEmployeeAssetUrl } from '../../helpers/assets-helper';
import { getScreeningSummary } from '../../../rentapp/server/services/screening';
import { ScreeningDecision } from '../../../common/enums/applicationTypes';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import config from '../../config';
import { copyPersonApplication as copyPersonApplicationService } from '../../../rentapp/server/services/shared/person-application';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { getPublishedQuotesLengthByPartyId } from '../../dal/quoteRepo';
import { FadvRequestTypes } from '../../../common/enums/fadvRequestTypes';
import { forceRescreening } from '../../../rentapp/server/services/party-application';

const validatePartyMatchTokenInfo = (partyId, authUser) => {
  const isCommonUser = !!authUser.commonUserId;
  if (!isCommonUser || (isCommonUser && partyId === authUser.partyId)) return;

  throw new BadRequestError('INVALID_PARTY_ID');
};

const validateUnit = async (ctx, unitId) => {
  validators.uuid(unitId, 'INCORRECT_UNIT_ID');
  const unit = await exists(ctx.tenantId, 'Inventory', unitId);
  if (!unit) {
    throw new ServiceError({
      token: 'UNIT_NOT_FOUND',
      status: 404,
    });
  }
};

const validateProperty = async (ctx, propertyId) => {
  if (await exists(ctx.tenantId, 'Property', propertyId)) return;

  throw new ServiceError({
    token: 'PROPERTY_NOT_FOUND',
    status: 404,
  });
};

export const validateAssignParty = async req => {
  const { to } = req.body;

  if (!to || (!to.userId && !to.teamId)) {
    throw new ServiceError({
      token: 'ASSIGNEE_REQUIRED',
      status: 400,
    });
  }
  await validators.party(req, req.params.partyId);

  if (to.userId) await validateUser(req, to.userId);
  if (to.teamId) await validateTeam(req, to.teamId);
};

export const validatePartyGroupId = async (req, res, next) => {
  const partyGroupId = req.params.partyGroupId || req.body.partyGroupId;
  try {
    await validators.partyGroupId(req, partyGroupId);
    next && next();
  } catch (e) {
    next && next(e);
  }
};

export const validatePartyId = async (req, res, next) => {
  const partyId = req.params.partyId || req.body.partyId;
  try {
    await validators.party(req, partyId);
    next && next();
  } catch (e) {
    next && next(e);
  }
};

export const validatePartyIds = async (req, res, next) => {
  try {
    if (!req.body.partyIds.every(validators.isUuid)) {
      throw new ServiceError({ token: 'INCORRECT_PARTY_ID', status: 400 });
    }

    next && next();
  } catch (e) {
    next && next(e);
  }
};

const validateNoAcceptPromotionStatus = (validationArray, promotionStatus) => {
  const validation = validationArray.some(status => status === promotionStatus);
  if (!validation) {
    throw new ServiceError({
      token: 'PROMOTION_STATUS_NOT_ACCEPT',
      status: 412,
    });
  }
};

const validateNoActivePromotion = async (ctx, partyId) => {
  if (await isCorporateLeaseType(ctx, partyId)) return;

  const quotePromotions = await quotePromotionService.loadAllQuotePromotions(ctx, partyId);
  setCachedEntity(ctx, { type: 'quotePromotions', id: partyId, entity: quotePromotions });

  const hasActivePromotion = quotePromotions.some(
    promotion => promotion.promotionStatus === DALTypes.PromotionStatus.APPROVED || promotion.promotionStatus === DALTypes.PromotionStatus.PENDING_APPROVAL,
  );
  if (hasActivePromotion) {
    throw new ServiceError({
      token: 'ACTIVE_PROMOTION_ALREADY_EXISTS',
      status: 412,
    });
  }
};

const validateAllMembersHaveLegalName = async (ctx, partyId) => {
  const cachedParty = getCachedEntity(ctx, { type: 'party', id: partyId });
  const partyMembers = (cachedParty && cachedParty.partyMembers) || (await partyRepo.loadPartyMembers(ctx, partyId));

  const throwError = token => {
    throw new ServiceError({
      token,
      status: 412,
    });
  };

  if (await isCorporateLeaseType(ctx, partyId)) {
    const primaryTenant = partyMembers.find(isResident) || {};
    const person = await getPersonById(ctx, primaryTenant.personId);
    const missingFields = getMissingNamesOnPartyMember(
      { companyName: primaryTenant.displayName, fullName: person.fullName, memberType: primaryTenant.memberType },
      true,
    );
    missingFields.length && throwError(missingFields.includes('companyName') ? 'MISSING_COMPANY_NAME' : 'MISSING_POINT_OF_CONTACT');
  }

  const hasMissingLegalNames = partyMembers.some(isMissingLegalNameOnPartyMember);
  hasMissingLegalNames && throwError('MISSING_LEGAL_NAME');
};

const isUserAllowedToReviewApplication = async (ctx, partyId) => {
  const party = await partyService.loadPartyById(ctx, partyId);
  return allowedToReviewApplication(ctx.authUser, party);
};

const validatePartyWorkflowForTeam = async (ctx, teamId, workflowName) => {
  const { metadata } = await getTeamById(ctx, teamId);
  const { disableNewLeasePartyCreation = false } = metadata.features || {};
  if (disableNewLeasePartyCreation && workflowName === DALTypes.WorkflowName.NEW_LEASE) {
    throw new ServiceError({ token: 'INVALID_PARTY_WORKFLOW_FOR_TEAM', status: 400 });
  }
};

export const addParty = async req => {
  const data = req.body || {};
  const { guest, ...party } = data;
  const { workflowName, ownerTeam } = party;

  if (ownerTeam) await validatePartyWorkflowForTeam(req, ownerTeam, workflowName);

  party.metadata = party.metadata || {};
  if (!party.metadata.firstContactChannel) {
    party.metadata.firstContactChannel = party.contactChannel;
    party.metadata.firstContactedDate = now().toJSON();
  }

  if (!party.metadata.creationType) {
    party.metadata.creationType = DALTypes.PartyCreationTypes.USER;
  }

  set(party, 'metadata.screeningVersion', await getTenantScreeningVersion(req, req.tenantId));

  let member = null;
  if (guest) {
    const { contactInfo } = guest;
    validators.phoneNumbers(contactInfo, 'INVALID_PHONE_NUMBER');

    member = { ...guest, contactInfo: formatPhoneNumbers(contactInfo) };

    if (member.personId) await validators.person(req, member.personId);
  }

  return await partyService.createParty(req, { member, ...omit(party, ['contactChannel']) });
};

export function loadAllParties(req) {
  return partyRepo.loadParties(req);
}

export async function loadPartiesByPartyGroupId(req) {
  const partyGroupId = req.params.partyGroupId;

  await validators.partyGroupId(req, partyGroupId);

  return partyService.loadPartiesByPartyGroupId(req, partyGroupId);
}

export async function loadParty(req) {
  const partyId = req.params.partyId;
  await validators.party(req, partyId);
  return partyService.loadPartyById(req, partyId);
}

export async function addPartyMember(req) {
  const partyId = req.params.partyId;
  await validators.party(req, partyId);
  await partyService.validateMemberType(req, req.body, partyId);
  await validators.noPromotedOrExecutedLease(req, partyId);

  const { contactInfo } = req.body;
  validators.phoneNumbers(contactInfo, 'INVALID_PHONE_NUMBER');

  const pm = { ...req.body, contactInfo: formatPhoneNumbers(contactInfo) };

  if (pm.personId) await validators.person(req, pm.personId);

  const member = await partyService.addPartyMember(req, pm, partyId);
  logger.trace({ tenantId: req.tenantId, member, partyId }, 'Actions - New party member added');
  return member;
}

export async function loadPartyMembers(req) {
  const partyId = req.params.partyId;
  await validators.party(req, partyId);
  return await partyRepo.loadPartyMembers(req, partyId);
}

export const loadPartyAgent = async req => {
  const partyId = req.params.partyId;
  await validators.party(req, partyId);
  const agent = await partyRepo.loadPartyAgent(req, partyId);
  const result = pick(agent, [
    'id',
    'email',
    'fullName',
    'preferredName',
    'metadata',
    'directEmailIdentifier',
    'directPhoneIdentifier',
    'ringPhones',
    'outsideDedicatedEmails',
    'displayPhoneNumber',
    'displayEmail',
    'functionalRoles',
  ]);

  return {
    ...result,
    avatarUrl: await formatEmployeeAssetUrl(req, agent?.id),
  };
};

export const updatePartyMember = async req => {
  const { partyId, memberId } = req.params;

  await validators.party(req, partyId);
  await validators.partyMember(req, memberId);
  await partyService.validateMemberType(req, req.body, partyId);

  const { contactInfo } = req.body;
  validators.phoneNumbers(contactInfo, 'INVALID_PHONE_NUMBER');
  const pm = { ...req.body, contactInfo: formatPhoneNumbers(contactInfo) };

  return await partyService.updatePartyMember(req, memberId, pm);
};

export const updateParty = async req => {
  const partyId = req.params.partyId;
  await validators.party(req, partyId);
  const { partyMembers = [], caiEnabled } = req.body;

  if (caiEnabled !== undefined && !req.tenantName?.startsWith('demo')) {
    throw new ServiceError({
      token: 'UNALLOWED_ACTION',
      status: 412,
    });
  }
  await execConcurrent(partyMembers, async p => await validators.partyMember(req, p.id));

  const units = (req.body.metadata && req.body.metadata.favoriteUnits) || [];
  const isNotLeadFromExistingResident = !(req.body.metadata && req.body.metadata.leadFromExistingResident);
  if (isNotLeadFromExistingResident) {
    await removePersonsFromResidentsList(req, partyId);
  }

  await execConcurrent(units, async unitId => validateUnit(req, unitId));
  const partyInfo = req.body;
  return await partyService.updateParty(req, { id: partyId, ...partyInfo });
};

export const assignParty = async req => {
  await validateAssignParty(req);
  const partyId = req.params.partyId;

  const { to, checkConflictingAppointments = true, reassignReason = '' } = req.body;

  const party = await loadParty(req, partyId);
  await execConcurrent(party.partyMembers || [], async p => await validators.partyMember(req, p.id));

  return await partyService.assignParty({ isManualAssign: true, ...req }, party, to, checkConflictingAppointments, reassignReason);
};

export const validateCloseReason = closeReasonId => {
  if (!closeReasonId) {
    throw new ServiceError({
      token: 'CLOSE_REASON_REQUIRED',
      status: 400,
    });
  }
};

export const closeParty = async req => {
  const {
    body: { closeReasonId },
    params: { partyId },
  } = req;

  validateCloseReason(closeReasonId);
  await validators.party(req, partyId);

  const closedParty = await partyService.closeParty(req, partyId, closeReasonId);
  const renewalPartyIdToArchive = await partyRepo.getRenewalPartyIdBySeedPartyId(req, partyId);

  if (renewalPartyIdToArchive) {
    await partyService.archiveParty(req, { partyId: renewalPartyIdToArchive, archiveReasonId: DALTypes.ArchivePartyReasons.SEED_WORKFLOW_CLOSED });
  }

  return closedParty;
};

export const closeImportedParties = async req => {
  const tenantId = req.params.tenantId;
  const ctx = { ...req, tenantId };
  await validators.validTenantWithCtx(ctx, tenantId, 'INVALID_TENANT_ID');

  if (!ctx.body.propertyIds || !ctx.body.propertyIds.length) throw new ServiceError({ token: 'MISSING_PROPERTY_IDS', status: 400 });
  if (!ctx.body.activityDate) throw new ServiceError({ token: 'MISSING_ACTIVITY_DATE', status: 400 });

  await execConcurrent(ctx.body.propertyIds, async propertyId => await validateProperty(ctx, propertyId));

  const activityDate = toMoment(ctx.body.activityDate, { parseFormat: DATE_ONLY_FORMAT, timezone: LA_TIMEZONE });

  const currentDate = now({ timezone: LA_TIMEZONE }).endOf('day');
  if (currentDate.isBefore(activityDate)) {
    throw new ServiceError({
      token: 'INVALID_INACTIVITY_DATE',
      status: 400,
    });
  }

  return await partyService.closeImportedParties(ctx, ctx.body.propertyIds, activityDate.toJSON());
};

export const markAsSpam = async req => {
  const partyId = req.params.partyId;
  await validators.party(req, partyId);

  return await partyService.markAsSpam(req, partyId);
};

export const reopenParty = async req => {
  const partyId = req.params.partyId;
  await validators.party(req, partyId);

  return await partyService.reopenParty(req, partyId);
};

export const removePartyMember = async req => {
  const { partyId, memberId } = req.params;

  await validators.party(req, partyId);
  await validators.partyMember(req, memberId);
  await validators.noPromotedOrExecutedLease(req, partyId);

  return partyService.removePartyMember(req);
};

export const loadAllPartyAdditionalInfo = async req => {
  const { partyId } = req.params;
  const { type } = req.query;

  const readOnlyServer = config.useReadOnlyServer;
  const ctx = { ...req, readOnlyServer };

  await validators.party(ctx, partyId);

  return partyService.getAdditionalInfoByPartyAndType(ctx, partyId, type);
};

export const loadPartyAdditionalInfo = async req => {
  const { partyId, additionalInfoId } = req.params;

  await validators.party(req, partyId);
  await validators.partyAdditionalInfo(req, additionalInfoId);

  return partyService.getPartyAdditionalInfo(req, additionalInfoId);
};

export const addPartyAdditionalInfo = async req => {
  const { partyId } = req.params;

  await validators.party(req, partyId);
  const additionalInfo = req.body;

  if (additionalInfo.type === AdditionalInfoTypes.PET) await validators.noPromotedOrExecutedLease(req, partyId);

  return partyService.savePartyAdditionalInfo(req, additionalInfo);
};

export const updatePartyAdditionalInfo = async req => {
  const { partyId, additionalInfoId } = req.params;

  await validators.party(req, partyId);
  await validators.partyAdditionalInfo(req, additionalInfoId);
  const { info: additionalInfo } = req.body;

  return await partyService.updatePartyAdditionalInfo(req, additionalInfoId, additionalInfo);
};

export const removePartyAdditionalInfo = async req => {
  const { partyId, additionalInfoId } = req.params;

  await validators.party(req, partyId);
  await validators.partyAdditionalInfo(req, additionalInfoId);
  const additionalInfo = await partyService.getPartyAdditionalInfo(req, additionalInfoId);
  if (additionalInfo.type === AdditionalInfoTypes.PET) await validators.noPromotedOrExecutedLease(req, partyId);

  return await partyService.deletePartyAdditionalInfo(req, additionalInfoId, partyId);
};

export const loadAllScreeningResults = async req => {
  const { partyId } = req.params;

  const readOnlyServer = config.useReadOnlyServer;
  const ctx = { ...req, readOnlyServer };

  logger.info({ ctx, partyId }, 'loadAllScreeningResults action');
  return await quotePromotionService.getAllScreeningResultsForParty(ctx, partyId);
};

export const loadAllQuotePromotions = async req => {
  const { partyId } = req.params;

  await validators.party(req, partyId);
  await validatePartyMatchTokenInfo(partyId, req.authUser);

  return quotePromotionService.loadAllQuotePromotions(req, partyId);
};

export const insertQuotePromotion = async req => {
  const ctx = { ...req };
  const { partyId } = ctx.params;
  const { quoteId, leaseTermId, promotionStatus, createApprovalTask, conditions } = ctx.body;

  const party = await partyRepo.loadParty(ctx, partyId);
  if (!party) throw new ServiceError({ token: 'PARTY_NOT_FOUND', status: 404 });

  setCachedEntity(ctx, { type: 'party', id: partyId, entity: party });
  setCachedEntity(ctx, { type: 'isCorporateLeaseType', id: partyId, entity: await partyService.isCorporateLeaseType(ctx, partyId) });

  await validateNoActivePromotion(ctx, partyId);
  await validateAllMembersHaveLegalName(ctx, partyId);
  await validateNoAcceptPromotionStatus(
    [DALTypes.PromotionStatus.PENDING_APPROVAL, DALTypes.PromotionStatus.APPROVED, DALTypes.PromotionStatus.CANCELED],
    promotionStatus,
  );
  const quotePromotion = {
    partyId,
    quoteId,
    leaseTermId,
    promotionStatus,
  };

  return await quotePromotionService.insertQuotePromotion(ctx, quotePromotion, createApprovalTask, conditions);
};

export const loadQuotePromotion = async req => {
  const { partyId, quotePromotionId } = req.params;

  await validators.party(req, partyId);
  await validators.partyQuotePromotion(req, quotePromotionId);

  return quotePromotionService.loadQuotePromotion(req, quotePromotionId);
};

// this action is associated with the decline, requires work and approve in the review application window
export const updateQuotePromotion = async req => {
  const { partyId, quotePromotionId } = req.params;
  const { promotionStatus, conditions = {} } = req.body;
  validators.defined(promotionStatus, 'MISSING_STATUS');
  await validators.party(req, partyId);
  await validators.partyQuotePromotion(req, quotePromotionId);
  await validateNoAcceptPromotionStatus(
    [DALTypes.PromotionStatus.REQUIRES_WORK, DALTypes.PromotionStatus.APPROVED, DALTypes.PromotionStatus.CANCELED],
    promotionStatus,
  );

  if (!(await isUserAllowedToReviewApplication(req, partyId))) {
    const { quoteId, leaseTermId } = await quotePromotionService.loadQuotePromotion(req, quotePromotionId);
    const { recommendation } = await getScreeningSummary(req, { partyId, quoteId, leaseTermId });
    if (recommendation !== ScreeningDecision.APPROVED) {
      logger.trace({ ctx: req, quotePromotionId, recommendation, partyId }, 'updateQuotePromotion: Invalid user role');
      throw new ServiceError({ token: 'INVALID_USER_ROLE', status: 403 });
    }
  }

  return quotePromotionService.updateQuotePromotion(req, partyId, quotePromotionId, promotionStatus, conditions);
};

export const getImpersonationToken = async req => {
  const { partyId, memberId } = req.params;
  const { propertyId, quoteId } = req.body;
  const { id: impersonatorUserId, email: impersonatorEmail } = req.authUser;
  const tenantId = req.tenantId;
  const ctx = { tenantId };

  await Promise.all([validators.party(req, partyId), validators.partyMember(req, memberId), validateProperty(req, propertyId)]);

  const person = await partyService.loadPersonByPartyMemberId(ctx, memberId);
  await logEntity(req, {
    entity: {
      partyId,
      memberName: person.fullName,
    },
    activityType: ACTIVITY_TYPES.UPDATE,
    component: COMPONENT_TYPES.APPLICATION,
  });

  const screeningVersion = await getScreeningVersion({ tenantId, partyId });

  const tokenInfo = {
    partyId,
    quoteId,
    propertyId,
    impersonatorUserId,
    impersonatorEmail,
    person,
    screeningVersion,
  };

  return createImpersonationToken(req, tokenInfo);
};

export const getApplicationInvoices = async req => {
  const { partyId } = req.params;
  const readOnlyServer = config.useReadOnlyServer;
  const ctx = { ...req, readOnlyServer };

  await validators.party(ctx, partyId);

  return applicationService.getApplicationInvoices(ctx, partyId);
};

export const sendApplicationInvitationToContact = async req => {
  const { tenantId, hostname: tenantDomain, authUser = {} } = req;
  const { partyId, memberId } = req.params;
  const { propertyId, contactInfo } = req.body;

  if (!contactInfo.value) {
    logger.error({ tenantId, tenantDomain, partyId, contactInfo }, `No ${contactInfo.type} to send invitation invite to`);
    throw new BadRequestError(`${capitalize(contactInfo.type)} not found`);
  }

  return await sendApplicationLinkToContact(req, {
    tenantDomain,
    partyId,
    propertyId,
    contactInfo,
    memberId,
    userId: authUser.id,
  });
};

// this action is associated with the revoke or abandon that requires approval action
export const demoteApplication = async req => {
  const { partyId } = req.params;
  const { quotePromotionId } = req.body;

  await validators.party(req, partyId);
  await validators.partyQuotePromotion(req, quotePromotionId);

  await applicationService.demoteApplication(req, partyId, quotePromotionId);
};

export const migrateRenewalV1 = async req => {
  const tenantId = req.params.tenantId;
  const { renewalPartyId, activeLeasePartyId } = req.body;

  logger.trace({ ctx: req, tenantId, renewalPartyId, activeLeasePartyId }, 'migrateRenewalV1 action');
  const ctx = { ...req, tenantId };

  await validators.validTenantWithCtx(ctx, tenantId, 'INVALID_TENANT_ID');

  await validators.party(ctx, renewalPartyId);
  await validators.party(ctx, activeLeasePartyId);

  await validators.validateWorkflowType(ctx, renewalPartyId, DALTypes.WorkflowName.RENEWAL);
  await validators.validateWorkflowType(ctx, activeLeasePartyId, DALTypes.WorkflowName.ACTIVE_LEASE);

  const { metadata } = await partyService.loadPartyById(ctx, renewalPartyId);

  if (metadata.V1RenewalState !== DALTypes.V1RenewalState.UNUSED) {
    throw new BadRequestError('RENEWAL PARTY IS NOT IN FLIGHT V1');
  }

  const renewalExternalInfo = await getActiveExternalInfoByParty(ctx, { partyId: renewalPartyId });
  const renewalExternalIds = renewalExternalInfo.filter(ei => ei.externalId).map(ei => ei.externalId);
  const activeLeaseExternalInfo = await getActiveExternalInfoByParty(ctx, { partyId: activeLeasePartyId });
  const activeLeaseExternalIds = activeLeaseExternalInfo.filter(ei => ei.externalId).map(ei => ei.externalId);
  if (!activeLeaseExternalIds.some(id => renewalExternalIds.includes(id))) {
    throw new BadRequestError('THERE IS NO COMMON EXTERNAL ID BETWEEN RENEWAL AND ACTIVE LEASE');
  }

  return await setRenewalPartyGroup(ctx, { renewalPartyId, activeLeasePartyId });
};

export const exportParty = req => exportPartyFile(req);

export const exportPartyFromHtml = (req, res) => exportPartyFileFromHtml(res);

export const linkPartyMember = async req => {
  const { partyId, memberId } = req.params;
  const partyMemberIds = req.body || [];
  await validators.party(req, partyId);

  await execConcurrent([memberId].concat(partyMemberIds), async partyMemberId => await validators.partyMember(req, partyMemberId));

  return await partyService.linkPartyMember(req, partyId, memberId, partyMemberIds);
};

export const createMergePartySession = async req => {
  const { mergeContext, partyId, personId, propertyId, oldPropertyId } = req.body;
  const { authUser } = req;

  logger.trace({ ctx: req, mergeContext, partyId }, 'createMergePartySession action');

  validators.defined(mergeContext, 'MISSING_MERGE_CONTEXT');

  const validMergeContext = [DALTypes.MergePartyContext.PARTY, DALTypes.MergePartyContext.PERSON, DALTypes.MergePartyContext.PROPERTY_CHANGE];

  if (!validMergeContext.includes(mergeContext)) {
    throw new BadRequestError('INVALID_MERGE_CONTEXT');
  }

  await validators.party(req, partyId);
  if (mergeContext === DALTypes.MergePartyContext.PERSON) await validators.person(req, personId);
  if (mergeContext === DALTypes.MergePartyContext.PROPERTY_CHANGE) await validators.property(req, propertyId);
  if (mergeContext === DALTypes.MergePartyContext.PROPERTY_CHANGE) await validators.property(req, oldPropertyId);

  const context = { mergeContext, partyId, userId: authUser.id };

  if (mergeContext === DALTypes.MergePartyContext.PERSON) context.personId = personId;
  if (mergeContext === DALTypes.MergePartyContext.PROPERTY_CHANGE) {
    context.oldPropertyId = oldPropertyId;
    context.propertyId = propertyId;
  }

  return await mergePartiesService.createMergePartySession(req, context);
};

export const generateNextPartyMatch = async req => {
  const { sessionId } = req.params;

  logger.trace({ ctx: req, sessionId }, 'generateNextPartyMatch action');

  await validators.mergePartySession(req, sessionId);
  return await mergePartiesService.generateNextPartyMatch(req, sessionId);
};

export const resolvePartyMatch = async req => {
  const { sessionId, matchId } = req.params;
  const { response, partyOwnerId, ownerTeamId, shouldCheckConflictingAppointments, chosenProperty } = req.body;

  logger.trace({ ctx: req, sessionId }, 'resolvePartyMatch action');

  await validators.mergePartySession(req, sessionId);
  await validators.partyMatch(req, matchId);

  const validResponses = getObjectKeysAsArray(DALTypes.MergePartyResponse);
  if (!validResponses.includes(response)) {
    throw new BadRequestError('INVALID_MERGE_PARTY_RESPONSE');
  }

  if (response === DALTypes.MergePartyResponse.MERGE && !partyOwnerId) {
    throw new BadRequestError('PARTY_OWNER_NOT_SET');
  }

  return await mergePartiesService.resolvePartyMatch(req, { matchId, response, partyOwnerId, ownerTeamId, shouldCheckConflictingAppointments, chosenProperty });
};

export const restartCai = async req => {
  const { partyId } = req.params;
  const { domainUrl, webhookUrl } = config.rasa;
  logger.info({ ctx: req, partyId, domainUrl, webhookUrl }, 'restartCai started!');

  const partyMembers = await partyService.loadPartyMembers(req, partyId);
  const rasaConversationIds = [];

  await mapSeries(partyMembers, async partyMember => {
    const rasaConversationId = `${partyId}-${partyMember.personId}`;

    await request.post(`${domainUrl}${webhookUrl}`).set('Content-Type', 'application/json').send({
      sender: rasaConversationId,
      message: '/restart',
    });
    rasaConversationIds.push(rasaConversationId);
  });

  logger.info({ ctx: req, rasaConversationIds }, 'restartCai finish!');
};

export const archivePartiesFromSoldProperties = async req => {
  const tenantId = req.params.tenantId;
  validators.uuid(tenantId, 'INVALID_TENANT_ID');
  const ctx = { ...req, tenantId };
  logger.trace({ ctx }, 'archivePartiesFromSoldProperties action');

  const { propertyIds } = ctx.body;

  if (!propertyIds || !propertyIds.length) throw new ServiceError({ token: 'MISSING_PROPERTY_IDS', status: 400 });

  return partyService.archivePartiesFromSoldProperties(ctx, propertyIds);
};

export const copyPersonApplication = async req => {
  const { partyId } = req?.params;
  const { personApplication } = req?.body;

  logger.trace({ ctx: req, partyId, personApplication }, 'copyPersonApplication');

  if (!partyId || !personApplication) throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });

  const application = await copyPersonApplicationService(req, personApplication, partyId);
  const { personId, id: applicationId } = application;

  const areTherePublishedQuotes = !!(await getPublishedQuotesLengthByPartyId(req, partyId));

  if (areTherePublishedQuotes) {
    await forceRescreening(req, partyId, FadvRequestTypes.NEW);
  }

  notify({
    ctx: req,
    event: eventTypes.APPLICATION_UPDATED,
    data: {
      partyId,
      personId,
      applicationId,
    },
  });

  const { fullName } = await partyRepo.getPartyMemberByPersonId(req, personId);

  await logEntity(req, {
    entity: {
      partyId,
      memberName: fullName,
    },
    activityType: ACTIVITY_TYPES.SUBMIT,
    component: COMPONENT_TYPES.APPLICATION,
    subComponent: SUB_COMPONENT_TYPES.MOVED,
  });

  return application;
};

export const updateCompany = async req => {
  const { id, displayName } = req.body;

  validators.uuid(id, 'INCORRECT_COMPANY_ID');
  return await partyService.updateCompany(req, { id, displayName });
};

export const addCompany = async req => {
  const { companyName, partyMemberId } = req.body;

  return await partyService.addCompany(req, companyName, partyMemberId);
};

export const addTransferReasonActivityLogAndComm = async req => {
  const { party, reassignReason } = req.body;

  return await partyService.addTransferReasonActivityLogAndComm(req, party, reassignReason);
};
