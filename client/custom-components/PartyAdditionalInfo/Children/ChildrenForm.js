/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { Form, Field } from 'components';
import { getTextBox } from '../../../helpers/field-helpers';

export const ChildrenForm = observer(({ model }) => {
  const { fields } = model;
  return (
    <Form container>
      <Field id="childFullNameText" columns={10}>
        {getTextBox(fields.fullName, t('FULL_NAME'), {
          onBlur: () => model.fillPreferredName(),
        })}
      </Field>
      <Field id="childPreferredNameText" columns={10}>
        {getTextBox(fields.preferredName, t('CHILDREN_PREFERRED_NAME'))}
      </Field>
    </Form>
  );
});

ChildrenForm.propTypes = {
  item: PropTypes.object,
};
