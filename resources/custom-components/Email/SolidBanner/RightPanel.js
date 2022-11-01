/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Box } from '../../../../common/react-html-email-wrapper';

const RightPanel = ({ rightContent }) => (
  <Box width="339" height="112" style={{ width: 339, height: 112 }}>
    <tr>
      <td width="1" style={{ width: 1 }}>
        <div style={{ width: 1, height: 80, opacity: 0.35, backgroundColor: '#ffffff' }} />
      </td>
      <td style={{ padding: 0 }}>{rightContent && rightContent}</td>
    </tr>
  </Box>
);

export default RightPanel;
