/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Form, Field, TextBox } from 'components';
import { t } from 'i18next';

@observer
export default class DemoForm extends Component { // eslint-disable-line
  static propTypes = {
    model: PropTypes.object,
  };

  render() {
    const { model } = this.props;
    const { fields } = model;

    return (
      <Form container>
        <Field>
          <TextBox
            label={t('FIRST_NAME')}
            type="text"
            value={fields.firstName.value}
            showClear
            errorMessage={fields.firstName.errorMessage}
            onBlur={(e, { value }) => fields.firstName.setValue(value)}
            wide
          />
        </Field>
        <Field>
          <TextBox
            label={t('LAST_NAME')}
            type="text"
            value={fields.lastName.value}
            showClear
            errorMessage={fields.lastName.errorMessage}
            onBlur={(e, { value }) => fields.lastName.setValue(value)}
            wide
          />
        </Field>
      </Form>
    );
  }
}
