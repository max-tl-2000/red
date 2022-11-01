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
import { ChildrenCard } from './ChildrenCard';
import { cf } from './ChildrenSummary.scss';

export const ChildrenSummary = observer(({ children }) => {
  if (!children || children.length === 0) {
    return <EmptyMessage message={t('NO_MINORS_ADDED')} />;
  }
  return (
    <div className={cf('children-summary')}>
      {children.map(child => (
        <div key={child.id}>
          <ChildrenCard item={child} className={cf('children-card')} />
        </div>
      ))}
    </div>
  );
});

ChildrenSummary.propTypes = {
  children: PropTypes.array,
};
