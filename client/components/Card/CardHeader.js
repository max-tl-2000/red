/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Card.scss';
import CardTitle from './CardTitle';
import CardSubTitle from './CardSubTitle';

const CardHeader = ({ className, children, title, subTitle, ...rest }) => {
  title = title && <CardTitle>{title}</CardTitle>;
  subTitle = subTitle && <CardSubTitle>{subTitle}</CardSubTitle>;

  return (
    <div className={cf('header', g(className))} {...rest}>
      {title}
      {subTitle}
      {children}
    </div>
  );
};

export default CardHeader;
