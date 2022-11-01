/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { addBreakHintsOnWords } from '../strings';

describe('strings', () => {
  describe('addBreakHintsOnWords', () => {
    it('should add a zero width unicode char after a special char', () => {
      const testString = 'aLongEmailTextWith.LotOfText@reaction.com';
      expect(addBreakHintsOnWords(testString)).toEqual('aLongEmailTextWith.\u200BLotOfText@\u200Breaction.\u200Bcom');
    });

    it('should also break words that are longer than 20 chars', () => {
      const testString = 'Supercalifragilisticexpialidocious';
      expect(addBreakHintsOnWords(testString)).toEqual('Supercalifragilistic\u200Bexpialidocious');
    });
  });
});
