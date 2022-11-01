/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { t } from 'i18next';
import IncomeSourceCard from './income-source-card';
import { cf } from './income-source-summary.scss';

export const IncomeSourceSummary = observer(({ incomeSources }) => {
  if (!incomeSources || incomeSources.length === 0) {
    return <EmptyMessage message={t('NO_INCOME_SOURCES')} />;
  }
  return (
    <div className={cf('income-source-summary')}>
      {incomeSources.map(incomeSource => (
        <IncomeSourceCard key={incomeSource.id} item={incomeSource} className={cf('income-source-card')} />
      ))}
    </div>
  );
});

IncomeSourceSummary.propTypes = {
  incomeSources: PropTypes.array,
};
