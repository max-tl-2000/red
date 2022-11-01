/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const testEvent = {
  requestContext: {
    elb: {
      targetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:575025666629:targetgroup/tenant-redirect/014494f6e94b38df',
    },
  },
  httpMethod: 'GET',
  path: '/api/v1/marketing/properties',
  queryStringParameters: {
    param1: '1',
    param2: '2',
  },
  headers: {
    accept: '*/*',
    'accept-encoding': 'deflate, gzip',
    'accept-language': 'en-US,en;q=0.9',
    authority: 'chris-old.staging.env.reva.tech',
    authorization:
      'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJib2R5Ijoie0VOQ1JZUFRFRH06SGJkN2Z5ZEZjZkhoajJmdDozZnk0Wk9scFE5SWxJSlZTeUNTejdKVHdzZy90MkQ3Z2xFT0hIZnhvRGY5QkYzY1laVm1KUXRwWmRNaXcyaEhRRVEya0t1bEFmYUVrYjhVTHdheDBxalNtc05Fb3BUN0o3WE1OYlMrOVNZZ0I0SklGS1p3K0ZuZkpzM0NVQ2R2OXFtQW5BOGQwZmp0ZWthdytWdzd6MWlWaTIrRU0wNHR4NmVBQ2YrOXlWZFhLS3V0bFlZTUNTSTF3cHhXT0hpY1pSK2IzamNhRW1CZUpWWTlGUWc9PSIsImlhdCI6MTYwNjE2OTk1NCwiZXhwIjoxNjY5Mjg1MTU0fQ.VZug8jlDDI7fMWAqcmYwD7GN-sqzSL2v8vfbC7iiGp0',
    'content-type': 'application/json',
    dnt: '1',
    host: 'chris-old.staging.env.reva.tech',
    origin: 'https://web.staging.env.reva.tech',
    referer: 'https://web.staging.env.reva.tech/',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
    'x-amzn-trace-id': 'Root=1-5fce7404-3343f07d07f7524e46151e77',
    'x-forwarded-for': '186.177.191.55',
    'x-forwarded-port': '443',
    'x-forwarded-proto': 'https',
    'x-reva-marketing-session-id': '6a9b717c-83fd-4b6e-b88b-b2a81ee0b208',
  },
  body: '',
  isBase64Encoded: false,
};
