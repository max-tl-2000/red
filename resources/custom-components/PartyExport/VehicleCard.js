/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import createElement from './create-element';
const Text = createElement('text');

@observer
export default class VehicleCard extends Component {
  static propTypes = {
    item: PropTypes.object,
  };

  render() {
    const { item, className } = this.props;

    const descriptionLines = [];

    const addDescriptionLine = ({ text, isHeader = false, isSecondary = false }) => descriptionLines.push({ isHeader, isSecondary, text });

    const renderDescriptionLine = ({ key, text, isHeader, isSecondary }) => (
      <Text key={key} bold={isHeader} secondary={isSecondary} style={{ fontSize: 7 }}>
        {text}
      </Text>
    );

    const renderDetail = () => {
      const colorTypeDescription = `${item.color} ${item.type}`;
      const vehicleDescription = item.makeYear ? `${colorTypeDescription}, ${item.makeYear}` : `${colorTypeDescription}`;

      if (item.makeAndModel) addDescriptionLine({ text: item.makeAndModel, isHeader: true });

      if (item.makeYear || item.color) addDescriptionLine({ text: vehicleDescription, isSecondary: true });

      if (item.state && item.tagNumber) addDescriptionLine({ text: `${item.state}: ${item.tagNumber}`, isSecondary: true });

      return descriptionLines.map((descriptionLine, index) => renderDescriptionLine({ ...descriptionLine, key: index }));
    };

    return (
      <div className={`card ${className}`}>
        <div>{renderDetail()}</div>
      </div>
    );
  }
}
