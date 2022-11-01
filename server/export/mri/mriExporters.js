/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import uniqBy from 'lodash/uniqBy';
import flatten from 'lodash/flatten';
import partition from 'lodash/partition';
import { mapSeries } from 'bluebird';

import { createGuestCardMapper } from './mappers/guestCard';
import { createPetInformationMapper } from './mappers/petInformation';
import { createVehicleInformationMapper } from './mappers/vehicleInformation';
import { createCoOccupantsMapper } from './mappers/coOccupants';

import { transformMapsToXML, transformObjToXML } from './xmlUtils';
import { postFile, getFromMri } from './mriIntegration';

import { getActiveExternalInfoForMRI, updateExternalInfo, getAllExternalInfoByPartyForMRI } from '../../dal/exportRepo';
import { archiveExternalInfo, saveExternalPartyMemberInfo } from '../../services/externalPartyMemberInfo';
import { isCorporateParty } from '../../../common/helpers/party-utils';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export/mri' });
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPartyMemberIdByPartyIdAndPersonId, getChildIdByPartyIdAndInfo } from '../../dal/partyRepo';
import { saveLeaseExternalId } from '../../dal/leaseRepo';
import { getActiveLeasePartyIdBySeedPartyAndLeaseId } from '../../dal/activeLeaseWorkflowRepo';

const clearExistingData = async (ctx, options) => {
  logger.trace({ ctx, options }, 'clearExistingData - MRI export');
  const { getApi, removeApi, identityKeys, residentId, partyId, requestTemplate } = options;
  const entities = await getFromMri(ctx, getApi, { ResidentId: residentId }, partyId);
  if (!entities) return;

  const entries = entities[getApi.toLowerCase()].entry;
  if (!entries) return;

  const entriesToRemove = entries.map(e => pick(e, identityKeys));

  // because of how the XML is deserialized to obj <prop>value</prop> will be { prop: [value] }
  entriesToRemove.forEach(e =>
    Object.keys(e).forEach(key => {
      e[key] = e[key][0];
    }),
  );

  const xml = await transformObjToXML(removeApi, entriesToRemove, requestTemplate);

  await postFile(ctx, xml, { ...options, apiType: removeApi });
};

const isUpdateGuestCardRequest = async (ctx, partyMemberId, propertyId, leaseId) => {
  const externalInfo = await getActiveExternalInfoForMRI(ctx, partyMemberId, propertyId, leaseId);

  return externalInfo && externalInfo.externalId;
};

export const removeCoResident = async (ctx, data, partyMember) => {
  logger.trace({ ctx, partyMember }, 'Removing coresident');

  const apiType = 'MRI_S-PMRM_RemoveCoresident';
  const { externalId } = data.externals.find(e => e.partyMemberId === partyMember.id);
  const obj = { ResidentID: externalId };
  const xml = await transformObjToXML(apiType, obj, 'remove-coresident-request-template.xml');

  await postFile(ctx, xml, { apiType, partyId: data.party.id });

  const externals = await getAllExternalInfoByPartyForMRI(ctx, data.party.id, data.property.id);
  const externalInfo = externals.find(e => e.partyMemberId === partyMember.id);
  await archiveExternalInfo(ctx, externalInfo);
  await updateExternalInfo(ctx, { id: externalInfo.id, metadata: { ...externalInfo.metadata, removedMriCoResident: true } });
};

const insertExternalPartyMemberInfoForActiveLease = async (ctx, externalInfo) => {
  logger.trace({ ctx, externalInfo }, 'Insert external party member for active lease');

  const { partyId, personId = '', externalId, leaseId, propertyId, isPrimary = false, info = {} } = externalInfo;

  const { activeLeasePartyId } = (await getActiveLeasePartyIdBySeedPartyAndLeaseId(ctx, partyId, leaseId)) || {};

  if (!activeLeasePartyId) return;

  const childId = !personId ? await getChildIdByPartyIdAndInfo(ctx, { partyId: activeLeasePartyId, info }) : null;
  const partyMemberId = personId ? await getPartyMemberIdByPartyIdAndPersonId(ctx, { partyId: activeLeasePartyId, personId }) : null;

  await saveExternalPartyMemberInfo(ctx, {
    childId,
    partyMemberId,
    partyId: activeLeasePartyId,
    externalId,
    leaseId,
    propertyId,
    isPrimary,
  });
};

export const exportCoOccupants = async (ctx, data, partyMember) => {
  logger.trace({ ctx, partyMember }, 'exportCoOccupants');

  const maps = await createCoOccupantsMapper({ ...data, partyMember });
  const leaseId = isCorporateParty(data.party) ? (data.lease || {}).id : null;

  const apiType = 'MRI_S-PMRM_CoOccupants';
  const fileContent = await transformMapsToXML(apiType, maps, 'co-occupants-request-template.xml');

  const propertyId = data.property.id;
  const isUpdate = await isUpdateGuestCardRequest(ctx, partyMember.id, propertyId, leaseId);

  let externalInfo = await getActiveExternalInfoForMRI(ctx, partyMember.id, propertyId, leaseId);

  const entry = await postFile(ctx, fileContent, {
    isUpdate,
    apiProvider: 'mri_s',
    apiType,
    nameId: externalInfo && externalInfo.externalId,
    partyId: data.party.id,
  });

  const newNameId = entry.ResidentID[0];

  const shouldInsert = !externalInfo;
  if (shouldInsert) {
    const isChild = partyMember.type === DALTypes.AdditionalPartyMemberType.CHILD;
    externalInfo = await saveExternalPartyMemberInfo(ctx, {
      childId: isChild ? partyMember.id : null,
      partyMemberId: isChild ? null : partyMember.id,
      partyId: data.party.id,
      externalId: newNameId,
      leaseId,
      propertyId,
    });

    await insertExternalPartyMemberInfoForActiveLease(ctx, {
      personId: partyMember?.personId || '',
      partyId: data.party.id,
      externalId: newNameId,
      info: partyMember?.info || {},
      leaseId,
      propertyId,
    });
  }
};

export const exportGuestCard = async (ctx, data, partyMember) => {
  logger.trace({ ctx, partyMember }, 'exportGuestCard');

  const maps = await createGuestCardMapper({ ...data, partyMember });
  const leaseId = isCorporateParty(data.party) ? (data.lease || {}).id : null;

  const apiType = 'MRI_S-PMRM_GuestCardsBySiteID';
  const fileContent = await transformMapsToXML(apiType, maps, 'guest-card-request-template.xml');

  const propertyId = data.property.id;
  const isUpdate = await isUpdateGuestCardRequest(ctx, partyMember.id, propertyId, leaseId);

  let externalInfo = await getActiveExternalInfoForMRI(ctx, partyMember.id, propertyId, leaseId);

  const entry = await postFile(ctx, fileContent, {
    isUpdate,
    apiProvider: 'mri_s',
    apiType,
    nameId: externalInfo && externalInfo.externalId,
    partyId: data.party.id,
  });

  const newNameId = entry.NameID[0];

  const shouldInsert = !externalInfo;
  if (shouldInsert) {
    const isChild = partyMember.type === DALTypes.AdditionalPartyMemberType.CHILD;
    externalInfo = await saveExternalPartyMemberInfo(ctx, {
      childId: isChild ? partyMember.id : null,
      partyMemberId: isChild ? null : partyMember.id,
      partyId: data.party.id,
      externalId: newNameId,
      leaseId,
      propertyId,
    });
  }

  const { primaryTenant } = data;
  const isPrimary = partyMember.id === primaryTenant.id;
  const shouldUpdate = !externalInfo.externalId && isPrimary;
  if (shouldUpdate) {
    externalInfo = await updateExternalInfo(ctx, {
      id: externalInfo.id,
      externalId: newNameId,
      isPrimary,
      leaseId,
    });
  }

  if (shouldInsert || shouldUpdate) {
    await insertExternalPartyMemberInfoForActiveLease(ctx, {
      personId: partyMember?.personId || '',
      partyId: data.party.id,
      externalId: newNameId,
      info: partyMember?.info || {},
      leaseId,
      propertyId,
      isPrimary,
    });
  }

  if (isPrimary) {
    data.externalInfo = externalInfo;
  }
};

export const exportPets = async (ctx, data) => {
  logger.trace({ ctx }, 'exportPets');

  const apiType = 'MRI_S-PMRM_PetInformation';

  const options = {
    getApi: 'MRI_S-PMRM_Pets',
    removeApi: 'MRI_S-PMRM_RemovePet',
    identityKeys: ['PetID'],
    residentId: data.externalInfo.externalId,
    requestTemplate: 'remove-pet-request-template.xml',
    partyId: data.party.id,
  };
  await clearExistingData(ctx, options);

  const maps = (await createPetInformationMapper(data)) || [];
  if (!maps.length) return;

  const fileContent = await transformMapsToXML(
    apiType,
    maps.map(m => ({ entry: m })),
  );

  await postFile(ctx, fileContent, {
    apiProvider: 'mri_s',
    apiType,
    nameId: data.externalInfo.externalId,
    partyId: data.party.id,
  });
};

export const exportVehicles = async (ctx, data) => {
  logger.trace({ ctx }, 'exportVehicles');

  const fileType = 'VehicleInformation';
  const apiType = `MRI_S-PMRM_${fileType}`;

  const options = {
    getApi: 'MRI_S-PMRM_Vehicles',
    removeApi: 'MRI_S-PMRM_RemoveVehicle',
    identityKeys: ['ResidentID', 'LicensePlate', 'State'],
    residentId: data.externalInfo.externalId,
    requestTemplate: 'remove-vehicle-request-template.xml',
    partyId: data.party.id,
  };
  await clearExistingData(ctx, options);

  const maps = (await createVehicleInformationMapper(data)) || [];
  if (!maps.length) return;

  const fileContent = await transformMapsToXML(
    apiType,
    maps.map(m => ({ entry: m })),
  );

  await postFile(ctx, fileContent, {
    apiProvider: 'mri_s',
    apiType,
    nameId: data.externalInfo.externalId,
    partyId: data.party.id,
  });
};

export const exportGeneric = async (ctx, data, exportParams) => {
  logger.trace({ ctx, exportParams }, 'exportGeneric');

  const { apiType, apiProvider, mapper, queryParams, requestTemplate, isUpdate = false } = exportParams;

  const maps = await mapper(data);
  const fileContent = await transformMapsToXML(apiType, maps, requestTemplate);

  await postFile(ctx, fileContent, {
    apiProvider: apiProvider || 'mri_s',
    apiType,
    nameId: data.externalInfo.externalId,
    partyId: data.party.id,
    queryParams,
    isUpdate,
  });
};

const prepareItem = (acc, key, item, existingItemMap) =>
  existingItemMap
    ? acc.set(key, { ...existingItemMap, quantity: existingItemMap.quantity + item.quantity })
    : acc.set(key, { ...item, quantity: item.quantity });

const getFormattedRentableItems = rentableItems =>
  rentableItems.reduce((acc, item) => prepareItem(acc, item.externalId, item, acc.get(item.externalId)), new Map());

const getFormattedFees = fees => fees.reduce((acc, item) => prepareItem(acc, item.externalChargeCode, item, acc.get(item.externalChargeCode)), new Map());

const getFormattedRentableItemsAndFees = items => {
  const formattedItems = items.map(i => ({ externalId: i.externalId, quantity: i.quantity, externalChargeCode: i.externalChargeCode }));
  const [rentableItems, fees] = partition(formattedItems, i => i.externalId);
  const formattedRentableItems = getFormattedRentableItems(rentableItems);
  const formattedFees = getFormattedFees(fees);
  return [...formattedRentableItems.values(), ...formattedFees.values()];
};
export const exportRentables = async (ctx, data, options) => {
  const { feesToExport } = data;
  logger.trace({ ctx, feesToExport, options }, 'exportRentables');

  const excludedFeeNames = [
    'unitbaserent',
    'unitdeposit',
    'holddeposit',
    'petdeposit',
    'petfee',
    'singleappfee',
    'adminfee',
    'accountactivationfee',
    'guarantorappfee',
  ];
  const excludedChargeCodes = ['prk', 'gar', 'sto'];
  const isExcludedFee = fee => excludedFeeNames.some(f => fee.feeName?.toLowerCase()?.indexOf(f) === 0);
  const isExcludedChargeCode = fee => excludedChargeCodes.includes(fee.externalChargeCode?.toLowerCase());

  const toExport = feesToExport.filter(fee => !isExcludedFee(fee) && !isExcludedChargeCode(fee) && (fee.externalChargeCode || fee.externalId));
  const rentablesAndFees = getFormattedRentableItemsAndFees(toExport);

  logger.info({ ctx, rentablesAndFees }, 'Rentables to export');
  await mapSeries(rentablesAndFees, async rentable => await exportGeneric(ctx, { ...data, rentable }, options));
};

const assignItems = async (ctx, data, inventories, options) => {
  logger.info({ ctx, inventories }, 'Assigning items to CUSTOMEROLD');
  await exportGeneric(
    ctx,
    {
      ...data,
      inventories,
    },
    options,
  );
};

export const executeAssignItems = async (ctx, data, options) => {
  const { feesToExport } = data;
  logger.trace({ ctx, feesToExport, options }, 'executeAssignItems');

  const flattened = flatten(feesToExport.filter(r => r.inventories).map(r => r.inventories));
  const inventories = uniqBy(flattened, inventory => `${inventory.itemType}--${inventory.itemId}`);

  inventories?.length && (await assignItems(ctx, data, inventories, options));
};

export const confirmLease = async (ctx, data, confirmLeaseParams) => {
  const { apiType, apiProvider, mapper, requestTemplate } = confirmLeaseParams;

  const confirmLeaseObject = await mapper(data);
  logger.info({ ctx, confirmLeaseObject }, 'Confirming lease to CUSTOMEROLD');

  const xml = await transformObjToXML(apiType, confirmLeaseObject, requestTemplate);

  const entry = await postFile(ctx, xml, { apiProvider, apiType, partyId: data.party.id });
  const {
    leaseNumber: [externalLeaseId],
  } = entry.LeaseResult;

  await saveLeaseExternalId(ctx, data.lease.id, externalLeaseId);
};

export const renewalOffer = async (ctx, data, renewalOfferParams) => {
  const { apiType, apiProvider, mapper, requestTemplate } = renewalOfferParams;

  const renewalOfferObject = await mapper(data);
  logger.info({ ctx, renewalOfferObject }, 'Creating renewal offer for CUSTOMEROLD');

  const xml = await transformObjToXML(apiType, renewalOfferObject, requestTemplate);

  await postFile(ctx, xml, { apiProvider, apiType, partyId: data.party.id });
};
