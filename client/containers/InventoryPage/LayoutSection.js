/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { formatFloorLayout } from 'helpers/inventory';
import { cf } from './InventoryPage.scss';

const { Text, SubHeader } = Typography;

export const LayoutSection = ({ inventory }) => (
  <div className={cf('section-block')}>
    <div id="layout-info" className={cf('sub-block')}>
      <SubHeader>{formatFloorLayout(inventory)}</SubHeader>
    </div>
    <div>
      <Text secondary id="layout-description" className={cf('first-paragraph', 'sub-block')}>
        {`${inventory.layout.description}. ${inventory.inventorygroup.description}`}
      </Text>
      <Text secondary id="inventory-description">
        {' '}
        {inventory.description}{' '}
      </Text>
    </div>
  </div>
);
