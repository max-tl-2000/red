/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';

const readFile = Promise.promisify(fs.readFile);

exports.up = async knex => {
  const cloneSchemaRaw = await readFile(path.join(__dirname, '../../schema/clone_schema.sql'), 'utf8');
  await knex.schema.raw(cloneSchemaRaw);
};

exports.down = () => {};
