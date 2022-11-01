/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { t as trans } from 'i18next';
import { now } from '../../common/helpers/moment-utils';
import { LA_TIMEZONE, YEAR_MONTH_DAY_FORMAT } from '../../common/date-constants';
import { expectVisible, expectNotVisible, clickOnElement } from '../helpers/helpers';

export default class PartyPhaseOne {
  constructor(t) {
    this.t = t;
    this.selectors = {
      sideNav: '#side-nav',
      slideOut: '#slide-out',
      floatingAgentSchedulingOption: '#slide-out [data-id="floating-agent-scheduling"]',
      dialogHeaderTitle: '#dialog-header [data-component="title"]',
      floatingAgentButton: '[data-id="floatig-agent-button"]',
      employeeOptionItem: '[data-id="employeeSearchFormList"] [data-id="agent_optionItem"]:nth-child(2)',
      floatingTable: '[data-id="floating-table"]',
      floatingTableHeaderRow: '[data-component="row-header"]',
      floatingTableHeaderCell: '[data-component="row-header"] [data-component="cell"]',
      floatingTableRow: '[data-id="r-date"]',
      floatigTableCell: '[data-id="c-team"]',
      blankRadioBox: '#radiobox-blank',
      markedRadioBox: '#radiobox-marked',
      button: '[data-component="button"]',
    };
  }

  async checkFloatingAgentPage(t) {
    await clickOnElement(t, { selector: this.selectors.sideNav });
    await expectVisible(t, { selector: this.selectors.slideOut });
    await clickOnElement(t, { selector: this.selectors.floatingAgentSchedulingOption });
    // Check Roating Agent Shecndule page is displayed
    await expectVisible(t, { selector: this.selectors.dialogHeaderTitle, text: 'Rotating Agent Schedules' });
    await expectVisible(t, { selector: this.selectors.floatingAgentButton, text: trans('SELECT_A_LEASING_AGENT') });
  }

  async checkFloatingAgentIsDisplayed(t, agentName, isLWA = false) {
    await clickOnElement(t, { selector: this.selectors.floatingAgentButton, text: trans('SELECT_A_LEASING_AGENT') });
    const agentListItem = this.selectors.employeeOptionItem.replace('agent', agentName.replace(/\s+/g, ''));
    isLWA ? await expectVisible(t, { selector: agentListItem }) : await expectNotVisible(t, { selector: agentListItem });
  }

  async ckeckRotatingAgentSchedulesPage(t, agentName, teams) {
    await expectVisible(t, { selector: this.selectors.floatingTable });
    await expectVisible(t, { selector: this.selectors.floatingAgentButton, text: agentName });

    await expectVisible(t, { selector: this.selectors.floatingTableHeaderRow });
    await expectVisible(t, { selector: this.selectors.floatingTableHeaderCell, text: teams[0] });
    await expectVisible(t, { selector: this.selectors.floatingTableHeaderCell, text: teams[1] });
    await expectVisible(t, { selector: this.selectors.floatingTableHeaderCell, text: trans('UNAVAILABLE_FOR_TOURS') });

    const days = [...Array(13).keys()];
    await mapSeries(days, async elem => {
      const floatingDay = now({ timezone: LA_TIMEZONE })
        .add(elem + 1, 'days')
        .format(YEAR_MONTH_DAY_FORMAT);
      const dayRowSelector = this.selectors.floatingTableRow.replace('date', floatingDay);
      await expectVisible(t, { selector: dayRowSelector, boundTestRun: t });
      const team1BlankRadioButton = `${dayRowSelector} ${this.selectors.floatigTableCell} ${this.selectors.blankRadioBox}`.replace('team', teams[0]);
      await expectVisible(t, { selector: team1BlankRadioButton, boundTestRun: t });
      const team2BlankRadioButton = `${dayRowSelector} ${this.selectors.floatigTableCell} ${this.selectors.blankRadioBox}`.replace('team', teams[1]);
      await expectVisible(t, { selector: team2BlankRadioButton, boundTestRun: t });
      const unavailableMarkedRadioButton = `${dayRowSelector} ${this.selectors.floatigTableCell} ${this.selectors.markedRadioBox}`.replace(
        'team',
        'unavailable',
      );
      await expectVisible(t, { selector: unavailableMarkedRadioButton, boundTestRun: t });
    });
    await expectVisible(t, { selector: this.selectors.button, text: 'SHOW MORE', boundTestRun: t });
  }

  async setUpFloatingAgent(t, mockData) {
    const agentListItem = this.selectors.employeeOptionItem.replace('agent', mockData.floatingAgentName.replace(/\s+/g, ''));
    await expectVisible(t, { selector: agentListItem });

    await clickOnElement(t, { selector: agentListItem });
    if (mockData.checkRoatingAgentPage) await this.ckeckRotatingAgentSchedulesPage(t, mockData.agentName, mockData.teams);

    await mapSeries(mockData.avabilitySetUp, async elem => {
      const dayRowSelector = this.selectors.floatingTableRow.replace('date', elem.availableDate);
      await expectVisible(t, { selector: dayRowSelector, boundTestRun: t });
      const dayTeamCell = `${dayRowSelector} ${this.selectors.floatigTableCell}`.replace('team', elem.team);
      await expectVisible(t, { selector: dayTeamCell, boundTestRun: t });
      await clickOnElement(t, { selector: dayTeamCell, boundTestRun: t });
      await expectVisible(t, { selector: `${dayTeamCell} ${this.selectors.markedRadioBox}`, boundTestRun: t });
    });
  }
}
