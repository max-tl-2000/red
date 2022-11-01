/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { expect } from 'chai';
import { parse } from '../../helpers/workbook';
import { hasOwnProp } from '../../../common/helpers/objUtils';

describe('Given a property spreadsheet with empty cells in addressLine2 column', () => {
  it('Should return the same number of headers that we have in the spreadsheet', async () => {
    const pathToSheet = path.join(__dirname, './resources/Maximus_simple_highlight_test.xlsx');
    const result = await parse(pathToSheet);

    expect(hasOwnProp(result.Properties.data[0], 'addressLine2')).to.be.true;
    expect(hasOwnProp(result.Properties.data[1], 'addressLine2')).to.be.true;
    expect(hasOwnProp(result.Properties.data[2], 'addressLine2')).to.be.true;
    expect(hasOwnProp(result.Properties.data[3], 'addressLine2')).to.be.true;
    expect(hasOwnProp(result.Properties.data[4], 'addressLine2')).to.be.true;
  });
});
