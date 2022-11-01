/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography, Icon } from 'components';
import { t } from 'i18next';
import { cf } from '../component-base.scss';
const { Caption, Text } = Typography;

const displayGuarantorWarning = ({ isOnPaymentStep, isPartyLevelGuarantor, partyLevelGuarantor, guarantorEmails }) => {
  if (!isPartyLevelGuarantor) return <noscript />;
  if (!isOnPaymentStep) return <noscript />;

  return partyLevelGuarantor && guarantorEmails ? (
    <div className={cf('warning-block')}>
      <Icon name="alert" className={cf('icon')} />
      <Text className={cf('message')}>{t('GUARANTOR_ALREADY_INVITED_WARNING')}</Text>
    </div>
  ) : (
    <noscript />
  );
};

export const EmailList = ({ emails, label, isOnPaymentStep, isPartyLevelGuarantor, partyLevelGuarantor, guarantorEmails }) => (
  <div className={cf('block-row')}>
    <div className={cf('column-block')}>
      <Caption secondary bold>
        {label}
      </Caption>
    </div>
    <div className={cf('column-block')}>
      <Caption inline bold>
        {emails}
      </Caption>
      {displayGuarantorWarning({ isOnPaymentStep, isPartyLevelGuarantor, partyLevelGuarantor, guarantorEmails })}
    </div>
  </div>
);
