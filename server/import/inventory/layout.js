/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import omit from 'lodash/omit';

import { getAllAmenitiesByCategory, deleteLayoutAmenities, saveLayoutAmenities } from '../../dal/amenityRepo';
import { getMarketingAssets } from '../../dal/marketingAssetsRepo';
import { getMarketingLayouts } from '../../dal/marketingLayoutsRepo';
import { saveLayouts } from '../../dal/layoutRepo';
import { getPropertiesWithAmenityImportEnabled } from '../../dal/propertyRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { validate, Validation, getValueToPersist, checkEmptyAmenities } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { getMatchingElementIdsByName, findInvalidElements, validateIfElementsExist } from '../../helpers/importUtils';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { trimAndSplitByComma } from '../../../common/regex';
import { runInTransaction } from '../../database/factory';

const MARKETING_3D_ASSETS = 'marketing3DAssets';
const INVALID_MARKETING_3D_ASSETS = 'Invalid marketing 3D assets';
const MARKETING_VIDEO_ASSETS = 'marketingVideoAssets';
const INVALID_MARKETING_VIDEO_ASSETS = 'Invalid marketing video assets';

const LAYOUT_REQUIRED_FIELDS = [
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
    fieldName: 'numBedrooms',
    validation: [Validation.POSITIVE_DECIMAL],
  },
  {
    fieldName: 'numBathrooms',
    validation: [Validation.POSITIVE_DECIMAL],
  },
  {
    fieldName: 'surfaceArea',
    validation: [Validation.NOT_EMPTY, Validation.NUMERIC],
  },
  {
    fieldName: 'floorCount',
    validation: [Validation.POSITIVE_INTEGER, Validation.MIN_VALUE],
    minValue: 1,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'marketingLayout',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'marketingVideoAssets',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketing3DAssets',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'externalId',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
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

const validateMarketingAssets = (layout, marketingAssets) => {
  const errors = [];
  const marketing3DAssets = marketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.THREE_D);
  const marketingVideoAssets = marketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.VIDEO);
  const layout3dAssets = trimAndSplitByComma(layout.marketing3DAssets);
  const layoutVideoAssets = trimAndSplitByComma(layout.marketingVideoAssets);

  const invalid3DAssets = findInvalidElements(layout3dAssets, marketing3DAssets);
  const invalidVideoAssets = findInvalidElements(layoutVideoAssets, marketingVideoAssets);

  invalidVideoAssets.length && errors.push({ name: MARKETING_VIDEO_ASSETS, message: `${INVALID_MARKETING_VIDEO_ASSETS}: ${invalidVideoAssets}` });
  invalid3DAssets.length && errors.push({ name: MARKETING_3D_ASSETS, message: `${INVALID_MARKETING_3D_ASSETS}: ${invalid3DAssets}` });

  const valid3DAssets = getMatchingElementIdsByName(layout3dAssets, marketing3DAssets);
  const validVideoAssets = getMatchingElementIdsByName(layoutVideoAssets, marketingVideoAssets);

  return { errors, valid3DAssets, validVideoAssets };
};

const validateAmenities = (entityObj, storedAmenities) => {
  const validateObj = {
    elementsStr: entityObj.amenities,
    storedElements: storedAmenities,
    columnName: 'amenities',
    errorMessage: 'INVALID_AMENITY_ASSOCIATED',
  };

  return validateIfElementsExist(validateObj);
};

const updateWithValidAmenitiesAndAssets = (layout, marketingAssets, existingAmenities, propertiesWithImportSettingValue) => {
  const emptyAmenitiesValidationError = checkEmptyAmenities(layout, propertiesWithImportSettingValue);
  if (emptyAmenitiesValidationError) {
    return emptyAmenitiesValidationError;
  }
  const errors = [];
  const { error: amenitiesErrors, elements: validAmenities } = validateAmenities(layout, existingAmenities);
  layout.validAmenities = validAmenities;

  amenitiesErrors.length && errors.push(...amenitiesErrors);

  const { errors: marketingAssetsErrors, valid3DAssets, validVideoAssets } = validateMarketingAssets(layout, marketingAssets);
  layout.valid3DAssets = valid3DAssets;
  layout.validVideoAssets = validVideoAssets;
  marketingAssetsErrors.length && errors.push(...marketingAssetsErrors);

  return errors;
};

const createLayoutRecord = (layout, marketingLayouts) => {
  const { id: marketingLayoutId = null } = (marketingLayouts || []).find(ml => ml.name === layout.marketingLayout && ml.propertyId === layout.propertyId) || {};
  return {
    id: newId(),
    name: layout.name,
    propertyId: layout.propertyId,
    displayName: layout.displayName,
    description: layout.description,
    inventoryType: layout.inventoryType,
    numBedrooms: getValueToPersist(layout.numBedrooms),
    numBathrooms: getValueToPersist(layout.numBathrooms),
    surfaceArea: layout.surfaceArea,
    marketingVideoAssets: layout.validVideoAssets || {},
    marketing3DAssets: layout.valid3DAssets || {},
    floorCount: getValueToPersist(layout.floorCount, 1),
    inactive: layout.inactiveFlag,
    validAmenities: layout.validAmenities,
    marketingLayoutId,
    externalId: layout.externalId,
  };
};

const createLayoutAmenitiesRecords = (savedLayout, layoutsFromSheet) => {
  const records = [];
  const layoutsToSave = layoutsFromSheet.find(layout => layout.name === savedLayout.name && layout.propertyId === savedLayout.propertyId);

  layoutsToSave.validAmenities &&
    layoutsToSave.validAmenities.map(amenity =>
      records.push({
        layoutId: savedLayout.id,
        amenityId: amenity,
      }),
    );

  return records;
};

const createAndSaveLayoutAmenities = async (ctx, savedLayouts, layoutsFromSheet) => {
  const layoutAmenities = [];

  savedLayouts.map(savedLayout => layoutAmenities.push(...createLayoutAmenitiesRecords(savedLayout, layoutsFromSheet)));
  layoutAmenities.length && (await saveLayoutAmenities(ctx, layoutAmenities));
};

export const importLayouts = async (ctx, layouts) => {
  const layoutsToSave = [];

  const marketingAssets = await getMarketingAssets(ctx);
  const marketingLayouts = await getMarketingLayouts(ctx);
  const existingAmenities = await getAllAmenitiesByCategory(ctx, DALTypes.AmenityCategory.INVENTORY);
  const propertiesWithImportSettingValue = await getPropertiesWithAmenityImportEnabled(ctx, true);

  const invalidFields = await validate(
    layouts,
    {
      requiredFields: LAYOUT_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(layout) {
        const layoutRecord = createLayoutRecord(layout, marketingLayouts);
        if (!layoutsToSave.find(l => l.name === layoutRecord.name && l.propertyId === layoutRecord.propertyId)) layoutsToSave.push(layoutRecord);
      },
      async customCheck(layout) {
        return updateWithValidAmenitiesAndAssets(layout, marketingAssets, existingAmenities, propertiesWithImportSettingValue);
      },
    },
    ctx,
    spreadsheet.Layout.columns,
  );

  const result = await saveLayouts(
    ctx,
    layoutsToSave.map(layout => omit(layout, ['validAmenities', 'valid3DAssets', 'validVideoAssets'])),
  );

  if (result?.rows) {
    const savedLayoutIds = result.rows.map(bld => bld.id);

    await runInTransaction(async trx => {
      const innerCtx = { ...ctx, trx };

      savedLayoutIds.length && (await deleteLayoutAmenities(innerCtx, savedLayoutIds));
      await createAndSaveLayoutAmenities(innerCtx, result.rows, layoutsToSave);
    });
  }
  return {
    invalidFields,
  };
};
