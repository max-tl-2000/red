/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const shallowCompare = (nextProps, currentProps, fields = []) => {
  for (let i = 0, len = fields.length; i < len; i++) {
    const key = fields[i];
    if (nextProps[key] !== currentProps[key]) {
      return false;
    }
  }

  return true;
};

export default shallowCompare;
