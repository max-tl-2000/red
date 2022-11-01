/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Dropzone from 'react-dropzone';
import { observer } from 'mobx-react';
import getUUID from 'uuid/v4';
import { action } from 'mobx';

import { cf } from './SimpleUploader.scss';
import generateId from '../../helpers/generateId';
import { FileDescriptor } from './FileDescriptor';

@observer
export default class SimpleUploader extends Component {
  static propTypes = {
    multiple: PropTypes.bool,
    placeholder: PropTypes.object,
    fileSize: PropTypes.number,
    files: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        type: PropTypes.string,
        size: PropTypes.number,
        metadata: PropTypes.shape({
          categoryId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        }),
      }),
    ),
    context: PropTypes.string,
  };

  static defaultProps = {
    multiple: false,
    fileSize: 20, // MB
    context: 'cohort-files',
  };

  @action
  handleDrop = async files => {
    const { uploadModel, readOnly, onClearQueue, onBeforeHandleDrop } = this.props;

    if (onBeforeHandleDrop) {
      const args = {
        cancel: false,
      };

      onBeforeHandleDrop?.(args);

      if (args.cancel) return;
    }

    if (readOnly) return;

    if (uploadModel.clearQueueBeforeAdd) {
      await uploadModel.clearQueue();
      onClearQueue?.();
    }

    if (!uploadModel.multiple) {
      files = files.slice(0, 1);
    }

    const args = { addToQueue: true };
    await uploadModel.raiseBeforeAddToQueue(args);
    if (!args.addToQueue) return;

    files.forEach(file => {
      const id = generateId(this);
      const clientFileId = getUUID();
      uploadModel.addFileToQueue({ id, clientFileId, file }, { shouldUploadFile: true });
    });
  };

  render() {
    const { placeholder, style, className, uploadDescription, uploadModel, readOnly, onDownloadRequest, onDeleteFile } = this.props;
    return (
      <div style={style} className={className}>
        {!readOnly && (
          <div>
            <Dropzone
              className={cf('dropzone', { disabled: readOnly })}
              multiple={uploadModel.multiple}
              activeClassName={cf('active')}
              onDrop={this.handleDrop}>
              {placeholder}
            </Dropzone>
            {uploadDescription && uploadDescription}
          </div>
        )}
        {uploadModel?.queue?.length > 0 &&
          uploadModel.queue.map(
            entry =>
              !entry.deleted &&
              !entry.aborted && (
                <FileDescriptor onDownloadRequest={onDownloadRequest} onDeleteFile={onDeleteFile} readOnly={readOnly} key={entry.id} entry={entry} />
              ),
          )}
      </div>
    );
  }
}
