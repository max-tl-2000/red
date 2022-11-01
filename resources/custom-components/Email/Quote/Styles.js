/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getStyles } from '../getStyles';

const styles = {
  boxTitleStyle: {
    color: '#757575',
    fontWeight: 600,
  },
  leaseItemTopBorderStyle: {
    borderTop: '1px solid #eee',
    paddingTop: '15px',
  },
  leaseItemLeftBorderStyle: {
    width: '100%',
    borderLeft: '1px solid #eee',
    padding: '0 0 0 15px',
  },
  amenitiesBoxStyle: {
    borderTop: '1px solid #e6e6e6',
    textAlign: 'left',
    padding: '24px 0',
  },
  amenitiesTextStyle: {
    paddingTop: 20,
  },
};

export const getStyleFor = getStyles(styles);
