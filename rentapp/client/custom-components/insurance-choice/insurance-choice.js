/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { Radio, Typography as T } from 'components';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import isUndefined from 'lodash/isUndefined';
import { cf } from './insurance-choice.scss';

export const InsuranceChoice = observer(({ insuranceChoice }) => (
  <div className={cf('insurance-choices')}>
    <T.Text>{t('RENTER_INSURANCE_OPTIONS_TITLE')}</T.Text>
    <Radio
      checked={!isUndefined(insuranceChoice.defaultInsuranceSelected) && insuranceChoice.defaultInsuranceSelected}
      id="erenterPlan"
      label={t('RENTERS_INSURANCE_TAKE_OWNER_INSURANCE')}
      onChange={() => insuranceChoice.setInsuranceChoice(true)}
    />
    <Radio
      checked={!isUndefined(insuranceChoice.defaultInsuranceSelected) && !insuranceChoice.defaultInsuranceSelected}
      id="renterAnotherCompany"
      label={t('RENTER_INSURANCE_FROM_OTHER_COMPANY')}
      onChange={() => insuranceChoice.setInsuranceChoice(false)}
    />
  </div>
));

InsuranceChoice.propTypes = {
  insuranceChoice: PropTypes.object,
};
