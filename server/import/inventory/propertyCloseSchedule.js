/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { savePropertyCloseSchedule as savePropertyCloseScheduleDb } from '../../dal/propertyCloseScheduleRepo';
import { validate, Validation } from './util.js';
import { getProperties } from '../../dal/propertyRepo';
import DBColumnLength from '../../utils/dbConstants.js';
import { SIMPLE_DATE_US_FORMAT } from '../../../common/date-constants';
import { parseAsInTimezone, now } from '../../../common/helpers/moment-utils';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const PROPERTY_NAME = 'propertyName';
const MONTH = 'month';
const YEAR = 'year';
const ROLL_FORWARD_DATE = 'rollForwardDate';

const ERROR_CONSECUTIVE_MONTH = 'Missing month';
const ERROR_CONSECUTIVE_MONTH_GROUP = 'Error on consecutive month, row disregarded';
const ERROR_ROLL_FORWARD_DATE = 'Wrong rollForwardDate';
const ERROR_ROLL_FORWARD_DATE_SHOULD_BE_IN_THE_FUTURE = 'RollForwardDate should be in the future';

const PROPERTY_CLOSE_SCHEDULE_REQUIRED_FIELDS = [
  {
    fieldName: PROPERTY_NAME,
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: MONTH,
    validation: [Validation.NOT_EMPTY, Validation.NUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: YEAR,
    validation: [Validation.NOT_EMPTY, Validation.NUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: ROLL_FORWARD_DATE,
    validation: [Validation.NOT_EMPTY, Validation.DATE],
  },
];

const PREREQUISITES = [
  {
    field: PROPERTY_NAME,
    tableFieldName: 'name',
    table: 'Property',
    idReceiver: 'propertyId',
  },
];

const getPropertyTimezoneByFilter = (properties, filter, compareTo) => (properties.find(property => filter(property, compareTo)) || {}).timezone;
const filterByPropertyName = (property, name) => property.name === name;
const filterByPropertyId = (property, id) => property.id === id;

const savePropertyCloseSchedule = async (ctx, propertyCloseSchedule, properties) => {
  const { propertyId, month, year, rollForwardDate } = propertyCloseSchedule;
  const dateSettings = { timezone: getPropertyTimezoneByFilter(properties, filterByPropertyId, propertyId), format: SIMPLE_DATE_US_FORMAT };

  return await savePropertyCloseScheduleDb(ctx, {
    propertyId,
    month,
    year,
    rollForwardDate: parseAsInTimezone(rollForwardDate, dateSettings).toJSON(),
  });
};

const getPreviousDateString = ({ month, year } = {}) => {
  month = parseInt(month, 10);
  year = parseInt(year, 10);
  if (month === 1) {
    month = 12;
    year--;
  } else {
    month--;
  }
  return `${month}/10/${year}`;
};

const getErrorsOnGroupedPropertyCloseSchedule = (propertyCloseSchedules, timezone) => {
  let errorOnGroup = false;
  let previousDate = null;
  let previousRollForwardDate = null;
  const errors = [];
  const dateSettings = { timezone, format: SIMPLE_DATE_US_FORMAT };

  propertyCloseSchedules.forEach(({ data, index }, arrayIndex) => {
    const previousDateString = getPreviousDateString(data);
    if (arrayIndex === 0) {
      previousDate = parseAsInTimezone(previousDateString, dateSettings);
      previousRollForwardDate = parseAsInTimezone(data.rollForwardDate, dateSettings);
      return;
    }

    const date = parseAsInTimezone(previousDateString, dateSettings);
    const rollForwardDate = parseAsInTimezone(data.rollForwardDate, dateSettings);
    const nextMonthDate = previousDate.add(1, 'M');

    if (nextMonthDate.month() !== date.month()) {
      errorOnGroup = true;
      errors.push({
        index,
        error: {
          name: MONTH,
          message: ERROR_CONSECUTIVE_MONTH,
        },
      });
    }

    if (rollForwardDate < previousRollForwardDate) {
      errorOnGroup = true;
      errors.push({
        index,
        error: {
          name: ROLL_FORWARD_DATE,
          message: ERROR_ROLL_FORWARD_DATE,
        },
      });
    }

    if (errorOnGroup) {
      errors.push({
        index,
        error: {
          name: PROPERTY_NAME,
          message: ERROR_CONSECUTIVE_MONTH_GROUP,
        },
      });
    }
    previousDate = date;
    previousRollForwardDate = rollForwardDate;
  });
  return errors;
};

const getInvalidEntitiesCustomValidation = (ctx, properties, propertyCloseSchedules) =>
  properties.reduce((acc, property) => {
    const propertyCloseSchedulesByProperty = propertyCloseSchedules.filter(propertyCloseSchedule => propertyCloseSchedule.data.propertyName === property.name);
    if (!propertyCloseSchedulesByProperty.length) return acc;
    return acc.concat(getErrorsOnGroupedPropertyCloseSchedule(propertyCloseSchedulesByProperty, property.timezone));
  }, []);

export const importPropertyCloseSchedules = async (ctx, propertyCloseSchedules) => {
  const properties = await getProperties(ctx);

  const validEntities = [];
  const invalidEntities = await validate(
    propertyCloseSchedules,
    {
      requiredFields: PROPERTY_CLOSE_SCHEDULE_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      customCheck(propertyCloseSchedule) {
        const propertyName = propertyCloseSchedule[PROPERTY_NAME];
        const dateSettings = { timezone: getPropertyTimezoneByFilter(properties, filterByPropertyName, propertyName) };

        const rollForwardDate = parseAsInTimezone(propertyCloseSchedule.rollForwardDate, { ...dateSettings, format: SIMPLE_DATE_US_FORMAT });
        if (now(dateSettings) > rollForwardDate) {
          return [
            {
              name: ROLL_FORWARD_DATE,
              message: ERROR_ROLL_FORWARD_DATE_SHOULD_BE_IN_THE_FUTURE,
            },
          ];
        }
        return [];
      },
      async onValidEntity(propertyCloseSchedule, index) {
        validEntities.push({
          index,
          data: propertyCloseSchedule,
        });
      },
    },
    ctx,
    spreadsheet.PropertyCloseSchedule.columns,
  );
  const invalidEntitiesCustomValidation = await getInvalidEntitiesCustomValidation(ctx, properties, validEntities);

  const invalidFields = invalidEntities.concat(
    await validate(validEntities, {
      requiredFields: PROPERTY_CLOSE_SCHEDULE_REQUIRED_FIELDS,
      customCheck(propertyCloseSchedule, index) {
        const invalidEntittiesPerIndex = invalidEntitiesCustomValidation.filter(invalidEntity => invalidEntity.index === index);
        if (invalidEntittiesPerIndex.length) {
          return invalidEntittiesPerIndex.reduce((acc, item) => {
            acc.push(item.error);
            return acc;
          }, []);
        }
        return [];
      },
      async onValidEntity(propertyCloseSchedule) {
        await savePropertyCloseSchedule(ctx, propertyCloseSchedule, properties);
      },
    }),
  );

  return {
    invalidFields,
  };
};
