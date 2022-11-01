/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Box } from '../../../../common/react-html-email-wrapper';

const Container = ({ children, padding = 16, width = '100%', style, tdProps, boxProps }) => (
  <Box style={{ width }} {...boxProps}>
    <tr>
      <td style={{ padding, ...style }} {...tdProps}>
        {children}
      </td>
    </tr>
  </Box>
);

export default Container;
