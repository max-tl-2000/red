/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';

const { SubHeader } = Typography;

export const renderPreparingLease = message => (
  <SubHeader inline bold>
    {message}
  </SubHeader>
);
