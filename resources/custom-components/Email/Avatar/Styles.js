/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getStyles } from '../getStyles';

export const styles = {
  avatar: {
    position: 'relative',
    width: '48px',
    height: '48px',
  },
  'avatar-wrapper': {
    position: 'absolute',
    overflow: 'hidden',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
  },
  letters: {
    display: 'block',
    lineHeight: '48px',
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
  'letters-span': {
    fontSize: '17.6px',
  },
  'avatar-image': {
    width: '100%',
    height: '100%',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderRadius: '50%',
    textAlign: 'center',
  },
};

export const getStyleFor = getStyles(styles);
