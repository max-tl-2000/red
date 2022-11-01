/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import clsc from 'helpers/coalescy';
import Text from '../Typography/Text';
import Icon from '../Icon/Icon';
import IconButton from '../IconButton/IconButton';
import Dropdown from '../Dropdown/Dropdown';
import { cf } from './FileQueueItem.scss';
import { FileUploadProgress } from './FileUploadProgress';
import { FileEntry } from './FileEntry';
import Row from '../Table/Row';
import Cell from '../Table/Cell';

const statusClassNameHash = {
  invalid: 'invalid',
  invalidMetadata: 'invalid-metadata',
  queued: 'queued',
  uploadComplete: 'uploaded',
};

@observer
export class FileQueueItem extends Component {
  static propTypes = {
    fileEntry: PropTypes.instanceOf(FileEntry).isRequired,
    onChangeCategory: PropTypes.func,
    onCancelUpload: PropTypes.func,
    onDeleteItem: PropTypes.func,
    categories: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        content: PropTypes.string,
      }),
    ),
  };

  static defaultProps = {
    categories: [],
  };

  handleChangeCategory = ({ id: categoryId }) => {
    const { fileEntry, onChangeCategory } = this.props;
    fileEntry.categoryId = categoryId;

    fileEntry.validate(true);
    if (fileEntry.isValid) {
      fileEntry.updateMetadata({
        category: categoryId,
      });
    }

    onChangeCategory && onChangeCategory(fileEntry);
  };

  handleDeleteFile = () => {
    const { fileEntry, onCancelUpload, onDeleteItem } = this.props;

    if (fileEntry.hasError || fileEntry.uploadRemoved) return;

    if (fileEntry.uploading) {
      onCancelUpload && onCancelUpload(fileEntry);
    } else {
      onDeleteItem && onDeleteItem(fileEntry);
    }
  };

  isQueueItemInvalid = fileEntry => !!(fileEntry.errorMessage || fileEntry.uploadErrorMessage || fileEntry.uploadRemoved);

  getDismissIcon = fileEntry => {
    if (this.isQueueItemInvalid(fileEntry)) return '';

    return fileEntry.uploadComplete ? 'delete' : 'close-circle';
  };

  getStatusClass = fileEntry => {
    if (this.isQueueItemInvalid(fileEntry)) return statusClassNameHash.invalid;

    const classes = [];
    if (fileEntry.uploadComplete) {
      classes.push(statusClassNameHash.uploadComplete);
    }
    if (fileEntry.metadataErrorMessage) {
      classes.push(statusClassNameHash.invalidMetadata);
      return classes.join(' ');
    }

    return fileEntry.uploadComplete ? statusClassNameHash.uploadComplete : statusClassNameHash.queued;
  };

  renderCategoryDropdown = (categories, fileEntry) => (
    <Cell width="30%" padding="0 .3rem 0 .3rem" textAlign="right">
      {fileEntry.metadataErrorMessage && (
        <Text error ellipsis>
          {fileEntry.metadataErrorMessage}
        </Text>
      )}
      <Dropdown
        id="categoriesDropdown"
        items={categories}
        selectedValue={fileEntry.categoryId}
        onChange={this.handleChangeCategory}
        placeholder={t('SELECT_CATEGORY_METADATA')}
        textField="content"
        styled={false}
        valueField="value"
      />
    </Cell>
  );

  renderDismissButton = iconName => (
    <Cell type="ctrlCell" noSidePadding width={50} textAlign="right">
      <IconButton iconName={iconName} onClick={this.handleDeleteFile} />
    </Cell>
  );

  render({ fileEntry, categories } = this.props) {
    const noUploadError = !fileEntry.uploadErrorMessage;
    const dismissIcon = this.getDismissIcon(fileEntry);
    const statusText = clsc(
      fileEntry.uploadErrorMessage,
      fileEntry.errorMessage,
      fileEntry.uploadRemoved && fileEntry.uploadComplete ? t('FILE_REMOVED') : null,
      fileEntry.uploadRemoved ? t('UPLOAD_CANCELLED') : null,
      !fileEntry.inQueue || fileEntry.uploadComplete ? `(${fileEntry.fileSizeStr})` : null,
      `(${t('FILE_IN_QUEUE')})`,
    );
    const statusClass = this.getStatusClass(fileEntry);
    return (
      <div className={cf('file-wrapper')} data-component="fileQueueItem">
        {!fileEntry.uploadRemoved && fileEntry.isValid && !fileEntry.uploadComplete && <FileUploadProgress percentLoaded={fileEntry.percentLoaded} />}
        <div className={cf('file-item', statusClass)} data-id={fileEntry.name.replace(/\s/g, '_')}>
          <Row fullWidthDivider>
            <Cell type="ctrlCell" noSidePadding width={30}>
              <Icon name={fileEntry.iconName} />
            </Cell>
            <Cell padding="0 .3rem 0 .3rem" innerWrapperWidth="100%">
              <Text ellipsis data-id="fileNameText">
                {fileEntry.name}
              </Text>
            </Cell>
            <Cell width="15%" padding="0 .3rem 0 .3rem" textAlign="right">
              <Text error={this.isQueueItemInvalid(fileEntry)} data-id="statusText">
                {statusText}
              </Text>
            </Cell>
            {!fileEntry.uploadRemoved && !!categories.length && noUploadError && fileEntry.uploadComplete && this.renderCategoryDropdown(categories, fileEntry)}
            {!!dismissIcon.length && this.renderDismissButton(dismissIcon)}
          </Row>
        </div>
      </div>
    );
  }
}
