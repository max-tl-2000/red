/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import CollectionPanel from 'custom-components/CollectionPanel/CollectionPanel';
import AddressForm from './address-form';
import AddressCard from './address-card';
import { createAddressFormModel } from '../../models/address-form-model';

@observer
export default class AddressHistoryCollection extends Component {
  static propTypes = {
    viewModel: PropTypes.object,
    initialAddress: PropTypes.object,
    validateOnChange: PropTypes.func,
  };

  setRef = (prop, instance) => {
    this[prop] = instance;
  };

  render = ({ viewModel, initialAddress, validateOnChange } = this.props) => {
    const setInitialDataOnlyIfNoItemsInViewModel = (addressHistory = {}, data = {}) => {
      if (viewModel.items.length === 0) {
        addressHistory.hasInternationalAddress = data.hasInternationalAddress || false;
        addressHistory.addressLine = data.addressLine || '';
        addressHistory.addressLine1 = data.line1 || data.addressLine1 || '';
        addressHistory.addressLine2 = data.line2 || data.addressLine2 || '';
        addressHistory.city = data.city || '';
        addressHistory.state = data.state || '';
        addressHistory.zip = data.postalCode || data.zip || '';
      }
      return addressHistory;
    };

    const initialDataToModel = data => {
      const addressHistory = {
        ownOrRent: '',
        ownerName: '',
        ownerPhone: '',
        moveInDate: '',
        monthlyPayment: '',
      };

      return setInitialDataOnlyIfNoItemsInViewModel(addressHistory, data);
    };

    const formattedInitialAddress = initialDataToModel(initialAddress);

    return (
      <CollectionPanel
        ref={node => this.setRef('collectionPanel', node)}
        entityLabel={'ADDRESS'}
        FormComponent={AddressForm}
        EntityComponent={AddressCard}
        contextMenuDefaults
        emptyMessageStyle={{ padding: '1rem 1.5rem' }}
        collectionViewModel={viewModel}
        createFormModel={createAddressFormModel}
        initialData={formattedInitialAddress}
        validateOnChange={validateOnChange}
      />
    );
  };
}
