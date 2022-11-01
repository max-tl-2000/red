/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Typography as T, Form, CheckBox, Dropdown, Field, AutoSize, PhoneTextBox } from 'components';
import { t } from 'i18next';
import enumToArray from 'enums/enumHelper';
import { dateMask, zipCode, ssn } from 'components/TextBox/masks';
import StateDropdown from 'custom-components/StateDropdown/StateDropdown';
import { RentappTypes } from '../../../common/enums/rentapp-types';
import { cf } from './application-details.scss';
import AddressAutocomplete from '../../custom-components/address-autocomplete/address-autocomplete';
import snackbar from '../../../../client/helpers/snackbar/snackbar';
import { localCountry } from '../../../common/application-constants';
import { getChipTextBox, getMoneyTextBox, getTextBox } from '../../../../client/helpers/field-helpers';
import { FormSummary } from '../../../../client/components/index';
import FormattedMarkdown from '../../../../client/components/Markdown/FormattedMarkdown';

const MAX_NUM_GUARANTORS = 1;
@observer
export class ApplicationDetails extends Component {
  static propTypes = {
    model: PropTypes.object,
    isGuarantor: PropTypes.bool,
    isReadOnly: PropTypes.bool,
    isEmailDisabled: PropTypes.bool,
    invitesDisabled: PropTypes.bool,
  };

  constructor(props, context) {
    super(props, context);
    this.timesFrames = enumToArray(RentappTypes.TimeFrames).map(tf => ({
      id: tf.value,
      text: t(tf.value),
    }));
  }

  validateEmail = email => {
    const {
      model: { validateEmail },
    } = this.props;
    return validateEmail(email);
  };

  handleOnSelectAddress = address => {
    const { model } = this.props;
    model.autocompleteAddress(address);
  };

  handleOnSelectInternationalAddress = address => {
    if (address.country === localCountry) {
      snackbar.show({ text: t('LOCAL_ADDRESS_SELECTED_FROM_INTERNATIONAL_INPUT') });
      this.handleOnSelectAddress(address);
      return;
    }

    const { model } = this.props;
    model.autocompleteAddress(address, false);
  };

  renderNameFields = (fullName, isSmall, disabled) => (
    <div>
      <Field inline columns={isSmall ? 12 : 3.5}>
        {getTextBox(fullName.firstName, t('FIRST_NAME'), {
          id: 'firstName',
          dataId: 'firstName',
          disabled,
          autoComplete: 'given-name',
        })}{' '}
      </Field>
      <Field inline columns={isSmall ? 12 : 3.5}>
        {getTextBox(fullName.middleName, t('MIDDLE_NAME'), { disabled, autoComplete: 'additional-name' })}
      </Field>
      <Field inline columns={isSmall ? 12 : 3.5}>
        {getTextBox(fullName.lastName, t('LAST_NAME'), {
          id: 'lastName',
          dataId: 'lastName',
          disabled,
          autoComplete: 'family-name',
        })}{' '}
      </Field>
      <Field inline columns={isSmall ? 12 : 1.5} last={!isSmall}>
        {getTextBox(fullName.suffix, t('SUFFIX'), {
          dataId: 'suffix',
          disabled,
          autoComplete: 'honorific-suffix',
        })}{' '}
      </Field>
    </div>
  );

  render() {
    const { model, isGuarantor, isReadOnly: disabled, isEmailDisabled, displayInviteGuarantor, invitesDisabled } = this.props;
    const {
      fields: {
        firstName,
        lastName,
        middleName,
        suffix,
        dateOfBirth,
        email,
        phone,
        socSecNumber,
        grossIncome,
        haveInternationalAddress,
        addressLine,
        addressLine1,
        addressLine2,
        city,
        state,
        zip,
        grossIncomeFrequency,
        otherApplicants,
        guarantors,
      },
      invitedToApply,
      labelSocSecNumber,
    } = model;

    return (
      <AutoSize breakpoints={{ small: [0, 560], medium: [561, Infinity] }}>
        {({ breakpoint }) => {
          const isSmall = breakpoint === 'small';
          const address = haveInternationalAddress.value ? (
            <Field>
              <AddressAutocomplete
                field={addressLine}
                label={t('ENTER_ADDRESS')}
                disabled={disabled}
                onSelectAddress={this.handleOnSelectInternationalAddress}
              />
            </Field>
          ) : (
            <div>
              <Field>
                <AddressAutocomplete
                  field={addressLine1}
                  label={t('ADDRESS_LINE_1')}
                  dataId="addressLine1"
                  disabled={disabled}
                  onSelectAddress={this.handleOnSelectAddress}
                  countryRestriction={localCountry}
                />
              </Field>
              <Field>{getTextBox(addressLine2, t('ADDRESS_LINE_2'), { disabled, dataId: 'addressLine2' })}</Field>
              <Field inline columns={isSmall ? 12 : 4}>
                {getTextBox(city, t('CITY'), { dataId: 'city', disabled })}
              </Field>
              <Field inline columns={isSmall ? 12 : 4}>
                <StateDropdown
                  label={t('STATE')}
                  id={'state'}
                  required
                  selectedValue={state.value}
                  autoCompleteProp="address-level1"
                  onChange={({ id }) => state.setValue(id)}
                  disabled={disabled}
                />
              </Field>
              <Field inline columns={isSmall ? 12 : 4} last={!isSmall}>
                {getTextBox(zip, t('ZIP'), {
                  dataId: 'zipCode',
                  mask: zipCode,
                  disabled,
                })}
              </Field>
            </div>
          );

          return (
            <Form>
              <div className={cf('block')}>
                {this.renderNameFields({ firstName, lastName, middleName, suffix }, isSmall, disabled)}
                <Field noMargin columns={isSmall ? 12 : 7}>
                  <FormattedMarkdown className={cf('warning')}>{t('APPLICATION_CREATED_FOR_USER', { userName: model.originalFullName })}</FormattedMarkdown>
                </Field>
                <Field sensitiveData columns={isSmall ? 12 : 7}>
                  {getTextBox(dateOfBirth, t('DATE_OF_BIRTH'), {
                    dataId: 'dateOfBirth',
                    mask: dateMask,
                    placeholder: 'MM/DD/YYYY',
                    disabled,
                    autoComplete: 'bday',
                    forceSentenceCaseOnError: false,
                  })}
                </Field>
                <Field columns={isSmall ? 12 : 7}>
                  {/* the email type automatically does autotrim for the values, but the white spaces are not removed from the UI */}
                  {getTextBox(email, t('EMAIL'), {
                    id: 'email',
                    dataId: 'email',
                    type: 'text',
                    forceLowerCase: true,
                    disabled: disabled || isEmailDisabled,
                  })}
                </Field>
                <Field columns={isSmall ? 12 : 7}>
                  <PhoneTextBox
                    label={t('PHONE')}
                    wide
                    showClear
                    value={phone.value}
                    dataId={'phone'}
                    autoComplete="tel-national"
                    errorMessage={phone.errorMessage}
                    onChange={({ value }) => phone.setValue(value)}
                    onBlur={() => phone.markBlurredAndValidate()}
                  />
                </Field>
                <Field sensitiveData columns={isSmall ? 12 : 7}>
                  {getTextBox(socSecNumber, t(labelSocSecNumber), {
                    dataId: 'socSecNumber',
                    disabled,
                    mask: ssn,
                    forceSentenceCaseOnError: false,
                  })}
                </Field>
                <div>
                  <Field inline columns={isSmall ? 8 : 7}>
                    {getMoneyTextBox(grossIncome, t('GROSS_INCOME'), {
                      dataId: 'grossIncome',
                      disabled,
                    })}
                  </Field>
                  <Field inline columns={isSmall ? 4 : 3} last={isSmall} wrapperClassName={cf('year-field')}>
                    <Dropdown
                      id="incomeFrequencyDropdown"
                      items={this.timesFrames}
                      selectedValue={grossIncomeFrequency.value}
                      errorMessage={grossIncomeFrequency.errorMessage}
                      onChange={({ id: timeFrameId }) => grossIncomeFrequency.setValue(timeFrameId)}
                      wide
                      disabled={disabled}
                    />
                  </Field>
                </div>
              </div>
              <div className={cf('block')} style={{ paddingTop: isSmall ? '0.5rem' : '1rem' }}>
                <div>
                  <Field noMargin columns={isSmall ? 12 : 4} inline={!isSmall}>
                    <T.SubHeader bold disabled={disabled}>
                      {t('CURRENT_ADDRESS')}
                    </T.SubHeader>
                  </Field>
                  <Field vAlign={isSmall ? 'top' : 'center'} noMargin columns={isSmall ? 12 : 8} inline={!isSmall} last>
                    <CheckBox
                      leftAligned={isSmall}
                      label={t('APPLICANT_HAVE_INTERNATIONAL_ADDRESS')}
                      checked={haveInternationalAddress.value}
                      onChange={value => haveInternationalAddress.setValue(value)}
                      disabled={disabled}
                    />
                  </Field>
                </div>
                <div>
                  <T.Text>{t('IS_INTERNATIONAL_ADDRESS_DESCRIPTION')}</T.Text>
                </div>
                {address}
              </div>
              <div className={cf({ block: !disabled || invitedToApply })}>
                {invitedToApply && (
                  <Field>
                    <T.Caption className={cf('field-title')} secondary disabled={disabled}>
                      {t('APPLICANT_ALREADY_INVITED')}
                    </T.Caption>
                    <T.Text disabled={disabled}>{invitedToApply}</T.Text>
                  </Field>
                )}
                {!isGuarantor && !disabled && (
                  <div>
                    <Field>
                      {getChipTextBox(otherApplicants, t('APPLICANT_OTHER_APPLICANTS_LIVE_YOU'), {
                        placeholder: t('APPLICANT_INVITE_APPLICANTS_HELPER'),
                        forceLowerCase: true,
                        validator: this.validateEmail,
                        disabled: invitesDisabled,
                      })}
                    </Field>
                    {displayInviteGuarantor && (
                      <Field>
                        {getChipTextBox(guarantors, t('APPLICANT_OTHER_APPLICANTS_FINANCIALLY_RESPONSIBLE'), {
                          placeholder: t('APPLICANT_INVITE_GUARANTOR_HELPER'),
                          forceLowerCase: true,
                          validator: this.validateEmail,
                          maxNumItems: MAX_NUM_GUARANTORS,
                          disabled: invitesDisabled,
                        })}
                      </Field>
                    )}
                  </div>
                )}
                {/* to help debugging what is causing the bug that prevent the cucumber test
                    to go to the next step, becuase the `continue` button is disabled. */}
                {process.env.CUCUMBER_CI_JOB && <FormSummary messages={model.summary} />}
              </div>
            </Form>
          );
        }}
      </AutoSize>
    );
  }
}
