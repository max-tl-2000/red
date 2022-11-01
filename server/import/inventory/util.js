/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getKeyByValue } from '../../../common/enums/enumHelper';
import getFieldValue from '../../../common/helpers/get-field-value';
import trim from '../../../common/helpers/trim';
import { validateEmail } from '../../../common/helpers/validations/email';
import { selectIdAndFieldFromValueList, selectIdFromValueGroups } from '../../dal/genericRepo.js';

import { isValidPhoneNumber } from '../../helpers/phoneUtils';
import { getColumnHeaders } from '../../../common/helpers/spreadsheet';
import { translateFlagCellValue } from '../../helpers/importUtils';

import {
  isValidUSCurrency,
  isValidDecimal,
  isValidPostalCode,
  isNumericArray,
  isValidPercentage,
  hasNoDashHyphenOrDot,
  isValidShorthand,
  isUrl,
  trimAndSplitByComma,
} from '../../../common/regex';
import { toMoment, isValidTimezone } from '../../../common/helpers/moment-utils';
import { SIMPLE_DATE_US_FORMAT } from '../../../common/date-constants';
import { SheetImportError } from '../../common/errors';

export const Validation = {
  NOT_EMPTY: 'notEmpty',
  EXISTS_IN: 'existsIn',
  AT_LEAST_ONE_NOT_EMPTY: 'atLeastOneNotEmpty',
  ALPHANUMERIC: 'string',
  INTEGER: 'integer',
  POSITIVE_INTEGER: 'positiveInteger',
  DECIMAL: 'decimal',
  POSITIVE_DECIMAL: 'positiveDecimal',
  NEGATIVE_DECIMAL: 'negativeDecimal',
  NUMERIC: 'numeric',
  BOOLEAN: 'boolean',
  DATE: 'date',
  MAIL: 'mail',
  CURRENCY: 'currency',
  NUMERIC_ARRAY: 'numericArray',
  MAIL_ARRAY: 'mailArray',
  MIN_VALUE: 'minValue',
  MAX_VALUE: 'maxValue',
  SHORTHAND: 'validShorthand',
  PHONE_NUMBER: 'phoneNumber',
  POSTAL_CODE: 'postalCode',
  PERCENTAGE: 'percentage',
  INVENTORY_NAME: 'inventoryName',
  TIME_ZONE: 'timeZone',
  URL: 'url',
};

export const isValidMinimumValue = (value, minValue) => value >= minValue;

const isValidMaximumValue = (value, maxValue) => value <= maxValue;

export const convertStringValueToArray = (stringValue = '') => {
  const arrayOfValues = stringValue
    .split(',')
    .map(value => value.trim())
    .filter(value => !!value);

  return [...new Set(arrayOfValues)];
};

const isValidMailArray = valuesAsString => {
  const valuesAsArray = convertStringValueToArray(valuesAsString);
  return valuesAsArray.every(value => validateEmail(value) !== 'INVALID_EMAIL');
};

export const splitBySymbol = (value, symbol) => value.split(symbol).map(val => val.trim());

export const existsIn = (validValues, value) => {
  const valuesArray = splitBySymbol(value, ',');
  return valuesArray.every(val => !!getKeyByValue(validValues, val));
};

// Dates coming from the spreadsheet should be in the M/D/YYYY format
export const tryParseAsDate = fieldValue => toMoment(fieldValue, { parseFormat: SIMPLE_DATE_US_FORMAT }).isValid();

const isRegex = val => {
  try {
    RegExp(val);
  } catch (e) {
    return false;
  }
  return true;
};

const validationMethods = {
  [Validation.NOT_EMPTY]: {
    fn: ({ fieldValue }) => !!trim(fieldValue),
    errorToken: 'FIELD_REQUIRED',
  },
  [Validation.EXISTS_IN]: {
    fn: ({ fieldValue, fieldValidation }) => !trim(fieldValue) || existsIn(fieldValidation.validValues, fieldValue),
    errorToken: 'INVALID_VALUE',
  },
  [Validation.AT_LEAST_ONE_NOT_EMPTY]: {
    fn: ({ fieldValues }) => fieldValues.some(field => trim(field)),
    errorToken: 'ONE_OF_THIS_FIELDS_REQUIRED',
  },
  [Validation.ALPHANUMERIC]: {
    fn: ({ fieldValue, fieldValidation }) => !trim(fieldValue) || trim(fieldValue).length <= fieldValidation.maxLength,
    errorToken: 'INVALID_LENGTH',
  },
  [Validation.REGEX]: {
    fn: ({ fieldValue }) => isRegex(trim(fieldValue)),
    errorToken: 'NOT_REGEX',
  },
  [Validation.NUMERIC]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || !isNaN(fieldValue),
    errorToken: 'NOT_A_NUMBER',
  },
  [Validation.INTEGER]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || (!isNaN(fieldValue) && parseInt(fieldValue, 10) === parseFloat(fieldValue)),
    errorToken: 'NOT_INTEGER',
  },
  [Validation.POSITIVE_DECIMAL]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || (!isNaN(fieldValue) && fieldValue >= 0),
    errorToken: 'NOT_POSITIVE_DECIMAL',
  },
  [Validation.NEGATIVE_DECIMAL]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || (!isNaN(fieldValue) && fieldValue < 0),
    errorToken: 'NOT_NEGATIVE_DECIMAL',
  },
  [Validation.POSITIVE_INTEGER]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || (!isNaN(fieldValue) && parseInt(fieldValue, 10) === parseFloat(fieldValue) && parseInt(fieldValue, 10) >= 0),
    errorToken: 'NOT_POSITIVE_INTEGER',
  },
  [Validation.BOOLEAN]: {
    fn: ({ fieldValue }) =>
      typeof fieldValue === 'boolean' ||
      fieldValue === 1 ||
      fieldValue === 0 ||
      !trim(fieldValue) ||
      fieldValue.toLowerCase() === 'true' ||
      fieldValue.toLowerCase() === 'false' ||
      fieldValue.toLowerCase() === 'x',
    errorToken: 'NOT_BOOLEAN',
  },
  [Validation.DATE]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || tryParseAsDate(fieldValue),
    errorToken: 'INVALID_DATE',
  },
  [Validation.MAIL]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || validateEmail(fieldValue) !== 'INVALID_EMAIL',
    errorToken: 'INVALID_EMAIL',
  },

  [Validation.CURRENCY]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || isValidUSCurrency(fieldValue),
    errorToken: 'INVALID_CURRENCY',
  },
  [Validation.NUMERIC_ARRAY]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || isNumericArray(fieldValue),
    errorToken: 'INVALID_NUMERIC_ARRAY',
  },
  [Validation.MAIL_ARRAY]: {
    fn: ({ fieldValue }) => isValidMailArray(fieldValue),
    errorToken: 'INVALID_MAIL_ARRAY',
  },
  [Validation.MIN_VALUE]: {
    fn: ({ fieldValue, fieldValidation }) => !trim(fieldValue) || isValidMinimumValue(fieldValue, fieldValidation.minValue),
    errorToken: 'INVALID_MIN_VALUE',
  },
  [Validation.MAX_VALUE]: {
    fn: ({ fieldValue, fieldValidation }) => !trim(fieldValue) || isValidMaximumValue(fieldValue, fieldValidation.maxValue),
    errorToken: 'INVALID_MAX_VALUE',
  },
  [Validation.DECIMAL]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || isValidDecimal(fieldValue),
    errorToken: 'INVALID_DECIMAL',
  },
  [Validation.SHORTHAND]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || isValidShorthand(fieldValue),
    errorToken: 'INVALID_SHORTHAND_NAME',
  },
  [Validation.PHONE_NUMBER]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || isValidPhoneNumber(fieldValue),
    errorToken: 'INVALID_PHONE_NUMBER',
  },
  [Validation.POSTAL_CODE]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || isValidPostalCode(fieldValue),
    errorToken: 'INVALID_POSTAL_CODE',
  },
  [Validation.PERCENTAGE]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || isValidPercentage(fieldValue),
    errorToken: 'INVALID_PERCENTAGE_VALUE',
  },
  [Validation.INVENTORY_NAME]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || hasNoDashHyphenOrDot(fieldValue),
    errorToken: 'INVALID_INVENTORY_NAME',
  },
  [Validation.TIME_ZONE]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || isValidTimezone(fieldValue),
    errorToken: 'INVALID_TIME_ZONE',
  },
  [Validation.URL]: {
    fn: ({ fieldValue }) => !trim(fieldValue) || isUrl(fieldValue),
    errorToken: 'INVALID_URL',
  },
};

function getIdFromPrerequisite(data, prerequisite, relatedIds) {
  let value = data[prerequisite.field];
  if (!value) {
    return null;
  }

  let idElement;
  value = value.toLowerCase();
  if (!prerequisite.relatedField) {
    // TODO: aren't amenity keys expected to be case-insensitive?
    idElement = relatedIds[prerequisite.field].find(pair => value === pair[prerequisite.tableFieldName].toLowerCase());
  } else {
    const relatedId = data[prerequisite.relatedTableFieldName];
    if (!relatedId) {
      return null;
    }

    idElement = relatedIds[prerequisite.field].find(
      tuple => value === tuple[prerequisite.tableFieldName].toLowerCase() && relatedId === tuple[prerequisite.relatedTableFieldName],
    );
  }

  if (!idElement) {
    return null;
  }

  return idElement.id;
}

function dividePrequisites(prerequisites) {
  const standAlonePrerequisites = [];
  const relatedPrerequisites = [];

  prerequisites.forEach(prerequisite => {
    if (prerequisite.relatedField) {
      relatedPrerequisites.push(prerequisite);
    } else {
      standAlonePrerequisites.push(prerequisite);
    }
  });

  return { standAlonePrerequisites, relatedPrerequisites };
}

function sortPrerequisites(prerequisites) {
  const { standAlonePrerequisites, relatedPrerequisites } = dividePrequisites(prerequisites);

  return standAlonePrerequisites.concat(relatedPrerequisites);
}

export function validateData(element, requiredFields, prerequisites, relatedIds) {
  const invalid = [];
  requiredFields.forEach(fieldValidation => {
    const validations = Array.isArray(fieldValidation.validation) ? fieldValidation.validation : [fieldValidation.validation];
    const fieldValue = getFieldValue(element, fieldValidation.fieldName);
    const fieldValues = fieldValidation.fieldNames ? fieldValidation.fieldNames.map(field => element[field]) : null;

    const errorField = fieldValidation.excelColumn ? fieldValidation.excelColumn : fieldValidation.fieldName;
    validations.forEach(validation => {
      const validator = validationMethods[validation];

      if (!validator) {
        throw new Error('Unknown Validation');
      }

      const isValid = validator.fn({
        fieldValue,
        fieldValues,
        fieldValidation,
      });

      if (!isValid && !fieldValues) {
        invalid.push({
          name: errorField,
          message: validator.errorToken,
        });
      }

      if (!isValid && fieldValues) {
        fieldValidation.fieldNames.forEach(field => {
          invalid.push({
            name: field,
            message: validator.errorToken,
          });
        });
      }
    });
  });

  if (prerequisites) {
    const sortedPrerequisites = sortPrerequisites(prerequisites);
    const elementClone = { ...element };

    // Sorting the standAlones first, to get the ids
    sortedPrerequisites.forEach(prerequisite => {
      const field = prerequisite.field;

      const fieldValue = getFieldValue(elementClone, field);

      const id = getIdFromPrerequisite(elementClone, prerequisite, relatedIds);
      if (!!trim(fieldValue) && !id) {
        invalid.push({
          name: field,
          message: 'ELEMENT_DOESNT_EXIST',
        });
        // We need to set the idReceiver to evaluate the relatedPrerequisites
      } else if (id) {
        elementClone[prerequisite.idReceiver] = id;
      }
    });
  }

  return invalid;
}

function fillRelatedIds(data, prerequisites, relatedIds) {
  if (!prerequisites) {
    return data;
  }

  const sortedPrerequisites = sortPrerequisites(prerequisites);

  sortedPrerequisites.forEach(prerequisite => {
    data[prerequisite.idReceiver] = getIdFromPrerequisite(data, prerequisite, relatedIds);
  });

  return data;
}

function getRelatedPrerequisite(prerequisite, prerequisites) {
  return prerequisites.find(prerequisiteAux => prerequisite.relatedField === prerequisiteAux.field);
}

function getRelatedIdPair(value, relatedIds, relatedPrerequisite) {
  return relatedIds[relatedPrerequisite.field].find(pair => value === pair[relatedPrerequisite.tableFieldName]);
}

export async function getRelatedIds(entities, prerequisites, ctx) {
  if (!prerequisites) {
    return {};
  }

  const relatedIds = {};
  const { standAlonePrerequisites, relatedPrerequisites } = dividePrequisites(prerequisites);

  // TODO this can probably be a single sql call
  for (let j = 0; j < standAlonePrerequisites.length; j++) {
    const prerequisite = standAlonePrerequisites[j];
    const nameFieldList = entities.map(entity => entity.data[prerequisite.field]);
    try {
      relatedIds[prerequisite.field] = await selectIdAndFieldFromValueList(ctx, prerequisite.tableFieldName, nameFieldList, prerequisite.table);
    } catch (error) {
      throw new SheetImportError({
        message: error.message,
        columnName: prerequisite.field,
      });
    }
  }

  // TODO this can probably be a single sql call
  for (let k = 0; k < relatedPrerequisites.length; k++) {
    const prerequisite = relatedPrerequisites[k];
    const searchValues = [];
    const relatedPrerequisite = getRelatedPrerequisite(prerequisite, prerequisites);

    if (!relatedPrerequisite) {
      throw new SheetImportError({
        message: 'REFERRING_INVALID_RELATED_PREREQUISITE',
        prerequisite,
      });
    }

    for (let n = 0; n < entities.length; n++) {
      const { data } = entities[n];

      const value = data[relatedPrerequisite.field];
      if (value) {
        try {
          const relatedIdPair = getRelatedIdPair(value, relatedIds, relatedPrerequisite);
          if (relatedIdPair) {
            const mainValue = data[prerequisite.field];

            if (mainValue) {
              searchValues.push([relatedIdPair.id, mainValue]);
            }
          }
        } catch (error) {
          throw new SheetImportError({
            columnName: relatedPrerequisite.field,
            message: error.message,
            fieldValue: value,
            row: n + 2, // entities in sheets starts in the second row
          });
        }
      }
    }

    const searchFields = [prerequisite.relatedTableFieldName, prerequisite.tableFieldName];
    try {
      relatedIds[prerequisite.field] = await selectIdFromValueGroups(ctx, searchFields, searchValues, prerequisite.table);
    } catch (error) {
      throw new SheetImportError({
        message: error.message,
        columnName: prerequisite.field,
      });
    }
  }

  return relatedIds;
}

const checkColumnHeadersFromEntities = (entity, headersPicked) => {
  if (!headersPicked) return [];
  const headers = Object.keys(entity);
  return headersPicked.reduce((acc, header) => {
    if (headers.includes(header)) return acc;
    return acc.concat({
      name: header,
      message: 'MISSING_COLUMN',
    });
  }, []);
};

async function validateAndProcess(entities, opts, relatedIds, headersPicked) {
  const invalidEntities = [];

  if (opts.customSpreadsheetCheck) {
    const errors = await opts.customSpreadsheetCheck();
    if (errors.length) {
      invalidEntities.push({
        invalidFields: errors,
      });
    }
  }

  for (let i = 0; i < entities.length; i++) {
    const { data: entity, index } = entities[i];
    const { requiredFields, prerequisites } = opts;
    try {
      const invalidsFields = validateData(entity, requiredFields, prerequisites, relatedIds);
      const invalids = invalidsFields.concat(checkColumnHeadersFromEntities(entity, headersPicked));
      let onValidEntity = opts.onValidEntity;
      if (invalids.length) {
        invalidEntities.push({
          index,
          invalidFields: invalids,
        });
      } else {
        if (opts.customCheck) {
          const customErrors = await opts.customCheck(entity, index);
          if (customErrors.length) {
            invalidEntities.push({
              index,
              invalidFields: customErrors,
            });
            onValidEntity = false;
          }
        }

        if (onValidEntity) {
          const modifiedData = fillRelatedIds(entity, opts.prerequisites, relatedIds);
          await opts.onValidEntity(modifiedData, index);
        }
      }
    } catch (error) {
      const invalidFieldError = {
        name: error,
        message: `${error} - Element: ${JSON.stringify(entity)}`,
      };
      const indexOfDuplicateKeyError = error.message.toString().indexOf('duplicate key');
      if (indexOfDuplicateKeyError !== -1) {
        invalidFieldError.name = error.message.toString().slice(indexOfDuplicateKeyError);
        invalidFieldError.message = error.detail;
      }
      invalidEntities.push({
        index,
        invalidFields: [invalidFieldError],
      });
    }
  }

  return invalidEntities;
}

const convertDataToExpectedType = (entityField, columnHeader) => {
  if (entityField === null) return entityField;

  if (columnHeader.type === 'string') return entityField.toString();
  if (entityField !== '' && columnHeader.type === 'number') return parseFloat(entityField, 10);
  if (columnHeader.type === 'boolean') return translateFlagCellValue(entityField);
  return entityField;
};

export const convertEntitiesInAnExpectedType = (entities, headersPicked) => {
  if (!headersPicked) return entities;

  return entities.map(entity => {
    const entityHeaders = Object.keys(entity.data);
    const entityDataConverted = entityHeaders.reduce((acc, entityHeader) => {
      const headerPickedFound = headersPicked.find(headerPicked => headerPicked.header === entityHeader);
      return {
        ...acc,
        [entityHeader]: headerPickedFound ? convertDataToExpectedType(entity.data[entityHeader], headerPickedFound) : entity.data[entityHeader],
      };
    }, {});

    return {
      ...entity,
      data: entityDataConverted,
    };
  });
};

export async function validate(entities = [], opts = {}, ctx, headersPicked) {
  const relatedIds = await getRelatedIds(entities, opts.prerequisites, ctx);
  return await validateAndProcess(entities, opts, relatedIds, getColumnHeaders(headersPicked));
}

// case-insensitive match of enum value
export function getValueFromEnum(enumObj, matchValue) {
  if (matchValue) {
    const valueFromExcel = matchValue.toLowerCase().trim();
    const valueEnum = Object.keys(enumObj)
      .filter(key => enumObj[key].toLowerCase() === valueFromExcel)
      .map(key => enumObj[key]);
    return valueEnum[0];
  }
  return null;
}

export const getValueToPersist = (value, defaultValue = 0) => {
  if (typeof value === 'number') {
    return value;
  }
  const trimmed = trim(value);
  if (trimmed) {
    return trimmed;
  }
  return defaultValue;
};

export const generateAmenityValidationErrorMsg = (propertyName, amenitiesLength) =>
  `Cannot insert amenities for property: ${propertyName} with amenity import flag enabled, but found:${amenitiesLength}`;

export const checkEmptyAmenities = (row, propertiesWithImportSettingValue) => {
  const propertyInfoWithAmenityImportEnabled = propertiesWithImportSettingValue.find(p => p.name === row.property);
  const amenities = trimAndSplitByComma(row.amenities);
  if (propertyInfoWithAmenityImportEnabled && amenities.length) {
    return [
      {
        name: 'amenities',
        message: generateAmenityValidationErrorMsg(propertyInfoWithAmenityImportEnabled.name, amenities.length),
      },
    ];
  }
  return null;
};
