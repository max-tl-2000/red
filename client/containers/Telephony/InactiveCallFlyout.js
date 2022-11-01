/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { createSelector } from 'reselect';
import { getInactiveCallData } from 'redux/modules/telephony';
import { Typography } from 'components';
import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import { observer, inject } from 'mobx-react';
import { reaction } from 'mobx';
import InactiveCallComponent from './InactiveCallComponent';
import { cf } from './InactiveCallFlyout.scss';
import { shouldDisplayViewPartyLink as shouldDisplayViewParty } from '../../helpers/telephony';

import { getDisplayName } from '../../../common/helpers/person-helper';

const { SubHeader } = Typography;

const getNamesToDisplay = persons => persons.map(p => getDisplayName(p)).join(', ');

const getFlyoutProps = createSelector(
  s => s.flyoutStore,
  (s, props) => props.flyoutId,
  (flyoutStore, flyoutId) => (flyoutStore.openedFlyouts[flyoutId] ? flyoutStore.openedFlyouts[flyoutId].flyoutProps : {}),
);

const getAssociatedParty = createSelector(getFlyoutProps, flyoutProps => flyoutProps.associatedParty);

const getCommunications = createSelector(
  getFlyoutProps,
  getAssociatedParty,
  (s, props) => props.personId,
  (flyoutProps, associatedParty, personId) => {
    const comms = flyoutProps.communications || [];
    // calls should be sorted on backend, no need for resorting here
    if (personId) return comms.filter(c => c.persons.includes(personId));
    if (associatedParty) return comms.filter(c => c.parties.includes(associatedParty.id));

    return comms;
  },
);

const getPerson = createSelector(getFlyoutProps, flyoutProps => flyoutProps.person);

@connect(
  (state, props) => ({
    flyoutData: getFlyoutProps(state, props),
    associatedParty: getAssociatedParty(state, props),
    communications: getCommunications(state, props),
    person: getPerson(state, props),
  }),
  dispatch => bindActionCreators({ getInactiveCallData }, dispatch),
)
@inject('leasingNavigator')
@observer
export default class InactiveCallFlyout extends Component {
  static propTypes = {
    flyoutId: PropTypes.string,
    threadId: PropTypes.string,
    associatedParty: PropTypes.object,
    communications: PropTypes.array,
    person: PropTypes.array,
    partyId: PropTypes.string,
    personId: PropTypes.string,
  };

  componentDidMount() {
    const { flyoutId, threadId, partyId, personId, getInactiveCallData: loadInactiveCallData, leasingNavigator } = this.props;

    this.mounted = true;

    loadInactiveCallData({ flyoutId, threadId, partyId, personId });

    // this will keep track of any change to the location property of the leasingNavigator object
    // which keeps track of changes to the current location. When this property changes it will execute
    // the doLoadInactiveCallData. This replaces the
    this.stopReaction = reaction(
      () => leasingNavigator.location,
      () => this.doloadInactiveCallData(),
    );
  }

  doloadInactiveCallData = () => {
    const { flyoutId, threadId, partyId, personId, getInactiveCallData: loadInactiveCallData } = this.props;

    loadInactiveCallData({ flyoutId, threadId, partyId, personId });
  };

  componentWillUnmount() {
    this.mounted = false;
    this.stopReaction && this.stopReaction();
  }

  clickViewPartyHandler = () => {
    const { leasingNavigator, associatedParty } = this.props;

    leasingNavigator.navigateToParty(associatedParty.id);
  };

  shouldDisplayViewPartyLink = () => {
    const { associatedParty, communications, leasingNavigator } = this.props;
    const lastComm = communications[communications.length - 1];
    return shouldDisplayViewParty(leasingNavigator.location.pathname, associatedParty, lastComm);
  };

  render() {
    const { communications, person, focusedCommId, flyoutId, partyId, associatedParty } = this.props;

    if (!person) return <div />;

    const personDisplayName = getNamesToDisplay(person);

    return (
      <DockedFlyOut
        windowIconName="phone"
        flyoutId={flyoutId}
        title={
          <div className={cf('title')}>
            <SubHeader ellipsis lighter>
              {personDisplayName}
            </SubHeader>
          </div>
        }>
        <InactiveCallComponent
          flyoutId={flyoutId}
          partyId={partyId}
          associatedParty={associatedParty}
          communications={communications}
          person={person[0]}
          focusedCommId={focusedCommId}
          shouldDisplayViewPartyLink={this.shouldDisplayViewPartyLink}
          onClickViewParty={this.clickViewPartyHandler}
        />
      </DockedFlyOut>
    );
  }
}
