/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { saveAddressRow } from '../../services/addresses';
import { saveProperty, getPropertyByName, getNewInactiveProperties, getProperties, updateProperty } from '../../dal/propertyRepo';
import { getPropertyGroupHierarchy } from '../../dal/propertyGroupRepo';
import { archivePartiesFromSoldProperties } from '../../services/party';
import { validate, Validation, getValueToPersist } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { updatePostMonth } from '../../services/properties';
import { parseAsInTimezone } from '../../../common/helpers/moment-utils';
import { SIMPLE_DATE_US_FORMAT } from '../../../common/date-constants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { isNumber } from '../../../common/helpers/number';
import { extractValuesFromCommaSeparatedString } from '../../../common/helpers/strings';

const NO_AVAILABLE_OWNER = 'NO_AVAILABLE_OWNER';
const PROPERTY_GROUP = 'propertyGroup';
const OWNER = 'owner';
const GEO_LOCATION = 'geoLocation';
const INVALID_GEO_LOCATION = 'Invalid value for geoLocation';
const PARTY_COHORT = 'partyCohort';
const MULTIPLE_PARTY_COHORTS = 'Multiple party cohorts assigned to one property is not allowed';

const REMOVE_OWNER_PROPERTY_HAVE_PROPERTY_GROUP = 'REMOVE_OWNER_PROPERTY_HAVE_PROPERTY_GROUP';
const OPERATOR = 'operator';

const PROPERTY_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.SHORTHAND],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'propertyLegalName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: OWNER,
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: OPERATOR,
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: PROPERTY_GROUP,
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: PARTY_COHORT,
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldNames: [OWNER, OPERATOR, PROPERTY_GROUP],
    validation: Validation.AT_LEAST_ONE_NOT_EMPTY,
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
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.POSTAL_CODE],
    maxLength: DBColumnLength.PostalCode,
  },
  {
    fieldName: 'timeZone',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.TIME_ZONE],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'startDate',
    validation: [Validation.NOT_EMPTY, Validation.DATE],
  },
  {
    fieldName: 'endDate',
    validation: [Validation.DATE],
  },
  {
    fieldName: 'APN',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.APN,
  },
  {
    fieldName: 'MSANumber',
    validation: [Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'MSAName',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.MSAName,
  },
  {
    fieldName: 'websiteDomain',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.WebSite,
  },
  {
    fieldName: 'website',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.WebSite,
  },
  {
    fieldName: 'displayPhone',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Phone,
  },
  {
    fieldName: 'postMonth',
    validation: [Validation.DATE],
  },
  {
    fieldName: 'externalId',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'rmsExternalId',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    filename: 'leasingOfficeAddress',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ADDRESS_LENGTH,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'geoLocation',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Geofence,
  },
];

const savePropertyData = async (ctx, property) => {
  const timezone = property.timeZone;

  const record = await saveProperty(ctx, {
    name: property.name,
    displayName: property.displayName,
    propertyLegalName: property.propertyLegalName,
    owner: getValueToPersist(property.owner, null),
    operator: getValueToPersist(property.operator, null),
    propertyGroupId: getValueToPersist(property.propertyGroupId, null),
    partyCohortId: getValueToPersist(property.partyCohortId, null),
    addressId: property.addressId,
    startDate: parseAsInTimezone(getValueToPersist(property.startDate, null), { timezone, format: SIMPLE_DATE_US_FORMAT }).toJSON(),
    endDate: parseAsInTimezone(getValueToPersist(property.endDate, null), { timezone, format: SIMPLE_DATE_US_FORMAT }).toJSON(),
    APN: property.APN,
    MSANumber: getValueToPersist(property.MSANumber, null),
    MSAName: property.MSAName,
    description: property.description,
    website: property.website,
    websiteDomain: property.websiteDomain,
    displayPhone: property.displayPhone,
    timezone,
    externalId: property.externalId || property.name,
    rmsExternalId: property.rmsExternalId,
    leasingOfficeAddress: property.leasingOfficeAddress,
    inactive: property.inactiveFlag,
    geoLocation: JSON.parse(property.geoLocation),
  });
  property.id = record.id;
};

const saveDaughterProperties = async (ctx, properties) => {
  const savedProperties = await getProperties(ctx);

  await mapSeries(properties, async property => {
    if (property.data.daughterProperties) {
      const prop = savedProperties.find(p => p.name === property.data.name);
      const daughterProperties = savedProperties.filter(p => property.data.daughterProperties.includes(p.name));

      await updateProperty(ctx, { id: prop.id }, { daughterProperties: daughterProperties.map(p => p.id) });
    }
  });
};

const validatePropertyGroup = async (ctx, { owner, propertyGroup, name }) => {
  if (!owner && !propertyGroup) {
    return [
      {
        name: OWNER,
        message: NO_AVAILABLE_OWNER,
      },
      {
        name: PROPERTY_GROUP,
        message: NO_AVAILABLE_OWNER,
      },
    ];
  }

  if (!owner && propertyGroup) {
    const propertyGroupHierarchy = await getPropertyGroupHierarchy(ctx, propertyGroup);
    const ownerInPropertyGroupHierarchy = propertyGroupHierarchy.some(p => p.owner);
    if (!ownerInPropertyGroupHierarchy) {
      return [
        {
          name: PROPERTY_GROUP,
          message: NO_AVAILABLE_OWNER,
        },
      ];
    }
    return [];
  }

  if (owner && !propertyGroup) {
    const property = await getPropertyByName(ctx, name);
    if (!property || !property.propertyGroup) {
      return [];
    }

    return [
      {
        name: OWNER,
        message: REMOVE_OWNER_PROPERTY_HAVE_PROPERTY_GROUP,
      },
    ];
  }

  if (owner && propertyGroup) {
    const propertyGroupHierarchy = await getPropertyGroupHierarchy(ctx, propertyGroup);
    const ownerInPropertyGroupHierarchyButDifferentOwner = propertyGroupHierarchy.some(p => p.owner && p.ownerName !== owner);

    if (ownerInPropertyGroupHierarchyButDifferentOwner) {
      return [
        {
          name: OWNER,
          message: 'PROPERTY_GROUP_DIFFERENT_OWNER',
        },
      ];
    }
    return [];
  }

  return [];
};

const isTimezoneAlreadyDefined = (oldTimezone, newTimezone) => oldTimezone && getValueToPersist(newTimezone, null) !== oldTimezone;
const validatePropertyTimezone = async (ctx, { newTimezone, name }) => {
  const { timezone: oldTimezone } = (await getPropertyByName(ctx, name)) || {};

  if (isTimezoneAlreadyDefined(oldTimezone, newTimezone)) {
    return [
      {
        name: 'timeZone',
        message: 'TimeZone already defined',
      },
    ];
  }

  return [];
};

const validatePropertyGeoLocation = geoLocation => {
  const hasBothCoordinatesAsFloats = isNumber(geoLocation.lat) && isNumber(geoLocation.lng);
  if (!hasBothCoordinatesAsFloats) {
    return [
      {
        name: GEO_LOCATION,
        message: INVALID_GEO_LOCATION,
      },
    ];
  }

  return [];
};

const validatePartyCohorts = property => {
  const propertyPartyCohorts = extractValuesFromCommaSeparatedString(property.partyCohort);

  if (propertyPartyCohorts.length > 1) {
    return [
      {
        name: PARTY_COHORT,
        message: MULTIPLE_PARTY_COHORTS,
      },
    ];
  }

  return [];
};

const makeAdditionalValidations = async (ctx, property) => {
  const propertyGroupValidationResults = await validatePropertyGroup(ctx, property);
  const propertyTimezoneValidationResults = await validatePropertyTimezone(ctx, { newTimezone: property.timeZone, name: property.name });
  const propertyGeoLocationValidationResults = validatePropertyGeoLocation(JSON.parse(property.geoLocation));
  const partyCohortValidationResults = validatePartyCohorts(property);

  return [...propertyGroupValidationResults, ...propertyTimezoneValidationResults, ...propertyGeoLocationValidationResults, ...partyCohortValidationResults];
};

const PREREQUISITES = [
  {
    field: 'owner',
    tableFieldName: 'name',
    table: 'BusinessEntity',
    idReceiver: 'owner',
  },
  {
    field: 'operator',
    tableFieldName: 'name',
    table: 'BusinessEntity',
    idReceiver: 'operator',
  },
  {
    field: 'propertyGroup',
    tableFieldName: 'name',
    table: 'PropertyGroup',
    idReceiver: 'propertyGroupId',
  },
  {
    field: 'partyCohort',
    tableFieldName: 'name',
    table: 'PartyCohort',
    idReceiver: 'partyCohortId',
  },
];

export const importProperties = async (ctx, properties) => {
  const invalidEntitiesPostMonth = [];
  const invalidEntities = await validate(
    properties,
    {
      requiredFields: PROPERTY_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(property, index) {
        const { addressId, addressLine, postalCode, city, state } = await saveAddressRow(ctx, property);
        property.addressId = addressId;
        await savePropertyData(ctx, property);
        property.address = `${addressLine},${postalCode},${city},${state}`;

        try {
          const { postMonth, timeZone } = property;
          if (postMonth) await updatePostMonth(ctx, property.id, postMonth, timeZone);
        } catch (error) {
          invalidEntitiesPostMonth.push({
            index,
            invalidFields: [
              {
                name: 'postMonth',
                message: error.message,
              },
            ],
          });
        }
      },
      customCheck(property) {
        return makeAdditionalValidations(ctx, property);
      },
    },
    ctx,
    spreadsheet.Property.columns,
  );

  await saveDaughterProperties(ctx, properties);

  return {
    invalidFields: invalidEntities.concat(invalidEntitiesPostMonth),
  };
};

export const additionalPropertyProcess = async ctx => {
  const newInactiveProperties = await getNewInactiveProperties(ctx);
  if (!newInactiveProperties.length) return [];

  const newInactivePropertyIds = newInactiveProperties.map(prop => prop.id);
  await archivePartiesFromSoldProperties(ctx, newInactivePropertyIds);
  return [];
};
