/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import nullish from 'helpers/nullish';
import { cf } from './table.scss';

const justifyHash = {
  left: 'flex-start',
  right: 'flex-end',
  center: 'center',
};

const alignHash = {
  top: 'flex-start',
  bottom: 'flex-end',
  center: 'center',
};

const styleCreator = (baseStyle = {}) => {
  const style = { ...baseStyle };

  return {
    setProp(name, value) {
      if (!nullish(value)) {
        if (name === 'textAlign') {
          style.justifyContent = justifyHash[value];
          style.textAlign = value;
          return;
        }
        if (name === 'verticalAlign') {
          style.alignSelf = alignHash[value];
          return;
        }

        style[name] = value;
      }
    },
    get style() {
      return style;
    },
  };
};

const Cell = ({
  children,
  width,
  innerWrapperWidth,
  padding,
  style,
  middleWrapperStyle,
  type,
  textAlign,
  noSidePadding,
  verticalAlign,
  className,
  smallPadding,
  noPaddingLeft,
  dataId,
  ...props
}) => {
  const cellStyle = styleCreator(style);
  if (nullish(width)) {
    cellStyle.setProp('flex', 1);
    cellStyle.setProp('overflow', 'hidden');
  } else {
    cellStyle.setProp('width', width);
  }

  const divStyle = styleCreator(middleWrapperStyle);
  divStyle.setProp('textAlign', textAlign);
  divStyle.setProp('padding', padding);
  cellStyle.setProp('verticalAlign', verticalAlign);

  const innerCellStyle = styleCreator();
  innerCellStyle.setProp('width', innerWrapperWidth);

  return (
    <div data-id={dataId} data-component="cell" style={cellStyle.style} className={className} {...props}>
      <div
        className={cf('cell', {
          'no-padding': type === 'ctrlCell',
          'no-side-padding': noSidePadding,
          noPaddingLeft,
          smallPadding,
        })}
        style={divStyle.style}>
        <div style={innerCellStyle.style} className={cf('cell-inner')}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Cell;
