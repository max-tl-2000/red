/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { t } from 'i18next';
import { formatTimestamp } from 'helpers/date-utils';
import { Avatar, Typography } from 'components';
import { cf } from './SalesPerson.scss';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../../common/enums/activityLogTypes';

const { Text, Caption } = Typography;

const formatActionType = action => (action === ACTIVITY_TYPES.DUPLICATE ? ACTIVITY_TYPES.NEW : action);

const SalesPerson = ({ user, isPrimaryAgent, activityLog, timezone }) => {
  const renderRightSide = () => {
    if (!activityLog) {
      return (
        <div className={cf('card-right-side')}>
          <Text>{t('NO_ACTIVITY')}</Text>
        </div>
      );
    }

    const activityLogTimestamp = formatTimestamp(activityLog.created_at, { timezone });
    const actionType = formatActionType(activityLog.type);
    const formattedComponent =
      activityLog.component === COMPONENT_TYPES.QUOTE ? `${activityLog.component}` : `${activityLog.component} (#${activityLog.details.displayNo})`;

    return (
      <div className={cf('card-right-side')}>
        <Text>{`${t('LAST_ACTIVITY')} ${activityLogTimestamp}`}</Text>
        <Caption secondary>{`${actionType} ${formattedComponent}`}</Caption>
      </div>
    );
  };

  return (
    <div className={cf('sales-person-card')}>
      <div className={cf('card-left-side')}>
        <Avatar userName={user.fullName} className={cf('avatar')} src={user.avatarUrl} />
        <div className={cf('user-details')}>
          <Text>{user.fullName}</Text>
          {isPrimaryAgent && <Caption secondary>{t('PRIMARY_AGENT')}</Caption>}
        </div>
      </div>
      {renderRightSide()}
    </div>
  );
};

SalesPerson.propTypes = {
  user: PropTypes.object,
  isPrimaryAgent: PropTypes.bool,
  activityLog: PropTypes.object,
};

export default SalesPerson;
