/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { formatAddress } from 'helpers/inventory';
import { cf } from './InventoryPage.scss';

const { Text } = Typography;

export const AddressSection = ({ inventory }) => (
  <div>
    <div id="address-info">
      <Text> {`${inventory.property.displayName}, ${inventory.building.displayName}`} </Text>
      <Text secondary> {formatAddress(inventory)} </Text>
    </div>
    <div className={cf('sub-block')}>
      <Text secondary className={cf('first-paragraph')}>
        {' '}
        {inventory.property.description}{' '}
      </Text>
      <Text secondary> {inventory.building.description} </Text>
    </div>
  </div>
);
