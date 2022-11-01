/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapDataToFields } from './utils';

const fields = {
  NameID: {
    fn: ({ externalInfo }) => externalInfo && externalInfo.externalId,
    isMandatory: true,
  },
};

export const createVoidLeaseMapper = data => mapDataToFields(data, fields);
