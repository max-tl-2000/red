/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { getStyleFor } from './Styles';

const Link = ({ id, className, href, children, style, ...rest }) => (
  <a rel="noreferrer noopener" target="_blank" href={href} style={getStyleFor('link', style)} id={id} className={className} {...rest}>
    <span>{children}</span>
  </a>
);

export default Link;
