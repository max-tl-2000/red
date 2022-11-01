/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { cf } from './SalesPersonList.scss';
import SalesPerson from './SalesPerson';

const SalesPersonList = ({ users, activityLogs, timezone }) => {
  const renderSalesPerson = () =>
    users.map((user, idx) => {
      const latestActivityLog = activityLogs.find(log => log.context && log.context.users && log.context.users.find(userId => userId === user.id));
      return <SalesPerson timezone={timezone} key={user.id} user={user} activityLog={latestActivityLog} isPrimaryAgent={idx === 0} />;
    });

  return <div className={cf('list-content')}>{renderSalesPerson()}</div>;
};

SalesPerson.propTypes = {
  users: PropTypes.array,
  activityLogs: PropTypes.array,
};

export default SalesPersonList;
