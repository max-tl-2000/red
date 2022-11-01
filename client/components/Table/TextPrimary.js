/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf } from './table.scss';

export default function TextPrimary({ children, inline, dataId }) {
  const cName = cf('text-primary', { inline });
  return inline ? (
    <span data-id={dataId} className={cName}>
      {children}
    </span>
  ) : (
    <p data-id={dataId} className={cName}>
      {children}
    </p>
  );
}
