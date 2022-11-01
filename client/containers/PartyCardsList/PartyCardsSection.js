/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Typography } from 'components';
import { cf } from './PartyCardsSection.scss';
import PartyCard from './PartyCard';
import { DATETIME_TODAY, DATETIME_LATER } from './constants';
import { DALTypes } from '../../../common/enums/DALTypes';

const { Caption, SubHeader } = Typography;

export default class PartyCardsSection extends Component {
  static propTypes = {
    parties: PropTypes.any, // can be an array or object in case of immutable
    dateType: PropTypes.string,
    collapsed: PropTypes.bool,
    dataDeps: PropTypes.any,
    partyFilter: PropTypes.object,
    noOfPartiesInSection: PropTypes.number,
  };

  render() {
    const { dateType, collapsed, parties, users, dataDeps, partyFilter, noOfPartiesInSection, ...rest } = this.props;

    if (noOfPartiesInSection === 0) {
      if (dateType === DATETIME_LATER) {
        // hide section in this case
        return <noscript />;
      }

      return (
        <div className={cf('day')}>
          <SubHeader secondary bold inline>
            {t(dateType)}
          </SubHeader>
          <Caption className={cf('helper-text')} secondary inline>
            {t(dateType === DATETIME_TODAY ? 'ALL_DONE_FOR_DATETIME' : 'NOTHING_PLANNED')}
          </Caption>
        </div>
      );
    }

    const { showTaskOwners, currentUser } = dataDeps;
    const partyCards = parties.map(partyData => {
      const { members, persons, company, leases, appointments, tasks, applications, communication, activeLeaseWorkflowData, ...party } = partyData;
      const partyLease = (leases || []).find(lease => lease && lease.status !== DALTypes.LeaseStatus.VOIDED);
      const partyMembers = (members || []).map(p => ({
        ...p,
        person: persons[p.personId],
        company: p.companyId ? company[p.companyId] : null,
        application: (applications || []).find(application => application.personId === p.personId),
      }));

      return (
        <PartyCard
          key={party.id}
          prospect={party}
          tasks={tasks}
          activeLeaseWorkflowData={activeLeaseWorkflowData}
          appointments={appointments}
          users={users}
          persons={persons}
          company={company}
          members={partyMembers}
          communication={communication}
          showTaskOwners={showTaskOwners}
          currentUser={currentUser}
          lease={partyLease}
          dateType={dateType}
          partyFilter={partyFilter}
        />
      );
    });

    return (
      <div {...rest}>
        <div className={cf('day')}>
          <SubHeader secondary bold inline>
            {t(dateType)}
          </SubHeader>
          <Caption secondary inline>
            ({noOfPartiesInSection})
          </Caption>
        </div>
        {!collapsed ? partyCards : null}
      </div>
    );
  }
}
