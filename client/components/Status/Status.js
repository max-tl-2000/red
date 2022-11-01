/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { VelocityComponent } from 'helpers/velocity';
import { cf } from './ProcessingStatus.scss';
import nullish from '../../../common/helpers/nullish';

const Status = ({ processing, className, height }) => {
  const animProps = {
    animation: {
      opacity: processing ? 1 : 0,
    },
    runOnMount: true,
    easing: [250, 25],
    duration: 1000,
  };

  const style = {};
  if (!nullish(height)) {
    style.height = height;
  }

  return (
    <VelocityComponent {...animProps}>
      <div data-component="status" className={className} style={style}>
        <div className={cf('progress', 'progress-bar')}>
          <div className={cf('indeterminate')} />
        </div>
      </div>
    </VelocityComponent>
  );
};

export default Status;
