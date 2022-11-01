/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { updatePersonContactInformation } from '../helpers/leasingApplicationHelpers';
import { expectVisible, expectTextIsEqual, expectNotVisible, addUniqueIdToEmail, clickOnElement } from '../helpers/helpers';
import loggerInstance from '../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'personDetailsPage' });

export default class PersonDetailsPage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      editPersonDetailsBtn: '#editPersonDetailsBtn',
      contactInformationSection: '#contactInformationSection',
    };
  }

  async clickOnEditPersonDetails() {
    const { t } = this;
    await expectVisible(t, { selector: `${this.selectors.editPersonDetailsBtn} [data-red-icon][name="pencil"]` });
    await clickOnElement(t, { selector: $(this.selectors.editPersonDetailsBtn) });
  }

  async updatePersonDetails(personDetails) {
    const { t } = this;
    await updatePersonContactInformation(t, personDetails, true);
  }

  async verifyPersonDetails(personDetails) {
    const { t } = this;
    logger.debug('>>> verifying person details', personDetails);
    const buildContextSelector = (dataId, index = 0) => `${this.selectors.contactInformationSection} [data-id="${dataId}_${index}"]`;
    const verifyCommunicationInfo = async (values, dataId) => {
      for (let i = 0; i < values.length; i++) {
        await expectTextIsEqual(t, { selector: buildContextSelector(dataId, i), text: values[i] });
      }
    };

    await expectTextIsEqual(t, { selector: buildContextSelector('fullName'), text: personDetails.legalName });
    if (personDetails.preferredName) {
      await expectTextIsEqual(t, { selector: buildContextSelector('preferredName'), text: personDetails.preferredName });
    } else {
      await expectNotVisible(t, { selector: buildContextSelector('preferredName') });
    }
    await verifyCommunicationInfo(
      personDetails.emails.map(it => addUniqueIdToEmail(t, it)),
      'email',
    );
    await verifyCommunicationInfo(personDetails.phones, 'phone');
  }
}
