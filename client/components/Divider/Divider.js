/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf } from './Divider.scss';
import Text from '../Typography/Text';

const Divider = ({ label, left, dataId = '' }) => (
  <div className={cf('container')}>
    {!left && <div className={cf('lineLeft')} />}
    <Text secondary inline data-id={dataId}>
      {label}
    </Text>
    <div className={cf('lineRight')} />
  </div>
);

export default Divider;
