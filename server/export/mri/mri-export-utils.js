/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import newUUID from 'uuid/v4';
import sortBy from 'lodash/sortBy';
import pick from 'lodash/pick';
import drop from 'lodash/drop';
import { mapSeries } from 'bluebird';

import { DALTypes } from '../../../common/enums/DALTypes';
import { write } from '../../../common/helpers/xfs';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import config from '../../config';
import { insertInto, runInTransaction, updateOne } from '../../database/factory';
import * as exportRepo from '../../dal/exportRepo';
import { loadPartyById } from '../../services/party';
import { ExportType } from './export';
import { assert } from '../../../common/assert';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export/mri' });
import { archiveExternalInfo } from '../../services/externalPartyMemberInfo';
import { isCorporateParty } from '../../../common/helpers/party-utils';
import { electPrimaryTenant, isTypeResident } from '../common-export-utils';
import { getOldestExportMessageByPartyId, lockMriExportQueueTable, saveMriExportQueueMessage } from '../../dal/mri-export-repo';
import { sendMessage } from '../../services/pubsub';
import { APP_EXCHANGE, EXPORT_MESSAGE_TYPE } from '../../helpers/message-constants';

export const getPartyMember = pm => ({
  ...pm.partyMember,
  fullName: pm.person.fullName,
  contactInfo: pm.contactInfo && pick(enhance(pm.contactInfo), ['defaultEmail', 'defaultPhone']),
});

const memberTypeChanged = member => !isTypeResident(member.partyMember.memberType);

const savePrimaryTenant = async (ctx, primaryTenant, externalInfo, propertyId) => {
  logger.trace({ ctx, primaryTenant, externalInfo, propertyId }, 'savePrimaryTenant');

  const { id, partyId } = primaryTenant.partyMember;
  return await exportRepo.insertOrUpdateExternalInfo(
    ctx,
    {
      id: (externalInfo && externalInfo.id) || newUUID(),
      partyMemberId: id,
      partyId,
      leaseId: (externalInfo && externalInfo.leaseId) || null,
      isPrimary: true,
      propertyId,
    },
    { conflictColumns: ['id'] },
  );
};

export const archiveRemovedMembers = async (ctx, partyId, members, propertyId) => {
  logger.trace({ ctx, partyId, members, propertyId }, 'archiveRemovedMembers');

  const externals = await exportRepo.getActiveExternalInfoByPartyForMRI(ctx, partyId, propertyId);

  await mapSeries(members, async member => {
    const isRemoved = member.partyMember.endDate;
    const externalInfo = externals.find(e => e.partyMemberId === member.partyMember.id);
    if (isRemoved && externalInfo) {
      logger.trace({ ctx, partyId, externalInfo }, 'Archiving external info for removed member.');
      await archiveExternalInfo(ctx, externalInfo);
    }
  });
};

const savePrimaryTenantWithExternalInfo = async (ctx, corporateParty, primaryTenant, propertyId, leaseId) => {
  logger.trace({ ctx, corporateParty, primaryTenant, propertyId, leaseId }, 'savePrimaryTenantWithExternalInfo');

  let externalInfo = await exportRepo.getActiveExternalInfoForMRI(ctx, primaryTenant.partyMember.id, propertyId, leaseId);
  if (corporateParty) externalInfo = { ...externalInfo, leaseId };
  return await savePrimaryTenant(ctx, primaryTenant, externalInfo, propertyId);
};

const setNewPrimaryTenant = async (ctx, partyDocument, leaseId) => {
  logger.trace({ ctx, partyId: partyDocument.id, leaseId }, 'setNewPrimaryTenant');

  const corporateParty = isCorporateParty(partyDocument);
  const activeMembers = partyDocument.members.filter(pm => !pm.partyMember.endDate);
  const propertyId = partyDocument.assignedPropertyId;

  const primaryPartyMemberInfo = electPrimaryTenant(
    ctx,
    activeMembers.map(m => m.partyMember),
  );
  const primaryTenant = activeMembers.find(m => m.partyMember.id === primaryPartyMemberInfo.id);

  const allExternals = await exportRepo.getActiveExternalInfoByParty(ctx, { partyId: partyDocument.id });
  const differentPropertyExternal = allExternals.find(ext => ext.propertyId !== partyDocument.assignedPropertyId);

  if (differentPropertyExternal) {
    const oldPropertyId = differentPropertyExternal.propertyId;
    logger.trace({ ctx, partyId: partyDocument.id, oldPropertyId, newPropertyId: propertyId }, 'setNewPrimaryTenant - property changed');
    await exportRepo.archiveAllExternalInfoByPartyAndProperty(ctx, {
      partyId: partyDocument.id,
      propertyId: oldPropertyId,
      leaseId: corporateParty && leaseId,
    });
  }

  // If there are exported members but no primary, means the primary has been removed
  // in which case we create new guest cards for everyone
  allExternals.length &&
    (await exportRepo.archiveAllExternalInfoByPartyAndProperty(ctx, {
      partyId: partyDocument.id,
      propertyId,
      leaseId: corporateParty && leaseId,
    }));

  logger.trace({ ctx, primaryTenant }, 'Setting new primary tenant');
  const externalInfo = await savePrimaryTenantWithExternalInfo(ctx, corporateParty, primaryTenant, propertyId, leaseId);

  return {
    primaryTenant,
    externalInfo,
  };
};

export const processExportMessage = async (ctx, { partyId, exportSteps, data, extraPayload, mriExportAction }) =>
  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    logger.trace({ ctx: innerCtx, partyId }, `Export MRI - ${mriExportAction} - MRIExportQueue table lock`);

    await lockMriExportQueueTable(innerCtx, partyId);

    const { id: lastMriExportMessageId } = await saveMriExportQueueMessage(innerCtx, {
      partyId,
      exportData: { exportSteps, data, ...extraPayload, mriExportAction },
    });

    const anotherMriExportMessageAlreadyExists = !!(await getOldestExportMessageByPartyId(innerCtx, partyId, lastMriExportMessageId));

    if (anotherMriExportMessageAlreadyExists) {
      logger.info(
        { ctx: innerCtx, partyId },
        `Export MRI - ${mriExportAction} - An older MRI export queue message for this party already exists, will not add this to RMQ`,
      );
      return;
    }

    await sendMessage({
      exchange: APP_EXCHANGE,
      key: EXPORT_MESSAGE_TYPE.EXPORT_TO_MRI,
      message: {
        partyId,
      },
      ctx: innerCtx,
    });
    logger.info({ ctx: innerCtx, partyId }, `Export MRI - ${mriExportAction} - enqueued`);
  });

export const getExternalInfo = async (ctx, partyDocument, leaseId, includeArchivedPartiesAndMembers = false) => {
  logger.trace({ ctx, partyId: partyDocument.id, leaseId }, 'getExternalInfo MRI');

  let primaryTenant;
  const corporateParty = isCorporateParty(partyDocument);
  const propertyId = partyDocument.assignedPropertyId;

  await archiveRemovedMembers(ctx, partyDocument.id, partyDocument.members, propertyId);
  let externalInfo = await exportRepo.getPrimaryExternalInfoByPartyAndProperty(ctx, partyDocument.id, propertyId, leaseId, includeArchivedPartiesAndMembers);

  let primaryTenantInDb;
  if (externalInfo) {
    primaryTenantInDb = partyDocument.members.find(pm => pm.partyMember.id === externalInfo.partyMemberId);
    if (corporateParty && leaseId) {
      if (externalInfo.leaseId) {
        if (externalInfo.leaseId !== leaseId) primaryTenantInDb = null;
      } else {
        externalInfo = await exportRepo.updateExternalInfo(ctx, { ...externalInfo, leaseId });
      }
    }
  }

  if (!primaryTenantInDb || memberTypeChanged(primaryTenantInDb)) {
    const msg = !primaryTenantInDb ? 'No primary tenant set' : 'The member type of the primary tenant has changed';
    ({ primaryTenant, externalInfo } = await setNewPrimaryTenant(ctx, partyDocument, leaseId));
    logger.trace({ ctx, primaryTenant }, `${msg}, setting primary tenant`);
  } else {
    primaryTenant = primaryTenantInDb;
  }

  assert(primaryTenant, 'getExternalInfo: Primary tenant could not be elected !');

  const party = await loadPartyById(ctx, partyDocument.id);
  const partyMembers = party.partyMembers.map(pm => ({
    ...pick(pm, ['id', 'endDate', 'fullName', 'personId']),
    contactInfo: pick(pm.contactInfo, ['defaultEmail', 'defaultPhone']),
  }));

  return {
    primaryTenant: pick(getPartyMember(primaryTenant), ['id', 'endDate', 'fullName', 'contactInfo', 'personId']),
    externalInfo,
    party: {
      ...pick(party, ['id', 'state', 'leaseType', 'qualificationQuestions', 'startDate', 'endDate', 'metadata', 'storedUnitsFilters', 'created_at']),
      partyMembers,
    },
    property: {
      id: party.assignedPropertyId,
    },
  };
};

export const getPartyMemberByPersonId = (partyDocument, personId, includeInactive = true) => {
  const member = includeInactive
    ? partyDocument.members.find(pm => pm.partyMember.personId === personId)
    : partyDocument.members.find(pm => pm.partyMember.personId === personId && pm.partyMember.endDate === null);

  return getPartyMember(member);
};

const getMriExportFilePath = (tenantId, fileType, timestamp) =>
  path.join(path.resolve(config.aws.efsRootFolder), tenantId, 'export', `${timestamp}-${fileType}-${newUUID().split('-')[0]}.xml`);

export const writeFile = async (ctx, fileType, fileContent, timestamp) => {
  if (!fileContent) return;

  const exportFilePath = getMriExportFilePath(ctx.tenantId, fileType, timestamp);
  await write(exportFilePath, fileContent);
};

export const sortByMemberType = partyMembers => {
  const types = [DALTypes.MemberType.RESIDENT, DALTypes.MemberType.OCCUPANT, DALTypes.MemberType.GUARANTOR];
  return sortBy(partyMembers, pm => types.indexOf(pm.memberType));
};

export const saveMRIExportTracking = async (ctx, mriExportTracking) => {
  const { sessionStartTime } = ctx;
  try {
    return await insertInto(ctx.tenantId, 'MRIExportTracking', { ...mriExportTracking, ...(sessionStartTime && { sessionStartTime }) });
  } catch (error) {
    logger.error({ ctx, error, mriExportTracking }, 'Export MRI - error while saving the tracking information.');
    return {};
  }
};

export const updateMRIExportTracking = async (ctx, mriExportTracking) => {
  if (!mriExportTracking.id) return {};

  try {
    return await updateOne(ctx.tenantId, 'MRIExportTracking', mriExportTracking.id, mriExportTracking);
  } catch (error) {
    logger.error({ ctx, error, mriExportTracking }, 'Export MRI - error while updating the tracking information.');
    return {};
  }
};

const generateMembersExportSteps = async (ctx, partyDocument, data, signedLease, exportType) => {
  const { members } = partyDocument;
  const { primaryTenant } = data;
  const activePartyMembers = (members || []).filter(pm => !pm.partyMember.endDate);
  const types = [DALTypes.MemberType.RESIDENT, DALTypes.MemberType.OCCUPANT, DALTypes.MemberType.GUARANTOR, DALTypes.AdditionalPartyMemberType.CHILD];

  // primary first, then sort by member type and created_at
  let unsortedMembers;
  // only export children when the lease is signed
  if (signedLease) {
    unsortedMembers = [...activePartyMembers.map(pm => getPartyMember(pm)), ...data.children];
  } else {
    unsortedMembers = activePartyMembers.map(pm => getPartyMember(pm));
  }
  const sortCriteria = [pm => (pm.id === primaryTenant.id ? 0 : 1), pm => types.indexOf(pm.memberType || pm.type), 'created_at'];
  const sortedMembers = sortBy(unsortedMembers, sortCriteria);
  // primary resident can't be updated with CoCoccupants
  const membersToExport = exportType === ExportType.CoOccupants ? drop(sortedMembers) : sortedMembers;

  const guestCards = membersToExport.map(pm => ({ ...exportType, partyMember: pm }));

  // removed coresidents
  const externals = await exportRepo.getAllExternalInfoByPartyForMRI(ctx, partyDocument.id, partyDocument.assignedPropertyId, (data.lease || {}).id);
  const removedNonPrimaries = members.filter(pm => {
    const isClosed = pm.partyMember.endDate;
    const externalInfo = externals.find(e => e.partyMemberId === pm.partyMember.id && !e.isPrimary);
    return isClosed && externalInfo && !externalInfo.metadata.removedMriCoResident;
  });
  const sortedRemovedNonPrimaries = sortBy(removedNonPrimaries.map(getPartyMember), pm => types.indexOf(pm.memberType));
  const removedCoresidents = sortedRemovedNonPrimaries.map(pm => ({ ...ExportType.RemoveCoresident, partyMember: pm }));

  return [...removedCoresidents, ...guestCards];
};

export const generateGuestCardsExportSteps = async (ctx, partyDocument, data, signedLease = false) =>
  await generateMembersExportSteps(ctx, partyDocument, data, signedLease, ExportType.GuestCard);

export const generateCoOccupantsExportSteps = async (ctx, partyDocument, data, signedLease) =>
  await generateMembersExportSteps(ctx, partyDocument, data, signedLease, ExportType.CoOccupants);

export const addIndex = steps =>
  steps.map((value, index) => ({
    index,
    ...value,
  }));

export const FeeType = {
  Recurring: "'RECURRING'",
  NonRefundable: "'NONREFUNDABLE'",
  Deposit: "'DEPOSIT'",
};

const isRecurring = fee => {
  const { feeName } = fee;
  const recurringFees = ['PetRent', 'ParkingBaseRent', 'UndergroundParkingBaseRent'];

  return recurringFees.includes(feeName) ? true : fee.recurring;
};

export const getFeeEntry = fee => {
  const exportableFees = ['AdminFee', 'UnitBaseRent', 'singleAppFee', 'PetRent', 'PetDeposit', 'PetFee', 'ParkingBaseRent', 'UndergroundParkingBaseRent'];

  if (!fee.isConcession && !exportableFees.includes(fee.feeName)) {
    // export only certain fees
    return null;
  }

  // this is an inventory (instead of a fee or concession)
  if (!fee.externalChargeCode) return null;

  const isRecurringFee = isRecurring(fee);
  let amount;
  if (fee.isConcession) {
    amount = isRecurringFee ? -fee.relativeAmount : -fee.amount;
  } else {
    amount = fee.amount;
  }

  let feeType = FeeType.NonRefundable;
  if (isRecurringFee) {
    feeType = FeeType.Recurring;
  } else if (fee.feeType === 'deposit') {
    feeType = FeeType.Deposit;
  }

  return {
    externalChargeCode: `'${fee.externalChargeCode}'`,
    amount: amount || 0,
    type: feeType,
  };
};
