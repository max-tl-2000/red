/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './List.scss';

export default function MainSection({ className, children, ...props }) {
  return (
    <div data-component="main-section" className={cf('main-section', g(className))} {...props}>
      <div>{children}</div>
    </div>
  );
}
