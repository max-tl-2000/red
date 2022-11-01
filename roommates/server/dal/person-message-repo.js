/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertInto } from '../../../server/database/factory';
import { DALTables } from '../../common/enums/dal-tables';

export const createPersonMessage = (tenantId, personMessage) => insertInto(tenantId, DALTables.Tables.PERSON_MESSAGE, personMessage);
