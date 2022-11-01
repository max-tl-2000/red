/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { Typography as T } from 'components';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { t } from 'i18next';
import { cf } from './disclosure-summary.scss';

export const DisclosureSummary = observer(({ disclosures }) => {
  if (!disclosures || disclosures.length === 0) {
    return <EmptyMessage message={t('NO_DISCLOUSURES')} />;
  }
  const renderDisclosure = (disclosure, index) => (
    <div key={disclosure.id} className={cf('disclosure-summary')}>
      <T.Text id={`disclosureSummaryTitle${index}`}>{disclosure.displayName}</T.Text>
      {disclosure.description && (
        <T.Caption secondary className={cf('description')} id={`disclosureSummaryTxt${index}`}>
          {disclosure.description}
        </T.Caption>
      )}
    </div>
  );

  return <div>{disclosures.map((disclosure, index) => renderDisclosure(disclosure, index))}</div>;
});

DisclosureSummary.propTypes = {
  disclosures: PropTypes.array,
};
