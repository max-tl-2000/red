/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { write } from '../../common/helpers/xfs';
import { now } from '../../common/helpers/moment-utils';

const main = async () => {
  const ts = now().format('YYYY-MM-DDTHH:mm:ss');

  const contents = `
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Mocha Tests no files changed" timestamp="${ts}" time="0" tests="0" failures="0">
</testsuites>
  `.trim();

  await write('./report_integration/test-results.xml', contents, { encoding: 'utf8' });
};

main().catch(err => console.error(err));
