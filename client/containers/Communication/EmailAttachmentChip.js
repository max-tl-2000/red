/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography } from 'components';
import { cf } from './EmailAttachmentChip.scss';
import Icon from '../../components/Icon/Icon';
import Truncate from '../../components/Truncate/Truncate';
import { getIconName } from '../../../common/helpers/file-icon';
import { downloadDocument } from '../../helpers/download-document';

const { Text } = Typography;

export default class EmailAttachmentChip extends Component {
  static propTypes = {
    id: PropTypes.string,
    originalName: PropTypes.string,
    userToken: PropTypes.string,
  };

  getDocumentDownloadURL = documentId => {
    const { userToken } = this.props;
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/documents/${documentId}/download?token=${userToken}`;
  };

  onClick = documentId => {
    const downloadURL = this.getDocumentDownloadURL(documentId);
    return downloadDocument(downloadURL);
  };

  render() {
    const { id: documentId, originalName } = this.props;

    return (
      <div className={cf('main')} onClick={() => this.onClick(documentId)}>
        <Icon name={getIconName(originalName)} className={cf('file-type-icon')} />
        <Truncate direction="horizontal" className={cf('file-name')}>
          <Text>{originalName}</Text>
        </Truncate>
        <Icon name="download" className={cf('download-file-icon')} />
      </div>
    );
  }
}
