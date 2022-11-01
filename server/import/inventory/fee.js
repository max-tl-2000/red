/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { Promise } from 'bluebird';
import uniqBy from 'lodash/uniqBy';
import { runInTransaction } from '../../database/factory';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getMatchingElementsByName } from '../../helpers/importUtils';
import { feesSavedWithAdditionalAndRelatedFees } from '../helpers/fee';
import { validate, Validation, getValueFromEnum, getValueToPersist } from './util';
import {
  getParentFeesFromAssociatedFees,
  getValidFeesByNameAndPropertyId,
  getFeesByPropertyId,
  bulkUpsertFeesFromImport,
  deleteAssociatedFeesByFeeIds,
  bulkUpsertAssociatedFeesFromImport,
} from '../../dal/feeRepo';
import { trimAndSplitByComma } from '../../../common/regex';
import DBColumnLength from '../../utils/dbConstants';
import { validateFees } from '../../services/fees';
import { getRowsMatchingConditions } from '../../dal/genericRepo';
import { getMarketingQuestionByName } from '../../dal/marketingQuestionsRepo';
import {
  getOnlyDepositAndRelativeFeeWithInventoryGroupParentErrorMsg,
  doesFeeFromSheetHaveParent,
  getRelativePriceFeeDependencyErrorMsg,
} from '../../dal/helpers/fees';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { getRelativeOrRelativeDefaultTextFromFee } from '../../../common/helpers/fee';
export const RELATED_FEES_FIELD = 'relatedFees';
export const ADDITIONAL_FEES_FIELD = 'additionalFees';
export const CLYCLE_ERROR_DETECTED = 'CYCLE_IN_ASSOCIATED_FEES';
export const INVALID_FEE_NAME_PROVIDED = 'INVALID_FEE_NAME_PROVIDED_IN_COLUMN';

const FEE_REQUIRED_FIELDS = [
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
    fieldName: 'feeType',
    validation: [Validation.NOT_EMPTY, Validation.EXISTS_IN],
    validValues: DALTypes.FeeType,
  },
  {
    fieldName: 'renewalLetterDisplayFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'quoteSectionName',
    validation: [Validation.EXISTS_IN],
    validValues: DALTypes.QuoteSection,
  },
  {
    fieldName: 'maxQuantityInQuote',
    validation: [Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'servicePeriod',
    validation: [Validation.EXISTS_IN],
    validValues: DALTypes.ServicePeriod,
  },
  {
    fieldName: 'variableAdjustmentFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'estimatedFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'relativePrice',
    validation: [Validation.POSITIVE_DECIMAL],
  },
  {
    fieldName: 'absolutePrice',
    validation: [Validation.POSITIVE_DECIMAL],
  },
  {
    fieldName: 'depositInterestFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'quotePaymentScheduleFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'leaseState',
    validation: [Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.FeeLeaseState,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'externalChargeCode',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalChargeAccount',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalChargeAccrualAccount',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalChargeNotes',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'externalChargeRef',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalReceiptAccount',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalReceiptAccrualAccount',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalReceiptOffset',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalReceiptNotes',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'externalReceiptRef',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalWaiverAccount',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalWaiverAccrualAccount',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalWaiverOffset',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'externalWaiverNotes',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'externalWaiverRef',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.ExternalId,
  },
  {
    fieldName: 'marketingQuestionName',
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

export const validateQuoteSectionName = ({ feeType, quoteSectionName }) => {
  if (feeType === DALTypes.FeeType.PENALTY && !!quoteSectionName) {
    return [
      {
        name: 'quoteSectionName',
        message: 'QUOTE_SECTION_NAME_SHOULD_BE_EMPTY_FOR_PENALTY',
      },
    ];
  }

  return [];
};

export const validateMaxQuantityInQuote = ({ feeType, maxQuantityInQuote }) => {
  const maxQuantityValue = getValueToPersist(maxQuantityInQuote, null);
  if (maxQuantityValue) {
    if (
      feeType !== DALTypes.FeeType.SERVICE &&
      feeType !== DALTypes.FeeType.INVENTORY_GROUP &&
      maxQuantityInQuote !== '' &&
      maxQuantityInQuote !== 0 &&
      maxQuantityInQuote !== 1
    ) {
      return [
        {
          name: 'maxQuantityInQuote',
          message: 'INVALID_QUANTITY_IN_QUOTE_VALUE_FOR_TYPE',
        },
      ];
    }
  }

  return [];
};

export const validateServicePeriod = ({ feeType, servicePeriod }) => {
  const lowerServicePeriod = getValueFromEnum(DALTypes.ServicePeriod, servicePeriod);
  if (
    [DALTypes.FeeType.PENALTY, DALTypes.FeeType.DEPOSIT, DALTypes.FeeType.LEASE_BREAK].includes(feeType) &&
    servicePeriod &&
    lowerServicePeriod !== DALTypes.ServicePeriod.ONE_TIME
  ) {
    return [
      {
        name: 'servicePeriod',
        message: 'INVALID_SERVICE_PERIOD_FOR_TYPE',
      },
    ];
  }

  if (DALTypes.FeeType.SERVICE === feeType && !servicePeriod) {
    return [
      {
        name: 'servicePeriod',
        message: 'MUST_HAVE_VALID_SERVICE_PERIOD_FOR_SERVICE_TYPE',
      },
    ];
  }

  return [];
};

export const validateVariableAdjustmentFlag = ({ feeType, variableAdjustmentFlag }) => {
  if (feeType === DALTypes.FeeType.INVENTORY_GROUP && variableAdjustmentFlag) {
    return [
      {
        name: 'variableAdjustmentFlag',
        message: 'VARIABLE_ADJUSTMENT_FLAG_SHOULD_BE_EMPTY_FOR_INVENTORY_GROUP',
      },
    ];
  }

  return [];
};

export const validateEstimatedFlag = ({ feeType, estimatedFlag }) => {
  if (feeType === DALTypes.FeeType.INVENTORY_GROUP && estimatedFlag) {
    return [
      {
        name: 'estimatedFlag',
        message: 'ESTIMATED_FLAG_SHOULD_BE_EMPTY_FOR_INVENTORY_GROUP',
      },
    ];
  }

  return [];
};

const doesNotHaveFloorCeilingPrice = ({ relativePrice, absolutePrice, priceFloorCeiling }) => !priceFloorCeiling && relativePrice && absolutePrice;
const doesHaveFloorCeilingPrice = ({ relativePrice, absolutePrice, priceFloorCeiling }) => priceFloorCeiling && (!relativePrice || !absolutePrice);

export const validateRelativeAndAbsolutePrice = fee => {
  const { feeType, relativePrice, absolutePrice, variableAdjustmentFlag } = fee;

  if (doesNotHaveFloorCeilingPrice(fee)) {
    return [
      {
        name: 'relativePrice',
        message: 'ONLY_ONE_OF_RELATIVE_OR_ABSOLUTE_PRICE_ALLOWED_WHEN_PRICE_FLOOR_CEILING_IS_DISABLED',
      },
      {
        name: 'absolutePrice',
        message: 'ONLY_ONE_OF_RELATIVE_OR_ABSOLUTE_PRICE_ALLOWED_WHEN_PRICE_FLOOR_CEILING_IS_DISABLED',
      },
    ];
  }
  if (doesHaveFloorCeilingPrice(fee)) {
    return [
      {
        name: !absolutePrice ? 'absolutePrice' : 'relativePrice',
        message: 'RELATIVE_AND_ABSOLUTE_PRICE_SHOULD_BE_DEFINED_WHEN_PRICE_FLOOR_CEILING_IS_ENABLED',
      },
    ];
  }

  if (relativePrice === '' && absolutePrice === '' && feeType !== DALTypes.FeeType.INVENTORY_GROUP) {
    return [
      {
        name: 'relativePrice',
        message: 'RELATIVE_AND_ABSOLUTE_PRICE_SHOULD_NOT_BE_EMPTY_EXCEPT_INVENTORY_GROUP',
      },
      {
        name: 'absolutePrice',
        message: 'RELATIVE_AND_ABSOLUTE_PRICE_SHOULD_NOT_BE_EMPTY_EXCEPT_INVENTORY_GROUP',
      },
    ];
  }

  if (feeType === DALTypes.FeeType.INVENTORY_GROUP && relativePrice !== '') {
    return [
      {
        name: 'relativePrice',
        message: 'RELATIVE_PRICE_SHOULD_BE_EMPTY_FOR_INVENTORY_GROUP',
      },
    ];
  }

  if (feeType === DALTypes.FeeType.INVENTORY_GROUP && absolutePrice !== '') {
    return [
      {
        name: 'absolutePrice',
        message: 'ABSOLUTE_PRICE_SHOULD_BE_EMPTY_FOR_INVENTORY_GROUP',
      },
    ];
  }

  if (variableAdjustmentFlag && (relativePrice === 0 || absolutePrice === 0)) {
    return [
      {
        name: 'relativePrice',
        message: 'RELATIVE_OR_ABSOLUTE_PRICE_SHOULD_NOT_BE_ZERO_FOR_VARIABLE_ADJUSTMENT_FLAG',
      },
      {
        name: 'absolutePrice',
        message: 'RELATIVE_OR_ABSOLUTE_PRICE_SHOULD_NOT_BE_ZERO_FOR_VARIABLE_ADJUSTMENT_FLAG',
      },
    ];
  }

  return [];
};

export const validateDepositInterestFlag = ({ feeType, depositInterestFlag }) => {
  if (feeType !== DALTypes.FeeType.DEPOSIT && depositInterestFlag) {
    return [
      {
        name: 'depositInterestFlag',
        message: 'DEPOSIT_FLAG_SHOULD_BE_EMPTY_FOR_NON_DEPOSIT_FEES',
      },
    ];
  }

  return [];
};

export const validateDepositFeesHaveNoRelatedFees = ({ feeType, relatedFees }) => {
  if (feeType === DALTypes.FeeType.DEPOSIT && relatedFees !== '') {
    return [
      {
        name: 'relatedFees',
        message: 'RELATED_FEES_SHOULD_BE_EMPTY_FOR_DEPOSIT_FEES',
      },
    ];
  }

  return [];
};

export const validateDepositFeesHaveNoAdditionalFees = ({ feeType, additionalFees }) => {
  if (feeType === DALTypes.FeeType.DEPOSIT && additionalFees !== '') {
    return [
      {
        name: 'additionalFees',
        message: 'ADDITIONAL_FEES_SHOULD_BE_EMPTY_FOR_DEPOSIT_FEES',
      },
    ];
  }

  return [];
};

export const validateOnlyDepositAndRelativeFeeWithInventoryGroupParent = ({ feeType }, propertyFees = [], feesStr = '') => {
  const result = {
    errors: [],
    invalidFeeIds: [],
  };
  if (!propertyFees.length || feeType !== DALTypes.FeeType.INVENTORY_GROUP) return result;

  const feesToSearch = trimAndSplitByComma(feesStr);
  const childFees = getMatchingElementsByName(feesToSearch, propertyFees);

  return childFees.reduce((acc, fee) => {
    if (fee.feeType === DALTypes.FeeType.DEPOSIT || (!fee.relativePrice && !fee.relativeDefaultPrice)) return acc;
    const relativePropName = getRelativeOrRelativeDefaultTextFromFee(fee);

    acc.errors.push({
      name: relativePropName,
      message: getOnlyDepositAndRelativeFeeWithInventoryGroupParentErrorMsg(fee.displayName, relativePropName),
    });
    acc.invalidFeeIds.push(fee.id);
    return acc;
  }, result);
};

export const updateWithValidFees = async (ctx, fee, feesColName, propertyFees) => {
  const feesStr = feesColName === RELATED_FEES_FIELD ? fee.relatedFees : fee.additionalFees;

  const inventoryGroupChildrenValidation = validateOnlyDepositAndRelativeFeeWithInventoryGroupParent(fee, propertyFees, feesStr);
  const relatedFeesValidation = await validateFees(ctx, fee, feesStr, feesColName, propertyFees);
  const { elements, error } = relatedFeesValidation;

  const validFees = elements ? elements.filter(feeId => !inventoryGroupChildrenValidation.invalidFeeIds.some(invalidId => invalidId === feeId)) : null;
  if (feesColName === RELATED_FEES_FIELD) {
    fee.validRelatedFees = validFees;
  } else {
    fee.validAdditionalFees = validFees;
  }
  return [...error, ...inventoryGroupChildrenValidation.errors];
};

export const validateFeeCycle = relatedFeesCycle => {
  if (!relatedFeesCycle || !relatedFeesCycle.isThereACycle) {
    return [];
  }

  return [
    {
      name: RELATED_FEES_FIELD,
      message: '',
    },
    {
      name: ADDITIONAL_FEES_FIELD,
      message: `${CLYCLE_ERROR_DETECTED}: ${relatedFeesCycle.fees}`,
    },
  ];
};

export const validateVariableDefaultPrices = ({ variableAdjustmentFlag, relativeDefaultPrice, absoluteDefaultPrice }) => {
  if ((relativeDefaultPrice || absoluteDefaultPrice) && !variableAdjustmentFlag) {
    return [
      {
        name: relativeDefaultPrice ? 'relativeDefaultPrice' : 'absoluteDefaultPrice',
        message: 'VARIABLE_ADJUSTMENT_FLAG_HAS_TO_BE_ENABLED',
      },
    ];
  }

  if (relativeDefaultPrice && absoluteDefaultPrice) {
    return [
      {
        name: 'relativeDefaultPrice',
        message: 'ONLY_ONE_DEFAULT_PRICE_IS_ALLOW',
      },
      {
        name: 'absoluteDefaultPrice',
        message: 'ONLY_ONE_DEFAULT_PRICE_IS_ALLOW',
      },
    ];
  }

  return [];
};

const validateMarketingQuestionName = async (ctx, { marketingQuestionName }) => {
  if (!marketingQuestionName) return [];

  const marketingQuestion = await getMarketingQuestionByName(ctx, marketingQuestionName);
  if (!marketingQuestion) return [{ name: 'marketingQuestionName', message: 'INVALID_MARKETING_QUESTION_NAME' }];
  if (marketingQuestion.inactive) return [{ name: 'marketingQuestionName', message: 'MARKETING_QUESTION_IS_INACTIVE' }];

  return [];
};

export const additionalValidations = async (ctx, fee) => {
  const validations = validateQuoteSectionName(fee).concat(
    validateMaxQuantityInQuote(fee),
    validateServicePeriod(fee),
    validateVariableAdjustmentFlag(fee),
    validateEstimatedFlag(fee),
    validateRelativeAndAbsolutePrice(fee),
    validateDepositInterestFlag(fee),
    validateVariableDefaultPrices(fee),
    await validateMarketingQuestionName(ctx, fee),
  );

  return validations;
};

export const validateDuplicatesOnAssociatedFees = (fee, propertyFees) => {
  const invalidFees = [];
  const { validRelatedFees, validAdditionalFees, name } = fee;
  fee.validRelatedFees = (validRelatedFees || []).reduce((acc, relatedFeeId) => {
    if (validAdditionalFees?.includes(relatedFeeId)) {
      invalidFees.push((propertyFees.find(x => x.id === relatedFeeId) || {}).name);

      fee.validAdditionalFees = validAdditionalFees?.filter(additionalFeeId => additionalFeeId !== relatedFeeId);
      return acc;
    }

    acc.push(relatedFeeId);
    return acc;
  }, []);

  return invalidFees.length > 0
    ? [
        {
          name,
          message: `These fees are both in addtional and related columns: ${invalidFees.join(',')}`,
        },
      ]
    : [];
};

export const additionalRelatedFeesValidations = async (ctx, fee) => {
  const additionalRelatedFeeValidations = [];
  const propertyFees = await getFeesByPropertyId(ctx, fee.propertyId);
  const validations = additionalRelatedFeeValidations.concat(
    await updateWithValidFees(ctx, fee, RELATED_FEES_FIELD, propertyFees),
    await updateWithValidFees(ctx, fee, ADDITIONAL_FEES_FIELD, propertyFees),
    validateDuplicatesOnAssociatedFees(fee, propertyFees),
    validateFeeCycle(fee.relatedFeesCycle),
  );

  return validations;
};

const getServicePeriod = fee => {
  if (!fee.servicePeriod) {
    return null;
  }

  const feeType = getValueFromEnum(DALTypes.FeeType, fee.feeType);

  if ([DALTypes.FeeType.PENALTY, DALTypes.FeeType.DEPOSIT, DALTypes.FeeType.LEASE_BREAK].includes(feeType)) {
    return DALTypes.ServicePeriod.ONE_TIME;
  }

  return getValueFromEnum(DALTypes.ServicePeriod, fee.servicePeriod);
};

const getExternalsFieldValue = fee => ({
  externalChargeCode: fee.externalChargeCode || null,
  externalChargeAccount: fee.externalChargeAccount || null,
  externalChargeAccrualAccount: fee.externalChargeAccrualAccount || null,
  externalChargeNotes: fee.externalChargeNotes || null,
  externalChargeRef: fee.externalChargeRef || null,
  externalReceiptAccount: fee.externalReceiptAccount || null,
  externalReceiptAccrualAccount: fee.externalReceiptAccrualAccount || null,
  externalReceiptOffset: fee.externalReceiptOffset || null,
  externalReceiptNotes: fee.externalReceiptNotes || null,
  externalReceiptRef: fee.externalReceiptRef || null,
  externalWaiverAccount: fee.externalWaiverAccount || null,
  externalWaiverAccrualAccount: fee.externalWaiverAccrualAccount || null,
  externalWaiverOffset: fee.externalWaiverOffset || null,
  externalWaiverNotes: fee.externalWaiverNotes || null,
  externalWaiverRef: fee.externalWaiverRef || null,
});

const buildAssociatedFee = (fee, associatedFeeId, isAdditionalFee = false) => {
  const feeObj = {
    primaryFee: fee.id,
    associatedFee: associatedFeeId,
    isAdditional: isAdditionalFee,
  };
  return feeObj;
};

const getFeeNamesByIds = async (ctx, feeIds) =>
  (
    await getRowsMatchingConditions({
      schema: ctx.tenantId,
      conditions: { id: feeIds },
      table: 'Fee',
      columns: ['name'],
    })
  ).map(fee => fee.name);

const doesAssociatedFeeAlreadyExists = (fees, primaryFeeId, associatedFeeId) =>
  fees.some(x => x.associatedFee === associatedFeeId && x.primaryFee === primaryFeeId);

export const buildAssociatedFeeObject = (ctx, fee) => {
  let fees = [];
  if (fee.validRelatedFees) {
    const relatedFees = fee.validRelatedFees.reduce((acc, associatedFeeId) => {
      if (doesAssociatedFeeAlreadyExists(acc, fee.id, associatedFeeId)) return acc;
      acc.push(buildAssociatedFee(fee, associatedFeeId, false));
      return acc;
    }, []);

    fees = fees.concat(relatedFees);
  }
  if (fee.validAdditionalFees) {
    const additionalFees = fee.validAdditionalFees.reduce((acc, associatedFeeId) => {
      if (doesAssociatedFeeAlreadyExists(acc, fee.id, associatedFeeId)) return acc;
      acc.push(buildAssociatedFee(fee, associatedFeeId, true));
      return acc;
    }, []);

    fees = fees.concat(additionalFees);
  }

  return fees;
};

const areParentFeesEqualToPrimaryFees = (primaryFess, parentFees) => {
  const primaryFessLength = primaryFess.length;
  if (primaryFessLength === 0 || primaryFessLength !== parentFees.length) return false;
  return primaryFess.every(feeId => parentFees.includes(feeId));
};

export const getAssociatedFeesCycle = async (ctx, fee, associatedFees) => {
  const fees = await getValidFeesByNameAndPropertyId(ctx, trimAndSplitByComma(associatedFees), fee.propertyId);

  const feeIds = new Set(fees.map(element => element.id));

  let parentFees = [];
  parentFees.push(fee.id);

  do {
    const primaryFess = (await getParentFeesFromAssociatedFees(ctx, parentFees)).map(x => x.primaryFee);
    const intersection = primaryFess.filter(pfee => feeIds.has(pfee));

    if (intersection.length > 0 || areParentFeesEqualToPrimaryFees(primaryFess, parentFees)) {
      const feesWithCycle = intersection.length ? await getFeeNamesByIds(ctx, intersection) : [fee.name];
      return {
        isThereACycle: true,
        fees: feesWithCycle,
      };
    }
    parentFees = primaryFess;
  } while (parentFees.length > 0);

  return {
    isThereACycle: false,
    fees: null,
  };
};

const buildFeesObjectToSave = async (ctx, validFeesFromSheet) =>
  Promise.all(
    validFeesFromSheet.map(async ({ data: fee }) => {
      const marketingQuestion = await getMarketingQuestionByName(ctx, fee.marketingQuestionName);
      return {
        id: newId(),
        name: fee.name,
        propertyId: fee.propertyId,
        displayName: fee.displayName,
        description: fee.description,
        feeType: getValueFromEnum(DALTypes.FeeType, fee.feeType),
        renewalLetterDisplayFlag: fee.renewalLetterDisplayFlag,
        quoteSectionName: fee.quoteSectionName ? getValueFromEnum(DALTypes.QuoteSection, fee.quoteSectionName) : null,
        maxQuantityInQuote: getValueToPersist(fee.maxQuantityInQuote, 1),
        servicePeriod: getServicePeriod(fee),
        variableAdjustment: fee.variableAdjustmentFlag,
        estimated: fee.estimatedFlag,
        relativePrice: getValueToPersist(fee.relativePrice, null),
        absolutePrice: getValueToPersist(fee.absolutePrice, null),
        relativeDefaultPrice: getValueToPersist(fee.relativeDefaultPrice, null),
        absoluteDefaultPrice: getValueToPersist(fee.absoluteDefaultPrice, null),
        depositInterest: fee.depositInterestFlag,
        quotePaymentScheduleFlag: fee.quotePaymentScheduleFlag,
        leaseState: getValueFromEnum(DALTypes.FeeLeaseState, fee.leaseState),
        priceFloorCeiling: getValueToPersist(fee.priceFloorCeiling, null),
        marketingQuestionId: marketingQuestion?.id,
        ...getExternalsFieldValue(fee),
      };
    }),
  );

const relativePriceFeeDependencyValidation = (fee, fees) => {
  const { name, relativePrice, property } = fee;

  if (relativePrice === '' || doesFeeFromSheetHaveParent(name.trim().toLowerCase(), fees, property)) return [];

  return [
    {
      name: 'relativePrice',
      message: getRelativePriceFeeDependencyErrorMsg(name),
    },
  ];
};

const getValidationErrors = async (ctx, { index, fee }, fees) => {
  const validations = [];

  const invalidFee = await additionalRelatedFeesValidations(ctx, fee);
  if (invalidFee.length) {
    validations.push({
      index,
      invalidFields: invalidFee,
    });
  }

  const relativePriceFeeDependencyerrors = relativePriceFeeDependencyValidation(fee, fees);
  if (relativePriceFeeDependencyerrors.length) {
    validations.push({
      index,
      invalidFields: relativePriceFeeDependencyerrors,
    });
  }

  return validations;
};

const customFeesValidations = async (ctx, validFees) =>
  await Promise.reduce(
    validFees,
    async (acc, { index, data: fee }) => {
      const relatedFees = [...fee.relatedFees, ...fee.additionalFees].filter(x => x);
      if (relatedFees.length) {
        fee.relatedFeesCycle = await getAssociatedFeesCycle(ctx, fee, relatedFees);
      }

      const validations = await getValidationErrors(ctx, { index, fee }, validFees);
      if (validations.length) {
        acc.invalidRelatedFees = acc.invalidRelatedFees.concat(validations);
        return acc;
      }

      if (!fee.relatedFeesCycle?.isThereACycle) {
        acc.relatedFees.push(fee);
      }
      return acc;
    },
    { relatedFees: [], invalidRelatedFees: [] },
  );

export const deleteAndSaveAssociatedFees = async (ctx, relatedFees) =>
  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    const feeIds = relatedFees.map(fee => fee.id);
    await deleteAssociatedFeesByFeeIds(innerCtx, feeIds);

    const associatedFeesToSave = (relatedFees || []).reduce((acc, fee) => acc.concat(buildAssociatedFeeObject(innerCtx, fee)), []);
    await bulkUpsertAssociatedFeesFromImport(innerCtx, associatedFeesToSave);
  });

export const additionalFeeProcess = async (ctx, validFees) => {
  const { relatedFees, invalidRelatedFees } = await customFeesValidations(ctx, validFees);

  await deleteAndSaveAssociatedFees(ctx, relatedFees);

  return invalidRelatedFees;
};

const removeDuplicates = fees => {
  const result = uniqBy(fees.reverse(), fee => [fee.name, fee.propertyId].join());
  return result.length === fees.length ? fees : result.reverse();
};

const saveFees = async (ctx, validFeesFromSheet) => {
  const feesToSave = await buildFeesObjectToSave(ctx, validFeesFromSheet);
  const fees = removeDuplicates(feesToSave);
  const { rows: feesSaved } = await bulkUpsertFeesFromImport(ctx, fees);
  return feesSavedWithAdditionalAndRelatedFees(validFeesFromSheet, feesSaved);
};

export const importFees = async (ctx, fees) => {
  const validFees = [];

  const invalidFees = await validate(
    fees,
    {
      requiredFields: FEE_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(fee, feeIndex) {
        validFees.push({
          data: fee,
          index: feeIndex,
        });
      },
      async customCheck(fee) {
        // We set the standard value of the validated feeType because is used
        // on most of the special valdiations
        fee.feeType = getValueFromEnum(DALTypes.FeeType, fee.feeType);
        return await additionalValidations(ctx, fee);
      },
    },
    ctx,
    spreadsheet.Fee.columns,
  );

  const feesSaved = await saveFees(ctx, validFees);

  return {
    invalidFields: invalidFees,
    validFields: feesSaved,
  };
};
