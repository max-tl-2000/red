/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import EmployeeSelector from './EmployeeSelector';

export default class ForwardCallSelector extends Component {
  static propTypes = {
    users: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    teams: PropTypes.array,
    suggestedUsers: PropTypes.array,
    suggestedTeams: PropTypes.array,
    loggedInUser: PropTypes.object,
    onEmployeeSelected: PropTypes.func,
    placeholderText: PropTypes.string,
    currentUserId: PropTypes.string,
  };

  formatExternalPhone = externalPhone => ({
    id: externalPhone.id,
    fullName: externalPhone.displayName,
    title: externalPhone.property,
    number: externalPhone.number,
    isOtherContact: true,
    isExternalPhone: true,
  });

  prepareExternalPhones = () => {
    const { primaryTeamId, externalPhones } = this.props;
    const suggestedOtherItems = externalPhones.filter(ep => ep.teamIds.includes(primaryTeamId)).map(this.formatExternalPhone);

    const allOtherItems = externalPhones.map(this.formatExternalPhone);

    return {
      suggestedOtherItems: [{ id: 'externalPhones', items: suggestedOtherItems }],
      allOtherItems: [{ id: 'externalPhones', items: allOtherItems }],
    };
  };

  render = () => {
    const { suggestedUsers, suggestedTeams, users, teams, onTargetSelected, loggedInUser } = this.props;

    const { suggestedOtherItems, allOtherItems } = this.prepareExternalPhones();

    return (
      <EmployeeSelector
        suggestedUsers={suggestedUsers}
        suggestedTeams={suggestedTeams}
        users={users || []}
        teams={teams || []}
        currentUser={loggedInUser}
        onEmployeeSelected={onTargetSelected}
        suggestedOtherItems={suggestedOtherItems}
        allOtherItems={allOtherItems}
        placeholderText={t('FIND_MORE')}
      />
    );
  };
}
