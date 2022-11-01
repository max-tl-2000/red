/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './table.scss';

export const createRow = rowType => ({
  indentLevel,
  clickable,
  noPaddingOnSides,
  indentSize = 40,
  noDivider,
  fullWidthDivider,
  noHover,
  style,
  children,
  selected,
  className,
  dataId,
  ...rest
}) => {
  const theStyle = style || {};

  if (indentLevel) {
    theStyle.paddingLeft = indentLevel * indentSize;
  }

  if (clickable) {
    theStyle.cursor = 'pointer';
  }

  if (noPaddingOnSides) {
    theStyle.paddingLeft = 0;
    theStyle.paddingRight = 0;
  }

  return (
    <div
      style={theStyle}
      data-id={dataId}
      data-component={rowType}
      className={cf(
        rowType,
        {
          selected,
          'no-divider': noDivider,
          indented: !!indentLevel,
          'no-hover': noHover,
          fullWidthDivider,
        },
        g(className),
      )}
      {...rest}>
      {children}
    </div>
  );
};
