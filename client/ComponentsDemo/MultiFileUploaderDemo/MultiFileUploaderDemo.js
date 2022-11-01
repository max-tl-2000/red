/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';

import { MultiFileUploader } from 'components';
import { FileQueueItem } from 'components/MultiFileUploader/FileQueueItem';
import { FileEntry } from 'components/MultiFileUploader/FileEntry';
import { FileUploadState } from 'components/MultiFileUploader/FileUploadState';
import { DemoSection, DemoPage, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const api = [
  ['uploadPath', 'String', '', 'path to upload files'],
  ['token', 'String', '', 'user token to be appended to requests'],
  ['categories', 'Array<Object>', '', 'optional list of categories the user can choose for each file'],
  ['categories[].value', 'Number', '', 'id of the category'],
  ['categories[].content', 'String', '', 'visible text of the category'],
];

export default class MultiFileUploaderDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {};
  }

  closeDialog(dialogId) {
    this.setState({ [`dialogOpen${dialogId}`]: false });
  }

  openDialog(dialogId) {
    this.setState({ [`dialogOpen${dialogId}`]: true });
  }

  render() {
    const { id } = this.props;
    const theId = clsc(id, this.id);
    const uploadState = new FileUploadState();
    const DEFAULT_CATEGORIES = [
      { value: 1, content: 'paystub' },
      { value: 2, content: 'utility bill' },
    ];

    const DEFAULT_VALIDATIONS = {
      type: {
        validator: type => type === 'application/pdf',
        message: 'invalid file type',
      },
      size: {
        validator: size => size < 50000,
        message: 'file size must be less than 50000',
      },
    };

    const DEFAULT_VALIDATIONS_WITH_CATGORIES = {
      ...DEFAULT_VALIDATIONS,
      categoryId: {
        validator: categoryId => !!categoryId,
        isMetadata: true,
        message: 'Category is required',
      },
    };

    const generateFileEntry = ({
      progressStep = 0,
      name = '',
      size = 100,
      validations = {},
      type = 'application/pdf',
      categories = undefined,
      serverError = null,
      serverErrorMessages = {},
    }) => {
      const entryId = generateId({ name: 'fileEntry' });
      // 0 = no state yet
      // 1 = state but no start
      // 2 = start but no progress
      // 3-7 = start + progress TODO: make this a timer
      // 8 = all progress + notifyEnd
      const fe = new FileEntry({
        file: { id: entryId, name, size, type },
        categories,
        uploadState,
        validations,
        serverError,
        serverErrorMessages,
      });
      if (progressStep > 1) {
        uploadState.notifyStart({ id: entryId });
      }
      if (progressStep > 2) {
        let currentProgress = 0;
        while (currentProgress < (progressStep - 2) * 20) {
          uploadState.notifyProgress({ id: entryId, percent: currentProgress });
          currentProgress += 20;
        }
      }
      if (serverError) {
        uploadState.notifyEnd({ id: entryId, error: serverError });
      }
      if (progressStep === 8) {
        uploadState.notifyEnd({ id: entryId });
        /* original version of code required uploadState gone to be uploaded */
        fe.set(uploadState, undefined);
      }
      return fe;
    };

    return (
      <DemoPage id={theId} title="MultiFileUploader">
        <DemoSection title="What's a MultiFileUploader">
          <MDBlock>
            {`
                  A \`MultiFileUploader\` is used to upload one or more files. It manages
                  individual progress bars for each files, handles errors, and permits
                  the user to delete uploaded files, or (optionally) set a category for
                  each uploaded file.
                `}
          </MDBlock>
          <PropertiesTable data={api} />
        </DemoSection>
        <DemoSection title="The main uploader">
          <PrettyPrint>TODO: Add sample code. Also, the visuals for this are not working yet...</PrettyPrint>
          <MultiFileUploader
            style={{ margin: '0 1.5rem' }}
            uploadPath={'/documents'}
            token="userToken"
            categories={DEFAULT_CATEGORIES}
            isCategoryRequired={true}
          />
        </DemoSection>
        <DemoSection title="FileQueueItem">
          <MDBlock>
            {`
               The main UI subcomponent of \`MultiFileUploader\` is the \`FileQueueItem\`.  There
               are three states of \`FileQueueItem\`: queued, invalid, and uploading.  The examples
               below show all of the different states, with and without progress, and with and without
               categories (both optional and required).

               The code to generate these is somewhat
               complex, so please refer to the source code to understand how it works.
               `}
          </MDBlock>
          <FileQueueItem fileEntry={generateFileEntry({ name: '/documents/foo.pdf' })} />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/foo.tiff',
              type: 'application/tiff',
              validations: DEFAULT_VALIDATIONS,
            })}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/foo.pdf',
              type: 'application/pdf',
              validations: DEFAULT_VALIDATIONS,
              progressStep: 0,
            })}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/too-big.pdf',
              type: 'application/pdf',
              size: 100000,
              validations: DEFAULT_VALIDATIONS,
              progressStep: 1,
            })}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/20-percent.pdf',
              progressStep: 4,
            })}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/60-percent.pdf',
              progressStep: 7,
            })}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/completed.pdf',
              progressStep: 9,
            })}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/categories-not-downloaded.pdf',
              progressStep: 0,
            })}
            categories={DEFAULT_CATEGORIES}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/categories-not-downloaded-20percent.pdf',
              progressStep: 4,
            })}
            categories={DEFAULT_CATEGORIES}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/category-not-required.pdf',
              progressStep: 9,
            })}
            categories={DEFAULT_CATEGORIES}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/category-required.pdf',
              progressStep: 9,
              validations: DEFAULT_VALIDATIONS_WITH_CATGORIES,
            })}
            categories={DEFAULT_CATEGORIES}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/foo-filesize-error.pdf',
              progressStep: 4,
              serverErrorMessages: { size: 'Server says file is too big ' },
              serverError: { token: 'LIMIT_FILE_SIZE' },
            })}
          />
          <FileQueueItem
            fileEntry={generateFileEntry({
              name: '/documents/foo-generic-error.pdf',
              progressStep: 4,
              serverErrorMessages: {
                generic: 'something really bad happened on server',
              },
              serverError: { token: 'INTERNAL_SERVER_ERROR' },
            })}
          />
        </DemoSection>
      </DemoPage>
    );
  }
}
