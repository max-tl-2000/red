/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getIncomingCommunicationsStats, storeMessage, updateMessages } from '../communicationRepo';
import { createAParty, createAPerson } from '../../testUtils/repoHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toMoment } from '../../../common/helpers/moment-utils';

const ctx = { tenantId: tenant.id };
const { CommunicationMessageType, CommunicationDirection } = DALTypes;
const { EMAIL, SMS, CALL, WEB, CONTACTEVENT } = CommunicationMessageType;
const { IN, OUT } = CommunicationDirection;

describe('dal/communicationRepo - getIncomingCommunicationsStats()', () => {
  let party1;
  let party2;
  let party3;
  let person1;
  let person2;
  let person3;

  const rnd = array => array[Math.floor(Math.random() * (array.length - 1))];

  const initializeCommsData = async (parties, persons) => {
    const initialTime = 0;

    // the first eleven incoming comm events happen during the default two hour time frame
    await Promise.all(
      [
        { partyId: rnd(parties), personId: rnd(persons), commType: CALL, direction: IN, timeDelta: initialTime - 10 },
        { partyId: rnd(parties), personId: rnd(persons), commType: SMS, direction: IN, timeDelta: initialTime - 20 },
        { partyId: rnd(parties), personId: rnd(persons), commType: SMS, direction: IN, timeDelta: initialTime - 30 },
        { partyId: rnd(parties), personId: rnd(persons), commType: CALL, direction: IN, timeDelta: initialTime - 40 },
        { partyId: rnd(parties), personId: rnd(persons), commType: CALL, direction: IN, timeDelta: initialTime - 50 },
        { partyId: rnd(parties), personId: rnd(persons), commType: EMAIL, direction: IN, timeDelta: initialTime - 60 },
        { partyId: rnd(parties), personId: rnd(persons), commType: EMAIL, direction: IN, timeDelta: initialTime - 70 },
        { partyId: rnd(parties), personId: rnd(persons), commType: EMAIL, direction: IN, timeDelta: initialTime - 80 },
        { partyId: rnd(parties), personId: rnd(persons), commType: WEB, direction: IN, timeDelta: initialTime - 90 },
        { partyId: rnd(parties), personId: rnd(persons), commType: CONTACTEVENT, direction: IN, timeDelta: initialTime - 100 },
        { partyId: rnd(parties), personId: rnd(persons), commType: EMAIL, direction: IN, timeDelta: initialTime - 110 },
        { partyId: rnd(parties), personId: rnd(persons), commType: SMS, direction: IN, timeDelta: initialTime - 120 },
        { partyId: rnd(parties), personId: rnd(persons), commType: CALL, direction: IN, timeDelta: initialTime - 130 },
        { partyId: rnd(parties), personId: rnd(persons), commType: WEB, direction: IN, timeDelta: initialTime - 140 },
        { partyId: rnd(parties), personId: rnd(persons), commType: CONTACTEVENT, direction: IN, timeDelta: initialTime - 150 },
        { partyId: rnd(parties), personId: rnd(persons), commType: CALL, direction: OUT, timeDelta: initialTime },
        { partyId: rnd(parties), personId: rnd(persons), commType: SMS, direction: OUT, timeDelta: initialTime },
        { partyId: rnd(parties), personId: rnd(persons), commType: SMS, direction: OUT, timeDelta: initialTime - 10 },
        { partyId: rnd(parties), personId: rnd(persons), commType: CALL, direction: OUT, timeDelta: initialTime - 20 },
        { partyId: rnd(parties), personId: rnd(persons), commType: CALL, direction: OUT, timeDelta: initialTime - 30 },
      ].map(async ({ partyId, personId, commType, direction, timeDelta, timeFrame = 'minutes' }) => {
        const comm = {
          parties: [partyId],
          persons: [personId],
          type: commType,
          direction,
          message: {},
          category: '',
        };

        const msg = await storeMessage(ctx, comm);
        const createdAt = toMoment(new Date()).add(timeDelta, timeFrame);
        return await updateMessages(ctx, { id: msg.id }, { created_at: createdAt.toJSON() });
      }),
    );
  };

  beforeEach(async () => {
    [party1, party2, party3] = await Promise.all([createAParty(), createAParty(), createAParty()]);
    [person1, person2, person3] = await Promise.all([createAPerson(), createAPerson(), createAPerson()]);
    await initializeCommsData(
      [party1, party2, party3].map(pa => pa.id),
      [person1, person2, person3].map(p => p.id),
    );
  });

  describe('given a request to get incoming communication statistics', () => {
    it('should return the total communications for the default communication types', async () => {
      const commStats = await getIncomingCommunicationsStats(ctx);
      const expectedCommStats = { emailTotal: 4, smsTotal: 2, callTotal: 3, webTotal: 1, contactEventTotal: 1, directMessageTotal: 0 };
      expect(commStats).to.deep.equal(expectedCommStats);
    });

    it('should return the total communications for a custom time frame', async () => {
      const commStats = await getIncomingCommunicationsStats(ctx, [EMAIL, SMS, CALL, WEB, CONTACTEVENT], '10 minutes');
      const expectedCommStats = { emailTotal: 0, smsTotal: 0, callTotal: 0, webTotal: 0, contactEventTotal: 0 };
      expect(commStats).to.deep.equal(expectedCommStats);
    });

    it('should return the total communications for a custom list of communication types', async () => {
      const commStats = await getIncomingCommunicationsStats(ctx, [CALL, SMS]);
      const expectedCommStats = { smsTotal: 2, callTotal: 3 };
      expect(commStats).to.deep.equal(expectedCommStats);
    });
  });
});
