/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isDemoDomain } from 'helpers/utils';

const DemoElement = ({ children }) => {
  if (isDemoDomain()) {
    return children;
  }
  return null;
};

export default DemoElement;
