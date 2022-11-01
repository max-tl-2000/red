/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Typography.scss';

const Link = ({ id, className, uppercase, noDefaultColor, underline, bold, href, children, ...rest }) => (
  <a href={href} id={id} className={cf('link', { noDefaultColor, underline, uppercase, bold }, g(className))} {...rest}>
    <span>{children}</span>
  </a>
);

export default Link;
