/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf } from './table.scss';

export default function TextHighlight({ children, inline }) {
  const cName = cf('highlight', { inline });
  return inline ? <span className={cName}>{children}</span> : <p className={cName}>{children}</p>;
}
