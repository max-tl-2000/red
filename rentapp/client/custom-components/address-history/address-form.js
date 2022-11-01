/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Form, Field, PhoneTextBox, Dropdown } from 'components';
import ModelTextBox, { ModelMoneyTextBox } from 'components/Form/ModelTextBox';
import { t } from 'i18next';
import enumToArray from 'enums/enumHelper';
import { dateMask } from 'components/TextBox/masks';
import { RentappTypes } from '../../../common/enums/rentapp-types';
import { AddressDetails } from '../address-details/address-details';
import AutoSize from '../../../../client/components/AutoSize/AutoSize';
import { breakpointsLimits } from '../../../../client/helpers/layout';
import { DATE_US_FORMAT } from '../../../../common/date-constants';

@observer
export default class AddressForm extends Component {
  static propTypes = {
    item: PropTypes.object,
    validateOnChange: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.propertyTypes = enumToArray(RentappTypes.PropertyType).map(tf => ({
      id: tf.value,
      text: t(tf.value),
    }));
  }

  getAddressOwnershipField = (fields, breakpoint) => {
    if (fields.ownOrRent.value === RentappTypes.PropertyType.RENT) {
      return (
        <div>
          <Field inline columns={breakpoint === 'medium' ? 6 : 12}>
            <ModelTextBox dataId="ownerName" field={fields.ownerName} label={t('OWNER_NAME')} />
          </Field>

          <Field inline columns={breakpoint === 'medium' ? 6 : 12} last>
            <PhoneTextBox
              label={t('OWNER_PHONE')}
              value={fields.ownerPhone.value}
              showClear
              errorMessage={fields.ownerPhone.errorMessage}
              onChange={({ value }) => fields.ownerPhone.setValue(value)}
              wide
            />
          </Field>
        </div>
      );
    }
    return <div />;
  };

  onChangeOwnOrRent = (id, fields) => {
    const { validateOnChange } = this.props;
    fields.ownOrRent.setValue(id);
    validateOnChange();
  };

  render() {
    const self = this;
    const { model } = this.props;
    const { fields } = model;
    const labels = {
      entityAddress: 'ADDRESS',
      checkInternationalAddress: 'IS_INTERNATIONAL_ADDRESS',
      address: 'ENTER_ADDRESS',
      addressLine1: 'ADDRESS_LINE_1',
      addressLine2: 'ADDRESS_LINE_2',
      city: 'CITY',
      state: 'STATE',
      zip: 'ZIP',
    };

    return (
      <AutoSize breakpoints={breakpointsLimits}>
        {({ breakpoint }) => (
          <Form container>
            <Field columns={breakpoint === 'medium' ? 6 : 12}>
              <Dropdown
                id={'rentOrOwnDropdown'}
                items={this.propertyTypes}
                wide
                required
                label={t('RENT_OR_OWN')}
                selectedValue={fields.ownOrRent.value}
                errorMessage={fields.ownOrRent.errorMessage}
                onChange={({ id }) => this.onChangeOwnOrRent(id, fields)}
              />
            </Field>

            {self.getAddressOwnershipField(fields, breakpoint)}

            <AddressDetails model={model} labels={labels} />

            <Field inline columns={breakpoint === 'medium' ? 6 : 12}>
              <ModelTextBox field={fields.moveInDate} label={t('MOVE_IN_DATE')} forceSentenceCaseOnError={false} mask={dateMask} placeholder={DATE_US_FORMAT} />
            </Field>

            <Field inline columns={breakpoint === 'medium' ? 6 : 12} last>
              <ModelMoneyTextBox field={fields.monthlyPayment} label={t('MONTHLY_PAYMENT')} />
            </Field>
          </Form>
        )}
      </AutoSize>
    );
  }
}
