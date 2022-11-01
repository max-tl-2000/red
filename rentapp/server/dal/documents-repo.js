/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertInto } from '../../../server/database/factory';
const PERSON_APP_DOC_TABLE_NAME = 'rentapp_personApplicationDocuments';

export const createDocument = (ctx, document) => insertInto(ctx, PERSON_APP_DOC_TABLE_NAME, document);
