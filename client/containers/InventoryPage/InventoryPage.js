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
import { loadInventoryDetails } from 'redux/modules/inventoryStore';
import { saveNavigationHistory } from 'redux/modules/locationTracking';

import AppBarBack from 'custom-components/AppBar/AppBarBack';
import { AppBarMainSection, Typography, PreloaderBlock } from 'components';
import capitalize from 'lodash/capitalize';
import { cf, g } from './InventoryPage.scss';
import injectProps from '../../helpers/injectProps';
import { PricingSection } from './PricingSection';
import { LayoutSection } from './LayoutSection';
import { ComplimentarySection } from './ComplimentarySection';
import { AddressSection } from './AddressSection';
import { AmenitiesSection } from './AmenitiesSection';
import { LifestyleSection } from './LifestyleSection';
import { inventoryStateRepresentation, shouldDisplayInventoryState } from '../../../common/inventory-helper';
import { getBigLayoutImage } from '../../../common/helpers/cloudinary';
import { getInventoryLeaseSelector } from '../../helpers/unitsUtils';
import { DALTypes } from '../../../common/enums/DALTypes';

const { Title, Caption } = Typography;

@connect(
  (state, props) => ({
    inventory: state.inventoryStore.inventory,
    leases: getInventoryLeaseSelector(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        loadInventoryDetails,
        saveNavigationHistory,
      },
      dispatch,
    ),
)
export default class InventoryPaqe extends Component {
  static defaultProps = {
    displayUnitDescription: true,
  };

  static propTypes = {
    params: PropTypes.object,
    inventory: PropTypes.object,
    displayUnitDescription: PropTypes.bool,
    saveNavigationHistory: PropTypes.func,
  };

  componentWillMount() {
    const query = {
      id: this.props.params.inventoryId,
    };
    this.props.loadInventoryDetails(query);
  }

  componentDidMount() {
    this.props.saveNavigationHistory({
      entityId: this.props.params.inventoryId,
      entityType: DALTypes.NavigationHistoryType.UNIT,
    });
  }

  @injectProps
  render({ inventory, leases }) {
    if (!inventory) {
      return <PreloaderBlock />;
    }
    const shouldDisplayState = shouldDisplayInventoryState(inventory);
    const state = shouldDisplayState && inventoryStateRepresentation(inventory, leases);

    return (
      <div id="inventoryPage">
        <AppBarBack secondary>
          <AppBarMainSection>
            <Title lighter>{`${capitalize(inventory.type)} ${inventory.name}`}</Title>
          </AppBarMainSection>
        </AppBarBack>
        <div className={cf('container')}>
          <div className={cf('content', g('padded-scrollable'))}>
            <div className={cf('image-container')}>
              <img height={200} src={getBigLayoutImage(inventory.imageUrl)} />
              {shouldDisplayState && (
                <span className={cf('status')}>
                  <Caption inline lighter>
                    {state}
                  </Caption>
                </span>
              )}
            </div>
            <PricingSection inventory={inventory} />
            <LayoutSection inventory={inventory} />
            {inventory.complimentaryItems.length > 0 && <ComplimentarySection complimentaryItems={inventory.complimentaryItems} />}
            <AddressSection inventory={inventory} />
            <AmenitiesSection inventory={inventory} />
            <LifestyleSection inventory={inventory} />
          </div>
        </div>
      </div>
    );
  }
}
