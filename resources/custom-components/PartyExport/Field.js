/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import sass from 'node-sass';
import path from 'path';
import { widthInColumns } from '../../../common/helpers/width-in-columns';
import nullish from '../../../common/helpers/nullish';

export default class Field extends Component {
  static styles = [
    sass
      .renderSync({
        file: path.resolve(__dirname, './Field.scss'),
      })
      .css.toString(),
  ];

  render() {
    const { children, vAlign = 'center', columns, gutterWidth, gutterType, totalColumns, last, style, maxWidth, className } = this.props;

    let cellStyle = {};
    if (columns && columns > 0) {
      cellStyle = widthInColumns(columns, { gutterWidth, totalColumns, last, gutterType });
    }
    if (!nullish(maxWidth)) {
      cellStyle.maxWidth = maxWidth;
    }
    return (
      <div data-component="field" style={{ ...style, ...cellStyle }} className={`field v-align-${vAlign} inline ${className}`}>
        <div data-component="field-middle-wrapper" className="middle-wrapper">
          <div data-component="field-wrapper" className="field-wrapper">
            {children}
          </div>
        </div>
      </div>
    );
  }
}
