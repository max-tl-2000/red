/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import sass from 'node-sass';
import path from 'path';
@observer
export default class Summary extends Component {
  static propTypes = {
    items: PropTypes.array,
    ChildComponent: PropTypes.object,
  };

  static styles = [sass.renderSync({ file: path.resolve(__dirname, './Summary.scss') }).css.toString()];

  render() {
    const { items, ChildComponent } = this.props;

    return (
      <div className="summary">
        <div className="items">
          {items.map(item => (
            <ChildComponent item={item} key={item.id} />
          ))}
        </div>
      </div>
    );
  }
}
