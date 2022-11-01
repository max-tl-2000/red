/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getStyles } from '../getStyles';

const styles = {
  topBar: {
    textAlign: 'left',
    borderTopLeftRadius: '3px',
    borderTopRightRadius: '3px',
  },
  titleSection: {
    padding: '0 0 0 24px',
  },
  subjectSection: {
    padding: '0 24px 0 0',
    textAlign: 'right',
    paddingRight: '24px',
  },
};

export const getStyleFor = getStyles(styles);
