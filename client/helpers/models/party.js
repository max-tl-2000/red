/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { DALTypes } from '../../../common/enums/DALTypes';
import { bedroomsArray2DataSource } from '../unitsUtils';

import { periodText } from '../quoteTextHelpers';
import { isCorporateGroupProfile } from '../../../common/helpers/party-utils';

const getLeaseLengthSummary = ({ leaseLength = {} }) =>
  Object.entries(leaseLength)
    .reduce((acc, [period, selectedTermLengths]) => {
      const lengths = selectedTermLengths.map(item => +item).sort((a, b) => (a > b ? 1 : -1));
      acc.push(`${lengths.join(', ')} ${periodText({ period, termLength: lengths.length })}`);
      return acc;
    }, [])
    .join(', ');

export const setQualificationQuestionsAsSummary = qualificationQuestions => {
  const summary = [];
  const numBedroomsOptions = bedroomsArray2DataSource(DALTypes.QualificationQuestions.BedroomOptions);

  qualificationQuestions.numBedrooms &&
    !!Array.isArray(qualificationQuestions.numBedrooms) &&
    summary.push({
      id: 'numberBedroomsTxt',
      label: t('NUMBER_OF_BEDROOMS_QUESTION'),
      value: qualificationQuestions.numBedrooms
        .sort()
        .map(idx => numBedroomsOptions.find(item => item.id === idx).text)
        .join(', '),
    });

  qualificationQuestions.groupProfile &&
    summary.push({
      id: 'leaseTypeTxt',
      label: t('IDENTIFY_LEASE_TYPE'),
      value: t(qualificationQuestions.groupProfile),
    });

  isCorporateGroupProfile(qualificationQuestions) &&
    qualificationQuestions.numberOfUnits &&
    summary.push({
      id: 'numberOfUnitsTxt',
      label: t('NUMBER_OF_UNITS'),
      value: t(qualificationQuestions.numberOfUnits),
    });

  qualificationQuestions.cashAvailable &&
    summary.push({
      id: 'monthlyIncomeTxt',
      label: t('MONTHLY_INCOME_QUESTION'),
      value: t(qualificationQuestions.cashAvailable),
    });

  qualificationQuestions.moveInTime &&
    summary.push({
      id: 'moveInDatePreferenceTxt',
      label: t('WHEN_DO_YOU_EXPECT_TO_RENT'),
      value: t(qualificationQuestions.moveInTime),
    });

  isCorporateGroupProfile(qualificationQuestions) &&
    qualificationQuestions.leaseLength &&
    summary.push({
      id: 'lengthLeaseTxt',
      label: t('LENGTH_OF_LEASE'),
      value: getLeaseLengthSummary(qualificationQuestions),
    });

  return summary;
};

// TODO: this should be better handled by the qualificationsModel and not from here
// to get the advantage of the computed values
export const areRequiredFieldsFilled = ({ numBedrooms, cashAvailable, moveInTime, numberOfUnits, groupProfile }, isRenewalParty) => {
  const areCommonQuestionsAnswered = numBedrooms && numBedrooms.length && moveInTime && groupProfile;

  if (isRenewalParty) {
    if (isCorporateGroupProfile({ groupProfile })) return !!numberOfUnits;
    return !!groupProfile;
  }

  if (isCorporateGroupProfile({ groupProfile })) return areCommonQuestionsAnswered && numberOfUnits;
  return areCommonQuestionsAnswered && cashAvailable;
};
