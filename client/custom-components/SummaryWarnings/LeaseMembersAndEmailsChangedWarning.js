/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { NotificationBanner } from 'components';
import { t } from 'i18next';
import PropTypes from 'prop-types';

export default class LeaseMembersAndEmailsChangedWarning extends Component {
  static propTypes = {
    partyMembersWithModifiedEmail: PropTypes.array,
    partyMembersWithModifiedName: PropTypes.array,
    partyMemberCountChanged: PropTypes.bool,
  };

  membersModifiedEmailsNotification = partyMembersWithModifiedEmail => {
    const names = partyMembersWithModifiedEmail.sort().join(', ');
    return partyMembersWithModifiedEmail.length > 1
      ? `${t('GUEST_EMAIL_UPDATED_PLURAL', {
          names,
        })}`
      : `${t('GUEST_EMAIL_UPDATED', { name: names })}`;
  };

  membersModifiedNamesNotification = (partyMembersWithModifiedName, isCompanyNameUpdated) => {
    const names = partyMembersWithModifiedName
      .map(p => p.oldName)
      .sort()
      .join(', ');
    const newNames = partyMembersWithModifiedName
      .map(p => p.newName)
      .sort()
      .join(', ');

    if (isCompanyNameUpdated) {
      return `${t('LEASE_PUBLISHED_WITH_COMPANY_NAME', { name: names, newName: newNames })}`;
    }

    return partyMembersWithModifiedName.length > 1
      ? `${t('LEASE_PUBLISHED_WITH_NAME_PLURAL', {
          names,
          newNames,
        })}`
      : `${t('LEASE_PUBLISHED_WITH_NAME', { name: names, newName: newNames })}`;
  };

  getContentByPriority = (partyMemberCountChanged, partyMembersWithModifiedName, partyMembersWithModifiedEmail, partyMembersWithModifiedCompanyName) => {
    if (partyMemberCountChanged) return t('LEASE_MEMBERSHIP_CHANGED');

    if (partyMembersWithModifiedCompanyName.length) return this.membersModifiedNamesNotification(partyMembersWithModifiedCompanyName, true);
    if (partyMembersWithModifiedName.length) return this.membersModifiedNamesNotification(partyMembersWithModifiedName);

    return this.membersModifiedEmailsNotification(partyMembersWithModifiedEmail);
  };

  render = () => {
    const { partyMemberCountChanged, partyMembersWithModifiedName, partyMembersWithModifiedEmail, partyMembersWithModifiedCompanyName } = this.props;

    return (
      <NotificationBanner
        contentWrapperStyle={{ padding: '0 12px' }}
        type="warning"
        closeable={false}
        content={this.getContentByPriority(
          partyMemberCountChanged,
          partyMembersWithModifiedName,
          partyMembersWithModifiedEmail,
          partyMembersWithModifiedCompanyName,
        )}
      />
    );
  };
}
