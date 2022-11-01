/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import { getPropertyNameForParty, getPartyMembers, getCommunications, getPersonsInParty } from 'redux/selectors/partySelectors';
import { sendMessage } from 'redux/modules/communication';
import CommunicationList from '../ProspectDetailPage/Communication/CommunicationList';

@connect(
  (state, props) => ({
    loadingData: state.dataStore.get('commsLoading'),
    commsLoadingError: state.dataStore.get('commsLoadingError'),
    communications: getCommunications(state, props),
    associatedPartyPropertyName: getPropertyNameForParty(state, props),
    partyMembers: getPartyMembers(state, props),
    personsInParty: getPersonsInParty(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        sendMessage,
      },
      dispatch,
    ),
)
class CommunicationListWrapper extends Component {
  render() {
    const { props } = this;
    const {
      associatedPartyPropertyName,
      openThreadId,
      openCommFlyOut,
      communications,
      partyMembers,
      personsInParty,
      loadingData,
      partyId,
      party,
      onThreadOpened,
      commsLoadingError,
    } = props;

    return (
      <div style={{ paddingBottom: '4rem' }}>
        <CommunicationList
          partyId={partyId}
          communications={communications}
          loading={loadingData}
          party={party}
          partyMembers={partyMembers}
          persons={personsInParty}
          threadToOpen={openThreadId}
          onThreadOpened={onThreadOpened}
          sendMethod={props.sendMessage}
          onOpenCommFlyOut={openCommFlyOut}
          associatedProperty={associatedPartyPropertyName}
          error={commsLoadingError}
        />
      </div>
    );
  }
}

export default CommunicationListWrapper;
