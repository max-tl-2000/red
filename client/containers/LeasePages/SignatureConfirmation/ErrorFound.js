/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import ErrorBlock from '../../../../rentapp/client/custom-components/error-block/error-block';
import { LeasePage } from '../LeasePage';

const ErrorFound = ({ error }) => (
  <LeasePage>
    <ErrorBlock error={error} />
  </LeasePage>
);

export default ErrorFound;
