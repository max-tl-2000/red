/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import contains from 'helpers/contains';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import cfg from 'helpers/cfg';
import { t } from 'i18next';
import { windowOpen } from 'helpers/win-open';
import { getUnitPricingUrl } from 'helpers/sisense';
import {
  getParty,
  isPartyNotActive,
  getPartyMembers,
  getFlagShouldReviewMatches,
  isPartyNotInContactState,
  isCorporateParty,
  hasPartyActivePromotionForQuote,
  getAssignedProperty,
  propertyHasResidentDataImportOn,
  isRenewalParty,
  shouldShowInventoryStepper,
  shouldShowRenewalLetterSection,
  shouldShowActiveLeaseSection,
  shouldShowApplicationAndQuotes,
  shouldShowApplicationProgress,
  shouldShowQuoteList,
  shouldShowLeaseListOnNewLeaseWorkflow,
  shouldShowLeaseForm,
  shouldShowTransactionList,
  shouldShowRenewalLetter,
  shouldShowInventoryAndComms,
  shouldShowPartySummarySection,
  isActiveLeaseParty as isActiveLeaseWfParty,
  isNewLeaseParty as isNewLeaseWfParty,
  getActiveLeaseWorkflowData,
  getRenewalPartyId,
  hasRenewalPartyActivePromotionForQuote,
  getSeedPartyData,
} from 'redux/selectors/partySelectors';
import { getPartyFilterSelector, hasRenewalsFeatureOn, canMergeParties } from 'redux/selectors/userSelectors';
import { getScreeningSummary } from 'redux/selectors/screeningSelectors';
import { loadPartyDetailsData, loadPartyComms } from 'redux/modules/appDataLoadingActions';
import { setPartyFilter } from 'redux/modules/dataStore';
import { loadCompanySuggestions } from 'redux/modules/search';
import { saveNavigationHistory } from 'redux/modules/locationTracking';
import { DALTypes } from 'enums/DALTypes';
import * as P from 'components/DualPanelLayout/DualPanelLayout';
import { Button, IconButton, PreloaderBlock, Section, Typography, Status } from 'components';
import { observer, Observer, inject } from 'mobx-react';
import { action, reaction } from 'mobx';
import {
  loadSelectorData,
  loadSelectorDataForParty,
  getTransactions,
  setPartyId,
  clearPartyId,
  clearPartyWorkflow,
  clearAssignPartyError,
  clearPartyRedirectUrl,
  startManualRenewal,
  setRenewalTransition,
  updateCompany,
  addCompany,
} from 'redux/modules/partyStore';
import { updatePartyMember } from 'redux/modules/memberStore';
import { openMergePartyFlyout, closeMergePartyFlyout } from 'redux/modules/mergePartiesStore';
import { clearFilters } from 'redux/modules/unitsFilter';
import { fetchQuotes, clearQuotes, closeNoLeaseTemplatesWarning } from 'redux/modules/quotes';
import { getCommTemplate } from 'redux/modules/commTemplateStore';
import { clearAssignTaskError } from 'redux/modules/tasks.js';
import { loadLayouts } from 'redux/modules/layoutsStore';
import isEqual from 'lodash/isEqual';
import { fetchResults, loadInventoryDetails } from 'redux/modules/inventoryStore';
import { openFlyout, closeNonWidelyAvailableFlyouts } from 'redux/modules/flyoutStore';
import tryParse from 'helpers/try-parse';
import debounce from 'debouncy';
import { endAddingAppointment } from 'redux/modules/appointments.dialog';
import CompanyCard from 'custom-components/Companies/CompanyCard';
import AddCompanyDialog from 'custom-components/Companies/AddCompanyDialog';
import EditCompanyContextMenu from 'custom-components/Companies/EditCompanyContextMenu';
import PartyAppBar from './PartyAppBar';

import TaskListWrapper from './TaskListWrapper';

import ReviewDuplicateBanner from './ReviewDuplicateBanner';
import MergePartyDialog from '../MergePartyDialog/MergePartyDialog';
import PartyPanelWrapper from './PartyPanelWrapper';
import AppointmentListWrapper from './AppointmentListWrapper';
import SalesPersonListWrapper from './SalesPersonListWrapper';
import QualificationQuestionsWrapper from './QualificationQuestionsWrapper';

import PropertySelectionDialogWrapper from './PropertySelectionDialogWrapper';
import SendRenewalLetterDialog from './SendRenewalLetterDialog';
import AppointmentDialogWrapper from './AppointmentDialogWrapper';
import RightPanelModel from './RightPanelModel';
import RightPanelContent from './RightPanelContent';

import ManagePartyPageDlgModel from './ManagePartyPageDlgModel';
import ManagePartyPageWrapper from './ManagePartyPageWrapper';
import InventoryStepperWrapper from './InventoryStepperWrapper';

import QuoteDialogModel from './QuoteDialogModel';
import QuoteDialogWrapper from './QuoteDialogWrapper';
import QuoteListWrapper from './QuoteListWrapper';
import PartyErrorBlock from './PartyErrorBlock';
import ApplicationAndQuotesWrapper from './ApplicationAndQuotesWrapper';
import RenewalLetterSection from './RenewalLetterSection';
import TransactionListWrapper from './TransactionListWrapper';
import LeaseFormDialogModel from './LeaseFormDialogModel';
import LeaseFormDialogWrapperC from './LeaseFormDialogWrapper';
import LeaseListWrapper from './LeaseListWrapper';
import ActiveLeaseSection from './ActiveLeaseSection';
import ApplicationProgressWrapper from './ApplicationProgressWrapper';
import DialogModel from './DialogModel';
import DraftWrapper from './DraftWrapper';
import { createQualificationQuestionsModel } from '../../helpers/models/qualificationQuestionsModel';
import PartySection from './PartySection';
import LoadingModel from './PartyLoadingModel';
import { hasAnsweredRequiredQualificationQuestions, COMPANY_FAKE_ID } from '../../../common/helpers/party-utils';
import PropertyAndTeamSelectionDialogWrapper from './PropertyAndTeamSelectionDialogWrapper';
import PartySummaryWrapper from './PartySummaryWrapper';
import { getPartyTimezone } from '../../redux/selectors/partySelectors';
import { isUnitPricingEnabled } from '../../../common/helpers/utils';
import NotFound from '../NotFound/NotFound';
import { LeaseNotExecutedWarning } from '../../custom-components/SummaryWarnings/LeaseNotExecutedWarning';
import NoLeaseTemplateWarningDialog from '../ProspectDetailPage/NoLeaseTemplateWarningDialog';
import { cf } from './PartyPageUnified.scss';

const { Text } = Typography;
const { MergePartyContext } = DALTypes;
@connect(
  (state, props) => {
    const partyId = props.params.partyId;
    const pageProps = { partyId };
    const party = getParty(state, pageProps);

    return {
      party,
      shouldShowReviewDuplicateOptions: getFlagShouldReviewMatches(state, pageProps),
      partyMembers: getPartyMembers(state, pageProps),
      partyNotActive: isPartyNotActive(state, pageProps),
      partyFilter: getPartyFilterSelector(state),
      quotes: state.quotes.quotes,
      selectorData: state.partyStore.selectorData,
      selectorDataForParty: state.partyStore.selectorDataForParty,
      partyWorkflow: state.partyStore.partyWorkflow,
      globalDataLoaded: state.globalStore.get('globalDataLoaded'),
      properties: state.globalStore.get('properties'),
      currentUser: state.auth.user,
      voidExecutedLeaseLoading: state.leaseStore.voidExecutedLeaseLoading,
      users: state.globalStore.get('users'),
      partyStateIsNotContact: isPartyNotInContactState(state, pageProps),
      partyIsCorporate: isCorporateParty(state, pageProps),
      partyIsRenewal: isRenewalParty(state, pageProps),
      isActiveLeaseParty: isActiveLeaseWfParty(state, pageProps),
      isNewLeaseParty: isNewLeaseWfParty(state, pageProps),
      isLeaseTemplateMissing: state.quotes.isLeaseTemplateMissingWarning,
      filters: state.unitsFilter.filters,
      inventory: state.inventoryStore.inventory,
      shouldApplyFilters: state.unitsFilter.shouldApplyFilters,
      partyLoadingError: state.dataStore.get('partyLoadingError'),
      hasActivePromotionForQuote: hasPartyActivePromotionForQuote(state, pageProps),
      screeningSummary: getScreeningSummary(state, pageProps),
      timezone: getPartyTimezone(state, pageProps),
      errorPartyId: state.dataStore.get('errorPartyId'),
      assignedProperty: getAssignedProperty(state, pageProps),
      showInventoryStepper: shouldShowInventoryStepper(state, pageProps),
      showRenewalLetterSection: shouldShowRenewalLetterSection(state, pageProps),
      showActiveLeaseSection: shouldShowActiveLeaseSection(state, pageProps),
      showApplicationAndQuotes: shouldShowApplicationAndQuotes(state, pageProps),
      showApplicationProgress: shouldShowApplicationProgress(state, pageProps),
      showQuoteList: shouldShowQuoteList(state, pageProps),
      showLeaseListOnNewLeaseWorkflow: shouldShowLeaseListOnNewLeaseWorkflow(state, pageProps),
      showLeaseForm: shouldShowLeaseForm(state, pageProps),
      showTransactionList: shouldShowTransactionList(state, pageProps),
      showRenewalLetter: shouldShowRenewalLetter(state, pageProps),
      showInventoryAndComms: shouldShowInventoryAndComms(state, pageProps),
      showPartySummarySection: shouldShowPartySummarySection(state, pageProps),
      activeLeaseWorkflowData: getActiveLeaseWorkflowData(state, pageProps),
      redirectToPartyUrl: state.partyStore.redirectToPartyUrl,
      renewalPartyId: getRenewalPartyId(state, pageProps),
      hasRenewalPartyActivePromotion: hasRenewalPartyActivePromotionForQuote(state, pageProps),
      renewalsFeatureOn: hasRenewalsFeatureOn(state, pageProps),
      residentDataImportOn: propertyHasResidentDataImportOn(state, pageProps),
      seedPartyData: getSeedPartyData(state, pageProps),
      companySuggestions: state.search.companySuggestions,
      loadingInventoryDetails: state.inventoryStore.loadingInventoryDetails,
      isMergedPartyEnabled: canMergeParties(state, props),
    };
  },
  dispatch =>
    bindActionCreators(
      {
        loadPartyDetailsData,
        loadPartyComms,
        setPartyFilter,
        saveNavigationHistory,
        loadSelectorData,
        loadSelectorDataForParty,
        closeMergePartyFlyout,
        openMergePartyFlyout,
        clearFilters,
        fetchQuotes,
        clearQuotes,
        getCommTemplate,
        loadLayouts,
        getTransactions,
        endAddingAppointment,
        setPartyId,
        clearPartyId,
        fetchResults,
        loadInventoryDetails,
        openFlyout,
        closeNonWidelyAvailableFlyouts,
        clearPartyWorkflow,
        clearAssignTaskError,
        clearAssignPartyError,
        clearPartyRedirectUrl,
        startManualRenewal,
        setRenewalTransition,
        closeNoLeaseTemplatesWarning,
        updateCompany,
        addCompany,
        loadCompanySuggestions,
        updatePartyMember,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class PartyPageUnified extends Component {
  constructor(props) {
    super(props);

    // manages the layout open/close behavior of the right panel in responsive mode
    const dualLayoutModel = new P.LayoutModel();

    // manages the rightPanel communications/units filters toggle behavior
    const rightPanelModel = new RightPanelModel();
    this.stopInventoryPanelShowReaction = reaction(
      () => ({ isCommListVisible: rightPanelModel.isCommListVisible }),
      ({ isCommListVisible }) => {
        !isCommListVisible && this.props.fetchResults({ ...this.props.filters, inventoryAmenities: [], partyId: this.props.partyId });
      },
    );

    // manages the open/close state of the ManageParty dialog
    const dlgModelManageParty = new ManagePartyPageDlgModel();

    // manages the open/close of the quote dialog (aka as QuoteDraft, even when is used to view
    // quotes that are not in Draft state
    const dlgQuoteModel = new QuoteDialogModel();

    // manages the open/close state of the LeaseForm Dialog
    // since this dialog is used from the ApplicationProgress section
    // and from the ApplicationList it is created here and passed down to the
    // the other components
    const dlgLeaseForm = new LeaseFormDialogModel();

    const dlgApplicationSummary = new DialogModel({ open: tryParse(props.location.query.reviewApplication, false) });

    const { qualificationQuestions } = props.party || {};
    const qualificationQuestionsModel = createQualificationQuestionsModel(qualificationQuestions || {}, props.params.partyId);
    const partyLoadingModel = new LoadingModel({ loading: !!props.params.partyId });

    const dlgMergeParties = new DialogModel();

    const dlgSendRenewalLetter = new DialogModel();
    const dlgAddCompany = new DialogModel();

    // dialog models are stored in the state to play nice with hot reloading
    // otherwise these instances are lost when the object is recreated
    this.state = {
      dualLayoutModel,
      openMatch: tryParse(props.location.query.openMatch, false),
      rightPanelModel,
      dlgModelManageParty,
      dlgQuoteModel,
      dlgLeaseForm,
      dlgApplicationSummary,
      qualificationQuestionsModel,
      partyLoadingModel,
      dlgMergeParties,
      dlgSendRenewalLetter,
      dlgAddCompany,
    };
  }

  get partyLoadingModel() {
    return this.state.partyLoadingModel;
  }

  get dualLayoutModel() {
    return this.state.dualLayoutModel;
  }

  get rightPanelModel() {
    return this.state.rightPanelModel;
  }

  get dlgModelManageParty() {
    return this.state.dlgModelManageParty;
  }

  get dlgQuoteModel() {
    return this.state.dlgQuoteModel;
  }

  get dlgLeaseForm() {
    return this.state.dlgLeaseForm;
  }

  get dlgApplicationSummary() {
    return this.state.dlgApplicationSummary;
  }

  get qualificationQuestionsModel() {
    return this.state.qualificationQuestionsModel;
  }

  get dlgMergeParties() {
    return this.state.dlgMergeParties;
  }

  get dlgSendRenewalLetter() {
    return this.state.dlgSendRenewalLetter;
  }

  get dlgAddCompany() {
    return this.state.dlgAddCompany;
  }

  componentWillReceiveProps(nextProps) {
    const { props } = this;
    const { location, party, params } = nextProps;

    if (nextProps.redirectToPartyUrl) {
      const { redirectToPartyUrl } = nextProps;
      props.clearPartyRedirectUrl();
      props.leasingNavigator.navigate(redirectToPartyUrl);
    }

    if (props.params.partyId !== params.partyId) {
      this.clearQualificationQuestions(params.partyId);
    }

    if (!props.party && party) {
      if (Object.keys(party.qualificationQuestions || {}).length > 0) {
        this.restoreQualificationQuestionsModel(party.qualificationQuestions, party.id);
      } else {
        this.clearQualificationQuestions(party.id);
      }

      if (this.state.openMatch) {
        this.openNextMatch(party);
      }

      this.props.setRenewalTransition(false);
    }

    if (this.execUnloadParty(this.props, nextProps)) {
      // if we unloaded the party we don't care about other changes
      // we can just bail out at this point
      return;
    }

    // CHECK: what is this doing and why we need to do it on CWP
    const { users, currentUser, selectorData } = nextProps;
    if (users.size && !(selectorData.users || []).length && currentUser) {
      props.loadSelectorData(users);
      props.loadSelectorDataForParty(users, currentUser, party);
    }

    const nextPropsOpenMergeParties = tryParse(location.query.openMergeParties, false);

    if (nextPropsOpenMergeParties) {
      this.dlgMergeParties.open();
    }
  }

  componentDidUpdate(prevProps) {
    const nextProps = this.props;
    if (this.reloadIfPartyChanged(prevProps, nextProps)) {
      return;
    }
    if (!nextProps.inventory && !nextProps.loadingInventoryDetails) {
      this.loadInventory();
    }
  }

  restoreQualificationQuestionsModel = (qualificationQuestions, partyId) => {
    if (isEqual(qualificationQuestions, this.qualificationQuestionsModel.qualificationQuestions)) return;

    this.qualificationQuestionsModel.restoreData(qualificationQuestions, partyId);
  };

  clearQualificationQuestions = partyId => {
    this.qualificationQuestionsModel.clearForParty(partyId);
  };

  openCommFlyOut = ({ flyoutType, props: flyoutProps } = {}) => {
    const { props, partyId } = this;
    if (!partyId) return;
    const { party, activeLeaseWorkflowData, quotes } = props;
    const { assignedPropertyId: propertyId } = party || {};

    const inventoryId = activeLeaseWorkflowData?.inventory?.id || activeLeaseWorkflowData?.leaseData?.inventoryId;
    const quoteId = quotes.length && quotes[0]?.id;

    props.openFlyout(flyoutType, {
      inventoryId,
      quoteId,
      ...flyoutProps,
      propertyId,
      partyId,
    });
  };

  doOnDidMount = () => {
    const { props } = this;
    const { location } = props;

    // process the newCommType query parameter
    if (location.query.newCommType) {
      this.openCommFlyOut({
        flyoutType: location.query.newCommType,
      });
    }

    reaction(
      () => this.dlgMergeParties.isOpen,
      isOpen => {
        if (!isOpen) return;
        this.openMergeParties();
      },
    );
  };

  openMergeParties = debounce(() => {
    const { partyId, props } = this;
    const { personId } = props.location.query;

    !props.partyIsCorporate &&
      props.openMergePartyFlyout({
        partyId,
        personId,
        mergeContext: DALTypes.MergePartyContext.PERSON,
      });
  }, 500);

  componentDidMount() {
    this.doOnDidMount();
  }

  execUnloadParty(prevProps, nextProps) {
    const { partyId: prevPartyId } = prevProps.params || {};
    const { partyId: nextPartyId } = nextProps.params || {};

    if (prevPartyId !== nextPartyId) {
      this.unloadParty();
      return true;
    }
    return false;
  }

  reloadIfPartyChanged(prevProps, nextProps) {
    const { partyId: prevPartyId } = prevProps.params || {};
    const { partyId: nextPartyId } = nextProps.params || {};

    if (prevPartyId !== nextPartyId) {
      this.loadPartyData();
      this.doOnDidMount();
      return true;
    }
    return false;
  }

  loadInventory = () => {
    const { partyIsRenewal, activeLeaseWorkflowData } = this.props;

    const inventoryId = activeLeaseWorkflowData?.inventory?.id || activeLeaseWorkflowData?.leaseData?.inventoryId;
    if (partyIsRenewal && inventoryId) {
      this.props.loadInventoryDetails({ id: inventoryId });
    }
  };

  async componentWillMount() {
    await this.loadDataForPageAndParty();
    const { users, currentUser, party } = this.props;
    this.props.loadSelectorData(users);
    this.props.loadSelectorDataForParty(users, currentUser, party);
    !this.props.loadingInventoryDetails && this.loadInventory();
  }

  loadDataForPageAndParty = async () => {
    await this.loadPartyData();
  };

  loadDetailsDataForParty = async ({ doNotClearPartyData } = {}) => {
    const { props } = this;
    const {
      params: { partyId },
    } = props;

    const promises = [];

    if (partyId) {
      props.setPartyId(partyId);
      const loadPartyDetailsPromise = props.loadPartyDetailsData(partyId, { silentOnly: doNotClearPartyData });
      promises.push(loadPartyDetailsPromise);

      props.fetchQuotes(partyId);

      const templateName = cfg('smsTemplateNameMap.quoteSmsTemplate');
      props.getCommTemplate(templateName); // fire and forget
      props.loadLayouts();

      props.getTransactions({ partyId, skipActivePartyTest: true });
    }

    return await Promise.all(promises);
  };

  @action
  refreshPartyData = async () => {
    this.showLoadingBlock();
    await this.loadDetailsDataForParty({ doNotClearPartyData: true });
    this.hideLoadingBlock();
  };

  @action
  showLoadingBlock() {
    this.partyLoadingModel.setLoading(true);
  }

  @action
  hideLoadingBlock() {
    this.partyLoadingModel.setLoading(false);
  }

  loadPartyData = async () => {
    const { props } = this;
    const {
      params: { partyId },
      partyFilter,
    } = props;

    props.setPartyFilter(partyFilter);

    if (partyId) {
      this.showLoadingBlock();
      await this.loadDetailsDataForParty();

      this.hideLoadingBlock();

      props.loadPartyComms(partyId);

      // Check, we should do this only if the data for the party
      // was loaded successfully.
      props.saveNavigationHistory({
        entityId: partyId,
        entityType: DALTypes.NavigationHistoryType.PARTY,
      });

      const { drafWrapperRef } = this;

      drafWrapperRef && drafWrapperRef.getWrappedInstance().loadDrafts();
    }
  };

  get partyId() {
    const {
      params: { partyId },
    } = this.props;
    return partyId;
  }

  get isEditMode() {
    return this.partyId !== undefined;
  }

  get isCreateMode() {
    return this.partyId === undefined;
  }

  get isPhaseI() {
    return !this.isPhaseII;
  }

  get isPhaseII() {
    const {
      props: { party },
      isEditMode,
    } = this;

    if (party && party.workflowName !== DALTypes.WorkflowName.NEW_LEASE) return true;

    const { qualificationQuestions = {} } = party || {};
    return isEditMode && hasAnsweredRequiredQualificationQuestions(qualificationQuestions);
  }

  @action
  showInventory = () => {
    const { dualLayoutModel, rightPanelModel } = this;

    dualLayoutModel.compact && dualLayoutModel.openRightPanel();
    rightPanelModel.showInventory();
  };

  @action
  showCommunications = () => {
    const { dualLayoutModel, rightPanelModel } = this;

    dualLayoutModel.compact && dualLayoutModel.openRightPanel();
    rightPanelModel.showCommunications();
  };

  @action
  toggleInventoryAndComms = () => {
    const { showInventoryAndComms } = this.props;
    if (this.rightPanelModel.commsListVisible && showInventoryAndComms) {
      this.showInventory();
    } else {
      this.showCommunications();
    }
  };

  @action
  openUnitPricing = () => {
    windowOpen(getUnitPricingUrl());
  };

  renderActions = () => {
    const { props, dualLayoutModel } = this;
    const tenantName = (props.currentUser || {}).tenantName;
    const buttons = [];
    const btnCommsPanelToggle = (
      <IconButton
        key={'panelToggle'}
        ref={ref => (this.btnCommsToggle = ref)}
        iconName="communication-panel"
        iconStyle="light"
        onClick={dualLayoutModel.toggleRightPanel}
      />
    );

    const btnSisenseUnitPricing = <IconButton key={'unitPricing'} iconName="table-large" iconStyle="light" onClick={this.openUnitPricing} />;

    if ((!props.partyStateIsNotContact || (props.partyStateIsNotContact && props.partyNotActive)) && dualLayoutModel.compact) {
      buttons.push(btnCommsPanelToggle);
    }

    if (props.partyStateIsNotContact && !props.partyNotActive) {
      if (!dualLayoutModel.compact) {
        isUnitPricingEnabled(tenantName) && buttons.push(btnSisenseUnitPricing);
        buttons.push(
          <Observer key={'btnInventoryToggle'}>
            {() => (
              <IconButton
                id="communicationToggle"
                ref={ref => (this.btnInventoryToggle = ref)}
                iconName={this.rightPanelModel.iconForToggleState}
                iconStyle="light"
                onClick={this.toggleInventoryAndComms}
              />
            )}
          </Observer>,
        );
      } else {
        isUnitPricingEnabled(tenantName) && buttons.push(btnSisenseUnitPricing);
        buttons.push(
          <IconButton
            key={'commsIconButton'}
            ref={ref => (this.btnShowComms = ref)}
            iconName={this.rightPanelModel.communicationsIcon}
            iconStyle="light"
            onClick={this.showCommunications}
          />,
          <IconButton
            key={'inventoryIconButton'}
            ref={ref => (this.btnShowInventory = ref)}
            iconName={this.rightPanelModel.inventoryIcon}
            iconStyle="light"
            onClick={this.showInventory}
          />,
        );
      }
    }

    return buttons.length > 0 ? buttons : undefined;
  };

  checkIfClickOnTrigger = args => {
    // do not hide the panel if the click happen in the toggle trigger
    // the toggle will open/close the panel any way
    // and also do not close the panel if the click happened inside the
    // comms and inventory panels toggle
    args.cancel =
      (this.btnInventoryToggle && contains(findDOMNode(this.btnInventoryToggle), args.target)) ||
      (this.btnCommsToggle && contains(findDOMNode(this.btnCommsToggle), args.target)) ||
      (this.btnShowComms && contains(findDOMNode(this.btnShowComms), args.target)) ||
      (this.btnShowInventory && contains(findDOMNode(this.btnShowInventory), args.target));
  };

  @action
  reviewMatches = () => {
    const { props, dlgModelManageParty, isPhaseI } = this;
    const { partyMembers } = props;

    const memberToOpen = partyMembers.find(m => m.person.strongMatchCount > 0);
    if (!memberToOpen) return;

    if (isPhaseI) {
      this.setState({ memberToOpen });
    } else {
      dlgModelManageParty.setMemberToOpen(memberToOpen);
      dlgModelManageParty.open();
    }
  };

  @action
  openNextMatch = party => {
    const { dlgModelManageParty, props } = this;
    if (!party || !party.partyMembers || !party.partyMembers.length) return;

    const { personId } = props.location.query;
    const memberToOpen = party.partyMembers.find(m => m.personId === personId);

    if (memberToOpen) {
      if (party.qualificationQuestions && party.qualificationQuestions.numBedrooms.length) {
        dlgModelManageParty.setMemberToOpen(memberToOpen);
        dlgModelManageParty.open();
      } else {
        this.setState({ memberToOpen });
      }
    }
  };

  @action
  handleAddEmailAddress = memberId => {
    const { props, dlgModelManageParty } = this;
    const { partyMembers } = props;

    const memberToOpen = partyMembers.find(m => m.id === memberId);
    if (!memberToOpen) return;

    dlgModelManageParty.setMemberToOpen(memberToOpen);
    dlgModelManageParty.open();
  };

  get openThreadId() {
    return this.props.location.query.threadId;
  }

  @action
  unloadParty() {
    const { props } = this;
    props.closeMergePartyFlyout();
    props.closeNonWidelyAvailableFlyouts();
    this.dlgApplicationSummary.close();
    this.dlgLeaseForm.close();
    this.dlgQuoteModel.closeQuote();
    this.dlgModelManageParty.close();
    props.endAddingAppointment();

    props.clearPartyId();
    props.clearPartyWorkflow();
    props.clearFilters();
    props.clearQuotes();
    props.clearAssignTaskError();
    props.clearAssignPartyError();
  }

  componentWillUnmount() {
    this.unloadParty();
    this.stopInventoryPanelShowReaction && this.stopInventoryPanelShowReaction();
  }

  handleNavigateBack = () => {
    const { qqSectionRef } = this;
    if (qqSectionRef) {
      qqSectionRef.getWrappedInstance().saveQuestionsAnswers();
    }
  };

  get defaultFocusedAppointmentId() {
    return this.props.params.appointmentId;
  }

  handleOpenManageParty = () => {
    this.dlgModelManageParty.open();
  };

  storeQQSectionRef = ref => {
    this.qqSectionRef = ref;
  };

  handleOpenQuote = ({ inventory, isRenewalQuote }) => {
    this.dlgQuoteModel.openOrCreateQuote({ inventory, isRenewalQuote });
  };

  handleInventoryStepChange = openStepper => {
    const { rightPanelModel } = this;

    if (rightPanelModel.isCommListVisible === openStepper) {
      rightPanelModel.showInventory();
    }
  };

  @action
  handleOpenQuoteRequest = ({ quote, isRenewalQuote }) => {
    this.dlgQuoteModel.openExistingQuote({ quote, isRenewalQuote });
  };

  @action
  handleOpenManagePartyPageRequest = () => {
    this.dlgModelManageParty.open();
  };

  @action
  handleOpenLease = lease => {
    if (!lease) {
      throw new Error('A Lease object is required');
    }
    this.dlgLeaseForm.setSelectedLeaseIdAndOpen(lease.id);
  };

  @action
  handleOpenNewLease = leaseId => {
    this.dlgLeaseForm.setSelectedLeaseIdAndOpen(leaseId);
  };

  @action
  handleOpenSendRenewalLetterDialog = shouldOpenDialog => {
    shouldOpenDialog ? this.dlgSendRenewalLetter.open() : this.dlgSendRenewalLetter.close();
  };

  @action
  handleOpenAddCompanyDialog = shouldOpenDialog => {
    shouldOpenDialog ? this.dlgAddCompany.open() : this.dlgAddCompany.close();
  };

  handleSaveCompany = async (company, partyMember) => {
    if (company.companyName.trim()) {
      if (partyMember) {
        this.setState({ company });
        await this.props.addCompany(company.companyName, partyMember.id);
      } else {
        this.setState({ company }); // company will be created together with the point of contact, if needed
      }

      this.refreshPartyData();
    }
  };

  handleUpdatePartyMember = async (companyId, partyMember) => {
    await this.props.updatePartyMember({ ...partyMember, companyId }, partyMember.partyId);
    this.refreshPartyData();
  };

  handleOpenReviewApplicationRequest = ({ quoteId, leaseTermId, applicationDecision, selectedLeaseTerm } = {}) => {
    this.setState({ selectedQuoteId: quoteId, selectedLeaseTermId: leaseTermId, applicationDecision, selectedLeaseTerm });
    this.dlgApplicationSummary.open();
  };

  handleChangePartyType = ({ partyType, clientUpdate }) => {
    if (partyType === DALTypes.PartyTypes.TRADITIONAL) {
      this.setState({ company: null });
    }

    const { qqSectionRef } = this;
    if (!qqSectionRef) return;

    this.qualificationQuestionsModel.changePartyType(partyType);
    !clientUpdate && qqSectionRef.getWrappedInstance().saveQuestionsAnswers();
  };

  getQualificationQuestionsAndFilters = () => {
    const { qqSectionRef } = this;
    if (!qqSectionRef) return {};
    return qqSectionRef.getWrappedInstance().qualificationQuestionsAndFilters;
  };

  goToDashboard = () => this.props.leasingNavigator.navigateToDashboard();

  storePanelWrapperRef = ref => {
    this.panelWrapperRef = ref;
  };

  setFocusOnPartyPanel = () => {
    const { panelWrapperRef } = this;
    // component uses connect and inject
    // each of them wraps the component into a wrapper
    const wrappedInstanceRedux = panelWrapperRef && panelWrapperRef.getWrappedInstance();
    const wrappedInstanceMobx = wrappedInstanceRedux.wrappedInstance;

    wrappedInstanceMobx && wrappedInstanceMobx.focus();
  };

  getPropertiesAssignedToParty = () => {
    const { properties = [], filters: { propertyIds = [] } = {}, party: { assignedPropertyId } = {} } = this.props;
    const assignedProperty = properties.find(p => p.id === assignedPropertyId);
    const propertiesFromFilters = properties.filter(
      property => property.id !== assignedPropertyId && propertyIds.some(propertyId => propertyId === property.id),
    );
    return [assignedProperty, ...propertiesFromFilters].filter(p => p);
  };

  closeCreateEditResidentForm = () => {
    this.dlgModelManageParty.setMemberToOpen(null);
    if (this.state.memberToOpen) {
      this.setState({ memberToOpen: null });
    }
  };

  handlePersonUpdate = () => {
    if (this.state.openMatch) {
      this.setState({ memberToOpen: null, openMatch: false });
    }
  };

  handleManualRenewal = () => {
    const { partyId } = this;
    this.props.startManualRenewal({ partyId });
  };

  handleSetRenewalTransition = () => this.props.setRenewalTransition();

  isRenewalV1PartyNotMigrated = party => party?.metadata?.V1RenewalState === DALTypes.V1RenewalState.UNUSED;

  isRenewalV1Party = party => party && !party.seedPartyId && party.workflowName === DALTypes.WorkflowName.RENEWAL;

  renderLeaseListWrapper = () => {
    const { props, partyId, dlgLeaseForm } = this;
    const { party, partyIsRenewal } = props;

    return (
      <LeaseListWrapper
        partyId={partyId}
        party={party}
        dlgLeaseForm={dlgLeaseForm}
        isRenewal={partyIsRenewal}
        handleOpenManageParty={this.handleOpenManageParty}
      />
    );
  };

  preventKeyboardNavigation = e => {
    const { partyNotActive } = this.props;
    if (!partyNotActive) return;

    e.stopPropagation();
    e.preventDefault();
  };

  handleContextMenuAction = () => {
    this.setState({ contextOpen: false });
    this.handleOpenAddCompanyDialog(true);
  };

  renderContextMenu = () => (
    <EditCompanyContextMenu
      defaultActions={true}
      open={this.state.contextOpen}
      onSelect={this.handleContextMenuAction}
      positionArgs={{
        my: 'left top',
        at: 'left top',
        of: this.state.trigger,
      }}
      onCloseRequest={this.closeContextMenu}
      editLabel={t('EDIT_COMPANY_DETAILS')}
    />
  );

  showContextMenu = (e, item) => {
    e.preventDefault();
    this.setState({ trigger: e.target, editingItem: item, contextOpen: true });
  };

  handleLoadCompanySuggestions = async input => {
    const { query } = input;
    if (!query) return [];

    await this.props.loadCompanySuggestions(query);
    return this.props.companySuggestions;
  };

  renderCompanySection = partyMember => {
    const companyName = partyMember?.companyId ? partyMember?.displayName : this.state.company?.companyName;
    const companyId = partyMember?.companyId;

    return (
      <Section title={t('COMPANY_DETAILS')} data-id="companySection">
        {!companyName && (
          <div>
            <Text className={cf('companySection')} secondary>
              {t('COMPANY_DETAILS_LABEL')}
            </Text>
            <Button data-id="addCompanyBtn" btnRole={'primary'} type={'flat'} label={t('ADD_COMPANY')} onClick={this.handleOpenAddCompanyDialog} />
          </div>
        )}
        {companyName && <CompanyCard companyId={companyId} companyName={companyName} pointOfContact={partyMember} onItemSelected={this.showContextMenu} />}
        {this.renderContextMenu()}
      </Section>
    );
  };

  handleMergePartyDialogOpen = ({ personId, propertyId, oldPropertyId }) => {
    const { props, partyId } = this;
    const { isMergedPartyEnabled } = props;

    const mergeContext = (personId && MergePartyContext.PERSON) || (propertyId && MergePartyContext.PROPERTY_CHANGE) || MergePartyContext.PARTY;
    isMergedPartyEnabled &&
      props.openMergePartyFlyout({
        partyId,
        personId,
        propertyId,
        oldPropertyId,
        mergeContext,
      });
  };

  render() {
    const { props, partyId, isPhaseI, isPhaseII, dualLayoutModel, defaultFocusedAppointmentId, state } = this;
    const {
      party,
      partyNotActive,
      shouldShowReviewDuplicateOptions,
      properties,
      selectorDataForParty,
      currentUser,
      partyIsCorporate,
      partyIsRenewal,
      filters,
      partyLoadingError,
      errorPartyId,
      partyMembers,
      hasActivePromotionForQuote,
      screeningSummary,
      timezone,
      assignedProperty,
      globalDataLoaded,
      users,
      showInventoryStepper,
      showRenewalLetterSection,
      showActiveLeaseSection,
      showApplicationAndQuotes,
      showApplicationProgress,
      showQuoteList,
      showLeaseListOnNewLeaseWorkflow,
      showLeaseForm,
      showTransactionList,
      showRenewalLetter,
      showInventoryAndComms,
      showPartySummarySection,
      isActiveLeaseParty,
      isNewLeaseParty,
      activeLeaseWorkflowData,
      renewalPartyId,
      hasRenewalPartyActivePromotion,
      inventory,
      renewalsFeatureOn,
      residentDataImportOn,
      seedPartyData,
      isLeaseTemplateMissing,
      voidExecutedLeaseLoading,
    } = props;

    const partyMember = partyMembers.find(member => member.personId);
    const company =
      (partyMember?.companyId && { id: partyMember?.companyId, displayName: partyMember?.displayName }) ||
      (this.state.company?.companyId && { id: this.state.company?.companyId, displayName: this.state.company?.companyName }) ||
      '';
    const companyToSaveWrapper =
      this.state.company?.companyId === COMPANY_FAKE_ID
        ? { companyName: this.state.company?.companyName }
        : { companyName: this.state.company?.companyName, companyId: this.state.company?.companyId };
    const companyToSave = this.state.company ? companyToSaveWrapper : company;
    const personId = partyMember?.personId;
    const { selectedQuoteId, selectedLeaseTermId, applicationDecision, dlgSendRenewalLetter, selectedLeaseTerm, dlgAddCompany } = state;
    const errorOnLoadedParty = errorPartyId === partyId && partyLoadingError ? partyLoadingError : undefined;
    const { seedPartyId } = party || {};
    const { workflowName: seedPartyWorkflowName } = seedPartyData || {};
    const leaseNotExecuted =
      isActiveLeaseParty && activeLeaseWorkflowData?.currentLeaseStatus === DALTypes.LeaseStatus.SUBMITTED && seedPartyId && seedPartyWorkflowName;
    if (this.isRenewalV1Party(party) && this.isRenewalV1PartyNotMigrated(party)) return <NotFound />;

    return (
      <div data-component="partyPage" className="view-element" data-phase={isPhaseI ? 'phaseI' : 'phaseII'}>
        {voidExecutedLeaseLoading && <Status processing={voidExecutedLeaseLoading} height={4} className={cf('progressBar')} />}
        <div className={cf('disabledPartyPage', { disabled: voidExecutedLeaseLoading })}> </div>
        <PartyAppBar
          showInventoryAndComms={showInventoryAndComms}
          onReviewMatchRequest={this.reviewMatches}
          partyLoadingError={errorOnLoadedParty}
          party={party}
          partyId={partyId}
          property={assignedProperty}
          timezone={timezone}
          openCommFlyOut={this.openCommFlyOut}
          partyLoadingModel={this.partyLoadingModel}
          onPartyTitleClick={this.handleOpenManageParty}
          onNavigateBack={this.handleNavigateBack}
          renderActions={this.renderActions}
          isCorporateParty={isPhaseII && partyIsCorporate}
          leaseNotExecuted={!!leaseNotExecuted}
          handleMergeParties={this.handleMergePartyDialogOpen}
          partyClosedOrArchived={partyNotActive}
        />
        {!errorOnLoadedParty && globalDataLoaded && (
          <div>
            <P.PanelsContainer model={dualLayoutModel} onRightPanelClickOutside={this.checkIfClickOnTrigger} paddingTop={partyNotActive ? '8.5rem' : '4rem'}>
              <P.LeftPanel useExtraBottomPadding blocked={partyNotActive} onKeyDown={e => this.preventKeyboardNavigation(e)}>
                {leaseNotExecuted && <LeaseNotExecutedWarning seedPartyWorkflowName={seedPartyWorkflowName} seedPartyId={seedPartyId} />}
                {isPhaseI && (
                  <PartySection partyLoadingModel={this.partyLoadingModel}>
                    {shouldShowReviewDuplicateOptions && <ReviewDuplicateBanner onReviewMatchRequest={this.reviewMatches} />}
                    {!partyId && <PropertyAndTeamSelectionDialogWrapper />}
                    {party && showPartySummarySection && (
                      <PartySummaryWrapper party={party} partyId={partyId} partyMembers={partyMembers} timezone={timezone} />
                    )}
                    {party && <TaskListWrapper partyId={partyId} party={party} timezone={timezone} />}
                    <PartyPanelWrapper
                      ref={this.storePanelWrapperRef}
                      partyId={partyId}
                      party={party}
                      company={companyToSave}
                      onPersonUpdate={this.handlePersonUpdate}
                      isCorporateParty={partyIsCorporate || this.qualificationQuestionsModel.isCorporateGroupProfile}
                      isPartyInPhaseI={isPhaseI}
                      onChangePartyType={this.handleChangePartyType}
                      getAdditionalData={this.getQualificationQuestionsAndFilters}
                      memberToOpen={this.state.memberToOpen}
                      timezone={timezone}
                      closeCreateEditResidentForm={this.closeCreateEditResidentForm}
                    />
                    {this.qualificationQuestionsModel.isCorporateGroupProfile && this.renderCompanySection(partyMember)}
                    <QualificationQuestionsWrapper
                      partyId={partyId}
                      party={party}
                      properties={properties}
                      ref={this.storeQQSectionRef}
                      onQuestionsSave={this.refreshPartyData}
                      qualificationQuestionsModel={this.qualificationQuestionsModel}
                      showLeaseTypeQuestion={!isPhaseI}
                    />
                    {party && (
                      <AppointmentListWrapper
                        partyId={partyId}
                        timezone={timezone}
                        partyLoadingModel={this.partyLoadingModel}
                        defaultFocusedAppointmentId={defaultFocusedAppointmentId}
                      />
                    )}
                    {party && <SalesPersonListWrapper partyId={partyId} party={party} timezone={timezone} />}
                  </PartySection>
                )}
                {isPhaseII && (
                  <PartySection partyLoadingModel={this.partyLoadingModel}>
                    {shouldShowReviewDuplicateOptions && <ReviewDuplicateBanner onReviewMatchRequest={this.reviewMatches} />}
                    {showPartySummarySection && (
                      <PartySummaryWrapper
                        party={party}
                        partyId={partyId}
                        partyMembers={partyMembers}
                        inventory={inventory}
                        timezone={timezone}
                        partyIsRenewal={partyIsRenewal}
                        activeLeaseWorkflowData={activeLeaseWorkflowData}
                        hasRenewalPartyActivePromotion={hasRenewalPartyActivePromotion}
                        onManagePartyLinkClicked={this.handleOpenManageParty}
                      />
                    )}
                    <TaskListWrapper partyId={partyId} party={party} timezone={timezone} />
                    {showInventoryStepper && (
                      <InventoryStepperWrapper
                        party={party}
                        partyId={partyId}
                        properties={properties}
                        isCorporateParty={partyIsCorporate}
                        onInventoryStepChange={this.handleInventoryStepChange}
                        isInventoryListVisible={!this.rightPanelModel.commsListVisible}
                      />
                    )}
                    {!isActiveLeaseParty && (
                      <AppointmentListWrapper
                        partyId={partyId}
                        timezone={timezone}
                        partyLoadingModel={this.partyLoadingModel}
                        defaultFocusedAppointmentId={defaultFocusedAppointmentId}
                      />
                    )}
                    {!hasRenewalPartyActivePromotion && showRenewalLetterSection && (
                      <RenewalLetterSection
                        partyId={partyId}
                        party={party}
                        activeLeaseWorkflowData={activeLeaseWorkflowData}
                        timezone={timezone}
                        inventory={inventory}
                        handleSendRenewalLetter={this.handleOpenQuote}
                        openRenewalLetterRequest={this.handleOpenQuoteRequest}
                        onOpenNewLeaseRequest={this.handleOpenLease}
                        handleShowDialog={this.handleOpenSendRenewalLetterDialog}
                      />
                    )}
                    {hasRenewalPartyActivePromotion && this.renderLeaseListWrapper()}
                    {showActiveLeaseSection && (
                      <ActiveLeaseSection
                        activeLeaseWorkflowData={activeLeaseWorkflowData}
                        timezone={timezone}
                        isActiveLeaseParty={isActiveLeaseParty}
                        currentUser={currentUser}
                        seedPartyWorkflowName={seedPartyWorkflowName}
                        startManualRenewal={this.handleManualRenewal}
                        setRenewalTransition={this.handleSetRenewalTransition}
                        partyId={partyId}
                        renewalPartyId={renewalPartyId}
                        seedPartyId={seedPartyId}
                        partyIsRenewal={partyIsRenewal}
                        renewalsFeatureOn={renewalsFeatureOn}
                        residentDataImportOn={residentDataImportOn}
                      />
                    )}
                    {isActiveLeaseParty && (
                      <AppointmentListWrapper
                        partyId={partyId}
                        timezone={timezone}
                        isActiveLeaseParty={isActiveLeaseParty}
                        partyLoadingModel={this.partyLoadingModel}
                        defaultFocusedAppointmentId={defaultFocusedAppointmentId}
                      />
                    )}
                    {!hasActivePromotionForQuote && showApplicationAndQuotes && (
                      <ApplicationAndQuotesWrapper
                        screeningSummary={screeningSummary}
                        partyId={partyId}
                        party={party}
                        timezone={timezone}
                        partyMembers={partyMembers}
                        propertiesAssignedToParty={this.getPropertiesAssignedToParty()}
                        openManagePartyRequest={this.dlgModelManageParty.open}
                        partyIsCorporate={partyIsCorporate}
                        partyIsRenewal={partyIsRenewal}
                      />
                    )}
                    {(hasActivePromotionForQuote || this.dlgApplicationSummary.isOpen) && showApplicationProgress && (
                      <ApplicationProgressWrapper
                        screeningSummary={screeningSummary}
                        partyId={partyId}
                        party={party}
                        partyMembers={partyMembers}
                        onOpenLeaseFormRequest={this.handleOpenLease}
                        dlgApplicationSummary={this.dlgApplicationSummary}
                        onOpenReviewApplicationRequest={this.handleOpenReviewApplicationRequest}
                        selectedQuoteId={selectedQuoteId}
                        selectedLeaseTermId={selectedLeaseTermId}
                        selectedLeaseTerm={selectedLeaseTerm}
                        hasActivePromotionForQuote={hasActivePromotionForQuote}
                        applicationDecision={applicationDecision}
                        renderQuotes={hasApplicationRequireWorkStatus => (
                          <QuoteListWrapper
                            partyId={partyId}
                            party={party}
                            partyMembers={partyMembers}
                            displayActionButton={hasApplicationRequireWorkStatus}
                            onOpenQuoteRequest={this.handleOpenQuoteRequest}
                            onOpenManagePartyPageRequest={this.handleOpenManagePartyPageRequest}
                            onOpenNewLeaseRequest={this.handleOpenNewLease}
                            onOpenReviewApplicationRequest={this.handleOpenReviewApplicationRequest}
                            onOpenLeaseFormRequest={this.handleOpenLease}
                          />
                        )}
                      />
                    )}
                    {!hasActivePromotionForQuote && showQuoteList && (
                      <QuoteListWrapper
                        partyId={partyId}
                        party={party}
                        timezone={timezone}
                        partyMembers={partyMembers}
                        onOpenQuoteRequest={this.handleOpenQuoteRequest}
                        onOpenManagePartyPageRequest={this.handleOpenManagePartyPageRequest}
                        onOpenNewLeaseRequest={this.handleOpenNewLease}
                        onOpenReviewApplicationRequest={this.handleOpenReviewApplicationRequest}
                        onOpenLeaseFormRequest={this.handleOpenLease}
                      />
                    )}
                    {showLeaseListOnNewLeaseWorkflow && this.renderLeaseListWrapper()}
                    {showLeaseForm && (
                      <LeaseFormDialogWrapperC
                        partyId={partyId}
                        activeLeaseWorkflowData={activeLeaseWorkflowData}
                        dlgLeaseForm={this.dlgLeaseForm}
                        partyMembers={partyMembers}
                        selectedLeaseId={this.dlgLeaseForm.selectedLeaseId}
                        isCorporateParty={partyIsCorporate}
                        properties={properties}
                        party={party}
                        onAddEmailAddress={this.handleAddEmailAddress}
                        isRenewal={partyIsRenewal}
                        dlgApplicationSummary={this.dlgApplicationSummary}
                      />
                    )}
                    {showTransactionList && <TransactionListWrapper partyId={partyId} timezone={timezone} />}
                    {partyId && <SalesPersonListWrapper partyId={partyId} party={party} timezone={timezone} />}
                  </PartySection>
                )}
                <Observer>{() => this.partyLoadingModel.loading && <PreloaderBlock modal topAligned />}</Observer>
              </P.LeftPanel>
              <P.RightPanel useExtraBottomPadding>
                <RightPanelContent
                  partyId={partyId}
                  properties={properties}
                  party={party}
                  openCommFlyOut={this.openCommFlyOut}
                  isClosed={partyNotActive}
                  handleQuoteClick={this.handleOpenQuote}
                  openThreadId={this.openThreadId}
                  model={this.rightPanelModel}
                  partyStateIsNotContact={props.partyStateIsNotContact}
                />
              </P.RightPanel>
            </P.PanelsContainer>
            <DraftWrapper ref={ref => (this.drafWrapperRef = ref)} partyId={partyId} currentUser={currentUser} openCommFlyOut={this.openCommFlyOut} />
            <PropertySelectionDialogWrapper party={party} partyId={partyId} currentUser={currentUser} onClose={this.setFocusOnPartyPanel} users={users} />
            {party && <MergePartyDialog personId={personId} properties={properties} selectorData={selectorDataForParty} timezone={timezone} />}
            {party && (
              <AppointmentDialogWrapper
                property={assignedProperty}
                partyId={partyId}
                party={party}
                propertyIds={(filters || {}).propertyIds}
                properties={properties}
              />
            )}
            {props.partyStateIsNotContact && (
              <QuoteDialogWrapper
                model={this.dlgQuoteModel}
                partyId={partyId}
                party={party}
                filters={filters}
                timezone={timezone}
                activeLeaseWorkflowData={activeLeaseWorkflowData}
                openCommFlyOut={this.openCommFlyOut}
              />
            )}
            {props.partyStateIsNotContact && (
              <ManagePartyPageWrapper
                model={this.dlgModelManageParty}
                partyId={partyId}
                party={party}
                partyMembers={partyMembers}
                onPersonUpdate={this.handlePersonUpdate}
                properties={properties}
                isCorporateParty={partyIsCorporate}
                isActiveLeaseParty={isActiveLeaseParty}
                isNewLeaseParty={isNewLeaseParty}
                closeCreateEditResidentForm={this.closeCreateEditResidentForm}
                partyClosedOrArchived={partyNotActive}
                isRenewalParty={partyIsRenewal}
                handleSaveCompany={this.handleSaveCompany}
                handleLoadSuggestions={this.handleLoadCompanySuggestions}
                handleUpdatePartyMember={this.handleUpdatePartyMember}
                handleMergeParties={this.handleMergePartyDialogOpen}
              />
            )}
            {showRenewalLetter && dlgSendRenewalLetter.isOpen && (
              <SendRenewalLetterDialog
                open={dlgSendRenewalLetter.isOpen}
                partyId={partyId}
                partyMembers={partyMembers}
                handleShowDialog={this.handleOpenSendRenewalLetterDialog}
              />
            )}
            {dlgAddCompany.isOpen && (
              <AddCompanyDialog
                open={dlgAddCompany.isOpen}
                companyId={company?.id}
                companyName={company?.displayName}
                partyMember={partyMember}
                companySuggestions={company ? [company] : []}
                handleShowDialog={this.handleOpenAddCompanyDialog}
                handleLoadSuggestions={this.handleLoadCompanySuggestions}
                handleSaveCompany={this.handleSaveCompany}
                handleUpdatePartyMember={this.handleUpdatePartyMember}
              />
            )}
            <NoLeaseTemplateWarningDialog open={isLeaseTemplateMissing} closeDialog={this.props.closeNoLeaseTemplatesWarning} />
          </div>
        )}
        <PartyErrorBlock error={errorOnLoadedParty} onGotoDashboardRequest={this.goToDashboard} partyId={partyId} />
      </div>
    );
  }
}
