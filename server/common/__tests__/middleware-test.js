/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { buildFileObjectWithOrginalName } from '../middleware';

describe('when call buildFileObjectWithOrginalName', () => {
  it('should rename originalname to originalName', () => {
    const files = [
      { path: 'path/to/file', originalname: 'image1.png' },
      { path: 'path/to/file2', originalname: 'image2.png' },
    ];

    const result = buildFileObjectWithOrginalName(files);

    expect(files.length).to.equal(result.length);
    expect(result).to.deep.equal([
      { path: 'path/to/file', originalName: 'image1.png' },
      { path: 'path/to/file2', originalName: 'image2.png' },
    ]);
  });
});
