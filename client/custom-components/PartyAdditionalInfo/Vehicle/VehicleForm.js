/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';

import { Form, Field, TextBox, Dropdown, AutoSize } from 'components';

import { t } from 'i18next';
import enumToArray from 'enums/enumHelper';
import { VehicleTypes } from '../../../../common/enums/vehicleTypes';
import { formModes } from '../../../../rentapp/common/application-constants';
import StateDropdown from '../../StateDropdown/StateDropdown';

import { breakpointsLimits } from '../../../helpers/layout';

const getTextBox = (field, label, { className, mask = '', type = 'text', required, dataId, onBlur, forceSentenceCase } = {}) => (
  <TextBox
    label={label}
    type={type}
    value={field.value}
    showClear
    id={dataId}
    required={required}
    errorMessage={field.errorMessage}
    onChange={({ value }) => field.setValue(value)}
    className={className}
    mask={mask}
    onBlur={onBlur}
    wide
    forceSentenceCaseOnError={forceSentenceCase}
  />
);
@observer
export default class VehicleForm extends Component {
  static propTypes = {
    item: PropTypes.object,
    mode: PropTypes.oneOf(enumToArray(formModes).map(fm => fm.value)),
  };

  constructor(props) {
    super(props);
    this.vehicleTypes = enumToArray(VehicleTypes).map(tf => ({
      id: tf.value,
      text: t(tf.value),
    }));
  }

  render() {
    const { model, mode } = this.props;
    const { fields } = model;

    const isEdit = mode === 'edit';

    let editStyles;
    if (isEdit) {
      editStyles = { paddingTop: 1 }; // for some reason 0 is cutting the Dropdown label
    }

    return (
      <AutoSize breakpoints={breakpointsLimits}>
        {({ breakpoint }) => {
          const columns = 12;

          return (
            <Form container style={editStyles}>
              <Field inline columns={breakpoint === 'medium' ? 6 : columns}>
                <Dropdown
                  items={this.vehicleTypes}
                  label={t('VEHICLE_TYPE')}
                  placeholder={t('VEHICLE_SELECT')}
                  required
                  selectedValue={fields.type.value}
                  errorMessage={fields.type.errorMessage}
                  onChange={({ id }) => fields.type.setValue(id)}
                  wide
                  id="dropdownVehicleType"
                />
              </Field>

              <Field id="vehicleMakeAndModelText" inline columns={breakpoint === 'medium' ? 6 : columns} last>
                {getTextBox(fields.makeAndModel, t('VEHICLE_MAKE_AND_MODEL'), {
                  required: true,
                })}
              </Field>

              <Field id="vehicleMakeYearText" inline columns={breakpoint === 'medium' ? 6 : columns}>
                {getTextBox(fields.makeYear, t('VEHICLE_MAKE_YEAR'), {
                  forceSentenceCase: false,
                })}
              </Field>

              <Field id="vehicleColorText" inline columns={breakpoint === 'medium' ? 6 : columns} last>
                {getTextBox(fields.color, t('VEHICLE_COLOR'))}
              </Field>

              <Field id="vehicleTagNumberText" inline columns={breakpoint === 'medium' ? 6 : columns}>
                {getTextBox(fields.tagNumber, t('VEHICLE_TAG_NUMBER'), {
                  required: true,
                  onBlur: () => model.tagNumberToUpperCase(),
                })}
              </Field>

              <Field inline columns={breakpoint === 'medium' ? 6 : columns} last>
                <StateDropdown
                  label={t('STATE')}
                  placeholder={t('PLEASE_SELECT')}
                  required
                  errorMessage={fields.state.errorMessage}
                  selectedValue={fields.state.value}
                  onChange={({ id }) => fields.state.setValue(id)}
                  id="dropdownVehicleState"
                />
              </Field>
            </Form>
          );
        }}
      </AutoSize>
    );
  }
}
