/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('leasing-navigator', () => {
  let navigatorMock;
  let leasingNavigator;
  let locationMock;
  let historyMock;
  let windowOpenMock;

  const partyId = 'PARTY_ID';
  const appointmentId = 'APPOINTMENT_ID';
  const leaseId = 'LEASE_ID';
  const personId = 'PERSON_ID';
  const threadId = 'THREAD_ID';
  const inventoryId = 'INVENTORY_ID';

  beforeEach(() => {
    jest.resetModules();

    locationMock = {
      origin: 'https://mycustomhost.com',
      protocol: 'https:',
      host: 'mycustomhost.com',
    };

    historyMock = {
      location: {
        pathname: '/custom/path/name',
      },
    };

    windowOpenMock = jest.fn();

    navigatorMock = {
      push: jest.fn(),
      replace: jest.fn(),
      syncedHistory: historyMock,
    };

    mockModules({
      '../win-open': {
        windowOpen: windowOpenMock,
      },
      '../navigator': navigatorMock,
      '../../../common/helpers/globals': {
        window: {
          location: locationMock,
        },
      },
    });

    leasingNavigator = require('../leasing-navigator').leasingNavigator;
  });

  describe('when location prop is called', () => {
    it('return the location property from the syncedHistory module', () => {
      expect(leasingNavigator.location).toEqual(historyMock.location);
    });
  });

  describe('navigateToParty', () => {
    describe('when no parameters provided', () => {
      it('should navigate to party route', () => {
        leasingNavigator.navigateToParty();

        expect(navigatorMock.push).toHaveBeenCalledWith('/party');
      });
    });

    it('should navigate to party route with a partyId if provided', () => {
      leasingNavigator.navigateToParty(partyId);

      expect(navigatorMock.push).toHaveBeenCalledWith(`/party/${partyId}`);
    });

    describe('when appointmentId is specified', () => {
      it('should navigate to party route and add an appointment path parameter ', () => {
        leasingNavigator.navigateToParty(partyId, { appointmentId });

        expect(navigatorMock.push).toHaveBeenCalledWith(`/party/${partyId}/appointment/${appointmentId}`);
      });
    });

    describe('when leaseId is specified', () => {
      describe('but no personId is provided', () => {
        it('should throw with `personId is required to sign lease`', () => {
          expect(() => leasingNavigator.navigateToParty(partyId, { leaseId })).toThrow('personId is required to sign a lease');
        });
      });

      it('should add lease and sign path parameters to the url', () => {
        leasingNavigator.navigateToParty(partyId, { leaseId, personId });

        expect(navigatorMock.push).toHaveBeenCalledWith(`/party/${partyId}/lease/${leaseId}/sign/${personId}`);
      });
    });

    describe('when threadId option is set', () => {
      it('should have the threadId query parameter added', () => {
        leasingNavigator.navigateToParty(partyId, { threadId });

        expect(navigatorMock.push).toHaveBeenCalledWith(`/party/${partyId}?threadId=${threadId}`);
      });
    });

    describe('when reviewApplication option is set', () => {
      it('should have the reviewApplication query parameter added', () => {
        leasingNavigator.navigateToParty(partyId, { reviewApplication: true });

        expect(navigatorMock.push).toHaveBeenCalledWith(`/party/${partyId}?reviewApplication=true`);
      });
    });

    describe('when openMergeParties option is set', () => {
      describe('but personId is not set', () => {
        it('should throw because of the missing `personId` parameter', () => {
          expect(() => leasingNavigator.navigateToParty(partyId, { openMergeParties: true })).toThrow('personId is required when openMergeParties is set');
        });
      });

      it('should have openMergeParties and personId query parameter added', () => {
        leasingNavigator.navigateToParty(partyId, { openMergeParties: true, personId });

        expect(navigatorMock.push).toHaveBeenCalledWith(`/party/${partyId}?openMergeParties=true&personId=${personId}`);
      });
    });

    describe('when openMatch option is set', () => {
      describe('but personId is not set', () => {
        it('should throw because the missing personId parameter', () => {
          expect(() => leasingNavigator.navigateToParty(partyId, { openMatch: true })).toThrow('personId is required when openMatch is set');
        });
      });

      it('should have the openMatch and personId query parameters added', () => {
        leasingNavigator.navigateToParty(partyId, { openMatch: true, personId });

        expect(navigatorMock.push).toHaveBeenCalledWith(`/party/${partyId}?openMatch=true&personId=${personId}`);
      });
    });

    describe('when `addOrigin` option is set', () => {
      it('should add the origin at the beginning of the url', () => {
        leasingNavigator.navigateToParty(partyId, { openMatch: true, personId, addOrigin: true });
        const { origin } = locationMock;

        expect(navigatorMock.push).toHaveBeenCalledWith(`${origin}/party/${partyId}?openMatch=true&personId=${personId}`);
      });

      describe('when no origin is available', () => {
        it('should use protocol and host', () => {
          locationMock.origin = null;

          leasingNavigator.navigateToParty(partyId, { openMatch: true, personId, addOrigin: true });

          const { protocol, host } = locationMock;

          expect(navigatorMock.push).toHaveBeenCalledWith(`${protocol}//${host}/party/${partyId}?openMatch=true&personId=${personId}`);
        });
      });
    });

    describe('when `useWindowOpen` option is set', () => {
      it('should use `windowOpen` to try to open the url', () => {
        leasingNavigator.navigateToParty(partyId, { openMatch: true, personId, addOrigin: true, useWindowOpen: true });
        const { origin } = locationMock;

        expect(windowOpenMock).toHaveBeenCalledWith(`${origin}/party/${partyId}?openMatch=true&personId=${personId}`, undefined);
      });
      describe('and `target` is specified', () => {
        it('should be open using the provided target', () => {
          leasingNavigator.navigateToParty(partyId, { openMatch: true, personId, addOrigin: true, useWindowOpen: true, target: 'newWindow' });
          const { origin } = locationMock;

          expect(windowOpenMock).toHaveBeenCalledWith(`${origin}/party/${partyId}?openMatch=true&personId=${personId}`, 'newWindow');
        });
      });
    });

    describe('when `newTab` option is set', () => {
      it('should use `windowOpen` to try to open the url and specify the target as `_blank`', () => {
        leasingNavigator.navigateToParty(partyId, { openMatch: true, personId, addOrigin: true, newTab: true });
        const { origin } = locationMock;

        expect(windowOpenMock).toHaveBeenCalledWith(`${origin}/party/${partyId}?openMatch=true&personId=${personId}`, '_blank');
      });
    });
  });

  describe('navigateToInventory', () => {
    describe('when no inventoryId is provided', () => {
      it('should throw "inventoryId is required"', () => {
        expect(() => leasingNavigator.navigateToInventory()).toThrow('inventoryId is required');
      });

      it('should navigate to inventory route', () => {
        leasingNavigator.navigateToInventory(inventoryId);
        expect(navigatorMock.push).toHaveBeenCalledWith(`/inventory/${inventoryId}`);
      });
    });
  });

  describe('navigateToSearch', () => {
    it('should navigate to search route', () => {
      leasingNavigator.navigateToSearch();
      expect(navigatorMock.push).toHaveBeenCalledWith('/search');
    });
  });

  describe('navigateToPerson', () => {
    describe('when no personId is provided', () => {
      it('should throw "personId is required"', () => {
        expect(() => leasingNavigator.navigateToPerson()).toThrow('personId is required');
      });
    });
    it('should navigate to the person route', () => {
      leasingNavigator.navigateToPerson(personId);
      expect(navigatorMock.push).toHaveBeenCalledWith(`/leads/${personId}`);
    });

    describe('when openMergePartyDialog is set', () => {
      describe('but no partyId is set', () => {
        it('should throw "paryId is required when openMergePartyDialog is set"', () => {
          expect(() => leasingNavigator.navigateToPerson(personId, { openMergePartyDialog: true })).toThrow(
            'partyId is required when openMergePartyDialog is set',
          );
        });
      });

      it('should have openMergePartyDialog and partyId as query parameters', () => {
        leasingNavigator.navigateToPerson(personId, { openMergePartyDialog: true, partyId });
        expect(navigatorMock.push).toHaveBeenCalledWith(`/leads/${personId}?openMergePartyDialog=true&partyId=${partyId}`);
      });
    });
  });

  describe('navigateToHome', () => {
    it('should navigate to `/`', () => {
      leasingNavigator.navigateToHome();
      expect(navigatorMock.push).toHaveBeenCalledWith('/');
    });
  });

  describe('navigateToDashboard', () => {
    it('should navigate to `/`', () => {
      leasingNavigator.navigateToDashboard();
      expect(navigatorMock.push).toHaveBeenCalledWith('/');
    });
  });

  describe('navigateToTenantAdmin', () => {
    it('should navigate to `/tenantAdmin`', () => {
      leasingNavigator.navigateToTenantAdmin();
      expect(navigatorMock.push).toHaveBeenCalledWith('/tenantAdmin');
    });
  });

  describe('navigateToRingCentralTokenRefreshPage', () => {
    it('should navigate to `/RingCentralTokenRefreshPage`', () => {
      leasingNavigator.navigateToRingCentralTokenRefreshPage();
      expect(navigatorMock.push).toHaveBeenCalledWith('/RingCentralTokenRefreshPage');
    });

    describe('when useReplace is set to true', () => {
      it('should navigate to `/RingCentralTokenRefreshPage` using replace', () => {
        leasingNavigator.navigateToRingCentralTokenRefreshPage(true /* useReplace */);
        expect(navigatorMock.replace).toHaveBeenCalledWith('/RingCentralTokenRefreshPage');
      });
    });
  });

  describe('navigateToNeedHelp', () => {
    it('should navigate to `/needHelp`', () => {
      leasingNavigator.navigateToNeedHelp();
      expect(navigatorMock.push).toHaveBeenCalledWith('/needHelp');
    });

    describe('when an email is set', () => {
      it('should navigate to `/needHelp` adding the email as path parameter', () => {
        const email = 'scooby@doo.com';
        leasingNavigator.navigateToNeedHelp({ email });
        expect(navigatorMock.push).toHaveBeenCalledWith(`/needHelp/${email}`);
      });
    });
  });

  describe('navigateToSignatureConfirmationWithToken', () => {
    it('should navigate to `/signatureConfirmation', () => {
      const token = 'TOKEN';
      leasingNavigator.navigateToSignatureConfirmationWithToken(token);
      expect(navigatorMock.push).toHaveBeenCalledWith(`/signatureConfirmation/${token}`);
    });
  });

  describe('navigate', () => {
    it('should navigate to the provided url', () => {
      leasingNavigator.navigate('/some/custom/url');
      expect(navigatorMock.push).toHaveBeenCalledWith('/some/custom/url');
    });
  });
});
