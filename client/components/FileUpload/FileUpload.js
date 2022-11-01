/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { createSelector } from 'reselect';
import Dropzone from 'react-dropzone';
import { t } from 'i18next';
import injectProps from 'helpers/injectProps';
import { observable, computed, action } from 'mobx';
import { observer } from 'mobx-react';
import Text from '../Typography/Text';
import Button from '../Button/Button';
import { cf } from './FileUpload.scss';
import trim from '../../../common/helpers/trim';

@observer
export default class FileUpload extends Component {
  static propTypes = {
    allowedFileTypes: PropTypes.array,
    multiple: PropTypes.bool,
    upload: PropTypes.func,
    buttonLabel: PropTypes.string,
    dropzoneMessage: PropTypes.string,
    uploadStatus: PropTypes.string,
    maxSize: PropTypes.number,
    fileSizeIsTooBigMessage: PropTypes.string,
    allowedExtensions: PropTypes.array,
  };

  static defaultProps = {
    multiple: false,
    allowedFileTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-zip-compressed',
    ],
    allowedExtensions: [/\.xlsx$/i, /\.zip$/i],
  };

  constructor(props) {
    super(props);
    this._getAllowedTypes = createSelector(
      cProps => cProps.allowedFileTypes,
      allowedFileTypes => new Set(allowedFileTypes || []),
    );
    this._getAllowedExtensions = createSelector(
      cProps => cProps.allowedExtensions,
      allowedExtensions => Array.from(new Set(allowedExtensions || [])),
    );
  }

  @observable
  files = [];

  @computed
  get fileNames() {
    return this.files.map(file => file.name).join(', ');
  }

  @computed
  get invalidFileNames() {
    return this.filesProcessed.invalid.map(file => file.name).join(', ');
  }

  @computed
  get hasInvalidTypes() {
    return this.filesProcessed.invalid.length > 0;
  }

  @computed
  get noValidFiles() {
    return this.filesProcessed.valid.length === 0;
  }

  @computed
  get fileSizeIsTooBig() {
    return this.files.some(file => file.size > this.props.maxSize);
  }

  @computed
  get filesProcessed() {
    return this.files.reduce(
      (seq, file) => {
        const valid = this.isValidType(file);
        const bucket = valid ? 'valid' : 'invalid';

        seq[bucket].push(file);

        return seq;
      },
      { valid: [], invalid: [] },
    );
  }

  get allowedFileTypesSet() {
    const { _getAllowedTypes, props } = this;
    return _getAllowedTypes(props);
  }

  get allowedExtensionsArr() {
    const { _getAllowedExtensions, props } = this;
    return _getAllowedExtensions(props);
  }

  isValidType = ({ type, name }) => {
    const { allowedFileTypesSet, allowedExtensionsArr } = this;
    return allowedFileTypesSet.has(type) || allowedExtensionsArr.some(rgx => !!trim(name).toLowerCase().match(rgx));
  };

  uploadData = () => this.props.upload && this.props.upload(this.files);

  @action
  handleDrop = files => {
    this.files = files;
  };

  renderMessages(reflow) {
    return (
      <div className={cf('upload-messages', { reflow })}>
        {this.hasInvalidTypes && <Text error>{this.props.invalidFileTypeMessage}</Text>}
        {this.hasInvalidTypes && <Text error>{this.invalidFileNames}</Text>}
        {this.fileSizeIsTooBig && <Text error>{this.props.fileSizeIsTooBigMessage}</Text>}
        {!this.hasInvalidTypes && !this.fileSizeIsTooBig && this.fileNames && <Text>{`${t('FILES_TO_UPLOAD')}: ${this.fileNames}`}</Text>}
      </div>
    );
  }

  @injectProps
  render({ multiple, placeholder, buttonLabel, uploadStatus }) {
    return (
      <div>
        <div className={cf('file-upload')}>
          <Dropzone ref="dropzone" multiple={multiple} onDrop={this.handleDrop}>
            <Text>{placeholder}</Text>
          </Dropzone>
          {this.renderMessages()}
          <div className={cf('upload-actions')}>
            <Button disabled={this.hasInvalidTypes || this.noValidFiles || this.fileSizeIsTooBig} onClick={this.uploadData} type="raised" label={buttonLabel} />
          </div>
          <div className={cf('upload-status')}>
            <Text>
              {t('UPLOAD_STATUS')} {uploadStatus}
            </Text>
          </div>
        </div>
        {this.renderMessages(true)}
      </div>
    );
  }
}
