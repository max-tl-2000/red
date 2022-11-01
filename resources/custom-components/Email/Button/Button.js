/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { getStyleFor } from './Styles.js';
import { Box } from '../../../../common/react-html-email-wrapper';

const Button = ({ label, className, href, style, align, width = 120, ...rest }) => (
  <Box align={align} style={getStyleFor('buttonWrapper', { width, ...style })}>
    <tr>
      <td style={getStyleFor('buttonWrapperTd')}>
        <a rel="noreferrer noopener" target="_blank" href={href} style={getStyleFor('button')} className={className} {...rest}>
          <span style={{ color: '#fff' }}>{label}</span>
        </a>
      </td>
    </tr>
  </Box>
);

export default Button;
