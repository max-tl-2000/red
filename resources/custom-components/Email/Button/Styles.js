/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getStyles } from '../getStyles';

export const styles = {
  buttonWrapper: {
    background: '#2196f3',
    boxShadow: '0 2px 2px 0 #c2c2c2, 0 0 2px 0 #e0e0e0',
  },
  buttonWrapperTd: {
    textAlign: 'center',
    padding: '10px 16px',
  },
  button: {
    display: 'inline-block',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '18.4px',
    fontFamily: 'Roboto,sans-serif',
    borderRadius: '2px',
    textDecoration: 'none',
    textTransform: 'uppercase',
  },
};

export const getStyleFor = getStyles(styles);
