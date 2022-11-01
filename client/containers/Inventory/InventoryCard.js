/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as amenityActions from 'redux/modules/amenityStore';
import { updateParty } from 'redux/modules/partyStore';
import InventoryDetails from './InventoryDetails';

import InventoryActions from './InventoryActions';
import InventoryCardAmenities from './InventoryCardAmenities';
import Card from '../../components/Card/Card';
import IconButton from '../../components/IconButton/IconButton';
import { cf, g } from './InventoryCard.scss';
import SubHeader from '../../components/Typography/SubHeader';
import { DALTypes } from '../../../common/enums/DALTypes';
import { renderFullQualifiedNameForMobileCard } from './InventoryHelper';
import { getLargeLayoutImage, getSmallLayoutImage } from '../../../common/helpers/cloudinary';
import { getAmenitiesForProperties } from '../../helpers/unitsUtils';

@connect(
  state => ({
    inventoryAmenities: state.amenityStore.inventoryAmenities,
    filters: state.unitsFilter.filters,
  }),
  dispatch =>
    bindActionCreators(
      {
        ...amenityActions,
        updateParty,
      },
      dispatch,
    ),
)
export default class InventoryCard extends Component {
  static propTypes = {
    inventory: PropTypes.object,
    inventoryAmenities: PropTypes.object,
    partyId: PropTypes.string,
    loadInventoryAmenities: PropTypes.func,
    updateParty: PropTypes.func,
    layout: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = { isFavorite: props.isFavorite };
  }

  componentWillReceiveProps(nextProps) {
    // in case the optimism didn't work out
    if (nextProps.isFavorite !== this.state.isFavorite) {
      this.setState({ isFavorite: nextProps.isFavorite });
    }
  }

  handleExpanderClick = () => {
    const { inventory, properties, filters } = this.props;
    const expanded = !this.state.expanded;

    const selectedProperties = properties.filter(p => (filters.propertyIds || []).includes(p.id));

    const amenitiesForSelectedProperties = getAmenitiesForProperties(selectedProperties);

    const selectedHighValueAmenities = amenitiesForSelectedProperties.filter(e => (filters.amenities.ids || []).includes(e.id) && e.highValue).map(e => e.text);
    const selectedOtherAmenities = amenitiesForSelectedProperties.filter(e => (filters.amenities.ids || []).includes(e.id) && !e.highValue).map(e => e.text);

    this.setState({
      expanded,
      selectedHighValueAmenities,
      selectedOtherAmenities,
    });
    expanded && this.props.loadInventoryAmenities(inventory);
  };

  handleQuoteClick = ({ isRenewalQuote }) => {
    const { inventory, partyId, onQuoteClick } = this.props;

    onQuoteClick && onQuoteClick({ inventory, partyId, isRenewalQuote });
  };

  handleToggleFavoriteClick = () => {
    const { isFavorite } = this.state;

    // let's be optimists...
    this.setState({ isFavorite: !isFavorite });

    // allow rendering before server update to avoid flickering
    setTimeout(() => this.props.onMarkAsFavoriteClick(this.props.inventory.id), 300);
  };

  renderBG = ({ imageUrl, inventory, size = 'large' }) => {
    const getImageFn = size === 'large' ? getLargeLayoutImage : getSmallLayoutImage;
    imageUrl = getImageFn(imageUrl);
    const divStyle = {
      backgroundImage: `url(${imageUrl})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    };

    return (
      <div style={divStyle} className={cf('inventory-card-image-bg')} data-id={imageUrl}>
        {inventory && <div data-mask="true" />}
        {inventory && (
          <SubHeader className={cf('unit-name-in-bg')} lighter>
            {renderFullQualifiedNameForMobileCard(inventory.fullQualifiedName)}
          </SubHeader>
        )}
      </div>
    );
  };

  render({ inventory, className, inventoryAmenities, partyId, layout, timezone } = this.props) {
    const { expanded, isFavorite, selectedHighValueAmenities, selectedOtherAmenities } = this.state;
    const imageUrl = inventory.state !== DALTypes.InventoryState.MODEL ? inventory.imageUrl : '';
    const useImage = inventory.state !== DALTypes.InventoryState.MODEL; // temporary until we have real images, we asssume for now we always use images

    if (layout === 'small') {
      return (
        <Card container={false} className={cf('card small', { expanded }, g(className))} data-id="inventoryCard">
          <div className={cf('content')}>
            {useImage && this.renderBG({ imageUrl, inventory, size: 'small' })}
            <div className={cf('details')}>
              <InventoryDetails small unitNameOnTop={!useImage} inventory={inventory} />
            </div>
            <div className={cf('icon-buttons')}>
              <IconButton
                iconStyle={'dark'}
                className={cf('favorite')}
                iconName={isFavorite ? 'heart' : 'heart-outline'}
                onClick={this.handleToggleFavoriteClick}
              />
              <IconButton iconStyle={'dark'} className={cf('toggle')} iconName={!expanded ? 'chevron-down' : 'chevron-up'} onClick={this.handleExpanderClick} />
            </div>
            <InventoryActions timezone={timezone} small onQuoteClick={this.handleQuoteClick} unit={inventory} partyId={partyId} />
          </div>
          {expanded && inventoryAmenities && inventoryAmenities[inventory.id] && (
            <InventoryCardAmenities
              inventoryAmenities={inventoryAmenities[inventory.id]}
              selectedHighValueAmenities={selectedHighValueAmenities}
              selectedOtherAmenities={selectedOtherAmenities}
            />
          )}
        </Card>
      );
    }
    return (
      <Card container={false} className={cf('card', { expanded }, g(className))} data-id="inventoryCard">
        <div className={cf('content')}>
          <div className={cf('details', { useImage })}>
            <InventoryDetails inventory={inventory} />
          </div>
          {useImage && this.renderBG({ imageUrl, size: 'large' })}
          <InventoryActions timezone={timezone} onQuoteClick={this.handleQuoteClick} unit={inventory} partyId={partyId} />
          <IconButton
            iconStyle={useImage ? 'light' : 'dark'}
            className={cf('favorite')}
            iconName={isFavorite ? 'heart' : 'heart-outline'}
            onClick={this.handleToggleFavoriteClick}
          />
          <IconButton
            iconStyle={useImage ? 'light' : 'dark'}
            className={cf('toggle')}
            iconName={!expanded ? 'chevron-down' : 'chevron-up'}
            onClick={this.handleExpanderClick}
          />
        </div>
        {expanded && inventoryAmenities && inventoryAmenities[inventory.id] && (
          <InventoryCardAmenities
            inventoryAmenities={inventoryAmenities[inventory.id]}
            selectedHighValueAmenities={selectedHighValueAmenities}
            selectedOtherAmenities={selectedOtherAmenities}
          />
        )}
      </Card>
    );
  }
}
