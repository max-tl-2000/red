/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from 'clix-logger/logger';

export const subtle = (...args) => logger.subtle(...args);
export const print = (...args) => logger.print(...args);
export const error = (...args) => logger.error(...args);
export const warn = (...args) => logger.warn(...args);
export const ok = (...args) => logger.ok(...args);
export const success = (...args) => logger.success(...args);
