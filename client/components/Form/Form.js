/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g, locals } from './Form.scss';
import Title from '../Typography/Title';
import Field from './Field';

export { locals as classes };

export default function Form({ children, container, className, title, ...props }) {
  const titleC = typeof title === 'string' ? <Title>{title}</Title> : title;

  return (
    <form data-component="form" className={cf('form', { container }, g(className))} onSubmit={e => e.preventDefault()} {...props}>
      {titleC && <Field>{titleC}</Field>}
      {children}
    </form>
  );
}
