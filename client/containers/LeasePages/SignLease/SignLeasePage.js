/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { createSelector } from 'reselect';
import { t } from 'i18next';
import { loadPartyDetailsData } from 'redux/modules/appDataLoadingActions';
import { Typography, CheckBox, Button } from 'components';
import { windowOpen } from '../../../helpers/win-open';
import { emailLease } from '../../../redux/modules/leaseStore';
import { getPartyFilterSelector } from '../../../redux/selectors/userSelectors';
import { setPartyFilter } from '../../../redux/modules/dataStore';
import { LeasePage } from '../LeasePage';
import { logger } from '../../../../common/client/logger';
import { cf } from './SignLeasePage.scss';

const { SubHeader } = Typography;

const getPartyMember = createSelector(
  s => s.dataStore.get('members'),
  s => s.dataStore.get('persons'),
  (s, props) => props.params.partyMemberId,
  (members, persons, partyMemberId) => {
    const pm = members.find(p => p.id === partyMemberId);
    return pm ? { ...pm, person: persons.get(pm.personId) } : {};
  },
);

const getLease = createSelector(
  s => s.dataStore.get('leases'),
  (s, props) => props.params.leaseId,
  (leases, leaseId) => leases.find(lease => lease.id === leaseId),
);

@connect(
  (state, props) => ({
    partyMember: getPartyMember(state, props),
    lease: getLease(state, props),
    partyFilter: getPartyFilterSelector(state),
  }),
  dispatch =>
    bindActionCreators(
      {
        loadPartyDetailsData,
        emailLease,
        setPartyFilter,
      },
      dispatch,
    ),
)
export default class SignLeasePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      identityConfirmed: false,
    };
  }

  componentWillMount() {
    const { partyId, partyMemberId } = this.props.params;
    if (!partyMemberId) throw new Error('no partyMember passed!');
    if (partyId) {
      const { partyFilter } = this.props;
      this.props.setPartyFilter(partyFilter);
      this.props.loadPartyDetailsData(partyId, { silentOnly: false });
    }
  }

  toggleIdentityConfirmed = () => this.setState({ identityConfirmed: !this.state.identityConfirmed });

  openInSameTab = () => {
    if (!this.props.lease) {
      logger.warn({ leaseId: this.props.params.leaseId }, 'Lease not found');
      return;
    }

    const signature = this.props.lease.signatures.find(s => s.partyMemberId === this.props.params.partyMemberId);

    const { propertyName } = this.props.lease?.baselineData?.quote || {};
    windowOpen(signature.signUrl.concat(`?inOfficeSignature=true&propertyName=${propertyName}`), '_self');
  };

  sendSignLeaseMail = () => {
    const { id: leaseId, partyId } = this.props.lease;
    this.props.emailLease(partyId, leaseId, [this.props.params.partyMemberId]);
  };

  renderHeader = (fullName, fullNameId) => (
    <div className={cf('margin-bottom')}>
      <SubHeader inline bold id={`${fullNameId}`}>
        {`${fullName}'s `}
      </SubHeader>
      <SubHeader inline>{t('LEASE_IN_OFFICE_SIGN_VERSION')}</SubHeader>
    </div>
  );

  render = () => {
    const { partyMember, lease } = this.props;
    if (!partyMember) return <div>No party member found!</div>;
    const { propertyName } = lease?.baselineData?.quote || {};

    const fullName = partyMember.person ? partyMember.person.fullName : '';
    const fullNameId = fullName.replace(/\s/g, '_');
    return (
      <LeasePage data-id="sign-lease-page" propertyName={propertyName}>
        {this.renderHeader(fullName, fullNameId)}
        <img className={cf('margin-bottom')} src="/images/ig-lease-signing.svg" />
        <CheckBox
          id="signLeaseCheckbox"
          label={t('LEASE_IN_OFFICE_SIGN_CONFIRMATION')}
          checked={this.state.toggleIdentityConfirmed}
          onChange={this.toggleIdentityConfirmed}
          className={cf('margin-bottom')}
        />
        <Button
          id="startSignatureBtn"
          type="raised"
          btnRole="primary"
          label={t('LEASE_IN_OFFICE_SIGN_START_SIGNATURE')}
          disabled={!this.state.identityConfirmed}
          onClick={this.openInSameTab}
        />
        <Button type="flat" btnRole="primary" id="sendSignatureBtn" label={t('LEASE_IN_OFFICE_SIGN_SEND_EMAIL')} onClick={this.sendSignLeaseMail} />
      </LeasePage>
    );
  };
}
