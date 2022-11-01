/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import * as Bar from 'components/AppBar/AppBarIndex';
import AppBarBack from 'custom-components/AppBar/AppBarBack';
import { t } from 'i18next';
import { Typography as T, Avatar, SizeAware } from 'components';
import { observer } from 'mobx-react';
import { observable, computed, action } from 'mobx';

import CommunicationBox from 'custom-components/CommunicationBox/CommunicationBox';
import ExternalCommunicationBox from 'custom-components/CommunicationBox/ExternalCommunicationBox';
import { NEW_EMAIL, NEW_CALL, SMS_THREAD, WALK_IN } from 'helpers/comm-flyout-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  isPartyArchived,
  isPartyNotActive,
  getPersonsInPartyFlags,
  getPropertyNameForParty,
  getPartyMembers,
  isPartyNotInContactState,
  isRenewalParty,
  isActiveLeaseParty,
  disableCommsForArchivedParty,
} from 'redux/selectors/partySelectors';
import { areNativeCommsEnabled } from 'redux/selectors/userSelectors';
import { markAuthUserAsBusy } from 'redux/modules/usersStore';
import { reopenParty } from 'redux/modules/partyStore';
import { DALTypes } from '../../../common/enums/DALTypes';

import PartyCardMenu from './PartyCardMenu';
import PartyTitle from './PartyTitle';

import PartyStateBar from '../ProspectDetailPage/PartyStateBar';
import { cf } from './PartyAppBar.scss';
@connect(
  (state, props) => ({
    isArchived: isPartyArchived(state, props),
    areCommsDisabled: disableCommsForArchivedParty(state, props),
    isRenewal: isRenewalParty(state, props),
    renewalTransition: state.partyStore.renewalTransition,
    isActiveLease: isActiveLeaseParty(state, props),
    partyNotActive: isPartyNotActive(state, props),
    nativeCommsEnabled: areNativeCommsEnabled(state, props),
    commFlags: getPersonsInPartyFlags(state, props),
    associatedPropertyName: getPropertyNameForParty(state, props),
    partyMembers: getPartyMembers(state, props),
    users: state.globalStore.get('users'),
    notInContactState: isPartyNotInContactState(state, props),
    isUserBusy: state.usersStore.isAuthUserBusy,
    authUser: state.auth.user,
  }),
  dispatch =>
    bindActionCreators(
      {
        reopenParty,
        markAuthUserAsBusy,
      },
      dispatch,
    ),
)
@observer
export default class PartyAppBar extends Component {
  @observable
  commsBreakpoint;

  @computed
  get commsCompactMode() {
    return this.commsBreakpoint === 'small';
  }

  @action
  updateCommBreakpoint = ({ breakpoint }) => {
    this.commsBreakpoint = breakpoint;
  };

  componentWillReceiveProps(nextProps) {
    if (nextProps.users !== this.props.users) {
      const usr = nextProps.users.find(u => u.id === this.props.authUser.id) || {};
      const { metadata } = usr;
      if (metadata && metadata.status === DALTypes.UserStatus.BUSY) {
        this.props.markAuthUserAsBusy();
      }
    }
  }

  handleShowWalkinFlyout = () => {
    const { openCommFlyOut } = this.props;

    openCommFlyOut && openCommFlyOut({ flyoutType: WALK_IN });
  };

  handleReopenParty = partyId => {
    const { props } = this;
    props.reopenParty(partyId);
  };

  isRenewalOrActiveLease = () => {
    const { isRenewal, isActiveLease, party, renewalTransition } = this.props;

    return party ? isRenewal || isActiveLease : renewalTransition;
  };

  renderLoadingBar = () => {
    const { onNavigateBack, partyId, partyLoadingModel, partyLoadingError } = this.props;
    const { loading } = partyLoadingModel;
    const isRenewalOrActiveLeaseParty = this.isRenewalOrActiveLease();

    return (
      <div>
        <AppBarBack onNavigateBack={onNavigateBack} isRenewalOrActiveLeaseParty={isRenewalOrActiveLeaseParty}>
          <Bar.MainSection className={cf('appBarMainSection')}>
            {partyLoadingError && <T.Title lighter className={cf('page-title')}>{`Error loading party "${partyId}"`}</T.Title>}
            {loading && (
              <T.Title lighter className={cf('page-title')}>
                {t('LOADING')}
              </T.Title>
            )}
          </Bar.MainSection>
        </AppBarBack>
      </div>
    );
  };

  render() {
    const { props, commsCompactMode, handleShowWalkinFlyout, updateCommBreakpoint, handleReopenParty } = this;

    const {
      party,
      onNavigateBack,
      partyNotActive,
      nativeCommsEnabled,
      commFlags,
      associatedPropertyName,
      partyMembers,
      partyId,
      onReviewMatchRequest,
      users,
      renderActions,
      notInContactState,
      onPartyTitleClick,
      partyLoadingModel,
      partyLoadingError,
      isCorporateParty,
      isUserBusy,
      timezone,
      openCommFlyOut,
      isActiveLease,
      isRenewal,
      showInventoryAndComms,
      leaseNotExecuted,
      property,
      areCommsDisabled,
    } = props;

    const { loading } = partyLoadingModel;
    const { noMembersHaveEmailAddresses, noMembersHavePhoneNos, atLeastOnePersonHasSMSNos } = commFlags;
    const isRenewalOrActiveLeaseParty = this.isRenewalOrActiveLease();

    if (loading || partyLoadingError) {
      return this.renderLoadingBar();
    }

    return (
      <div>
        <AppBarBack onNavigateBack={onNavigateBack} isRenewalOrActiveLeaseParty={isRenewalOrActiveLeaseParty} className={cf({ closedAppBar: partyNotActive })}>
          {!notInContactState && (
            <Bar.MainSection className={cf('appBarMainSection')}>
              {partyNotActive && <Avatar src="/closed-party.svg" />}
              <T.Title lighter className={cf('page-title')}>
                {party ? t('DASHBOARD_MENU_UPDATE_PARTY') : t('DASHBOARD_MENU_NEW_PARTY')}
              </T.Title>
            </Bar.MainSection>
          )}
          {notInContactState && (
            <Bar.MainSection className={cf('appBarMainSection')}>
              <PartyTitle
                partyMembers={partyMembers}
                partyIsClosed={partyNotActive}
                onPartyTitleClick={onPartyTitleClick}
                isCorporateParty={isCorporateParty}
              />
            </Bar.MainSection>
          )}
          <Bar.Actions className={cf('appBarActions')}>
            <SizeAware breakpoints={{ small: [0, 290], large: [271, Infinity] }} onBreakpointChange={updateCommBreakpoint}>
              <div>
                {nativeCommsEnabled ? (
                  <CommunicationBox
                    iconsStyle="light"
                    noAutoSize={true}
                    compact={commsCompactMode}
                    commBoxClassName={cf('commBox')}
                    callDisabled={areCommsDisabled || noMembersHavePhoneNos || isUserBusy}
                    messageDisabled={areCommsDisabled || !atLeastOnePersonHasSMSNos}
                    mailDisabled={areCommsDisabled || noMembersHaveEmailAddresses}
                    onMessage={() => openCommFlyOut({ flyoutType: SMS_THREAD })}
                    onMail={() =>
                      openCommFlyOut({
                        flyoutType: NEW_EMAIL,
                        props: { associatedProperty: associatedPropertyName },
                      })
                    }
                    onCall={() => openCommFlyOut({ flyoutType: NEW_CALL })}
                  />
                ) : (
                  <ExternalCommunicationBox
                    iconsStyle="light"
                    noAutoSize={true}
                    compact={commsCompactMode}
                    commBoxClassName={cf('commBox')}
                    partyMembers={partyMembers}
                    phoneDisabled={noMembersHavePhoneNos}
                    mailDisabled={noMembersHaveEmailAddresses}
                    onMail={() =>
                      openCommFlyOut({
                        flyoutType: NEW_EMAIL,
                        props: { associatedProperty: associatedPropertyName },
                      })
                    }
                    onContactEvent={handleShowWalkinFlyout}
                  />
                )}
                {showInventoryAndComms && <Bar.ActionDivider />}
                {showInventoryAndComms && renderActions()}
                <PartyCardMenu
                  partyStateIsNotContact={notInContactState}
                  party={party}
                  partyId={partyId}
                  property={property}
                  openCommFlyOut={openCommFlyOut}
                  onReviewMatchRequest={onReviewMatchRequest}
                  onReopenPartyReqeuest={handleReopenParty}
                  isActiveLease={isActiveLease}
                  isRenewal={isRenewal}
                  leaseNotExecuted={leaseNotExecuted}
                  handleMergeParties={this.props.handleMergeParties}
                  partyClosedOrArchived={this.props.partyClosedOrArchived}
                />
              </div>
            </SizeAware>
          </Bar.Actions>
        </AppBarBack>
        {partyNotActive && (
          <PartyStateBar
            party={party}
            users={users}
            onReopenParty={handleReopenParty}
            partyMembers={partyMembers}
            className={cf('partyStateBar')}
            timezone={timezone}
          />
        )}
      </div>
    );
  }
}
