/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Card from '../Card/Card';
import { Box } from '../../../../common/react-html-email-wrapper';
import * as T from '../Typography/Typography';

const FullImageBanner = ({ imageUrl, firstText, secondText }) => (
  <Card style={{ textAlign: 'left', overflow: 'hidden', maxWidth: '680px', padding: 0, borderLeft: 0, borderTop: 0 }}>
    <Box style={{ width: '100%', height: 192 }}>
      <td
        valign="top"
        width="999"
        height="170"
        background={imageUrl}
        style={{ width: '100%', height: 170, margin: 0, padding: 0, background: `url(${imageUrl})`, verticalAlign: 'top' }}>
        <Box width="100%">
          <tr>
            <td width="317" height="64" valign="top" style={{ width: 317, height: 64, borderRadius: '2px', padding: '10px 0 0 32px', verticalAlign: 'top' }}>
              <T.Text style={{ fontSize: '15px', lineHeight: '24px', color: 'white' }}>{firstText}</T.Text>
              <T.Text style={{ fontSize: '13px', lineHeight: '20px', color: 'white' }}>{secondText}</T.Text>
            </td>
          </tr>
        </Box>
      </td>
    </Box>
  </Card>
);

export default FullImageBanner;
