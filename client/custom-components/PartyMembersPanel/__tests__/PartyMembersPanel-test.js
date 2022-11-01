/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { mount } from 'enzyme';
import getUUID from 'uuid/v4';
import Immutable from 'immutable';
import { DALTypes } from '../../../../common/enums/DALTypes';
import PartyMembersPanel from '../PartyMembersPanel';

const baseProps = {
  partyId: getUUID(),
  memberType: DALTypes.MemberType.RESIDENT,
  partyMembers: new Immutable.Map(),
  panelMembers: [],
  allowLinkMembers: false,
  addGuest: async () => {},
  updatePerson: () => {},
  onNavigateToPersonPage: () => {},
};

describe('PartyMembersPanel', () => {
  it('should render the component without throwing', () => {
    const renderComponent = () => mount(<PartyMembersPanel {...baseProps} />);
    expect(renderComponent).not.toThrow();
  });

  it('should demote a quote when a new party member is added while application has Pending Approval state', async () => {
    const props = {
      demoteApplication: jest.fn(),
      quotePromotions: [
        {
          partyId: baseProps.partyId,
          promotionStatus: DALTypes.PromotionStatus.PENDING_APPROVAL,
        },
      ],
    };

    const renderedComponent = mount(<PartyMembersPanel {...baseProps} {...props} />);
    const guest = { personId: getUUID() };
    await renderedComponent.instance().handleAddGuest(guest, []);

    expect(props.demoteApplication).toHaveBeenCalled();
  });
});
