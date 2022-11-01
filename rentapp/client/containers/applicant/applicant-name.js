/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography as T } from 'components';

export const ApplicantName = ({ applicantName, symbol = '' }) =>
  applicantName && <T.Headline inline id="applicantNameTitle">{` ${applicantName.firstName}${symbol}`}</T.Headline>;
