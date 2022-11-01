/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import intersection from 'lodash/intersection';
import { updateProperty, getPropertyById, getProperties } from '../../dal/propertyRepo';
import { validate, Validation, getValueToPersist } from './util';
import DBColumnLength from '../../utils/dbConstants';
import ArrayDataType from '../datatype/arrayDataType';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'import/propertySettings' });
import config from '../../config';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { validateAmenities } from '../../services/amenities';
import { DALTypes } from '../../../common/enums/DALTypes';
import { trimAndSplitByComma } from '../../../common/regex';
import { loadPrograms } from '../../dal/programsRepo';
import StringArrayDataType from '../datatype/StringArrayDataType';
import { findInvalidElements, getMatchingElementIdsByName } from '../../helpers/importUtils';
import { getMarketingAssets } from '../../dal/marketingAssetsRepo';

const PROPERTY_SETTINGS = 'propertySettings';
const INVALID_OUT_PROGRAM = 'Invalid program specified for defaultOutgoingProgram';
const TEAM_SLOT_DURATIONS = [30, 60, 90, 120];
const DEFAULT_DAYS_TO_ROUTE_TO_AL = 60;
const INVALID_TEAM_SLOT_DURATION = `Invalid team slot duration. Valid values are: ${TEAM_SLOT_DURATIONS.join(', ')}`;
const INVALID_APPOINTMENT_EDIT_URL = 'Edit appointment url is mandatory if enableSelfServiceEdit is set to TRUE';
const DEFAULT_PROPERTY_PROGRAM_ERROR = 'Invalid program for property';
const MARKETING_3D_ASSETS = 'marketing\n3DAssets';
const INVALID_MARKETING_3D_ASSETS = 'Invalid marketing 3D assets';
const MARKETING_VIDEO_ASSETS = 'marketing\nvideoAssets';
const INVALID_MARKETING_VIDEO_ASSETS = 'Invalid marketing video assets';

const PROPERTY_SETTING_REQUIRED_FIELDS = [
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'quote\nexpirationPeriod',
    validation: [Validation.NOT_EMPTY, Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'quote\nrenewalLetterExpirationPeriod',
    validation: [Validation.NOT_EMPTY, Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'quote\npolicyStatement',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'quote\nrenewalLetterPolicyStatement',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'quote\nprorationStrategy',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'inventory\nhideStateFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'screening\npropertyName',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'lease\npropertyName',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'application\nurlPropPolicy',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.WebSite,
  },
  {
    fieldName: 'calendar\nteamSlotDuration',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'screening\nincomePolicyRoommates',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'screening\nincomePolicyGuarantors',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'payment\npropertyName',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'appointment\nenableSelfServiceEdit',
    validation: [Validation.BOOLEAN, Validation.NOT_EMPTY],
  },
  {
    fieldName: 'appointment\neditUrl',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'appointment\ntourTypesAvailable',
    validation: [Validation.ALPHANUMERIC, Validation.NOT_EMPTY, Validation.EXISTS_IN],
    validValues: DALTypes.TourTypes,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'residentservices\nmoveoutNoticePeriod',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'marketing\ncity',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.City,
  },
  {
    fieldName: 'marketing\ncityAliases',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketing\nstate',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'marketing\nstateAliases',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketing\nregion',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'marketing\nregionAliases',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketing\nneighborhood',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'marketing\nneighborhoodAliases',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketing\ntestimonials',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
  {
    fieldName: 'marketing\ntags',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketing\npropertyAmenities',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketing\nlayoutAmenities',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketing\nselfServeDefaultLeaseLengthsForUnits',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'marketing\nselfServeAllowExpandLeaseLengthsForUnits',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'marketing\nincludedInListings',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'marketing\nmaxVacantReadyUnits',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'marketing\nmaxUnitsInLayout',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'marketing\nmapZoomLevel',
    validation: [Validation.INTEGER, Validation.MIN_VALUE, Validation.MAX_VALUE],
    minValue: 0,
    maxValue: 22,
  },
  {
    fieldName: 'marketing\nfacebookURL',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.WebSite,
  },
  {
    fieldName: 'marketing\ninstagramURL',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.WebSite,
  },
  {
    fieldName: 'marketing\ngoogleReviewsURL',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.WebSite,
  },
  {
    fieldName: 'marketing\nmapPlaces',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Places,
  },
  {
    fieldName: 'comms\ndefaultPropertyProgram',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'comms\ndefaultOutgoingProgram',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'comms\ndaysToRouteToALPostMoveout',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'renewals\nrenewalCycleStart',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'renewals\nskipOriginalGuarantors',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'marketingLocation\naddressLine1',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Address,
  },
  {
    fieldName: 'marketingLocation\naddressLine2',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Address,
  },
  {
    fieldName: 'marketingLocation\ncity',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.City,
  },
  {
    fieldName: 'marketingLocation\nstate',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.State,
  },
  {
    fieldName: 'marketingLocation\npostalCode',
    validation: [Validation.NOT_EMPTY, Validation.INTEGER],
    maxLength: DBColumnLength.PostalCode,
  },
  {
    fieldName: 'lease\nallowPartyRepresentativeSelection',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'marketing\nvideoAssets',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketing\n3DAssets',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
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

const getProgramForProperty = (programs, propertyName, programName) => programs.find(p => p.name === programName && p.primaryProperty === propertyName);

const getProgramByName = (programs, programName) => programs.find(p => p.name === programName);

const getProgramForPropertyKeys = (propertySetting, settingKey, propertyNameKey, programs) => {
  const defaultProgramName = getValueToPersist(propertySetting[settingKey]);
  const propertyName = getValueToPersist(propertySetting[propertyNameKey]);
  return getProgramForProperty(programs, propertyName, defaultProgramName);
};

const getInvalidPropertySettingsSetup = properties =>
  properties.reduce(
    (validation, property) => {
      // it's enough to check for one of the expected nodes in the settings json
      // because one invalid column will cause the whole row to be ignored
      // meaning that if one column from Property Settings sheet was saved, all of them were
      if (!property.settings?.quote) {
        validation.invalidFields.push({
          name: 'Property Settings',
          message: `Settings not configured for property: ${property.name}`,
        });
      }
      return validation;
    },
    { invalidFields: [] },
  );

const validateMarketingAssets = (propertySetting, marketingAssets) => {
  const errors = [];
  const marketing3DAssets = marketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.THREE_D);
  const marketingVideoAssets = marketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.VIDEO);
  const property3dAssets = trimAndSplitByComma(propertySetting['marketing\n3DAssets']);
  const propertyVideoAssets = trimAndSplitByComma(propertySetting['marketing\nvideoAssets']);

  const invalid3DAssets = findInvalidElements(property3dAssets, marketing3DAssets);
  const invalidVideoAssets = findInvalidElements(propertyVideoAssets, marketingVideoAssets);

  invalidVideoAssets.length && errors.push({ name: MARKETING_VIDEO_ASSETS, message: `${INVALID_MARKETING_VIDEO_ASSETS}: ${invalidVideoAssets}` });
  invalid3DAssets.length && errors.push({ name: MARKETING_3D_ASSETS, message: `${INVALID_MARKETING_3D_ASSETS}: ${invalid3DAssets}` });

  return errors;
};

const makeAdditionalValidations = async (ctx, propertySetting, programs, marketingAssets) => {
  const errors = [];

  const programName = propertySetting['comms\ndefaultOutgoingProgram'];
  const program = programs.find(p => p.name === programName);
  if (!program) {
    errors.push({
      name: 'comms\ndefaultOutgoingProgram',
      message: INVALID_OUT_PROGRAM,
    });
  }

  if (program && !program.displayPhoneNumber) {
    errors.push({
      name: 'comms\ndefaultOutgoingProgram',
      message: `No phone number set in 'displayPhoneNumber' field for program: ${programName} in 'Programs' sheet`,
    });
  }

  const marketingAssetsErrors = validateMarketingAssets(propertySetting, marketingAssets);
  marketingAssetsErrors.length && errors.push(...marketingAssetsErrors);

  const propertyAmenitiesResult = await validateAmenities(
    ctx,
    { amenities: propertySetting['marketing\npropertyAmenities'], property: propertySetting.property },
    DALTypes.AmenityCategory.PROPERTY.toLowerCase(),
  );
  propertyAmenitiesResult.error.length && errors.push({ name: 'marketing\npropertyAmenities', message: propertyAmenitiesResult.error[0].message });

  const layoutAmenitiesInventoryResult = await validateAmenities(
    ctx,
    { amenities: propertySetting['marketing\nlayoutAmenities'], property: propertySetting.property },
    DALTypes.AmenityCategory.INVENTORY.toLowerCase(),
  );

  const layoutAmenitiesBuildingResult = await validateAmenities(
    ctx,
    { amenities: propertySetting['marketing\nlayoutAmenities'], property: propertySetting.property },
    DALTypes.AmenityCategory.BUILDING.toLowerCase(),
  );
  const invalidLayoutAmenities = intersection(layoutAmenitiesBuildingResult.invalidElements, layoutAmenitiesInventoryResult.invalidElements);
  invalidLayoutAmenities.length && errors.push({ name: 'marketing\nlayoutAmenities', message: `INVALID_AMENITY_ASSOCIATED: ${invalidLayoutAmenities}` });

  const teamSlotDuration = propertySetting['calendar\nteamSlotDuration'];
  const slotDuration = parseInt(teamSlotDuration, 10);
  slotDuration && !TEAM_SLOT_DURATIONS.includes(slotDuration) && errors.push({ name: PROPERTY_SETTINGS, message: INVALID_TEAM_SLOT_DURATION });

  const propertyProgram = getProgramForPropertyKeys(propertySetting, 'comms\ndefaultPropertyProgram', 'property', programs);
  !propertyProgram && errors.push({ name: 'comms\ndefaultPropertyProgram', message: DEFAULT_PROPERTY_PROGRAM_ERROR });

  const enableSelfServiceEditApp = propertySetting['appointment\nenableSelfServiceEdit'];
  if (!enableSelfServiceEditApp) return errors;

  const editAppUrl = propertySetting['appointment\neditUrl'];
  !editAppUrl && errors.push({ name: PROPERTY_SETTINGS, message: INVALID_APPOINTMENT_EDIT_URL });

  return errors;
};

const marketingKeysToSplit = [
  'cityAliases',
  'stateAliases',
  'neighborhoodAliases',
  'regionAliases',
  'testimonials',
  'tags',
  'propertyAmenities',
  'layoutAmenities',
];

const processRenewalsSettings = (settingKey, value) => {
  if (settingKey === 'renewalCycleStart' && !value) return config.renewals.defaultRenewalCycleStartValue;
  if (settingKey === 'skipOriginalGuarantors' && !value) return false;
  return value;
};

const processCalendarSettings = (settingKey, value) =>
  settingKey === 'teamSlotDuration' && !value ? config.calendar.defaultTeamSlotDuration : parseInt(value, 10);

const processCommSettings = (settingKey, value, programs, propertyName) => {
  if (settingKey === 'defaultPropertyProgram') return getProgramForProperty(programs, propertyName, value).id;
  if (settingKey === 'defaultOutgoingProgram') return getProgramByName(programs, value).id;
  if (settingKey === 'daysToRouteToALPostMoveout') return value || DEFAULT_DAYS_TO_ROUTE_TO_AL;
  return value;
};

const processMarketingSettings = (settingKey, value, marketingAssets) => {
  const marketing3DAssets = marketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.THREE_D);
  const marketingVideoAssets = marketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.VIDEO);

  if (settingKey === '3DAssets') return getMatchingElementIdsByName(trimAndSplitByComma(value), marketing3DAssets);
  if (settingKey === 'videoAssets') return getMatchingElementIdsByName(trimAndSplitByComma(value), marketingVideoAssets);
  return marketingKeysToSplit.includes(settingKey) ? trimAndSplitByComma(value) : value;
};

const processResidentServicesSettings = (settingKey, value) =>
  settingKey === 'moveoutNoticePeriod' && !value ? config.residentServices.defaultMoveoutNoticePeriod : value;

const processSettingsForColumn = (columnHeader, settingKey, value, programs, propertyName, marketingAssets) => {
  switch (columnHeader) {
    case 'calendar':
      return processCalendarSettings(settingKey, value);
    case 'marketing':
      return processMarketingSettings(settingKey, value, marketingAssets);
    case 'comms':
      return processCommSettings(settingKey, value, programs, propertyName);
    case 'renewals':
      return processRenewalsSettings(settingKey, value);
    case 'residentservices':
      return processResidentServicesSettings(settingKey, value);
    default:
      return value;
  }
};

const savePropertySettingData = async (ctx, propertySetting, programs, marketingAssets) => {
  const { id, name, settings } = await getPropertyById(ctx, propertySetting.propertyId);
  const setting = settings || {};
  Object.keys(propertySetting)
    .filter(key => key !== 'propertyId' && key !== 'property')
    .forEach(key => {
      const value = propertySetting[key];

      logger.trace({ ctx, key, value }, 'import property settings key');

      const keys = key.split('\n');
      if (keys.length > 1) {
        const [columnHeader, settingKey] = keys;
        setting[columnHeader] = setting[columnHeader] || {};
        setting[columnHeader][settingKey] = processSettingsForColumn(columnHeader, settingKey, value, programs, name, marketingAssets);
      } else {
        setting[key] = value;
      }
    });

  setting.marketing.selfServeDefaultLeaseLengthsForUnits = new ArrayDataType().getParsedValue(setting.marketing.selfServeDefaultLeaseLengthsForUnits);
  setting.marketing.mapPlaces = new StringArrayDataType().getParsedValue(setting.marketing.mapPlaces);
  setting.appointment.tourTypesAvailable = new StringArrayDataType().getParsedValue(setting.appointment.tourTypesAvailable);

  const conditionalApprovalOptions = new StringArrayDataType().getParsedValue(setting.applicationReview.conditionalApprovalOptions);
  setting.applicationReview.conditionalApprovalOptions = conditionalApprovalOptions.filter(x => x).length ? conditionalApprovalOptions : [];

  const residentSignatureTypes = new StringArrayDataType()
    .getParsedValue(setting.lease.residentSignatureTypes)
    .filter(x => [DALTypes.LeaseSignatureTypes.DIGITAL, DALTypes.LeaseSignatureTypes.WET].includes(x));
  setting.lease.residentSignatureTypes = residentSignatureTypes.length ? residentSignatureTypes : [DALTypes.LeaseSignatureTypes.DIGITAL];

  const guarantorSignatureTypes = new StringArrayDataType()
    .getParsedValue(setting.lease.guarantorSignatureTypes)
    .filter(x => [DALTypes.LeaseSignatureTypes.DIGITAL, DALTypes.LeaseSignatureTypes.WET].includes(x));
  setting.lease.guarantorSignatureTypes = guarantorSignatureTypes.length ? guarantorSignatureTypes : [DALTypes.LeaseSignatureTypes.DIGITAL];

  await updateProperty(ctx, { id }, { settings: setting });
};

export const importPropertySettings = async (ctx, propertySettings) => {
  const programs = await loadPrograms(ctx);
  const marketingAssets = await getMarketingAssets(ctx);
  const validations = await validate(
    propertySettings,
    {
      requiredFields: PROPERTY_SETTING_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(propertySetting) {
        await savePropertySettingData(ctx, propertySetting, programs, marketingAssets);
      },
      async customCheck(propertySetting) {
        return await makeAdditionalValidations(ctx, propertySetting, programs, marketingAssets);
      },
    },
    ctx,
    spreadsheet.PropertySetting.columns,
  );
  const properties = await getProperties(ctx);
  const propertySettingsSetupErrors = getInvalidPropertySettingsSetup(properties);

  return {
    invalidFields: [...validations, propertySettingsSetupErrors],
  };
};
