/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, getPartyIdFromUrl, getAuthInfo, reloadURL } from '../../helpers/helpers';
import { createAParty, checkAppointmentTourTypesAvailable } from '../../helpers/rentalApplicationHelpers';
import { getMockedContactInfoByEmail, mockPartyData } from '../../helpers/mockDataHelpers';
import { createAppointment } from '../../helpers/appointmentHelper';
import { setHooks } from '../../helpers/hooks';

setHooks(
  fixture('Verify if the selected tourType which is not available in the party settings disappears after saving the appointment with an available tourType'),
  { fixtureName: 'checkNotAvailableTourType' },
);

test('CPM-17530: Create a party, create an appointment with a non available tourType and verify the available options in the dropdown', async t => {
  const userInfo = { user: 'kenny@reva.tech', password: getUserPassword(), fullName: 'Kenny Cruz', team: 'Cove Leasing' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[1].displayName;

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo, skipPropertySelection: true });

  const partyId = await getPartyIdFromUrl();
  const {
    user: { id: salesPersonId },
  } = await getAuthInfo();
  await createAppointment({ salesPersonId, partyId, tourType: 'importedTour', loadActivePartyMembers: true });

  await reloadURL();

  await checkAppointmentTourTypesAvailable(t, contactInfo, 0);
});
