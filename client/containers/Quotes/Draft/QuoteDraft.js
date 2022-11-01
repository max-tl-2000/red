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
import { t } from 'i18next';
import get from 'lodash/get';
import sleep from 'helpers/sleep';
import {
  fetchQuote,
  publishQuote,
  deleteQuote,
  updateQuoteDraft,
  createQuoteDraft,
  duplicateQuote,
  closeDuplicateWarning,
  getQuoteModel,
  clearQuoteModel,
  sendQuoteMail,
  clearInventoryWithUnavailablePrices,
} from 'redux/modules/quotes';
import { loadInventoryDetails } from 'redux/modules/inventoryStore';
import { updateParty } from 'redux/modules/partyStore';
import { sendMessage } from 'redux/modules/communication';
import { Observer, observer } from 'mobx-react';
import { computed, observable, action, reaction } from 'mobx';
import { quoteStatus, formatAgent, enhanceInventory, isInventoryWithNullPrice } from 'helpers/quotes';
import { createSelector } from 'reselect';
import { getOutProgramSelector } from 'redux/selectors/programSelectors';
import {
  FullScreenDialog,
  IconButton,
  Button,
  DialogTitle,
  DialogHeaderActions,
  FlyOut,
  FlyOutOverlay,
  Typography,
  Tooltip,
  PreloaderBlock,
  MsgBox,
  SavingAffordance,
} from 'components';
import Validator from 'components/Validator/Validator';
import $ from 'jquery';

import { isDateInThePast } from '../../../../common/helpers/date-utils';
import { toHumanReadableString } from '../../../../common/helpers/strings';
import { getUnitShortHand, getSelectionsLeaseTermsAndConcessions, getFeesForSelectedTerm } from '../../../../common/helpers/quotes';

import { cf } from './quote.scss';

import QuotePublished from '../Published/QuotePublished';
import LeasingQuote from './LeasingQuote';
import RenewalQuote from './RenewalQuote';
import ShareActions from '../Published/ShareActions';
import { isInventoryLeasedOnPartyType } from '../../../../common/helpers/inventory';
import LeasedUnitDialog from '../../ProspectDetailPage/LeasedUnitDialog';
import { isAnonymousEmail } from '../../../../common/helpers/anonymous-email';
import { getDisplayName } from '../../../../common/helpers/person-helper';
import { formatPhone } from '../../../../common/helpers/phone-utils';

import { MONTH_DATE_YEAR_FORMAT } from '../../../../common/date-constants';
import { UnavailablePriceWarning } from '../../../custom-components/UnavailablePriceWarning/UnavailablePriceWarning';
import { getParty } from '../../../redux/selectors/partySelectors';
import { assert } from '../../../../common/assert';
import { formatMoment, toMoment } from '../../../../common/helpers/moment-utils';
import { getPartyPersonIds } from '../../../redux/selectors/personSelectors';
import { getInventoryAvailabilityDateAndDataSource } from '../../../../common/inventory-helper';
import { window } from '../../../../common/helpers/globals';
import { ZIndexHelper } from '../../../../common/client/z-index-helper';
import { zIndexManager } from '../../../z-index-manager';

const { Text } = Typography;

const FLYOUT_LIFESPAN = 10000; // in millisec
const $html = $('html');

const DEFAULT_EXPIRATION_PERIOD = 2;
const DEFAULT_RENEWAL_EXPIRATION_PERIOD = 5; // number of days until the renewal letter will expire

const getUser = createSelector(
  state => state.quotes.model,
  state => state.globalStore.get('users'),
  (model, users) => (model && model.userId ? users.find(user => user.id === model.userId) : { metadata: {} }),
);

const getUserWithPartyContactInfo = createSelector(
  (state, props) => getOutProgramSelector()(state, props),
  (s, p, user) => user,
  (program, user) => ({
    ...user,
    displayPhoneNumber: formatPhone(program.displayPhoneNumber) || '',
    displayEmail: program.displayEmail || '',
  }),
);

@connect(
  (state, props) => {
    const user = getUserWithPartyContactInfo(state, props, getUser(state));
    return {
      existingQuoteId: state.quotes.existingQuoteId,
      deletingQuote: state.quotes.deletingQuote,
      publishingQuote: state.quotes.publishingQuote,
      duplicateWarningOpen: state.quotes.duplicateWarningOpen,
      inventory: state.inventoryStore.inventory,
      showMissingPricesDialog: state.quotes.inventoryWithUnavailablePrices,
      savingChanges: state.quotes.savingChanges,
      party: getParty(state, props),
      user,
      agent: formatAgent(user, true),
      loggedInUser: getUserWithPartyContactInfo(state, props, state.auth.user),
      partyPersonIds: getPartyPersonIds(props),
      moveInDateRangePreference: state.unitsFilter.filters.moveInDate || {},
    };
  },
  dispatch =>
    bindActionCreators(
      {
        clearQuoteModel,
        loadInventoryDetails,
        fetchQuote,
        getQuoteModel,
        publishQuote,
        deleteQuote,
        updateQuoteDraft,
        createQuoteDraft,
        duplicateQuote,
        closeDuplicateWarning,
        updateParty,
        sendMessage,
        sendQuoteMail,
        clearInventoryWithUnavailablePrices,
      },
      dispatch,
    ),
)
@observer
class QuoteDraft extends Component {
  static propTypes = {
    inventory: PropTypes.object,
    moveInFromDate: PropTypes.string,
    existingQuoteId: PropTypes.string,
    savingChanges: PropTypes.bool,
    partyId: PropTypes.string,
    party: PropTypes.object,
    updateParty: PropTypes.func,
    partyMembers: PropTypes.object,
    quoteId: PropTypes.string,
    open: PropTypes.bool,
  };

  @observable
  quoteModel;

  quoteFrameId = 'quoteFrame';

  constructor(props, context) {
    super(props, context);

    this.state = {
      openDelete: false,
      openflyOut: false,
      isExistingQuote: false,
      openSendQuote: false,
      isLeasedUnitDialogOpen: false,
      fetchingQuote: false,
    };

    this.stopWatchingForQuote = reaction(() => {
      const { quoteModel } = this;
      return {
        quoteModel,
      };
    }, this.resetStartDateIfIsInThePast);
  }

  // TODO: move this into the quoteModel
  buildQuoteDraftObject() {
    const { quoteModel } = this;
    if (!quoteModel) {
      return undefined;
    }
    const { selectedLeaseTermIds, leaseStartDate, leaseTerms, additionalAndOneTimeCharges } = quoteModel;
    const { inventory, isRenewalQuote } = this.props;

    const {
      expirationPeriod = DEFAULT_EXPIRATION_PERIOD,
      renewalLetterExpirationPeriod = DEFAULT_RENEWAL_EXPIRATION_PERIOD,
    } = inventory?.property?.settings?.quote;
    const prorationStrategy = get(inventory, 'property.settings.quote.prorationStrategy', '');
    const propertyTimezone = quoteModel.propertyTimezone || get(inventory, 'property.timezone');

    assert(propertyTimezone, 'buildQuoteDraftObject: propertyTimezone not found');

    const unitShortHand = getUnitShortHand(inventory);

    let selections = getSelectionsLeaseTermsAndConcessions({
      selectedLeaseTermIds,
      leaseTerms,
      leaseStartDate,
      additionalAndOneTimeCharges,
      prorationStrategy,
      timezone: propertyTimezone,
    });

    const selectedAdditionalAndOneTimeCharges = getFeesForSelectedTerm(selectedLeaseTermIds, leaseTerms, additionalAndOneTimeCharges);
    selections = { ...selections, selectedAdditionalAndOneTimeCharges };

    return {
      selections,
      leaseStartDate,
      expirationPeriod: isRenewalQuote ? renewalLetterExpirationPeriod : expirationPeriod,
      propertyTimezone,
      inventoryName: inventory.name,
      unitShortHand,
    };
  }

  componentWillUnmount() {
    zIndexManager.removeOverlay('quoteDraftDialog');
  }

  openQuoteDraft = async () => {
    this.props.closeDuplicateWarning();
    this.setState({ isExistingQuote: true });

    // to prevent other renders from happening while
    // the dialog animation is being executed
    await sleep(600);

    const { selectedInventory, partyId } = this.props;

    await this.props.loadInventoryDetails({ id: selectedInventory.id, partyId });
    await this.props.fetchQuote(this.props.existingQuoteId);
    await this.setQuoteModelInLocalFromRedux({ setAmount: false });
  };

  @action
  async setQuoteModelInLocalFromRedux({ enableSave = true, setAmount = true, updateVariableAmountAtCreation = true } = {}) {
    const { moveInDateRangePreference, activeLeaseWorkflowData, isRenewalQuote, inventory: { property: { timezone } = {} } = {} } = this.props;

    const quoteModel = await this.props.getQuoteModel({ moveInDateRangePreference });
    if (updateVariableAmountAtCreation) {
      quoteModel.setDefaultVariableAmount({ setAmount });
    }
    this.quoteModel = quoteModel;

    if (isRenewalQuote) {
      const {
        leaseData: { leaseEndDate },
      } = activeLeaseWorkflowData;

      this.quoteModel.renewalDate = toMoment(leaseEndDate, { timezone }).add(1, 'days');
    }
    if (!enableSave) return;

    quoteModel.onSaveRequest = this.updateQuoteDraft;
  }

  @computed
  get unitPriceIsUnavailable() {
    const { quoteModel, props } = this;
    const { inventory } = props;
    return isInventoryWithNullPrice(inventory, quoteModel);
  }

  @computed
  get inventoryAvailabilityDetails() {
    const { props, quoteModel } = this;
    const { inventory } = props;

    if (!inventory || !quoteModel) return {};

    const { inventoryAvailability: inventoryIsUnavailable, readyByDate: availableOn } = getInventoryAvailabilityDateAndDataSource(
      inventory,
      quoteModel.leaseStartDate,
    );

    return { inventoryIsUnavailable, availableOn };
  }

  filterPartyMembersByContactInfo = filterExpression => {
    const partyMembers = this.props.partyMembers.toArray();
    return partyMembers.filter(({ person }) => filterExpression(person.contactInfo));
  };

  get membersWithoutEmailAndPhone() {
    return this.filterPartyMembersByContactInfo(contactInfo => !contactInfo.defaultEmail && !contactInfo.defaultPhone);
  }

  get membersOnlyWithAnonymousEmail() {
    return this.filterPartyMembersByContactInfo(
      contactInfo => contactInfo.defaultEmail && isAnonymousEmail(contactInfo.defaultEmail) && !contactInfo.defaultPhone,
    );
  }

  get membersOnlyWithPhone() {
    return this.filterPartyMembersByContactInfo(
      contactInfo => (!contactInfo.defaultEmail || isAnonymousEmail(contactInfo.defaultEmail)) && contactInfo.defaultPhone,
    );
  }

  @action
  publish = () => {
    const { unitPriceIsUnavailable, quoteModel } = this;
    if (unitPriceIsUnavailable || !quoteModel) {
      return;
    }

    this.setState({ fetchingQuote: true }, async () => {
      quoteModel.onSaveRequest = null;

      const data = this.buildQuoteDraftObject();
      if (!data) {
        console.warn('Cannot publish quote without data', quoteModel);
        return;
      }

      await this.props.publishQuote(quoteModel.id, data);

      // we just recently published the quote
      await this.props.fetchQuote(quoteModel.id, !!quoteModel.publishDate);

      // the next call will get a new Quote from the redux store
      await this.setQuoteModelInLocalFromRedux({ enableSave: false });
      this.setState({ fetchingQuote: false });

      // we can't use the previous loaded quoteModel as the previous get a new instace
      // TODO: what's this check used for? can a Quote be expired as soon as it is published?
      if (!this.quoteModel.isExpired) {
        this.setState({ openSendQuote: true });
      }
    });
  };

  handleOnCloseSendQuote = () => {
    this.setState({ openSendQuote: false }, () => {
      this.state.sendQuoteCommand !== 'OK' && this.setState({ openflyOut: true });
    });
  };

  handleOnCommandSendQuote = ({ command }) => {
    this.setState({ sendQuoteCommand: command });
  };

  handleOnOpeningSendQuoteDialog = () => this.setState({ sendQuoteCommand: null });

  deleteQuoteDraft = async () => {
    this.setState({ openDelete: false });

    const { quoteModel, props } = this;

    await props.deleteQuote(quoteModel.id);

    quoteModel.dispose();

    this.quoteModel = undefined;

    this.requestToClose('quoteDraftDeleted');
  };

  modalDeleteQuote = () => this.setState({ openDelete: true });

  @action
  enableSaveOnLocalQuoteModel = () => {
    const { quoteModel } = this;
    if (!quoteModel) return;

    quoteModel.onSaveRequest = this.updateQuoteDraft;
  };

  handleOpen = async () => {
    $html.addClass('quote-dialog-open');

    const { partyId, selectedInventory, quote, isRenewalQuote } = this.props;
    if (partyId && selectedInventory) {
      // TODO: find a cleaner/better way to do this
      // maybe introduce a mode?
      try {
        await this.props.loadInventoryDetails({ id: selectedInventory.id, partyId });
        const { inventory } = this.props;
        const unitShortHand = getUnitShortHand(inventory);
        const dataToQuote = {
          inventory: selectedInventory,
          partyId,
          defaultStartDate: this.props.moveInFromDate,
          unitShortHand,
          isRenewalQuote,
        };

        await this.props.createQuoteDraft(dataToQuote);
        if (!this.props.duplicateWarningOpen && !this.props.showMissingPricesDialog) {
          await this.setQuoteModelInLocalFromRedux({ enableSave: false, updateVariableAmount: false });

          const { quoteModel, props } = this;
          const { moveInDateRangePreference } = props;

          quoteModel.setLeaseStartDateFromPreferences(moveInDateRangePreference);
          quoteModel.resetPristineFlag();
          this.enableSaveOnLocalQuoteModel();
          quoteModel.setDefaultVariableAmount();
        }
      } catch (ex) {
        console.error('>>>> ERROR LOADING QUOTE', ex);
      }
    }
    const { moveInDateRangePreference } = this.props;

    const quoteModel = await this.props.getQuoteModel({ moveInDateRangePreference });
    if (quote && quoteModel && quote.id === quoteModel.id) {
      await this.setQuoteModelInLocalFromRedux({ setAmount: false });
    } else if (quote) {
      await this.props.fetchQuote(quote.id, quote.publishDate);
      await this.props.loadInventoryDetails({ id: quote.inventory.id, partyId: quote.partyId });
      await this.setQuoteModelInLocalFromRedux({ setAmount: false });
    }

    if (this.props.existingQuoteId && isRenewalQuote) this.openQuoteDraft();
  };

  @action
  handleClose = () => {
    $html.removeClass('quote-dialog-open');
    this.setState({
      neverShowResetDialog: false,
      openflyOut: false,
      isExistingQuote: false,
    });

    if (this.quoteModel) {
      this.quoteModel.dispose();
      this.quoteModel = undefined;
    }
    this.props.clearQuoteModel();
    this.autoCloseShareTooltip && clearTimeout(this.autoCloseShareTooltip);

    zIndexManager.removeOverlay('quoteDraftDialog');
  };

  @action
  updateQuoteDraft = async () => {
    const { quoteModel } = this;

    if (!quoteModel) {
      return;
    }

    if (quoteModel.isValid && quoteModel.canSave && !quoteModel.isPublished) {
      const data = this.buildQuoteDraftObject();
      if (!data) {
        console.warn('Cannot update quote without data', quoteModel);
        return;
      }

      if (quoteModel.hasLeaseStartDateAndSelectedTerms) {
        await this.props.updateQuoteDraft(quoteModel.id, data);
        quoteModel.disableQuoteSaving();
      }
    }
  };

  handleOnCloseRequest = async () => {
    const { quoteModel, props } = this;
    const { onCloseRequest } = props;

    if (!quoteModel.hasLeaseStartDateAndSelectedTerms) {
      if (!quoteModel.isPublished) {
        await this.props.deleteQuote(quoteModel.id);
      }
    } else {
      await this.updateQuoteDraft();
    }

    onCloseRequest && onCloseRequest();
  };

  @action
  resetStartDateIfIsInThePast = () => {
    const { quoteModel, state } = this;
    if (!quoteModel || quoteModel.isPublished) return;
    const { isLeaseStartDateInThePast, resetLeaseStartDate } = quoteModel;
    !state.isExistingQuote && isLeaseStartDateInThePast && resetLeaseStartDate();
  };

  @computed
  get quoteIsLoading() {
    return !this.quoteModel;
  }

  @computed
  get isQuotePublished() {
    const { quoteModel } = this;
    return quoteModel && quoteModel.publishDate;
  }

  requestToClose = source => {
    const { onCloseRequest } = this.props;

    onCloseRequest && onCloseRequest({ source });
  };

  closeDuplicateWarningAndQuote = () => {
    this.props.closeDuplicateWarning();

    this.requestToClose('duplicatedQuoteWarning');
  };

  @action
  duplicateQuote = async () => {
    const { quoteModel, props } = this;
    if (!quoteModel) return;

    const { inventory, isRenewalQuote } = props;

    this.props.onOpenOrCreateQuoteDraft({ inventory, isRenewalQuote });

    const enhancedInventory = enhanceInventory(inventory);
    await this.props.duplicateQuote(quoteModel.id, enhancedInventory);
    await this.setQuoteModelInLocalFromRedux();

    quoteModel.enableQuoteSaving();
  };

  sendQuoteToMembers = () => {
    const { quoteModel, props } = this;
    const { partyId } = props;

    this.props.sendQuoteMail({ quoteId: quoteModel.id, partyId });
    this.requestToClose('sendQuoteToMembers');
  };

  onPublishAction = () => {
    const { inventory, party } = this.props;

    if (isInventoryLeasedOnPartyType(inventory.state, party)) {
      this.setState({
        isLeasedUnitDialogOpen: true,
      });
    } else {
      this.publish();
    }
  };

  renderDialogActions = () => {
    const { quoteModel, props } = this;
    const { partyId, partyMembers, inventory, openCommFlyOut, agent, isRenewalQuote, publishingQuote } = props;

    if (this.quoteIsLoading || !inventory) {
      return <div />;
    }

    if (this.isQuotePublished) {
      return (
        <ShareActions
          partyId={partyId}
          quoteFrameId={this.quoteFrameId}
          partyMembers={partyMembers}
          isQuoteExpired={quoteModel.isExpired}
          inventory={inventory}
          quote={quoteModel}
          agent={agent}
          quoteId={quoteModel.id}
          openCommFlyOut={openCommFlyOut}
          onDuplicateClick={this.duplicateQuote}
          isRenewal={isRenewalQuote}
        />
      );
    }

    const { leaseStartDate, selectedLeaseTermIds } = this.quoteModel || {};

    const canPublish = leaseStartDate && selectedLeaseTermIds.length;

    return (
      <DialogHeaderActions>
        <Tooltip zIndex={1000} text={t('QUOTE_CANNOT_BE_EDITED_AFTER_PUBLISH')} position="bottom">
          <Button
            label={t('PUBLISH')}
            id="publishButton"
            btnRole="secondary"
            debounceClickThreshold={600}
            onClick={this.onPublishAction}
            disabled={!canPublish}
            loading={publishingQuote}
          />
        </Tooltip>
        <IconButton iconStyle="light" iconName="delete" onClick={this.modalDeleteQuote} id="deleteQuoteBtn" />
      </DialogHeaderActions>
    );
  };

  handleFlyOutPosition(args) {
    args.autoPosition = false;
    args.$overlay.css('position', 'fixed');
    args.$overlay.position({
      my: 'right-50 top+50',
      at: 'right top',
      of: window,
    });
  }

  matcherFunction({ resource }) {
    // if the resource matches a request to
    // the following service, then the saving
    // affordance will be displayed automatically
    return resource.match(/_\/quotes\/draft/);
  }

  onLeasedUnitDialogClosed = () => this.setState({ isLeasedUnitDialogOpen: false });

  renderWarningMessage = (members, translationToken) => {
    if (!members.length) return null;

    const memberNames = toHumanReadableString(members.map(member => getDisplayName(member.person)));
    return (
      <Validator style={{ marginTop: '10px' }} visible forceSentenceCase={false}>
        {t(translationToken, {
          count: members.length,
          memberNames,
        })}
      </Validator>
    );
  };

  // QUESTION: Wouldn't this generate more renders as the props will be always new on each render?
  getPropsOfPriceNotAvailableWarning = ({
    unitPriceIsUnavailable,
    showPriceNAForSelection,
    inventoryStatus,
    leaseStartDate,
    lastLeaseSelections,
    timezone,
    showMissingPricesDialog,
  }) => {
    if (unitPriceIsUnavailable) {
      return {
        message: 'INVENTORY_PRICE_NOT_AVAILABLE_DIALOG_BODY',
        inventoryStatus,
        okLabel: 'DELETE_DRAFT',
        cancelLabel: 'KEEP_DRAFT',
        onOKClick: this.handleOnDeleteDraftClick,
        onCancelClick: this.handleCloseMissingPricesDialog,
      };
    }
    if (showPriceNAForSelection) {
      const leaseTermsLengths = this.quoteModel.leaseTermsWithoutRent.map(({ termLength }) => termLength);
      return {
        message: 'LEASE_TERM_PRICE_NOT_AVAILABLE_DIALOG_BODY',
        leaseTermsLengths,
        leaseStartDate: formatMoment(leaseStartDate, { format: MONTH_DATE_YEAR_FORMAT, timezone }),
        okLabel: 'OK_GOT_IT',
        onOKClick: () => this.returnLeaseSelectionsToLastState(lastLeaseSelections, timezone),
      };
    }
    if (showMissingPricesDialog) {
      return {
        message: 'INVENTORY_WITH_UNAVAILABLE_PRICES_MESSAGE',
        okLabel: 'OK_GOT_IT',
        onOKClick: this.handleCloseMissingPricesDialog,
        onClose: this.handleCloseMissingPricesDialog,
      };
    }
    return {};
  };

  returnLeaseSelectionsToLastState = (lastLeaseSelections, timezone) => {
    const { leaseStartDate, selectedLeaseTermIds } = lastLeaseSelections;
    const { updateLeaseStartDate, updateSelectedLeaseTerms } = this.quoteModel;

    if (isDateInThePast(leaseStartDate, { timezone })) {
      const { onCloseRequest } = this.props;
      onCloseRequest && onCloseRequest();
      return;
    }

    updateLeaseStartDate(leaseStartDate);
    updateSelectedLeaseTerms({ ids: selectedLeaseTermIds });
    return;
  };

  handleOnDeleteDraftClick = () => {
    this.deleteQuoteDraft();
  };

  handleCloseMissingPricesDialog = () => {
    const { onCloseRequest } = this.props;
    onCloseRequest && onCloseRequest();
    this.props.clearInventoryWithUnavailablePrices();
  };

  handleOnCommandContinueFromDraft(args) {
    if (args.command === 'OK') args.autoClose = false;
  }

  getDialogTitle() {
    const { existingQuoteId, inventory, isRenewalQuote } = this.props;
    const getTitle = quoteTypeLabel => t(quoteTypeLabel, { name: !existingQuoteId && get(inventory, 'name', '') });
    return isRenewalQuote ? getTitle('RENEWAL_LETTER_DRAFT_TITLE') : getTitle('QUOTE_DRAFT_TITLE');
  }

  zIndexHelper = new ZIndexHelper();

  handleOnOpening = () => {
    this.zIndexHelper.zIndex = zIndexManager.pushOverlay('quoteDraftDialog', this.zIndexHelper);
  };

  render(
    {
      inventory,
      existingQuoteId,
      open,
      duplicateWarningOpen,
      deletingQuote,
      partyMembers,
      partyId,
      activeLeaseWorkflowData,
      isRenewalQuote,
      showMissingPricesDialog,
    } = this.props,
  ) {
    const { openDelete, openflyOut, isExistingQuote, openSendQuote, isLeasedUnitDialogOpen, fetchingQuote } = this.state;

    const { inventoryIsUnavailable, availableOn } = this.inventoryAvailabilityDetails;

    const { quoteModel = {} } = this;

    const inventoryStatus = inventory && inventory.state;
    const prorationStrategy = get(this.props.inventory, 'property.settings.quote.prorationStrategy', '');
    const loadingQuote = this.quoteIsLoading;

    const title = loadingQuote || deletingQuote ? t(loadingQuote ? 'LOADING' : 'DELETING_QUOTE_DRAFT') : this.getDialogTitle();

    const { neverShowResetDialog } = this.state;
    const areAllMembersWithoutEmailPhone =
      this.membersWithoutEmailAndPhone.length + this.membersOnlyWithAnonymousEmail.length === partyMembers.toArray().length;
    const calculatedStatus = (!loadingQuote && !deletingQuote && !existingQuoteId && quoteStatus(quoteModel)) || '';

    const titleResponsive =
      loadingQuote || deletingQuote // eslint-disable-line
        ? t(deletingQuote ? 'LOADING' : 'DELETING_QUOTE_DRAFT')
        : this.isQuotePublished
        ? t('QUOTE_PUBLISHED_TITLE_RESPONSIVE')
        : t('QUOTE_DRAFT_TITLE_RESPONSIVE');
    return (
      <FullScreenDialog
        ref="dialog"
        id="quote-dialog"
        onClose={this.handleClose}
        onOpen={this.handleOpen}
        onCloseRequest={this.handleOnCloseRequest}
        closeOnEscape={false}
        onOpening={this.handleOnOpening}
        absoluteZIndex={this.zIndexHelper.zIndex}
        open={open}
        title={[
          <DialogTitle lighter key="title" data-title={titleResponsive} id="quoteTitleDialog">
            {title}{' '}
            {calculatedStatus && (
              <Text inline lighter id="quoteTitleStatusText">
                ({calculatedStatus})
              </Text>
            )}
          </DialogTitle>,
          <SavingAffordance key="affordance" matcher={this.matcherFunction} lighter={true} />,
        ]}
        actions={<Observer>{() => this.renderDialogActions()}</Observer>}>
        <FlyOut
          open={openflyOut}
          closeOnTapAway={true}
          expandTo="bottom"
          onOpen={() => {
            this.autoCloseShareTooltip = setTimeout(() => this.setState({ openflyOut: false }), FLYOUT_LIFESPAN);
          }}
          onPosition={this.handleFlyOutPosition}>
          <FlyOutOverlay container>
            <Text secondary>{t('SHARE_THIS_QUOTE')}</Text>
            <div className={cf('actions-section')}>
              <div className={cf('share-text-icons')}>
                <IconButton iconName="email" disabled={true} className={cf('share-message-icon')} />
                <Text secondary>{t('EMAIL')}</Text>
              </div>
              <div className={cf('share-text-icons')}>
                <IconButton iconName="message-text" disabled={true} className={cf('share-message-icon')} />
                <Text secondary>{t('TEXT')}</Text>
              </div>
              <div className={cf('share-text-icons')}>
                <IconButton iconName="printer" disabled={true} className={cf('share-message-icon')} />
                <Text secondary>{t('PRINT')}</Text>
              </div>
            </div>
            <Text secondary className={cf('share-message-width')}>
              {t('QUOTE_PUBLISHED_FLYOUT_SHARE_TEXT')}
            </Text>
          </FlyOutOverlay>
        </FlyOut>
        <Observer>
          {() => {
            const { unitPriceIsUnavailable } = this;
            const { leaseTermsWithoutRent, shouldShowPriceNAForSelection, lastLeaseSelections, leaseTerms } = quoteModel;
            const showPriceNAForSelection = leaseTermsWithoutRent && leaseTermsWithoutRent.length && shouldShowPriceNAForSelection;
            const openPriceNotAvailableWarning = !!(unitPriceIsUnavailable || showPriceNAForSelection || showMissingPricesDialog);
            const shouldDisplayQuoteSections = !existingQuoteId && !!quoteModel.id && !!get(inventory, 'id');
            const additionalAndOneTimeCharges = quoteModel.additionalAndOneTimeCharges || {};
            const hasAdditionalCharges = additionalAndOneTimeCharges.length;

            const leaseStartDate = quoteModel.leaseStartDate;
            const selectedLeaseTermIds = quoteModel.selectedLeaseTermIds;
            const isLeaseStartDateInThePast = quoteModel.isLeaseStartDateInThePast;

            const isEmptyState = isLeaseStartDateInThePast || !leaseStartDate || !selectedLeaseTermIds.length;

            return (
              <div>
                {!isRenewalQuote && !openPriceNotAvailableWarning && (
                  <MsgBox
                    title={t('QUOTE_DRAFT_ALREADY_EXISTS')}
                    open={duplicateWarningOpen}
                    lblOK={t('CONTINUE_FROM_DRAFT')}
                    lblCancel={t('CLOSE')}
                    onCloseRequest={this.closeDuplicateWarningAndQuote}
                    onCommand={this.handleOnCommandContinueFromDraft}
                    onOKClick={this.openQuoteDraft}
                    content={t('QUOTE_DRAFT_ALREADY_EXISTS_TEXT', {
                      name: inventory && inventory.name,
                    })}
                  />
                )}
                {leaseTerms && !leaseTerms.length && (
                  <MsgBox
                    title={t('LEASE_TERMS_NOT_SET_UP')}
                    open={!leaseTerms.length}
                    lblOK={t('OK_GOT_IT')}
                    lblCancel={t('')}
                    onOKClick={this.deleteQuoteDraft}
                    content={isRenewalQuote ? t('PROPERTY_NOT_SET_UP_WITH_LEASE_TERMS_RENEWAL') : t('PROPERTY_NOT_SET_UP_WITH_LEASE_TERMS_NEW')}
                  />
                )}

                <UnavailablePriceWarning
                  open={openPriceNotAvailableWarning}
                  {...this.getPropsOfPriceNotAvailableWarning({
                    showMissingPricesDialog,
                    unitPriceIsUnavailable,
                    showPriceNAForSelection,
                    inventoryStatus,
                    leaseStartDate,
                    lastLeaseSelections,
                    timezone: quoteModel.propertyTimezone,
                  })}
                />

                {isLeasedUnitDialogOpen && (
                  <LeasedUnitDialog
                    isLeasedUnitDialogOpen={isLeasedUnitDialogOpen}
                    partyMembers={inventory.leasePartyMembers}
                    onDialogClosed={this.onLeasedUnitDialogClosed}
                  />
                )}
                {do {
                  if (loadingQuote) {
                    <PreloaderBlock />;
                  } else if (deletingQuote) {
                    <PreloaderBlock message="Deleting..." />;
                  } else if (!this.isQuotePublished) {
                    <div>
                      <MsgBox
                        title={t('QUOTE_DRAFT_DELETE')}
                        open={openDelete}
                        lblOK={t('DELETE')}
                        lblCancel={t('CANCEL')}
                        onCloseRequest={() => this.setState({ openDelete: false })}
                        onOKClick={this.deleteQuoteDraft}>
                        <Text>{t('QUOTE_DRAFT_DELETE_QUESTION')}</Text>
                        <Text>{t('QUOTE_DRAFT_DELETE_TEXT')}</Text>
                      </MsgBox>

                      <MsgBox
                        title={t('RESET_LEASE_START_DATE')}
                        open={!neverShowResetDialog && isLeaseStartDateInThePast && isExistingQuote}
                        lblOK={t('OK_GOT_IT')}
                        lblCancel={t('CANCEL')}
                        onCloseRequest={() => this.setState({ neverShowResetDialog: true })}
                        onOKClick={() => quoteModel.resetLeaseStartDate()}>
                        <Text>{t('RESET_LEASE_START_DATE_DIALOG_CONTENT')}</Text>
                      </MsgBox>
                      {isRenewalQuote ? (
                        <RenewalQuote
                          inventoryIsUnavailable={inventoryIsUnavailable}
                          inventory={inventory}
                          availableOn={availableOn}
                          shouldDisplayQuoteSections={shouldDisplayQuoteSections}
                          quoteModel={quoteModel}
                          isLeaseStartDateInThePast={isLeaseStartDateInThePast}
                          isEmptyState={isEmptyState}
                          hasAdditionalCharges={hasAdditionalCharges}
                          prorationStrategy={prorationStrategy}
                          activeLeaseWorkflowData={activeLeaseWorkflowData}
                          partyId={partyId}
                          timezone={quoteModel.propertyTimezone}
                          isExistingQuote={isExistingQuote}
                        />
                      ) : (
                        <LeasingQuote
                          inventoryIsUnavailable={inventoryIsUnavailable}
                          inventory={inventory}
                          availableOn={availableOn}
                          shouldDisplayQuoteSections={shouldDisplayQuoteSections}
                          quoteModel={quoteModel}
                          isLeaseStartDateInThePast={isLeaseStartDateInThePast}
                          isEmptyState={isEmptyState}
                          hasAdditionalCharges={hasAdditionalCharges}
                          prorationStrategy={prorationStrategy}
                        />
                      )}
                    </div>;
                  } else if (!fetchingQuote) {
                    <div>
                      <MsgBox
                        key="quotePublish"
                        title={t(isRenewalQuote ? 'SEND_RENEWAL_LETTER' : 'PUBLISH_AND_SEND_QUOTE')}
                        id="sendPublishedQuoteDialog"
                        open={openSendQuote}
                        btnOKDisabled={areAllMembersWithoutEmailPhone}
                        lblOK={t(isRenewalQuote ? 'SEND_NOW' : 'SEND_QUOTE')}
                        lblCancel={t('SEND_LATER')}
                        onOpening={this.handleOnOpeningSendQuoteDialog}
                        onCloseRequest={this.handleOnCloseSendQuote}
                        onCommand={this.handleOnCommandSendQuote}
                        onOKClick={this.sendQuoteToMembers}>
                        <Text>{t(isRenewalQuote ? 'QUOTE_PUBLISH_SEND_RENEWAL_FIRST_TEXT' : 'QUOTE_PUBLISH_SEND_QUOTE_FIRST_TEXT')}</Text>
                        <Text style={{ marginTop: '10px' }}>
                          {t(isRenewalQuote ? 'QUOTE_PUBLISH_SEND_RENEWAL_SECOND_TEXT' : 'QUOTE_PUBLISH_SEND_QUOTE_SECOND_TEXT')}
                        </Text>
                        {this.renderWarningMessage(this.membersWithoutEmailAndPhone, 'QUOTE_PUBLISH_SEND_QUOTE_WARNING_MEMBER')}
                        {this.renderWarningMessage(this.membersOnlyWithAnonymousEmail, 'ANONYMOUS_EMAIL_MESSAGE_FOR_QUOTES')}
                      </MsgBox>
                      {inventory && <QuotePublished quoteFrameId={this.quoteFrameId} quoteId={quoteModel.id} disableApplyLink partyId={partyId} />}
                    </div>;
                  }
                }}
              </div>
            );
          }}
        </Observer>
      </FullScreenDialog>
    );
  }
}

export default QuoteDraft;
