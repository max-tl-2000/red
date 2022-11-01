/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import MainSection from './MainSection';
import { cf, g } from './List.scss';

export default function GroupSection({ className, noIndentGroupItems, children, ...props }) {
  return (
    <div className={cf('group-section', { noIndentGroupItems }, g(className))} {...props}>
      <MainSection>{children}</MainSection>
    </div>
  );
}
