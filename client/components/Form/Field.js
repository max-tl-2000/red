/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { widthInColumns } from 'helpers/width-in-columns';
import nullish from 'helpers/nullish';
import { cf, g } from './Field.scss';

const Field = ({
  children,
  vAlign = 'center',
  columns,
  noMargin,
  gutterWidth,
  gutterType,
  totalColumns,
  last,
  style,
  inline,
  hoverable,
  fullWidth,
  halfWidth,
  flex,
  className,
  wrapperClassName,
  maxWidth,
  sensitiveData = false,
  ...props
}) => {
  let cellStyle = {};
  if (columns && columns > 0) {
    cellStyle = widthInColumns(columns, {
      gutterWidth,
      totalColumns,
      last,
      gutterType,
    });
  }
  if (!nullish(maxWidth)) {
    cellStyle.maxWidth = maxWidth;
  }
  // fullstory class marker to mask data
  const fsMaskClass = sensitiveData ? ' fs-mask' : '';

  return (
    <div
      data-component="field"
      style={{ ...style, ...cellStyle }}
      className={
        cf(
          'field',
          {
            [`v-align-${vAlign}`]: true,
            noMargin,
            hoverable,
            inline,
            fullWidth,
            halfWidth,
            flex,
          },
          g(className),
        ) + fsMaskClass
      }
      {...props}>
      <div data-component="field-middle-wrapper" className={cf('middle-wrapper')}>
        <div data-component="field-wrapper" className={cf('field-wrapper', g(wrapperClassName))}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Field;
