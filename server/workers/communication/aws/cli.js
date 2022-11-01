/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { error } from 'clix-logger/logger';
import fs from 'fs';
import { parseEmailFromMimeMessage } from './awsUtils';

const main = async () => {
  const file = process.argv[2];
  const key = file === '-k' ? process.argv[3] : '';
  let emailObj;
  if (!key) {
    const fileContents = await fs.readFileSync(file, 'utf8');
    emailObj = await parseEmailFromMimeMessage(fileContents);
  } else {
    const params = {
      Bucket: 'red-prod-emails',
      Key: key,
      tenant: 'customernew'
    };
    emailObj = await getS3Mail({ tenantId: '8904deef-7cf9-4675-ac66-b9a64c8b86f8' }, params);
  }
  console.log('Parsed email:', emailObj);
  return true;
};

if (require.main === module) {
  main()
    .then(process.exit)
    .catch(e => {
      error('An error ocurred while parsing the file', e);
				  process.exit(1); // eslint-disable-line
    });
}
