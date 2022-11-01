/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Field, reduxForm, formValueSelector } from 'redux-form';
import { t } from 'i18next';
import keyBy from 'lodash/keyBy';
import { windowOpen } from 'helpers/win-open';
import { loadInventoryDetails } from 'redux/modules/inventoryStore';
import {
  TwoPanelPage,
  LeftPanel,
  RightPanel,
  Icon,
  Button,
  Typography,
  IconButton,
  RedTable,
  Section,
  CheckBox,
  Dropdown,
  SelectionGroup,
  PreloaderBlock,
  FlyOutAmountEditor,
  NotificationBanner,
} from 'components';
import { ICON_CELL_WIDTH } from 'helpers/tableConstants';
import { getQuoteLayoutSummary } from 'helpers/inventory';
import {
  sortByOptionalAndAlphabetically,
  getAdjFormOfPeriod,
  getPeriodName,
  getMaxAmountLimit,
  getCharges,
  quoteSectionRepresentation,
  adjustmentText,
  excludeExternalChargeCodes,
} from 'helpers/quotes';
import ConfirmLeaseTermDialog from './ConfirmLeaseTermDialog';
import ConfirmStartDateChangeDialog from './ConfirmStartDateChangeDialog';
import { cf } from './LeaseForm.scss';
import { Charges, QuoteSection } from '../../../common/enums/quoteTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { ApplicationSettingsValues } from '../../../common/enums/applicationTypes';
import { contains, LeaseDocuments } from '../../../common/helpers/leaseDocuments';
import {
  getMembersWithModifiedEmails,
  hasPartyMemberNumberChanged,
  getMembersWithModifiedNames,
  getMembersWithModifiedCompanyName,
  shouldShowLeaseWarningCheck,
} from '../../../common/helpers/lease';
import {
  getSelectedInventories,
  getConcessionValue,
  getEndDateFromStartDate,
  calculateRelativeAdjustment,
  calculateNewLeaseTerms,
  getActiveChargesForLeaseForm,
  getSelectedFee,
} from '../../../common/helpers/quotes';
import { UnitReservedWarning } from '../../custom-components/SummaryWarnings/UnitReservedWarning';
import LeaseMembersAndEmailsChangedWarning from '../../custom-components/SummaryWarnings/LeaseMembersAndEmailsChangedWarning';
import InventorySelection from './InventorySelection';
import ChargeStepperSection from './ChargeStepperSection';

import { getUnitReservedWarning, getModelWithDuplicateFlag } from '../../redux/selectors/leaseSelectors';
import { leasingNavigator } from '../../helpers/leasing-navigator';
import { now, toMoment, duration, isSameDay } from '../../../common/helpers/moment-utils';
import { isDateBeforeDate, isDateAfterDate, isDateInThePast } from '../../../common/helpers/date-utils';

import DateSelector from '../../components/DateSelector/DateSelector';
import ComplimentaryItems from '../../custom-components/QuoteSummary/ComplimentaryItems';
import { LeaseStartWarning } from '../../custom-components/SummaryWarnings/LeaseStartWarning';
import LeaseOccupantsDropdown from '../../custom-components/LeaseOccupantsDropdown/LeaseOccupantsDropdown';
import { InvalidEmailWarning } from '../../custom-components/SummaryWarnings/InvalidEmailWarning';
import { getInventoryAvailabilityByLease, getAllowRentableItemSelection } from '../../redux/selectors/inventorySelectors';
import {
  getConcessionValues,
  getLeaseDataToPublish,
  MIN_START_DAYS_DIFFERENCE,
  MIN_OVERALL_DAYS_DIFFERENCE,
  getChargeFieldNameType,
} from '../../helpers/leaseFormHelper';
import { canHaveRentableItems, isInventoryGroupFee, getAdditionalAndOneTimeFeesFromPublishTermPeriod } from '../../helpers/leaseUtils';
import { getMembersWithInvalidEmail, areOccupantsAllowed } from '../../helpers/party';
import { convertToCamelCaseAndRemoveBrackets } from '../../../common/helpers/strings';
import { SHORT_MONTH_ORDINAL_DAY_FORMAT } from '../../../common/date-constants';
import { formatUnitAddress } from '../../../common/helpers/addressUtils';
import { setDefaultVariableAmount, updateAdditionalChargesParentFee, getMaxAmount } from '../../../common/helpers/fee';

const { Text, SubHeader, Caption, TextHeavy } = Typography;

const { Table, Row, RowHeader, Cell, GroupTitle, TextPrimary, TextSecondary, Money } = RedTable;

const shouldToggleAmountEditor = (concession, baseValue) => concession?.optional && concession?.variableAdjustment && !baseValue;

const setDifference = (set1, set2) => new Set([...set1].filter(x => !set2.has(x)));

const computeConcessionRelativeAmount = (concession, baseRent) => {
  const relativeAdjustment = Math.abs(concession.relativeAdjustment);
  return calculateRelativeAdjustment(baseRent, relativeAdjustment);
};

const handleDateChange = (changeHandler, key, newValue, oldValue, input) => {
  const updateFunction = value => {
    input.onChange(value);
    input.onBlur();
  };

  switch (key) {
    case 'LEASE_START_DATE':
    case 'LEASE_END_DATE': {
      changeHandler(key, newValue, oldValue, updateFunction);
      break;
    }
    default:
      input.onChange(newValue);
      return;
  }
};

const rfDatePicker = ({ input, meta, validate, tz, errorMessage, changeHandler, ...rest }) => (
  <DateSelector
    wide
    appendToBody={true}
    zIndex={150}
    tz={tz}
    selectedDate={input.value ? toMoment(input.value, { timezone: tz }) : undefined}
    onChange={value => {
      handleDateChange(changeHandler, input.name, value ? value.toISOString() : value, input.value, input);
    }}
    errorMessage={errorMessage || t((meta.invalid && meta.error) || '')}
    warningMessage={t((!meta.invalid && meta.warning) || '')}
    enableSetDateOverlappingLimits
    {...rest}
  />
);

const selectAdditionalChargeCheckbox = ({ selectCheckboxName, input, updateFieldValue, feeChildren, value }) => {
  input && input.onChange(value);
  selectCheckboxName && updateFieldValue(selectCheckboxName, value);
  updateFieldValue &&
    feeChildren &&
    feeChildren.forEach(childId => {
      updateFieldValue(`onetime_${childId}_checkbox`, value);
    });
};

const rfCheckBox = ({
  input,
  meta,
  validate,
  updateFieldValue,
  feeChildren,
  concession,
  parentFee,
  baseValue,
  toggleAmountEditor,
  isInventorySelectionEnabled,
  handleUnavailableRentableItemsSelected,
  handleNoRentableItemsSelected,
  selectedInventories,
  isOneTime,
  selectCheckboxName,
  fee,
  ...rest
}) => (
  <CheckBox
    onChange={value => {
      selectAdditionalChargeCheckbox({ input, updateFieldValue, feeChildren, value, selectCheckboxName });
      if (shouldToggleAmountEditor(concession, rest.baseValue)) {
        toggleAmountEditor && toggleAmountEditor(concession.id, value);
      }
      if (!value && concession && concession.variableAdjustment) {
        updateFieldValue(`concession_${concession.id}_amountVariableAdjustment`, 0);
        updateFieldValue(`concession_${concession.id}_amount`, 0);
        updateFieldValue(`concession_${concession.id}_computedAmount`, 0);
        parentFee && !isOneTime && updateFieldValue(`additional_${parentFee.id}_concession_${concession.id}_amount`, 0);
        parentFee && isOneTime && updateFieldValue(`onetime_${parentFee.id}_concession_${concession.id}_amount`, 0);
      }

      if (isInventorySelectionEnabled) {
        if (value) {
          const noRentableItemsSelected = !selectedInventories.length;
          const unavailableRentableItemsSelected = !!selectedInventories.filter(inv => inv.unavailable).length;
          handleNoRentableItemsSelected && handleNoRentableItemsSelected(noRentableItemsSelected, fee.id);
          handleUnavailableRentableItemsSelected && handleUnavailableRentableItemsSelected(unavailableRentableItemsSelected, fee.id);
        } else {
          handleUnavailableRentableItemsSelected && handleUnavailableRentableItemsSelected(false, fee.id);
          handleNoRentableItemsSelected && handleNoRentableItemsSelected(false, fee.id);
        }
      }
    }}
    checked={input.value || false}
    {...rest}
  />
);

const rfPartyRepresentativeDropdown = ({ input, items, readOnly, updateFieldValue, updatePartyRepresentative, ...rest }) => (
  <div data-id="partyRepresentativeSelector">
    <Dropdown
      placeholder={t('LEASE_FORM_PARTY_REPRESENTATIVE')}
      showListOnFocus
      selectedValue={input.value}
      className={cf('party-representative-dropdown', { readOnly })}
      items={items.map(i => ({ id: i.id, text: i.name }))}
      onChange={value => {
        if (updateFieldValue) {
          updateFieldValue('SELECTED_PARTY_REPRESENTATIVE', value.id);
        }
        updatePartyRepresentative && updatePartyRepresentative(value.id);
      }}
      {...rest}
    />
  </div>
);

const rfOccupantsDropdown = ({ input, items, readOnly, updateFieldValue, ...rest }) => (
  <div data-id="occupantsSelector">
    <LeaseOccupantsDropdown
      placeholderText={t('LEASE_FORM_OCCUPANTS')}
      occupants={items}
      readOnly={readOnly}
      showListOnFocus
      selectedOccupants={input.value}
      onChange={value => {
        if (updateFieldValue) {
          updateFieldValue('SELECTED_OCCUPANTS', value.ids);
        }
      }}
      {...rest}
    />
  </div>
);

const rfDropdown = ({
  input,
  meta,
  validate,
  updateFieldValue,
  amountFieldName,
  baseAmount,
  feeChildren,
  oneTimeChargesBaseAmounts,
  selectCheckboxName,
  ...rest
}) => (
  <Dropdown
    onChange={({ id }) => {
      input.onChange(id);
      if (updateFieldValue) {
        // update the amount value when the quantity is updated
        amountFieldName && baseAmount && updateFieldValue(amountFieldName, id * baseAmount);
        // update any one time charges that are related to this additional charge
        oneTimeChargesBaseAmounts &&
          feeChildren &&
          feeChildren.forEach(childId => {
            updateFieldValue(`onetime_${childId}_amount`, id * oneTimeChargesBaseAmounts[childId]);
            updateFieldValue(`onetime_${childId}_dropdown`, id);
          });
      }
      selectCheckboxName && selectAdditionalChargeCheckbox({ selectCheckboxName, updateFieldValue, feeChildren, value: true });
    }}
    selectedValue={input.value || 1}
    positionArgs={{ my: 'right top', at: 'right top' }}
    styled={false}
    {...rest}
  />
);

const rfAmountEditor = ({
  input = {},
  meta,
  validate,
  handleDisplayValue,
  checkboxFieldName,
  updateFieldValue,
  baseValue,
  handleAmountChange,
  feeChildren,
  selectCheckboxName,
  max,
  ...rest
}) => {
  const initialValue = baseValue || input.value;
  const displayValue = handleDisplayValue && input.value ? handleDisplayValue(input.value) : input.value;
  const flyoutMinMaxProps = { min: 0, max };
  return (
    <TextSecondary inline>
      {/* TODO: check why the displayValue is needed. Value should be enough */}
      <div className={cf('editable-amount')}>
        <FlyOutAmountEditor
          value={initialValue}
          displayValue={displayValue}
          invalidInputError={t('THIS_FIELD_ONLY_ALLOWS_NUMBERS')}
          lowerThanMinError={t('THIS_AMOUNT_LOWER_THAN_MIN_LIMIT')}
          onChange={({ value }) => {
            input.onChange(handleAmountChange ? handleAmountChange(value) : value);
            selectCheckboxName && selectAdditionalChargeCheckbox({ selectCheckboxName, updateFieldValue, feeChildren, value: true });
          }}
          onCloseRequest={args => {
            args.close();
            rest.handleCloseAmountEditor && rest.handleCloseAmountEditor(args);
          }}
          {...flyoutMinMaxProps}
          {...rest}
        />
      </div>
    </TextSecondary>
  );
};

const rfMoney = ({ input, ...rest }) => <Money amount={input.value} {...rest} />;

const rfSelectionGroup = ({ input, meta, validate, ...rest }) => (
  <SelectionGroup onChange={({ id }) => input.onChange(id)} errorMessage={t((meta.invalid && meta.error) || '')} selectedValue={input.value} {...rest} />
);

const rfInventorySelection = ({
  fee,
  updateFieldValue,
  oneTimeChargesBaseAmounts,
  selectedInventories,
  pickItemSelectorId,
  inventorySelectorId,
  flyOutOverlayName,
  flyOutOverlayBtn,
  leaseStartDate,
  handleUnavailableRentableItemsSelected,
  handleNoRentableItemsSelected,
  isInventorySelectionEnabled,
  exportEnabled,
  backendName,
  timezone,
}) => {
  const inventoriesSet = new Set(selectedInventories);
  return (
    <InventorySelection
      pickItemSelectorId={pickItemSelectorId}
      inventorySelectorId={inventorySelectorId}
      flyOutOverlayName={flyOutOverlayName}
      flyOutOverlayBtn={flyOutOverlayBtn}
      fee={fee}
      leaseStartDate={leaseStartDate}
      selectedInventories={selectedInventories}
      handleUnavailableRentableItemsSelected={handleUnavailableRentableItemsSelected}
      handleNoRentableItemsSelected={handleNoRentableItemsSelected}
      backendName={backendName}
      timezone={timezone}
      exportEnabled={exportEnabled}
      setSelectedInventories={(_fee, _selectedInventories) => {
        if (!updateFieldValue) return;
        if (_selectedInventories.length) {
          if (!_selectedInventories.every(inv => inventoriesSet.has(inv.id))) {
            updateFieldValue(`additional_${_fee.id}_dropdown`, _selectedInventories.length || 1);
            updateFieldValue(
              `additional_${_fee.id}_amount`,
              _selectedInventories.reduce((result, inventory) => parseFloat(result) + parseFloat(inventory.marketRent), 0),
            );
          }
        } else {
          updateFieldValue(`additional_${_fee.id}_dropdown`, 1);
          updateFieldValue(`additional_${_fee.id}_amount`, _fee.price);
          if (isInventorySelectionEnabled) {
            handleNoRentableItemsSelected && handleNoRentableItemsSelected(true, fee.id);
          }
        }

        updateFieldValue(`additional_${_fee.id}_inventories`, _selectedInventories);
        (_fee.children || []).forEach(childId => {
          updateFieldValue(`onetime_${childId}_dropdown`, _selectedInventories.length || 1);
          updateFieldValue(`onetime_${childId}_amount`, (_selectedInventories.length || 1) * oneTimeChargesBaseAmounts[childId]);
        });
      }}
    />
  );
};

const openInNewTab = quoteId => {
  if (!quoteId) return;
  const urlPublishedQuote = `${window.location.protocol}//${window.location.host}/publishedQuote/${quoteId}`;
  windowOpen(urlPublishedQuote, '_blank');
};

const required = value => (value ? undefined : t('LEASE_FORM_FIELD_REQUIRED'));

const submit = (leaseFormValues, _dispatch, props) => {
  const { lease, partyId, leaseId, onPublish, quoteId, isRenewal } = props;

  const publishedLease = getLeaseDataToPublish(leaseFormValues, isRenewal);
  if (props?.additionalData?.publishedTerm?.originalTermLength) {
    publishedLease.originalTermLength = props?.additionalData?.publishedTerm?.originalTermLength;
  }

  publishedLease.termLength = props?.additionalData?.publishedTerm?.termLength;

  const updatedLease = {
    id: leaseId,
    baselineData: { ...lease.baselineData, publishedLease },
  };
  onPublish && onPublish(partyId, leaseId, updatedLease, quoteId);
};

const validate = (values, props) => {
  const {
    timezone,
    inventoryAvailability: { isInventoryUnavailable },
    setLeaseAvailability,
    isRenewal,
    lease,
  } = props;

  const {
    LEASE_START_DATE: leaseStartDateValue,
    LEASE_END_DATE: leaseEndDateValue,
    MOVE_IN_DATE: moveInDateValue,
    RENTERS_INSURANCE_FACTS: rentersInsuranceFactsValue,
  } = values;

  const missingInfoArray = [];
  if (!leaseStartDateValue || !leaseEndDateValue || !moveInDateValue) {
    missingInfoArray.push(t('LEASE_FORM_SUMMARY_SECTION'));
  }
  if (!rentersInsuranceFactsValue) {
    missingInfoArray.push(t('LEASE_FORM_ADDITIONAL_LEASE_ADDENDUM_SECTION'));
  }
  const _error = missingInfoArray.length ? `${t('LEASE_FORM_MISSING_INFO_IN')} ${missingInfoArray.join(', ')}` : '';

  let leaseFormStartDateError;
  if (isInventoryUnavailable) leaseFormStartDateError = t('LEASE_START_PRECEDES_UNIT_AVAILABILITY_WARNING');
  setLeaseAvailability(isInventoryUnavailable);

  if (leaseStartDateValue && lease.status !== DALTypes.LeaseStatus.EXECUTED) {
    const leaseStartDateToCompare = toMoment(leaseStartDateValue, { timezone });
    if (isDateInThePast(leaseStartDateValue, { timezone })) leaseFormStartDateError = t('PAST_LEASE_START_DATE_WARNING_TITLE');
    if (!isRenewal && leaseStartDateToCompare.isAfter(leaseEndDateValue) && leaseStartDateToCompare.isAfter(moveInDateValue)) {
      leaseFormStartDateError = t('LEASE_FORM_LEASE_START_DATE_VALIDATION_1');
    } else if (leaseStartDateToCompare.isAfter(leaseEndDateValue) || isSameDay(leaseStartDateToCompare, leaseEndDateValue, { timezone })) {
      leaseFormStartDateError = t('LEASE_FORM_LEASE_START_DATE_VALIDATION_2');
    } else if (!isRenewal && leaseStartDateToCompare.isAfter(toMoment(moveInDateValue, { timezone }), 'day')) {
      leaseFormStartDateError = t('LEASE_FORM_LEASE_START_DATE_VALIDATION_3');
    }
  }

  let moveInDateError;

  if (moveInDateValue && !isRenewal) {
    const moveInDateToCompare = toMoment(moveInDateValue, { timezone });
    const leaseStartDateToCompare = toMoment(leaseStartDateValue, { timezone });
    const leaseEndDateToCompare = toMoment(leaseEndDateValue, { timezone });

    if (moveInDateToCompare.isBefore(leaseStartDateToCompare, 'day') && moveInDateToCompare.isAfter(leaseEndDateToCompare, 'day')) {
      moveInDateError = t('LEASE_FORM_MOVE_IN_DATE_VALIDATION_1');
    } else if (moveInDateToCompare.isBefore(leaseStartDateToCompare, 'day')) {
      moveInDateError = t('LEASE_FORM_MOVE_IN_DATE_VALIDATION_2');
    } else if (moveInDateToCompare.isAfter(leaseEndDateToCompare, 'day')) {
      moveInDateError = t('LEASE_FORM_MOVE_IN_DATE_VALIDATION_3');
    }
  }

  let leaseEndDateError;
  if (leaseEndDateValue) {
    const leaseEndDateToCompare = toMoment(leaseEndDateValue, { timezone });
    const leaseStartDateToCompare = toMoment(leaseStartDateValue, { timezone });
    const moveInDateToCompare = toMoment(moveInDateValue, { timezone });

    if (leaseEndDateToCompare.isBefore(leaseStartDateToCompare, 'day') && leaseEndDateToCompare.isBefore(moveInDateToCompare, 'day')) {
      leaseEndDateError = t('LEASE_FORM_LEASE_END_DATE_VALIDATION_1');
    } else if (leaseEndDateToCompare.isBefore(leaseStartDateToCompare, 'day') || isSameDay(leaseEndDateToCompare, leaseStartDateValue, { timezone })) {
      leaseEndDateError = t('LEASE_FORM_LEASE_END_DATE_VALIDATION_2');
    } else if (leaseEndDateToCompare.isBefore(moveInDateToCompare, 'day')) {
      leaseEndDateError = t('LEASE_FORM_LEASE_END_DATE_VALIDATION_3');
    }
  }

  if (leaseEndDateValue && leaseStartDateValue) {
    const leaseEndDateToCompare = toMoment(leaseEndDateValue, { timezone });
    const leaseIntervalInDays = leaseEndDateToCompare.diff(leaseStartDateValue, 'days');
    if (leaseIntervalInDays < 30) {
      console.warn(`>> Lease interval is ${leaseIntervalInDays} days, with startDate: ${leaseStartDateValue} and endDate: ${leaseEndDateValue}`);
    }
  }

  const res = {
    _error,
    MOVE_IN_DATE: moveInDateError,
    LEASE_END_DATE: leaseEndDateError,
    LEASE_START_DATE: leaseFormStartDateError,
  };

  if (!_error && !moveInDateError && !leaseEndDateError && !leaseFormStartDateError) return {};
  return res;
};

const isStartDateDifferentFromActiveLeaseEndDatePlusOne = (startDate, props) => {
  const { timezone, activeLeaseWorkflowData } = props;
  const { leaseData: activeLeaseData } = activeLeaseWorkflowData;
  const { leaseEndDate } = activeLeaseData;
  const selectedLeaseStartDateToCompare = toMoment(startDate, { timezone });
  const activeLeaseEndDateToCompare = toMoment(leaseEndDate, { timezone }).add(1, 'day');
  return !selectedLeaseStartDateToCompare.isSame(activeLeaseEndDateToCompare, 'day');
};

const warn = (values, props) => {
  const { isRenewal, activeLeaseWorkflowData, timezone } = props;
  const { LEASE_START_DATE: leaseStartDateValue } = values;
  const warnings = {};

  if (isRenewal && activeLeaseWorkflowData && leaseStartDateValue && isStartDateDifferentFromActiveLeaseEndDatePlusOne(leaseStartDateValue, props)) {
    const { leaseData: activeLeaseData } = activeLeaseWorkflowData;
    const { leaseEndDate } = activeLeaseData;
    const activeLeaseEndDate = toMoment(leaseEndDate, { timezone }).format(SHORT_MONTH_ORDINAL_DAY_FORMAT);
    warnings.LEASE_START_DATE = t('LEASE_FORM_LEASE_START_DATE_VALIDATION_RENEWAL', { activeLeaseEndDate });
  }
  return warnings;
};

class LeaseFormComponent extends Component {
  constructor(props) {
    super(props);
    const rentersInsuranceItems = [
      {
        id: 'takeOwnerInsuranceFlag',
        text: t('RENTERS_INSURANCE_TAKE_OWNER_INSURANCE'),
      },
      {
        id: 'buyInsuranceFlag',
        text: t('RENTER_INSURANCE_FROM_OTHER_COMPANY'),
      },
    ];

    this.state = {
      rentersInsuranceItems,
      updatedLeaseDurationInDays: null,
      leaseTermsOptions: [],
      dateUpdateFunction: null,
      confirmLeaseTermDialogOpen: false,
      newLeaseStartDate: null,
      oldLeaseStartDate: null,
      confirmStartDateChangeDialogOpen: false,
      leaseStartDateUpdateFunction: null,
      leaseStartDateConfirmationAlreadyDisplayed: false,
    };
  }

  async componentDidMount() {
    const {
      additionalData,
      isRenewal,
      lease,
      activeLeaseWorkflowData,
      handleCheckAdditionalCharges,
      handleCheckConcessions,
      handleCheckOneTimeCharges,
      timezone,
    } = this.props;
    const concessions = activeLeaseWorkflowData?.concessions;
    const recurringCharges = activeLeaseWorkflowData?.recurringCharges;

    const shouldHandleCheck = charges => {
      const isRenewalDraft = isRenewal && lease.status === DALTypes.LeaseStatus.DRAFT;

      if (!charges) return isRenewalDraft;

      const filteredCharges = excludeExternalChargeCodes(charges);
      const leaseStartDate = activeLeaseWorkflowData?.leaseData?.leaseStartDate;
      const activeCharges = leaseStartDate ? getActiveChargesForLeaseForm(filteredCharges, leaseStartDate, timezone) : filteredCharges;

      return !!activeCharges.length && isRenewalDraft;
    };

    if (shouldHandleCheck(concessions)) {
      handleCheckConcessions && handleCheckConcessions(true);
    }

    if (shouldHandleCheck(recurringCharges)) {
      handleCheckAdditionalCharges && handleCheckAdditionalCharges(true);
    }

    if (shouldHandleCheck()) {
      handleCheckOneTimeCharges && handleCheckOneTimeCharges(true);
    }

    const inventoryId = additionalData.inventory.id;
    await this.props.loadInventoryDetails({ id: inventoryId });
  }

  openConfirmLeaseTermDialog = () => this.setState({ confirmLeaseTermDialogOpen: true });

  closeConfirmLeaseTermDialog = () =>
    this.setState({
      confirmLeaseTermDialogOpen: false,
      dateUpdateFunction: null,
      updatedLeaseDurationInDays: null,
      newDateValue: null,
      oldDateValue: null,
    });

  handleConfirmLeaseTerm = ({ wasLeaseTermConfirmed, newLeaseTermLength, leaseTermsOptions }) => {
    const { dateUpdateFunction, newDateValue, oldDateValue } = this.state;
    const { onLeaseTermLengthChanged } = this.props;
    if (wasLeaseTermConfirmed) {
      dateUpdateFunction(newDateValue);
      onLeaseTermLengthChanged(newLeaseTermLength);
      const newState = { ...this.state, leaseTermsOptions };
      this.setState(newState);
    } else {
      dateUpdateFunction(oldDateValue);
    }

    this.closeConfirmLeaseTermDialog();
  };

  shouldOpenConfirmLeaseLengthDialog = ({ key, newStartDate, oldStartDate, newEndDate, oldEndDate, updateFunction }) => {
    const { timezone, leaseEndDateValue, originalLeaseEndDateValue, originalLeaseStartDateValue, leaseStartDateValue, termLengthOverride } = this.props;

    const originalLeaseStartMoment = toMoment(originalLeaseStartDateValue, { timezone });
    const originalLeaseEndMoment = toMoment(originalLeaseEndDateValue, { timezone });
    const originalLeaseDurationInDays = originalLeaseEndMoment.diff(originalLeaseStartMoment, 'days');

    if (key === 'LEASE_START_DATE') {
      const newStartMoment = newStartDate ? toMoment(newStartDate, { timezone }) : null;
      const leaseEndMoment = toMoment(leaseEndDateValue, { timezone });
      const isStartDateBeforeOrSameAsEndDate =
        newStartMoment && (isDateAfterDate(newStartMoment, leaseEndMoment) || isSameDay(newStartMoment, leaseEndMoment, { timezone }));

      if (!newStartMoment || isStartDateBeforeOrSameAsEndDate) return false;

      const nrOfDaysForNewInterval = leaseEndMoment.diff(newStartMoment, 'days');
      const updatedLeaseDurationInDays = duration(nrOfDaysForNewInterval, 'days');

      const oldStartMoment = toMoment(oldStartDate, { timezone });
      const startDateDiff = Math.abs(newStartMoment.diff(oldStartMoment, 'days'));
      const diffToOriginalStart = Math.abs(newStartMoment.diff(originalLeaseStartMoment, 'days'));

      const newLeaseTermsOptions = calculateNewLeaseTerms(updatedLeaseDurationInDays);
      const { leaseTermsOptions } = this.state;
      const termsDiff = setDifference(new Set(newLeaseTermsOptions), new Set(leaseTermsOptions));

      if (startDateDiff > MIN_START_DAYS_DIFFERENCE || (diffToOriginalStart > MIN_START_DAYS_DIFFERENCE && termsDiff.size > 0)) {
        this.setState({ updatedLeaseDurationInDays, dateUpdateFunction: updateFunction, newDateValue: newStartDate, oldDateValue: oldStartDate });
        return true;
      }
    }

    if (key === 'LEASE_END_DATE') {
      const newEndMoment = newEndDate ? toMoment(newEndDate, { timezone }) : null;
      const leaseStartMoment = toMoment(leaseStartDateValue, { timezone });
      const isEndDateBeforeOrSameAsStartDate =
        newEndMoment && (isDateBeforeDate(newEndMoment, leaseStartMoment) || isSameDay(newEndMoment, leaseStartMoment, { timezone }));

      if (!newEndMoment || isEndDateBeforeOrSameAsStartDate) return false;

      const nrOfDaysForNewInterval = newEndMoment.diff(leaseStartMoment, 'days');
      const updatedLeaseDurationInDays = duration(nrOfDaysForNewInterval, 'days');

      const updatedLeaseTermDate = toMoment(leaseStartMoment, { timezone }).add(termLengthOverride, 'months');
      const newDaysIntervalDiff = updatedLeaseTermDate.diff(leaseStartMoment, 'days');
      const previousDaysInterval = termLengthOverride ? newDaysIntervalDiff : originalLeaseDurationInDays;
      const intervalDiff = Math.abs(previousDaysInterval - nrOfDaysForNewInterval);

      const newLeaseTermsOptions = calculateNewLeaseTerms(updatedLeaseDurationInDays);
      const { leaseTermsOptions } = this.state;
      const termsDiff = leaseTermsOptions.length ? setDifference(new Set(newLeaseTermsOptions), new Set(leaseTermsOptions)) : 0;

      if (intervalDiff > MIN_OVERALL_DAYS_DIFFERENCE || termsDiff.size > 0) {
        this.setState({ updatedLeaseDurationInDays, dateUpdateFunction: updateFunction, newDateValue: newEndDate, oldDateValue: oldEndDate });
        return true;
      }
    }
    return false;
  };

  openConfirmStartDateChangeDialog = () => this.setState({ confirmStartDateChangeDialogOpen: true });

  closeConfirmStartDateChangeDialog = leaseStartDateConfirmed =>
    this.setState({
      dateToUpdateKey: null,
      newLeaseStartDate: null,
      oldLeaseStartDate: null,
      confirmStartDateChangeDialogOpen: false,
      leaseStartDateUpdateFunction: null,
      ...(leaseStartDateConfirmed && { leaseStartDateConfirmationAlreadyDisplayed: true }),
    });

  handleConfirmStartDateChange = wasLeaseStartDateConfirmed => {
    const { dateToUpdateKey, newLeaseStartDate, oldLeaseStartDate, leaseStartDateUpdateFunction } = this.state;

    if (wasLeaseStartDateConfirmed) {
      leaseStartDateUpdateFunction(newLeaseStartDate);
      this.handleStartDateChanged(dateToUpdateKey, newLeaseStartDate, oldLeaseStartDate, leaseStartDateUpdateFunction);
    } else {
      leaseStartDateUpdateFunction(oldLeaseStartDate);
    }

    this.closeConfirmStartDateChangeDialog(wasLeaseStartDateConfirmed);
  };

  shouldOpenConfirmStartDateChangeDialog = ({ key, newStartDate, oldStartDate, updateFunction }) => {
    const { isRenewal, activeLeaseWorkflowData } = this.props;
    const { leaseStartDateConfirmationAlreadyDisplayed, confirmStartDateChangeDialogOpen } = this.state;

    if (
      isRenewal &&
      !leaseStartDateConfirmationAlreadyDisplayed &&
      !confirmStartDateChangeDialogOpen &&
      activeLeaseWorkflowData &&
      newStartDate &&
      isStartDateDifferentFromActiveLeaseEndDatePlusOne(newStartDate, this.props)
    ) {
      this.setState({
        dateToUpdateKey: key,
        newLeaseStartDate: newStartDate,
        oldLeaseStartDate: oldStartDate,
        leaseStartDateUpdateFunction: updateFunction,
      });
      return true;
    }
    return false;
  };

  handleStartDateChanged = (key, newStartDate, oldStartDate, updateFunction) => {
    if (this.shouldOpenConfirmStartDateChangeDialog({ key, newStartDate, oldStartDate, updateFunction })) {
      this.openConfirmStartDateChangeDialog();
      return;
    }
    if (this.shouldOpenConfirmLeaseLengthDialog({ key, newStartDate, oldStartDate, updateFunction })) {
      this.openConfirmLeaseTermDialog();
    } else {
      updateFunction(newStartDate);
    }
  };

  handleEndDateChanged = (key, newEndDate, oldEndDate, updateFunction) => {
    if (this.shouldOpenConfirmLeaseLengthDialog({ key, newEndDate, oldEndDate, updateFunction })) {
      this.openConfirmLeaseTermDialog();
    } else {
      updateFunction(newEndDate);
    }
  };

  validateAvailability = () => {
    const {
      inventoryAvailability: { isInventoryUnavailable },
      setLeaseAvailability,
    } = this.props;
    if (!isInventoryUnavailable) return null;
    setLeaseAvailability(isInventoryUnavailable);
    return t('LEASE_START_PRECEDES_UNIT_AVAILABILITY_WARNING');
  };

  validatePartyRepresentative = () => {
    const { selectedPartyRepresentative, showPartyRepresentativeErrorMessage } = this.props;
    return showPartyRepresentativeErrorMessage && !selectedPartyRepresentative ? t('SELECT_PARTY_REPRESENTATIVE_VALIDATION') : null;
  };

  renderCategorySummary = (label, members) => (
    <div className={cf('category-summary')}>
      <TextHeavy>{t(label)}</TextHeavy>
      {members.map(({ id, name, isServiceAnimal, isDuplicated }) => (
        <div key={`resident-${name}-${id}`}>
          <Text secondary inline id={`${label.toLowerCase().replace(/_/g, '')}_categoryTxt`}>
            {isServiceAnimal ? `${name} (${t('SERVICE_ANIMAL')})` : name}
          </Text>
          {isDuplicated && (
            <Caption inline className={cf('label')}>
              {t('POSSIBLE_DUPLICATE')}
            </Caption>
          )}
        </div>
      ))}
    </div>
  );

  noOfComplimentaryParkingSpaces = () => {
    const { additionalData } = this.props;

    if (!additionalData) return 0;

    const { inventory } = additionalData;
    const complimentaryParkingSpaces =
      inventory.complimentaryItems && inventory.complimentaryItems.filter(item => item.type === DALTypes.InventoryType.PARKING);
    return complimentaryParkingSpaces.length;
  };

  noOfComplimentaryStorageSpaces = () => {
    const { additionalData } = this.props;

    if (!additionalData) return 0;

    const { inventory } = additionalData;
    return inventory.complimentaryItems?.filter(item => item.type === DALTypes.InventoryType.STORAGE).length;
  };

  getUnitNamesByLeaseStatus = (occupant, leases, leaseStatus) =>
    leases.filter(l => l.status === leaseStatus && l?.baselineData?.occupants.find(o => o.id === occupant.id)).map(l => l?.baselineData?.quote?.unitName);

  getOccupantsSummaryInfo = occupants =>
    occupants.filter(occ => (this.props.selectedOccupants || []).find(id => id === occ.id)).map(occ => ({ id: occ.id, name: occ.fullName }));

  getOccupantsEnhancedWithLeaseUnitNames = (partyMembers, leases, currentLeaseId) => {
    const occupants = partyMembers.filter(member => member.memberType === DALTypes.MemberType.OCCUPANT);
    const leasesExceptCurrent = leases.filter(l => l.id !== currentLeaseId);

    const occupantsWithLeasedUnitsData = occupants.map(occupant => ({
      ...occupant,
      unitNamesForPublishedLeases: this.getUnitNamesByLeaseStatus(occupant, leasesExceptCurrent, DALTypes.LeaseStatus.SUBMITTED),
      unitNamesForExecutedLeases: this.getUnitNamesByLeaseStatus(occupant, leasesExceptCurrent, DALTypes.LeaseStatus.EXECUTED),
    }));
    return occupantsWithLeasedUnitsData;
  };

  shouldShowRentersInsuranceSection = () => {
    const { applicationSettings, isCorporateParty } = this.props;
    if (!applicationSettings) return true;

    if (isCorporateParty) {
      return applicationSettings.corporate.occupant.rentersInsuranceSection !== ApplicationSettingsValues.HIDDEN;
    }

    const { resident, occupant, guarantor } = applicationSettings.traditional;
    const rentersInsuranceSections = [resident.rentersInsuranceSection, occupant.rentersInsuranceSection, guarantor.rentersInsuranceSection];
    return rentersInsuranceSections.some(item => item !== ApplicationSettingsValues.HIDDEN);
  };

  getNoOfAdditionalParkings = (parkingFeeIds, additionalChargesSelectors) =>
    parkingFeeIds.reduce((acc, parkingFeeId) => {
      const noOfParkings = additionalChargesSelectors[`has_additional_${parkingFeeId}`] ? additionalChargesSelectors[`additional_${parkingFeeId}_quantity`] : 0;
      return acc + noOfParkings;
    }, 0);

  getNoOfAdditionalStorageSpaces = (storageFeeIds, additionalChargesSelectors) =>
    storageFeeIds.reduce((acc, storageFeeId) => {
      const noOfStorages = additionalChargesSelectors[`has_additional_${storageFeeId}`] ? additionalChargesSelectors[`additional_${storageFeeId}_quantity`] : 0;
      return acc + noOfStorages;
    }, 0);

  renderContractDocuments = documents => {
    const { displayContractDocuments } = this.props;
    if (!documents || !displayContractDocuments) {
      return null;
    }

    const documentKeys = Object.keys(documents).sort((a, b) => documents[a].sortOrder - documents[b].sortOrder);
    const includedDocuments = documentKeys.map(documentId => {
      const documentObject = documents[documentId];
      const { displayName } = documentObject;
      let { isIncluded } = documentObject;
      let isShown = true;

      const petAgreementAddendum = contains(displayName, LeaseDocuments.PET_AGREEMENT_ADDENDUM);
      const petAddendum = contains(displayName, LeaseDocuments.PET_ADDENDUM);
      const animalAddendum = contains(displayName, LeaseDocuments.ANIMAL_ADDENDUM);

      if (petAgreementAddendum || petAddendum || animalAddendum) {
        const { petFeeIds, additionalChargesSelectors } = this.props;
        isIncluded = isIncluded || petFeeIds.some(feeId => additionalChargesSelectors[`has_additional_${feeId}`]);
      }

      if (contains(displayName, LeaseDocuments.CORPORATE_LEASE_ADDENDUM)) {
        const { party } = this.props;
        isIncluded =
          party.leaseType === DALTypes.LeaseType.CORPORATE ||
          party.qualificationQuestions.groupProfile === DALTypes.QualificationQuestions.GroupProfile.CORPORATE;
        isShown = isIncluded;
      }

      if (contains(displayName, LeaseDocuments.EMPLOYEE_HOUSING_ADDENDUM)) {
        isIncluded = this.props.party.qualificationQuestions.groupProfile === DALTypes.QualificationQuestions.GroupProfile.EMPLOYEE;
        isShown = isIncluded;
      }

      if (contains(displayName, LeaseDocuments.STORAGE_ADDENDUM)) {
        const { storageFeeIds, additionalChargesSelectors } = this.props;
        const storageSelected = storageFeeIds.some(feeId => additionalChargesSelectors[`has_additional_${feeId}`]);
        const noOfStorageSpaces =
          (storageSelected ? this.getNoOfAdditionalStorageSpaces(storageFeeIds, additionalChargesSelectors) : 0) + this.noOfComplimentaryStorageSpaces();
        isIncluded = noOfStorageSpaces > 0;
      }
      if (contains(displayName, LeaseDocuments.RENT_CONCESSION_AGREEMENT) || contains(displayName, LeaseDocuments.RENT_CONCESSION_ADDENDUM)) {
        const { concessionIds, concessionsSelectors } = this.props;
        isIncluded = concessionIds.some(concessionId => concessionsSelectors[`has_concession_${concessionId}`]);
      }

      if (contains(displayName, LeaseDocuments.SFSU_LEASE_ADDENDUM)) {
        isIncluded = !!this.props.sfsuAddendumIncluded;
      }
      if (contains(displayName, LeaseDocuments.STUDENT_EARLY_TERMINATION_LEASE_ADDENDUM)) {
        isIncluded = !!this.props.studentEarlyTerminationAddendumIncluded;
      }
      if (contains(displayName, LeaseDocuments.STUDENT_2022_OFFER_LEASE_ADDENDUM)) {
        isIncluded = !!this.props.student2022OfferAddendumIncluded;
      }
      const { parkingFeeIds, additionalChargesSelectors } = this.props;

      const parkingSelected = parkingFeeIds.some(feeId => additionalChargesSelectors[`has_additional_${feeId}`]);
      const noOfParkingSlots =
        (parkingSelected ? this.getNoOfAdditionalParkings(parkingFeeIds, additionalChargesSelectors) : 0) + this.noOfComplimentaryParkingSpaces();

      if (contains(displayName, LeaseDocuments.PARKING_ADDENDUM)) {
        isIncluded = noOfParkingSlots > 0;
      }
      if (contains(displayName, LeaseDocuments.PARKING_ADDENDUM_2)) {
        isIncluded = noOfParkingSlots > 1;
        isShown = isIncluded;
      }
      if (contains(displayName, LeaseDocuments.PARKING_ADDENDUM_3)) {
        isIncluded = noOfParkingSlots > 2;
        isShown = isIncluded;
      }
      if (contains(displayName, LeaseDocuments.PARKING_ADDENDUM_4)) {
        isIncluded = noOfParkingSlots > 3;
        isShown = isIncluded;
      }
      if (contains(displayName, LeaseDocuments.PARKING_ADDENDUM_5)) {
        isIncluded = noOfParkingSlots > 4;
        isShown = isIncluded;
      }
      if (contains(displayName, LeaseDocuments.OCCUPANT_ADDENDUM)) {
        const { model, selectedOccupants = [] } = this.props;
        isIncluded = selectedOccupants.length || model.children.length;
      }
      let addendumDataId;
      if (contains(displayName, LeaseDocuments.INSPECTION_CHECKLIST_ADDENDUM)) {
        const { wotkflowName: partyWorkflow } = this.props.party;
        isIncluded = partyWorkflow === DALTypes.WorkflowName.NEW_LEASE;
        isShown = isIncluded;
        addendumDataId = LeaseDocuments.INSPECTION_CHECKLIST_ADDENDUM.toLowerCase().replace(/\s/g, '_');
      }

      return (
        isShown && (
          <div data-id={'summary-document-row'} className={cf('summary-document-row')} key={`${documentId}-summary`}>
            <div className={cf('checked-icon')}>{isIncluded ? <Icon name="check" id={addendumDataId && `${addendumDataId}_check`} /> : <div />}</div>
            <Caption inline secondary={!isIncluded} data-id={addendumDataId}>
              {displayName}
            </Caption>
          </div>
        )
      );
    });

    return (
      <div className={cf('documents-summary')}>
        <TextHeavy>{t('CONTRACT_DOCUMENTS')}</TextHeavy>
        {includedDocuments}
      </div>
    );
  };

  renderConcession = (concession, term) => {
    if (concession.bakedIntoAppliedFeeFlag) return null;

    const { baseRentValue, change: changeFunction, readOnly, concessionsSelectors } = this.props;
    const amountVariableAdjustment = concessionsSelectors[`concession_${concession.id}_variableAdjustment`] || 0;
    const concessionValues = getConcessionValues(concession, term, baseRentValue, amountVariableAdjustment);
    const { relativeAmount, relativeAdjustment, absoluteAdjustment, isRecurringAndSet } = concessionValues;
    const adjustmentCaption = adjustmentText({ ...concession, relativeAmount, amountVariableAdjustment }, term);
    const checkboxFieldName = `concession_${concession.id}_checkbox`;

    const handleAmountChange = value => {
      changeFunction(checkboxFieldName, value !== 0);
      changeFunction(`concession_${concession.id}_amountVariableAdjustment`, value);
      const concessionValue = getConcessionValue(
        { ...concession, amountVariableAdjustment: value || amountVariableAdjustment },
        { amount: baseRentValue || term.adjustedMarketRent, length: term.termLength },
      );
      changeFunction(`concession_${concession.id}_computedAmount`, concessionValue);

      concession.variableAmountUpdatedByAgent = this.props.currentUserId;
      return value;
    };

    const handleDisplayValue = val =>
      getConcessionValue(
        { ...concession, amountVariableAdjustment: amountVariableAdjustment || val },
        { amount: term.adjustedMarketRent, length: term.termLength },
      );

    const maxAmountLimit = getMaxAmountLimit(baseRentValue, relativeAdjustment, absoluteAdjustment, concession.floorCeilingAmount);
    const flyOutPrefix = concession.recurring ? `$/${term.period}` : '$';
    const amountFieldName = `concession_${concession.id}_amount`;
    const shouldShowAmountEditorForConcession = concessionsSelectors[`concession_${concession.id}_toggle_amount_editor`] || false;

    const toggleAmountEditor = (concessionId, shouldShowAmountEditor) => {
      const toggleAmountFieldName = `concession_${concessionId}_toggle_amount`;
      changeFunction(toggleAmountFieldName, shouldShowAmountEditor);
      changeFunction(checkboxFieldName, shouldShowAmountEditor);
    };

    const handleCloseAmountEditor = args => {
      const value = args.value;

      if (!value) {
        changeFunction(checkboxFieldName, concessionsSelectors[`has_concession_${concession.id}`]);
        toggleAmountEditor(concession.id, false);
      }
    };

    const dataId = convertToCamelCaseAndRemoveBrackets(concession.displayName);

    return (
      <Row key={`${term.id}-${concession.id}`}>
        <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
          <Field
            data-id={`${dataId}_concessionCheckBox`}
            name={checkboxFieldName}
            component={rfCheckBox}
            id={`concession${convertToCamelCaseAndRemoveBrackets(concession.displayName)}_checkBox`}
            concession={concession}
            baseValue={amountVariableAdjustment}
            updateFieldValue={changeFunction}
            toggleAmountEditor={toggleAmountEditor}
            disabled={readOnly}
          />
        </Cell>
        <Cell>
          <TextPrimary inline={true}>{concession.displayName}</TextPrimary>
          {isRecurringAndSet && <TextSecondary>{adjustmentCaption}</TextSecondary>}
        </Cell>
        <Cell textAlign="right">
          <TextSecondary inline>
            {t('SAVE')}
            {do {
              if (!concession.variableAdjustment || readOnly) {
                <Field data-id={`${dataId}_concessionAmount`} name={amountFieldName} component={rfMoney} />;
              } else {
                <Field
                  dataId={`${dataId}_concessionAmount`}
                  name={amountFieldName}
                  open={shouldShowAmountEditorForConcession}
                  handleCloseAmountEditor={handleCloseAmountEditor}
                  component={rfAmountEditor}
                  baseValue={amountVariableAdjustment}
                  handleAmountChange={handleAmountChange}
                  checkboxFieldName={checkboxFieldName}
                  updateFieldValue={changeFunction}
                  periodic={concession.recurring}
                  period={concession.recurringCount || term.termLength}
                  prefix={flyOutPrefix}
                  max={maxAmountLimit}
                  handleDisplayValue={handleDisplayValue}
                />;
              }
            }}
          </TextSecondary>
        </Cell>
      </Row>
    );
  };

  renderConcessionRows = (concessions, publishedTerm) =>
    concessions.sort(sortByOptionalAndAlphabetically).map(concession => this.renderConcession(concession, publishedTerm));

  renderFeeConcession = (fee, concession, term, isOneTime = false) => {
    const { change: changeFunction, readOnly, additionalChargesConcessionsSelectors } = this.props;
    const relativeAdjustment = Math.abs(concession.relativeAdjustment);
    const absoluteAdjustment = Math.abs(concession.absoluteAdjustment);
    const isNotVariable = !concession.variableAdjustment;

    const maxAmountLimit = getMaxAmountLimit(fee.price, relativeAdjustment, absoluteAdjustment, concession.floorCeilingAmount);
    const flyOutPrefix = concession.recurring ? `$/${term.period}` : '$';
    const fieldNameType = getChargeFieldNameType(isOneTime);
    const checkboxFieldName = `${fieldNameType}_${fee.id}_concession_${concession.id}_checkbox`;
    const amountFieldName = `${fieldNameType}_${fee.id}_concession_${concession.id}_amount`;
    const amount = additionalChargesConcessionsSelectors[`${fieldNameType}_${fee.id}_concession_${concession.id}_amount`] || 0;

    const handleAmountChange = value => {
      changeFunction(checkboxFieldName, value !== 0);
      changeFunction(`${fieldNameType}_${fee.id}_concession_${concession.id}_amount`, value);
    };

    return (
      <Row key={`${fee.id}-${concession.id}`} indentLevel={1}>
        <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
          <Field
            name={checkboxFieldName}
            component={rfCheckBox}
            concession={concession}
            parentFee={fee}
            updateFieldValue={changeFunction}
            selectCheckboxName={checkboxFieldName}
            disabled={readOnly}
            isOneTime={isOneTime}
          />
        </Cell>
        <Cell>
          <TextPrimary inline={true}>{concession.displayName}</TextPrimary>
        </Cell>
        <Cell textAlign="right">
          <TextSecondary inline={true}>
            {t('SAVE')}
            {do {
              if (isNotVariable || readOnly) {
                <Field name={amountFieldName} component={rfMoney} />;
              } else {
                <Field
                  name={amountFieldName}
                  component={rfAmountEditor}
                  checkboxFieldName={checkboxFieldName}
                  updateFieldValue={changeFunction}
                  periodic={concession.recurring}
                  period={concession.recurringCount || term.termLength}
                  prefix={flyOutPrefix}
                  max={maxAmountLimit}
                  baseValue={amount}
                  handleAmountChange={handleAmountChange}
                  isOneTime={isOneTime}
                />;
              }
            }}
          </TextSecondary>
        </Cell>
      </Row>
    );
  };

  renderFeeConcessionRows = (fee, publishedTerm, { isOneTime = false } = {}) =>
    fee.concessions.sort(sortByOptionalAndAlphabetically).map(concession => this.renderFeeConcession(fee, concession, publishedTerm, isOneTime));

  renderAdditionalChargesRows = fees => {
    const {
      change: changeFunction,
      readOnly,
      oneTimeChargesBaseAmounts,
      additionalChargesSelectors,
      allowRentableItemSelection,
      leaseStartDateValue,
      handleUnavailableRentableItemsSelected,
      handleNoRentableItemsSelected,
      backendName = DALTypes.BackendMode.NONE,
      timezone,
      exportEnabled,
    } = this.props;
    return fees.map(fee => {
      const maxAmount = getMaxAmount(fee);
      const amountFieldName = `additional_${fee.id}_amount`;
      const checkboxKey = `has_additional_${fee.id}`;
      const checkboxFieldName = `additional_${fee.id}_checkbox`;
      const dataId = convertToCamelCaseAndRemoveBrackets(fee.displayName);
      const isInventorySelectionEnabled = !!allowRentableItemSelection && canHaveRentableItems(fee);

      let quantityComp;
      if (fee.maxQuantityInQuote > 1) {
        // TODO: Do not recreate items on every render
        //
        // We need to find a way to derive this before render time, the fact that this is done during render makes this data
        // to always be different than the previous props potentially casusing a endless loop. We will fix this from inside
        // the Dropdown for now but will require a costly isEqual check
        const quantityData = [...Array(fee.maxQuantityInQuote).keys()].map(i => ({ value: i + 1, content: i + 1 }));
        quantityComp = (
          <Field
            name={`additional_${fee.id}_dropdown`}
            id={`${dataId}_additionalMonthlyQuantityDropdown`}
            component={rfDropdown}
            amountFieldName={amountFieldName}
            updateFieldValue={changeFunction}
            selectCheckboxName={checkboxFieldName}
            feeChildren={fee.children}
            baseAmount={fee.amount}
            oneTimeChargesBaseAmounts={oneTimeChargesBaseAmounts}
            textField="content"
            valueField="value"
            items={quantityData}
            disabled={readOnly || isInventorySelectionEnabled}
          />
        );
      } else {
        quantityComp = <Text className={cf('table-quantity')}>{fee.maxQuantityInQuote}</Text>;
      }

      const selectedInventories = additionalChargesSelectors[`additional_${fee.id}_selectedInventories`] || [];
      const shouldDisplayInventorySelection = isInventorySelectionEnabled && additionalChargesSelectors[checkboxKey];

      let checkComp;
      if (fee.isAdditional) {
        checkComp = <IconButton data-id={`${dataId}_additionalMonthlyFeeChecked`} iconName="check" />;
      } else {
        checkComp = (
          <Field
            id={`${dataId}_additionalMonthlyFeeCheckBox`}
            name={checkboxFieldName}
            component={rfCheckBox}
            disabled={readOnly}
            updateFieldValue={changeFunction}
            feeChildren={fee.children}
            fee={fee}
            isInventorySelectionEnabled={isInventorySelectionEnabled}
            handleUnavailableRentableItemsSelected={handleUnavailableRentableItemsSelected}
            handleNoRentableItemsSelected={handleNoRentableItemsSelected}
            selectedInventories={selectedInventories}
          />
        );
      }

      const isMinAndMaxRentEqual = fee.minRent === fee.maxRent;

      return (
        <div key={`div-fee-${fee.id}`}>
          <Row key={`additional-fee-row-${fee.id}`}>
            <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
              {checkComp}
            </Cell>
            <Cell>
              <TextPrimary inline>
                {fee.displayName} {fee.parentFeeDisplayName && `(${fee.parentFeeDisplayName})`}
              </TextPrimary>
              {fee.estimated && <Text secondary>{t('ESTIMATED')}</Text>}
              {!readOnly && shouldDisplayInventorySelection && (
                <Field
                  name={`additional-fee-row-inventorySelection-${fee.id}`}
                  component={rfInventorySelection}
                  readOnly={readOnly}
                  selectedInventories={selectedInventories}
                  updateFieldValue={changeFunction}
                  oneTimeChargesBaseAmounts={oneTimeChargesBaseAmounts}
                  fee={fee}
                  handleUnavailableRentableItemsSelected={handleUnavailableRentableItemsSelected}
                  handleNoRentableItemsSelected={handleNoRentableItemsSelected}
                  pickItemSelectorId={`${convertToCamelCaseAndRemoveBrackets(fee.displayName)}_pickItemSelector`}
                  inventorySelectorId={`${convertToCamelCaseAndRemoveBrackets(fee.displayName)}TextInput`}
                  flyOutOverlayName={`${convertToCamelCaseAndRemoveBrackets(fee.displayName)}`}
                  flyOutOverlayBtn={`${convertToCamelCaseAndRemoveBrackets(fee.displayName)}`}
                  isInventorySelectionEnabled={isInventorySelectionEnabled}
                  leaseStartDate={leaseStartDateValue}
                  backendName={backendName}
                  exportEnabled={exportEnabled}
                  timezone={timezone}
                />
              )}
              {readOnly && shouldDisplayInventorySelection && (
                <TextHeavy inline>
                  {selectedInventories.map((inventory, index, list, lastIndex = list.length - 1) => {
                    const key = `${index}${inventory.id}`;
                    return (
                      <span key={key}>
                        {`${inventory.buildingText} `}(<Money bold noDecimals amount={inventory.marketRent} />){index !== lastIndex && ', '}
                      </span>
                    );
                  })}
                </TextHeavy>
              )}
            </Cell>
            <Cell width={100} textAlign="right">
              {fee.quoteSectionName !== QuoteSection.UTILITY.toLowerCase() && quantityComp}
            </Cell>
            <Cell width={120} textAlign="right">
              {isInventoryGroupFee(fee) && !isMinAndMaxRentEqual && !selectedInventories.length && <TextSecondary inline>{t('FROM')}</TextSecondary>}
              {do {
                if (readOnly || isInventorySelectionEnabled) {
                  <Field name={amountFieldName} component={rfMoney} />;
                } else {
                  <Field
                    dataId={`${dataId}_additionalMonthlyFeeAmount`}
                    name={amountFieldName}
                    component={rfAmountEditor}
                    prefix="$"
                    updateFieldValue={changeFunction}
                    selectCheckboxName={checkboxFieldName}
                    feeChildren={fee.children}
                    max={maxAmount}
                    checkboxFieldName={checkboxFieldName}
                  />;
                }
              }}
            </Cell>
          </Row>
          {fee.concessions && this.props.additionalChargesSelectors[checkboxKey] && this.renderFeeConcessionRows(fee, this.props.additionalData.publishedTerm)}
        </div>
      );
    });
  };

  renderAdditionalCharges = (charge, index) => {
    const visibleFees = charge.fees.filter(fee => fee.visible);
    if (!visibleFees.length) {
      return <div key={`additional-empty-${index}`} />;
    }

    return (
      <div key={`additional-${charge.name}-${index}`}>
        <GroupTitle>{quoteSectionRepresentation(charge.name)}</GroupTitle>
        {this.renderAdditionalChargesRows(visibleFees)}
      </div>
    );
  };

  renderAdditionalChargesRowHeader = chargePeriod => (
    <RowHeader key={`additional-header-${chargePeriod}`}>
      <Cell>
        {t('QUOTE_DRAFT_ADDITIONAL_CHARGE_DESCRIPTION', {
          period: chargePeriod,
        })}
      </Cell>
      <Cell width={100} textAlign="right">
        {t('QUANTITY')}
      </Cell>
      <Cell width={120} textAlign="right">
        {t('AMOUNT')}
      </Cell>
    </RowHeader>
  );

  renderAdditionalChargesSection = (additionalAndOneTimeCharges, publishedTerm) => {
    const {
      activeLeaseWorkflowData = {},
      isRenewal,
      areAdditionalChargesUnchecked,
      handleCheckAdditionalCharges,
      timezone,
      backendName = DALTypes.BackendMode.NONE,
      shouldDisplayUnselectedRentableItemsBanner,
      additionalChargesSelectors,
    } = this.props;

    const additionalAndOneTimeFees = getAdditionalAndOneTimeFeesFromPublishTermPeriod(additionalAndOneTimeCharges, publishedTerm.period);
    const additionalCharges = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ADDITIONAL) : [];
    additionalCharges.forEach(charge => {
      const visibleFees = charge.fees.filter(fee => fee.visible);
      visibleFees.forEach(fee => {
        const quantityOfSelectedFee = additionalChargesSelectors[`additional_${fee.id}_quantity`];
        updateAdditionalChargesParentFee(fee, publishedTerm);
        setDefaultVariableAmount(fee, fee.amount);
        fee.maxAmount = fee.maxAmountPerItem * quantityOfSelectedFee;
      });
    });
    if (!additionalCharges.length) {
      return <div />;
    }

    const periodName = getPeriodName(publishedTerm);
    const adjPeriod = getAdjFormOfPeriod(publishedTerm);
    const recurringCharges = excludeExternalChargeCodes(activeLeaseWorkflowData?.recurringCharges);
    const leaseStartDate = activeLeaseWorkflowData?.leaseData?.leaseStartDate;
    const activeCharges = leaseStartDate ? getActiveChargesForLeaseForm(recurringCharges, leaseStartDate, timezone) : recurringCharges;

    return (
      <Section
        data-id="additionalChargesSection"
        sectionTitleClassName={cf('section-title')}
        key={'additional-section'}
        padContent={false}
        title={t('QUOTE_ADDITIONAL_CHARGE_SECTION_TITLE', {
          period: adjPeriod,
        })}>
        {isRenewal && !!activeCharges.length && (
          <ChargeStepperSection
            btnDataId="additionalChargesSectionBtn"
            checkedMessage={t('ADDITIONAL_CHARGES_CHECKED_MESSAGE')}
            btnTxt={t('ADDITIONAL_CHARGES_BUTTON')}
            message={t('PREVIOUS_ADDITIONAL_CHARGES_MESSAGE')}
            charges={activeCharges}
            checked={!areAdditionalChargesUnchecked}
            checkFunc={handleCheckAdditionalCharges}
            timezone={timezone}
          />
        )}
        {shouldDisplayUnselectedRentableItemsBanner && (
          <NotificationBanner
            content={
              backendName === DALTypes.BackendMode.NONE
                ? t('UNAVAILABLE_RENTABLE_ITEMS_SELECTED')
                : t('UNAVAILABLE_RENTABLE_ITEMS_SELECTED_WITH_BACKEND_MODE', { backend: backendName })
            }
            type="warning"
          />
        )}
        <Table>
          {this.renderAdditionalChargesRowHeader(periodName)}
          {additionalCharges.map((charge, index) => this.renderAdditionalCharges(charge, index))}
        </Table>
      </Section>
    );
  };

  updateChargesVisibleFees = (charges, publishedTerm, value, feeType, changeFunction) => {
    charges.forEach(charge => {
      const visibleFees = charge.fees.filter(fee => fee.visible);
      visibleFees.forEach(fee => {
        updateAdditionalChargesParentFee(fee, publishedTerm, value);
        setDefaultVariableAmount(fee, fee.amount);
        changeFunction(`${feeType === Charges.ADDITIONAL ? 'additional_' : 'onetime_'}${fee.id}_amount`, fee.amount);
      });
    });
  };

  renderChargesAndConcessionsSection = () => {
    const {
      isRenewal,
      activeLeaseWorkflowData = {},
      readOnly,
      change: changeFunction,
      additionalData,
      areConcessionsUnchecked,
      handleCheckConcessions,
      timezone,
    } = this.props;

    const { publishedTerm, additionalAndOneTimeCharges } = additionalData;

    const activeConcessions = excludeExternalChargeCodes(activeLeaseWorkflowData?.concessions);
    const leaseStartDate = activeLeaseWorkflowData?.leaseData?.leaseStartDate;

    const filteredConcessions = leaseStartDate ? getActiveChargesForLeaseForm(activeConcessions, leaseStartDate, timezone) : activeConcessions;
    const handleBaseRentAmountChanged = value => {
      const { concessions } = publishedTerm;
      const additionalAndOneTimeFees = getAdditionalAndOneTimeFeesFromPublishTermPeriod(additionalAndOneTimeCharges, publishedTerm.period);
      const relativePriceFees = additionalAndOneTimeFees.fees.filter(fee => !!fee.relativePrice || !!fee.relativeDefaultPrice);

      const additionalCharges = relativePriceFees?.length ? getCharges(relativePriceFees, Charges.ADDITIONAL) : [];
      const oneTimeCharges = relativePriceFees?.length ? getCharges(relativePriceFees, Charges.ONETIME) : [];

      this.updateChargesVisibleFees(additionalCharges, publishedTerm, value, Charges.ADDITIONAL, changeFunction);
      this.updateChargesVisibleFees(oneTimeCharges, publishedTerm, value, Charges.ONETIME, changeFunction);

      concessions.forEach(concession => {
        const rentValue = value || publishedTerm.adjustedMarketRent;
        const isVariable = !!concession.variableAdjustment;

        if (isVariable && concession.variableAmountUpdatedByAgent) return;

        if (isVariable) {
          const {
            variableAdjustment,
            relativeDefaultAdjustment,
            absoluteDefaultAdjustment,
            absoluteAdjustment,
            floorCeilingAmount,
            relativeAdjustment,
          } = concession;
          const maxAmount = getMaxAmountLimit(rentValue, Math.abs(relativeAdjustment), Math.abs(absoluteAdjustment), floorCeilingAmount);
          const amountVariableAdjustment = setDefaultVariableAmount(
            {
              variableAdjustment,
              relativeDefaultPrice: relativeDefaultAdjustment,
              absoluteDefaultPrice: absoluteDefaultAdjustment,
              parentFeeAmount: rentValue,
            },
            maxAmount,
          );
          concession.amountVariableAdjustment = amountVariableAdjustment;

          changeFunction(`concession_${concession.id}_amountVariableAdjustment`, amountVariableAdjustment);
        }

        const amount = getConcessionValue(concession, {
          amount: rentValue,
          length: publishedTerm.termLength,
        });

        changeFunction(`concession_${concession.id}_amount`, amount);
        changeFunction(`concession_${concession.id}_relativeAmount`, computeConcessionRelativeAmount(concession, value));
      });
      return value;
    };

    return (
      <Section
        data-id="chargesAndConcessionsSection"
        padContent={false}
        title={t('QUOTE_BASE_CHARGES_RENT_CONCESSIONS_TITLE')}
        sectionTitleClassName={cf('section-title')}>
        {isRenewal && !!filteredConcessions.length && (
          <ChargeStepperSection
            btnDataId="concessionsSectionBtn"
            checkedMessage={t('CONCESSIONS_CHARGES_CHECKED_MESSAGE')}
            btnTxt={t('CONCESSIONS_BUTTON')}
            message={t('PREVIOUS_CONCESSIONS_MESSAGE')}
            charges={filteredConcessions}
            checked={!areConcessionsUnchecked}
            checkFunc={handleCheckConcessions}
            timezone={timezone}
          />
        )}
        <Table>
          <Row>
            <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
              <IconButton iconName="check" />
            </Cell>
            <Cell>
              <TextPrimary inline>{t('BASE_RENT')}</TextPrimary>
            </Cell>
            <Cell data-id="baseRentAmount" textAlign="right">
              {do {
                if (readOnly) {
                  <Field dataId={`baseRentLeaseTerm_${publishedTerm.termLength}`} name={'BASE_RENT'} component={rfMoney} />;
                } else {
                  <Field
                    name={'BASE_RENT'}
                    component={rfAmountEditor}
                    dataId={`baseRentLeaseTerm_${publishedTerm.termLength}`}
                    handleAmountChange={handleBaseRentAmountChanged}
                    prefix="$"
                  />;
                }
              }}
            </Cell>
          </Row>
          {publishedTerm && publishedTerm.concessions && this.renderConcessionRows(publishedTerm.concessions, publishedTerm)}
        </Table>
      </Section>
    );
  };

  getFullParentFeeDisplayName = fee => {
    if (!fee.parentFeeDisplayName) return '';

    const { oneTimeChargesSelectors } = this.props;

    let parentQuantity = oneTimeChargesSelectors[`onetime_${fee.id}_quantity`];
    parentQuantity = parentQuantity > 1 ? parentQuantity : '';

    return parentQuantity ? `(${parentQuantity} ${fee.parentFeeDisplayName})` : `(${fee.parentFeeDisplayName})`;
  };

  getFullFeeDisplayName = fee => {
    const parentDisplayName = this.getFullParentFeeDisplayName(fee);

    return parentDisplayName ? `${fee.displayName} ${parentDisplayName}` : fee.displayName;
  };

  renderOneTimeChargesRows = fees => {
    const { readOnly, oneTimeChargesSelectors } = this.props;

    return fees.map(fee => {
      const checkboxFieldName = `onetime_${fee.id}_checkbox`;
      const fullDisplayName = this.getFullFeeDisplayName(fee);
      const feeAmountDataId = convertToCamelCaseAndRemoveBrackets(fullDisplayName);
      const dataId = convertToCamelCaseAndRemoveBrackets(fee.displayName);
      const maxAmount = getMaxAmount(fee);

      const checkboxKey = `has_onetime_${fee.id}`;
      const shouldDisplayConcessions = fee.concessions && oneTimeChargesSelectors[checkboxKey];
      let checkComp;
      if (fee.isAdditional) {
        checkComp = <IconButton iconName="check" />;
      } else {
        checkComp = <Field id={`${dataId}_oneTimeFeeCheckBox`} name={checkboxFieldName} component={rfCheckBox} disabled={readOnly} />;
      }

      return (
        <div key={`div-fee-${fee.id}`}>
          <Row key={`one-time-fee-row-${fee.id}`}>
            <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
              {checkComp}
            </Cell>
            <Cell>
              <TextPrimary dataId={feeAmountDataId} inline>
                {fullDisplayName}
              </TextPrimary>
            </Cell>
            <Cell dataId={`${dataId}_oneTimeFeeText`} width={120} textAlign="right">
              {do {
                if (readOnly) {
                  <Field dataId={feeAmountDataId} name={`onetime_${fee.id}_amount`} component={rfMoney} />;
                } else {
                  <Field dataId={feeAmountDataId} name={`onetime_${fee.id}_amount`} max={maxAmount} component={rfAmountEditor} prefix="$" />;
                }
              }}
            </Cell>
          </Row>
          {shouldDisplayConcessions && this.renderFeeConcessionRows(fee, this.props.additionalData.publishedTerm, { isOneTime: true })}
        </div>
      );
    });
  };

  renderOneTimeCharges = (charge, publishedTerm) => {
    const { oneTimeChargesSelectors } = this.props;
    const fees = charge.fees.filter(fee => fee.visible || oneTimeChargesSelectors[`has_onetime_${fee.id}`]);
    fees.forEach(fee => {
      updateAdditionalChargesParentFee(fee, publishedTerm);
      setDefaultVariableAmount(fee, fee.amount);
    });

    if (!fees.length) {
      return <div key={`onetime-${charge.name}`} />;
    }
    return (
      <div key={`onetime-${charge.name}`}>
        <GroupTitle>{quoteSectionRepresentation(charge.name)}</GroupTitle>
        {this.renderOneTimeChargesRows(fees)}
      </div>
    );
  };

  renderOneTimeChargesRowHeader = () => (
    <RowHeader>
      <Cell>{t('QUOTE_DRAFT_ON_TIME_CHARGE_DESCRIPTION')}</Cell>
      <Cell width={120} textAlign="right">
        {t('AMOUNT')}
      </Cell>
    </RowHeader>
  );

  mergeWithPublishedFees = (currentFees, publishedFees) =>
    currentFees.map(fee => {
      const charge = getSelectedFee(publishedFees.oneTimeCharges, fee) || {};
      return { ...charge, ...fee };
    });

  renderOneTimeChargesSection = (additionalAndOneTimeCharges, additionalAndOneTimeChargesFromPublishedQuoteData, publishedTerm) => {
    const { isRenewal, handleCheckOneTimeCharges, areOneTimeChargesUnchecked } = this.props;
    const additionalAndOneTimeFees = getAdditionalAndOneTimeFeesFromPublishTermPeriod(additionalAndOneTimeCharges, publishedTerm.period);
    const groupedOneTimeFees = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ONETIME) : [];

    if (!groupedOneTimeFees.length) {
      return <div />;
    }

    const oneTimeCharges = groupedOneTimeFees.map(groupedOneTimeFee => ({
      ...groupedOneTimeFee,
      fees: this.mergeWithPublishedFees(groupedOneTimeFee.fees, additionalAndOneTimeChargesFromPublishedQuoteData),
    }));

    return (
      <Section data-id="oneTimeChargesSection" title={t('QUOTE_ONE_TIME_CHARGE_SECTION_TITLE')} padContent={false} sectionTitleClassName={cf('section-title')}>
        {isRenewal && (
          <ChargeStepperSection
            btnDataId="oneTimeChargesSectionBtn"
            checkedMessage={t('ONE_TIME_CHARGES_CHECKED_MESSAGE')}
            btnTxt={t('ONE_TIME_CHARGES_BUTTON')}
            message={t('ONE_TIME_CHARGES_MESSAGE')}
            checked={!areOneTimeChargesUnchecked}
            checkFunc={handleCheckOneTimeCharges}
          />
        )}
        <Table>
          {this.renderOneTimeChargesRowHeader()}
          {oneTimeCharges.map(charge => this.renderOneTimeCharges(charge, publishedTerm))}
        </Table>
      </Section>
    );
  };

  shouldShowAdditionalLeaseAddendumSection = () => {
    const { model } = this.props;
    const { documents, additionalConditions } = model;

    const hasSFSUAddendum = !!Object.keys(documents).find(key => contains(documents[key].displayName, LeaseDocuments.SFSU_LEASE_ADDENDUM));
    const hasStudentEarlyTerminationAddendum = !!Object.keys(documents).find(key =>
      contains(documents[key].displayName, LeaseDocuments.STUDENT_EARLY_TERMINATION_LEASE_ADDENDUM),
    );
    const hasStudent2022OfferAddendum = !!Object.keys(documents).find(key =>
      contains(documents[key].displayName, LeaseDocuments.STUDENT_2022_OFFER_LEASE_ADDENDUM),
    );
    const showRentersInsuranceSection = this.shouldShowRentersInsuranceSection();
    const hasNPSRentAssurance = additionalConditions?.npsRentAssurance;
    const hasSureDeposit = additionalConditions?.sureDeposit;

    return (
      showRentersInsuranceSection ||
      hasSFSUAddendum ||
      hasNPSRentAssurance ||
      hasSureDeposit ||
      hasStudentEarlyTerminationAddendum ||
      hasStudent2022OfferAddendum
    );
  };

  renderAdditionalLeaseAddendumSection = (documents, additionalConditions) => {
    const { readOnly } = this.props;

    const showRentersInsuranceSection = this.shouldShowRentersInsuranceSection();
    const hasSFSUAddendum = !!Object.keys(documents).find(key => contains(documents[key].displayName, LeaseDocuments.SFSU_LEASE_ADDENDUM));
    const hasStudentEarlyTerminationAddendum = !!Object.keys(documents).find(key =>
      contains(documents[key].displayName, LeaseDocuments.STUDENT_EARLY_TERMINATION_LEASE_ADDENDUM),
    );
    const hasStudent2022OfferAddendum = !!Object.keys(documents).find(key =>
      contains(documents[key].displayName, LeaseDocuments.STUDENT_2022_OFFER_LEASE_ADDENDUM),
    );
    const { npsRentAssurance = false, sureDeposit = false } = additionalConditions || {};

    return (
      <Section data-id="additionalLeaseAddendumSection" padContent={false} title={t('LEASE_FORM_ADDITIONAL_LEASE_ADDENDUM')}>
        <Table>
          {showRentersInsuranceSection && (
            <div>
              <Row>
                <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
                  <IconButton iconName="check" />
                </Cell>
                <Cell>
                  <TextPrimary inline>{t('RENTERS_INSURANCE_FACTS')}</TextPrimary>
                </Cell>
              </Row>
              <Row>
                <Cell width={ICON_CELL_WIDTH} type="ctrlCell" />
                <Cell>
                  <Field
                    name={'RENTERS_INSURANCE_FACTS'}
                    component={rfSelectionGroup}
                    validate={[required]}
                    columns={1}
                    readOnly={readOnly}
                    items={this.state.rentersInsuranceItems}
                  />
                </Cell>
              </Row>
            </div>
          )}
          {hasSFSUAddendum && (
            <Row>
              <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
                <Field name={'SFSU_ADDENDUM'} component={rfCheckBox} />
              </Cell>
              <Cell>
                <TextPrimary inline>{t('LEASE_INCLUDE_SFSU_ADDENDUM')}</TextPrimary>
              </Cell>
            </Row>
          )}
          {hasStudentEarlyTerminationAddendum && (
            <Row>
              <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
                <Field name={'STUDENT_EARLY_TERMINATION_ADDENDUM'} component={rfCheckBox} />
              </Cell>
              <Cell>
                <TextPrimary inline>{t('LEASE_INCLUDE_STUDENT_EARLY_TERMINATION_ADDENDUM')}</TextPrimary>
              </Cell>
            </Row>
          )}
          {hasStudent2022OfferAddendum && (
            <Row>
              <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
                <Field name={'STUDENT_2022_OFFER_ADDENDUM'} component={rfCheckBox} />
              </Cell>
              <Cell>
                <TextPrimary inline>{t('LEASE_INCLUDE_STUDENT_2022_OFFER_ADDENDUM')}</TextPrimary>
              </Cell>
            </Row>
          )}
          {sureDeposit && (
            <Row>
              <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
                <IconButton iconName="check" />
              </Cell>
              <Cell>
                <TextPrimary inline>{t('SURE_DEPOSIT')}</TextPrimary>
              </Cell>
            </Row>
          )}
          {npsRentAssurance && (
            <Row>
              <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
                <IconButton iconName="check" />
              </Cell>
              <Cell>
                <TextPrimary inline>{t('NPS_RENT_ASSURANCE')}</TextPrimary>
              </Cell>
            </Row>
          )}
        </Table>
      </Section>
    );
  };

  handleOnViewParty = partyId => leasingNavigator.navigateToParty(partyId);

  membersWithModifiedCompanyName = (lease, party) =>
    party.leaseType === DALTypes.LeaseType.CORPORATE ? getMembersWithModifiedCompanyName(lease, party.partyMembers) : [];

  membersWithModifiedNames = (lease, party) => getMembersWithModifiedNames(lease, party.partyMembers);

  memberCountChanged = (lease, party) => hasPartyMemberNumberChanged(lease, party.partyMembers);

  membersWithChangedEmails = (lease, party) => getMembersWithModifiedEmails(lease, party.partyMembers);

  renderMembersModifiedNotification = () => {
    const { lease, party } = this.props;
    return (
      <LeaseMembersAndEmailsChangedWarning
        partyMembersWithModifiedName={this.membersWithModifiedNames(lease, party)}
        partyMembersWithModifiedEmail={this.membersWithChangedEmails(lease, party)}
        partyMemberCountChanged={this.memberCountChanged(lease, party)}
        partyMembersWithModifiedCompanyName={this.membersWithModifiedCompanyName(lease, party)}
      />
    );
  };

  shouldShowLeaseWarning = () => {
    const { lease, party } = this.props;
    return shouldShowLeaseWarningCheck(lease, party);
  };

  render = () => {
    const {
      model,
      activeLeases,
      quoteId,
      readOnly,
      additionalData,
      unitReservedWarning,
      timezone,
      partyMembers,
      onAddEmailAddress,
      isCorporateParty,
      inventoryAvailability: { isInventoryUnavailable, inventoryAvailableDate },
      isRenewal,
      change: changeFunction,
      party,
      showPartyRepresentativeSelector,
      updatePartyRepresentative,
    } = this.props;
    const { handleSubmit, invalid, submitFailed, error, lease } = this.props;

    const showOccupantsSelector = areOccupantsAllowed(party);
    const membersWithInvalidEmail = getMembersWithInvalidEmail(partyMembers, isCorporateParty);
    const isLeaseExecuted = lease.status === DALTypes.LeaseStatus.EXECUTED;

    if (!additionalData) return <PreloaderBlock size="big" />;
    const occupants = this.getOccupantsEnhancedWithLeaseUnitNames(partyMembers, activeLeases, lease.id);

    const occupantsSummaryInfo = this.getOccupantsSummaryInfo(occupants);

    const { publishedTerm, additionalAndOneTimeCharges, inventory } = additionalData;
    const additionalAndOneTimeChargesFromPublishedQuoteData = publishedTerm.additionalAndOneTimeCharges;
    const { residents, guarantors, children, pets, vehicles, documents, companyName, additionalConditions } = model;

    const datePickerMin = !readOnly && now({ timezone }).startOf('day');
    const shouldRenderAdditionalLeaseAddendumSection = this.shouldShowAdditionalLeaseAddendumSection();
    const residentsLabel = (!isCorporateParty && 'RESIDENTS') || 'POINT_OF_CONTACT';

    const { originalLeaseStartDateValue, originalLeaseEndDateValue, activeLeaseWorkflowData = {} } = this.props;
    const { leaseData = {} } = activeLeaseWorkflowData;
    const { leaseEndDate } = leaseData;

    return (
      <TwoPanelPage>
        <LeftPanel paddedScrollable>
          {this.state.confirmLeaseTermDialogOpen && (
            <ConfirmLeaseTermDialog
              id="confirmLeaseTermDialog"
              open={this.state.confirmLeaseTermDialogOpen}
              updatedLeaseDurationInDays={this.state.updatedLeaseDurationInDays}
              onCloseRequest={this.handleConfirmLeaseTerm}
            />
          )}
          {this.state.confirmStartDateChangeDialogOpen && (
            <ConfirmStartDateChangeDialog
              id="confirmStartDateChangeDialog"
              open={this.state.confirmStartDateChangeDialogOpen}
              onUserAction={this.handleConfirmStartDateChange}
              leaseEndDate={leaseEndDate}
              selectedStartDate={this.state.newLeaseStartDate}
              timezone={timezone}
            />
          )}
          <form className={cf('form')} onSubmit={handleSubmit}>
            {submitFailed && invalid && (
              <div className={cf('section')}>
                <TextHeavy error>{error}</TextHeavy>
              </div>
            )}
            {!isLeaseExecuted && this.shouldShowLeaseWarning() && this.renderMembersModifiedNotification()}
            {unitReservedWarning && <UnitReservedWarning {...unitReservedWarning} onViewParty={() => this.handleOnViewParty(unitReservedWarning.partyId)} />}
            {isInventoryUnavailable && (
              <LeaseStartWarning content={t('UNIT_NOT_AVAILABLE_TO_LEASE_WARNING', { name: inventory.name, date: inventoryAvailableDate })} />
            )}
            {!!membersWithInvalidEmail.length && <InvalidEmailWarning members={membersWithInvalidEmail} onAddEmailAddress={onAddEmailAddress} />}
            <Section
              data-id="leaseSummarySection"
              padContent={false}
              title={t('LEASE_FORM_SUMMARY')}
              actionItems={
                <Button
                  id="viewRelatedQuoteBtn"
                  type="flat"
                  btnRole="primary"
                  label={t(isRenewal ? 'VIEW_RELATED_RENEWAL_LETTER' : 'VIEW_RELATED_QUOTE')}
                  onClick={() => openInNewTab(quoteId)}
                />
              }>
              <div className={cf('section')}>
                <SubHeader data-id="leaseUnitAddressTxt">{formatUnitAddress(inventory)}</SubHeader>
                <Text data-id="propertyDisplayNameTxt" secondary>
                  {(inventory?.property || {}).displayName || ''}
                </Text>
                <Text data-id="leaseUnitLayoutTxt" secondary>
                  {getQuoteLayoutSummary(inventory)}
                </Text>
                {!!inventory && !!inventory.complimentaryItems.length && (
                  <div>
                    <Text inline secondary>
                      {t('LEASE_FORM_INCLUDES_COMPLIMENTARY')}
                    </Text>
                    <ComplimentaryItems inventory={inventory} />
                  </div>
                )}
              </div>
              <div className={cf('section summary-dates', { 'exclude-move-in-date': !!isRenewal })}>
                <Field
                  name={'LEASE_START_DATE'}
                  id="leaseStartDateTxt"
                  component={rfDatePicker}
                  originalValue={originalLeaseStartDateValue}
                  validate={[required]}
                  label={t('LEASE_START_DATE')}
                  disabled={readOnly}
                  min={datePickerMin}
                  tz={timezone}
                  errorMessage={this.validateAvailability()}
                  changeHandler={this.handleStartDateChanged}
                />
                {!isRenewal && (
                  <Field
                    name={'MOVE_IN_DATE'}
                    id="moveInDateTxt"
                    component={rfDatePicker}
                    tz={timezone}
                    validate={[required]}
                    label={t('MOVE_IN_DATE')}
                    disabled={readOnly}
                    min={datePickerMin}
                  />
                )}
                <Field
                  name={'LEASE_END_DATE'}
                  id="leaseEndDateTxt"
                  component={rfDatePicker}
                  originalValue={originalLeaseEndDateValue}
                  validate={[required]}
                  label={t('LEASE_END_DATE')}
                  disabled={readOnly}
                  min={datePickerMin}
                  tz={timezone}
                  changeHandler={this.handleEndDateChanged}
                />
              </div>
              {showOccupantsSelector && (
                <div className={cf('occupants-section')} data-id="occupantsSelector">
                  <Field
                    name={'SELECTED_OCCUPANTS'}
                    id={'occupantsSelector'}
                    component={rfOccupantsDropdown}
                    updateFieldValue={changeFunction}
                    label={t('LEASE_FORM_OCCUPANTS')}
                    items={occupants}
                    readOnly={readOnly}
                  />
                </div>
              )}
              {showPartyRepresentativeSelector && (
                <div className={cf('party-representative-section')} data-id="partyRepresentativeSelector">
                  <Field
                    name={'SELECTED_PARTY_REPRESENTATIVE'}
                    id={'partyRepresentativeSelector'}
                    component={rfPartyRepresentativeDropdown}
                    updatePartyRepresentative={updatePartyRepresentative}
                    updateFieldValue={changeFunction}
                    errorMessage={this.validatePartyRepresentative()}
                    label={t('LEASE_FORM_PARTY_REPRESENTATIVE')}
                    items={residents}
                    readOnly={readOnly}
                  />
                </div>
              )}
            </Section>
            {this.renderChargesAndConcessionsSection()}
            {publishedTerm && this.renderAdditionalChargesSection(additionalAndOneTimeCharges, publishedTerm, changeFunction)}
            {publishedTerm && this.renderOneTimeChargesSection(additionalAndOneTimeCharges, additionalAndOneTimeChargesFromPublishedQuoteData, publishedTerm)}
            {shouldRenderAdditionalLeaseAddendumSection && this.renderAdditionalLeaseAddendumSection(documents, additionalConditions)}
          </form>
        </LeftPanel>
        <RightPanel>
          {companyName && (
            <div className={cf('category-summary')}>
              <TextHeavy>{t('COMPANY')}</TextHeavy>
              <Text secondary id="companyNameTxt">
                {companyName}
              </Text>
            </div>
          )}
          {!!residents.length && this.renderCategorySummary(residentsLabel, residents)}
          {!!guarantors.length && this.renderCategorySummary('GUARANTORS', guarantors)}
          {!!occupantsSummaryInfo.length && this.renderCategorySummary('NON_LEASEHOLDER_OCCUPANTS', occupantsSummaryInfo)}
          {!!children.length && this.renderCategorySummary('MINORS', children)}
          {!!pets.length && this.renderCategorySummary('PETS_AND_ASSISTANCE_ANIMALS', pets)}
          {!!vehicles.length && this.renderCategorySummary('VEHICLES', vehicles)}
          {this.renderContractDocuments(documents)}
        </RightPanel>
      </TwoPanelPage>
    );
  };
}

const formName = 'leaseForm';
const selector = formValueSelector(formName);

const buildSelectors = (state, { publishedTerm, additionalAndOneTimeCharges }) => {
  const selectedOccupants = selector(state, 'SELECTED_OCCUPANTS');
  const selectedPartyRepresentative = selector(state, 'SELECTED_PARTY_REPRESENTATIVE');
  const leaseStartDateValue = selector(state, 'LEASE_START_DATE');
  const originalLeaseStartDateValue = selector(state, 'ORIGINAL_LEASE_START_DATE');
  const moveInDateValue = selector(state, 'MOVE_IN_DATE');
  const leaseEndDateValue = selector(state, 'LEASE_END_DATE');
  const originalLeaseEndDateValue = selector(state, 'ORIGINAL_LEASE_END_DATE');
  const baseRentValue = selector(state, 'BASE_RENT');
  const sfsuAddendumIncluded = selector(state, 'SFSU_ADDENDUM');
  const studentEarlyTerminationAddendumIncluded = selector(state, 'STUDENT_EARLY_TERMINATION_ADDENDUM');
  const student2022OfferAddendumIncluded = selector(state, 'STUDENT_2022_OFFER_ADDENDUM');

  const concessionsSelectors = {};
  const concessionIds = [];

  publishedTerm.concessions.forEach(concession => {
    concessionsSelectors[`has_concession_${concession.id}`] = selector(state, `concession_${concession.id}_checkbox`);
    concessionsSelectors[`concession_${concession.id}_toggle_amount_editor`] = selector(state, `concession_${concession.id}_toggle_amount`);
    concessionIds.push(concession.id);
    concessionsSelectors[`concession_${concession.id}_variableAdjustment`] = selector(state, `concession_${concession.id}_amountVariableAdjustment`);
  });

  const additionalAndOneTimeFees = getAdditionalAndOneTimeFeesFromPublishTermPeriod(additionalAndOneTimeCharges, publishedTerm.period);

  const additionalChargesSelectors = {};
  const additionalChargesConcessionsSelectors = {};
  const petFeeIds = [];
  const storageFeeIds = [];
  const parkingFeeIds = [];

  const additionalCharges = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ADDITIONAL) : [];
  additionalCharges.forEach(charge => {
    const visibleFees = charge.fees.filter(fee => fee.visible);
    visibleFees.forEach(fee => {
      additionalChargesSelectors[`has_additional_${fee.id}`] = selector(state, `additional_${fee.id}_checkbox`);
      additionalChargesSelectors[`additional_${fee.id}_quantity`] = selector(state, `additional_${fee.id}_dropdown`);
      if (canHaveRentableItems(fee)) {
        additionalChargesSelectors[`additional_${fee.id}_selectedInventories`] = selector(state, `additional_${fee.id}_inventories`);
      }
      if (fee.quoteSectionName === DALTypes.QuoteSection.PET) {
        petFeeIds.push(fee.id);
      }
      if (fee.quoteSectionName === DALTypes.QuoteSection.STORAGE) {
        storageFeeIds.push(fee.id);
      }
      if (fee.quoteSectionName === DALTypes.QuoteSection.PARKING) {
        parkingFeeIds.push(fee.id);
      }

      fee.concessions.forEach(concession => {
        additionalChargesConcessionsSelectors[`additional_${fee.id}_concession_${concession.id}_amount`] = selector(
          state,
          `additional_${fee.id}_concession_${concession.id}_amount`,
        );
      });
    });
  });

  const oneTimeChargesSelectors = {};
  const oneTimeChargesBaseAmounts = {};

  const oneTimeCharges = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ONETIME) : [];
  oneTimeCharges.forEach(charge => {
    charge.fees.forEach(fee => {
      oneTimeChargesSelectors[`has_onetime_${fee.id}`] = selector(state, `onetime_${fee.id}_checkbox`);
      oneTimeChargesSelectors[`onetime_${fee.id}_quantity`] = selector(state, `onetime_${fee.id}_dropdown`);
      oneTimeChargesBaseAmounts[fee.id] = fee.amount;
    });
  });

  return {
    selectedOccupants,
    selectedPartyRepresentative,
    leaseStartDateValue,
    originalLeaseStartDateValue,
    moveInDateValue,
    leaseEndDateValue,
    originalLeaseEndDateValue,
    baseRentValue,
    concessionsSelectors,
    additionalChargesSelectors,
    oneTimeChargesSelectors,
    concessionIds,
    petFeeIds,
    storageFeeIds,
    parkingFeeIds,
    oneTimeChargesBaseAmounts,
    sfsuAddendumIncluded,
    studentEarlyTerminationAddendumIncluded,
    student2022OfferAddendumIncluded,
    additionalChargesConcessionsSelectors,
  };
};

const getAdjustedLeaseEnd = (adjustedLeaseStart, prevLeaseStart, prevLeaseEnd) => {
  const leaseDuration = duration(prevLeaseEnd.diff(prevLeaseStart));
  return adjustedLeaseStart.clone().add(leaseDuration);
};

const getAdjustedDates = (leaseTerm, { readOnly, timezone } = {}) => {
  const { leaseStartDate, moveInDate = '', leaseEndDate = '' } = leaseTerm;

  const leaseStart = toMoment(leaseStartDate, { timezone });
  const moveIn = moveInDate && toMoment(moveInDate, { timezone });
  const leaseEnd = leaseEndDate && toMoment(leaseEndDate, { timezone });

  let adjustedLeaseEnd;
  const nowDate = now({ timezone }).startOf('day');
  const adjustedLeaseStart = leaseStart;
  // this is a lexographical comparison but will work because of the date format
  if (!readOnly && nowDate.isAfter(leaseStart)) {
    adjustedLeaseEnd = leaseEnd
      ? getAdjustedLeaseEnd(adjustedLeaseStart, leaseStart, leaseEnd)
      : getEndDateFromStartDate(adjustedLeaseStart, leaseTerm, timezone);
  } else {
    adjustedLeaseEnd = readOnly ? leaseEnd : leaseEnd || getEndDateFromStartDate(leaseStart, leaseTerm, timezone);
  }

  if (moveIn && !readOnly) {
    adjustedLeaseEnd = getAdjustedLeaseEnd(adjustedLeaseStart, leaseStart, leaseEnd);
  }
  const adjustedDates = [adjustedLeaseStart, moveIn, adjustedLeaseEnd].map(d => (d ? d.toISOString() : undefined));
  return adjustedDates;
};

const getFeeAmount = fee => fee.amount;

const buildChargeConcessionsValues = ({ fee, isOneTime, selectedFeeFromQuote, selectedFeeFromPublishedLease, term }) => {
  const fieldNameType = getChargeFieldNameType(isOneTime);
  const selectors = fee.concessions
    ?.filter(c => !c.bakedIntoAppliedFeeFlag || isOneTime)
    .reduce((acc, concession) => {
      const isNotVariable = !concession.variableAdjustment;
      const selectedConcession =
        (selectedFeeFromPublishedLease?.concessions && selectedFeeFromPublishedLease.concessions[concession.id]) ||
        selectedFeeFromQuote?.selectedConcessions.find(c => concession.id === c.id);

      if (selectedConcession) {
        let concessionAmount;
        if (selectedFeeFromQuote) {
          concessionAmount = isNotVariable ? selectedConcession.amount : selectedConcession.amountVariableAdjustment;
        } else concessionAmount = selectedFeeFromPublishedLease?.concessions[concession.id];
        acc[`${fieldNameType}_${fee.id}_concession_${concession.id}_checkbox`] = true;
        acc[`${fieldNameType}_${fee.id}_concession_${concession.id}_amount`] = concessionAmount;
      } else {
        acc[`${fieldNameType}_${fee.id}_concession_${concession.id}_checkbox`] = false;
        acc[`${fieldNameType}_${fee.id}_concession_${concession.id}_amount`] = isNotVariable
          ? getConcessionValue(concession, {
              amount: fee.price,
              length: concession.recurringCount || term.termLength,
            })
          : Math.abs(concession.absoluteAdjustment);
      }
      return acc;
    }, {});

  return selectors;
};

export const buildFormValuesFromPublishedQuote = (
  { publishedTerm, additionalAndOneTimeCharges, selections, concessions },
  { additionalConditions, defaultInsuranceSelected, timezone },
  baseRentValue,
) => {
  const concessionsInitialValues = concessions.reduce((acc, concession) => {
    if (concession.bakedIntoAppliedFeeFlag) {
      return acc;
    }

    acc[`concession_${concession.id}_checkbox`] = false;
    acc[`concession_${concession.id}_toggle_amount`] = false;

    const isNotVariable = !concession.variableAdjustment;
    const unitRent = baseRentValue || publishedTerm.adjustedMarketRent;

    const publishedConcession = publishedTerm.concessions.find(c => c.id === concession.id) || {};

    const concessionAmount = getConcessionValue(
      { ...concession, ...publishedConcession },
      {
        amount: unitRent || publishedTerm.adjustedMarketRent,
        length: publishedTerm.termLength,
      },
    );

    acc[`concession_${concession.id}_amount`] = concessionAmount;
    if (isNotVariable) {
      acc[`concession_${concession.id}_relativeAmount`] = computeConcessionRelativeAmount(concession, unitRent);
    } else {
      acc[`concession_${concession.id}_amountVariableAdjustment`] = publishedConcession.amountVariableAdjustment;
    }

    acc[`concession_${concession.id}_checkbox`] = !!publishedConcession.selected;

    return acc;
  }, {});

  const additionalAndOneTimeFees = getAdditionalAndOneTimeFeesFromPublishTermPeriod(additionalAndOneTimeCharges, publishedTerm.period);
  const selectedFees = (selections && selections.selectedAdditionalAndOneTimeCharges && selections.selectedAdditionalAndOneTimeCharges.fees) || [];

  const additionalCharges = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ADDITIONAL) : [];
  const additionalChargesValues = additionalCharges.reduce((acc, charge) => {
    const visibleFees = charge.fees.filter(fee => fee.visible);

    visibleFees.forEach(fee => {
      updateAdditionalChargesParentFee(fee, publishedTerm);
      setDefaultVariableAmount(fee, fee.amount);
    });

    visibleFees.forEach(fee => {
      const selectedFee = getSelectedFee(selectedFees, fee);
      if (selectedFee) {
        acc[`additional_${fee.id}_checkbox`] = true;
        acc[`additional_${fee.id}_dropdown`] = selectedFee.quantity;
        acc[`additional_${fee.id}_amount`] = parseFloat(selectedFee.amount) * parseFloat(selectedFee.quantity);
      } else {
        acc[`additional_${fee.id}_checkbox`] = false;
        acc[`additional_${fee.id}_dropdown`] = 1;
        acc[`additional_${fee.id}_amount`] = getFeeAmount(fee);
      }
      if (canHaveRentableItems(fee)) {
        const selectedInventories = getSelectedInventories(fee);
        selectedInventories && selectedInventories.length && (acc[`additional_${fee.id}_inventories`] = getSelectedInventories(fee));
      }

      const chargeConcessionsSelectors = buildChargeConcessionsValues({ fee, isOneTime: false, selectedFeeFromQuote: selectedFee, term: publishedTerm });
      acc = { ...acc, ...chargeConcessionsSelectors };
    });
    return acc;
  }, {});

  const oneTimeCharges = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ONETIME) : [];
  const additionalAndOneTimeChargesFromPublishedQuoteData = publishedTerm.additionalAndOneTimeCharges;
  const oneTimeChargesFromPublishedQuoteDataMap = keyBy(additionalAndOneTimeChargesFromPublishedQuoteData.oneTimeCharges, 'id');
  const oneTimeChargesValues = oneTimeCharges.reduce((acc, charge) => {
    charge.fees.forEach(fee => {
      updateAdditionalChargesParentFee(fee, publishedTerm);
      setDefaultVariableAmount(fee, fee.amount);
      const selectedFee = getSelectedFee(selectedFees, fee);

      const matchingKey = Object.keys(oneTimeChargesFromPublishedQuoteDataMap).find(key =>
        key.startsWith(fee.id.substring(0, fee.id.indexOf('>>') === -1 ? fee.id.length : fee.id.indexOf('>>'))),
      );

      acc[`onetime_${fee.id}_checkbox`] = !!matchingKey;
      const oneTimeCharge = matchingKey && oneTimeChargesFromPublishedQuoteDataMap[matchingKey];
      let amount = parseFloat(fee.amount);

      if (oneTimeCharge && oneTimeCharge.relativeAmountsByLeaseTerm) {
        const relativeAmountByLeaseTerm = oneTimeCharge.relativeAmountsByLeaseTerm.find(ra => ra.leaseTermId === publishedTerm.id);
        if (relativeAmountByLeaseTerm) {
          amount = relativeAmountByLeaseTerm.amount;
        }
      }
      const additionalUnitDepositRequired = fee.name.toUpperCase() === 'UNITDEPOSIT' && additionalConditions && additionalConditions.additionalDeposit;
      if (additionalUnitDepositRequired) {
        amount = additionalConditions.additionalDepositAmount;
      }

      if (selectedFee) {
        const selectedFeeAmount = parseFloat(selectedFee.amount || 0); // in quote.selections.selectedAdditionalAndOneTimeCharges.fees the amount for unitDeposit is stored as string and as a number for holddeposit
        if (!additionalUnitDepositRequired && (selectedFeeAmount || selectedFee.amount === 0)) {
          acc[`onetime_${fee.id}_amount`] = selectedFeeAmount;
        } else {
          acc[`onetime_${fee.id}_amount`] = parseFloat(amount) * parseFloat(selectedFee.quantity);
        }
        acc[`onetime_${fee.id}_dropdown`] = selectedFee.quantity;
      } else {
        acc[`onetime_${fee.id}_amount`] = parseFloat(amount);
        acc[`onetime_${fee.id}_dropdown`] = fee.quantity;
      }

      const chargeConcessionsSelectors = buildChargeConcessionsValues({ fee, isOneTime: true, selectedFeeFromQuote: selectedFee, term: publishedTerm });
      acc = { ...acc, ...chargeConcessionsSelectors };
    });
    return acc;
  }, {});

  const [leaseStartDateValue, _, leaseEndDateValue] = getAdjustedDates(publishedTerm, { timezone });

  return {
    SELECTED_OCCUPANTS: [],
    SELECTED_PARTY_REPRESENTATIVE: '',
    LEASE_START_DATE: leaseStartDateValue,
    ORIGINAL_LEASE_START_DATE: leaseStartDateValue,
    MOVE_IN_DATE: leaseStartDateValue,
    LEASE_END_DATE: leaseEndDateValue,
    ORIGINAL_LEASE_END_DATE: leaseEndDateValue,
    BASE_RENT: baseRentValue || publishedTerm.adjustedMarketRent,
    RENTERS_INSURANCE_FACTS: defaultInsuranceSelected ? 'takeOwnerInsuranceFlag' : 'buyInsuranceFlag',
    ...concessionsInitialValues,
    ...additionalChargesValues,
    ...oneTimeChargesValues,
  };
};

const getOriginalFeeId = (fees, id) => {
  // If fee does not have a 1:1 relationship
  if (fees.filter(fee => fee.id.indexOf(id) !== -1).length > 1) {
    return id;
  }

  // Returns the last id(fee id) from the composite id
  const feeIdParts = id.split('--');
  return feeIdParts[feeIdParts.length - 1];
};

// This function uses ISO dates from the published lease term
const buildFormValuesFromPublishedLease = (additionalData, { baselineData, publishedLease, readOnly, timezone, unitRent } = {}) => {
  const { publishedTerm, concessions, additionalAndOneTimeCharges } = additionalData;
  const {
    additionalCharges: selectedAdditionalCharges,
    concessions: selectedConcessions,
    oneTimeCharges: selectedOneTimeCharges,
    rentersInsuranceFacts,
    sfsuAddendumIncluded,
    studentEarlyTerminationAddendumIncluded,
    student2022OfferAddendumIncluded,
    termLength,
  } = publishedLease;

  const selectedOccupants = baselineData.occupants.map(occ => occ.id);
  const selectedPartyRepresentative = baselineData.partyRepresentative?.map(pr => pr.id);

  if (termLength) {
    publishedTerm.termLength = termLength;
  }

  const concessionsInitialValues = concessions.reduce((acc, concession) => {
    if (concession.bakedIntoAppliedFeeFlag) {
      return acc;
    }

    const isVariable = !!concession.variableAdjustment;
    const concessionObject = selectedConcessions[concession.id];

    if (concessionObject) {
      const concessionAmount = !isVariable
        ? getConcessionValue(
            { ...concession, amountVariableAdjustment: concessionObject.amountVariableAdjustment },
            {
              amount: unitRent || publishedTerm.adjustedMarketRent,
              length: publishedTerm.termLength,
            },
          )
        : Math.abs(concessionObject.amount);

      acc[`concession_${concession.id}_checkbox`] = true;
      acc[`concession_${concession.id}_amount`] = concessionAmount;
      if (isVariable) {
        acc[`concession_${concession.id}_amountVariableAdjustment`] = concessionObject.amountVariableAdjustment;
      }
    } else {
      acc[`concession_${concession.id}_checkbox`] = false;
      const amount = !isVariable
        ? getConcessionValue(concession, {
            amount: unitRent || publishedTerm.adjustedMarketRent,
            length: publishedTerm.termLength,
          })
        : Math.abs(concession.absoluteAdjustment);
      acc[`concession_${concession.id}_amount`] = amount;
    }

    if (!isVariable) {
      acc[`concession_${concession.id}_relativeAmount`] = computeConcessionRelativeAmount(concession, unitRent);
    }
    return acc;
  }, {});

  const additionalAndOneTimeFees = getAdditionalAndOneTimeFeesFromPublishTermPeriod(additionalAndOneTimeCharges, publishedTerm.period);

  const additionalCharges = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ADDITIONAL) : [];
  const additionalChargesValues = additionalCharges.reduce((acc, charge) => {
    const visibleFees = charge.fees.filter(fee => fee.visible);
    visibleFees.forEach(fee => {
      const chargeObject = selectedAdditionalCharges[fee.id] || selectedAdditionalCharges[getOriginalFeeId(charge.fees, fee.id)];
      if (chargeObject) {
        acc[`additional_${fee.id}_checkbox`] = true;
        acc[`additional_${fee.id}_dropdown`] = chargeObject.quantity;
        acc[`additional_${fee.id}_amount`] = chargeObject.amount;
        if (!fee.hasInventoryPool && (isInventoryGroupFee(fee) || chargeObject.quoteSectionName === 'parking')) {
          const selectedInventories = getSelectedInventories(chargeObject);
          selectedInventories?.length && (acc[`additional_${fee.id}_inventories`] = getSelectedInventories(chargeObject));
        }
      } else {
        acc[`additional_${fee.id}_checkbox`] = false;
        acc[`additional_${fee.id}_dropdown`] = 1;
        acc[`additional_${fee.id}_amount`] = getFeeAmount(fee);
      }

      const chargeConcessionsSelectors = buildChargeConcessionsValues({
        fee,
        isOneTime: false,
        selectedFeeFromPublishedLease: chargeObject,
        term: publishedTerm,
      });
      acc = { ...acc, ...chargeConcessionsSelectors };
    });
    return acc;
  }, {});

  const oneTimeCharges = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ONETIME) : [];
  const oneTimeChargesValues = oneTimeCharges.reduce((acc, charge) => {
    charge.fees.forEach(fee => {
      const matchingKey = Object.keys(selectedOneTimeCharges).find(key =>
        key.startsWith(fee.id.substring(0, fee.id.indexOf('>>') === -1 ? fee.id.length : fee.id.indexOf('>>'))),
      );
      acc[`onetime_${fee.id}_checkbox`] = !!matchingKey;
      const oneTimeCharge = matchingKey && selectedOneTimeCharges[matchingKey];
      if (oneTimeCharge) {
        acc[`onetime_${fee.id}_checkbox`] = true;
        acc[`onetime_${fee.id}_amount`] = oneTimeCharge.amount;
        acc[`onetime_${fee.id}_dropdown`] = oneTimeCharge.quantity;
      } else {
        acc[`onetime_${fee.id}_checkbox`] = false;
        acc[`onetime_${fee.id}_amount`] = fee.amount;
      }

      const chargeObject = selectedOneTimeCharges[fee.id];
      const chargeConcessionsSelectors = buildChargeConcessionsValues({
        fee,
        isOneTime: true,
        selectedFeeFromPublishedLease: chargeObject,
        term: publishedTerm,
      });
      acc = { ...acc, ...chargeConcessionsSelectors };
    });
    return acc;
  }, {});

  const [leaseStartDateValue, moveInDateValue, leaseEndDateValue] = getAdjustedDates(publishedLease, { readOnly, timezone });
  return {
    SELECTED_OCCUPANTS: selectedOccupants,
    SELECTED_PARTY_REPRESENTATIVE: selectedPartyRepresentative,
    LEASE_START_DATE: leaseStartDateValue,
    ORIGINAL_LEASE_START_DATE: leaseStartDateValue,
    MOVE_IN_DATE: moveInDateValue,
    LEASE_END_DATE: leaseEndDateValue,
    ORIGINAL_LEASE_END_DATE: leaseEndDateValue,
    BASE_RENT: unitRent,
    RENTERS_INSURANCE_FACTS: rentersInsuranceFacts,
    SFSU_ADDENDUM: sfsuAddendumIncluded,
    STUDENT_EARLY_TERMINATION_ADDENDUM: studentEarlyTerminationAddendumIncluded,
    STUDENT_2022_OFFER_ADDENDUM: student2022OfferAddendumIncluded,
    ...concessionsInitialValues,
    ...additionalChargesValues,
    ...oneTimeChargesValues,
  };
};

const leaseForm = reduxForm({
  form: formName,
  onSubmit: submit,
  validate,
  warn,
})(LeaseFormComponent);

const wrappedLeaseForm = connect(
  (state, props) => {
    const { readOnly, lease, setLeaseAvailability, additionalData } = props;
    const { id: leaseId, partyId, quoteId, baselineData: model } = lease;

    const selectors = buildSelectors(state, additionalData);
    let initialValues = {};
    initialValues = model.publishedLease
      ? buildFormValuesFromPublishedLease(additionalData, {
          baselineData: model,
          publishedLease: model.publishedLease,
          readOnly,
          timezone: model.timezone,
          unitRent: selectors.baseRentValue || model.publishedLease.unitRent,
        })
      : buildFormValuesFromPublishedQuote(additionalData, model, selectors.baseRentValue);

    return {
      setLeaseAvailability,
      leaseId,
      partyId,
      quoteId,
      readOnly,
      additionalData,
      model: getModelWithDuplicateFlag(props),
      ...selectors,
      initialValues,
      unitReservedWarning: getUnitReservedWarning(state, props),
      inventoryAvailability: getInventoryAvailabilityByLease(state),
      allowRentableItemSelection: getAllowRentableItemSelection(state),
      currentUserId: (state.auth.user || {}).id,
      backendName: (state.auth.user || {}).backendName,
    };
  },
  dispatch =>
    bindActionCreators(
      {
        loadInventoryDetails,
      },
      dispatch,
    ),
)(leaseForm);

export default wrappedLeaseForm;
