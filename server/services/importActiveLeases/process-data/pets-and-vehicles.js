/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import differenceBy from 'lodash/differenceBy';
import intersectionBy from 'lodash/intersectionBy';
import { savePartyAdditionalInfo, updatePartyAdditionalInfo, removePartyAdditionalInfo, getPartyAdditionalInfoByPartyId } from '../../../dal/partyRepo';
import { AdditionalInfoTypes } from '../../../../common/enums/partyTypes';
import { PetTypes, PetSizes, MRIPetSizes } from '../../../../common/enums/petTypes';
import { VehicleTypes } from '../../../../common/enums/vehicleTypes';
import loggerModule from '../../../../common/helpers/logger';
import { createExceptionReport } from './exception-report';
import { PartyExceptionReportRules } from '../../../helpers/exceptionReportRules';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const getPetType = pet => {
  switch (pet.type) {
    case 'C':
      return PetTypes.CAT;
    case 'D':
      return PetTypes.DOG;
    default:
      return PetTypes.OTHER;
  }
};

const getPetSizeBySize = size => {
  switch (size) {
    case MRIPetSizes.Tiny:
      return PetSizes.LIBS5;
    case MRIPetSizes.Small:
      return PetSizes.LIBS15;
    case MRIPetSizes.Medium:
      return PetSizes.LIBS25;
    case MRIPetSizes.Large:
      return PetSizes.LIBS50;
    case MRIPetSizes.Huge:
      return PetSizes.LIBS50M;
    default:
      return PetSizes.LIBS25;
  }
};

const getPetSizeByWeight = weight => {
  switch (true) {
    case weight >= 0 && weight <= 5:
      return PetSizes.LIBS5;
    case weight > 5 && weight <= 15:
      return PetSizes.LIBS15;
    case weight > 15 && weight <= 25:
      return PetSizes.LIBS25;
    case weight > 25 && weight <= 50:
      return PetSizes.LIBS50;
    case weight > 50:
      return PetSizes.LIBS50M;
    default:
      return PetSizes.LIBS25;
  }
};

const getPetSize = pet => {
  if (pet.weight) {
    const weight = parseInt(pet.weight, 10);
    return getPetSizeByWeight(weight);
  }

  return pet.size ? getPetSizeBySize(pet.size) : PetSizes.LIBS25;
};

const extractPartyAdditionalInfo = (partyId, { rawData = {} } = {}) => {
  const pets = rawData.pets?.map(item => ({
    partyId,
    type: AdditionalInfoTypes.PET,
    info: {
      name: item.name,
      size: getPetSize(item),
      type: getPetType(item),
      breed: item.breed,
      isServiceAnimal: item.serviceAnimalForSpecialNeeds === 'Y',
    },
  }));

  const vehicles = rawData.vehicles?.map(item => ({
    partyId,
    type: AdditionalInfoTypes.VEHICLE,
    info: {
      type: VehicleTypes.OTHER,
      color: item.color,
      state: item.state,
      tagNumber: item.licensePlate,
      makeAndModel: [item.make, item.model].join(' ').trim(),
    },
  }));

  return { pets, vehicles };
};

const getPartyAdditionalInfoDiff = async (ctx, partyId, itemsToProcess, isNewParty) => {
  const existingItems = !isNewParty
    ? (await getPartyAdditionalInfoByPartyId(ctx, partyId)).filter(({ type }) => type === AdditionalInfoTypes.PET || type === AdditionalInfoTypes.VEHICLE)
    : [];

  const getKey = ({ type, info }) => (type === AdditionalInfoTypes.PET ? `${type}-${info.type}-${info.name}` : `${type}-${info.tagNumber}`);
  const getValue = ({ type, info }) =>
    type === AdditionalInfoTypes.PET ? `${info.size}-${info.breed}-${info.isServiceAnimal}` : `${info.makeAndModel}-${info.state}-${info.color}-${info.type}`;

  const itemsToSave = differenceBy(itemsToProcess, existingItems, getKey);
  const itemsToUpdate = intersectionBy(itemsToProcess, existingItems, getKey)
    .filter(it => {
      const entity = existingItems.find(x => getKey(it) === getKey(x));
      if (!entity) return false;

      return getValue(entity) !== getValue(it);
    })
    .map(it => {
      const entity = existingItems.find(x => getKey(it) === getKey(x));
      return {
        ...it,
        id: entity.id,
      };
    });
  const itemsToDelete = differenceBy(existingItems, itemsToProcess, getKey);

  return {
    itemsToSave,
    itemsToUpdate,
    itemsToDelete,
  };
};

const logPartyAdditionalInfoAction = (ctx, { residentImportTrackingId, partyId, item, action = 'save' }) => {
  const key = item.type === AdditionalInfoTypes.PET ? 'pet' : 'vehicle';
  logger.trace({ ctx, residentImportTrackingId, partyId, [key]: item }, `processPartyAdditionalInfoUpdates - ${action} ${key}`);
};

export const processPartyAdditionalInfoUpdates = async (ctx, partyInfoDiff, { residentImportTrackingId, partyId }) => {
  const { itemsToSave, itemsToUpdate, itemsToDelete } = partyInfoDiff;

  logger.trace({ ctx, partyId, itemsToSave, itemsToUpdate, itemsToDelete }, 'processPartyAdditionalInfoUpdates');

  await mapSeries(itemsToSave, async item => {
    logPartyAdditionalInfoAction(ctx, { residentImportTrackingId, partyId, item, action: 'save' });
    await savePartyAdditionalInfo(ctx, item);
  });

  await mapSeries(itemsToUpdate, async item => {
    logPartyAdditionalInfoAction(ctx, { residentImportTrackingId, partyId, item, action: 'update' });
    await updatePartyAdditionalInfo(ctx, item.id, item.info);
  });

  await mapSeries(itemsToDelete, async item => {
    logPartyAdditionalInfoAction(ctx, { residentImportTrackingId, partyId, item, action: 'delete' });
    await removePartyAdditionalInfo(ctx, item.id);
  });
};

export const processPetsAndVehicles = async (ctx, { partyId, isNewParty, entry, renewalCycleStarted }) => {
  logger.trace({ ctx, residentImportTrackingId: entry.id, partyId, isNewParty }, 'processPetsAndVehicles - start');
  const { pets, vehicles } = extractPartyAdditionalInfo(partyId, entry);
  const partyInfoDiff = await getPartyAdditionalInfoDiff(ctx, partyId, [...pets, ...vehicles], isNewParty);
  const { itemsToSave, itemsToUpdate, itemsToDelete } = partyInfoDiff;
  const allItemsToProcess = [...itemsToSave, ...itemsToUpdate, ...itemsToDelete];

  if (renewalCycleStarted) {
    const vehiclesUpdated = allItemsToProcess.some(it => it.type === AdditionalInfoTypes.VEHICLE);
    const petsUpdated = allItemsToProcess.some(it => it.type === AdditionalInfoTypes.PET);
    vehiclesUpdated &&
      (await createExceptionReport(
        ctx,
        { entry, externalId: entry.primaryExternalId, partyId },
        PartyExceptionReportRules.VEHICLES_UPDATED_AFTER_RENEWAL_START,
      ));
    petsUpdated &&
      (await createExceptionReport(ctx, { entry, externalId: entry.primaryExternalId, partyId }, PartyExceptionReportRules.PETS_UPDATED_AFTER_RENEWAL_START));
    return;
  }

  await processPartyAdditionalInfoUpdates(ctx, partyInfoDiff, { residentImportTrackingId: entry.id, partyId });
  logger.trace({ ctx, residentImportTrackingId: entry.id, partyId }, 'processPetsAndVehicles - end');
};
