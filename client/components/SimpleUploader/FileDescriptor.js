/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer } from 'mobx-react';
import { IconButton, Status } from 'components';
import { t } from 'i18next';
import * as T from '../Typography/Typography';
import { cf } from './FileDescriptor.scss';
import { File, Download, CloseCircle, Delete } from '../../red-icons/index';

const renderCancelIcon = entry => {
  if (!entry.uploadComplete) {
    return <IconButton onClick={() => entry.clearQueue()} iconName={() => <CloseCircle className={cf('icon')} />} />;
  }
  return '';
};

export const FileDescriptor = observer(({ entry, readOnly, onDownloadRequest, onDeleteFile }) => {
  const style = {
    width: entry.uploadComplete ? '0%' : `${entry.uploadProgress}%`,
    transition: 'width 200ms',
  };

  const onDelete = e => {
    onDeleteFile && onDeleteFile(e);
    e.delete();
  };

  const renderFileOptions = () => {
    if (entry.errorProcessingfile) {
      return <T.Caption className={cf('error')}>{t('ERROR_PROCESSING_FILE')}</T.Caption>;
    }

    return (
      <div className={cf('optionsButtons')}>
        <IconButton
          disabled={!entry.uploadNotificationReceived}
          onClick={() => onDownloadRequest?.(entry)}
          iconName={() => <Download className={cf('icon')} />}
        />
        {!readOnly && (
          <IconButton disabled={!entry.uploadNotificationReceived} onClick={() => onDelete(entry)} iconName={() => <Delete className={cf('icon')} />} />
        )}
      </div>
    );
  };

  const displayError = !entry.valid;

  return (
    <div>
      <div className={cf('fileEntry')}>
        {!entry.aborted && <div className={cf('progressBar')} style={!entry.uploadComplete ? style : {}} />}
        <div className={cf(displayError ? 'fileEntryInfo error' : 'fileEntryInfo')}>
          <div className={cf('itemDescription')}>
            <File className={cf('icon margin')} />
            <T.Caption secondary={readOnly} className={cf('fileName')}>
              {entry.name}
            </T.Caption>
            <T.Caption secondary className={cf('fileSize')}>
              ({entry.friendlyFileSize})
            </T.Caption>
            {displayError && <T.Caption className={cf('error')}>{entry.validationError}</T.Caption>}
          </div>
          <div className={cf('fileOptions')}>
            {renderCancelIcon(entry)}
            {renderFileOptions()}
          </div>
        </div>
      </div>
      <Status processing={entry.uploadComplete && !entry.uploadNotificationReceived && !entry.errorProcessingfile} height={2} />
    </div>
  );
});
