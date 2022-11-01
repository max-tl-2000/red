/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { DALTypes } from 'enums/DALTypes';
import { ExpirationScreeningTypes } from 'enums/fadvRequestTypes';
import { observable, action } from 'mobx';
import { observer, Observer, inject } from 'mobx-react';
import { Section, SectionTitle, Typography as T, NotificationBanner, Icon, RedTable, Button } from 'components';
import { t } from 'i18next';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import React, { Component } from 'react';
import capitalize from 'lodash/capitalize';

import { logger } from 'client/logger';
import nullish from '../../../common/helpers/nullish';
import { getCommunications } from '../../redux/selectors/partySelectors';
import { getScreeningExpirationResults } from '../../redux/selectors/screeningSelectors';
import { holdScreening, rerunScreening, forceRescreening, copyPersonApplication, updateShowPastApplications } from '../../redux/modules/partyStore';
import { isPartyApplicationOnHold, getScreeningHoldReasons, getOtherPartiesApplications } from '../../redux/selectors/applicationSelectors';
import { isUserARevaAdmin } from '../../redux/selectors/userSelectors';
import { SHORT_DATE_FORMAT, MONTH_DATE_YEAR_FORMAT, ORDINAL_DAY_3_LETTER_MONTH_FORMAT } from '../../../common/date-constants';
import ApplicationsList from '../ProspectDetailPage/Applications/ApplicationsList';
import DialogModel from './DialogModel';
import HoldApplicationScreeningMenu from '../ProspectDetailPage/Applications/HoldApplicationScreeningMenu';
import RerunScreeningDialog from '../ProspectDetailPage/Applications/RerunScreeningDialog';
import ResumeApplicationScreeningDialog from '../ProspectDetailPage/Applications/ResumeApplicationScreeningDialog';
import ResumeHoldGuarantorLinkedDialog from '../ProspectDetailPage/Applications/ResumeHoldGuarantorLinkedDialog';
import ResumeHoldInternationalAddressDialog from '../ProspectDetailPage/Applications/ResumeHoldInternationalAddressDialog';

import { cf } from './ApplicationAndQuotesWrapper.scss';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import { allMembersAtLeastPaid } from '../../../common/helpers/applicants-utils';
import { isDateInTheCurrentYear } from '../../../common/helpers/date-utils';

const { Table, Row, RowHeader, Cell } = RedTable;

@connect(
  (state, props) => {
    const screeningExpiration = getScreeningExpirationResults(state, props);

    return {
      partyApplicationIsOnHold: isPartyApplicationOnHold(state, props),
      screeningHoldTypes: getScreeningHoldReasons(state, props),
      screeningExpirationResults: screeningExpiration.results,
      hasExpiredScreenings: screeningExpiration.hasExpiredScreenings,
      communications: getCommunications(state, props),
      showRevaAdminOptions: isUserARevaAdmin(state, props),
      otherPartiesApplications: getOtherPartiesApplications(state, props),
    };
  },
  dispatch =>
    bindActionCreators(
      {
        holdScreening,
        rerunScreening,
        forceRescreening,
        copyPersonApplication,
        updateShowPastApplications,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class ApplicationAndQuotesWrapper extends Component {
  @observable
  rerunScreeningInProgress;

  constructor(props) {
    super(props);
    const dlgResumeApplicationScreening = new DialogModel();
    const dlgResumeHoldInternationalAddress = new DialogModel();
    const dlgResumeHoldGurantorLinked = new DialogModel();
    const dlgRerunScreening = new DialogModel();

    // dialog models are stored in state only to play nice with
    // hot reloading. They are not needed in the state and
    // won't set them again, they are just created at construction time
    this.state = {
      dlgResumeApplicationScreening,
      dlgResumeHoldInternationalAddress,
      dlgResumeHoldGurantorLinked,
      dlgRerunScreening,
      showOtherApplicationsBanner: nullish(props.party?.metadata?.showPastApplicationBanner) ? true : props.party?.metadata?.showPastApplicationBanner,
    };
  }

  get dlgResumeApplicationScreening() {
    return this.state.dlgResumeApplicationScreening;
  }

  get dlgResumeHoldInternationalAddress() {
    return this.state.dlgResumeHoldInternationalAddress;
  }

  get dlgResumeHoldGurantorLinked() {
    return this.state.dlgResumeHoldGurantorLinked;
  }

  get dlgRerunScreening() {
    return this.state.dlgRerunScreening;
  }

  handleManualHoldType = isHeld => this.props.holdScreening(this.props.party.id, DALTypes.HoldReasonTypes.MANUAL, isHeld);

  handleResumeHoldManualDialog = ({ source }, open) => {
    const { dlgResumeApplicationScreening } = this;
    dlgResumeApplicationScreening.setOpen(open);

    if (open || source === 'escKeyPress') return;

    this.handleManualHoldType(false);
  };

  handleResumeHoldInternationalDialog = open => {
    const { dlgResumeHoldInternationalAddress } = this;
    dlgResumeHoldInternationalAddress.setOpen(open);
  };

  handleResumeHoldGuarantorLinkedDialog = open => {
    const { dlgResumeHoldGurantorLinked } = this;
    dlgResumeHoldGurantorLinked.setOpen(open);
  };

  handleOpenRerunScreening = () => {
    const { dlgRerunScreening } = this;
    dlgRerunScreening.open();
  };

  handleForceRescreening = requestType => this.props.forceRescreening(this.props.party.id, requestType);

  showHiddenPastApplications = (showApplications = true) => {
    const { props } = this;
    const partyId = (props.party || {}).id;
    props.updateShowPastApplications(partyId, showApplications);
    this.setState({ showOtherApplicationsBanner: showApplications });
  };

  @action
  handleRerunScreening = () => {
    const { props } = this;
    const partyId = (props.party || {}).id;
    if (!partyId) {
      logger.error('Undefined partyId for screening Rerun');
      return;
    }

    props.rerunScreening(partyId);
    this.rerunScreeningInProgress = true;
  };

  displayExpirationScreeningMessage = (screening = {}) => {
    const { timezone } = this.props;
    const { expirationScreeningType = ExpirationScreeningTypes.NONE, screeningExpirationDate } = screening;

    if (expirationScreeningType === ExpirationScreeningTypes.NONE) return '';

    const expirationDate = toMoment(screeningExpirationDate, { timezone });
    const dateFormat = isDateInTheCurrentYear(expirationDate, timezone) ? SHORT_DATE_FORMAT : MONTH_DATE_YEAR_FORMAT;
    if (expirationScreeningType === ExpirationScreeningTypes.EXPIRED) {
      return (
        <T.Text inline error className={cf('st-helper-text')}>
          {t('SCREENING_RESULTS_EXPIRED', {
            date: expirationDate.format(dateFormat),
          })}
        </T.Text>
      );
    }

    return (
      <T.Text inline error className={cf('st-helper-text')}>
        {t('SCREENING_RESULTS_WILL_EXPIRE', {
          date: expirationDate.format(dateFormat),
        })}
      </T.Text>
    );
  };

  getHoldApplicationMessage = screeningHoldTypes => {
    const message = [];
    if (screeningHoldTypes.isManualHoldType) message.push(t('MANUAL_HOLD_WARNING_MESSAGE'));
    if (screeningHoldTypes.isInternationalHoldType) message.push(t('INTERNATIONAL_HOLD_WARNING_MESSAGE'));
    if (screeningHoldTypes.isGuarantorLinkedHoldType) message.push(t('GUARANTOR_LINK_HOLD_WARNING_MESSAGE'));

    return (
      <T.Text error data-id="messageHoldTypes">
        {`${t('APPLICATION_SCREENING_ON_HOLD')} ${message.join(', ')}`}
        {'  '}
        <T.Link
          style={{ marginLeft: '1rem' }}
          noDefaultColor
          underline
          rel="noopener noreferrer"
          target="_blank"
          href="https://reva.zendesk.com/hc/en-us/articles/115003678753">
          {t('LEARN_MORE')}
        </T.Link>
      </T.Text>
    );
  };

  getScreeningExpirationDays = screeningExpirationResults => {
    const { hasExpiredScreenings, timezone } = this.props;
    if (!hasExpiredScreenings) return 0;
    const { screeningCreatedAt } = screeningExpirationResults;
    return now({ timezone }).diff(toMoment(screeningCreatedAt, { timezone }), 'days');
  };

  handleOpenManageParty = () => {
    const { openManagePartyRequest } = this.props;
    openManagePartyRequest && openManagePartyRequest();
  };

  renderOtherPartiesApplicationsRows = (applications, { timezone, currentPartyId }) =>
    applications.map(application => {
      const { created_at, applicantName, partyId } = application;
      return (
        <Row className={cf('application-row')} data-component="other-application-list-row" data-id={application.id} key={`row-${application.id}`}>
          <Cell textAlign="left">{applicantName}</Cell>
          <Cell textAlign="left">{toMoment(created_at, { timezone }).format(ORDINAL_DAY_3_LETTER_MONTH_FORMAT)}</Cell>
          <div className={cf('application-action-cell')}>
            <Button
              label={t('VIEW_PARTY').toUpperCase()}
              className={cf('link', 'secondary', 'shrink-button')}
              type="flat"
              btnRole="secondary"
              onClick={() => this.props.leasingNavigator.navigateToParty(partyId)}
            />
          </div>
          <div className={cf('application-action-cell')}>
            <Button
              label={t('MOVE_APPLICATION').toUpperCase()}
              className={cf('link')}
              type="flat"
              btnRole="primary"
              onClick={() => this.props.copyPersonApplication(application, currentPartyId)}
            />
          </div>
        </Row>
      );
    });

  render() {
    const { props } = this;
    const {
      partyMembers,
      partyIsCorporate,
      party,
      propertiesAssignedToParty,
      communications,
      screeningHoldTypes,
      screeningSummary,
      hasExpiredScreenings,
      screeningExpirationResults,
      partyApplicationIsOnHold,
      showRevaAdminOptions,
      partyIsRenewal,
      partyId,
      timezone,
      otherPartiesApplications,
    } = props;
    const { showOtherApplicationsBanner } = this.state;
    const { metadata: { showPastApplicationBanner } = {} } = party;
    const expiredDays = this.getScreeningExpirationDays(screeningExpirationResults);
    const disableReRunScreening = this.rerunScreeningInProgress || !hasExpiredScreenings || !allMembersAtLeastPaid(partyMembers);
    return (
      <div>
        <Section
          data-id="applicationsAndQuotesSection"
          className={cf({ 'hidden-application': partyIsCorporate || partyIsRenewal })}
          padContent={false}
          title={
            <div>
              <SectionTitle
                className={cf('no-margin-bottom')}
                actionItems={
                  !partyIsCorporate &&
                  !partyIsRenewal && (
                    <Observer>
                      {() => (
                        <HoldApplicationScreeningMenu
                          screeningHoldTypes={screeningHoldTypes}
                          hasApplicationScreeningStarted={!!screeningSummary.hasApplicationScreeningStarted}
                          onExecuteHoldManual={() => this.handleManualHoldType(true)}
                          onResumeHoldManual={e => this.handleResumeHoldManualDialog(e, true)}
                          onResumeHoldInternational={() => this.handleResumeHoldInternationalDialog(true)}
                          onResumeHoldGuarantorLinked={() => this.handleResumeHoldGuarantorLinkedDialog(true)}
                          onRerunScreening={this.handleOpenRerunScreening}
                          onForceRescreening={this.handleForceRescreening}
                          onShowApplications={() => this.showHiddenPastApplications(true)}
                          showApplicationsMenuItem={!nullish(showPastApplicationBanner) && !!otherPartiesApplications?.size}
                          disableShowPastApplications={showOtherApplicationsBanner}
                          showRevaAdminOptions={showRevaAdminOptions}
                          disableReRunScreening={disableReRunScreening}
                        />
                      )}
                    </Observer>
                  )
                }>
                <T.Text bold inline>
                  {t('APPLICATIONS_AND_QUOTES_TITLE')}
                </T.Text>
                <T.Text inline className={cf('st-helper-text')} secondary id="quantityMembersInTheParty">
                  {`${t('PARTY_MEMBER', { count: partyMembers.size })}`}
                </T.Text>
                {!this.rerunScreeningInProgress && this.displayExpirationScreeningMessage(screeningExpirationResults)}
              </SectionTitle>
              <NotificationBanner
                data-id="holdScreeningNotification"
                contentWrapperStyle={{ padding: '0 12px' }}
                type="warning"
                closeable={false}
                visible={partyApplicationIsOnHold}
                content={this.getHoldApplicationMessage(screeningHoldTypes)}
              />
              {this.state.showOtherApplicationsBanner && !!otherPartiesApplications?.size && (
                <div className={cf('other-applications-banner')}>
                  <div className={cf('applications-warning')}>
                    <Icon name="alert" />
                    <T.Text>{t('OTHER_PARTIES_APPLICATIONS_WARNING')}</T.Text>
                  </div>

                  <Table>
                    <RowHeader>
                      <Cell>{capitalize(t('APPLICANT_NAME_HEADER'))}</Cell>
                      <Cell>{capitalize(t('PREVIOUS_APPLICATION_DATE_HEADER'))}</Cell>
                      <Cell />
                      <Cell />
                    </RowHeader>
                    {this.renderOtherPartiesApplicationsRows(otherPartiesApplications, { timezone, currentPartyId: partyId })}
                  </Table>
                  <Button type="raised" btnRole="secondary" label={t('DISMISS')} onClick={() => this.showHiddenPastApplications(false)} />
                </div>
              )}
            </div>
          }>
          {do {
            if (partyIsCorporate) {
              <EmptyMessage style={{ paddingLeft: '1.5rem' }} message={t('CORPORATE_APPLICATIONS_MESSAGE')} />;
            } else if (partyIsRenewal) {
              <EmptyMessage style={{ paddingLeft: '1.5rem' }} message={t('RENEWAL_APPLICATIONS_MESSAGE')} />;
            } else {
              <ApplicationsList
                party={party}
                partyMembers={partyMembers}
                communications={communications}
                propertiesAssignedToParty={propertiesAssignedToParty}
                partyIsCorporate={partyIsCorporate}
                showRevaAdminOptions={showRevaAdminOptions}
              />;
            }
          }}
        </Section>
        <Observer>
          {() => (
            <ResumeApplicationScreeningDialog open={this.dlgResumeApplicationScreening.isOpen} closeDialog={e => this.handleResumeHoldManualDialog(e, false)} />
          )}
        </Observer>
        <Observer>
          {() => (
            <ResumeHoldInternationalAddressDialog
              open={this.dlgResumeHoldInternationalAddress.isOpen}
              partyMembers={partyMembers}
              closeDialog={() => this.handleResumeHoldInternationalDialog(false)}
            />
          )}
        </Observer>
        <Observer>
          {() => (
            <ResumeHoldGuarantorLinkedDialog
              open={this.dlgResumeHoldGurantorLinked.isOpen}
              partyMembers={partyMembers}
              onOKClick={this.handleOpenManageParty}
              closeDialog={() => this.handleResumeHoldGuarantorLinkedDialog(false)}
            />
          )}
        </Observer>
        <Observer>
          {() => (
            <RerunScreeningDialog
              open={this.dlgRerunScreening.isOpen}
              onRerunScreening={this.handleRerunScreening}
              closeDialog={this.dlgRerunScreening.close}
              expiredDays={expiredDays}
            />
          )}
        </Observer>
      </div>
    );
  }
}
