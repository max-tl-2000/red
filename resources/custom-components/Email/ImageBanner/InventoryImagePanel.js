/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import * as T from '../Typography/Typography';
import { Box } from '../../../../common/react-html-email-wrapper';

const InventoryImagePanel = ({ inventoryImagePanelObject, height }) => (
  <td width="406" height={height} style={{ width: 406, height, padding: 0, margin: 0 }}>
    <Box>
      <tr>
        <td
          valign="top"
          width="406"
          height={height}
          background={inventoryImagePanelObject.imgUrl}
          style={{
            width: 406,
            height,
            margin: 0,
            padding: height === 192 ? 16 : 0,
            background: `url(${inventoryImagePanelObject.imgUrl}) 100% 100%`,
            verticalAlign: 'top',
          }}>
          <Box width="100%">
            <tr>
              <td width="57" style={{ width: 57 }} />
              {(inventoryImagePanelObject.topText && inventoryImagePanelObject.bottomText && (
                <td
                  width="317"
                  height="64"
                  valign="top"
                  style={{ width: 317, height: 64, borderRadius: '2px', padding: '10px 0 0 16px', verticalAlign: 'top', backgroundColor: '#ffffff' }}>
                  <T.Text style={{ fontSize: '15px', lineHeight: '24px' }}>{inventoryImagePanelObject.topText}</T.Text>
                  <T.Text style={{ fontSize: '13px', lineHeight: '20px' }}>{inventoryImagePanelObject.bottomText}</T.Text>
                </td>
              )) || <td />}
            </tr>
          </Box>
        </td>
      </tr>
    </Box>
  </td>
);

export default InventoryImagePanel;
