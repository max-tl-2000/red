/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expectTextIsEqual, expectTextContains, sanitizedTextIsEqual, clickOnElement, getSelectorWithIndex, doElementsExist } from '../helpers/helpers';
import BasePage from './basePage';

export default class ActivityLogPage extends BasePage {
  constructor(t) {
    super(t);

    this.selectors = {
      ...this.selectors,
      agentNameValueRow: '[data-id="activityAgentNameRow_User_Index"]',
      actionValueRow: '[data-id="activityActionRow_ActionType_Index"]',
      componentValueRow: '[data-id="activityComponentRow_ComponentType_Index"]',
      detailedValueRow: '[data-id="activityDetailedRow_Index"]',
      closeActivityLogBtn: '#activityLogDialog_closeBtn',
    };
  }

  getActivitySelectorWithAttribute(selector, attribute, attributeValue) {
    return this.selectors[selector].replace(attribute, attributeValue);
  }

  async checkActivityLogData({ index = 0, userInfo, action, component, details, cleanText }) {
    let i = index;

    const agentSelector = this.getActivitySelectorWithAttribute('agentNameValueRow', 'User', userInfo.fullName);
    const actionSelector = this.getActivitySelectorWithAttribute('actionValueRow', 'ActionType', action);
    const componentSelector = this.getActivitySelectorWithAttribute('componentValueRow', 'ComponentType', component);

    let agentSelectorTpl = getSelectorWithIndex(agentSelector, i);
    let actionSelectorTpl = getSelectorWithIndex(actionSelector, i);
    let componentSelectorTpl = getSelectorWithIndex(componentSelector, i);

    while (!(await doElementsExist([agentSelectorTpl, actionSelectorTpl, componentSelectorTpl]))) {
      i += 1;

      agentSelectorTpl = getSelectorWithIndex(agentSelector, i);
      actionSelectorTpl = getSelectorWithIndex(actionSelector, i);
      componentSelectorTpl = getSelectorWithIndex(componentSelector, i);
    }

    const { t } = this;

    await expectTextIsEqual(t, { selector: agentSelectorTpl, text: `${userInfo.fullName}` });
    await expectTextIsEqual(t, { selector: actionSelectorTpl, text: `${action}` });
    await expectTextIsEqual(t, { selector: componentSelectorTpl, text: `${component}` });

    const detailsSelectorTpl = getSelectorWithIndex(this.selectors.detailedValueRow, i);

    if (cleanText) {
      await sanitizedTextIsEqual(t, { selector: detailsSelectorTpl, text: details });
      return;
    }
    await expectTextContains(t, { selector: detailsSelectorTpl, text: details });
  }

  async closeActivityLog() {
    await clickOnElement(this.t, { selector: this.selectors.closeActivityLogBtn });
  }
}
