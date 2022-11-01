/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { t } from 'i18next';
import { Typography as T } from 'components';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { observer } from 'mobx-react';
import isUndefined from 'lodash/isUndefined';

const { Text } = T;

export const InsuranceChoiceSummary = observer(({ insuranceChoice }) => (
  <div>
    {isUndefined(insuranceChoice.defaultInsuranceSelected) && <EmptyMessage message={t('RENTER_INSURANCE_NOT_SELECTED')} />}
    {!isUndefined(insuranceChoice.defaultInsuranceSelected) && insuranceChoice.defaultInsuranceSelected && (
      <Text>{t('RENTERS_INSURANCE_TAKE_OWNER_INSURANCE')}</Text>
    )}
    {!isUndefined(insuranceChoice.defaultInsuranceSelected) && !insuranceChoice.defaultInsuranceSelected && (
      <Text>{t('RENTER_INSURANCE_FROM_OTHER_COMPANY')}</Text>
    )}
  </div>
));

InsuranceChoiceSummary.propTypes = {
  insuranceChoice: PropTypes.object,
};
