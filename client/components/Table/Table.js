/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Children, cloneElement } from 'react';
import { cf, g } from './table.scss';
import RowHeader from './RowHeader';
import RowFooter from './RowFooter';
import Row from './Row';

const Table = ({ children, className, wide, type, dataId, ...rest }) => {
  const cells = [];

  const Rows = Children.map(children, childRow => {
    // allow to properly render the TableHeader
    if (!childRow || !childRow.type) {
      return childRow;
    }

    if (childRow.type !== Row && childRow.type !== RowHeader && childRow.type !== RowFooter) {
      return childRow;
    }

    // allow the table to honor the width/alignment of the cells
    // in the row header like a real table does
    let counter = 0;
    const newChildren = Children.map(childRow.props.children, cellChild => {
      let returnChild;
      if (cellChild) {
        const storedProps = cells[counter];

        if (storedProps) {
          returnChild = cloneElement(cellChild, {
            ...storedProps,
            ...cellChild.props,
          });
        } else {
          returnChild = cellChild;
          cells[counter] = {
            width: cellChild.props.width,
            textAlign: cellChild.props.textAlign,
          };
        }

        counter++;
      }
      return returnChild;
    });

    return cloneElement(
      childRow,
      {
        ...childRow.props,
      },
      newChildren,
    );
  });

  return (
    <div data-component="table" data-id={dataId} className={cf('table', { 'read-only': type === 'readOnly', wide }, g(className))} {...rest}>
      {Rows}
    </div>
  );
};

export default Table;
