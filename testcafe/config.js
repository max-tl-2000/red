/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const testMailAPIKey = 'e2721c64-95ab-4ccc-845b-f500a839b0f8';
const testMailNamespace = 'ens7m';

module.exports = {
  emailRequestUrl: timestamp =>
    `https://api.testmail.app/api/json?apikey=${testMailAPIKey}&namespace=${testMailNamespace}&pretty=true&timestamp_from=${timestamp}&limit=25`,
};
