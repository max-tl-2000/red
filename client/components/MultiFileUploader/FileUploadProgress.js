/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { cf } from './FileUploadProgress.scss';

export const FileUploadProgress = observer(({ percentLoaded, children }) => {
  if (percentLoaded > 100) {
    percentLoaded = 100;
  }

  const style = {
    width: `${percentLoaded}%`,
    transition: 'width 200ms',
  };

  return (
    <div className={cf('file-progress')}>
      <div className={cf('progress')} style={style}>
        {children}
      </div>
    </div>
  );
});

FileUploadProgress.propTypes = {
  percentLoaded: PropTypes.number.isRequired,
};
