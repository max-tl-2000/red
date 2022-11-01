/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography as T, Field, CheckBox, Dropdown, TextBox, MoneyTextBox, RedList } from 'components';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import { createDialogFormModel } from './DialogFormModel';
import { cf } from './ApprovalDialog.scss';
import { formatMoney } from '../../../../common/money-formatter';
import { ApprovalIncreaseDeposit } from '../../../../common/enums/approvalTypes';
import DecisionDialog from './DecisionDialog';
import { getAssociatedPropertySettingsForParty } from '../../../redux/selectors/partySelectors';
import { DALTypes } from '../../../../common/enums/DALTypes';

const { ListItem, MainSection, Divider } = RedList;

const getDepositDropdownItems = unitDepositAmount => {
  const depositDropdownItems = ApprovalIncreaseDeposit.AMOUNT_X_VALUES.map(increaseDepositValue => ({
    id: `${ApprovalIncreaseDeposit.AMOUNT_ID_PREFIX}${increaseDepositValue}`,
    amount: unitDepositAmount * increaseDepositValue,
    label: `(${increaseDepositValue}x ${t('APPROVAL_DIALOG_DEPOSIT')})`,
    decision: `${increaseDepositValue}x ${t('APPROVAL_DIALOG_DEPOSIT')}`,
  }));
  depositDropdownItems.push({
    id: ApprovalIncreaseDeposit.ID_OTHER_AMOUNT,
    amount: 0,
    label: t('APPROVAL_DIALOG_OTHER_DEPOSIT'),
    decision: DALTypes.APPROVAL_CONDITIONS.OTHER,
  });
  return depositDropdownItems;
};

const getDepositAmountValueById = (depositDropdownItems, id) => depositDropdownItems.find(depositDropdownItem => depositDropdownItem.id === id).amount;
const getDepositDecisionById = (depositDropdownItems, id) => depositDropdownItems.find(depositDropdownItem => depositDropdownItem.id === id).decision;

@connect((state, props) => ({
  propertySettings: getAssociatedPropertySettingsForParty(state, props),
}))
@observer
export class ApprovalDialog extends Component {
  static propTypes = {
    onApprove: PropTypes.func,
    inventoryName: PropTypes.string,
    unitDepositAmount: PropTypes.number,
    dialogOpen: PropTypes.bool,
    onCancel: PropTypes.func,
    applicantsWithDisclosures: PropTypes.array,
  };

  constructor(props, context) {
    super(props, context);
    this.depositDropdownItems = getDepositDropdownItems(this.props.unitDepositAmount);
    const selectedDepositId = `${ApprovalIncreaseDeposit.AMOUNT_ID_PREFIX}${ApprovalIncreaseDeposit.AMOUNT_X_VALUES[0]}`;
    this.state = {
      model: createDialogFormModel(),
      additionalDepositInputsStyle: 'hide',
      approveButtonLabel: t('APPROVE'),
      showDepositAmountInput: false,
      showDepositAmountDropdown: false,
      sureDepositChecked: false,
      npsRentAssuranceChecked: false,
      selectedDepositId,
      additionalDepositLabel: t('APPROVAL_DIALOG_ADDITIONAL_DEPOSIT'),
    };
    const { fields } = this.state.model;
    fields.additionalDepositAmount.value = getDepositAmountValueById(this.depositDropdownItems, selectedDepositId);
    fields.additionalDepositDecision.value = getDepositDecisionById(this.depositDropdownItems, selectedDepositId);
  }

  handleApproveClick = async () => {
    const { onApprove, applicantsWithDisclosures, quoteId } = this.props;
    const { model } = this.state;
    const { fields } = model;
    await model.validate();
    if (model.valid) {
      onApprove &&
        onApprove({
          additionalNotes: fields.additionalNotes.value,
          additionalDeposit: fields.additionalDeposit.value,
          additionalDepositAmount: fields.additionalDepositAmount.value,
          additionalDepositDecision: fields.additionalDepositDecision.value,
          sureDeposit: fields.sureDeposit.value,
          npsRentAssurance: fields.npsRentAssurance.value,
          applicantsWithDisclosures,
          quoteId,
        });
    }
  };

  isAnyConditionChecked = conditionsState => {
    let { showDepositAmountDropdown, sureDepositChecked, npsRentAssuranceChecked } = this.state;
    if (sureDepositChecked || npsRentAssuranceChecked) return true;

    if (Object.prototype.hasOwnProperty.call(conditionsState, 'showDepositAmountDropdown')) {
      showDepositAmountDropdown = conditionsState.showDepositAmountDropdown;
    }
    return showDepositAmountDropdown;
  };

  setApproveButtonLabel = conditionsState => {
    if (this.isAnyConditionChecked(conditionsState)) {
      this.setState({ approveButtonLabel: t('APPROVE_WITH_COND') });
    } else {
      this.setState({ approveButtonLabel: t('APPROVE') });
    }
  };

  showAdditionalDepositDropdown = checked => {
    const showDepositAmountDropdown = checked;
    this.setState({ showDepositAmountDropdown });
    this.setApproveButtonLabel({ showDepositAmountDropdown });
  };

  handleAdditionalDepositClick = (option, checked) => {
    const { model } = this.state;
    const { fields } = model;
    const additionalDepositLabel = checked ? t('APPROVAL_DIALOG_ADDITIONAL_DEPOSIT_TO') : t('APPROVAL_DIALOG_ADDITIONAL_DEPOSIT');

    switch (option) {
      case DALTypes.ConditionalApprovalOptions.INCREASED_DEPOSIT:
        this.setState({ additionalDepositLabel });
        fields.additionalDeposit.setValue(checked);
        this.showAdditionalDepositDropdown(checked);
        break;
      case DALTypes.ConditionalApprovalOptions.SURE_DEPOSIT:
        fields.sureDeposit.setValue(checked);
        this.setState({ sureDepositChecked: checked }, () => {
          this.setApproveButtonLabel({ sureDepositChecked: checked });
        });
        break;
      case DALTypes.ConditionalApprovalOptions.NPS_RENT_ASSURANCE:
        fields.npsRentAssurance.setValue(checked);
        this.setState({ npsRentAssuranceChecked: checked }, () => {
          this.setApproveButtonLabel({ npsRentAssuranceChecked: checked });
        });
        break;
      default:
        break;
    }
  };

  formatDepositItem = ({ id, amount, label }) => {
    if (id === ApprovalIncreaseDeposit.ID_OTHER_AMOUNT) {
      return label;
    }
    const { result: formattedAmount } = formatMoney({
      amount,
      currency: 'USD',
    });
    return `${formattedAmount} ${label}`;
  };

  renderDepositItem = ({ item: { originalItem } }) => {
    const formattedDeposit = this.formatDepositItem(originalItem);
    return (
      <div>
        {originalItem.id === ApprovalIncreaseDeposit.ID_OTHER_AMOUNT && <Divider />}
        <ListItem id={originalItem.id}>
          <MainSection>
            <T.Text>{formattedDeposit}</T.Text>
          </MainSection>
        </ListItem>
      </div>
    );
  };

  handleAdditionalDepositDropdownClick = selectedDepositId => {
    const isOtherAmountSelected = selectedDepositId === ApprovalIncreaseDeposit.ID_OTHER_AMOUNT;

    this.setState({ selectedDepositId });
    this.setState({ showDepositAmountInput: isOtherAmountSelected });

    const { fields } = this.state.model;
    if (!isOtherAmountSelected) {
      fields.additionalDepositAmount.value = getDepositAmountValueById(this.depositDropdownItems, selectedDepositId);
      fields.additionalDepositDecision.value = getDepositDecisionById(this.depositDropdownItems, selectedDepositId);
    } else {
      fields.additionalDepositAmount.value = DALTypes.APPROVAL_CONDITIONS.NONE;
      fields.additionalDepositDecision.value = DALTypes.APPROVAL_CONDITIONS.OTHER;
    }
    fields.increaseDepositOption.setValue(selectedDepositId);
  };

  formatSelectedDeposit = ({ selected }) => this.formatDepositItem(selected[0].originalItem);

  handleOnCloseRequest = async () => {
    const { model } = this.state;
    const { onCloseRequest } = this.props;

    this.setState({
      showDepositAmountInput: false,
      showDepositAmountDropdown: false,
      sureDepositChecked: false,
      npsRentAssuranceChecked: false,
      selectedDepositId: `${ApprovalIncreaseDeposit.AMOUNT_ID_PREFIX}${ApprovalIncreaseDeposit.AMOUNT_X_VALUES[0]}`,
    });
    model.clearValues();

    onCloseRequest && onCloseRequest();
  };

  renderOption = (option, index) => {
    const { model, showDepositAmountInput, showDepositAmountDropdown, selectedDepositId, additionalDepositLabel } = this.state;
    const { fields } = model;

    switch (option) {
      case DALTypes.ConditionalApprovalOptions.INCREASED_DEPOSIT:
        return (
          <div key={index}>
            <Field inline className={cf('approval-form-options')} noMargin wrapperClassName={cf('approval-condition')}>
              <CheckBox
                id="increaseDeposit"
                label={additionalDepositLabel}
                checked={fields.additionalDeposit.value}
                onChange={value => this.handleAdditionalDepositClick(option, value)}
              />
            </Field>
            {showDepositAmountDropdown && (
              <Field inline columns={5} gutterWidth={8} noMargin className={cf('fade-in-right')} wrapperClassName={cf('approval-condition')}>
                <Dropdown
                  id="depositDropdown"
                  wide
                  items={this.depositDropdownItems}
                  renderItem={this.renderDepositItem}
                  formatSelected={this.formatSelectedDeposit}
                  selectedValue={selectedDepositId}
                  onChange={({ id }) => this.handleAdditionalDepositDropdownClick(id)}
                />
              </Field>
            )}
            {showDepositAmountDropdown && showDepositAmountInput && (
              <Field inline columns={3} noMargin last className={cf('fade-in-right')} wrapperClassName={cf('approval-condition')}>
                <MoneyTextBox
                  id="depositAmountTxt"
                  value={fields.additionalDepositAmount.value}
                  onChange={({ value }) => fields.additionalDepositAmount.setValue(value)}
                  showClear={false}
                  errorMessage={fields.additionalDepositAmount.errorMessage}
                />
              </Field>
            )}
          </div>
        );
      case DALTypes.ConditionalApprovalOptions.SURE_DEPOSIT:
        return (
          <div key={index}>
            <Field className={cf('approval-form-options')} noMargin wrapperClassName={cf('approval-condition')}>
              <CheckBox
                id="sureDeposit"
                label={t('SURE_DEPOSIT')}
                checked={fields.sureDeposit.value}
                onChange={value => this.handleAdditionalDepositClick(option, value)}
              />
            </Field>
          </div>
        );
      case DALTypes.ConditionalApprovalOptions.NPS_RENT_ASSURANCE:
        return (
          <div key={index}>
            <Field className={cf('approval-form-options')} noMargin wrapperClassName={cf('approval-condition')}>
              <CheckBox
                id="npsRentAssurance"
                label={t('NPS_RENT_ASSURANCE')}
                checked={fields.npsRentAssurance.value}
                onChange={value => this.handleAdditionalDepositClick(option, value)}
              />
            </Field>
          </div>
        );
      default:
        return <div />;
    }
  };

  renderConditionalApprovalOptions = conditionalApprovalOptions => conditionalApprovalOptions.map((option, index) => this.renderOption(option, index));

  render = () => {
    const { dialogOpen, inventoryName, propertySettings } = this.props;
    const conditionalApprovalOptions = propertySettings?.applicationReview?.conditionalApprovalOptions || [];
    const { model, approveButtonLabel } = this.state;
    const { fields } = model;

    return (
      <DecisionDialog
        id="approveApplication"
        open={dialogOpen}
        onCloseRequest={this.handleOnCloseRequest}
        onOkClick={this.handleApproveClick}
        lblOK={approveButtonLabel}
        okButtonDisabled={!model.valid}
        title={t('APPROVAL_DIALOG_TITLE')}
        subTitle={t('APPROVAL_DIALOG_SUBTITLE', { inventoryName })}
        headerColor={cf('approval-header')}>
        <Field columns={12} noMargin>
          <TextBox
            id="internalNotes"
            placeholder={t('DIALOG_INTERNAL_ADDITIONAL_NOTES')}
            value={fields.additionalNotes.value}
            wide
            onChange={({ value }) => fields.additionalNotes.setValue(value)}
          />
        </Field>
        {conditionalApprovalOptions.length > 0 && (
          <div>
            <Field columns={12} noMargin>
              <T.Text secondary className={cf('approval-form-title')}>
                {t('APPROVAL_DIALOG_FORM_TITLE')}
              </T.Text>
            </Field>
            {this.renderConditionalApprovalOptions(conditionalApprovalOptions)}
          </div>
        )}
      </DecisionDialog>
    );
  };
}
