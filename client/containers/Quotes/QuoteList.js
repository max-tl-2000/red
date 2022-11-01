/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import { t } from 'i18next';
import { RedTable, AutoSize, PreloaderBlock, Tag, CardMenu, CardMenuItem, RedList, Button, Status } from 'components';
import { getQuoteStatusForQuoteList, isQuoteExpired, getInventoryHoldStatus, getUnitDepositAmount } from 'helpers/quotes';
import { getScreeningForParty, promoteQuote, deleteQuote, fetchQuote } from 'redux/modules/quotes';
import { setInventoryOnHold, releaseInventory, loadInventoryDetails } from 'redux/modules/inventoryStore';
import { createSelector } from 'reselect';
import { observer, inject } from 'mobx-react';
import get from 'lodash/get';
import debounce from 'debouncy';
import { DALTypes } from '../../../common/enums/DALTypes';
import LeaseTermSelectorDialog from './Promotion/LeaseTermSelectorDialog';
import MissingNamesDialog from './Promotion/MissingNamesDialog';
import { cf } from './QuoteList.scss';
import { PromoteActionType } from '../../helpers/screening';
import { renderFullQualifiedName } from '../Inventory/InventoryHelper';
import { canMemberBeInvitedToApply } from '../../../common/helpers/quotes';
import { areAllGuarantorsLinkedWhenNeeded } from '../../../common/helpers/applicants-utils';
import { isInventoryLeasedOnPartyType, createInventoryUnavailableDialogModel } from '../../../common/helpers/inventory';
import { DATE_US_FORMAT } from '../../../common/date-constants';
import LeasedUnitDialog from '../ProspectDetailPage/LeasedUnitDialog';
import { InventoryHoldingWarningDialog } from './InventoryHoldingWarningDialog';
import {
  isCorporateParty as isCorporatePartyFunc,
  getMissingNamesOnPartyMember,
  getDisplayNameOfPartyMemberMissingLegalName,
  hasActiveQuotePromotion,
  isResident,
} from '../../../common/helpers/party-utils';
import DemoteDialog from '../ProspectDetailPage/Applications/DemoteDialog';
import { ApprovalDialog } from '../ApplicationSummary/Dialog/ApprovalDialog';
import { toSentenceCase } from '../../helpers/capitalize';
import { QuoteState } from '../../../common/enums/quoteTypes';
import { getParty } from '../../redux/selectors/partySelectors';
import { toMoment } from '../../../common/helpers/moment-utils';
import { renderApplicationStatusIcon } from '../../helpers/quotesTable';
import { areAllApplicationsCompleted } from '../../redux/selectors/applicationSelectors';
import { getQuoteListModel } from '../../redux/selectors/quoteSelectors';
import { formatMoney } from '../../../common/money-formatter';

const { Divider } = RedList;

const { Table, Row, RowHeader, Cell, TextSecondary, TextPrimary } = RedTable;

const getCurrentUser = state => state.globalStore.get('users').get((state.auth.user || {}).id);

const showApproveColumnFunc = ({ screeningRequired, canReviewApplication, quotePromotions }) =>
  !screeningRequired &&
  canReviewApplication &&
  quotePromotions.some(quotePromotion => quotePromotion.promotionStatus === DALTypes.PromotionStatus.PENDING_APPROVAL);

const corporateParty = createSelector(getParty, party => isCorporatePartyFunc(party));

const getLeases = createSelector(
  state => state.dataStore.get('leases'),
  (state, props) => props.partyId,
  (leases, partyId) => (leases || []).filter(item => item.partyId === partyId),
);

const getPartyMembersWithMissingNames = createSelector(
  (state, props) => getParty(state, props),
  state => state.dataStore.get('persons'),
  (party, persons) => {
    const partyIsCorporate = isCorporatePartyFunc(party);

    const hasMissingNamesOnPartyMember = ({ personId, memberType, displayName }) =>
      getMissingNamesOnPartyMember({ ...persons.get(personId), memberType, companyName: displayName }, partyIsCorporate).length > 0;

    return (party.partyMembers || []).filter(hasMissingNamesOnPartyMember).map(pm => ({
      ...pm,
      displayName: getDisplayNameOfPartyMemberMissingLegalName(pm),
      missingFields: getMissingNamesOnPartyMember({ ...persons.get(pm.personId), memberType: pm.memberType, displayName: pm.displayName }, partyIsCorporate),
    }));
  },
);

@connect(
  (state, props) => ({
    user: getCurrentUser(state),
    quotes: state.quotes.quotes,
    loading: state.quotes.loading,
    quote: state.quotes.quote,
    inventory: state.inventoryStore.inventory,
    screeningSummary: state.quotes.screeningSummary,
    party: getParty(state, props),
    leases: getLeases(state, props),
    isCorporateParty: corporateParty(state, props),
    quoteListModel: getQuoteListModel(state, props),
    partyMembersWithMissingNames: getPartyMembersWithMissingNames(state, props),
    areAllPartyApplicationsCompleted: areAllApplicationsCompleted(state, props),
    hasActivePromotion: hasActiveQuotePromotion(props.quotePromotions, props.partyId),
    hasQuotePromotedWithRequiresWork: (props.quotePromotions || []).some(
      promotedQuote => promotedQuote.promotionStatus === DALTypes.PromotionStatus.REQUIRES_WORK,
    ),
    isOngoingInventoryHold: state.inventoryStore.isOngoingInventoryHold,
  }),
  dispatch =>
    bindActionCreators(
      {
        getScreeningForParty,
        promoteQuote,
        deleteQuote,
        setInventoryOnHold,
        releaseInventory,
        loadInventoryDetails,
        fetchQuote,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class QuoteList extends Component {
  static propTypes = {
    user: PropTypes.object,
    partyId: PropTypes.string,
    party: PropTypes.object,
    quotes: PropTypes.array,
    loading: PropTypes.bool,
    onRowTap: PropTypes.func,
    allApplicationsCompleted: PropTypes.bool,
    members: PropTypes.object,
    promoteQuote: PropTypes.func,
    openNewLease: PropTypes.func,
    openReviewApplication: PropTypes.func,
    applicantsWithDisclosures: PropTypes.array,
    quotePromotions: PropTypes.object,
    canReviewApplication: PropTypes.bool,
    displayActionButton: PropTypes.bool,
    isApplicationHeld: PropTypes.bool,
    promotedQuotes: PropTypes.arrayOf(PropTypes.object),
    fetchQuote: PropTypes.func,
    loadInventoryDetails: PropTypes.func,
  };

  static defaultProps = {
    displayActionButton: true,
  };

  constructor(props) {
    super(props);
    this.state = {
      isLeaseTermSelectorDialogOpen: false,
      isLeasedUnitDialogOpen: false,
      isInventoryHoldingWarningDialogOpen: false,
      isDemoteDialogOpen: false,
      isMissingNamesDialogOpen: false,
      selectedQuotePromotion: null,
      inventoryHoldingWarningDialogModel: {},
      isOngoingManualHolding: false,
      processingPromote: false,
      processingPromoteDefault: false,
      processingViewQuote: false,
      processingViewQuoteDefault: false,
      processingEdit: false,
      processingEditDefault: false,
      processingDelete: false,
      processingDeleteDefault: false,
      processingHoldDefault: false,
    };
  }

  quoteListNeedsToUpdate = nextProps => {
    const { quotes, screeningSummary, members, screeningExpirationResults } = this.props;
    return (
      quotes !== nextProps.quotes ||
      !isEqual(screeningSummary, nextProps.screeningSummary) ||
      !isEqual(members, nextProps.members) ||
      !isEqual(screeningExpirationResults, nextProps.screeningExpirationResults)
    );
  };

  compareMembersTo = newMembers => isEqual(this.props.members, newMembers);

  getPartyApplicantIds = members => {
    const applicants = members.filter(canMemberBeInvitedToApply);
    return applicants.map(member => member.personId).toArray();
  };

  componentWillReceiveProps(nextProps) {
    const { partyId, members } = nextProps;
    if (!this.compareMembersTo(members)) {
      this.loadScreeningForPartyMembers(partyId, members);
    }

    if (!this.props.isOngoingManualHolding) {
      this.setState({ isOngoingManualHolding: false });
    }

    const { quoteListModel } = this.props;
    if (quoteListModel && quoteListModel.timer) quoteListModel.timer.stop();

    const { quoteListModel: quoteListModelNew } = nextProps;
    if (quoteListModelNew && quoteListModelNew.timer) quoteListModelNew.timer.start();
  }

  componentWillMount() {
    const { partyId, members } = this.props;
    this.loadScreeningForPartyMembers(partyId, members);
  }

  loadScreeningForPartyMembers = (partyId, members) => {
    const personIds = this.getPartyApplicantIds(members);
    if (!personIds.length) {
      console.error('Trying to get screening without any party member');
      return;
    }

    this.props.getScreeningForParty({ partyId });
  };

  componentWillUnmount() {
    const { quoteListModel } = this.props;
    if (quoteListModel && quoteListModel.timer) {
      quoteListModel.timer.stop();
    }
  }

  handleMissingLegalName = () => {
    const { onMissingNamesAction, partyMembersWithMissingNames } = this.props;
    onMissingNamesAction && onMissingNamesAction(partyMembersWithMissingNames.map(pm => pm.id));
  };

  handleCloseMissingNamesDialog = () => this.setState({ isMissingNamesDialogOpen: false });

  getLowestRentTerm = ({ leaseTerms }) =>
    leaseTerms.reduce((prev, term) => {
      if (term.adjustedMarketRent < prev.adjustedMarketRent) {
        prev = term;
      }
      return prev;
    });

  atLeastTwoLeaseTermsAvailable = ({ leaseTerms }) => leaseTerms && leaseTerms.length && leaseTerms.length > 1;

  handleReviewApplicationAction = async requestData => {
    const { openReviewApplication } = this.props;
    const { quoteId, leaseTermId, applicationDecision, selectedLeaseTerm } = requestData;
    openReviewApplication && openReviewApplication({ quoteId, leaseTermId, applicationDecision, selectedLeaseTerm });
  };

  handleCreateLeaseAction = async requestData => {
    const { openNewLease } = this.props;
    const { lease } = await this.props.promoteQuote({ ...requestData }, DALTypes.PromotionStatus.APPROVED, false);
    if (!lease) return;
    this.setState({ processingPromote: false });
    openNewLease && openNewLease(lease.id);
  };

  handleOnAction = debounce((actionType, quoteId, selectedLeaseTermOnDialog = {}) => {
    const { selectedTerm } = this.state;
    const areLeaseTermsTheSame = selectedLeaseTermOnDialog.id === selectedTerm.id;

    const selectedLeaseTerm = !areLeaseTermsTheSame && selectedLeaseTermOnDialog.id ? selectedLeaseTermOnDialog : selectedTerm;
    const { id: leaseTermId, screening = {} } = selectedLeaseTerm;
    const applicationDecision = get(screening, 'result.applicationDecision');

    const requestData = {
      partyId: this.props.partyId,
      quoteId,
      leaseTermId,
      applicationDecision,
      selectedLeaseTerm,
    };
    this.setState({
      isLeaseTermSelectorDialogOpen: false,
      selectedTerm: selectedLeaseTerm,
    });

    switch (actionType) {
      case PromoteActionType.REVIEW_APPLICATION:
        this.setState({ processingPromote: false });
        this.handleReviewApplicationAction(requestData);
        break;
      case PromoteActionType.CREATE_LEASE:
        this.handleCreateLeaseAction(requestData);
        break;
      default:
    }
  }, 200);

  handleOpenLeaseTermSelectorDialog = quote => {
    const atLeastTwoLeaseTermsAvailable = this.atLeastTwoLeaseTermsAvailable(quote);
    if (this.props.partyMembersWithMissingNames.length) {
      this.setState({ isMissingNamesDialogOpen: true, processingPromote: false });
    } else if (isInventoryLeasedOnPartyType(quote.inventory.state, this.props.party)) {
      this.setState({
        isLeasedUnitDialogOpen: true,
        promotingQuote: quote,
      });
    } else if (atLeastTwoLeaseTermsAvailable) {
      this.setState({
        isLeaseTermSelectorDialogOpen: true,
        promotingQuote: quote,
        selectedTerm: this.getLowestRentTerm(quote),
        atLeastTwoLeaseTermsAvailable,
      });
    } else {
      const selectedTerm = this.getLowestRentTerm(quote);
      this.setState({
        promotingQuote: quote,
        selectedTerm,
      });

      const { screeningRequired } = this.props.party;
      const actionType = screeningRequired ? PromoteActionType.REVIEW_APPLICATION : PromoteActionType.CREATE_LEASE;
      this.handleOnAction(actionType, quote.id);
    }
  };

  handleCloseLeaseTermSelectorDialog = () => {
    this.setState({
      isLeaseTermSelectorDialogOpen: false,
    });
  };

  handleCloseDemoteApplicationDialog = () => this.setState({ isDemoteDialogOpen: false, processingPromote: false });

  handleRevokePromotion = ({ id }) => {
    const quotePromotion = this.props.quotePromotions.find(
      ({ quoteId, promotionStatus }) => quoteId === id && promotionStatus !== DALTypes.PromotionStatus.CANCELED,
    );
    if (!quotePromotion) return;
    this.setState({
      isDemoteDialogOpen: true,
      selectedQuotePromotion: quotePromotion,
    });
  };

  onRowTap = async (quote, tapFromMenu = true) => {
    const { onRowTap, party, members } = this.props;
    const isQuotePublished = get(quote, 'publishDate');
    const { screeningRequired } = party;
    const shouldOpenReviewApplication = isQuotePublished && !tapFromMenu && screeningRequired && areAllGuarantorsLinkedWhenNeeded(members);
    await this.props.fetchQuote(quote.id, quote.publishDate);
    await this.props.loadInventoryDetails({ id: quote.inventory.id, partyId: quote.partyId });

    if (shouldOpenReviewApplication) {
      this.handleOpenLeaseTermSelectorDialog(quote);
    } else {
      onRowTap && onRowTap({ quote });
    }
  };

  renderStatus = (quote, quotePromotions, rowId) => {
    const statusList = getQuoteStatusForQuoteList(quote, quotePromotions);
    // NOTE: Please remember every array in React needs a key!!!!
    return statusList.map(status => {
      const tagProps = {
        ...status,
        text: toSentenceCase(status.text),
      };
      return <Tag id={`${rowId}_statusTag`} key={`${status.text}_${rowId}`} className={cf('tag')} {...tagProps} />;
    });
  };

  isQuotePromoted = quoteId => {
    const { promotedQuotes = [] } = this.props;
    return promotedQuotes.some(({ id }) => id === quoteId);
  };

  hasPromotedQuoteLeaseTerm = (quoteId, leaseTermId) => {
    const promotions = this.props.quotePromotions;
    // Any quote + term that has been promoted for approval for this party will be highlighted.
    // point 8 from https://redisrupt.mybalsamiq.com/projects/leasing-applicationandprofile/A%20and%20Q%20section%20-%20Approval%20in%20progress
    return promotions.some(promotion => promotion && promotion.promotionStatus && promotion.quoteId === quoteId && promotion.leaseTermId === leaseTermId);
  };

  renderApplicationStatusText = screening => {
    const { text, previousResultText } = screening;
    if (!!text && !!previousResultText) {
      return (
        <div>
          <TextPrimary>{text}</TextPrimary>
        </div>
      );
    }
    return <TextSecondary>{text}</TextSecondary>;
  };

  renderLeaseTermRow = (quoteId, term, options) => {
    const { shouldDisplayApplicationStatus, isSmall } = options;
    const highlightedQuote = this.hasPromotedQuoteLeaseTerm(quoteId, term.id);
    const statusIcon = renderApplicationStatusIcon(term.screening);
    const { result: formattedPrice } = formatMoney({
      amount: term.baseMarketRent,
      currency: 'USD',
    });

    const termBasePrice = term.baseMarketRent ? formattedPrice : '';

    return (
      <Row
        noPaddingOnSides
        data-component="lease-term-row"
        key={`internal-row-${term.id}`}
        className={cf('lease-term-row', { 'promoted-quote': highlightedQuote })}
        noDivider
        noHover>
        <Cell
          textAlign="right"
          width={isSmall && shouldDisplayApplicationStatus ? 80 : 140}
          noSidePadding={isSmall && shouldDisplayApplicationStatus}
          className={cf('text-cell')}>
          <div>
            {' '}
            <span> {termBasePrice}</span>
            <span style={{ marginLeft: 14 }}>{`${term.termLength}m`}</span>
          </div>
        </Cell>
        {shouldDisplayApplicationStatus && (
          <Cell
            data-type="application-status"
            textAlign="left"
            noSidePadding
            style={{ minWidth: isSmall ? 200 : 220, maxWidth: 220 }}
            className={cf('left-padding', 'text-cell')}
            type="ctrlCell">
            <span
              key={`status-${term.id}`}
              id="quoteScreeningStatusTxt"
              className={cf('row-shape', {
                'grey-out': term.screening.isExpired,
              })}>
              {statusIcon}
              {this.renderApplicationStatusText(term.screening)}
            </span>
          </Cell>
        )}
      </Row>
    );
  };

  onInventoryHoldingWarningDialogClosed = () => this.setState({ isInventoryHoldingWarningDialogOpen: false, isOngoingManualHolding: false });

  onViewParty = partyId => {
    this.setState({ isInventoryHoldingWarningDialogOpen: false });
    this.props.leasingNavigator.navigateToParty(partyId);
  };

  createDraftInventoryDialogModel = quote => ({
    title: t('DRAFT_INVENTORY_HOLDING_TITLE'),
    lblAction: t('OPEN_QUOTE'),
    lblCancel: t('MSG_BOX_BTN_CANCEL'),
    handleOnActionClick: () => this.onRowTap(quote),
    handleOnCancelClick: this.onInventoryHoldingWarningDialogClosed,
    text: t('DRAFT_INVENTORY_HOLDING_MSG'),
  });

  handleHoldingWhenQuoteIsADraft = ({ quote, inventoryHeldModel, isHeldByOtherParty }) => {
    this.setState({ isOngoingManualHolding: false });
    const inventoryHoldingWarningDialogModel = !isHeldByOtherParty
      ? this.createDraftInventoryDialogModel(quote)
      : createInventoryUnavailableDialogModel({
          partyId: inventoryHeldModel.partyId,
          onInventoryHoldingWarningDialogClosed: this.onInventoryHoldingWarningDialogClosed,
          onViewParty: this.onViewParty,
          title: t('INVENTORY_UNAVAILABLE_TITLE'),
          text: inventoryHeldModel.msg,
        });
    return this.setState({ isInventoryHoldingWarningDialogOpen: true, inventoryHoldingWarningDialogModel });
  };

  handleHoldingWhenInventoryIsHeldByOtherParty = inventoryHeldModel =>
    this.setState({
      isOngoingManualHolding: true,
      isInventoryHoldingWarningDialogOpen: true,
      inventoryHoldingWarningDialogModel: createInventoryUnavailableDialogModel({
        partyId: inventoryHeldModel.partyId,
        onInventoryHoldingWarningDialogClosed: this.onInventoryHoldingWarningDialogClosed,
        onViewParty: this.onViewParty,
        title: t('INVENTORY_UNAVAILABLE_TITLE'),
        text: inventoryHeldModel.msg,
      }),
    });

  handleHoldingWhenQuoteIsPublishedOrPromoted = async ({ quote, inventoryHeldModel, isHeldByOtherParty, isManuallyHeldByThisParty }) => {
    this.setState({ isOngoingManualHolding: true });
    if (isManuallyHeldByThisParty) {
      await this.props.releaseInventory(quote.inventory.id, quote.partyId);
      return;
    }

    if (isHeldByOtherParty) {
      this.handleHoldingWhenInventoryIsHeldByOtherParty(inventoryHeldModel);
      return;
    }

    await this.props.setInventoryOnHold({
      inventoryId: quote.inventory.id,
      partyId: quote.partyId,
      reason: DALTypes.InventoryOnHoldReason.MANUAL,
      quotable: true,
      quoteId: quote.id,
    });
    return;
  };

  onHoldEventMap = {
    [QuoteState.DRAFT]: this.handleHoldingWhenQuoteIsADraft,
    [QuoteState.PUBLISHED]: this.handleHoldingWhenQuoteIsPublishedOrPromoted,
  };

  renderMenuItem = ({ onClick = () => {}, label, id, processing, ...rest }) => (
    <CardMenuItem key={id} onClick={onClick} text={label} {...rest}>
      {processing && <Status processing={processing} />}
    </CardMenuItem>
  );

  renderCardMenuForQuoteDraft = ({ id, quote, inventoryHoldStatus, isOngoingManualHolding }) => {
    const { processingEdit, processingEditDefault, processingDelete, processingDeleteDefault, processingHoldDefault } = this.state;
    return (
      <CardMenu
        id={id}
        ref={ref => {
          this.menuContext = ref;
        }}
        appendToBody
        menuListClassName={cf('card-menu')}
        iconName="dots-vertical">
        {this.renderMenuItem({
          id: `edit-draft-${quote.id}`,
          label: t('EDIT'),
          disabled: processingEdit || processingEditDefault,
          processing: processingEdit || processingEditDefault,
          onClick: () => {
            this.setState({ processingEdit: true, processingEditDefault: true });
            setTimeout(() => this.setState({ processingEditDefault: false }), 500);
            this.onRowTap(quote);
          },
        })}
        {this.renderMenuItem({
          id: `hold-unit-${quote.id}`,
          label: t('HOLD_UNIT'),
          processing: isOngoingManualHolding || processingHoldDefault,
          disabled: isOngoingManualHolding || processingHoldDefault,
          onClick: () => {
            this.setState({ processingHoldDefault: true });
            setTimeout(() => this.setState({ processingHoldDefault: false }), 500);
            this.onHoldEventMap[QuoteState.DRAFT]({ quote, ...inventoryHoldStatus });
          },
        })}

        <Divider />

        {this.renderMenuItem({
          id: `delete-draft-${quote.id}`,
          label: t('DELETE'),
          processing: processingDelete || processingDeleteDefault,
          disabled: processingDelete || processingDeleteDefault,
          onClick: () => {
            this.setState({ processingDelete: true, processingDeleteDefault: true });
            setTimeout(() => this.setState({ processingDeleteDefault: false }), 500);

            this.props.deleteQuote(quote.id);
          },
        })}
      </CardMenu>
    );
  };

  renderCardMenuForQuotePublished = ({ id, quote, isQuotePublished, inventoryHoldStatus, screeningRequired, isOngoingManualHolding }) => {
    const { processingViewQuote, processingViewQuoteDefault, processingPromote, processingPromoteDefault, processingholdDefault } = this.state;
    const { hasActivePromotion, isCorporateParty, hasQuotePromotedWithRequiresWork } = this.props;
    const buttonLabel = !screeningRequired ? 'PROMOTE_TO_LEASE' : 'REVIEW_SCREENING';
    const hasActivePromotionOnNonCorporateParty = hasActivePromotion && !isCorporateParty;
    const displayReviewScreening = hasActivePromotionOnNonCorporateParty ? hasQuotePromotedWithRequiresWork : true;
    return (
      <CardMenu
        id={id}
        ref={ref => {
          this.menuContext = ref;
        }}
        menuListClassName={cf('card-menu')}
        appendToBody
        iconName="dots-vertical">
        {isQuotePublished &&
          displayReviewScreening &&
          this.renderMenuItem({
            id: `promote-to-lease-${quote.id}`,
            name: 'review-promote-application',
            label: t(buttonLabel),
            disabled: processingPromoteDefault || processingPromote,
            processing: processingPromoteDefault || processingPromote,
            onClick: () => {
              this.setState({ processingPromote: true, processingPromoteDefault: true });
              setTimeout(() => this.setState({ processingPromoteDefault: false }), 500);
              quote && this.handleOpenLeaseTermSelectorDialog(quote);
            },
          })}

        {this.renderMenuItem({
          id: `open-published-quote-${quote.id}`,
          label: t('VIEW_QUOTE'),
          disabled: processingViewQuote || processingViewQuoteDefault,
          processing: processingViewQuote || processingViewQuoteDefault,
          onClick: () => {
            this.setState({ processingViewQuote: true, processingViewQuoteDefault: true });
            setTimeout(() => this.setState({ processingViewQuoteDefault: false }), 500);
            this.onRowTap(quote);
          },
        })}

        {this.renderMenuItem({
          id: `hold-unit-${quote.id}`,
          label: inventoryHoldStatus.isManuallyHeldByThisParty ? t('RELEASE_HOLD') : t('HOLD_UNIT'),
          disabled: isOngoingManualHolding || processingholdDefault,
          processing: isOngoingManualHolding || processingholdDefault,
          onClick: () => {
            this.setState({ processingholdDefault: true });
            setTimeout(() => this.setState({ processingholdDefault: false }), 500);
            this.onHoldEventMap[QuoteState.PUBLISHED]({ quote, ...inventoryHoldStatus });
          },
        })}
      </CardMenu>
    );
  };

  renderCardMenuForPromotedQuote = ({ id, quote, shouldDisplayReviewOrPromoteButton, inventoryHoldStatus, isOngoingManualHolding }) => {
    const { processingViewQuote, processingViewQuoteDefault, processingPromote, processingPromoteDefault, processingHoldDefault } = this.state;
    const isLeaseExecuted = this.props.leases.some(lease => lease.quoteId === quote.id && lease.status === DALTypes.LeaseStatus.EXECUTED);
    const { screeningRequired } = this.props.party;
    const { hasActivePromotion, isCorporateParty, hasQuotePromotedWithRequiresWork } = this.props;
    const hasActivePromotionOnNonCorporateParty = hasActivePromotion && !isCorporateParty;
    const buttonLabel = !screeningRequired ? 'PROMOTE_TO_LEASE' : 'REVIEW_SCREENING';
    return (
      <CardMenu
        id={id}
        ref={ref => {
          this.menuContext = ref;
        }}
        menuListClassName={cf('card-menu')}
        appendToBody
        iconName="dots-vertical">
        {hasActivePromotionOnNonCorporateParty &&
          hasQuotePromotedWithRequiresWork &&
          this.renderMenuItem({
            id: `promote-to-lease-${quote.id}`,
            name: 'review-promote-application',
            label: t(buttonLabel),
            disabled: processingPromote || processingPromoteDefault,
            processing: processingPromote || processingPromoteDefault,
            onClick: () => {
              this.setState({ processingPromote: true, processingPromoteDefault: true });
              setTimeout(() => this.setState({ processingPromoteDefault: false }), 500);
              quote && this.handleOpenLeaseTermSelectorDialog(quote);
            },
          })}
        {this.renderMenuItem({
          id: `open-published-quote-${quote.id}`,
          label: t('VIEW_QUOTE'),
          disabled: processingViewQuote || processingViewQuoteDefault,
          processing: processingViewQuote || processingViewQuoteDefault,
          onClick: () => {
            this.setState({ processingViewQuote: true, processingViewQuoteDefault: true });
            setTimeout(() => this.setState({ processingViewQuoteDefault: false }), 500);
            this.onRowTap(quote);
          },
        })}
        {!screeningRequired &&
          shouldDisplayReviewOrPromoteButton &&
          !isLeaseExecuted &&
          this.renderMenuItem({
            id: `revoke-promotion-${quote.id}`,
            label: t('REVOKE_PROMOTION'),
            processing: processingPromote || processingPromoteDefault,
            disabled: processingPromote || processingPromoteDefault,
            onClick: () => {
              this.setState({ processingPromote: true, processingPromoteDefault: true });
              setTimeout(() => this.setState({ processingPromoteDefault: false }), 500);
              quote && this.handleRevokePromotion(quote);
            },
          })}
        {this.renderMenuItem({
          id: `hold-unit-${quote.id}`,
          label: inventoryHoldStatus.isManuallyHeldByThisParty ? t('RELEASE_HOLD') : t('HOLD_UNIT'),
          disabled: isOngoingManualHolding || processingHoldDefault,
          processing: isOngoingManualHolding || processingHoldDefault,
          onClick: () => {
            this.setState({ processingHoldDefault: true });
            setTimeout(() => this.setState({ processingHoldDefault: false }), 500);
            this.onHoldEventMap[QuoteState.PUBLISHED]({ quote, ...inventoryHoldStatus });
          },
        })}
      </CardMenu>
    );
  };

  renderCardMenu = ({ rowId, quote, shouldDisplayReviewOrPromoteButton, isQuotePublished, screeningRequired, isOngoingManualHolding }) => {
    const inventoryHoldStatus = getInventoryHoldStatus(quote);
    if (this.isQuotePromoted(quote.id)) {
      return this.renderCardMenuForPromotedQuote({
        id: `${rowId}_menu`,
        quote,
        shouldDisplayReviewOrPromoteButton,
        inventoryHoldStatus,
        isOngoingManualHolding,
      });
    }

    if (quote.publishDate) {
      return this.renderCardMenuForQuotePublished({
        id: `${rowId}_menu`,
        quote,
        isQuotePublished,
        inventoryHoldStatus,
        screeningRequired,
        isOngoingManualHolding,
      });
    }

    return this.renderCardMenuForQuoteDraft({ id: `${rowId}_menu`, quote, inventoryHoldStatus, isOngoingManualHolding });
  };

  handleOnOpenApproveDialogClick = quote => {
    const unitDepositAmount = getUnitDepositAmount(quote);

    this.setState({ unitDepositAmount, approvingQuoteId: quote.id, approvingQuoteName: quote.inventory.name, isApproveDialogOpen: true });
  };

  handleOnApprove = approvalModel => {
    const { onApprove } = this.props;
    this.setState({ isApproveDialogOpen: false });
    onApprove && onApprove(approvalModel);
  };

  renderRow = ({
    index,
    quote,
    isSmall,
    shouldDisplayApplicationStatus,
    shouldDisplayReviewOrPromoteButton,
    showApproveColumn,
    quotePromotions,
    screeningRequired,
    canReviewApplication,
    isOngoingManualHolding,
  }) => {
    const isQuotePublished = !!quote.publishDate;
    const showApproveButton =
      !screeningRequired &&
      canReviewApplication &&
      quotePromotions.some(
        quotePromotion => quote.id === quotePromotion.quoteId && quotePromotion.promotionStatus === DALTypes.PromotionStatus.PENDING_APPROVAL,
      );
    const rowId = `rowQuote${index}`;

    const { expirationDate, propertyTimezone: timezone, leaseStartDate } = quote;
    return (
      <Row
        clickable
        data-component="quote-list-row"
        id={`row${quote.inventory.name}`}
        data-id={rowId}
        key={`row-${quote.id}`}
        onClick={() => this.onRowTap(quote, false)}
        className={cf('quote-row', { expired: isQuoteExpired({ expirationDate, timezone }) })}>
        <Cell className={cf('text-cell')}>
          {renderFullQualifiedName(quote.inventory.fullQualifiedName)}
          {quote.createdFromCommId && <Tag className={cf('tag')} text={t('SELF_SERVE')} info={true} />}
          {this.renderStatus(quote, quotePromotions, rowId)}
        </Cell>
        <Cell
          textAlign="right"
          width={isSmall && shouldDisplayApplicationStatus ? 80 : 120}
          noSidePadding={isSmall && shouldDisplayApplicationStatus}
          className={cf('text-cell')}>
          {leaseStartDate && toMoment(leaseStartDate, { timezone }).format(DATE_US_FORMAT)}
        </Cell>
        <Cell noSidePadding textAlign="right" width={isSmall && shouldDisplayApplicationStatus ? 370 : ''}>
          <Table data-component="quote-lit-lease-terms">
            {quote.leaseTerms.map(leaseTerm =>
              this.renderLeaseTermRow(quote.id, leaseTerm, { shouldDisplayApplicationStatus, isSmall, leaseStartDate, timezone }),
            )}
          </Table>
        </Cell>
        {showApproveColumn && (
          <Cell noSidePadding textAlign="center" width={120}>
            {showApproveButton && (
              <Button
                type="raised"
                btnRole="primary"
                label={t('APPROVE')}
                style={{ marginLeft: 10 }}
                onClick={e => {
                  e.stopPropagation();
                  this.handleOnOpenApproveDialogClick(quote);
                }}
              />
            )}
          </Cell>
        )}
        <Cell
          id={`quote-card-menu-${quote.inventory.name}`}
          width={60}
          textAlign="right"
          middleWrapperStyle={{ paddingRight: '1rem' }}
          onClick={event => event.stopPropagation()}>
          {this.renderCardMenu({ rowId, quote, shouldDisplayReviewOrPromoteButton, isQuotePublished, screeningRequired, isOngoingManualHolding })}
        </Cell>
      </Row>
    );
  };

  onLeasedUnitDialogClosed = () => this.setState({ isLeasedUnitDialogOpen: false });

  shouldDisplayReviewOrPromoteButton = (quote, applicationsAndScreeningsCompleted, screeningRequired) => {
    const hasCompletedStatus = quote.selections && quote.leaseTerms && applicationsAndScreeningsCompleted;
    return hasCompletedStatus || this.props.canReviewApplication || !screeningRequired;
  };

  getPrimaryMemberMissingField = () => {
    const { isCorporateParty, partyMembersWithMissingNames } = this.props;
    if (!isCorporateParty) return [];

    const primaryMember = partyMembersWithMissingNames.find(isResident) || {};
    return primaryMember.missingFields || [];
  };

  render(
    {
      className,
      loading,
      quotes,
      party,
      screeningSummary,
      members,
      applicantsWithDisclosures,
      isApplicationHeld,
      quoteListModel,
      partyMembersWithMissingNames,
      quotePromotions,
      partyId,
      canReviewApplication,
      areAllPartyApplicationsCompleted,
      hasActivePromotion,
    } = this.props,
  ) {
    if (loading && quotes.length === 0) {
      return <PreloaderBlock />;
    }

    const areScreeningsCompleted = screeningSummary && screeningSummary.areScreeningsCompleted;
    const applicationsAndScreeningsCompleted = areAllPartyApplicationsCompleted && areScreeningsCompleted && areAllGuarantorsLinkedWhenNeeded(members);
    const {
      promotingQuote,
      isLeaseTermSelectorDialogOpen,
      selectedTerm,
      isLeasedUnitDialogOpen,
      isInventoryHoldingWarningDialogOpen,
      isDemoteDialogOpen,
      isMissingNamesDialogOpen,
      selectedQuotePromotion,
      inventoryHoldingWarningDialogModel,
      isApproveDialogOpen,
      approvingQuoteName,
      approvingQuoteId,
      unitDepositAmount,
      atLeastTwoLeaseTermsAvailable,
      isOngoingManualHolding,
    } = this.state;
    const quoteList = quoteListModel.quotes.filter(quote => !quote.pristine);
    const { screeningRequired } = party;
    const shouldDisplayApplicationStatus = screeningRequired && (areAllPartyApplicationsCompleted || hasActivePromotion) && !isApplicationHeld;
    const missingLegalNames = partyMembersWithMissingNames.map(pm => pm.displayName);
    const showApproveColumn = showApproveColumnFunc({ screeningRequired, canReviewApplication, quotePromotions });

    return (
      <div data-component="quote-list">
        <AutoSize breakpoints={{ small: [0, 660], large: [661, Infinity] }}>
          {({ breakpoint }) => {
            const isSmall = breakpoint === 'small';
            return (
              <Table className={className}>
                <RowHeader>
                  <Cell>{t('QUOTES_TABLE_COLUMN_UNIT_NAME')}</Cell>
                  <Cell noSidePadding textAlign="right" width={!isSmall || (isSmall && shouldDisplayApplicationStatus) ? 370 : 220}>
                    <Table>
                      <Row noDivider noHover>
                        <Cell
                          noSidePadding={isSmall && shouldDisplayApplicationStatus}
                          textAlign="right"
                          width={isSmall && shouldDisplayApplicationStatus ? 80 : 120}>
                          {t('LEASE_START')}
                        </Cell>
                        <Cell
                          textAlign="center"
                          width={isSmall && shouldDisplayApplicationStatus ? 80 : 140}
                          noSidePadding={isSmall && shouldDisplayApplicationStatus}>
                          {t('QUOTES_TABLE_COLUMN_LEASE_TERM')}
                        </Cell>
                        {shouldDisplayApplicationStatus && (
                          <Cell textAlign="left" style={{ minWidth: isSmall ? 200 : 220 }} className={cf('left-padding')}>
                            {t('APPLICATION_STATUS')}
                          </Cell>
                        )}
                      </Row>
                    </Table>
                  </Cell>
                  {showApproveColumn && <Cell noSidePadding textAlign="center" width={120} />}
                  <Cell textAlign="right" width={60} />
                </RowHeader>
                {quoteList.map((quote, index) =>
                  this.renderRow({
                    index,
                    quote,
                    isSmall,
                    shouldDisplayApplicationStatus,
                    shouldDisplayReviewOrPromoteButton: this.shouldDisplayReviewOrPromoteButton(quote, applicationsAndScreeningsCompleted, screeningRequired),
                    showApproveColumn,
                    quotePromotions,
                    screeningRequired,
                    canReviewApplication,
                    isOngoingManualHolding,
                  }),
                )}
              </Table>
            );
          }}
        </AutoSize>
        {promotingQuote && isLeaseTermSelectorDialogOpen && (
          <LeaseTermSelectorDialog
            quote={promotingQuote}
            user={this.props.user}
            screeningRequired={screeningRequired}
            open={isLeaseTermSelectorDialogOpen}
            onCloseRequest={this.handleCloseLeaseTermSelectorDialog}
            onAction={this.handleOnAction}
            selectedTerm={selectedTerm}
            applicantsWithDisclosures={applicantsWithDisclosures}
            atLeastTwoLeaseTermsAvailable={atLeastTwoLeaseTermsAvailable}
          />
        )}
        {promotingQuote && isLeasedUnitDialogOpen && (
          <LeasedUnitDialog
            isLeasedUnitDialogOpen={isLeasedUnitDialogOpen}
            partyMembers={promotingQuote.inventory.leasePartyMembers}
            onDialogClosed={this.onLeasedUnitDialogClosed}
          />
        )}
        {isInventoryHoldingWarningDialogOpen && (
          <InventoryHoldingWarningDialog isOpen={isInventoryHoldingWarningDialogOpen} model={inventoryHoldingWarningDialogModel} />
        )}
        <DemoteDialog
          quotePromotion={selectedQuotePromotion}
          isDemoteApplicationDialogOpen={isDemoteDialogOpen}
          onDialogClosed={this.handleCloseDemoteApplicationDialog}
          hasALease={true}
          dialogTitle={t('REVOKE_PROMOTION')}
        />
        <MissingNamesDialog
          isDialogOpen={isMissingNamesDialogOpen}
          companyMissingFields={this.getPrimaryMemberMissingField()}
          missingNames={missingLegalNames}
          onOkAction={this.handleMissingLegalName}
          onDialogClosed={this.handleCloseMissingNamesDialog}
        />
        <ApprovalDialog
          dialogOpen={isApproveDialogOpen}
          onCloseRequest={() => this.setState({ isApproveDialogOpen: false })}
          partyId={partyId}
          unitDepositAmount={unitDepositAmount}
          inventoryName={approvingQuoteName}
          onApprove={this.handleOnApprove}
          quoteId={approvingQuoteId}
        />
      </div>
    );
  }
}
