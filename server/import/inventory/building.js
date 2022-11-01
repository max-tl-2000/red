/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import omit from 'lodash/omit';

import { saveAddressRow } from '../../services/addresses';
import { deleteBuildingAmenities, getAllAmenitiesByCategory, saveBuildingAmenities } from '../../dal/amenityRepo';
import { saveBuildings } from '../../dal/buildingRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { validate, Validation, getValueFromEnum, getValueToPersist } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { validateIfElementsExist } from '../../helpers/importUtils';
import { parseAsInTimezone } from '../../../common/helpers/moment-utils';
import { getProperties } from '../../dal/propertyRepo';
import { SIMPLE_DATE_US_FORMAT } from '../../../common/date-constants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { runInTransaction } from '../../database/factory';

const BUILDING_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'type',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.BuildingType,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'addressLine1',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Address,
  },
  {
    fieldName: 'addressLine2',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Address,
  },
  {
    fieldName: 'city',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.City,
  },
  {
    fieldName: 'state',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.State,
  },
  {
    fieldName: 'postalCode',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.PostalCode,
  },
  {
    fieldName: 'startDate',
    validation: [Validation.DATE],
  },
  {
    fieldName: 'endDate',
    validation: [Validation.DATE],
  },
  {
    fieldName: 'floorCount',
    validation: [Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'surfaceArea',
    validation: [Validation.NUMERIC],
  },
  {
    fieldName: 'externalId',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
];

const PREREQUISITES = [
  {
    field: 'property',
    tableFieldName: 'name',
    table: 'Property',
    idReceiver: 'propertyId',
  },
];

const validateAmenities = async (ctx, entityObj, storedAmenities) => {
  const validateObj = {
    elementsStr: entityObj.amenities,
    storedElements: storedAmenities,
    columnName: 'amenities',
    errorMessage: 'INVALID_AMENITY_ASSOCIATED',
  };

  return await validateIfElementsExist(validateObj);
};

const updateWithValidAmenities = async (ctx, building, existingAmenities) => {
  const result = await validateAmenities(ctx, building, existingAmenities);
  building.validAmenities = result.elements;
  return result.error;
};

const createBuildingRecord = (building, properties) => {
  const { propertyId } = building;
  const property = properties.find(p => p.id === propertyId) || {};
  const timezone = property.timezone;
  const dateSettings = { timezone, format: SIMPLE_DATE_US_FORMAT };

  return {
    id: newId(),
    name: building.name,
    displayName: building.displayName,
    type: getValueFromEnum(DALTypes.BuildingType, building.type),
    propertyId,
    description: building.description,
    addressId: building.addressId,
    startDate: parseAsInTimezone(getValueToPersist(building.startDate, null), dateSettings).toJSON(),
    endDate: parseAsInTimezone(getValueToPersist(building.endDate, null), dateSettings).toJSON(),
    floorCount: building.floorCount,
    surfaceArea: getValueToPersist(building.surfaceArea),
    externalId: building.externalId,
    inactive: building.inactiveFlag,
    validAmenities: building.validAmenities,
  };
};

const createBuildingAmenitiesRecords = (savedBuilding, buildingsFromSheet) => {
  const records = [];
  const buildingToSave = buildingsFromSheet.find(bld => bld.name === savedBuilding.name && bld.propertyId === savedBuilding.propertyId);

  buildingToSave.validAmenities &&
    buildingToSave.validAmenities.map(amenity =>
      records.push({
        buildingId: savedBuilding.id,
        amenityId: amenity,
      }),
    );

  return records;
};

const createAndSaveBuildingAmenities = async (ctx, savedBuildings, buildingsFromSheet) => {
  const buildingAmenities = [];

  savedBuildings.map(savedBuilding => buildingAmenities.push(...createBuildingAmenitiesRecords(savedBuilding, buildingsFromSheet)));
  buildingAmenities.length && (await saveBuildingAmenities(ctx, buildingAmenities));
};

export const importBuildings = async (ctx, buildings) => {
  const buildingsToSave = [];
  const properties = await getProperties(ctx);
  const existingAmenities = await getAllAmenitiesByCategory(ctx, DALTypes.AmenityCategory.BUILDING);

  const invalidFields = await validate(
    buildings,
    {
      requiredFields: BUILDING_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(building) {
        const { addressId } = await saveAddressRow(ctx, building);
        building.addressId = addressId;

        buildingsToSave.push(createBuildingRecord(building, properties));
      },
      customCheck(building) {
        return updateWithValidAmenities(ctx, building, existingAmenities);
      },
    },
    ctx,
    spreadsheet.Building.columns,
  );

  const result = await saveBuildings(
    ctx,
    buildingsToSave.map(blg => omit(blg, ['validAmenities'])),
  );

  const savedBuildingIds = result.rows.map(bld => bld.id);

  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };

    savedBuildingIds.length && (await deleteBuildingAmenities(innerCtx, savedBuildingIds));
    await createAndSaveBuildingAmenities(innerCtx, result.rows, buildingsToSave);
  });

  return {
    invalidFields,
  };
};
