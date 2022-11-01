/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './table.scss';
import Title from '../Typography/Title';

const TableHeader = ({ className, title, children, ...props }) => {
  const theTitle = typeof title === 'string' ? <Title>{title}</Title> : title;

  return (
    <div className={cf('header', g(className))} {...props}>
      <div className={cf('header-inner')}>
        {theTitle}
        {children}
      </div>
    </div>
  );
};

export default TableHeader;
