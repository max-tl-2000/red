/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './address-autocomplete.scss';
import { observer } from 'mobx-react';
import { TextBox } from 'components';
import { placesPromise } from 'client/init-places-api';
import generateId from 'helpers/generateId';
import debounce from 'debouncy';
import cfg from 'helpers/cfg';
import { document, window } from '../../../../common/helpers/globals';
import { infereStreetNumber } from '../../helpers/place-helpers';

const isCI = cfg('isCI');

const addressHash = {
  street_number: ['short_name', 'streetNumber'], // eslint-disable-line camelcase
  locality: ['long_name', 'city'],
  neighborhood: ['long_name', 'neighborhood'],
  administrative_area_level_1: ['short_name', 'state'], // eslint-disable-line camelcase
  postal_code: ['short_name', 'zip'], // eslint-disable-line camelcase
  route: ['long_name', 'addressLine1'],
  country: ['short_name', 'country'],
};

@observer
export default class AddressAutocomplete extends Component {
  constructor(props) {
    super(props);
    this.id = props.id || generateId(this);
  }

  static propTypes = {
    label: PropTypes.string,
    field: PropTypes.object,
    onSelectAddress: PropTypes.func,
    countryRestriction: PropTypes.string,
    dataId: PropTypes.string,
  };

  async componentDidMount() {
    if (isCI) return;
    await placesPromise;
    this.initGooglePlaceLibrary();
  }

  componentWillUnmount() {
    this.autocomplete = null;
  }

  initGooglePlaceLibrary = () => {
    if (!window.google && !window.google.maps.places) {
      console.error('Google Maps Places library must be loaded.');
      return;
    }

    const options = {
      types: ['address'],
    };
    const { countryRestriction: country } = this.props;
    country && Object.assign(options, { componentRestrictions: { country } });
    // eslint-disable-next-line no-undef
    this.autocomplete = new google.maps.places.Autocomplete(document.getElementById(this.id), options);

    this.autocomplete.addListener('place_changed', this.checkIfPlaceChanged);
  };

  checkIfPlaceChanged = debounce(() => {
    const { props, autocomplete } = this;
    if (!autocomplete) return;
    const { field, onSelectAddress } = props;
    // google autocomplete keeps the previously selected place so we
    // only attempt to get the place if there is any value in the textField
    // to prevent selecting the previously selected place
    if (!field.value) return;

    const place = autocomplete.getPlace();
    if (!place) return;

    const addr = this.parseAddress(place);
    if (!addr) return;

    onSelectAddress && onSelectAddress(addr);

    if (place) {
      autocomplete.set('place', undefined);
    }
  }, 300);

  parseAddress = place => {
    const { formatted_address: formattedAddress, address_components: addressComponents = [] } = place;
    if (!addressComponents.length) return undefined;

    const addrObj = Object.entries(addressHash).reduce(
      (acc, [key, addressTuple]) => {
        const addressComponent = addressComponents.find(ac => ac.types.some(type => type === key));
        if (!addressComponent) return acc;
        const [source, target] = addressTuple;
        acc[target] = addressComponent[source];
        return acc;
      },
      { formattedAddress },
    );

    if (!addrObj.streetNumber) {
      const {
        props: { field },
      } = this;
      addrObj.streetNumber = infereStreetNumber(field.value);
    }

    return addrObj;
  };

  validatePlace = field => {
    this.checkIfPlaceChanged();
    field.waitForBlur && field.markBlurredAndValidate();
  };

  render = ({ label, field, placeholder = '', onSelectAddress, countryRestriction, dataId, ...rest } = this.props) => (
    <TextBox
      id={this.id}
      label={label}
      dataId={dataId}
      placeholder={placeholder}
      type="text"
      value={field.value}
      showClear
      required={rest.required || field.required}
      errorMessage={field.errorMessage}
      forceSentenceCaseOnError={false}
      onChange={({ value }) => field.setValue(value)}
      onBlur={() => this.validatePlace(field)}
      wide
      {...rest}
    />
  );
}
