/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Icon } from 'components';
import { cf } from './NoHistoryResults.scss';

const NoHistoryItem = ({ item }) => (
  <div className={cf('item-row')}>
    {item.icon && (
      <div>
        <Icon name={item.icon} iconStyle="dark" />
      </div>
    )}
    <p>{t(item.name)}</p>
  </div>
);

export default NoHistoryItem;
