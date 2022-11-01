/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import Field from './Field';

const FormField = observer(
  ({ field, fullWidth, noMargin = true, Component, columns, onBlur, fieldInline, fieldLast, fieldStyle, fieldClassName, ...componentProps }) => (
    <Field
      noMargin={noMargin}
      className={fieldClassName}
      columns={!fullWidth && columns}
      style={{ ...fieldStyle }}
      inline={fieldInline}
      last={fieldLast}
      fullWidth={fullWidth}>
      <Component
        value={field.value}
        errorMessage={t(field.errorMessage)}
        onBlur={e => {
          field.validate();
          onBlur && onBlur(e);
        }}
        {...componentProps}
      />
    </Field>
  ),
);

export default FormField;
