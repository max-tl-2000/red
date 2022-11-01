/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { Typography as T, Field, ModelTextBox, CheckBox } from 'components';
import { t } from 'i18next';
import { zipCode } from 'components/TextBox/masks';
import StateDropdown from 'custom-components/StateDropdown/StateDropdown';
import { toSentenceCase } from 'helpers/capitalize';
import AutoSize from '../../../../client/components/AutoSize/AutoSize';
import { breakpointsLimits } from '../../../../client/helpers/layout';
import AddressAutocomplete from '../address-autocomplete/address-autocomplete';
import { localCountry } from '../../../common/application-constants';
import snackbar from '../../../../client/helpers/snackbar/snackbar';

export const AddressDetails = observer(({ model, labels }) => {
  const { fields } = model;
  const { entityAddress, checkInternationalAddress, address, addressLine1, addressLine2, city, state, zip } = labels;

  const handleOnSelectAddress = addressSelected => model.autocompleteAddress(addressSelected);

  const handleOnSelectInternationalAddress = addressSelected => {
    if (addressSelected.country === localCountry) {
      snackbar.show({ text: t('LOCAL_ADDRESS_SELECTED_FROM_INTERNATIONAL_INPUT') });
      handleOnSelectAddress(addressSelected);
      return;
    }

    model.autocompleteAddress(addressSelected, false);
  };

  const internationalAddress = (
    <Field columns={12}>
      <AddressAutocomplete field={fields.addressLine} label={t(address)} onSelectAddress={handleOnSelectInternationalAddress} dataId="addressLine" />
    </Field>
  );

  const domesticAddress = (
    <AutoSize breakpoints={breakpointsLimits}>
      {({ breakpoint }) => (
        <div>
          <Field columns={12}>
            <AddressAutocomplete
              field={fields.addressLine1}
              label={t(addressLine1)}
              onSelectAddress={handleOnSelectAddress}
              countryRestriction={localCountry}
              dataId="addressLine1"
            />
          </Field>

          <Field columns={12}>
            <ModelTextBox dataId="addressLine2" field={fields.addressLine2} label={t(addressLine2)} />
          </Field>

          <Field inline columns={breakpoint === 'medium' ? 4 : 12}>
            <ModelTextBox dataId="city" field={fields.city} label={t(city)} />
          </Field>

          <Field inline columns={breakpoint === 'medium' ? 4 : 12}>
            <StateDropdown
              id="state"
              label={t(state)}
              placeholder={t('PLEASE_SELECT')}
              required={fields.state.required}
              errorMessage={fields.state.errorMessage}
              selectedValue={fields.state.value}
              onChange={({ id }) => fields.state.setValue(id)}
            />
          </Field>

          <Field inline columns={breakpoint === 'medium' ? 4 : 12} last>
            <ModelTextBox dataId="zipCode" mask={zipCode} field={fields.zip} label={t(zip)} />
          </Field>
        </div>
      )}
    </AutoSize>
  );

  const addressDetails = (
    <div>
      <Field inline noMargin columns={3}>
        <T.SubHeader bold>{toSentenceCase(t(entityAddress))}</T.SubHeader>
      </Field>
      <Field inline noMargin columns={9} last>
        <CheckBox
          label={t(checkInternationalAddress)}
          checked={fields.hasInternationalAddress.value}
          onChange={value => model.setInternationalCheckBox(value)}
        />
      </Field>
      {fields.hasInternationalAddress.value ? internationalAddress : domesticAddress}
    </div>
  );
  return addressDetails;
});

AddressDetails.propTypes = {
  model: PropTypes.object,
  labels: PropTypes.object,
};
