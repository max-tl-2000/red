/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Form, Field, PhoneTextBox, Dropdown } from 'components';
import ModelTextBox, { ModelMoneyTextBox } from 'components/Form/ModelTextBox';
import { t } from 'i18next';
import { enumToList } from 'enums/enumHelper';
import { monthAndYear } from 'components/TextBox/masks';
import { RentappTypes } from '../../../common/enums/rentapp-types';
import { cf } from './income-source-form.scss';
import { AddressDetails } from '../address-details/address-details';
import AutoSize from '../../../../client/components/AutoSize/AutoSize';
import { breakpointsLimits } from '../../../../client/helpers/layout';

@observer
export default class IncomeSourceForm extends Component {
  static propTypes = {
    item: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.IncomeSourceTypes = enumToList(RentappTypes.IncomeSourceType);
    this.timesFrames = enumToList(RentappTypes.TimeFrames);
  }

  renderAnotherSourceSection = (fields, expanded, breakpoint) => (
    <Field columns={expanded || breakpoint === 'small' ? 12 : 6}>
      <ModelTextBox field={fields.sourceDescription} label={t('SOURCE_DESCRIPTION')} />
    </Field>
  );

  renderIamEmployedSection = (model, fields, labels) => (
    <AutoSize breakpoints={breakpointsLimits}>
      {({ breakpoint }) => (
        <div>
          <Field columns={breakpoint === 'medium' ? 6 : 12}>
            <ModelTextBox field={fields.employerName} label={t('EMPLOYER_NAME')} />
          </Field>

          <Field columns={12} noMargin>
            <AddressDetails model={model} labels={labels} />
          </Field>

          <Field columns={breakpoint === 'medium' ? 6 : 12} inline>
            <ModelTextBox field={fields.jobTitle} label={t('JOB_TITLE')} />
          </Field>

          <Field columns={breakpoint === 'medium' ? 6 : 12} inline last>
            <ModelTextBox forceSentenceCaseOnError={false} field={fields.startDate} label={t('START_DATE')} mask={monthAndYear} placeholder="MM/YYYY" />
          </Field>

          <Field columns={breakpoint === 'medium' ? 6 : 12} inline>
            <ModelTextBox field={fields.managerName} label={t('MANAGER_NAME')} />
          </Field>
          <Field columns={breakpoint === 'medium' ? 6 : 12} inline last>
            <PhoneTextBox
              label={t('MANAGER_PHONE')}
              value={fields.managerPhone.value}
              showClear
              errorMessage={fields.managerPhone.errorMessage}
              onChange={({ value }) => fields.managerPhone.setValue(value)}
              wide
            />
          </Field>
        </div>
      )}
    </AutoSize>
  );

  renderGrossIncomeSection = (fields, breakpoint) => (
    <div>
      <Field columns={breakpoint === 'medium' ? 6 : 12} inline>
        <ModelMoneyTextBox field={fields.grossIncome} label={t('GROSS_INCOME')} />
      </Field>

      <Field columns={breakpoint === 'medium' ? 6 : 12} inline last>
        <Dropdown
          items={this.timesFrames}
          wide
          placeholder={`${t('INCOME_FREQUENCY')} *`}
          className={cf('no-label-fix')}
          selectedValue={fields.grossIncomeFrequency.value}
          errorMessage={fields.grossIncomeFrequency.errorMessage}
          onChange={({ id }) => fields.grossIncomeFrequency.setValue(id)}
        />
      </Field>
    </div>
  );

  render() {
    const { model, mode } = this.props;
    const { fields } = model;
    const isEdit = mode === 'edit';
    const isOtherSource = fields.incomeSourceType.value === RentappTypes.IncomeSourceType.OTHER_SOURCE;
    const isEmployment = fields.incomeSourceType.value === RentappTypes.IncomeSourceType.EMPLOYMENT;

    const labels = {
      entityAddress: 'EMPLOYER_ADDRESS',
      checkInternationalAddress: 'IS_INTERNATIONAL_ADDRESS',
      address: 'ENTER_ADDRESS',
      addressLine1: 'ADDRESS_LINE_1',
      addressLine2: 'ADDRESS_LINE_2',
      city: 'CITY',
      state: 'STATE',
      zip: 'ZIP',
    };

    const expanded = isEdit && !isEmployment;
    return (
      <Form container className={cf('income-source-form')}>
        <AutoSize breakpoints={breakpointsLimits}>
          {({ breakpoint }) => (
            <div>
              <Field columns={breakpoint === 'medium' ? 9 : 12}>
                <Dropdown
                  items={this.IncomeSourceTypes}
                  label={t('INCOME_SOURCE')}
                  wide
                  selectedValue={fields.incomeSourceType.value}
                  errorMessage={fields.incomeSourceType.errorMessage}
                  onChange={({ id }) => fields.incomeSourceType.setValue(id)}
                />
              </Field>
              <Field columns={breakpoint === 'medium' ? 9 : 12} noMargin>
                {this.renderGrossIncomeSection(fields, breakpoint)}
              </Field>
              {isOtherSource && this.renderAnotherSourceSection(fields, expanded, breakpoint)}
              {isEmployment && this.renderIamEmployedSection(model, fields, labels)}
            </div>
          )}
        </AutoSize>
      </Form>
    );
  }
}
