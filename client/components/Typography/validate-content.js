/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isValidElement } from 'react';

export const isValidChildrenProp = children => {
  const childrenType = typeof children;

  if (childrenType === 'undefined' || children === null || childrenType === 'string') {
    return true;
  }

  if (Array.isArray(children)) {
    return children.every(isValidChildrenProp);
  }

  if (childrenType === 'object') {
    return isValidElement(children);
  }

  return true;
};
