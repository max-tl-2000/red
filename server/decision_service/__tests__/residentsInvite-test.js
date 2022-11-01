/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import path from 'path';
import { expect } from 'chai';
import { DALTypes } from '../../../common/enums/DALTypes';
import { processResidentsInviteEmail } from '../emails/residentsInviteHandler';
import { readJSON } from '../../../common/helpers/xfs';

describe('emailHandler/processResidentsInviteEmail', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = { tenantId: newId() };

  const filename = 'party-with-signed-lease.json';
  const file = path.join(__dirname, 'data/residentsInvite', filename);

  describe('calling processResidentsInviteEmail', () => {
    beforeEach(async () => {
      party = await readJSON(file);
    });

    describe('when LEASE_SIGNED or PARTY_CREATED events are not triggered', () => {
      it('should return empty object', async () => {
        party.events = [{}];
        const emailInfo = await processResidentsInviteEmail(ctx, party);
        expect(emailInfo).to.deep.equal({});
      });
    });

    describe('when the LEASE_SIGNED event is triggered', () => {
      describe('and the property autoInvite is not enabled', () => {
        it('should return empty object', async () => {
          party.property[0].app.autoInvite = false;
          const emailInfo = await processResidentsInviteEmail(ctx, party);
          expect(emailInfo).to.deep.equal({});
        });
      });

      describe('and the lease is not signed by all members', () => {
        it('should return empty object', async () => {
          party.leases[0].signatures[2].status = DALTypes.LeaseSignatureStatus.NOT_SENT;
          const emailInfo = await processResidentsInviteEmail(ctx, party);
          expect(emailInfo).to.deep.equal({});
        });
      });

      describe('and the party is not traditional', () => {
        it('should return empty object', async () => {
          party.leaseType = DALTypes.PartyTypes.CORPORATE;
          const emailInfo = await processResidentsInviteEmail(ctx, party);
          expect(emailInfo).to.deep.equal({});
        });
      });
    });

    describe('when the PARTY_CREATED event is triggered', () => {
      describe('and the property autoInvite is not enabled', () => {
        it('should return empty object', async () => {
          party.events[0].event = DALTypes.PartyEventType.PARTY_CREATED;
          party.events[0].metadata = { sendResidentsInvite: true };
          party.property[0].app.autoInvite = false;
          const emailInfo = await processResidentsInviteEmail(ctx, party);
          expect(emailInfo).to.deep.equal({});
        });
      });

      describe('and the events were not triggered at import or corporate active lease party creation', () => {
        it('should return empty object', async () => {
          party.events[0].event = DALTypes.PartyEventType.PARTY_CREATED;
          party.events[0].metadata = { sendResidentsInvite: false };
          party.leases[0].signatures[2].status = DALTypes.LeaseSignatureStatus.NOT_SENT;
          const emailInfo = await processResidentsInviteEmail(ctx, party);
          expect(emailInfo).to.deep.equal({});
        });
      });
    });
  });
});
