/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validate, Validation } from './util.js';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { DALTypes } from '../../../common/enums/DALTypes';
import { saveScreeningCriteria } from '../../dal/screeningCriteriaRepo';

const SCREENING_CRITERIA_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'monthlyResidentIncomeDebtMultiple',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'monthlyGuarantorIncomeDebtMultiple',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'monthlyResidentIncomeMultiple',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'monthlyGuarantorIncomeMultiple',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'excessiveIssuesCount',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'hasGroupResidentIncomes',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'hasGroupGuarantorIncomes',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'hasGroupResidentCreditScores',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'hasGroupGuarantorCreditScores',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'fullLeaseLiquidAssetMultiple',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'approvedResidentCreditScore',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'declinedResidentCreditScore',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'approvedGuarantorCreditScore',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'declinedGuarantorCreditScore',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'defaultResidentCreditScore',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'defaultGuarantorCreditScore',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'drugsFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'drugsMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'duiFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'duiMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'unclassifiedFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'unclassifiedMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'propertyFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'propertyMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'sexFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'sexMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'theftFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'theftMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'theftByCheckFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'theftByCheckMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'trafficFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'trafficMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'violentCrimeFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'violentCrimeMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'weaponsFelony',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'weaponsMisdemeanor',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'registeredSexOffender',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'globalSanctions',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CriminalValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsInsufficientIncome',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsCreditScoreApproved',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditScoreApproved,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsCreditScoreDeclined',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditScoreDeclined,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsCreditScoreBetween',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsNoEstablishedCredit',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsBankruptcy',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsForeclosure',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsLegalItem',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsTaxLien',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsPropertyDebt',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsMortgageDebt',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsUtilityDebt',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsEvictionOrEvictionFiling',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsExcessiveIssues',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'applicantsSsnSuspicious',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.SsnValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsInsufficientIncome',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsCreditScoreApproved',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditScoreApproved,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsCreditScoreDeclined',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditScoreDeclined,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsCreditScoreBetween',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsNoEstablishedCredit',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsBankruptcy',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsForeclosure',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsLegalItem',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsTaxLien',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsPropertyDebt',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsMortgageDebt',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsUtilityDebt',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsEvictionOrEvictionFiling',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsExcessiveIssues',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.CreditValues,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'guarantorsSsnSuspicious',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    validValues: DALTypes.Screening.SsnValues,
    maxLength: DBColumnLength.Name,
  },
];

const saveScreeningCriteriaData = async (ctx, screeningCriteria) =>
  await saveScreeningCriteria(ctx, {
    ...screeningCriteria,
    hasGroupResidentIncomes: screeningCriteria.hasGroupResidentIncomes,
    hasGroupGuarantorIncomes: screeningCriteria.hasGroupGuarantorIncomes,
    hasGroupResidentCreditScores: screeningCriteria.hasGroupResidentCreditScores,
    hasGroupGuarantorCreditScores: screeningCriteria.hasGroupGuarantorCreditScores,
  });

export const importScreeningCriterias = async (ctx, screeningCriterias) => {
  const invalidFields = await validate(
    screeningCriterias,
    {
      requiredFields: SCREENING_CRITERIA_REQUIRED_FIELDS,
      async onValidEntity(screeningCriteria) {
        await saveScreeningCriteriaData(ctx, screeningCriteria);
      },
    },
    ctx,
    spreadsheet.ScreeningCriteria.columns,
  );

  return {
    invalidFields,
  };
};
