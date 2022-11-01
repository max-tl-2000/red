/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { markContactAsSpam } from 'redux/modules/blacklistStore';
import { loadPartyDetailsData } from 'redux/modules/appDataLoadingActions';
import { getParty, getCommunications, getPartyTimezone } from 'redux/selectors/partySelectors';
import EmailMessageCard from '../Communication/EmailMessageCard';
import PreloaderBlock from '../../components/PreloaderBlock/PreloaderBlock';
import { printWindow } from '../../helpers/print-window';
import { cf } from './PrintFriendly.scss';

@connect(
  (state, props) => {
    const partyId = props.params.partyId;
    const pageProps = { partyId };
    const party = getParty(state, pageProps);

    return {
      party,
      timezone: getPartyTimezone(state, props),
      communications: getCommunications(state, props),
      allCommunications: state.dataStore.get('communications'),
      currentUser: state.auth.user,
      users: state.globalStore.get('users'),
      loaded: state.dataStore.get('loaded'),
      commsLoaded: state.dataStore.get('commsLoaded'),
      globalDataLoaded: state.globalStore.get('globalDataLoaded'),
      userToken: state.auth.token,
      allPartyMembers: state.dataStore.get('members'),
      allInactiveMembers: state.dataStore.get('inactiveMembers'),
      allPersons: state.dataStore.get('persons'),
    };
  },
  dispatch =>
    bindActionCreators(
      {
        loadPartyDetailsData,
        markContactAsSpam,
      },
      dispatch,
    ),
)
export default class PrintFriendly extends Component {
  static propTypes = {
    currentUser: PropTypes.object,
    markContactAsSpam: PropTypes.func,
  };

  componentDidMount() {
    this.loadDetailsDataForParty();
  }

  componentDidUpdate() {
    if (this.props.loaded && this.props.globalDataLoaded && this.props.commsLoaded && this.props.params.autoprint) {
      setTimeout(() => {
        printWindow();
      }, 1500);
    }
  }

  loadDetailsDataForParty = ({ doNotClearPartyData } = {}) => {
    const { props } = this;
    const {
      params: { partyId },
    } = props;
    props.loadPartyDetailsData(partyId, { silentOnly: doNotClearPartyData });
  };

  getAllCommunicationsById = commId => this.props.allCommunications.filter(c => c.id === commId);

  getPartyMembers = partyId => {
    const { allPartyMembers = [], allPersons = [] } = this.props;

    return allPartyMembers
      .filter(p => p.partyId === partyId)
      .map(p => ({
        ...p,
        person: allPersons.get(p.personId),
      }));
  };

  getInactivePartyMembers = partyId => this.props.allInactiveMembers.filter(p => p.partyId === partyId);

  getRecipientList = (comm, persons) => persons.filter(pers => comm.persons.indexOf(pers.id) >= 0);

  getPersons = (partyId, partyMembers) => {
    const { allPersons = [] } = this.props;
    const inactivePartyMembers = this.getInactivePartyMembers(partyId);
    const partyMembersIncludingInactive = partyMembers.merge(inactivePartyMembers);

    return allPersons.filter(pers => partyMembersIncludingInactive.find(pm => pm.personId === pers.id));
  };

  render() {
    const { loaded, globalDataLoaded, commsLoaded } = this.props;
    if (!loaded || !globalDataLoaded || !commsLoaded) {
      return <PreloaderBlock />;
    }
    const { props } = this;
    const { communicationId, partyId } = props.params;
    const communicationMap = this.getAllCommunicationsById(communicationId);
    const communications = communicationMap.toArray();
    const { party, users, currentUser, userToken } = this.props;
    const members = this.getPartyMembers(partyId);
    const persons = this.getPersons(partyId, members);
    const { timezone = '' } = party || {};
    const participants = this.getRecipientList(communications[0], persons);

    return (
      <div data-component="partyPage" className={cf('print-content')}>
        {communications.map(comm => (
          <div key={comm.id}>
            <h5 className={cf('title')}>{comm.message.subject}</h5>
            <hr />
            <EmailMessageCard
              key={comm.id}
              persons={persons}
              timezone={timezone}
              communication={comm}
              communicationThread={communications}
              participants={participants}
              currentUser={currentUser}
              users={users}
              userToken={userToken}
              onMarkAsSpam={this.props.markContactAsSpam}
              shouldDisplayPrintBtn={false}
            />
          </div>
        ))}
        <br />
      </div>
    );
  }
}
