/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Box } from '../../../../common/react-html-email-wrapper';
import RightPanel from './RightPanel';
import LeftPanel from './LeftPanel';

const SolidBanner = ({ leftContent, rightContent }) => (
  <Box width="auto" style={{ width: 'auto' }}>
    <tr>
      <td bgColor="#455a64" style={{ backgroundColor: '#455a64', padding: 0 }}>
        {leftContent && <LeftPanel leftContent={leftContent} />}
        {rightContent && <RightPanel rightContent={rightContent} />}
      </td>
    </tr>
  </Box>
);

export default SolidBanner;
