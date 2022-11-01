/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from './enums/DALTypes';

export const CATEGORIES = [
  { value: 1, content: DALTypes.DocumentCategories.INCOME_SOURCES },
  { value: 2, content: DALTypes.DocumentCategories.ADDRESS_HISTORY },
  { value: 3, content: DALTypes.DocumentCategories.DOCUMENTS },
];

export const MULTIFILE_UPLOADER_PATH = '/documents';
