/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { createSelector } from 'reselect';
import elevationShadow from 'helpers/elevationShadow';
import { Button, Typography } from 'components';
import { cf, g } from './PartyStateBar.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { isPartyWithBlockedContact } from '../../helpers/party';
import { toMoment } from '../../../common/helpers/moment-utils';

const { Text } = Typography;

const getAgent = createSelector(
  props => props.users,
  props => props.party,
  (users, party) => users.find(user => user.id === (party.metadata.closeAgentId || party.metadata.archiveAgentId)) || {},
);

@connect((state, props) => ({
  agent: getAgent(props),
}))
export default class PartyStateBar extends Component {
  static propTypes = {
    party: PropTypes.object,
    users: PropTypes.object,
    agent: PropTypes.object,
    onReopenParty: PropTypes.func,
    partyMembers: PropTypes.object,
  };

  handleReopenParty = () => {
    const { party, onReopenParty } = this.props;
    onReopenParty && onReopenParty(party.id);
  };

  render = () => {
    const { party, agent, className, partyMembers, timezone } = this.props;
    const isContactBlocked = isPartyWithBlockedContact(party, partyMembers);
    const isPartyClosed = party.workflowState === DALTypes.WorkflowState.CLOSED;
    const closeDate = toMoment(party.endDate, { timezone }).format('dddd, MMM D');
    const closeReason = t(DALTypes.ClosePartyReasons[party.metadata.closeReasonId]);
    const archiveDate = toMoment(party.archiveDate, { timezone }).format('dddd, MMM D');
    const archiveReason = t(DALTypes.ArchivePartyReasons[party.metadata.archiveReasonId]);

    const overlayStyle = {
      boxShadow: elevationShadow(4),
    };

    return (
      <div style={overlayStyle} className={cf('bar-content', g(className))}>
        <div>
          <Text>
            {t('PARTY_STATE_BAR_SUMMARY', {
              name: agent.preferredName || agent.fullName,
              date: archiveDate || closeDate,
            })}
          </Text>
          <Text secondary>{t('PARTY_STATE_BAR_REASON', { reason: archiveReason || closeReason })}</Text>
        </div>
        {isPartyClosed && <Button type="raised" btnRole="primary" label={t('REOPEN_PARTY')} disabled={isContactBlocked} onClick={this.handleReopenParty} />}
      </div>
    );
  };
}
