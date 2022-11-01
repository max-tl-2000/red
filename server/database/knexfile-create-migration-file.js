/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// this file is used only by scripts/create_migration_file.sh
// this is needed because the original knexfile now exports two different knex connections
import { knexConfig } from './knexfile';

module.exports = knexConfig;
