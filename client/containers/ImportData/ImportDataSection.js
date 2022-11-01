/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { windowOpen } from 'helpers/win-open';
import { addInstance, resetSeedDataState, notifyUploadProgress } from 'redux/modules/seedData';
import { FileUpload, Section } from 'components';
import { restClient } from './importUploadRestClient';

@connect(
  (state, props) => {
    const importData = state.seedData.get(props.componentName);
    return {
      importData: importData || {},
      userToken: state.auth.token,
    };
  },
  dispatch =>
    bindActionCreators(
      {
        addInstance,
        resetSeedDataState,
        notifyUploadProgress,
      },
      dispatch,
    ),
)
export default class ImportDataSection extends Component {
  componentWillMount() {
    const { componentName, userToken } = this.props;
    if (!componentName) return;

    this.props.addInstance(componentName);
    this.client = restClient(componentName, { notifyUploadProgress: this.props.notifyUploadProgress, userToken }).client;
  }

  componentWillUnmount() {
    this.props.resetSeedDataState();
  }

  getUploadStatus = () => {
    let uploadStatus;
    const state = this.props.importData;
    if (state.uploadedFileIsTooBig) {
      uploadStatus = t('UPLOAD_FILE_TOO_BIG_ERROR');
    } else if (state.uploadStarted) {
      uploadStatus = t('UPLOAD_STARTED', { percentLoaded: state.percentLoaded });
    } else if (state.uploadFinished) {
      uploadStatus = t('UPLOAD_FINISHED');
    } else if (state.uploadFinishedWithErrors) {
      uploadStatus = t('UPLOAD_ERRORED_OUT');
    }

    return uploadStatus || t('UPLOAD_NOT_STARTED');
  };

  downloadResultFile = value => windowOpen(value);

  render = () => {
    const { multiple, allowedFileTypes, labels, onUpload, allowedExtensions, componentName } = this.props;
    if (!componentName) return <noscript />;

    const { title, placeholder, buttonLabel, invalidFileTypeMessage } = labels;

    // Multer uses this equivalence 1kb = 1000b
    const isImportVoiceMessageRecordingsField = title === t('SEED_VOICE_FILES_HEADER');
    const seedDataMaxFileSizeInBytes = isImportVoiceMessageRecordingsField ? 1000000000 : 10000000000; // 1gb or 10gb

    return (
      <Section title={title}>
        <FileUpload
          multiple={multiple}
          allowedFileTypes={allowedFileTypes}
          allowedExtensions={allowedExtensions}
          placeholder={placeholder}
          buttonLabel={buttonLabel}
          invalidFileTypeMessage={invalidFileTypeMessage}
          maxSize={seedDataMaxFileSizeInBytes}
          fileSizeIsTooBigMessage={isImportVoiceMessageRecordingsField ? t('UPLOAD_FILE_TOO_BIG_ERROR_1GB') : t('UPLOAD_FILE_TOO_BIG_ERROR_10GB')}
          uploadStatus={this.getUploadStatus()}
          upload={files => onUpload(files, this.client)}
        />
      </Section>
    );
  };
}
