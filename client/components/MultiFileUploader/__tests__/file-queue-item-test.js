/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { mount } from 'enzyme';
import { FileQueueItem } from '../FileQueueItem';
import { FileEntry } from '../FileEntry';
import { FileUploadState } from '../FileUploadState';
import { FileUploadProgress } from '../FileUploadProgress';

describe('FileQueueItem', () => {
  // TODO: fix this.  absence of uploadState should not be used to determine downloading complete
  const uploadState = new FileUploadState();

  const validations = {
    type: {
      validator: type => type === 'application/pdf',
      message: 'invalid file',
    },
    size: {
      validator: size => size < 50000,
      message: 'file size must be less than 50000',
    },
  };

  it('should render a simple item', () => {
    const file = {
      id: '111',
      name: '/some/dir/file.pdf',
      type: 'application/pdf',
      size: 1024,
    };
    const entry = new FileEntry({ file, uploadState });

    const tree = mount(<FileQueueItem fileEntry={entry} />);
    const fileItem = tree.find('.file-item').first();
    expect(fileItem.hasClass('queued')).toBe(true);
    // TODO:  Check icon name, file name (no path), size, and close affordance
  });

  it('should render error for incorrect types', () => {
    const file = {
      id: '222',
      name: '/some/dir/file.tiff',
      type: 'application/tiff',
      size: 100,
    };
    const entry = new FileEntry({ file, validations, uploadState });

    const tree = mount(<FileQueueItem fileEntry={entry} />);
    const fileItem = tree.find('.file-item').first();
    expect(fileItem.hasClass('invalid')).toBe(true);

    // TODO:  Check icon name, file name (no path), error message, no size, and close affordance
  });

  it('should show progress bar for upload in progress', () => {
    const file = {
      clientId: '333',
      name: '/some/dir/file.xls',
      type: 'application/pdf',
      size: 1024,
    };
    const entry = new FileEntry({ file, validations, uploadState });
    const tree = mount(<FileQueueItem fileEntry={entry} />);
    const fileItem = tree.find('.file-item');
    expect(fileItem.hasClass('queued')).toEqual(true);

    // no events yet
    // TODO:  Check icon name, file name (no path), size, no error message, and close affordance
    expect(tree.contains(<FileUploadProgress percentLoaded={0} />)).toEqual(true);

    uploadState.notifyStart({ id: '333' });
    expect(tree.contains(<FileUploadProgress percentLoaded={0} />)).toEqual(true);

    uploadState.notifyProgress({ id: '333', percent: 20 });
    // TODO:  Check icon name, file name (no path), size, no error message, and close affordance
    expect(fileItem.hasClass('queued')).toEqual(true);
    expect(fileItem.hasClass('uploaded')).toEqual(false);

    expect(tree.contains(<FileUploadProgress percentLoaded={20} />)).toEqual(true);

    uploadState.notifyProgress({ id: '333', percent: 100 });
    // Do NOT send notifyEnd yet - make sure full progress is reported at 100%
    // uploadState.notifyEnd({ id: '333'});

    // TODO:  Check icon name, file name (no path), size, no error message, and close affordance
    expect(fileItem.hasClass('queued')).toEqual(false);
    expect(fileItem.hasClass('uploaded')).toEqual(true);
    expect(tree.find(FileUploadProgress).length).toBe(0);

    // make sure notifyEnd doesn't change state
    uploadState.notifyEnd({ id: '333' });
    expect(fileItem.hasClass('queued')).toEqual(false);
    expect(fileItem.hasClass('uploaded')).toEqual(true);
    expect(tree.find(FileUploadProgress).length).toBe(0);

    // TODO: add tests for categories

    // TODO: add tests for upload errors
  });
});
