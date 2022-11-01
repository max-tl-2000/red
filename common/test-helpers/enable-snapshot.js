/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import chaiJestSnapshot from 'chai-jest-snapshot';

const enableSnapshot = () => {
  if (!global.before) return;
  chai.use(chaiJestSnapshot);
  before(() => {
    chaiJestSnapshot.resetSnapshotRegistry();
  });

  beforeEach(function beforeEach() {
    const { currentTest } = this;
    chaiJestSnapshot.setFilename(`${currentTest.file}.chai-snap`);
    chaiJestSnapshot.setTestName(currentTest.fullTitle());
  });
};

enableSnapshot();

export { editUnpredictable } from '../helpers/snapshot-helper';
