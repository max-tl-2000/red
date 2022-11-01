/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Card, Typography as T } from 'components';
import { connect } from 'react-redux';
import injectProps from '../../helpers/injectProps';
import { cf } from './InventoryCard.scss';

import { formatUnitCardInfo, getInventoryLeaseSelector } from '../../helpers/unitsUtils';

import { _highlightMatches } from '../../helpers/highlightMatches';
import { getSmallLayoutImage } from '../../../common/helpers/cloudinary';
import { inventoryStateRepresentation, shouldDisplayInventoryState } from '../../../common/inventory-helper';

@connect((state, props) => ({
  leases: getInventoryLeaseSelector(state, props),
}))
export default class InventoryCard extends Component {
  static propTypes = {
    inventory: PropTypes.object,
    query: PropTypes.object,
  };

  renderBG = imgUrl => {
    imgUrl = getSmallLayoutImage(imgUrl);

    const divStyle = {
      backgroundImage: `url(${imgUrl})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    };

    return <div style={divStyle} className={cf('inventoryCardImageBg')} />;
  };

  getUnitNameWithLayout = (highlightedUnitName, inventory) => {
    if (highlightedUnitName) {
      return (
        <div>
          {highlightedUnitName}
          <T.Caption inline>{' ● '}</T.Caption>
          <T.Caption inline>{inventory.layoutDisplayName}</T.Caption>
        </div>
      );
    }

    return <div />;
  };

  @injectProps
  render({ inventory, leases, query }) {
    if (!inventory) return null;
    const unitInfo = formatUnitCardInfo(inventory);
    const highlightedUnitFullName = _highlightMatches(inventory.fullQualifiedName, query && query.name, { Component: T.SubHeader, inline: true, bold: true });
    const shouldDisplayState = shouldDisplayInventoryState(inventory);
    const inventoryState = shouldDisplayState && inventoryStateRepresentation(inventory, leases);

    return (
      <Card container={false} className={cf('card')}>
        <div className={cf('cardDetails')}>
          <T.SubHeader inline>{`${unitInfo.unitDetails} ● `}</T.SubHeader>
          {highlightedUnitFullName || <T.SubHeader bold>{inventory.fullQualifiedName}</T.SubHeader>}
          {shouldDisplayState && <T.Caption secondary>{inventoryState}</T.Caption>}
          <T.Caption>{`${unitInfo.area} ● ${inventory.layoutDisplayName}`}</T.Caption>
        </div>
        <div className={cf('image')}>{this.renderBG(inventory.imageUrl)}</div>
      </Card>
    );
  }
}
