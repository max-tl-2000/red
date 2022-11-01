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
import { toSentenceCase } from '../../helpers/capitalize';
import { toHumanReadableString } from '../../../common/helpers/strings';
import { getDisplayName } from '../../../common/helpers/person-helper';
const { Text, Link } = Typography;

export const InvalidEmailWarning = ({ members, onAddEmailAddress }) => (
  <div className={cf('unit-reserved-warning')} data-id={'invalid-email-warning'} key={`key-${Date.now()}`}>
    <Icon name="alert" className={cf('icon')} />
    <Text className={cf('message')}>
      {t('MISSING_EMAIL_WARNING', { memberNames: toHumanReadableString(members.map(pm => getDisplayName(pm.person))), count: members.length })}
      <Link className={cf('link')} onClick={() => onAddEmailAddress && onAddEmailAddress(members.map(pm => pm.id))} underline>
        {toSentenceCase(t('ADD_EMAIL_ADDRESS'))}
      </Link>
    </Text>
  </div>
);
