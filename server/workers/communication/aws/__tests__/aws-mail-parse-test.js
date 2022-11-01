/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { parseEmailFromMimeMessage } from '../awsUtils.js';
import { testData } from './testData';

describe('Given valid mime message', () => {
  it('should be parsed correctly', async () => {
    const ctx = {};
    const result = await parseEmailFromMimeMessage(ctx, testData);

    const expectedResult = {
      event: 'inbound',
      msg: {
        text: 'test\n',
        html: '<div>test</div>\n',
        subject: 'Re: test',
        from_email: 'darius@craftingsoftware.com',
        from_name: 'Darius Baba',
        emails: ['the_cove@red.local.envmail.reva.tech'],
        inReplyTo: 'CABcBfQM5aoQxj9v1Zh+HaNVCyFcW_8Yaak3isw+D-s0jJqvKGQ',
        messageId: 'CABcBfQP4H6uKJ3dCebd3R3eTzrZePGojubdnDdCjovSL=LdzHw',
        references: undefined,
      },
    };

    expect(result.msg.text).to.equal(expectedResult.msg.text);
    expect(result.msg.html).to.equal(expectedResult.msg.html);
    expect(result.msg.from_email).to.equal(expectedResult.msg.from_email);
    expect(result.msg.subject).to.equal(expectedResult.msg.subject);
    expect(result.msg.messageId).to.equal(expectedResult.msg.messageId);
    expect(result.msg.emails.sort()).to.deep.equal(expectedResult.msg.emails.sort());
  });
});
