/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography, Icon } from 'components';
import { t } from 'i18next';
import { cf } from './UnitReservedWarning.scss';
import { leasingNavigator } from '../../helpers/leasing-navigator';
import { DALTypes } from '../../../common/enums/DALTypes';
const { Text, Link } = Typography;

export const LeaseNotExecutedWarning = ({ seedPartyWorkflowName, seedPartyId }) => (
  <div className={cf('unit-reserved-warning')} key={`key-${Date.now()}`}>
    <Icon name="alert" className={cf('icon')} />
    <Text className={cf('message')}>
      {t('LEASE_NOT_COUNTERSIGNED_WARNING')}
      <Link className={cf('link')} onClick={() => leasingNavigator.navigateToParty(seedPartyId)} underline>
        {seedPartyWorkflowName === DALTypes.WorkflowName.RENEWAL ? t('GO_TO_THE_RENEWAL_PARTY') : t('GO_TO_THE_LEASING_PARTY')}
      </Link>
    </Text>
  </div>
);
