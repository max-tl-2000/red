/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';

import { PetTypes, PetSizes, PetSex } from 'enums/petTypes';
import enumToArray from 'enums/enumHelper';

import { Form, CheckBox, Field, AutoSize } from 'components';
import { getTextBox, getDropdown } from '../../../helpers/field-helpers';
import { breakpointsLimits } from '../../../helpers/layout';

@observer
export class PetForm extends Component {
  static propTypes = {
    item: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.types = enumToArray(PetTypes).map(pt => ({
      id: pt.value,
      text: t(pt.value === 'OTHER' ? 'OTHER_PET' : pt.value),
    }));
    this.sizes = enumToArray(PetSizes).map(pt => ({
      id: pt.value,
      text: t(pt.value),
    }));
    this.petSex = enumToArray(PetSex).map(ps => ({
      id: ps.value,
      text: t(ps.value),
    }));
    this.fieldsMapping = { textField: 'text', valueField: 'id' };
  }

  render = () => {
    const { mode } = this.props;
    const { fields } = this.props.model;
    const isEdit = mode === 'edit';

    let editStyles;
    if (isEdit) {
      editStyles = { paddingTop: 0 };
    }
    return (
      <AutoSize breakpoints={breakpointsLimits}>
        {({ breakpoint }) => (
          <Form container style={editStyles}>
            <Field id="petNameText" columns={12}>
              {getTextBox(fields.name, t('PET_NAME'))}
            </Field>
            <Field inline columns={breakpoint === 'medium' ? 4 : 12}>
              {getDropdown(fields.type, t('PET_TYPE'), {
                items: this.types,
                ...this.fieldsMapping,
                id: 'dropdownPetType',
              })}
            </Field>
            <Field id="petBreedText" inline columns={breakpoint === 'medium' ? 8 : 12} last>
              {getTextBox(fields.breed, t('PET_BREED'))}
            </Field>
            <Field inline columns={breakpoint === 'medium' ? 4 : 12}>
              {getDropdown(fields.size, t('PET_SIZE'), {
                items: this.sizes,
                ...this.fieldsMapping,
                id: 'dropdownPetSize',
              })}
            </Field>
            <Field inline columns={breakpoint === 'medium' ? 8 : 12} last>
              {getDropdown(fields.sex, t('PET_SEX'), {
                items: this.petSex,
                ...this.fieldsMapping,
                id: 'dropdownPetSex',
              })}
            </Field>
            <Field inline columns={breakpoint === 'medium' ? 4 : 12}>
              <CheckBox
                id="checkboxIsServiceAnimal"
                label={t('This is a service animal')}
                checked={!!fields.isServiceAnimal.value}
                onChange={value => fields.isServiceAnimal.setValue(value)}
              />
            </Field>
          </Form>
        )}
      </AutoSize>
    );
  };
}
