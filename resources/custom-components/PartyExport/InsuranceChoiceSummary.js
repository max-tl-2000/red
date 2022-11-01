/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import isUndefined from 'lodash/isUndefined';
import createElement from './create-element';

const Text = createElement('text');

export const InsuranceChoiceSummary = observer(({ insuranceChoice }) => (
  <div style={{ marginBottom: 16 }}>
    {isUndefined(insuranceChoice.defaultInsuranceSelected) && <Text style={{ fontSize: 7 }}>{t('RENTER_INSURANCE_NOT_SELECTED')}</Text>}
    {!isUndefined(insuranceChoice.defaultInsuranceSelected) && insuranceChoice.defaultInsuranceSelected && (
      <Text style={{ fontSize: 7 }} inline>
        {t('RENTERS_INSURANCE_TAKE_OWNER_INSURANCE')}
      </Text>
    )}
    {!isUndefined(insuranceChoice.defaultInsuranceSelected) && !insuranceChoice.defaultInsuranceSelected && (
      <Text style={{ fontSize: 7, marginTop: 10 }}>{t('RENTER_INSURANCE_FROM_OTHER_COMPANY')}</Text>
    )}
  </div>
));

InsuranceChoiceSummary.propTypes = {
  insuranceChoice: PropTypes.object,
};
