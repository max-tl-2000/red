/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import omit from 'lodash/omit';

import { DALTypes } from '../../../common/enums/DALTypes';
import { validate, Validation, getValueFromEnum, getValueToPersist, checkEmptyAmenities } from './util';
import { getAllAmenitiesByCategory, deleteInventoryGroupAmenities, saveInventoryGroupAmenities } from '../../dal/amenityRepo';
import { getPropertiesWithAmenityImportEnabled } from '../../dal/propertyRepo';
import { validateIfElementsExist } from '../../helpers/importUtils';
import { getAllLeaseNames } from '../../dal/leaseTermRepo';
import { saveInventoryGroups } from '../../dal/inventoryGroupRepo';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { runInTransaction } from '../../database/factory';

const LEASE_NAME = 'leaseName';
const INVALID_LEASE_NAME = 'THE_LEASE_NAME_COLUMN_SHOULD_BE_EMPTY_IF_INVENTORY_TYPE_IS_NON-UNIT';

const INVENTORY_GROUP_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'basePriceMonthly',
    validation: [Validation.NUMERIC],
  },
  {
    fieldName: 'basePriceWeekly',
    validation: [Validation.NUMERIC],
  },
  {
    fieldName: 'basePriceDaily',
    validation: [Validation.NUMERIC],
  },
  {
    fieldName: 'basePriceHourly',
    validation: [Validation.NUMERIC],
  },
  {
    fieldName: 'feeName',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'economicStatus',
    validation: [Validation.NOT_EMPTY, Validation.EXISTS_IN],
    validValues: DALTypes.EconomicStatus,
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
  {
    field: 'feeName',
    tableFieldName: 'name',
    table: 'Fee',
    idReceiver: 'feeId',
    relatedField: 'property',
    relatedTableFieldName: 'propertyId',
  },
  {
    field: 'leaseName',
    tableFieldName: 'name',
    table: 'LeaseName',
    idReceiver: 'leaseNameId',
    relatedField: 'property',
    relatedTableFieldName: 'propertyId',
  },
];

const validateAmenities = (entityObj, storedAmenities) => {
  const validateObj = {
    elementsStr: entityObj.amenities,
    storedElements: storedAmenities,
    columnName: 'amenities',
    errorMessage: 'INVALID_AMENITY_ASSOCIATED',
  };

  return validateIfElementsExist(validateObj);
};

const updateWithValidAmenities = (inventoryGroup, propertiesWithImportSettingValue, storedAmenities) => {
  const emptyAmenitiesValidationError = checkEmptyAmenities(inventoryGroup, propertiesWithImportSettingValue);
  if (emptyAmenitiesValidationError) {
    return emptyAmenitiesValidationError;
  }
  const result = validateAmenities(inventoryGroup, storedAmenities);

  inventoryGroup.validAmenities = result.elements;
  return result.error;
};

const createInventoryGroupAmenitiesRecords = (savedInventoryGroup, inventoryGroupsFromSheet) => {
  const records = [];
  const inventoryGroupToSave = inventoryGroupsFromSheet.find(ig => ig.name === savedInventoryGroup.name && ig.propertyId === savedInventoryGroup.propertyId);

  inventoryGroupToSave.validAmenities &&
    inventoryGroupToSave.validAmenities.map(amenity =>
      records.push({
        inventoryGroupId: savedInventoryGroup.id,
        amenityId: amenity,
      }),
    );

  return records;
};

const createAndSaveInventoryGroupAmenities = async (ctx, savedInventoryGroups, inventoryGroupsFromSheet) => {
  const inventoryGroupAmenities = [];

  savedInventoryGroups.map(savedInventoryGroup =>
    inventoryGroupAmenities.push(...createInventoryGroupAmenitiesRecords(savedInventoryGroup, inventoryGroupsFromSheet)),
  );
  inventoryGroupAmenities.length && (await saveInventoryGroupAmenities(ctx, inventoryGroupAmenities));
};

const createInventoryGroupRecord = inventoryGroup => ({
  id: newId(),
  name: inventoryGroup.name,
  propertyId: inventoryGroup.propertyId,
  displayName: inventoryGroup.displayName,
  description: inventoryGroup.description,
  inventoryType: inventoryGroup.inventoryType,
  leaseNameId: inventoryGroup.leaseNameId,
  basePriceMonthly: getValueToPersist(inventoryGroup.basePriceMonthly, null),
  basePriceWeekly: getValueToPersist(inventoryGroup.basePriceWeekly, null),
  basePriceDaily: getValueToPersist(inventoryGroup.basePriceDaily, null),
  basePriceHourly: getValueToPersist(inventoryGroup.basePriceHourly, null),
  feeId: inventoryGroup.feeId,
  primaryRentable: inventoryGroup.primaryRentableFlag,
  economicStatus: inventoryGroup.economicStatus !== '' ? getValueFromEnum(DALTypes.EconomicStatus, inventoryGroup.economicStatus) : null,
  rentControl: inventoryGroup.rentControlFlag,
  affordable: inventoryGroup.affordableFlag,
  externalId: inventoryGroup.externalId || inventoryGroup.name,
  inactive: inventoryGroup.inactiveFlag,
  validAmenities: inventoryGroup.validAmenities,
});

const validateLeaseName = ({ inventoryType, leaseName }) => {
  if (inventoryType && inventoryType !== DALTypes.InventoryType.UNIT && leaseName !== '') {
    return [
      {
        name: LEASE_NAME,
        message: INVALID_LEASE_NAME,
      },
    ];
  }
  return [];
};

const additionalValidations = (inventoryGroup, propertiesWithImportSettingValue, storedAmenities) => {
  const amenitiesValidation = updateWithValidAmenities(inventoryGroup, propertiesWithImportSettingValue, storedAmenities);
  const leaseNameValidation = validateLeaseName(inventoryGroup);
  const validations = [];

  return validations.concat(amenitiesValidation, leaseNameValidation);
};

export const importInventoryGroups = async (ctx, inventoryGroups) => {
  const inventoryGroupsToSave = [];
  const leaseNames = await getAllLeaseNames(ctx);
  const propertiesWithImportSettingValue = await getPropertiesWithAmenityImportEnabled(ctx, true);
  const existingAmenities = await getAllAmenitiesByCategory(ctx, DALTypes.AmenityCategory.INVENTORY);

  const invalidFields = await validate(
    inventoryGroups,
    {
      requiredFields: INVENTORY_GROUP_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(inventoryGroup) {
        const associatedLeaseName = leaseNames.find(
          leaseName => leaseName.name === inventoryGroup.leaseName && leaseName.propertyId === inventoryGroup.propertyId,
        );
        inventoryGroup.leaseNameId = associatedLeaseName ? associatedLeaseName.id : null;
        if (!inventoryGroupsToSave.find(ig => ig.name === inventoryGroup.name && ig.propertyId === inventoryGroup.propertyId)) {
          inventoryGroupsToSave.push(createInventoryGroupRecord(inventoryGroup));
        }
      },
      customCheck(inventoryGroup) {
        return additionalValidations(inventoryGroup, propertiesWithImportSettingValue, existingAmenities);
      },
    },
    ctx,
    spreadsheet.InventoryGroup.columns,
  );

  const result =
    inventoryGroupsToSave.length &&
    (await saveInventoryGroups(
      ctx,
      inventoryGroupsToSave.map(ig => omit(ig, ['validAmenities'])),
    ));

  const savedInventoryGroupIds = result.rows.map(ig => ig.id);

  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };

    savedInventoryGroupIds.length && (await deleteInventoryGroupAmenities(innerCtx, savedInventoryGroupIds));
    await createAndSaveInventoryGroupAmenities(innerCtx, result.rows, inventoryGroupsToSave);
  });

  return {
    invalidFields,
  };
};
