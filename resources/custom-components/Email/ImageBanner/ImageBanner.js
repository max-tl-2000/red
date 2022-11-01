/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Box } from '../../../../common/react-html-email-wrapper';
import InventoryImagePanel from './InventoryImagePanel';
import DatePanel from './DatePanel';
import LocationPanel from './LocationPanel';

const ImageBanner = ({ datePanelData, inventoryImagePanelData, locationPanelData, tallBanner }) => {
  const height = tallBanner ? 192 : 160;
  return (
    <Box style={{ width: 680, height }}>
      {locationPanelData && <LocationPanel url={locationPanelData.url} imgUrl={locationPanelData.imgUrl} />}
      {(datePanelData || inventoryImagePanelData) && (
        <tr>
          <DatePanel height={height} startDate={datePanelData.startDate} dateBackgroundColor={datePanelData.dateBackgroundColor} />
          <InventoryImagePanel height={height} inventoryImagePanelObject={inventoryImagePanelData} />
        </tr>
      )}
    </Box>
  );
};

export default ImageBanner;
