/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Text from 'components/Typography/Text';
import { cf, g } from './PreloaderBlock.scss';
import Preloader from '../Preloader/Preloader';

export default ({ id, className, topAligned, size, style, modal, message }) => (
  <div
    id={id}
    className={cf(
      'preloader-block',
      {
        normalHeight: size !== 'tiny',
        tinyHeight: size === 'tiny',
      },
      { modal, topAligned },
      g(className),
    )}
    style={style}>
    {message && <Text className={cf('message')}>{message}</Text>}
    <Preloader size={size} />
  </div>
);
