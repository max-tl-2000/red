/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { Typography as T } from 'components';
import { cf } from './application-details-summary.scss';
import { Address } from '../../components/address/address';
import { EmailList } from '../../components/email-list/email-list';
import { maskSSNWithX } from '../../../../common/helpers/utils.js';
import { getFormattedIncome } from '../../helpers/utils';
import { USD } from '../../../../common/currency';
const { Caption } = T;

export const ApplicationDetailsSummary = observer(({ model, isOnPaymentStep, isPartyLevelGuarantor, partyLevelGuarantor, residentNumber }) => {
  const {
    fields: { firstName, lastName, dateOfBirth, email, socSecNumber, addressLine1, addressLine2, city, state, zip, grossIncome, grossIncomeFrequency },
  } = model;

  let income;
  if (grossIncome.value && grossIncomeFrequency.value) {
    income = getFormattedIncome({
      income: grossIncome.value,
      frequency: grossIncomeFrequency.value,
      currency: USD.code,
    });
  }

  return (
    <div className={cf('applicantDetailsBlock')}>
      <div className={cf('simple-row', 'firstColumnBlock')}>
        <Caption secondary bold>
          {t('APPLICANT_DETAILS_APPLICANT')}
        </Caption>
      </div>
      <div className={cf('simple-row', 'firstColumnBlock')}>
        <Caption inline bold data-id={`${residentNumber}_fullName`}>
          {firstName.value} {lastName.value}
        </Caption>
        <Caption inline className={cf('secondColumnBlock')}>
          , {email.value}
        </Caption>
      </div>
      {(dateOfBirth.value || socSecNumber.value) && (
        <div className={cf('simple-row', 'firstColumnBlock')}>
          {dateOfBirth.value && (
            <Caption secondary bold className={cf('secondColumnBlock')}>
              {t('APPLICANT_DETAILS_DATE_OF_BIRTH')}
            </Caption>
          )}
          {socSecNumber.value && (
            <Caption secondary bold className={cf('secondColumnBlock')}>
              {t('APPLICANT_DETAILS_SOCIAL_SECURITY_TAX_ID_NUMBER')}
            </Caption>
          )}
        </div>
      )}
      {(dateOfBirth.value || socSecNumber.value) && (
        <div className={cf('simple-row', 'firstColumnBlock')}>
          {dateOfBirth.value && (
            <Caption inline bold className={cf('secondColumnBlock')} data-id={`${residentNumber}_dateOfBirth`}>
              {dateOfBirth.value}
            </Caption>
          )}
          {socSecNumber.value && (
            <Caption inline bold className={cf('secondColumnBlock')}>
              {maskSSNWithX(socSecNumber.value)}
            </Caption>
          )}
        </div>
      )}
      {income && (
        <div className={cf('simple-row', 'firstColumnBlock')}>
          <Caption secondary bold>
            {t('GROSS_INCOME')}
          </Caption>
        </div>
      )}
      {income && (
        <div className={cf('simple-row', 'firstColumnBlock')}>
          <Caption inline bold data-id={`${residentNumber}_income`}>
            {income}
          </Caption>
        </div>
      )}
      {model.hasAddress && (
        <Address
          label={t('APPLICANT_DETAILS_ADDRESS')}
          addressLine1={addressLine1.value}
          addressLine2={addressLine2.value}
          city={city.value}
          state={state.value}
          zip={zip.value}
          dataId={`${residentNumber}_address`}
        />
      )}
      {model.emails && (
        <EmailList
          label={t('APPLICANT_DETAILS_OTHER_TO_BE_INVITED')}
          emails={model.emails}
          guarantorEmails={model.guarantorEmails}
          isOnPaymentStep={isOnPaymentStep}
          isPartyLevelGuarantor={isPartyLevelGuarantor}
          partyLevelGuarantor={partyLevelGuarantor}
        />
      )}
    </div>
  );
});

ApplicationDetailsSummary.propTypes = {
  model: PropTypes.object,
};
