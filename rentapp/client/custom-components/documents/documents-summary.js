/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer, inject } from 'mobx-react';
import { Icon, Typography as T, RedTable as Tbl } from 'components';
import { getIconName } from 'helpers/file-icon';
import { t } from 'i18next';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { downloadDocument } from 'helpers/download-document';
import { createDocumentDownloadURL, getBaseRentappUrl } from '../../../common/generate-api-url-helper';

const DocumentSummaryComponent = ({ auth, documents, type, shouldIncludeDownloadLink }) => {
  const privateType = type === 'private';
  if (!documents || !documents.length) {
    return <EmptyMessage message={t(privateType ? 'NO_PRIVATE_DOCUMENTS' : 'NO_SHARED_DOCUMENTS')} />;
  }

  const handleClick = async documentId => {
    const baseUrl = getBaseRentappUrl();
    const downloadURL = createDocumentDownloadURL(baseUrl, documentId, auth.authInfo.token);
    return downloadDocument(downloadURL);
  };

  const renderDocument = (document, index) => (
    <Tbl.Row noDivider key={document.id}>
      <Tbl.Cell width={40} noSidePadding style={{ marginLeft: '-5px' }}>
        <Icon name={getIconName(document.name)} />
      </Tbl.Cell>
      <Tbl.Cell width="90%" noSidePadding innerWrapperWidth="100%">
        {shouldIncludeDownloadLink ? (
          <T.Link data-id={`privateDocument${index}`} ellipsis key={`doc-link-${document.id}`} onClick={() => handleClick(document.id)}>
            {' '}
            {document.name}
          </T.Link>
        ) : (
          <T.Text ellipsis>{document.name}</T.Text>
        )}
      </Tbl.Cell>
    </Tbl.Row>
  );

  // const renderDocumentWithDownloadOption = document =>
  // <T.Link key={ `doc-link-${document.id}` } onClick={ () => handleClick(document.id) }> { renderDocument(document) }</T.Link>;

  return <div>{documents.map((document, index) => renderDocument(document, index))}</div>;
};

DocumentSummaryComponent.propTypes = {
  documents: PropTypes.array,
  shouldIncludeDownloadLink: PropTypes.bool,
};

export const DocumentsSummary = inject('auth')(observer(DocumentSummaryComponent));
