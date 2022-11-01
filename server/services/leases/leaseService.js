/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { omit, uniq } from 'lodash'; // eslint-disable-line red/no-lodash
import get from 'lodash/get';
import { each, mapSeries } from 'bluebird';
import has from 'lodash/has';
import { getQuoteById } from '../quotes';
import {
  releaseInventory,
  releaseInventories,
  updateStateAfterAction,
  holdInventory,
  validateActionOnInventory,
  releaseManuallyHeldInventoriesByParty,
  getInventoryHolds,
} from '../inventories';
import { createOneMonthActiveLease } from '../workflows';
import {
  loadQuotePromotion,
  loadPartyMembers,
  getQuotePromotionsByQuoteId,
  loadParty,
  loadPartyById,
  loadPartyMemberById,
  updateQuotePromotion,
  getPartyMembersByPartyIds,
  getRenewalPartyIdBySeedPartyId,
} from '../../dal/partyRepo';
import { getActiveLeaseWorkflowDataByPartyId, getActiveLeaseWorkflowDataBySeedPartyIdAndLeaseId } from '../../dal/activeLeaseWorkflowRepo';
import { assignPartyOrUpdateCollaborators } from '../partyCollaborators';
import * as leaseRepo from '../../dal/leaseRepo';
import { getConcessionsByIds } from '../../dal/concessionRepo';
import { getConcessionsByFilters } from '../concessions';
import { getInventoryById, getComplimentsForInventory, getInventoriesOnHoldForParty, getAllHoldsForParty } from '../../dal/inventoryRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { LEASE_SIGNING_ERROR_TOKENS } from '../../../common/enums/error-tokens';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { ServiceError } from '../../common/errors';
import { performPartyStateTransition } from '../partyStatesTransitions';
import { getUserById, getUserByEmail, getUserIdsWithFunctionalRolesForProperty } from '../../dal/usersRepo';
import { getUserTeams } from '../users';
import { shouldShowEmergencyContactTask } from '../party-settings';
import { getQuoteById as getQuoteByIdRepo, isRenewalQuote, getQuotesByPartyId } from '../../dal/quoteRepo';
import { getPersonApplicationsByPartyIdPersonIds } from '../../../rentapp/server/dal/person-application-repo.js';
import { getEnhancedLeaseObject } from './setsMapping';
import { sendVoidedLeaseMail, sendExecutedLeaseMail, sendSignLeaseMail } from '../mjmlEmails/leaseEmails';
import { buildInitialBaseline, enhanceBaseline } from './baseline';
import { formatPropertyAddress, formatBuildingAddress } from '../../../common/helpers/addressUtils';
import { getLeaseSettingsForProperty } from './propertySetting';
import { addLeaseActivityLog } from './leaseActivityLog';
import { runInTransaction } from '../../database/factory';
import { APP_EXCHANGE, LEASE_MESSAGE_TYPE, EXPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../pubsub';
import * as eventService from '../partyEvent';

import { ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';
import LeaseProviderFactory from './leaseProviderFactory';
import { FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import * as taskUtils from '../../helpers/taskUtils';
import { ActionTypes } from '../../../common/enums/actionTypes';
import { getRentableItemIdsFromLease } from '../helpers/leaseTerms';

import loggerModule from '../../../common/helpers/logger';
import { getAdditionalInfoByPartyAndType, loadPartyAgent, archiveParty, unarchiveParty } from '../party';
import { assert } from '../../../common/assert';
import { now, toMoment } from '../../../common/helpers/moment-utils';
import { isDateInThePast } from '../../../common/helpers/date-utils';
import { canVoidLease, getVoidLeaseEmailRecipients, allMembersSigned, isSignatureStatusSigned } from '../../../common/helpers/lease';
import { getCachedEntity } from '../../helpers/cacheHelper';
import { isCorporateLeaseType, getCompanyName } from '../helpers/party';
import { LeaseEmailType, LeaseProviderName } from '../../../common/enums/enums';
import { updateTermWithMatrixRents, extractFeeId } from '../../../common/helpers/quotes';
import { getAndFormatAdditionalAndOneTimeChargesByperiod } from '../../helpers/fees';

const logger = loggerModule.child({ subType: 'leaseService' });

const leaseProviderFactory = new LeaseProviderFactory();

const getInventoryByIdFromLease = async (ctx, lease) => {
  const inventoryId = get(lease, 'baselineData.quote.inventoryId');
  if (inventoryId) {
    logger.trace({ ctx, leaseId: lease.id, inventoryId }, 'getInventoryByIdFromLease - using baseline');
    return inventoryId;
  }

  const quote = await getQuoteByIdRepo(ctx, lease.quoteId);
  if (!quote.inventory || quote.inventory.id === null) {
    logger.error({ ctx, quote }, 'getInventoryByIdFromLease - invalid quote');
  }
  logger.trace({ ctx, quoteId: quote?.id, inventoryId: quote.inventory.id }, 'getInventoryByIdFromLease - using quote');
  return quote.inventory.id;
};

export const getLeases = (ctx, partyId) => leaseRepo.getPartyLeases(ctx, partyId);

const getExternalLeaseIdFromActiveLease = async (ctx, partyId) => {
  const party = await loadPartyById(ctx, partyId);
  const { externalLeaseId } = await getActiveLeaseWorkflowDataByPartyId(ctx, party.seedPartyId);
  return externalLeaseId;
};

export const createLease = async (ctx, promotedQuoteId, additionalConditions) => {
  logger.trace({ ctx, promotedQuoteId, additionalConditions }, 'createLease');

  const { partyId, quoteId, leaseTermId } = await loadQuotePromotion(ctx, promotedQuoteId);
  const isCorporateParty = await isCorporateLeaseType(ctx, partyId);
  const partyLeases = await leaseRepo.getPartyLeases(ctx, partyId);

  /* do not create a new lease if we already have one created */
  if (!isCorporateParty && partyLeases && partyLeases.some(l => l.status !== DALTypes.LeaseStatus.VOIDED)) {
    throw new ServiceError({
      token: 'LEASE_ALREADY_EXISTS',
      status: 412,
    });
  }

  const { inventoryId, publishedQuoteData } = getCachedEntity(ctx, { type: 'quote', id: quoteId }) || (await getQuoteById(ctx, quoteId));
  const publishedQuoteLeaseData = publishedQuoteData.leaseTerms.find(l => l.id === leaseTermId);
  const inventory = await getInventoryById(ctx, {
    id: inventoryId,
    expand: true,
  });

  if (!inventory) {
    throw new ServiceError({
      token: 'LEASE_INVENTORY_DOES_NOT_EXIST',
      status: 412,
    });
  }

  await validateActionOnInventory(ctx, ActionTypes.CREATE_LEASE, {
    inventoryId,
    partyId,
  });

  try {
    const leaseTemplates = await leaseRepo.getPropertyLeaseTemplates(ctx, inventory.propertyId);
    const leaseTemplateHasDocuments = leaseTemplates && leaseTemplates.length && has(leaseTemplates[0], 'templateData.documents');

    if (!leaseTemplateHasDocuments) {
      throw new ServiceError({
        token: 'NO_LEASE_TEMPLATE_AVAILABLE',
        status: 412,
      });
    }
    const leaseTemplateId = leaseTemplates[0].id;

    const cachedParty = getCachedEntity(ctx, { type: 'party', id: partyId });
    const { qualificationQuestions } = cachedParty || (await loadPartyById(ctx, partyId));
    const { groupProfile } = qualificationQuestions;
    const partyMembers = (cachedParty && cachedParty.partyMembers) || (await loadPartyMembers(ctx, partyId));
    const additionalInfo = await getAdditionalInfoByPartyAndType(ctx, partyId);
    const partyPets = additionalInfo.filter(ai => ai.type === AdditionalInfoTypes.PET);
    const partyVehicles = additionalInfo.filter(ai => ai.type === AdditionalInfoTypes.VEHICLE);
    const children = additionalInfo.filter(ai => ai.type === AdditionalInfoTypes.CHILD);
    const insuranceChoices = additionalInfo.filter(ai => ai.type === AdditionalInfoTypes.INSURANCE_CHOICE);

    const personIds = partyMembers.map(pm => pm.personId);

    const personsApplications = await getPersonApplicationsByPartyIdPersonIds(ctx, partyId, personIds);

    const isRenewalLease = await isRenewalQuote(ctx, quoteId);
    const companyName = await getCompanyName(ctx, isCorporateParty, partyMembers);

    const externalLeaseId = isRenewalLease ? await getExternalLeaseIdFromActiveLease(ctx, partyId) : null;

    const baselineData = await buildInitialBaseline(ctx, {
      quoteId,
      partyMembers,
      partyPets,
      personsApplications,
      partyVehicles,
      publishedQuoteLeaseData,
      children,
      additionalConditions,
      insuranceChoices,
      leaseTemplate: leaseTemplates[0],
      propertyName: inventory.property.name,
      timezone: inventory.property.timezone,
      isCorporateParty: isCorporateParty || groupProfile === DALTypes.QualificationQuestions.GroupProfile.CORPORATE,
      isEmployee: groupProfile === DALTypes.QualificationQuestions.GroupProfile.EMPLOYEE,
      isRenewalLease,
      companyName,
    });

    const lease = {
      partyId,
      quoteId,
      leaseTermId,
      leaseTemplateId,
      leaseData: {},
      baselineData,
      status: DALTypes.LeaseStatus.DRAFT,
      modified_by: (ctx.authUser || {}).id,
      externalLeaseId,
    };

    return await runInTransaction(async trx => {
      ctx.trx = trx;

      const createdLease = await leaseRepo.saveLease(ctx, lease);
      await addLeaseActivityLog(ctx, createdLease, ACTIVITY_TYPES.NEW);
      await eventService.saveLeaseCreatedEvent(ctx, { partyId, userId: lease.modified_by, metadata: { leaseId: createdLease.id } });

      const party = getCachedEntity(ctx, { type: 'party', id: partyId }) || (await loadPartyById(ctx, partyId));
      await notify({
        ctx,
        event: eventTypes.LEASE_CREATED,
        data: { partyId },
        routing: { teams: party.teams },
      });

      return omit(createdLease, ['versions']);
    }, ctx);
  } catch (error) {
    logger.error({ error }, `createLease failed for promotedQuote: ${promotedQuoteId}`);
    throw error;
  }
};

export const sendLeaseMail = async (ctx, lease, partyMemberIds) => {
  const { id: leaseId, partyId } = lease;
  logger.trace({ ctx, leaseId, partyMemberIds }, 'sendLeaseMail');
  await eventService.saveLeaseSentEvent(ctx, {
    partyId,
    userId: (ctx.authUser || {}).id,
    metadata: {
      leaseId,
      partyMemberIds,
    },
  });
};

const envelopeIdsFromOldSignatures = oldSignatures => {
  const envelopeIds = oldSignatures.reduce((acc, signature) => {
    acc[signature.envelopeId] = true;
    return acc;
  }, {});
  return Object.keys(envelopeIds);
};

export const voidLease = async (ctx, leaseId, forceVoid = false) => {
  logger.trace({ ctx, leaseId }, 'voidLease');
  const { authUser, trx } = ctx;
  const existingLease = await leaseRepo.getLeaseById(ctx, leaseId);
  const { baselineData } = existingLease;
  const handlePromoteApplicationTask = !baselineData.isRenewalLease;

  if (!forceVoid && !canVoidLease(existingLease, authUser)) {
    throw new ServiceError({
      token: 'LEASE_CAN_NOT_BE_VOIDED',
      status: 412,
    });
  }
  const oldSignatures = await leaseRepo.getLeaseSignatureStatuses(ctx, leaseId);
  const allPartyMembersSigned = allMembersSigned([...baselineData.residents, ...baselineData.guarantors], oldSignatures);

  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  await leaseProvider.voidLease(ctx, leaseId, envelopeIdsFromOldSignatures(oldSignatures));

  await leaseRepo.updateLeaseSignature(ctx, { status: DALTypes.LeaseSignatureStatus.VOIDED }, { leaseId });
  const updatedLease = await leaseRepo.updateLease(ctx, { id: leaseId, status: DALTypes.LeaseStatus.VOIDED }, trx);
  await performPartyStateTransition(ctx, updatedLease.partyId);

  const promotedQuotes = await getQuotePromotionsByQuoteId(ctx, updatedLease.quoteId);
  const promotedQuote = promotedQuotes.find(x => x.promotionStatus === DALTypes.PromotionStatus.APPROVED);
  const inventoryId = await getInventoryByIdFromLease(ctx, updatedLease);

  if (promotedQuote) {
    logger.trace({ ctx, leaseId }, 'Voiding the lease, update quote promotion status to CANCELED');
    await updateQuotePromotion(ctx, promotedQuote.id, { promotionStatus: DALTypes.PromotionStatus.CANCELED });
  }
  const { publishedLease } = updatedLease.baselineData;
  if (publishedLease) {
    const rentableItemIds = getRentableItemIdsFromLease(publishedLease);
    const inventoryIdsToRelease = rentableItemIds.concat([inventoryId]);
    await releaseInventories(ctx, { inventoryIds: inventoryIdsToRelease, reason: DALTypes.InventoryOnHoldReason.LEASE, partyId: existingLease.partyId });
  }

  const party = await loadPartyById(ctx, updatedLease.partyId);

  if (existingLease.status === DALTypes.LeaseStatus.EXECUTED && party.workflowName !== DALTypes.WorkflowName.RENEWAL) {
    await updateStateAfterAction(ctx, ActionTypes.VOID_LEASE, inventoryId);

    const rentableItemIds = getRentableItemIdsFromLease(publishedLease);
    rentableItemIds.length &&
      (await mapSeries(rentableItemIds, async rentableItemId => await updateStateAfterAction(ctx, ActionTypes.VOID_LEASE, rentableItemId)));
  }

  await taskUtils.sendMessageToCancelNotifyConditionalApprovalTask(ctx, updatedLease.partyId);

  await addLeaseActivityLog(ctx, updatedLease, ACTIVITY_TYPES.REMOVE);

  const sentToOrSignedBy = getVoidLeaseEmailRecipients(oldSignatures);

  const inventoriesOnHold = await getInventoriesOnHoldForParty(ctx, updatedLease.partyId);

  const remainingInventoryOnHoldForLeasedUnit =
    inventoriesOnHold &&
    inventoriesOnHold.find(
      hold =>
        hold.inventoryId === inventoryId && hold.partyId === updatedLease.partyId && !hold.endDate && hold.reason !== DALTypes.InventoryOnHoldReason.LEASE,
    );

  const otherRemainingInventoryOnHold =
    inventoriesOnHold &&
    inventoriesOnHold.find(
      hold =>
        hold.inventoryId !== inventoryId && hold.partyId === updatedLease.partyId && !hold.endDate && hold.reason !== DALTypes.InventoryOnHoldReason.LEASE,
    );

  const hasInventoryOnHold = remainingInventoryOnHoldForLeasedUnit || otherRemainingInventoryOnHold;
  const remainingInventoryOnHold = remainingInventoryOnHoldForLeasedUnit
    ? remainingInventoryOnHoldForLeasedUnit?.inventoryId
    : otherRemainingInventoryOnHold?.inventoryId;

  const quotes = await getQuotesByPartyId(ctx, party.id);
  const quoteForHeldInventory = quotes
    .filter(quote => quote.publishedQuoteData && quote.publishedQuoteData.inventoryId === remainingInventoryOnHold)
    .sort((a, b) => toMoment(b.publishedQuoteData.expirationDate).diff(toMoment(a.publishedQuoteData.expirationDate)))
    .find(x => x);

  const leaseStartDate = quoteForHeldInventory?.leaseStartDate;
  const leaseTermLength = quoteForHeldInventory?.publishedQuoteData?.leaseTerms[0].termLength;

  await eventService.saveLeaseVoidedEvent(ctx, {
    partyId: updatedLease.partyId,
    userId: authUser?.id || party.userId,
    metadata: {
      leaseId,
      leasePrevStatus: existingLease.status,
      sentToOrSignedBy,
      handlePromoteApplicationTask,
      allPartyMembersSigned,
      ...(hasInventoryOnHold && { remainingInventoryOnHold }),
      ...(leaseTermLength && { leaseTermLength }),
      ...(inventoryId && { inventoryId }),
      ...(leaseStartDate && { leaseStartDate }),
    },
  });

  const activeLeaseData = await getActiveLeaseWorkflowDataBySeedPartyIdAndLeaseId(ctx, { seedPartyId: updatedLease.partyId, leaseId });

  if (activeLeaseData) {
    notify({
      ctx,
      event: eventTypes.PARTY_UPDATED,
      data: { partyId: activeLeaseData.partyId },
      routing: { teams: party.teams },
    });

    const updatedLeaseStartDate =
      updatedLease?.baselineData?.publishedLease?.leaseStartDate && toMoment(updatedLease?.baselineData?.publishedLease?.leaseStartDate);

    if (updatedLeaseStartDate.isBefore(now()) && party.workflowName === DALTypes.WorkflowName.RENEWAL && party.seedPartyId) {
      const isSeedPartyArchived = true;
      await createOneMonthActiveLease(ctx, party.seedPartyId, isSeedPartyArchived);
    }

    // renewals V1 that generated an active lease and there is no seed active lease for it.
    const isRenewalWithoutSeedActiveLease = party.workflowName === DALTypes.WorkflowName.RENEWAL && !party.seedPartyId;
    if (isRenewalWithoutSeedActiveLease) {
      await archiveParty(ctx, {
        partyId: party.id,
        workflowName: DALTypes.WorkflowName.RENEWAL,
        archiveReasonId: DALTypes.ArchivePartyReasons.RENEWAL_V1_WITHOUT_HISTORICAL_LEASE,
      });
      return updatedLease;
    }

    await archiveParty(ctx, {
      partyId: activeLeaseData.partyId,
      workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
      archiveReasonId: DALTypes.ArchivePartyReasons.CORRESPONDING_LEASE_DOCUMENT_WAS_VOIDED,
    });

    const renewalPartyId = await getRenewalPartyIdBySeedPartyId(ctx, activeLeaseData.partyId);

    if (renewalPartyId) {
      await archiveParty(ctx, {
        partyId: renewalPartyId,
        workflowName: DALTypes.WorkflowName.RENEWAL,
        archiveReasonId: DALTypes.ArchivePartyReasons.CORRESPONDING_LEASE_DOCUMENT_WAS_VOIDED,
      });
    }
  }

  notify({
    ctx,
    event: eventTypes.LEASE_UPDATED,
    data: { partyId: updatedLease.partyId },
    routing: { teams: party.teams },
  });

  existingLease &&
    existingLease.status === DALTypes.LeaseStatus.EXECUTED &&
    (await sendMessage({
      exchange: APP_EXCHANGE,
      key: EXPORT_MESSAGE_TYPE.LEASE_VOIDED,
      message: { tenantId: ctx.tenantId, partyId: existingLease.partyId, leaseId },
      ctx,
    }));

  return updatedLease;
};

export const closeLease = async (ctx, leaseId, partyId, forceVoid = false) => {
  logger.trace({ ctx, leaseId, partyId }, 'closeLease');

  return await runInTransaction(async trx => {
    ctx.trx = trx;

    const lease = await voidLease(ctx, leaseId, forceVoid);

    logger.trace({ ctx, partyId: lease.partyId }, 'Lease closed');
    return lease;
  }, ctx);
};

export const createLeaseVersion = async (ctx, leaseId) => {
  logger.trace({ ctx, leaseId }, 'createLeaseVersion');
  const lease = await leaseRepo.getLeaseById(ctx, leaseId);

  const [updatedLease] = await leaseRepo.updateLeaseVersions(ctx, leaseId, {
    data: [...(lease.versions.data || []), omit(lease, ['versions'])],
  });

  return updatedLease;
};

const publishLeaseToLeaseProvider = async (ctx, hostname, lease) => {
  assert(hostname, 'publishLeaseToLeaseProvider: hostname not provided!');
  assert(lease, 'publishLeaseToLeaseProvider: lease not provided!');
  assert(lease.partyId, 'publishLeaseToLeaseProvider: lease has no party id!');
  const residents = await loadPartyMembers(ctx, lease.partyId);
  const message = {
    tenantId: ctx.tenantId,
    leaseData: {
      id: lease.id,
      residents,
    },
    host: hostname,
  };
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: LEASE_MESSAGE_TYPE.PUBLISH_LEASE,
    message,
    ctx,
  });
};

const getLeaseTermsWithUpdatedPrice = ({ leaseTerms, rentMatrix, leaseStartDate, propertyTimezone }) =>
  leaseTerms.map(leaseTerm => updateTermWithMatrixRents(leaseTerm, leaseStartDate, rentMatrix, propertyTimezone));

const getLeaseAdditionalAndOneTimeCharges = async (
  ctx,
  { additionalCharges, inventoryId, propertyTimezone, publishedQuoteData, selections, leaseTerms, leaseStartDate },
) => {
  const { rentMatrix, leaseState } = publishedQuoteData;

  if (!rentMatrix) return [];
  const { selectedAdditionalAndOneTimeCharges = {} } = selections;

  const updatedLeaseTerms = getLeaseTermsWithUpdatedPrice({ leaseTerms, rentMatrix, leaseStartDate, propertyTimezone });
  const additionalAndOneTimeCharges = await getAndFormatAdditionalAndOneTimeChargesByperiod(ctx, {
    additionalCharges,
    inventoryId,
    leaseTerms: updatedLeaseTerms,
    propertyTimezone,
    useDbLeaseTerms: false,
    isRenewalQuote: leaseState === DALTypes.LeaseState.RENEWAL,
  });

  const { name: periodName } = selectedAdditionalAndOneTimeCharges;

  return additionalAndOneTimeCharges.map(charges => {
    if (charges.name !== periodName) return charges;
    return {
      ...charges,
      fees: charges.fees.map(fee => {
        const extractedFeeId = extractFeeId(fee);

        const selectedFee = selectedAdditionalAndOneTimeCharges.fees.find(sFee => extractFeeId(sFee) === extractedFeeId && sFee.variableAdjustmentAmount) || {};
        return {
          ...fee,
          amount: selectedFee.variableAdjustmentAmount || fee.amount,
        };
      }),
    };
  });
};

const getConcessionsForLease = async (ctx, { leaseTerm, inventoryId, timezone, leaseState, publishedConcessions }) => {
  const dbConcessions = leaseTerm ? await getConcessionsByFilters(ctx, leaseTerm, inventoryId, now({ timezone }), leaseState) : [];
  const publishedConcessionIds = publishedConcessions.map(c => c.id);
  const publishedDBConcessions = await getConcessionsByIds(ctx, publishedConcessionIds);

  const finalDBConcessions = !dbConcessions.length ? publishedDBConcessions : dbConcessions;

  return finalDBConcessions.map(dbConcession => {
    const publishedConcession = publishedConcessions.find(pc => pc.id === dbConcession.id) || {};

    return {
      ...dbConcession,
      ...publishedConcession,
    };
  });
};

export const getLeaseAdditionalData = async (ctx, leaseId) => {
  logger.trace({ ctx, leaseId }, 'getLeaseAdditionalData');
  assert(ctx, 'getLeaseAdditionalData called without a ctx!');
  assert(leaseId, 'getLeaseAdditionalData called without a leaseId!');
  let { authUser } = ctx;
  const { quoteId, leaseTermId, partyId } = await leaseRepo.getLeaseById(ctx, leaseId);
  if (!authUser) {
    // this can happen during sample data import
    authUser = await loadPartyAgent(ctx, partyId);
  }
  assert(authUser, 'getLeaseAdditionalData called without an authUser!');
  const { leaseStartDate, publishedQuoteData, leaseTerms, selections, inventoryId, additionalAndOneTimeCharges, leaseState } = await getQuoteById(ctx, quoteId);
  const additionalCharges = publishedQuoteData?.additionalAndOneTimeCharges?.additionalCharges || [];
  const inventory = await getInventoryById(ctx, {
    id: inventoryId,
    expand: true,
  });
  const { leaseTerms: publishedTerms, ...rest } = publishedQuoteData;
  const publishedTerm = publishedTerms.find(lt => lt.id === leaseTermId);
  const leaseTerm = leaseTerms.find(lt => lt.id === leaseTermId);

  const concessions = await getConcessionsForLease(ctx, {
    leaseTerm,
    inventoryId,
    timezone: inventory.property.timezone,
    leaseState,
    publishedConcessions: publishedTerm.concessions,
  });
  publishedTerm.concessions = concessions;

  const propertySettings = getLeaseSettingsForProperty(inventory.property.name);
  await assignPartyOrUpdateCollaborators(ctx, partyId, [authUser.id]);
  const complimentaryItems = await getComplimentsForInventory(ctx, inventory);
  const buildingAddress = formatBuildingAddress(inventory);

  const { timezone } = inventory.property?.settings || {};
  const leaseAdditionalAndOneTimeCharges = await getLeaseAdditionalAndOneTimeCharges(ctx, {
    additionalCharges,
    inventoryId,
    propertyTimezone: timezone,
    publishedQuoteData,
    selections,
    leaseTerms,
    leaseStartDate,
  });
  return {
    publishedTerm: {
      ...rest,
      ...publishedTerm,
    },
    leaseTerm,
    additionalAndOneTimeCharges: leaseAdditionalAndOneTimeCharges.length ? leaseAdditionalAndOneTimeCharges : additionalAndOneTimeCharges,
    selections,
    inventory: {
      ...inventory,
      complimentaryItems,
    },
    concessions,
    propertyAddress: formatPropertyAddress(inventory.property.address),
    unitAddress: propertySettings.unitAddress(inventory),
    buildingAddress,
  };
};

const getInventoryFromLease = lease => {
  const inventoryType = get(lease, 'baselineData.quote.inventoryType');
  const unitFullQualifiedName = get(lease, 'baselineData.quote.unitFullQualifiedName');
  return { inventoryType, unitFullQualifiedName };
};

const handleEditedLease = async (ctx, existingLease, lease) => {
  const shouldHandleEditedLease =
    existingLease && (existingLease.status === DALTypes.LeaseStatus.SUBMITTED || existingLease.status === DALTypes.LeaseStatus.EXECUTED);
  if (!shouldHandleEditedLease) return {};
  const { id: leaseId } = lease;

  const existingRentableItemIds = getRentableItemIdsFromLease(existingLease.baselineData.publishedLease);
  await releaseInventories(ctx, { inventoryIds: existingRentableItemIds, reason: DALTypes.InventoryOnHoldReason.LEASE, partyId: existingLease.partyId });
  const prevVersionLease = await createLeaseVersion(ctx, leaseId);

  const oldSignatures = await leaseRepo.getLeaseSignatureStatuses(ctx, leaseId);
  const sentToOrSignedBy = getVoidLeaseEmailRecipients(oldSignatures);
  const partyMembers = await getPartyMembersByPartyIds(ctx, [existingLease.partyId]);
  const allPartyMembersSigned = allMembersSigned(partyMembers, oldSignatures);

  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  await leaseProvider.voidLease(ctx, leaseId, envelopeIdsFromOldSignatures(oldSignatures));

  await leaseRepo.updateLeaseSignature(ctx, { status: DALTypes.LeaseSignatureStatus.VOIDED }, { leaseId });

  const termLength = lease?.baselineData?.publishedLease?.termLength || prevVersionLease?.baselineData?.publishedLease?.termLength || null;
  const leaseStartDate = lease?.baselineData?.publishedLease?.leaseStartDate || prevVersionLease?.baselineData?.publishedLease?.leaseStartDate || null;
  await eventService.saveLeaseVersionCreatedEvent(ctx, {
    partyId: existingLease.partyId,
    userId: (ctx.authUser || {}).id,
    metadata: {
      leaseId,
      sentToOrSignedBy,
      allPartyMembersSigned,
      termLength,
      leaseStartDate,
    },
  });

  return { isEditLeaseAction: true };
};

export const publishLease = async (ctx, hostname, lease) => {
  const { id: leaseId } = lease;
  logger.trace({ ctx, hostname, leaseId }, 'publishLease');
  const existingLease = await leaseRepo.getLeaseById(ctx, leaseId);
  const inventoryId = await getInventoryByIdFromLease(ctx, existingLease);

  const { partyId } = existingLease;

  return await runInTransaction(async trx => {
    const newCtx = { ...ctx, trx };

    await validateActionOnInventory(newCtx, ActionTypes.PUBLISH_LEASE, {
      inventoryId,
      partyId,
    });

    const { isEditLeaseAction = false } = await handleEditedLease(newCtx, existingLease, lease);
    const rentableItemIds = getRentableItemIdsFromLease(lease.baselineData.publishedLease);

    const leaseTemplate = await leaseRepo.getLeaseTemplateById(newCtx, existingLease.leaseTemplateId);
    const additionalData = await getLeaseAdditionalData(newCtx, leaseId);
    const baselineData = await enhanceBaseline(newCtx, { ...additionalData, partyId }, lease.baselineData);
    const leaseData = getEnhancedLeaseObject(ctx, leaseTemplate.templateData, baselineData);

    const { inventoryType, unitFullQualifiedName } = getInventoryFromLease({
      baselineData,
    });

    const inventoryLeaseHolds = await getInventoryHolds(newCtx, inventoryId, [DALTypes.InventoryOnHoldReason.LEASE]);
    if (inventoryLeaseHolds.length === 1 && inventoryLeaseHolds[0].partyId !== partyId) {
      throw new ServiceError({
        token: 'INVENTORY_IS_ALREADY_ON_HOLD_BY_OTHER_PARTY',
        status: 412,
      });
    }

    const party = await loadPartyById(newCtx, partyId);

    if (party.leaseType !== DALTypes.PartyTypes.CORPORATE) {
      const allPartyLeaseHolds = await getAllHoldsForParty(newCtx, partyId, [DALTypes.InventoryOnHoldReason.LEASE]);
      const inventoryIdsToRelease = allPartyLeaseHolds.map(hold => hold.inventoryId);
      if (inventoryIdsToRelease.length > 0) {
        logger.trace({ ctx, inventoryIdsToRelease }, 'releaseInventories at publish lease time');
        await releaseInventories(newCtx, { inventoryIds: inventoryIdsToRelease, reason: DALTypes.InventoryOnHoldReason.LEASE, partyId });
      }
    }

    const updated = await leaseRepo.updateLease(
      newCtx,
      {
        id: leaseId,
        leaseData,
        baselineData,
      },
      trx,
    );

    await holdInventory(newCtx, {
      skipExportToMRI: isEditLeaseAction,
      inventoryId,
      rentableItemIds,
      inventoryType,
      unitFullQualifiedName,
      partyId,
      quotable: false,
      startDate: now().toDate(),
      reason: DALTypes.InventoryOnHoldReason.LEASE,
      quoteId: existingLease.quoteId,
      leaseId,
      termLength: lease?.baselineData?.publishedLease?.termLength,
    });

    // TODO: we should confirm leaseStartDate has not passed here!
    await eventService.saveLeasePublishedEvent(newCtx, { partyId, userId: (ctx.authUser || {}).id, metadata: { leaseId } });
    await publishLeaseToLeaseProvider(newCtx, hostname, updated);
    return updated;
  }, ctx);
};

const sendMessageToFetchSignedLease = async (ctx, partyState, leaseId) => {
  logger.trace({ ctx, partyState, leaseId }, 'sendMessageToFetchSignedLease');

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: LEASE_MESSAGE_TYPE.FETCH_SIGNED_LEASE,
    message: {
      tenantId: ctx.tenantId,
      leaseId,
    },
    ctx,
  });
};

const markLeaseAsExecuted = async (ctx, partyState, leaseId, leaseType) => {
  logger.trace({ ctx, partyState, leaseId, leaseType }, 'markLeaseAsExecuted');

  const updatedLease = await leaseRepo.updateLease(
    ctx,
    {
      id: leaseId,
      status: DALTypes.LeaseStatus.EXECUTED,
      signDate: now().toISOString(),
    },
    ctx.trx,
  );
  const showEmergencyContactTask = await shouldShowEmergencyContactTask(ctx, leaseType);
  await eventService.saveLeaseExecutedEvent(ctx, {
    partyId: updatedLease.partyId,
    userId: (ctx.authUser || {}).id,
    metadata: { leaseId, showEmergencyContactTask },
  });
  await sendMessageToFetchSignedLease(ctx, partyState, leaseId);

  logger.trace(
    {
      ctx,
    },
    `Mark lease as executed, send message to create migrate move-in documents task: partyId=${updatedLease.partyId}, moveInDate=${updatedLease.baselineData.publishedLease.moveInDate}`,
  );

  await addLeaseActivityLog(ctx, updatedLease, ACTIVITY_TYPES.EXECUTE);
};

const envelopeCountersigned = async (ctx, lease, envelopeId, inventoryId) => {
  const { id: leaseId, partyId, status: leaseStatus, baselineData } = lease;
  logger.trace({ ctx, leaseId, envelopeId, inventoryId }, 'envelopeCountersigned');

  if (leaseStatus === DALTypes.LeaseStatus.EXECUTED) {
    logger.trace({ ctx, leaseId, envelopeId, inventoryId }, 'envelopeCountersigned - lease already executed');
    return true;
  }

  const signatureStatuses = await leaseRepo.getLeaseSignatureStatuses(ctx, leaseId);
  const shouldMarkLeaseAsExecuted = signatureStatuses && signatureStatuses.every(item => isSignatureStatusSigned(item.status));

  logger.trace({ ctx, leaseId, envelopeId, inventoryId, shouldMarkLeaseAsExecuted }, 'envelopeCountersigned');

  const transition = await performPartyStateTransition(ctx, partyId);
  if (shouldMarkLeaseAsExecuted) {
    const { workflowName, leaseType } = await loadPartyById(ctx, partyId);
    await markLeaseAsExecuted(ctx, transition, leaseId, leaseType);

    leaseType === DALTypes.PartyTypes.TRADITIONAL && (await releaseInventory(ctx, { inventoryId, reasons: [DALTypes.InventoryOnHoldReason.LEASE], leaseId }));
    await releaseManuallyHeldInventoriesByParty(ctx, partyId, inventoryId, leaseId);

    const rentableItemIds = getRentableItemIdsFromLease(baselineData.publishedLease);
    await releaseInventories(ctx, { inventoryIds: rentableItemIds, reason: DALTypes.InventoryOnHoldReason.LEASE, partyId });

    if (workflowName !== DALTypes.WorkflowName.RENEWAL) {
      await updateStateAfterAction(ctx, ActionTypes.EXECUTE_LEASE, inventoryId);
      rentableItemIds.length &&
        (await mapSeries(rentableItemIds, async rentableItemId => await updateStateAfterAction(ctx, ActionTypes.EXECUTE_LEASE, rentableItemId)));
    }
    return true;
  }

  return false;
};

const getSignLeaseDelta = async (ctx, envelopeId, clientUserId, signerId, signingType = DALTypes.LeaseSignatureStatus.SIGNED) => {
  const signature = await leaseRepo.getLeaseSignatureByEnvelopeIdAndClientUserId(ctx, envelopeId, clientUserId);
  const isCountersignerSignature = !!signature.userId;

  const delta = isCountersignerSignature && signerId && signature.userId !== signerId ? { userId: signerId, status: signingType } : { status: signingType };
  delta.metadata = { ...signature.metadata, signDate: new Date().toISOString() };
  return delta;
};

const checkIfLeaseStatusShouldBeFixed = async (ctx, leaseId, envelopeId) => {
  logger.trace({ ctx, leaseId, envelopeId }, 'checkIfLeaseStatusShouldBeFixed');
  const lease = await leaseRepo.getLeaseByEnvelopeId(ctx, envelopeId);
  if (lease.status === DALTypes.LeaseStatus.SUBMITTED) {
    const inventoryId = await getInventoryByIdFromLease(ctx, lease);
    const markedAsExecuted = await envelopeCountersigned(ctx, lease, envelopeId, inventoryId);

    if (markedAsExecuted) {
      logger.trace({ ctx, leaseId, envelopeId, inventoryId }, 'Lease status fixed, marked as EXECUTED');
      return true;
    }
  }

  return false;
};

export const fixLeaseStatusIfNeeded = async ctx => {
  const leasesWithStatusNotUpdated = await leaseRepo.getLeaseWithStatusNotUpdated(ctx);
  await mapSeries(leasesWithStatusNotUpdated, async ({ leaseId, envelopeId }) => await checkIfLeaseStatusShouldBeFixed(ctx, leaseId, envelopeId));
};

// signerId is either the partyMemberId (for signers) or the Reva userId (for countersigners)
export const signLease = async ({ ctx: outerCtx, envelopeId, clientUserId, signerId, inOffice, signingType }) => {
  logger.trace({ ctx: outerCtx, envelopeId, clientUserId, signerId, inOffice }, 'signLease');
  const { tenantId, trx, hostname, reqId } = outerCtx;
  const ctx = { tenantId, trx, hostname, reqId };

  const signLeaseDelta = await getSignLeaseDelta(ctx, envelopeId, clientUserId, signerId, signingType);
  const [signature] = await leaseRepo.markAsSigned(ctx, envelopeId, clientUserId, signLeaseDelta);
  const { partyMemberId, userId } = signature;

  const [partyMember] = await loadPartyMemberById(ctx, partyMemberId);
  const lease = await leaseRepo.getLeaseByEnvelopeId(ctx, envelopeId);
  const { partyId, id: leaseId } = lease;
  const party = await loadParty(ctx, partyId);
  const authUser = userId ? await getUserById(ctx, userId) : await getUserById(ctx, party.userId);
  const inventoryId = await getInventoryByIdFromLease(ctx, lease);
  const oldSignatures = await leaseRepo.getLeaseSignatureStatuses(ctx, leaseId);
  const allPartyMembersSigned = allMembersSigned([...lease.baselineData.residents, ...lease.baselineData.guarantors], oldSignatures);

  const signatureType = inOffice ? ACTIVITY_TYPES.IN_OFFICE_SIGNATURE : ACTIVITY_TYPES.SIGN;
  const activityType = userId ? ACTIVITY_TYPES.COUNTERSIGN : signatureType;

  let signMethod;
  if (inOffice) {
    signMethod = DALTypes.ActivityLogSigningType.DIGITAL_IN_OFFICE_SIGNATURE;
  } else if (signingType === DALTypes.LeaseSignatureStatus.WET_SIGNED) {
    signMethod = DALTypes.ActivityLogSigningType.WET_SIGNATURE;
  } else {
    signMethod = DALTypes.ActivityLogSigningType.DIGITAL_SIGNATURE;
  }

  await addLeaseActivityLog(ctx, lease, activityType, partyMember ? partyMember.fullName : authUser.fullName, null, signMethod);
  logger.trace({ ctx: outerCtx, envelopeId, clientUserId, signerId, inOffice }, 'signLease - activity log created');

  ctx.authUser = authUser;

  if (userId) {
    await eventService.saveLeaseCountersignedEvent(ctx, {
      partyId: party.id,
      userId,
      metadata: { leaseId, envelopeId, inOffice: !!inOffice, clientUserId },
    });
  } else {
    const signDate = allPartyMembersSigned && now().toISOString();
    await eventService.saveLeaseSignedEvent(ctx, {
      partyId: party.id,
      partyMemberId,
      metadata: { leaseId, envelopeId, inOffice: !!inOffice, clientUserId, signDate },
    });
  }

  if (userId) {
    const markedAsExecuted = await envelopeCountersigned(ctx, lease, envelopeId, inventoryId);
    logger.trace({ ctx: outerCtx, envelopeId, clientUserId, signerId, inOffice, markedAsExecuted }, 'signLease - countersigner flow');
  }

  notify({
    ctx,
    event: eventTypes.LEASE_UPDATED,
    data: { partyId },
    routing: { teams: party.teams },
  });

  return true;
};

// statuses includes both CS and partymembers here
// signerId is a Reva userId
// TODO: simplify this function
export const updateEnvelopeStatusInDb = async (ctx, lease, envelopeId, statuses, signerId, inOffice, view) => {
  const { id: leaseId } = lease;
  logger.trace({ ctx, leaseId, envelopeId, statuses, signerId, inOffice, view }, 'updateEnvelopeStatusInDb');

  return await runInTransaction(async trx => {
    const newCtx = { ...ctx, trx };

    const leaseOpenForViewOnly = view === true;
    if (leaseOpenForViewOnly) {
      const authUser = await getUserById(newCtx, signerId);
      return await addLeaseActivityLog({ ...newCtx, authUser }, lease, ACTIVITY_TYPES.VIEW);
    }

    const declined = statuses.find(x => x.recipientStatus === DALTypes.LeaseStatusEvent.DECLINED);

    // This is a notification from the client that the user declined the lease.  We will void it regardless
    // of the current provider status.
    if (declined) {
      const userId = ((await leaseRepo.getLeaseSignatureStatuses(newCtx, leaseId)).find(s => s.userId) || {}).userId;
      const authUser = await getUserById(newCtx, userId);
      const teams = await getUserTeams(newCtx, userId);

      await voidLease({ ...newCtx, authUser: { ...authUser, teams } }, leaseId);
      return [true];
    }

    const eachRes = await each(statuses, async ({ clientUserId, recipientStatus, userName, email }) => {
      assert(clientUserId, 'eachRes called without an clientUserId!');
      let dbSignatureStatus = await leaseRepo.getLeaseSignatureByEnvelopeIdAndClientUserId(ctx, envelopeId, clientUserId);
      logger.trace({ ctx: newCtx, clientUserId, recipientStatus, userName, dbSignatureStatus, email }, 'updateEnvelopeStatusInDb');

      if (recipientStatus === DALTypes.LeaseStatusEvent.COMPLETED && dbSignatureStatus && !isSignatureStatusSigned(dbSignatureStatus.status)) {
        // Need to update DB with the status that was sent from the client
        const isCountersignerSignature = !!dbSignatureStatus.userId;

        if (isCountersignerSignature && dbSignatureStatus && dbSignatureStatus?.metadata?.email !== email) {
          let authUser = await getUserByEmail(newCtx, email);

          // For bluemoon, we don't get the email, just the name and right now this is incorrect,
          // so we use the userId from the signatureStatus table
          if (!authUser) {
            logger.warn(
              { ctx: newCtx, leaseId, envelopeId, clientUserId, signerId, email },
              'Provider returned email that does not match an agent - will use logged in user instead',
            );
            authUser = await getUserById(newCtx, dbSignatureStatus.userId);
          }
          if (!authUser) {
            logger.error(
              { ctx: newCtx, leaseId, envelopeId, clientUserId, signerId, email },
              'Lease execution failed. No matching leasing agent for signer email.',
            );

            throw new ServiceError({
              token: 'NO_MATCHING_LEASING_AGENT_FOR_EMAIL',
              status: 412,
              data: { email },
            });
          }

          dbSignatureStatus = await leaseRepo.updateCounterSignerSignature(newCtx, dbSignatureStatus, authUser);

          logger.trace(
            { ctx: newCtx, leaseId, envelopeId, clientUserId, email, oldEmail: dbSignatureStatus.metadata.email },
            'updateEnvelopeStatusInDb - signer email changed',
          );
        }

        return await signLease({
          ctx: newCtx,
          envelopeId,
          clientUserId,
          signerId,
          inOffice,
        });
      }

      if (dbSignatureStatus && dbSignatureStatus?.metadata?.userName !== userName) {
        // Signer changed the name in Docusign, update it on our end as well so we can still fetch tokens for that signer
        const leaseProvider = await leaseProviderFactory.getProvider(ctx);
        const isCountersignerSignature = !!dbSignatureStatus.userId;
        // This is temporary. What we are getting from BLue moon is not the data that is set during the signature of the doc
        // so for now, we update the signer when the token is requested, and don't reset it base don what the back-end says
        if (leaseProvider.providerName !== LeaseProviderName.BLUEMOON || !isCountersignerSignature) {
          await leaseRepo.updateSignerName(newCtx, dbSignatureStatus.id, userName);
          logger.trace(
            { ctx: newCtx, leaseId: lease.id, envelopeId, clientUserId, userName, oldUserName: dbSignatureStatus.metadata.username },
            'updateEnvelopeStatus - signer name changed',
          );
        }
      }
      return true;
    });

    return eachRes;
  }, ctx);
};

// called from recurring job to update all pending leases
// also called by executeLease endpoint which updates the signature via signed token
// is expected to return "true" or throw on error
// TODO: this should return updated lease signatures in addition
export const updateSignatureStatus = async ({ ctx, envelopeId, lease, clientUserId, recipientStatus, userName, email, signerId, inOfficeSignature, view }) => {
  const { id: leaseId } = lease;
  logger.trace({ ctx, leaseId, envelopeId, clientUserId, signerId, recipientStatus, inOfficeSignature, view }, 'updateSignatureStatus');

  const requestorData = { clientUserId, recipientStatus, userName, email }; // These values are injected into the mock FADV response when using FADV Mode = Fake
  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  const providerStatuses = await leaseProvider.getEnvelopeStatus(ctx, leaseId, envelopeId, requestorData);

  const providerStatusMatchingRequested = providerStatuses.find(s => s.clientUserId === clientUserId && s.recipientStatus === recipientStatus);
  const doesProviderAlreadyMatchRequestedStatus = !!providerStatusMatchingRequested;

  if (doesProviderAlreadyMatchRequestedStatus) {
    // we've been requested to update to a status that already matches the provider status, so update our DB
    // This will be pretty rare, requiring agent to execute lease in BM (or perhaps in other Reva UI) while in the
    // ReviewLease page
    logger.trace(
      {
        ctx,
        providerStatusMatchingRequested,
        leaseId,
        envelopeId,
        clientUserId,
        signerId,
        recipientStatus,
        inOfficeSignature,
        view,
        providerStatuses,
      },
      'provider status already matches what was requested from the UI - updating reva DB',
    );
    const updateRes = await updateEnvelopeStatusInDb(ctx, lease, envelopeId, [providerStatusMatchingRequested], signerId, inOfficeSignature, view);
    logger.trace({ ctx, updateRes, leaseId, envelopeId, clientUserId, signerId, recipientStatus, inOfficeSignature, view, providerStatuses }, 'update result');
    return updateRes;
  }

  let executeResult = false;
  logger.trace(
    { ctx, leaseId, envelopeId, clientUserId, signerId, recipientStatus, inOfficeSignature, view, providerStatuses },
    'updateSignatureStatus -> envelopeStatus',
  );

  if (clientUserId === 'CounterSigner1' && recipientStatus === DALTypes.LeaseStatusEvent.COMPLETED) {
    logger.trace({ ctx }, 'executing lease');
    // For now we will use authUser to get the "owner" info and title

    // we've been asked to countersign the lease, so do so...
    executeResult = await leaseProvider.executeLease(ctx, leaseId, envelopeId, signerId);
    logger.trace({ ctx, executeResult }, 'provider returned from executeLease');
  }

  if (!executeResult) {
    logger.warn(
      { ctx, leaseId, envelopeId, clientUserId, signerId, recipientStatus, inOfficeSignature, view },
      'updateSignatureStatus - SKIPPED, provider returned different status',
    );
  }
  return [executeResult];
};

// clientUserId is used only for bluemoon right now. This is because signer and countersigner tokens are not requested from bluemon, but we want to store in LeaseSubmissionTracking who requested this envelope status update
const processEnvelopeStatus = async (ctx, lease, envelopeId, requestorData = {}) => {
  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  const statuses = await leaseProvider.getEnvelopeStatus(ctx, lease.id, envelopeId, requestorData);

  const allProcessed = await updateEnvelopeStatusInDb(ctx, lease, envelopeId, statuses);
  return { processed: allProcessed.every(p => p) };
};

// This is called from the UI, as well as from worker to periodiically update leases
// it updates the lease statuses from the provider.
// TODO: rename to refreshLeaseStatusFromProvider
// also called by ExecuteLease page (for BM case)
// also called by signature-confirmation page (for both BM and FADV case)
export const updateLeaseStatus = async (ctx, leaseId, requestorData = {}) => {
  logger.trace({ ctx, leaseId }, 'updateLeaseStatus');
  const lease = await leaseRepo.getLeaseById(ctx, leaseId);
  const signatures = await leaseRepo.getLeaseSignatureStatuses(ctx, leaseId);

  if (!signatures) {
    throw new ServiceError({
      token: 'LEASE_SIGNATURE_DOES_NOT_EXIST',
      status: 412,
    });
  }
  const envelopeIds = uniq(signatures.map(s => s.envelopeId));

  return await mapSeries(envelopeIds, async envelopeId => await processEnvelopeStatus(ctx, lease, envelopeId, requestorData));
};

export const updateLeaseStatusByEnvelopeId = async (ctx, leaseId, envelopeId) => {
  logger.trace({ ctx, leaseId, envelopeId }, 'updateLeaseStatusByEnvelopeId');
  const lease = await leaseRepo.getLeaseById(ctx, leaseId);
  return await processEnvelopeStatus(ctx, lease, envelopeId);
};

export const reassignCountersignerSignatureStatuses = async (ctx, partyId, newOwnerId) => {
  logger.trace({ ctx, partyId, newOwnerId }, 'reassignCountersignerSignatureStatuses');
  const partyLeases = await leaseRepo.getPartyLeases(ctx, partyId);

  await mapSeries(partyLeases, async lease => {
    const { id: leaseId } = lease;
    const signatures = await leaseRepo.getLeaseSignatureStatuses(ctx, leaseId);
    const counterSignerSignature = signatures.find(s => s.userId);

    if (counterSignerSignature && !isSignatureStatusSigned(counterSignerSignature.status)) {
      const property = await leaseRepo.getPropertyForLease(ctx, leaseId);
      const userIds = await getUserIdsWithFunctionalRolesForProperty(ctx, partyId, FunctionalRoleDefinition.LCA.name, property.propertyId);
      if (userIds.includes(newOwnerId)) {
        await leaseRepo.updateLeaseSignature(ctx, { userId: newOwnerId }, { id: counterSignerSignature.id });
      }
    }
  });
};

const wasLeaseAlreadyCountersignedInProvider = async ({ ctx, leaseId, envelopeId, clientUserId }) => {
  logger.trace({ ctx, envelopeId, clientUserId }, 'wasLeaseAlreadyCountersignedInProvider - params');
  await updateLeaseStatus(ctx, leaseId);

  const signature = await leaseRepo.getLeaseSignatureByEnvelopeIdAndClientUserId(ctx, envelopeId, clientUserId);
  const wasAlreadySigned = isSignatureStatusSigned(signature.status);
  logger.trace({ ctx, envelopeId, clientUserId, signature, wasAlreadySigned }, 'wasLeaseAlreadyCountersignedInProvider - result');

  return wasAlreadySigned;
};

const getCounterSignerToken = async ({ ctx, hostname, lease, envelopeId, clientUserId }) => {
  const { id: leaseId, status: leaseStatus, baselineData } = lease;
  logger.trace({ ctx, leaseId, envelopeId, clientUserId }, 'getCounterSignerToken - params');

  try {
    const leaseExecuted = leaseStatus === DALTypes.LeaseStatus.EXECUTED;
    const leaseProvider = await leaseProviderFactory.getProvider(ctx);
    const token = await leaseProvider.getCounterSignerToken(
      ctx,
      leaseId,
      envelopeId,
      clientUserId,
      ctx.authUser.fullName,
      ctx.authUser.email,
      hostname,
      ctx.authUser.id,
      leaseExecuted,
    );

    // The Bluemoon implementation is relying on the fact that the countersigner username and email are stored when we get
    // the counter url/token. The values that we get back from Bluemoon being the ones that come from the settings,
    // and not the ones that the signer enters.
    if (leaseProvider.providerName === LeaseProviderName.BLUEMOON) {
      const signature = await leaseRepo.getLeaseSignatureByEnvelopeIdAndClientUserId(ctx, envelopeId, clientUserId);
      await leaseRepo.updateCounterSignerSignature(ctx, signature, ctx.authUser);
    }

    return { token, propertyName: baselineData.quote.propertyName };
  } catch (error) {
    logger.error({ ctx, error, leaseId, envelopeId, clientUserId }, 'getCounterSignerToken - error');
    if (await wasLeaseAlreadyCountersignedInProvider({ ctx, leaseId, envelopeId, clientUserId })) {
      throw new ServiceError({
        token: LEASE_SIGNING_ERROR_TOKENS.LEASE_ALREADY_COUNTERSIGNED,
        status: 412,
        data: { propertyName: baselineData.quote.propertyName },
      });
    }

    throw error;
  }
};

export const getSignerToken = async (ctx, envelopeId, clientUserId, hostname, inOfficeSignature) => {
  logger.trace({ ctx, envelopeId, clientUserId, hostname, inOfficeSignature }, 'getSignerToken');
  const lease = await leaseRepo.getLeaseByEnvelopeId(ctx, envelopeId);
  const { id: leaseId, baselineData } = lease;
  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  if (leaseProvider.providerName === LeaseProviderName.BLUEMOON) {
    const { propertyId } = await leaseRepo.getPropertyForLease(ctx, leaseId);
    await leaseProvider.syncSignatureStatuses(ctx, propertyId);
  }
  const signature = await leaseRepo.getLeaseSignatureByEnvelopeIdAndClientUserId(ctx, envelopeId, clientUserId);

  if (!signature) {
    throw new ServiceError({
      token: 'LEASE_SIGNATURE_DOES_NOT_EXIST',
      status: 412,
    });
  }

  if (signature.status === DALTypes.LeaseSignatureStatus.VOIDED) {
    logger.trace({ ctx, envelopeId, clientUserId, hostname, inOfficeSignature, voided: true }, 'getSignerToken for voided lease');

    const [partyMember] = await loadPartyMemberById(ctx, signature.partyMemberId);
    const recipient = {
      fullName: signature.metadata.userName || partyMember.fullName,
      email: signature.metadata.email || partyMember.contactInfo.defaultEmail,
    };
    // if lease is voided, we want to redirect to the "confirmLease" view that displays the voided lease status
    // to the user
    const token = await leaseProvider.getLeaseConfirmationUrl(ctx, {
      leaseId,
      envelopeId,
      clientUserId,
      recipient,
      host: hostname,
      signerId: signature.partyMemberId || partyMember.id,
      inOfficeSignature,
    });
    return { token, status: signature.status };
  }
  logger.trace({ ctx, envelopeId, clientUserId, leaseId }, 'Refreshing lease signature status before requesting token');
  await updateLeaseStatus(ctx, leaseId, { clientUserId, submissionType: clientUserId === 'CounterSigner1' ? 'GetCounterSignerToken' : 'GetSignerToken' });

  if (signature.partyMemberId && isSignatureStatusSigned(signature.status)) {
    logger.trace({ ctx, envelopeId, clientUserId, leaseId }, 'getSignerToken - Lease is already signed');
    throw new ServiceError({
      token: LEASE_SIGNING_ERROR_TOKENS.LEASE_ALREADY_SIGNED,
      status: 412,
      data: { propertyName: baselineData.quote.propertyName },
    });
  }

  if (signature.userId && isSignatureStatusSigned(signature.status)) {
    logger.trace({ ctx, envelopeId, clientUserId, leaseId }, 'getSignerToken - Lease is already countersigned');
    throw new ServiceError({
      token: LEASE_SIGNING_ERROR_TOKENS.LEASE_ALREADY_COUNTERSIGNED,
      status: 412,
      data: { propertyName: baselineData.quote.propertyName },
    });
  }

  if (signature.partyMemberId) {
    logger.trace({ ctx, envelopeId, clientUserId, leaseId, partyMemberId: signature.partyMemberId }, 'getSignerToken - Lease is for party member');
    const [partyMember] = await loadPartyMemberById(ctx, signature.partyMemberId);
    const recipient = {
      fullName: signature.metadata.userName || partyMember.fullName,
      email: signature.metadata.email || partyMember.contactInfo.defaultEmail,
    };

    logger.trace({ ctx, envelopeId, clientUserId, leaseId, recipient }, 'getSignerToken - fetching "token" for partyMember');
    const token = await leaseProvider.getSignerToken(ctx, signature.leaseId, envelopeId, clientUserId, recipient, hostname, partyMember.id, inOfficeSignature);
    return { token, propertyName: baselineData.quote.propertyName };
  }

  logger.trace({ ctx, envelopeId, clientUserId, leaseId }, 'getSignerToken - fetching "token" for countersigner');
  return await getCounterSignerToken({ ctx, hostname, lease, envelopeId, clientUserId });
};

export const sendLeaseEmail = async (ctx, partyId, emailInfo) => {
  logger.trace({ ctx, partyId, emailInfo }, 'send party lease email');

  switch (emailInfo.type) {
    case DALTypes.PartyEventType.LEASE_EXECUTED: {
      await sendExecutedLeaseMail(ctx, { ...emailInfo, messageType: LeaseEmailType.EXECUTE });
      break;
    }
    case DALTypes.PartyEventType.LEASE_VOIDED:
    case DALTypes.PartyEventType.LEASE_VERSION_CREATED: {
      await sendVoidedLeaseMail(ctx, { ...emailInfo, messageType: LeaseEmailType.VOID });
      break;
    }
    case DALTypes.PartyEventType.LEASE_SENT: {
      await sendSignLeaseMail(ctx, { ...emailInfo, messageType: LeaseEmailType.SENT });
      break;
    }
    default:
      break;
  }
};

export const hasLeaseExpired = (lease, timezone) => {
  const { leaseEndDate } = lease;

  if (!leaseEndDate) {
    return false;
  }

  return isDateInThePast(leaseEndDate, { timezone, timeUnit: 'day' });
};

export const getEligibleNewLeasesForActiveLeaseWorkflow = async (ctx, filters) =>
  await leaseRepo.getEligibleLeasesForActiveLeaseWorkflow(ctx, DALTypes.WorkflowName.NEW_LEASE, filters, true);

export const getEligibleRenewalLeasesForActiveLeaseWorkflow = async (ctx, filters) =>
  await leaseRepo.getEligibleLeasesForActiveLeaseWorkflow(ctx, DALTypes.WorkflowName.RENEWAL, filters, true);

export const voidExecutedLease = async (ctx, leaseId, partyId) => {
  logger.trace({ ctx, partyId, leaseId }, 'voidExecutedLease - service');

  const newLeaseParty = await loadPartyById(ctx, partyId);
  if (newLeaseParty.workflowState === DALTypes.WorkflowState.ARCHIVED) {
    await unarchiveParty(ctx, partyId);
  }

  await closeLease(ctx, leaseId, partyId, true);

  logger.trace({ ctx, partyId, leaseId }, 'voidExecutedLease - done');
  return partyId;
};

export const envelopeIdsForLease = async (ctx, leaseId) => {
  logger.trace({ ctx, leaseId }, 'Getting envelope Ids for lease');
  const signatureStatuses = await leaseRepo.getLeaseSignatureStatuses(ctx, leaseId);
  const envelopeIds = uniq(signatureStatuses.map(item => item.envelopeId)).map(envelopeId => ({
    envelopeId,
    isForGuarantor: !!signatureStatuses.find(sign => sign.envelopeId === envelopeId && sign.metadata.clientUserId.startsWith('Guarantor')),
  }));
  return envelopeIds;
};

export const getLeaseDocumentStream = async (ctx, leaseId) => {
  logger.trace({ ctx, leaseId }, 'Getting lease document stream for lease');
  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  const envelopeIds = (await envelopeIdsForLease(ctx, leaseId)).filter(e => !e.isForGuarantor);
  if (envelopeIds.length !== 1) {
    logger.error({ ctx, leaseId, envelopeIds }, 'Unexpectedly found more that 1 non-guarantor envelope for lease');
  }
  const { envelopeId } = envelopeIds[0];
  const stream = leaseProvider.getLeaseDocumentStream(ctx, leaseId, envelopeId);
  return stream;
};

export const syncLeaseSignatures = async (ctx, leaseId, partyId) => {
  logger.trace({ ctx, leaseId }, 'syncLeaseSignatures - leaseService');

  const leaseProvider = await leaseProviderFactory.getProvider(ctx);

  if (leaseProvider.providerName !== LeaseProviderName.BLUEMOON) {
    throw new ServiceError({
      token: 'LEASE_PROVIDER_IS_NOT_BLUEMOON',
      status: 412,
    });
  }

  const { propertyId } = await leaseRepo.getPropertyForLease(ctx, leaseId);

  await leaseProvider.syncSignatureStatuses(ctx, propertyId);

  partyId &&
    (await notify({
      ctx,
      event: eventTypes.PARTY_DETAILS_UPDATED,
      data: { partyId },
    }));

  return await leaseRepo.getLeaseSignatureStatuses(ctx, leaseId);
};

const verifyIfWetSigningIsAllowedOnProperty = async (ctx, signature) => {
  logger.trace({ ctx, signature }, 'verifyIfWetSigningIsAllowedOnProperty');

  const property = await leaseRepo.getPropertyForLease(ctx, signature.leaseId);
  const residentSignatureTypes = property?.settings?.lease?.residentSignatureTypes;
  const guarantorSignatureTypes = property?.settings?.lease?.guarantorSignatureTypes;
  const [partyMember] = await loadPartyMemberById(ctx, signature.partyMemberId);

  if (
    (partyMember?.memberType === DALTypes.MemberType.RESIDENT && !residentSignatureTypes.includes(DALTypes.LeaseSignatureTypes.WET)) ||
    (partyMember?.memberType === DALTypes.MemberType.GUARANTOR && !guarantorSignatureTypes.includes(DALTypes.LeaseSignatureTypes.WET))
  ) {
    throw new ServiceError({
      token: 'WET_SIGNING_NOT_ALLOWED_ON_PROPERTY_FOR_PARTY_MEMBER_TYPE',
      status: 412,
    });
  }
};

export const markAsWetSigned = async (ctx, leaseId, partyId, signature) => {
  logger.trace({ ctx, partyId, leaseId, signature }, 'syncLeaseSignatures - leaseService');

  await verifyIfWetSigningIsAllowedOnProperty(ctx, signature);
  const { propertyId } = await leaseRepo.getPropertyForLease(ctx, leaseId);
  const updatedSignatures = await syncLeaseSignatures(ctx, leaseId, partyId);
  const updatedSignature = updatedSignatures.find(s => s.clientUserId === signature.clientUserId);

  await signLease({
    ctx,
    envelopeId: updatedSignature.envelopeId,
    clientUserId: updatedSignature.clientUserId,
    signerId: updatedSignature.partyMemberId,
    signingType: DALTypes.LeaseSignatureStatus.WET_SIGNED,
  });

  const sentToOrSignedBy = getVoidLeaseEmailRecipients([signature]);
  sentToOrSignedBy?.length &&
    (await eventService.saveLeaseVersionCreatedEvent(ctx, {
      partyId,
      userId: (ctx.authUser || {}).id,
      metadata: {
        leaseId,
        sentToOrSignedBy,
        allPartyMembersSigned: false,
      },
    }));

  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  await leaseProvider.syncSignatureStatusesAfterSigningIfNeeded(ctx, propertyId, updatedSignature.envelopeId);
};
