/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import nullish from 'helpers/nullish';
import SelectionGroup from './SelectionGroup';
import AutoSize from '../AutoSize/AutoSize';

const TileSelectionGroup = ({ baseWidth, numColsPreferred, gutter, ...props }) => (
  <AutoSize breakpoints={false}>
    {({ width }) => {
      let totalColumns = numColsPreferred;
      if (nullish(width) || width === 0) {
        if (nullish(numColsPreferred)) {
          return <div />;
        }
      } else {
        totalColumns = Math.floor(width / baseWidth);
      }

      return <SelectionGroup itemGutter={gutter} columns={totalColumns} {...props} />;
    }}
  </AutoSize>
);

export default TileSelectionGroup;
