/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';

import Dropzone from 'react-dropzone';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import generateId from 'helpers/generateId';
import Text from '../Typography/Text';
import Title from '../Typography/Title';
import Caption from '../Typography/Caption';
import Icon from '../Icon/Icon';
import Card from '../Card/Card';
import Button from '../Button/Button';
import { cf, g } from './MultiFileUploader.scss';
import { client } from './RestClient';
import { FileQueue } from './FileQueue';
import { FileQueueModel } from './FileQueueModel';
import { uploadState } from './uploadState';

@observer
export default class MultiFileUploader extends Component {
  constructor(props, context) {
    super(props, context);

    if (props.token) {
      client.setExtraHeaders({
        Authorization: `Bearer ${props.token}`,
      });
    }

    this.state = {
      model: this.createModel(props.files),
      supportedMIMETypes: new Set(props.supportedFileTypes),
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.supportedFileTypes !== nextProps.supportedFileTypes) {
      this.setState({
        supportedMIMETypes: new Set(this.props.supportedFileTypes),
      });
    }
  }

  static propTypes = {
    dataId: PropTypes.string,
    supportedFileTypes: PropTypes.array,
    supportedFileFormats: PropTypes.array,
    multiple: PropTypes.bool,
    fileSize: PropTypes.number,
    token: PropTypes.string,
    uploadPath: PropTypes.string.isRequired,
    isCategoryRequired: PropTypes.bool,
    sharedFiles: PropTypes.bool,
    queueType: PropTypes.string,
    partyApplicationId: PropTypes.string,
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
    categories: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        content: PropTypes.string,
      }),
    ),
    onFileUploaded: PropTypes.func,
    onCancelUpload: PropTypes.func,
    onDeleteItem: PropTypes.func,
    onChangeCategory: PropTypes.func,
    context: PropTypes.string,
  };

  static defaultProps = {
    categories: [],
    files: [],
    multiple: true,
    isCategoryRequired: true,
    fileSize: 20, // in megabytes - remember there is a server side validations too.
    supportedFileTypes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'image/png',
      'image/gif',
      'image/jpeg',
    ],
    supportedFileFormats: ['doc', 'docx', 'pdf', 'png', 'gif', 'jpeg'],
  };

  get isDirty() {
    const { model } = this.state || {};
    return model.isDirty();
  }

  get errors() {
    const { model } = this.state || {};
    return model.errors;
  }

  get queueType() {
    return this.props.queueType;
  }

  createModel(files) {
    const validations = {
      type: {
        validator: this.isValidFileType,
        message: t('INVALID_FILE_TYPE'),
      },
      size: {
        validator: this.isValidFileSize,
        message: t('LIMIT_FILE_SIZE', { fileSize: this.props.fileSize }),
      },
      sizeZero: {
        validator: this.isValidNotSizeZero,
        message: t('ZERO_FILE_SIZE'),
      },
    };

    if (this.props.isCategoryRequired) {
      validations.categoryId = {
        validator: this.isValidCategory,
        message: t('CATEGORY_REQUIRED'),
        isMetadata: true,
      };
    }

    const metadata = {};
    if (this.props.sharedFiles) {
      metadata.partyApplicationId = this.props.partyApplicationId;
    }
    return new FileQueueModel({
      uploadState,
      validations,
      files,
      apiClient: client,
      uploadPath: this.props.uploadPath,
      serverErrorMessages: {
        size: t('LIMIT_FILE_SIZE', { fileSize: this.props.fileSize }),
        generic: t('SERVER_ERROR'),
      },
      context: this.props.context,
      metadata,
    });
  }

  isValidFileType = type => this.state.supportedMIMETypes.has(type);

  isValidFileSize = size => {
    const fileSizeInMegabytes = size / 1000000.0;
    return fileSizeInMegabytes <= this.props.fileSize;
  };

  isValidNotSizeZero = isZeroSize => !isZeroSize;

  // TODO: this doesn't seem quite right...
  isValidCategory = value => (value && value.toFixed().length) || false;

  handleDrop = files => {
    const { model } = this.state || {};

    files.forEach(file => {
      file.clientId = generateId(this);
      model.add(file);
    });

    const { queueType, onFileUploaded } = this.props;
    model.upload(uploadResponse => {
      const fileEntry = model.getFileById(uploadResponse.id);
      fileEntry && onFileUploaded && onFileUploaded(queueType, fileEntry);
    });
  };

  handleChangeCategory = ({ id, categoryId }) => {
    const { queueType, onChangeCategory } = this.props;
    onChangeCategory && onChangeCategory(queueType, id, categoryId);
  };

  handleCancelUploadingFile = file => {
    const { queueType, onCancelUpload } = this.props;
    this.state.model.cancelUploadingFile(file.clientId);
    onCancelUpload && onCancelUpload(queueType, file);
  };

  handleDeleteUploadedFile = async file => {
    const { queueType, onDeleteItem } = this.props;
    await this.state.model.deleteUploadedFile(file.id);
    onDeleteItem && onDeleteItem(queueType, file);
  };

  getSupportedFilesStr = () => this.props.supportedFileFormats.map(format => format.toUpperCase()).join(', ');

  renderPlaceHolder = () => (
    <div className={cf('placeholder')}>
      <Button type="flat" btnRole="primary" className={cf('title')}>
        <Icon name="upload" />
        <span>{t('PLACEHOLDER_CHOOSE_FILE_TO_UPLOAD')}</span>
      </Button>
      <Text disabled className={cf('option')}>
        {t('PLACEHOLDER_OPTION_TO_UPLOAD')}
      </Text>
      <Title secondary>{t('PLACEHOLDER_DRAG_FILES_HERE')}</Title>
    </div>
  );

  render({ className, multiple, categories, dataId } = this.props) {
    return (
      <Card data-id={dataId} container={false} className={cf('file-uploader', g(className))}>
        <div className={cf('info')}>
          <Icon name="information" />
          <Caption secondary>
            {t('SUPPORTED_FILES_FORMAT', {
              formats: this.getSupportedFilesStr(),
            })}
          </Caption>
        </div>
        <Dropzone
          className={cf('dropzone-area')}
          activeClassName={cf('active')}
          multiple={multiple}
          onDrop={this.handleDrop}
          data-id="dropzone"
          inputProps={{
            'data-id': 'uploadFileInput',
          }}>
          {this.renderPlaceHolder()}
        </Dropzone>
        <FileQueue
          queue={this.state.model}
          categories={categories}
          onCancelUpload={this.handleCancelUploadingFile}
          onDeleteItem={this.handleDeleteUploadedFile}
          onChangeCategory={this.handleChangeCategory}
        />
      </Card>
    );
  }
}
