/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { clickOnElement, doesElementExists } from '../helpers/helpers';

export default class SuperAdminPage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      tenantRow: '[class="view-content"] [data-component="row"]',
      tenantModes: '[data-component="row"] [data-component="cell"]',
      tenantModeDropdowns: '[data-component="row"] [data-id^=overlay-Dropdown]',
      tenantModeDropdownItem: '[data-dropdown-item="true"] [data-component="main-section"] > div',
    };
  }

  async setBackendMode(newBackendMode) {
    await clickOnElement(this.t, { selector: this.selectors.tenantRow, requireVisibility: true });
    if (!(await doesElementExists($(this.selectors.tenantModes).withExactText(newBackendMode)))) {
      if (newBackendMode === 'MRI') {
        await clickOnElement(this.t, { selector: $(this.selectors.tenantModes).withExactText('None') });
        await clickOnElement(this.t, { selector: $(this.selectors.tenantModeDropdownItem).withExactText(newBackendMode), requireVisibility: true });
      } else {
        await clickOnElement(this.t, { selector: $(this.selectors.tenantModes).withExactText('MRI') });
        await clickOnElement(this.t, { selector: $(this.selectors.tenantModeDropdownItem).withExactText(newBackendMode), requireVisibility: true });
      }
    }
  }
}
