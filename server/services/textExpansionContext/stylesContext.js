/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { VIEW_MODEL_TYPES } from './enums';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

// CPM-13687: this is a short-term solution, we will be hardcoding these values based on the tenant
const defaultStyles = {
  primaryButtonBackgroundColor: '#0098ef',
  primaryButtonTextColor: '#FFFFFF',
};

const stylesTenantMapping = {
  maximus: {
    primaryButtonBackgroundColor: defaultStyles.primaryButtonBackgroundColor,
    primaryButtonTextColor: defaultStyles.primaryButtonTextColor,
  },
  customerold: {
    primaryButtonBackgroundColor: '#719949',
    primaryButtonTextColor: defaultStyles.primaryButtonTextColor,
  },
  'customerold-sal': {
    primaryButtonBackgroundColor: '#719949',
    primaryButtonTextColor: defaultStyles.primaryButtonTextColor,
  },
};

export const tokensMapping = {
  styles: {
    primaryButtonBackgroundColor: ({ ctx: { tenantName } }) => (stylesTenantMapping[tenantName] || defaultStyles).primaryButtonBackgroundColor,
    primaryButtonTextColor: ({ ctx: { tenantName } }) => (stylesTenantMapping[tenantName] || defaultStyles).primaryButtonTextColor,
  },
};
