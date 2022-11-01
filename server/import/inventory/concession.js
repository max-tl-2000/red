/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEmpty from 'lodash/isEmpty';
import DBColumnLength from '../../utils/dbConstants.js';
import { validate, Validation, getValueToPersist } from './util.js';
import { saveConcession } from '../../dal/concessionRepo.js';
import { DALTypes } from '../../../common/enums/DALTypes.js';
import { getAssociatedEntity } from '../../helpers/importUtils.js';
import { getProperties } from '../../dal/propertyRepo.js';
import { applyFeeToConcession } from '../../dal/feeRepo.js';
import { validateBuildings } from '../../services/buildings.js';
import { validateAmenities } from '../../services/amenities.js';
import { validateLayouts } from '../../services/layouts.js';
import { validateLeaseNames } from '../../services/leaseTerms.js';
import { validateFees } from '../../services/fees.js';
import { parseAsInTimezone } from '../../../common/helpers/moment-utils';
import { SIMPLE_DATE_US_FORMAT } from '../../../common/date-constants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

export const APPLIED_TO_FEES_FIELD = 'appliedToFees';

const CONCESSIONS_REQUIRED_FIELDS = [
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
    fieldName: 'appliedToFees',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'relativeAdjustment',
    validation: [Validation.NUMERIC],
  },
  {
    fieldName: 'absoluteAdjustment',
    validation: [Validation.NUMERIC],
  },
  {
    fieldNames: ['relativeAdjustment', 'absoluteAdjustment'],
    validation: Validation.AT_LEAST_ONE_NOT_EMPTY,
  },
  {
    fieldName: 'recurringCount',
    validation: [Validation.INTEGER, Validation.MIN_VALUE],
    minValue: 1,
  },
  {
    fieldName: 'nonRecurringAppliedAt',
    validation: [Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.NonRecurringApplied,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'leaseState',
    validation: [Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    maxLength: DBColumnLength.Type,
    validValues: DALTypes.LeaseState,
  },
  {
    fieldName: 'minLeaseLength',
    validation: [Validation.NUMERIC_ARRAY],
  },
  {
    fieldName: 'maxLeaseLength',
    validation: [Validation.NUMERIC_ARRAY],
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
    fieldName: 'account',
    validation: [Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'subAccount',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'externalChargeCode',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
];

const concessionToCriteria = [
  {
    concessionProperty: 'validLeaseNames',
    criteriaName: 'leaseNames',
  },
  {
    concessionProperty: 'validLayouts',
    criteriaName: 'layouts',
  },
  {
    concessionProperty: 'validBuildings',
    criteriaName: 'buildings',
  },
  {
    concessionProperty: 'validAmenities',
    criteriaName: 'amenities',
  },
  {
    concessionProperty: 'minLeaseLength',
    criteriaName: 'minLeaseLength',
  },
  {
    concessionProperty: 'maxLeaseLength',
    criteriaName: 'maxLeaseLength',
  },
];

const createJsonForMatchingCriteria = concession =>
  concessionToCriteria.reduce((matchingCriteria, { concessionProperty, criteriaName }) => {
    if (concession[concessionProperty]) {
      matchingCriteria[criteriaName] = concession[concessionProperty];
    }
    return matchingCriteria;
  }, {});

const PREREQUISITES = [
  {
    field: 'property',
    tableFieldName: 'name',
    table: 'Property',
    idReceiver: 'propertyId',
  },
];

export const updateWithValidLeaseNames = async (ctx, concession) => {
  const result = await validateLeaseNames(ctx, concession);
  concession.validLeaseNames = result.elements;
  return result.error;
};

export const updateWithValidLayouts = async (ctx, concession) => {
  const result = await validateLayouts(ctx, concession);
  concession.validLayouts = result.elements;
  return result.error;
};

export const updateWithValidBuildings = async (ctx, concession) => {
  const result = await validateBuildings(ctx, concession);
  concession.validBuildings = result.elements;
  return result.error;
};

export const updateWithValidAmenities = async (ctx, concession) => {
  const result = await validateAmenities(ctx, concession, DALTypes.AmenityCategory.INVENTORY.toLowerCase());
  concession.validAmenities = result.elements;
  return result.error;
};

export const updateWithValidFees = async (ctx, concession) => {
  const result = await validateFees(ctx, concession, concession.appliedToFees, APPLIED_TO_FEES_FIELD);
  concession.validFees = result.elements;
  return result.error;
};

const doesNotHaveFloorCeilingAdjustment = ({ relativeAdjustment, absoluteAdjustment, adjustmentFloorCeiling }) =>
  !adjustmentFloorCeiling && relativeAdjustment && absoluteAdjustment;
const doesHaveFloorCeilingAdjustment = ({ relativeAdjustment, absoluteAdjustment, adjustmentFloorCeiling }) =>
  adjustmentFloorCeiling && (!relativeAdjustment || !absoluteAdjustment);

export const validateRelativeAndAbsoluteAdjustment = concession => {
  let validationResults = [];
  if (doesNotHaveFloorCeilingAdjustment(concession)) {
    validationResults = [
      {
        name: 'relativeAdjustment',
        message: 'ONLY_ONE_OF_RELATIVE_OR_ABSOLUTE_ADJUSTMENT_ALLOWED_WHEN_PRICE_FLOOR_CEILING_IS_DISABLED',
      },
      {
        name: 'absoluteAdjustment',
        message: 'ONLY_ONE_OF_RELATIVE_OR_ABSOLUTE_ADJUSTMENT_ALLOWED_WHEN_PRICE_FLOOR_CEILING_IS_DISABLED',
      },
    ];
  } else if (doesHaveFloorCeilingAdjustment(concession)) {
    const { absoluteAdjustment } = concession;
    validationResults = [
      {
        name: !absoluteAdjustment ? 'absoluteAdjustment' : 'relativeAdjustment',
        message: 'RELATIVE_AND_ABSOLUTE_ADJUSTMEN_SHOULD_BE_DEFINED_WHEN_PRICE_FLOOR_CEILING_IS_ENABLED',
      },
    ];
  }

  return validationResults;
};

const isRecurringWithNonRecurringAppliedAtFlag = concession =>
  concession.recurringFlag && concession.nonRecurringAppliedAt
    ? [
        {
          name: 'nonRecurringAppliedAt',
          message: 'RECURRING_WITH_NON_RECURRING_APPLIED',
        },
      ]
    : [];

export const validateVariableDefaultPrices = ({ variableAdjustmentFlag, relativeDefaultAdjustment, absoluteDefaultAdjustment, bakedIntoAppliedFeeFlag }) => {
  if ((relativeDefaultAdjustment || absoluteDefaultAdjustment) && !variableAdjustmentFlag) {
    return [
      {
        name: relativeDefaultAdjustment ? 'relativeDefaultAdjustment' : 'absoluteDefaultAdjustment',
        message: 'VARIABLE_ADJUSTMENT_FLAG_HAS_TO_BE_ENABLED',
      },
    ];
  }

  if (relativeDefaultAdjustment && absoluteDefaultAdjustment) {
    return [
      {
        name: 'relativeDefaultAdjustment',
        message: 'ONLY_ONE_DEFAULT_PRICE_IS_ALLOW',
      },
      {
        name: 'absoluteDefaultAdjustment',
        message: 'ONLY_ONE_DEFAULT_PRICE_IS_ALLOW',
      },
    ];
  }

  if (bakedIntoAppliedFeeFlag && (relativeDefaultAdjustment || absoluteDefaultAdjustment)) {
    return [
      {
        name: relativeDefaultAdjustment ? 'relativeDefaultAdjustment' : 'absoluteDefaultAdjustment',
        message: 'BAKED_INTO_APPLIED_FEE_FLAG_HAS_TO_BE_DISABLED',
      },
    ];
  }

  return [];
};

export const validateRecurringCountNotSupported = ({ tenant, recurringCount }) => {
  const { backendIntegration = {} } = tenant.metadata || {};

  if (backendIntegration.name === DALTypes.BackendMode.MRI && recurringCount) {
    return [
      {
        name: 'recurringCount',
        message: 'NON_ZERO_RECURRING_COUNT',
      },
    ];
  }

  return [];
};
export async function additionalValidations(ctx, concession, properties) {
  const associatedProp = getAssociatedEntity(properties, concession.property) || {};
  concession.propertyId = associatedProp.id;
  const leaseNameValidation = await updateWithValidLeaseNames(ctx, concession);
  const layoutValidation = await updateWithValidLayouts(ctx, concession);
  const buildingValidation = await updateWithValidBuildings(ctx, concession);
  const amenitiesValidation = await updateWithValidAmenities(ctx, concession);
  const feesValidation = await updateWithValidFees(ctx, concession);
  const recurringValidation = await isRecurringWithNonRecurringAppliedAtFlag(concession);
  const variableDefaultPricesValidation = validateVariableDefaultPrices(concession);
  const adjustmentsValidation = validateRelativeAndAbsoluteAdjustment(concession);
  const recurringCountNotSupportedValidation = validateRecurringCountNotSupported({ tenant: ctx.tenant, ...concession });
  const validations = [];

  return validations.concat(
    leaseNameValidation,
    layoutValidation,
    buildingValidation,
    amenitiesValidation,
    feesValidation,
    recurringCountNotSupportedValidation,
    recurringValidation,
    variableDefaultPricesValidation,
    adjustmentsValidation,
  );
}

async function saveConcessionData(ctx, concession, dateSettings) {
  const matchingCriteria = createJsonForMatchingCriteria(concession);

  const record = await saveConcession(ctx, {
    name: concession.name,
    displayName: concession.displayName,
    propertyId: concession.propertyId,
    relativeAdjustment: getValueToPersist(concession.relativeAdjustment),
    absoluteAdjustment: getValueToPersist(concession.absoluteAdjustment),
    relativeDefaultAdjustment: getValueToPersist(concession.relativeDefaultAdjustment),
    absoluteDefaultAdjustment: getValueToPersist(concession.absoluteDefaultAdjustment),
    excludeFromRentFlag: concession.excludeFromRentFlag,
    hideInSelfService: concession.hideInSelfServiceFlag,
    variableAdjustment: concession.variableAdjustmentFlag,
    optional: concession.optionalFlag,
    recurring: concession.recurringFlag,
    recurringCount: getValueToPersist(concession.recurringCount),
    nonRecurringAppliedAt: concession.nonRecurringAppliedAt,
    matchingCriteria: !isEmpty(matchingCriteria) ? matchingCriteria : null,
    leaseState: getValueToPersist(concession.leaseState, null),
    startDate: parseAsInTimezone(getValueToPersist(concession.startDate, null), dateSettings).toJSON(),
    endDate: parseAsInTimezone(getValueToPersist(concession.endDate, null), dateSettings).toJSON(),
    account: getValueToPersist(concession.account),
    subAccount: getValueToPersist(concession.subAccount),
    taxable: concession.taxableFlag,
    externalChargeCode: concession.externalChargeCode || null,
    bakedIntoAppliedFeeFlag: concession.bakedIntoAppliedFeeFlag,
    adjustmentFloorCeiling: getValueToPersist(concession.adjustmentFloorCeiling, null),
  });

  if (concession.validFees) {
    for (const feeId of concession.validFees) {
      await applyFeeToConcession(ctx, { concessionId: record.id, feeId });
    }
  }
}

export async function importConcessions(ctx, concessions) {
  const properties = await getProperties(ctx);
  const invalidFields = await validate(
    concessions,
    {
      requiredFields: CONCESSIONS_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(concession) {
        const { propertyId } = concession;
        const timezone = (properties.find(property => property.id === propertyId) || {}).timezone;
        const dateSettings = { timezone, format: SIMPLE_DATE_US_FORMAT };

        await saveConcessionData(ctx, concession, dateSettings);
      },
      async customCheck(concession) {
        return additionalValidations(ctx, concession, properties);
      },
    },
    ctx,
    spreadsheet.Concession.columns,
  );

  return {
    invalidFields,
  };
}
