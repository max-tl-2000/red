/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chunk from 'lodash/chunk';
import {
  saveAmenity,
  getHighValueAmenitiesPerProperty,
  setEndDateToAmenitiesWithIntegrationSettingDisable,
  getAllActiveInventoryAmenitiesHashedByPropertyId,
} from '../../dal/amenityRepo';
import { getProperties } from '../../dal/propertyRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getValueFromEnum, validate, Validation, getValueToPersist } from './util';
import DBColumnLength from '../../utils/dbConstants';
import loggerModule from '../../../common/helpers/logger';
import { translateFlagCellValue, getAssociatedEntity } from '../../helpers/importUtils';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { parseAsInTimezone } from '../../../common/helpers/moment-utils.ts';
import { SIMPLE_DATE_US_FORMAT } from '../../../common/date-constants';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';

const logger = loggerModule.child({ subType: 'import/amenities' });

const amenityUpdateSize = 1000;
const SUB_CATEGORY = 'subCategory';
const INVALID_SUBCATEGORY_APPLIED = 'INVALID_SUBCATEGORY_FOR_GIVEN_CATEGORY';
const HIGH_VALUE_FIELD = 'highValueFlag';
const HIGH_VALUE_VALIDATION_ERROR = 'HIGH_VALUE_LIMIT_REACH_PER_CATEGORY_AND_PROPERTY';
const EXTERNAL_ID_VALUE_FIELD = 'externalId';
const EXTERNAL_ID_VALIDATION_ERROR = 'Missing external id when amenity settings is set';
const HIGH_VALUE_CONFIG = [
  {
    category: DALTypes.AmenityCategory.BUILDING,
    quantity: 6,
  },
  {
    category: DALTypes.AmenityCategory.INVENTORY,
    quantity: 6,
  },
  {
    category: DALTypes.AmenityCategory.PROPERTY,
    quantity: 6,
  },
];

const AMENITY_REQUIRED_FIELDS = [
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
    fieldName: 'category',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.AmenityCategory,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'subCategory',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.AmenitySubCategory,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'relativePrice',
    validation: [Validation.PERCENTAGE],
  },
  {
    fieldName: 'absolutePrice',
    validation: [Validation.NUMERIC],
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

export const removeExtraElements = array => {
  const cleanArray = array.filter(element => element !== '');
  const auxSet = new Set(cleanArray);
  return Array.from(auxSet);
};

export const validateSubCategoryConstraint = ({ subCategory, category }) => {
  const categoryVal = getValueFromEnum(DALTypes.AmenityCategory, category);
  const subCategoryVal = getValueFromEnum(DALTypes.AmenitySubCategory, subCategory);

  if (
    subCategoryVal === DALTypes.AmenitySubCategory.LIFESTYLE &&
    categoryVal !== DALTypes.AmenityCategory.BUILDING &&
    categoryVal !== DALTypes.AmenityCategory.PROPERTY
  ) {
    return [
      {
        name: SUB_CATEGORY,
        message: INVALID_SUBCATEGORY_APPLIED,
      },
    ];
  }
  return [];
};

export const validateHighValueConstraint = async (ctx, amenity, propertyId) => {
  const highValueConfig = HIGH_VALUE_CONFIG.find(element => element.category.toLowerCase() === amenity.category.toLowerCase());
  if (highValueConfig) {
    const amenities = await getHighValueAmenitiesPerProperty(ctx, propertyId, highValueConfig.category, true, amenity.name);
    if (amenities.length === highValueConfig.quantity) {
      return [
        {
          name: HIGH_VALUE_FIELD,
          message: HIGH_VALUE_VALIDATION_ERROR,
        },
      ];
    }
  }
  return [];
};

const checkImportAmenitySetting = (ctx, amenity, propertiesByName, opts) => {
  const {
    settings: { integration },
  } = propertiesByName[amenity.property];

  if (!opts.appScript || !integration?.import?.amenities || amenity.category !== DALTypes.AmenityCategory.INVENTORY) return [];

  if (!amenity.externalId) {
    logger.error({ ctx }, EXTERNAL_ID_VALIDATION_ERROR);
    return [
      {
        name: EXTERNAL_ID_VALUE_FIELD,
        message: EXTERNAL_ID_VALIDATION_ERROR,
      },
    ];
  }

  return [];
};

export const additionalValidations = async (ctx, amenity, properties, propertiesByName, opts) => {
  const validations = validateSubCategoryConstraint(amenity);
  const highValueFlag = translateFlagCellValue(amenity.highValueFlag);
  if (highValueFlag) {
    const associatedProp = getAssociatedEntity(properties, amenity.property) || {};
    const highValueValidations = await validateHighValueConstraint(ctx, amenity, associatedProp.id).then(result => {
      const vals = result;
      return vals;
    });

    highValueValidations.forEach(validation => {
      validations.push(validation);
    });
  }

  return validations.concat(checkImportAmenitySetting(ctx, amenity, propertiesByName, opts));
};

const saveAmenityData = async (ctx, amenity, propertiesById, opts = {}) => {
  const { protectedColumns = [] } = opts;
  const dateSettings = { timezone: propertiesById[amenity.propertyId].timezone, format: SIMPLE_DATE_US_FORMAT };

  const amenityObj = {
    name: amenity.name,
    propertyId: amenity.propertyId,
    category: getValueFromEnum(DALTypes.AmenityCategory, amenity.category),
    subCategory: getValueFromEnum(DALTypes.AmenitySubCategory, amenity.subCategory),
    displayName: amenity.displayName,
    description: getValueToPersist(amenity.description, null),
    highValue: amenity.highValueFlag,
    relativePrice: getValueToPersist(amenity.relativePrice),
    absolutePrice: getValueToPersist(amenity.absolutePrice),
    targetUnit: amenity.targetUnitFlag,
    hidden: amenity.hiddenFlag,
    externalId: amenity.externalId === '' ? null : amenity.externalId,
    endDate: parseAsInTimezone(getValueToPersist(amenity.endDate, null), dateSettings).toJSON(),
  };

  if (amenity?.id) {
    amenityObj.id = amenity.id;
    protectedColumns.forEach(protectedColumn => {
      if (protectedColumn === 'property') {
        delete amenityObj.propertyId;
      } else {
        delete amenityObj[protectedColumn];
      }
    });
  }

  await saveAmenity(ctx, amenityObj);
};

const getAmenitiesToImport = (amenities, propertiesByName, opts) => {
  if (opts.appScript) return amenities;

  return amenities.filter(amenity => {
    const { data } = amenity;
    const { settings: { integration } = {} } = propertiesByName[data.property] || {};

    if (!integration?.import?.amenities) return true;

    return data.category !== DALTypes.AmenityCategory.INVENTORY;
  });
};

const updateMissingAmenities = async (ctx, amenities) => {
  const dbAmenitiesHash = await getAllActiveInventoryAmenitiesHashedByPropertyId(ctx);
  const formatedAmenitesWithSearchData = amenities.reduce((acc, amenity) => {
    acc[amenity.data.propertyId] = acc[amenity.data.propertyId] || {};
    acc[amenity.data.propertyId][`${amenity.data.name}_${amenity.data.category}_${amenity.data.subCategory}`] = true;
    return acc;
  }, {});
  const properties = Object.keys(dbAmenitiesHash);
  const missingDbAmenityIds = [];
  await execConcurrent(
    properties,
    async propertyId => {
      const amenityKeys = Object.keys(dbAmenitiesHash[propertyId]);
      amenityKeys.forEach(amenityKey => {
        // Some properties may be ommitted fromt eh sheet, and in this case we should consider the amenities as missing
        if (formatedAmenitesWithSearchData[propertyId]) {
          const exists = amenityKey in formatedAmenitesWithSearchData[propertyId];
          if (!exists && propertyId) {
            missingDbAmenityIds.push(dbAmenitiesHash[propertyId][amenityKey]);
          }
        }
      });
    },
    10,
  );
  missingDbAmenityIds.length &&
    logger.trace(
      { ctx, totalMissingInventoryAmenities: missingDbAmenityIds.length, missingDbAmenityIds: missingDbAmenityIds.join(', ') },
      'updating missing inventory amenities from amenity import',
    );
  const missingAmenitybatches = chunk(missingDbAmenityIds, amenityUpdateSize);
  for (const missingAmenitybatch of missingAmenitybatches) {
    await setEndDateToAmenitiesWithIntegrationSettingDisable(ctx, missingAmenitybatch);
  }
};

export const importAmenities = async (ctx, amenities, opts = {}) => {
  const properties = await getProperties(ctx);
  const { propertiesById, propertiesByName } = properties.reduce(
    (acc, property) => {
      acc.propertiesById[property.id] = { timezone: property.timezone };
      acc.propertiesByName[property.name] = { settings: property.settings };
      return acc;
    },
    { propertiesById: {}, propertiesByName: {} },
  );

  amenities = getAmenitiesToImport(amenities, propertiesByName, opts);
  const validAmenities = [];
  const invalidFields = await validate(
    amenities,
    {
      requiredFields: AMENITY_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      onValidEntity(amenity, index) {
        validAmenities.push({
          index,
          data: amenity,
        });
        return saveAmenityData(ctx, amenity, propertiesById, opts);
      },
      customCheck(amenity) {
        return additionalValidations(ctx, amenity, properties, propertiesByName, opts);
      },
    },
    ctx,
    spreadsheet.Amenity.columns,
  );

  return {
    invalidFields,
    validFields: validAmenities,
  };
};

export const additionalAmenityProcess = async (ctx, validAmenities) => {
  await updateMissingAmenities(ctx, validAmenities);
  return [];
};
