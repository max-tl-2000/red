/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { downloadDocument } from 'helpers/download-document';
import PropTypes from 'prop-types';
import { location } from '../../../common/helpers/globals';
import { renderPreparingLease } from './PreparingLeaseComponent';
import { LeasePage } from './LeasePage';

export default class DownloadLeasePage extends Component {
  componentDidMount = () => {
    const { token } = this.props.location.query;
    const { isPreview = false } = this.props;
    const fname = isPreview ? 'downloadPreview' : 'download';
    const path = `${location.origin}/api/leases/${fname}?token=${token}`;
    downloadDocument(path);
  };

  static propTypes = {
    location: PropTypes.object,
    isPreview: PropTypes.bool,
  };

  render = () => {
    const msg = t('LEASE_PREPARE_DOCUMENT', { action: t('LEASE_ACTION_DOWNLOAD') });
    return <LeasePage>{renderPreparingLease(msg)}</LeasePage>;
  };
}
