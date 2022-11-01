/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { formatPhoneNumber } from 'helpers/strings';
import { t } from 'i18next';
import { observer, inject } from 'mobx-react';
import { DALTypes } from 'enums/DALTypes';
import { markAsSpam } from 'redux/modules/partyStore';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import BlockContactDialog from '../Communication/BlockContactDialog';

@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        markAsSpam,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class BlockContactDialogWrapper extends Component {
  handleMarkAsSpam = contact => {
    const { props, canMarkAsSpam } = this;
    const { partyMembers } = props;

    const spamMember = partyMembers.find(m => {
      const cis = m.person.contactInfo.all.filter(c => !c.isSpam);
      if (cis.length !== 1) return false;

      const [ci] = cis;
      return ci.type === contact.type && ci.value === contact.value;
    });

    if (spamMember) props.markAsSpam(spamMember.partyId);

    if (canMarkAsSpam) props.leasingNavigator.navigateToDashboard();
  };

  get canMarkAsSpam() {
    const { party } = this.props;
    if (!party || !party.partyMembers || !party.partyMembers.length) {
      return false;
    }

    return (
      party.state === DALTypes.PartyStateType.CONTACT &&
      party.partyMembers.length === 1 &&
      party.partyMembers[0].contactInfo.all.filter(c => c.value).length === 1
    );
  }

  render() {
    const { party, model } = this.props;
    if (!party || !party.partyMembers || !party.partyMembers.length) {
      return <div />;
    }

    const { contactInfo } = party.partyMembers[0];
    if (!contactInfo.all.length) return <div />;

    const { defaultEmail, defaultPhone } = contactInfo;
    const channel = defaultEmail || formatPhoneNumber(defaultPhone);
    const contact = defaultEmail ? contactInfo.emails[0] : contactInfo.phones[0];

    return (
      <BlockContactDialog
        open={model.isOpen}
        title={t('MARK_AS_SPAM_CONFIRMATION')}
        msgCommunicationFrom={t('FUTURE_COMMUNICATION_FROM')}
        channel={channel}
        onBlockContact={() => this.handleMarkAsSpam(contact)}
        onCloseRequest={model.close}
      />
    );
  }
}
