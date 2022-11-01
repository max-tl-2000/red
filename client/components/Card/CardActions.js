/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Card.scss';

const justifyHash = {
  left: 'flex-start',
  right: 'flex-end',
  center: 'center',
};

const CardActions = ({ className, children, textAlign = 'left', style = {}, position, ...rest }) => {
  const divStyle = {
    ...style,
  };

  const justifyContent = justifyHash[textAlign];

  if (justifyContent) {
    divStyle.justifyContent = justifyContent;
    if (position) {
      divStyle.position = position;
    }
  }

  return (
    <div data-component="card-actions" className={cf('actions', g(className))} style={divStyle} {...rest}>
      {children}
    </div>
  );
};

export default CardActions;
