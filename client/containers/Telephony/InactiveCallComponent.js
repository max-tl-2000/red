/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { createSelector } from 'reselect';
import * as telephonyActions from 'redux/modules/telephony';
import { commsReadByUser } from 'redux/modules/communication';
import scrollIntoView from 'helpers/scrollIntoView';
import callStates from 'helpers/enums/callStates';
import { hasPhonesOutsideTheApp } from 'helpers/telephony';
import { closeFlyout } from 'redux/modules/flyoutStore';
import { disableCommsForArchivedParty } from 'redux/selectors/partySelectors';
import { observer, Observer } from 'mobx-react';

import { Button, IconButton, GeminiScrollbar } from 'components';
import orderBy from 'lodash/orderBy';
import CallSourceSelector from './CallSourceSelector';
import PhoneNumbersDropdown from './PhoneNumbersDropdown';
import { DALTypes } from '../../../common/enums/DALTypes';
import CallHistory from './CallHistory';
import { cf } from './InactiveCallComponent.scss';
import { formatPhone } from '../../../common/helpers/phone-utils';

const lastCallStatusOrder = [
  DALTypes.ContactInfoLastCallStatus.CALLBACK_REQUESTED,
  DALTypes.ContactInfoLastCallStatus.MISSED,
  DALTypes.ContactInfoLastCallStatus.INCOMING,
  DALTypes.ContactInfoLastCallStatus.OUTGOING,
  DALTypes.ContactInfoLastCallStatus.NONE,
];

const sortPhoneNumbersByLastCallStatus = phones => {
  const enhancedPhonesWithLastCallData = phones.map(phone => ({
    ...phone,
    metadata: { ...phone.metadata, lastCall: phone.metadata.lastCall || DALTypes.ContactInfoLastCallStatus.NONE },
    displayValue: formatPhone(phone.value),
  }));

  return orderBy(
    enhancedPhonesWithLastCallData,
    [phone => lastCallStatusOrder.indexOf(phone.metadata.lastCall), phone => new Date(phone.metadata.lastCallDate)],
    ['asc', 'desc'],
  );
};

// TODO: Move common selectors to a separated module to avoid repeating code
const userSelector = createSelector(
  state => state.globalStore.get('users'),
  state => state.auth.user,
  (users, user) => {
    if (!user) return null;
    // It seems the user entity is probably already the same
    // as the one returned from the users data set.
    // keeping it like this to avoid other potential issues
    const { userId } = user;
    return users.get(userId);
  },
);

@connect(
  (state, props) => ({
    callState: state.telephony.callState,
    parties: state.dataStore.get('parties'),
    user: userSelector(state),
    isAuthUserBusy: state.usersStore.isAuthUserBusy,
    areCommsDisabled: disableCommsForArchivedParty(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        closeFlyout,
        commsReadByUser,
        ...telephonyActions,
      },
      dispatch,
    ),
)
@observer
export default class InactiveCallComponent extends Component {
  static propTypes = {
    callState: PropTypes.string,
    initOutgoingCall: PropTypes.func,
    flyoutId: PropTypes.string,
    person: PropTypes.object,
    onClickViewParty: PropTypes.func,
    commsReadByUser: PropTypes.func,
    communications: PropTypes.array,
    partyId: PropTypes.string,
    shouldDisplayViewPartyLink: PropTypes.func,
    areCommsDisabled: PropTypes.bool,
  };

  state = {
    selectedPhoneNumber: sortPhoneNumbersByLastCallStatus(this.props.person.contactInfo.phones)[0],
  };

  componentDidMount() {
    this.scrollToLastNote();
    this.markThreadAsRead();
  }

  componentWillReceiveProps(nextProps) {
    if ('communications' in nextProps && nextProps.communications.length !== this.props.communications.length) {
      this.scrollToLastNote();
    }
  }

  markThreadAsRead = () => {
    const [threadId] = this.props.communications.map(comm => comm.threadId);
    if (!threadId) return;
    this.props.commsReadByUser(threadId);
  };

  notesRefs = {};

  renderCallHistory = () => {
    const { communications: comms, focusedCommId, partyId, associatedParty = {}, areCommsDisabled } = this.props;
    const calls = comms.filter(comm => comm.type === DALTypes.CommunicationMessageType.CALL);
    const noOfCalls = calls.length;

    // notes input is scrolled into view while editing notes so that text doesn't go under call button
    return calls.map((call, index) => (
      <div ref={i => (this.notesRefs[call.id] = i)} key={call.id}>
        <CallHistory
          index={noOfCalls - index - 1}
          timezone={associatedParty.timezone}
          call={call}
          partyId={partyId}
          focused={call.id === focusedCommId}
          onNotesChanged={() =>
            this.notesRefs[call.id].scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }
          key={call.id}
          readOnly={areCommsDisabled}
        />
      </div>
    ));
  };

  scrollToLastNote = () => this.notesEnd && scrollIntoView(this.notesEnd);

  onCallClickHandler = () => {
    const { person, initOutgoingCall, flyoutId, partyId } = this.props;
    this.props.closeFlyout(flyoutId);

    const { fullName, preferredName } = person;
    const to = {
      fullName,
      preferredName,
      phone: this.state.selectedPhoneNumber.value,
      partyId,
      personId: person.id,
    };
    initOutgoingCall(to);
  };

  onPhoneNumberChanged = value => {
    this.setState({ selectedPhoneNumber: value?.item || {} });
  };

  onClickViewPartyHandler = () => this.props.onClickViewParty && this.props.onClickViewParty();

  render() {
    const { user, shouldDisplayViewPartyLink, areCommsDisabled, person } = this.props;
    const isCallButtonDisabled = ![callStates.NONE, callStates.FAILED].includes(this.props.callState) || this.props.isAuthUserBusy || areCommsDisabled;
    const phones = person.contactInfo.phones;
    const multiplePhoneNumbers = phones.length > 1;
    const sortedPhoneNumbers = sortPhoneNumbersByLastCallStatus(phones);

    return (
      <div data-id="inactiveCallFlyout" className={cf('form-content')}>
        <Observer>
          {() =>
            shouldDisplayViewPartyLink() && (
              <Button type="flat" btnRole="primary" label={t('VIEW_PARTY')} className={cf('view-party-section')} onClick={this.onClickViewPartyHandler} />
            )
          }
        </Observer>
        {(hasPhonesOutsideTheApp(user) && <CallSourceSelector user={user} />) || <noscript />}
        <GeminiScrollbar>
          <div ref={node => (this.notesSection = node)}>
            {this.renderCallHistory()}
            <div className={cf('notesEnd')} ref={e => (this.notesEnd = e)} />
          </div>
        </GeminiScrollbar>
        {multiplePhoneNumbers && (
          <PhoneNumbersDropdown
            className={cf('phonesDropdown')}
            placeholderText={'Select phone number'}
            phoneNumbers={sortedPhoneNumbers}
            showListOnFocus
            selectedValue={this.state.selectedPhoneNumber}
            onChange={this.onPhoneNumberChanged}
          />
        )}
        <IconButton
          id="makeCallButton"
          disabled={isCallButtonDisabled}
          onClick={() => this.onCallClickHandler()}
          iconName="phone"
          iconStyle="light"
          className={cf(isCallButtonDisabled ? 'callButtonDisabled' : 'callButtonEnabled', { multiplePhoneNumbers })}
        />
      </div>
    );
  }
}
