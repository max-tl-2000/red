/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './GlobalSearch.scss';

export default class OptionTemplate extends React.Component {
  getMainText(item) {
    switch (item.key) {
      case 'contacts':
        return item.fullName;
      case 'units':
        return item.name;
      default:
        return '';
    }
  }

  getSecondaryText(/* item */) {
    return '';
  }

  render() {
    const { data, isSelected } = this.props;

    if (data.isGroupHeader) {
      const headerClass = cf('optionHeader', g('collection-item'));
      return (
        <div className={headerClass}>
          <span className="title">{data.name}</span>
        </div>
      );
    }

    const inlineStyle = {
      background: isSelected ? 'rgba(0, 0, 0, 0.05)' : null,
    };

    return (
      <div className={'collection-item'} style={inlineStyle}>
        <div className="title">{this.getMainText(data)}</div>
      </div>
    );
  }
}
