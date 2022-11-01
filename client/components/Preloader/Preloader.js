/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf } from './Preloader.scss';

export default ({ size = 'normal' }) => (
  <div
    className={cf('preloader-wrapper active', {
      big: size === 'big',
      small: size === 'small',
      tiny: size === 'tiny',
    })}>
    <div className={cf('spinner-layer')}>
      <div className={cf('circle-clipper left')}>
        <div className={cf('circle')} />
      </div>
      <div className={cf('gap-patch')}>
        <div className={cf('circle')} />
      </div>
      <div className={cf('circle-clipper right')}>
        <div className={cf('circle')} />
      </div>
    </div>
  </div>
);
