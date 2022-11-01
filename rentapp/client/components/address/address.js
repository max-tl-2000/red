/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { cf } from '../component-base.scss';
const { Caption } = Typography;

export const Address = ({ addressLine1, addressLine2, city, state, zip, label, dataId }) => {
  const address = [];
  addressLine1 && address.push(addressLine1);
  addressLine2 && address.push(addressLine2);
  city && address.push(city);
  state && address.push(state);
  zip && address.push(zip);

  return (
    <div className={cf('block-row')}>
      <div className={cf('column-block')}>
        <Caption secondary bold>
          {label}
        </Caption>
      </div>
      <div className={cf('column-block')}>
        <Caption inline bold data-id={dataId}>
          {address.join(', ')}
        </Caption>
      </div>
    </div>
  );
};
