/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { SizeAware } from 'components';
import { observable, action } from 'mobx';
import { bindActionCreators } from 'redux';
import { observer } from 'mobx-react';
import Revealer from 'components/Revealer/Revealer';
import { connect } from 'react-redux';

import { getPartyAppointments } from 'redux/selectors/partySelectors';
import { reinitializeProvider } from 'redux/modules/telephony';
import { cf } from './RightPanelContent.scss';
import CommunicationListWrapper from './CommunicationListWrapper';
import Inventory from '../Inventory/Inventory';
import TelephonyErrorBanner from '../Telephony/TelephonyErrorBanner';

@connect(
  (state, props) => ({
    isPlivoConnectionError: state.telephony.isPlivoConnectionError,
    plivoConnectionErrorReason: state.telephony.plivoConnectionErrorReason,
    appointments: getPartyAppointments(state, props),
    currentUser: state.auth.user || {},
  }),
  dispatch =>
    bindActionCreators(
      {
        reinitializeProvider,
      },
      dispatch,
    ),
)
@observer
export default class RightPanelContent extends Component {
  @observable
  breakpoint;

  @action
  updateBreakpoint = ({ breakpoint }) => {
    this.breakpoint = breakpoint;
  };

  onThreadOpened = () => {
    this.threadOpenedAtLeastOnce = true;
  };

  componentDidMount = () => {
    window.addEventListener('online', this.handleConnectionChange);
    window.addEventListener('offline', this.handleConnectionChange);
  };

  componentWillUnmount() {
    window.removeEventListener('online', this.handleConnectionChange);
    window.removeEventListener('offline', this.handleConnectionChange);
  }

  handleConnectionChange = () => {
    const { currentUser } = this.props;
    this.props.reinitializeProvider(currentUser);
  };

  render() {
    const { props } = this;
    const {
      partyId,
      openThreadId,
      model,
      appointments,
      handleQuoteClick,
      openCommFlyOut,
      party,
      properties,
      isPlivoConnectionError,
      plivoConnectionErrorReason,
    } = props;

    return (
      <SizeAware breakpoints={{ small: [0, 320], regular: [321, Infinity] }} onBreakpointChange={this.updateBreakpoint}>
        {isPlivoConnectionError && <TelephonyErrorBanner reason={plivoConnectionErrorReason} />}
        {props.partyStateIsNotContact && (
          <Revealer className={cf('panel')} show={model.isCommListVisible}>
            <CommunicationListWrapper
              openCommFlyOut={openCommFlyOut}
              partyId={partyId}
              openThreadId={this.threadOpenedAtLeastOnce ? undefined : openThreadId}
              onThreadOpened={this.onThreadOpened}
              party={party}
            />
          </Revealer>
        )}
        {props.partyStateIsNotContact && !props.isClosed && (
          <div className={cf('panel revealable', { show: !model.isCommListVisible })}>
            <Inventory layout={this.breakpoint} onQuoteClick={handleQuoteClick} partyAppointments={appointments} partyId={partyId} properties={properties} />
          </div>
        )}
        {!props.partyStateIsNotContact && (
          <CommunicationListWrapper
            openCommFlyOut={openCommFlyOut}
            partyId={partyId}
            openThreadId={this.threadOpenedAtLeastOnce ? undefined : openThreadId}
            onThreadOpened={this.onThreadOpened}
            party={party}
          />
        )}
      </SizeAware>
    );
  }
}
