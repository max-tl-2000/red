/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { shallow, mount } from 'enzyme';
import { Provider } from 'mobx-react';
import { ApprovalProcessSummaryPage } from '../approval-process-summary-page';
import { SummaryWarningTypes } from '../../../../common/enums/warning-types';

const approvalProcessSummary = {
  screeningSummary: {},
  completedApplications: [],
  notStartedApplications: [],
  incompleteRecommendation: {},
  loadingData: false,
  initializeComponents: jest.fn(() => {}),
  fetchScreeningSummary: jest.fn(() => {}),
};
const baseProps = {
  approvalProcessSummary,
  params: { partyId: '1' },
  location: { query: {} },
};

describe('ApprovalProcessSummaryPage', () => {
  it('should mount the component without throwing', () => {
    const component = () => shallow(<ApprovalProcessSummaryPage {...baseProps} />);
    expect(component).not.toThrow();
  });

  describe('when calling getIncompleteRecommendationMessage function', () => {
    describe('and there are members with incomplete applications at the beginning', () => {
      describe('and then the members completed the application', () => {
        it('should recalculate the members with incomplete application and return undefined', () => {
          const updatedApprovalProcessSummaryModel = {
            ...approvalProcessSummary,
            residents: [
              {
                personId: 1,
                fullName: 'TestResident',
              },
            ],
            guarantors: [
              {
                personId: 2,
                fullName: 'TestGurantor',
              },
            ],
            completedApplications: [
              {
                personId: 1,
                fullName: 'TestResident',
              },
              {
                personId: 2,
                fullName: 'TestGurantor',
              },
            ],
          };

          const component = shallow(<ApprovalProcessSummaryPage {...baseProps} approvalProcessSummary={updatedApprovalProcessSummaryModel} />).dive();

          const incompleteRecommendation = {
            membersWithIncompleteApplications: [
              {
                personId: 1,
                fullName: 'TestResident',
              },
            ],
            isCompleteApplicationData: false,
          };

          const incompleteRecommendationMessages = component.instance().getIncompleteRecommendationMessage(incompleteRecommendation);

          expect(incompleteRecommendationMessages).toEqual(undefined);
        });
      });
    });
  });

  describe('When the quote to review has the unit on hold', () => {
    it('should display the Unit Reserved Warning', () => {
      const updatedApprovalProcessSummaryModel = {
        ...approvalProcessSummary,
        screeningSummary: {
          warnings: [
            {
              message: 'UNIT_RESERVED_WARNING',
              agent: 'TestResident',
              partyId: '1',
              componentType: SummaryWarningTypes.UNIT_RESERVED,
            },
          ],
        },
      };

      const component = mount(
        <Provider auth={{}} agent={{ fetchPartyAgent: jest.fn(() => {}) }}>
          <ApprovalProcessSummaryPage {...baseProps} approvalProcessSummary={updatedApprovalProcessSummaryModel} />
        </Provider>,
      );

      const warningsContainer = component.render().children().children().first();

      expect(warningsContainer.find('.unit-reserved-warning').length).toBe(1);
    });
  });
});
