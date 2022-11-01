/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Field, Typography as T, SizeAware } from 'components';
import { t } from 'i18next';
import { formatPhone } from 'helpers/phone-utils';
import nullish from 'helpers/nullish';
import { observable, computed, action } from 'mobx';
import { observer } from 'mobx-react';

const Info = ({ label, values = [], formatter, dataId }) => (
  <div style={{ marginBottom: '1rem' }}>
    <T.Caption secondary style={{ marginBottom: '.25rem' }}>
      {label}
    </T.Caption>
    {values &&
      values.length > 0 &&
      values.map((val, i) => {
        let theVal;
        if (nullish(val)) {
          theVal = '';
        } else {
          theVal = typeof val === 'string' ? val : val.value;
        }

        if (formatter) {
          theVal = formatter(theVal);
        }
        // eslint-disable-next-line
        return <T.SubHeader key={ `value_${i}` } data-id={`${dataId}_${i}`}>{ theVal }</T.SubHeader>
      })}
  </div>
);

@observer
export default class PersonDetails extends Component {
  @observable
  breakpoint;

  @action
  updateBreakpoint = ({ breakpoint }) => {
    this.breakpoint = breakpoint;
  };

  @computed
  get colNum() {
    const { breakpoint } = this;
    if (breakpoint === 'small') return 12;
    return 4;
  }

  renderAssociatedCompanies = allCompanies => (
    <div data-id="associatedCompaniesSection" style={{ marginBottom: '1rem' }}>
      <T.Caption secondary style={{ marginBottom: '.25rem' }}>
        {t('COMPANY_NAME_TEXTBOX_LABEL')}
      </T.Caption>
      {allCompanies?.length > 0 &&
        allCompanies.map(val => {
          let openPartiesText;

          switch (val.openParties) {
            case 0: {
              openPartiesText = t('NO_OPEN_PARTIES');
              break;
            }
            case 1: {
              openPartiesText = t('ONE_OPEN_PARTY');
              break;
            }
            default: {
              openPartiesText = t('X_OPEN_PARTIES', { count: val.openParties });
              break;
            }
          }

          const companyName = val.companyName || t('NO_COMPANY_NAME_SET');

          return (
            <div>
              <T.SubHeader inline>{companyName}</T.SubHeader>
              <T.Caption secondary inline>
                {` - ${openPartiesText}`}
              </T.Caption>
            </div>
          );
        })}
    </div>
  );

  render() {
    const { colNum } = this;
    const { person = {} } = this.props;
    const { allCompanies, belongsToCorporate = false, fullName, preferredName, emails, phones } = person;
    const hasEmailInformation = emails && !!emails.length;

    return (
      <SizeAware id="contactInformationSection" onBreakpointChange={this.updateBreakpoint} style={{ paddingTop: '1rem' }}>
        <Field inline columns={colNum}>
          <Info label={t('FULL_NAME_LABEL')} values={[fullName || '']} dataId="fullName" />
          <Info label={t('ADD_GUEST_FORM_NICKNAME')} values={[preferredName || '']} dataId="preferredName" />
        </Field>
        {(hasEmailInformation || belongsToCorporate) && (
          <Field inline columns={colNum}>
            {hasEmailInformation && <Info values={emails} label={t('EMAILS_LABEL')} dataId="email" />}
            {belongsToCorporate && this.renderAssociatedCompanies(allCompanies)}
          </Field>
        )}
        {phones && phones.length > 0 && (
          <Field inline columns={colNum} last>
            <Info values={phones} formatter={formatPhone} label={t('PHONES_LABEL')} dataId="phone" />
          </Field>
        )}
      </SizeAware>
    );
  }
}
