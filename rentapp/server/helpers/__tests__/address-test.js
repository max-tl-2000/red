/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { isPOBoxAddress } from '../address';

describe('address helper', () => {
  describe('is a PO Box address', () => {
    [
      { address: '', isPOBox: false },
      { address: 'P.O. Box 8100 S California', isPOBox: true },
      { address: '8100 S California PO Box', isPOBox: true },
      { address: '8100 S California POB', isPOBox: true },
      { address: 'P.O box 8100 S California', isPOBox: true },
      { address: '8100 S California pob', isPOBox: true },
      { address: '8100 S California p.o. box', isPOBox: true },
      { address: '8100 S California', isPOBox: false },
      { address: '8100 S California P. O. Box', isPOBox: true },
      { address: '8100 S California P O Box', isPOBox: true },
      { address: '8100 S California P O B', isPOBox: true },
    ].forEach(({ address, isPOBox }) =>
      it(`'${address}' should${isPOBox ? '' : ' not'} be a PO box address`, () => {
        expect(isPOBoxAddress(address)).to.equal(isPOBox);
      }),
    );
  });
});
