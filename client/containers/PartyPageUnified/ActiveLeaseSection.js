/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import React, { Component } from 'react';
import { inject } from 'mobx-react';
import PropTypes from 'prop-types';
import { RedTable, Section, SectionTitle, Typography as T, AutoSize, FormattedMarkdown, MsgBox } from 'components';
import { cf } from './ActiveLeaseSection.scss';
import { toMoment } from '../../../common/helpers/moment-utils';
import { renderFullQualifiedName } from '../Inventory/InventoryHelper';
import { DATE_US_FORMAT } from '../../../common/date-constants';
import { toSentenceCase } from '../../helpers/capitalize';
import Button from '../../components/Button/Button';
import { ActiveLeaseSectionMenu } from './ActiveLeaseSectionMenu';
import RenewalDialog from './RenewalDialog';
import DialogModel from './DialogModel';
import { DALTypes } from '../../../common/enums/DALTypes';
import { vacateReasonTranslationMapping } from '../../../common/enums/vacateReasons';
import { getShortFormatRentableItem } from '../../../common/helpers/quotes';

const { Table, Row, RowHeader, Cell, Money, TextPrimary } = RedTable;

@inject('leasingNavigator')
export default class ActiveLeaseSection extends Component {
  static propTypes = {
    activeLeaseWorkflowData: PropTypes.object,
    timezone: PropTypes.string,
    isActiveLeaseParty: PropTypes.bool,
    startManualRenewal: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      renewalDialogModel: new DialogModel(),
      isEvictionDialogOpened: false,
    };
  }

  closeIsEvictionDialog = () => {
    this.setState({ isEvictionDialogOpened: false });
  };

  renderRow = ({ lease, isSmall }) => {
    const { timezone } = this.props;
    const { inventory, unitRent = '', inventoryType = '', leaseStartDate = '', computedExtensionEndDate = '', leaseEndDate = '', leaseTerm = '' } = lease;
    const endDate = computedExtensionEndDate || leaseEndDate;
    const unitName = getShortFormatRentableItem(inventory);

    return (
      <Row
        data-component="active-leases-list-row"
        id={`row${unitName}`}
        data-id={'rowLease'}
        key={`row-${lease.inventoryId}`}
        className={cf('lease-row', 'row-header-custom')}>
        <Cell noSidePadding className={cf('text-cell')} textAlign="left" style={{ minWidth: isSmall ? 100 : 140 }}>
          {renderFullQualifiedName(unitName)}
        </Cell>
        <Cell noPaddingLeft width={isSmall ? 80 : 120}>
          <TextPrimary> {toSentenceCase(inventoryType)} </TextPrimary>
        </Cell>
        <Cell noSidePadding textAlign="center" width={isSmall ? 80 : 120}>
          <TextPrimary> {leaseStartDate && toMoment(leaseStartDate, { timezone }).format(DATE_US_FORMAT)} </TextPrimary>
        </Cell>
        <Cell noSidePadding textAlign="center" width={isSmall ? 80 : 120}>
          <TextPrimary>{endDate && toMoment(endDate, { timezone }).format(DATE_US_FORMAT)}</TextPrimary>
        </Cell>
        <Cell noSidePadding textAlign="center" width={isSmall ? 80 : 120}>
          {leaseTerm && (
            <div>
              <TextPrimary inline>{leaseTerm}</TextPrimary>
              <T.Text secondary inline>
                {leaseTerm.toString() === '1' ? t('MONTH') : t('MONTHS')}
              </T.Text>
            </div>
          )}
        </Cell>
        <Cell noPaddingLeft textAlign="center" width={isSmall ? 80 : 120}>
          <Money amount={unitRent} currency="USD" />
        </Cell>
      </Row>
    );
  };

  isEviction = activeLeaseWorkflowData => !!activeLeaseWorkflowData.metadata?.isUnderEviction;

  isMovingOut = activeLeaseWorkflowData => activeLeaseWorkflowData?.state === DALTypes.ActiveLeaseState.MOVING_OUT;

  handleManualRenewal = () => {
    const { activeLeaseWorkflowData } = this.props;
    const { renewalDialogModel } = this.state;

    if (this.isEviction(activeLeaseWorkflowData)) {
      this.setState({ isEvictionDialogOpened: true });
      return;
    }
    renewalDialogModel.open();
  };

  goToRenewalParty = () => {
    const { renewalPartyId, leasingNavigator, setRenewalTransition } = this.props;
    setRenewalTransition && setRenewalTransition();
    leasingNavigator.navigateToParty(renewalPartyId);
  };

  shouldShowRenewalButton = () => {
    const { activeLeaseWorkflowData, isActiveLeaseParty, renewalPartyId, renewalsFeatureOn } = this.props;
    const { currentLeaseStatus, metadata: { vacateDate } = {} } = activeLeaseWorkflowData || {};

    if (currentLeaseStatus && currentLeaseStatus !== DALTypes.LeaseStatus.EXECUTED) return false;

    return renewalsFeatureOn && isActiveLeaseParty && !renewalPartyId && !vacateDate;
  };

  getMoveOutMessage = (moveOutReason, formattedVacateDate) =>
    moveOutReason
      ? t('MOVING_OUT_SERVED_BY_MRI', { vacateDate: formattedVacateDate, vacateReason: t(moveOutReason) })
      : t('MOVING_OUT_SERVED_BY_MRI_WITHOUT_REASON', { vacateDate: formattedVacateDate });

  getIsEvictionMessage = formattedVacateDate =>
    formattedVacateDate ? t('EVICTED_PARTY_WITH_VACATE_DATE', { vacateDate: formattedVacateDate }) : t('EVICTED_PARTY_WITHOUT_VACATE_DATE');

  getMovingOutTitleText = activeLeaseWorkflowData => {
    const movingOutText = ` - ${t('MOVING_OUT')}`;
    const isEvictionText = ` - ${t('UNDER_EVICTION')}`;

    return this.isEviction(activeLeaseWorkflowData) ? isEvictionText : movingOutText;
  };

  render() {
    const {
      activeLeaseWorkflowData,
      isActiveLeaseParty,
      startManualRenewal,
      partyId,
      renewalPartyId,
      partyIsRenewal,
      residentDataImportOn,
      timezone,
      seedPartyId,
      currentUser,
      seedPartyWorkflowName,
    } = this.props;
    const { renewalDialogModel, isEvictionDialogOpened } = this.state;
    const {
      leaseData: lease,
      currentLeaseStatus,
      leaseId,
      metadata: { vacateDate, notes, moveInConfirmed = false } = {},
      partyId: activeLeasePartyId,
      hasDigitallySignedDocument,
    } = activeLeaseWorkflowData || {};
    const formattedVacateDate = vacateDate && toMoment(vacateDate, { timezone }).format(DATE_US_FORMAT);
    const moveOutReason = notes && vacateReasonTranslationMapping[notes];

    if (!lease) return <noscript />;

    const showRenewalButton = this.shouldShowRenewalButton();

    return (
      <Section
        data-id="activeLeasesSection"
        title={
          <SectionTitle
            className={cf('no-margin-bottom')}
            actionItems={
              <div className={cf('active-lease-action-items')}>
                {showRenewalButton && (
                  <Button data-id="renewManuallyBtn" label={t('RENEW_MANUALLY')} type="flat" btnRole="primary" onClick={this.handleManualRenewal} />
                )}
                {isActiveLeaseParty && renewalPartyId && (
                  <Button data-id="goToRenewalBtn" label={t('GO_TO_RENEWAL')} type="flat" btnRole="primary" onClick={this.goToRenewalParty} />
                )}
                <ActiveLeaseSectionMenu
                  leaseId={leaseId}
                  moveInConfirmed={moveInConfirmed}
                  seedPartyId={seedPartyId}
                  vacateDate={vacateDate}
                  currentLeaseStatus={currentLeaseStatus}
                  currentUser={currentUser}
                  seedPartyWorkflowName={seedPartyWorkflowName}
                  partyIsRenewal={partyIsRenewal}
                  hasDigitallySignedDocument={hasDigitallySignedDocument}
                  residentDataImportOn={residentDataImportOn}
                  activeLeasePartyId={activeLeasePartyId}
                />
              </div>
            }>
            <T.Text bold inline>
              {t('ACTIVE_LEASES_SECTION_TITLE')}
              {this.isMovingOut(activeLeaseWorkflowData) && isActiveLeaseParty ? this.getMovingOutTitleText(activeLeaseWorkflowData) : ''}
            </T.Text>
            <T.Text inline secondary className={cf('st-helper-text')} id="quantityActiveLeases">
              {t('NO_OF_UNITS', { count: 1 })}
            </T.Text>
          </SectionTitle>
        }>
        {isActiveLeaseParty && <RenewalDialog model={renewalDialogModel} startManualRenewal={startManualRenewal} partyId={partyId} />}
        {isActiveLeaseParty && isEvictionDialogOpened && (
          <MsgBox
            open={isEvictionDialogOpened}
            closeOnTapAway={false}
            lblOK={t('I_UNDERSTAND')}
            lblCancel=""
            onOKClick={() => this.closeIsEvictionDialog()}
            onCloseRequest={() => this.closeIsEvictionDialog()}
            title={t('CANNOT_CREATE_RENEWAL')}>
            <T.Text>{t('CANNOT_CREATE_RENEWAL_EVICTION_REASON')}</T.Text>
          </MsgBox>
        )}
        {isActiveLeaseParty && this.isMovingOut(activeLeaseWorkflowData) && (
          <FormattedMarkdown className={cf('label')}>
            {this.isEviction(activeLeaseWorkflowData)
              ? this.getIsEvictionMessage(formattedVacateDate)
              : this.getMoveOutMessage(moveOutReason, formattedVacateDate)}
          </FormattedMarkdown>
        )}
        <div data-component="quote-list">
          <AutoSize breakpoints={{ small: [0, 650], large: [651, Infinity] }}>
            {({ breakpoint }) => {
              const isSmall = breakpoint === 'small';
              return (
                <Table>
                  <RowHeader className={cf('row-header-custom')}>
                    <Cell noSidePadding textAlign="left" style={{ minWidth: isSmall ? 100 : 140 }}>
                      <T.Caption> {t('ACTIVE_LEASE_TABLE_COLUMN_ITEM_NAME')} </T.Caption>
                    </Cell>
                    <Cell noPaddingLeft width={isSmall ? 80 : 120}>
                      <T.Caption> {t('ACTIVE_LEASE_TABLE_COLUMN_ITEM_TYPE')} </T.Caption>
                    </Cell>
                    <Cell noSidePadding textAlign="center" width={isSmall ? 80 : 120}>
                      <T.Caption>{t('LEASE_START')} </T.Caption>
                    </Cell>
                    <Cell noSidePadding textAlign="center" width={isSmall ? 80 : 120}>
                      <T.Caption> {t('LEASE_END')} </T.Caption>
                    </Cell>
                    <Cell noSidePadding textAlign="center" width={isSmall ? 80 : 120}>
                      <T.Caption>{t('ACTIVE_LEASE_TABLE_COLUMN_LEASE_TERM')} </T.Caption>
                    </Cell>
                    <Cell noPaddingLeft textAlign="center" width={isSmall ? 80 : 120}>
                      <T.Caption>{t('BASE_RENT')} </T.Caption>
                    </Cell>
                  </RowHeader>
                  {this.renderRow({
                    lease,
                    isSmall,
                  })}
                </Table>
              );
            }}
          </AutoSize>
        </div>
      </Section>
    );
  }
}
