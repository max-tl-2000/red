/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { initOutgoingCall } from 'redux/modules/telephony';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { closeFlyout } from 'redux/modules/flyoutStore';
import { createSelector } from 'reselect';
import { hasPhonesOutsideTheApp } from 'helpers/telephony';
import ContactsSearchForm from 'custom-components/SearchForm/ContactsSearchForm';

import { Typography } from 'components';

import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import CallSourceSelector from './CallSourceSelector';
import { cf } from './NewCallFlyOut.scss';
import { logger } from '../../../common/client/logger';

const { SubHeader } = Typography;

const userSelector = createSelector(
  s => s.globalStore.get('users'),
  s => s.auth.user.id,
  (users, userId) => users.get(userId),
);

@connect(
  state => ({
    user: userSelector(state),
    isAuthUserBusy: state.usersStore.isAuthUserBusy,
  }),
  (dispatch, props) =>
    bindActionCreators(
      {
        close: () => closeFlyout(props.flyoutId),
        initOutgoingCall,
      },
      dispatch,
    ),
)
export default class NewCallFlyOut extends Component {
  static propTypes = {
    user: PropTypes.object.isRequired,
    initOutgoingCall: PropTypes.func.isRequired,
    close: PropTypes.func.isRequired,
    flyoutId: PropTypes.string,
    partyId: PropTypes.string,
    callContacts: PropTypes.array,
  };

  initCallToContact = ({ item: contact }) => {
    if (!contact) {
      logger.warn('Unable to initialize call to unknown contact.');
      return;
    }

    this.props.initOutgoingCall({
      fullName: contact.fullName,
      phone: contact.unformattedPhone,
      personId: contact.personId,
      partyId: this.props.partyId,
    });

    this.props.close();
  };

  render() {
    const { flyoutId, callContacts, user, isAuthUserBusy } = this.props;

    return (
      <DockedFlyOut windowIconName="phone" flyoutId={flyoutId} title={<SubHeader lighter>{t('NEW_CALL')}</SubHeader>}>
        <div className={cf('container')}>
          {(hasPhonesOutsideTheApp(user) && <CallSourceSelector user={user} />) || <noscript />}
          <ContactsSearchForm contacts={callContacts} onContactSelected={contact => !isAuthUserBusy && this.initCallToContact(contact)} />
        </div>
      </DockedFlyOut>
    );
  }
}
