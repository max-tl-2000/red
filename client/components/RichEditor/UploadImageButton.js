/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';

import Icon from '../Icon/Icon';
import { cf } from './UploadImageButton.scss';

export default class UploadImageButton extends Component {
  static propTypes = {
    handleFilesUpload: PropTypes.func,
    getEditorState: PropTypes.func,
    setEditorState: PropTypes.func,
  };

  openDialog = () => this.fileUploaderRef?.click();

  onMouseDown = event => event.preventDefault();

  handleChange = event => {
    const files = Array.from(event.target.files);
    const { handleFilesUpload, getEditorState, setEditorState } = this.props;
    handleFilesUpload?.({ getEditorState, setEditorState }, files);
  };

  render() {
    return (
      <div onMouseDown={this.onMouseDown} className={cf('uploadImageButtonWrapper')}>
        <input
          className={cf('fileUploader')}
          multiple
          type="file"
          ref={node => {
            this.fileUploaderRef = node;
          }}
          onChange={this.handleChange}
        />
        <button type="button" onClick={this.openDialog} className={cf('uploadImageButton')}>
          <Icon name="file-image" />
        </button>
      </div>
    );
  }
}
