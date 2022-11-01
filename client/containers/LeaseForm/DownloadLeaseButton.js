/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Button } from 'components';

const DownloadLeaseButton = ({ downloadLeaseDocument, leaseId }) => (
  <Button id="downloadLeaseBtn" type="raised" btnRole="secondary" label={t('DOWNLOAD_LEASE')} onClick={() => downloadLeaseDocument(leaseId)} />
);

export default DownloadLeaseButton;
