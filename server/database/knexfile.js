/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// Update with your config settings.
// this may be merged with the main config file. That means we will need
// to specify the config file path when running knex commands
// http://knexjs.org/#knexfile

const config = require('../config').default;

const knexConfig = config.knexConfig;
const knexConfigReadOnly = config.knexConfigReadOnly;

module.exports = {
  knexConfig,
  knexConfigReadOnly,
};
