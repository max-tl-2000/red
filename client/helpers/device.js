/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { document } from '../../common/helpers/globals';

export const ScreenSize = {
  Big: 'Big',
  Normal: 'Normal',
  Medium: 'Medium',
  Small: 'Small',
};

export default function deviceScreen() {
  const width = document.body.clientWidth;

  if (width > 1290) {
    return ScreenSize.Big;
  }

  if (width > 992) {
    return ScreenSize.Normal;
  }

  if (width > 600) {
    return ScreenSize.Medium;
  }

  return ScreenSize.Small;
}
