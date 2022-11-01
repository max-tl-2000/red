/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { replaceEmptySpaces } from '../../../common/helpers/utils';
const POBoxAddresses = ['P.O. Box', 'PO Box', 'POB', 'P.O box'];

export const isPOBoxAddress = address => {
  if (!address) return false;

  return POBoxAddresses.some(pobox => replaceEmptySpaces(address.toLowerCase()).includes(replaceEmptySpaces(pobox.toLowerCase())));
};
