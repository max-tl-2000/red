/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Typography.scss';

const FormmatedBlock = ({ id, className, children, ...rest }) => (
  <section id={id} className={cf('formattedBlock', g(className))} {...rest}>
    {children}
  </section>
);

export default FormmatedBlock;
