/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import orderBy from 'lodash/orderBy';
import { DALTypes } from '../../common/enums/DALTypes';

export const getBadgeName = status => {
  switch (status) {
    case DALTypes.UserStatus.AVAILABLE:
      return 'available';
    case DALTypes.UserStatus.BUSY:
      return 'busy';
    default:
      return 'not-available';
  }
};

// Temporary implementation; this should be changed after user roles are implemented
export const isLoggedAsAdmin = user => (user ? user.email === 'admin@reva.tech' : false);

export const isCustomerAdmin = user => (user ? user.metadata && user.metadata.isCustomerAdmin : false);

export const getBusinessTitle = user => user.titleInTeam || user.metadata.businessTitle;

const isUserAvailable = user => user?.metadata?.status === DALTypes.UserStatus.AVAILABLE;

export const isUserBusy = user => user?.metadata?.status === DALTypes.UserStatus.BUSY;

const isUserNotAvailable = user => user?.metadata?.status === DALTypes.UserStatus.NOT_AVAILABLE;

export const orderUsersByAvailability = users => orderBy(users, [isUserAvailable, isUserBusy, isUserNotAvailable, 'fullName'], ['desc', 'desc', 'desc', 'asc']);
