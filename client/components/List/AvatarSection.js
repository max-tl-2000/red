/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './List.scss';

export default function AvatarSection({ className, children, withSmallAvatar, ...props }) {
  const sizeClass = withSmallAvatar ? 'avatar-section-size-small' : 'avatar-section-size-normal';
  return (
    <div className={cf('avatar-section', g(className), sizeClass)} {...props}>
      {children}
    </div>
  );
}
