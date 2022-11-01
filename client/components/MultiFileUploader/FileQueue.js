/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { FileQueueItem } from './FileQueueItem';
import { cf } from './FileQueue.scss';

export const FileQueue = observer(({ queue, categories, onDeleteItem, onCancelUpload, onChangeCategory }) => {
  const ret = (
    <div className={cf({ 'file-queue': queue.length })}>
      {!!queue.length &&
        queue.values.map(fileEntry => (
          <FileQueueItem
            key={fileEntry.clientId}
            fileEntry={fileEntry}
            categories={categories}
            onDeleteItem={onDeleteItem}
            onCancelUpload={onCancelUpload}
            onChangeCategory={onChangeCategory}
          />
        ))}
    </div>
  );
  return ret;
});

FileQueue.propTypes = {
  queue: PropTypes.object.isRequired,
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      content: PropTypes.string,
    }),
  ),
  onCancelUpload: PropTypes.func,
  onDeleteItem: PropTypes.func,
  onChangeCategory: PropTypes.func,
};
