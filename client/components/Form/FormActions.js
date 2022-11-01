/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Form.scss';
import Field from './Field';

export default function FormActions({ className, wrapperClassName, children, ...props }) {
  return (
    <Field data-component="form-actions" className={cf('actions-outer', g(className))} wrapperClassName={cf('actions', g(wrapperClassName))} {...props}>
      {children}
    </Field>
  );
}
