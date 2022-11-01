/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Text } from 'components/Typography/Typography';
import Icon from 'components/Icon/Icon';
import { t } from 'i18next';
import { cf, g } from './VehicleCard.scss';

@observer
export default class VehicleCard extends Component {
  static propTypes = {
    item: PropTypes.object,
    onItemSelected: PropTypes.func,
  };

  handleOnTouchTapItem = event => {
    const { onItemSelected, item } = this.props;
    onItemSelected && onItemSelected(event, item);
  };

  render() {
    const { item, className } = this.props;

    const descriptionLines = [];

    const addDescriptionLine = ({ text, isHeader = false, isSecondary = false, dataId }) => descriptionLines.push({ isHeader, isSecondary, text, dataId });

    const renderDescriptionLine = ({ key, text, isHeader, isSecondary, dataId }) => (
      <Text data-id={dataId} key={key} bold={isHeader} secondary={isSecondary}>
        {text}
      </Text>
    );

    const { type, makeAndModel, tagNumber, state } = item;
    const renderDetail = () => {
      const color = item.color || '';
      const colorTypeDescription = `${color} ${type}`;
      const vehicleDescription = item.makeYear ? `${colorTypeDescription}, ${item.makeYear}` : `${colorTypeDescription}`;

      if (makeAndModel) {
        addDescriptionLine({ text: makeAndModel, isHeader: true, dataId: 'makeAndModelLabelText' });
      }

      if (item.makeYear || item.color) {
        addDescriptionLine({ text: vehicleDescription, isSecondary: true });
      }

      if (state && tagNumber) {
        addDescriptionLine({
          text: `${state}: ${tagNumber}`,
          isSecondary: true,
        });
      }

      return descriptionLines.map((descriptionLine, index) => renderDescriptionLine({ ...descriptionLine, key: index }));
    };

    return (
      <div className={cf('vehicle-card', g(className))} onClick={this.handleOnTouchTapItem}>
        <div>{renderDetail()}</div>
        {!(makeAndModel && type && tagNumber && state) && (
          <div className={cf('alert')}>
            <Icon name="alert" className={cf('alert-icon')} />
            <Text secondary>{t('INCOMPLETE_VEHICLE_INFO')}</Text>
          </div>
        )}
      </div>
    );
  }
}
