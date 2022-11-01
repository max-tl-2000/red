/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { t as trans } from 'i18next';
import { clickOnElement, expectVisible } from '../helpers/helpers';
import BasePage from './basePage';
export default class DashboardPage extends BasePage {
  constructor(t) {
    super(t);

    this.selectors = {
      ...this.selectors,
      dashboardViewClass: '.dashboard-view',
      createPartyBtn: '#btnCreateParty',
      switchToTodayToggle: '#switchTodayOnly',
      dropDownAgentsList: '[data-id="employee-avatar"]',
      teamItemDropDown: '#employeeSearchForm [data-c="scrollable"] [data-id="employeeSearchFormList"] div',
      chevronRightIcon: '#chevronRightIcon',
      chevronLeftIcon: '#chevronLeftIcon',
      leasesColumn: '#leases',
      applicantCardTask0CheckBox: '#cardTask0_checkbox',
      applicantCardTask0Name: '[data-id="cardTask0_name"]',
      menuBtn: '#menu',
      futureResidentsColumn: '#residents',
      applicantsCol: '#applicants',
      card: '[data-id="card"]',
      appointmentRow: '[data-id="appointmentRow"]',
      commonPersonCard: '[data-component="common-person-card"]',
      prospectsColumn: '#prospects',
      renewIcon: '#renewIcon',
      renewalDetailsTxt: '[data-id="renewalDetailsTxt"]',
      magnifyButton: '[data-component="icon-button"] #magnify',
    };
  }

  clickOnDropDownAgentsList = async () => await clickOnElement(this.t, { selector: this.selectors.dropDownAgentsList });

  clickOnLeasingTeamItem = async leasingTeamId => {
    const selectorId = `#employeeSearchForm [data-c="scrollable"] [data-id="employeeSearchFormList"] [data-id="${leasingTeamId}"]`;
    await clickOnElement(this.t, { selector: selectorId });
  };

  clickOnChevronIcon = async (count, selectorId) => {
    for (let index = 0; index < count; index++) {
      await clickOnElement(this.t, { selector: selectorId });
    }
  };

  logOut = async () => {
    await clickOnElement(this.t, { selector: this.selectors.menuBtn });
    await clickOnElement(this.t, { selector: $(this.selectors.listItem).withText(trans('LOGOUT_LINK')) });
  };

  searchAndOpenPartyByResidentName = async residentName => {
    await clickOnElement(this.t, { selector: this.selectors.magnifyButton });
    await clickOnElement(this.t, { selector: '[placeholder="Search"]' });

    await this.t.typeText('[placeholder="Search"]', residentName);
    await this.t.pressKey('enter');
    await expectVisible(this.t, { selector: '[data-component="card"] [data-component="caption"]', text: residentName });
    await clickOnElement(this.t, { selector: '[data-component="card"] [data-component="caption"]', text: residentName });
  };
}
