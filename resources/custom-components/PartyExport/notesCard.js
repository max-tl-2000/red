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
import createElement from './create-element';
import { formatMoment } from '../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';
import { DALTypes } from '../../../common/enums/DALTypes';

const Text = createElement('text');

const getDecisionText = approvalConditionItem => {
  if (approvalConditionItem.status === DALTypes.PromotionStatus.CANCELED) {
    return `${t('RESULT_APPROVER_REVIEW')}: ${t('DECLINED')}`;
  }

  if (
    approvalConditionItem.status === DALTypes.PromotionStatus.APPROVED &&
    approvalConditionItem.additionalDeposit &&
    approvalConditionItem.additionalDepositDecision === DALTypes.APPROVAL_CONDITIONS.OTHER
  ) {
    return `${t('RESULT_APPROVER_REVIEW')}: ${t('APPROVED_WITH_XX_DEPOSIT', { amount: approvalConditionItem.additionalDepositAmount })}`;
  }

  if (approvalConditionItem.status === DALTypes.PromotionStatus.APPROVED && approvalConditionItem.sureDeposit && approvalConditionItem.npsRentAssurance) {
    return `${t('RESULT_APPROVER_REVIEW')}: ${t('APPROVED_WITH_SURE_DEPOSIT_AND_NPS')}`;
  }

  if (approvalConditionItem.status === DALTypes.PromotionStatus.APPROVED && approvalConditionItem.sureDeposit) {
    return `${t('RESULT_APPROVER_REVIEW')}: ${t('APPROVED_WITH_SURE_DEPOSIT')}`;
  }

  if (approvalConditionItem.status === DALTypes.PromotionStatus.APPROVED && approvalConditionItem.npsRentAssurance) {
    return `${t('RESULT_APPROVER_REVIEW')}: ${t('APPROVED_WITH_NPS')}`;
  }

  if (approvalConditionItem.status === DALTypes.PromotionStatus.APPROVED && approvalConditionItem.additionalDeposit) {
    return `${t('RESULT_APPROVER_REVIEW')}: ${t('APPROVED_WITH')} ${approvalConditionItem.additionalDepositDecision}`;
  }

  if (approvalConditionItem.status === DALTypes.PromotionStatus.APPROVED && !approvalConditionItem.additionalDeposit) {
    return `${t('RESULT_APPROVER_REVIEW')}: ${t('APPROVED')}`;
  }

  return '';
};

export const notesCard = observer(({ item, className }) => {
  if (!item.id) {
    return (
      <div className={`card ${className}`}>
        <Text style={{ fontSize: 7 }}>{`${t('EMPTY_APPROVAL_NOTES')}`}</Text>
      </div>
    );
  }
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <Text style={{ fontSize: 7, fontWeight: 'bold' }}>{getDecisionText(item)} </Text>
      <Text style={{ fontSize: 7 }}>{item.approvalNotes || item.declinedNotes}</Text>
      <Text style={{ fontSize: 7, display: 'inline-block' }}>
        {`${t('CREATED_BY')}: ${item.user} ${t('ON')}: ${formatMoment(item.created_at, {
          format: MONTH_DATE_YEAR_FORMAT,
          timezone: item.propertyTimeZone,
        })}`}
      </Text>
    </div>
  );
});

notesCard.propTypes = {
  item: PropTypes.object,
};
