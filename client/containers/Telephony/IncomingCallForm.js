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
import { t } from 'i18next';
import { getPartyStateToDisplay } from 'helpers/party';
import * as telephonyActions from 'redux/modules/telephony';
import callStates from 'helpers/enums/callStates';
import { setProviderHandlers, reject, answer } from 'helpers/telephonyProvider';
import { updateCommunicationsByCommunicationId } from 'redux/modules/communication';
import ellipsis from 'helpers/ellipsis';
import { Icon, Avatar, Typography, Dialog, DialogActions, Button, DialogOverlay } from 'components';
import { notifyUserAndFocusParentTab, closeNotification } from 'helpers/notifications';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { getLeadScoreIcon } from '../../helpers/leadScore';
import mediator from '../../helpers/mediator';
import { cf } from './IncomingCallForm.scss';
import { logger } from '../../../common/client/logger';

const { SubHeader, Caption } = Typography;

@connect(
  state => ({
    callState: state.telephony.callState,
    incomingCallInfo: state.telephony.contact,
    commId: state.telephony.commId,
    user: state.auth.user,
  }),
  dispatch =>
    bindActionCreators(
      {
        ...telephonyActions,
        updateCommunicationsByCommunicationId,
      },
      dispatch,
    ),
)
export default class IncomingCallForm extends Component {
  static propTypes = {
    callState: PropTypes.string,
    initIncomingCall: PropTypes.func,
    endCallSession: PropTypes.func,
    updateCallStatus: PropTypes.func,
    handleCallAnswered: PropTypes.func,
    handleMicrophoneMuted: PropTypes.func,
    handleCallFailed: PropTypes.func,
    handleIncomingCallCanceled: PropTypes.func,
    handleCurrentCallTerminated: PropTypes.func,
    incomingCallInfo: PropTypes.object,
    commId: PropTypes.string,
    user: PropTypes.object,
  };

  state = {};

  setupCallHandlers = async user => {
    logger.info({ user }, 'setupCallHandlers after login event');
    const {
      updateCallStatus,
      handleCallAnswered,
      handleMicrophoneMuted,
      handleCallFailed,
      initIncomingCall,
      handleIncomingCallCanceled,
      handleCurrentCallTerminated,
      handleLogout,
    } = this.props;

    const handlers = {
      onStatusUpdate: updateCallStatus,
      onCallAnswered: handleCallAnswered,
      onMicrophoneMuted: handleMicrophoneMuted,
      onCallFailed: handleCallFailed,
      onIncomingCall: initIncomingCall,
      onIncomingCallCanceled: handleIncomingCallCanceled,
      onCallTerminated: handleCurrentCallTerminated,
      onLogout: handleLogout,
      onWebrtcNotSupported: () => this.setState({ showNotSupportedWarning: true }),
    };
    if (user && user.sipEndpoints) {
      await setProviderHandlers(handlers);
    } else {
      logger.info({ user }, 'Not setting provider handlers since user does not have SIP endpoints');
    }
  };

  componentDidMount = async () => {
    mediator.one('user:login', async (event, { user }) => {
      logger.info({ event, user }, 'got login event');
      this.setupCallHandlers(user);
    });
    window.addEventListener('beforeunload', this.props.setupWarningAtPageUnload, true);
  };

  componentWillUnmount = () => {
    window.removeEventListener('beforeunload', this.props.setupWarningAtPageUnload, true);
  };

  componentWillReceiveProps(nextProps) {
    if (this.props.callState !== callStates.INCOMING && nextProps.callState === callStates.INCOMING) {
      const { name, type } = this.getNameAndCallType(nextProps.incomingCallInfo);

      const notification = notifyUserAndFocusParentTab(name, { icon: '/reva.png', body: type, requireInteraction: true });
      this.setState({ browserNotification: notification });
    }

    if (this.props.callState === callStates.INCOMING && nextProps.callState !== callStates.INCOMING) {
      closeNotification(this.state.browserNotification);
    }
  }

  callAcceptClickHandler = () => answer();

  callDeclineClickHandler = () => {
    reject();
    this.props.endCallSession();
  };

  renderNotSupportedDialog = () => (
    <Dialog closeOnTapAway={true} open={this.state.showNotSupportedWarning} onCloseRequest={() => this.setState({ showNotSupportedWarning: false })}>
      <DialogOverlay>
        <div className={cf('notSupportedDialog')}>
          <SubHeader>{t('BROWSER_DOESNT_SUPPORT_TELEPHONY')} </SubHeader>
        </div>
        <DialogActions>
          <Button onClick={() => this.setState({ showNotSupportedWarning: false })} label={t('OK_GOT_IT')} type="flat" />
        </DialogActions>
      </DialogOverlay>
    </Dialog>
  );

  getNameAndCallType = info => ({
    name: info.transferredFromName || info.preferredName || getDisplayName(info),
    type: info.transferredFromName ? t('CALL_TRANSFER') : `${t('INCOMING_CALL_FOR')} ${info.targetName}`,
  });

  renderHeader = incomingCallInfo => {
    const { score, fullName, transferredFromName, transferredFromAvatar } = incomingCallInfo;
    const { name, type } = this.getNameAndCallType(incomingCallInfo);

    const avatarProps = transferredFromName
      ? { userName: transferredFromName, src: transferredFromAvatar }
      : { userName: fullName, badgeIcon: getLeadScoreIcon(score), badgeIconStyle: { fill: '#fff' } };

    return (
      <div className={cf('callInfo')}>
        <Avatar {...avatarProps} />
        <div className={cf('name')}>
          <SubHeader lighter>{name}</SubHeader>
          <Caption lighter>{type}</Caption>
        </div>
      </div>
    );
  };

  render = () => {
    const { incomingCallInfo, callState, user } = this.props;

    if (callState !== callStates.INCOMING) {
      this.renderNotSupportedDialog();
      return <noscript />;
    }

    const { propertyName, programName, score, state, units, owner, transferredFromName, ...rest } = incomingCallInfo;
    const partyState = getPartyStateToDisplay(state);

    const displayName = getDisplayName(rest);
    const shouldDisplayOwner = !transferredFromName && owner && owner !== user.fullName;
    const { fullName } = rest;

    return (
      <div>
        {this.renderNotSupportedDialog()}
        <div className={cf('mainContainerStyle')}>
          {shouldDisplayOwner && (
            <div className={cf('owner')}>
              <Caption lighter>{owner}</Caption>
            </div>
          )}
          {this.renderHeader(incomingCallInfo)}
          <div className={cf('callerDetails')}>
            <Caption lighter>{fullName || displayName}</Caption>
            <Caption lighter>{partyState}</Caption>
            {propertyName && <Caption lighter>{ellipsis(propertyName, 90)}</Caption>}
            <Caption lighter>{ellipsis((units || []).join(', '), 90)}</Caption>
            {programName && <Caption lighter>{ellipsis(programName, 90)}</Caption>}
          </div>
          <div className={cf('callActions')}>
            <div className={cf('declineButton')} onClick={() => this.callDeclineClickHandler()}>
              <Icon name="phone-hangup" />
              <span>{t('DECLINE')}</span>
            </div>
            <div className={cf('acceptButton')} onClick={() => this.callAcceptClickHandler()}>
              <Icon name="phone" />
              <span>{t('ACCEPT')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };
}
