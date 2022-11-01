/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createGuestCardMapper } from '../mri/mappers/guestCard';
import { createResidentialInteractionsMapper } from '../mri/mappers/residentialInteractions';
import { DALTypes } from '../../../common/enums/DALTypes';
import { MAX_LENGTH_FIRST_NAME, MAX_LENGTH_LAST_NAME, FeeType, getConcessionEndDate } from '../mri/mappers/utils';
import { createApplicationDepositPaymentMapper } from '../mri/mappers/applicationDepositPayment';
import { createApplicationPaymentMapper } from '../mri/mappers/applicationPayment';
import { PetTypes, PetSizes } from '../../../common/enums/petTypes';
import { createPetInformationMapper } from '../mri/mappers/petInformation';
import { createVehicleInformationMapper } from '../mri/mappers/vehicleInformation';
import { createSelectUnitMapper } from '../mri/mappers/selectUnit';
import { createRentDetailsMapper } from '../mri/mappers/rentDetails';
import { createConfirmLeaseMapper } from '../mri/mappers/confirmLease';
import { LA_TIMEZONE } from '../../../common/date-constants';

const email = 'test@reva.tech';
const phone = '16502736663';
const propertyExternalId = '13780';
const companyName = 'Google';
const partyId = 'bd46a176-a66a-4547-936d-1d7439543855';
const partyMemberId = '1a0b53f6-6d99-4adf-9245-27c49141a7a3';
const nameId = 'HO00000001';

const base = {
  party: {
    id: partyId,
    leaseType: DALTypes.LeaseType.STANDARD,
  },
  primaryTenant: {
    id: partyMemberId,
  },
  partyMember: {
    id: partyMemberId,
    contactInfo: {
      defaultEmail: email,
    },
  },
  property: {
    externalId: propertyExternalId,
  },
  externalInfo: { id: '27548439-71d2-47fa-90fa-a1dc133bbd65', partyMemberId },
  externals: [
    {
      id: '27548439-71d2-47fa-90fa-a1dc133bbd65',
      partyMemberId,
    },
  ],
};

describe('export/MRI/mappers', () => {
  describe('guestCard', () => {
    describe('when a member is exported for the first time', () => {
      it('should set the PropertyId, Type, ApplicantStatus', () => {
        const [result] = createGuestCardMapper(base);

        expect(result.NameID).to.be.undefined;
        expect(result.PropertyId).to.equal(propertyExternalId);
        expect(result.Type).to.equal('P');
        expect(result.ApplicantStatus).to.equal('Active');
      });
    });

    describe('when a member with only an email is exported', () => {
      it('should set the email as the First and Last Name, and set the Email ', () => {
        const [result] = createGuestCardMapper(base);
        expect(result.FirstName).to.equal(email);
        expect(result.LastName).to.equal(email);
        expect(result.Email).to.equal(email);
      });
    });

    describe('when a member with an email and phone number is exported', () => {
      it('should set the phone number as the First and Last Name ', () => {
        const data = {
          ...base,
          partyMember: {
            partyMemberId,
            contactInfo: { defaultEmail: email, defaultPhone: phone },
          },
        };
        const [result] = createGuestCardMapper(data);
        expect(result.FirstName).to.equal(phone);
        expect(result.LastName).to.equal(phone);
      });
    });

    describe('when a member with a phone number is exported', () => {
      it('should set the Phone and trim the 1 country code', () => {
        const data = {
          ...base,
          partyMember: {
            partyMemberId,
            contactInfo: { defaultEmail: email, defaultPhone: phone },
          },
        };
        const [result] = createGuestCardMapper(data);
        expect(result.Phone).to.equal(phone.slice(1));
      });
    });

    describe('when a member an externalId is exported', () => {
      it('should set the NameID', () => {
        const data = {
          ...base,
          externals: [
            {
              partyMemberId,
              externalId: nameId,
            },
          ],
        };
        data.externals[0].externalId = nameId;
        const [result] = createGuestCardMapper(data);

        expect(result.NameID).to.equal(nameId);
      });
    });

    describe('when a member of a corporate party is exported', () => {
      it('should set the company name as First and Last Name if the member is primary', () => {
        const data = {
          ...base,
          party: {
            leaseType: DALTypes.LeaseType.CORPORATE,
          },
          primaryTenant: {
            id: partyMemberId,
          },
          companyName,
        };
        const [result] = createGuestCardMapper(data);
        expect(result.FirstName).to.equal(companyName);
        expect(result.LastName).to.equal(companyName);
      });
    });

    describe('when a member of a corporate party is exported', () => {
      it('should set his name as First and Last Name if the member is not primary', () => {
        const data = {
          ...base,
          party: {
            leaseType: DALTypes.LeaseType.CORPORATE,
          },
          primaryTenant: { id: 'some other id' },
          partyMember: {
            ...base.partyMember,
            fullName: 'Tim Jone',
          },
          companyName,
        };
        const [result] = createGuestCardMapper(data);
        expect(result.FirstName).to.equal('Tim');
        expect(result.LastName).to.equal('Jone');
      });
    });

    describe('when a member with long First or Last names is exported', () => {
      it('should trim First Name to MAX_LENGTH_FIRST_NAME (15) and Last Name to MAX_LENGTH_LAST_NAME (19) chars', () => {
        const first = 'Aaaaabbbbbcccccddddd';
        const last = 'Eeeeefffffggggghhhhh';
        const data = {
          ...base,
          partyMember: {
            ...base.partyMember,
            fullName: [first, last].join(' '),
          },
        };
        const [result] = createGuestCardMapper(data);
        expect(result.FirstName).to.equal(first.substring(0, MAX_LENGTH_FIRST_NAME));
        expect(result.LastName).to.equal(last.substring(0, MAX_LENGTH_LAST_NAME));
      });
    });

    describe('when a corporate party with a long company name is exported', () => {
      it('should trim First Name to MAX_LENGTH_FIRST_NAME (15) and Last Name to MAX_LENGTH_LAST_NAME (19) chars', () => {
        const longCompanyName = 'Shenyang Prehistoric Powers Hotel Management Limited Company';
        const data = {
          ...base,
          party: { leaseType: DALTypes.LeaseType.CORPORATE },
          partyMember: {
            ...base.partyMember,
            fullName: 'Tim Jone',
          },
          companyName: longCompanyName,
        };
        const [result] = createGuestCardMapper(data);
        expect(result.FirstName).to.equal(longCompanyName.substring(0, MAX_LENGTH_FIRST_NAME));
        expect(result.LastName).to.equal(longCompanyName.substring(0, MAX_LENGTH_LAST_NAME));
      });
    });

    describe('when the party agent is not a Lease Agent', () => {
      it('should set LeasingConsultant to @', () => {
        const data = {
          ...base,
          shouldExportExternalUniqueIdForAgent: false,
        };
        const [result] = createGuestCardMapper(data);
        expect(result.LeasingConsultant).to.equal('@');
      });
    });

    describe('when the party agent is a Lease Agent', () => {
      it('should set LeasingConsultant to the user externalUniqueId', () => {
        const data = {
          ...base,
          shouldExportExternalUniqueIdForAgent: true,
          userExternalUniqueId: '111',
        };
        const [result] = createGuestCardMapper(data);
        expect(result.LeasingConsultant).to.equal('111');
      });
    });

    describe('when the party agent is a Lease Agent and has an externalId in the TeamMembers table', () => {
      it('should set LeasingConsultant to the teamMembersExternalId', () => {
        const data = {
          ...base,
          shouldExportExternalUniqueIdForAgent: true,
          userExternalUniqueId: '111',
          teamMemberExternalId: '222',
        };
        const [result] = createGuestCardMapper(data);
        expect(result.LeasingConsultant).to.equal('222');
      });
    });

    describe('when the party has an application with a completed payment', () => {
      it('should set Type to A', () => {
        const data = {
          ...base,
          partyShouldBeExportedAsApplicant: true,
        };
        const [result] = createGuestCardMapper(data);
        expect(result.Type).to.equal('A');
      });
    });

    describe('when there is a primary tenant', () => {
      it('should set the PrimaryNameID and ApplicantStatus as Active', () => {
        const data = {
          ...base,
          primaryTenant: {
            id: partyMemberId,
          },
          externalInfo: {
            partyMemberId,
            externalId: nameId,
          },
        };
        const [result] = createGuestCardMapper(data);
        expect(result.PrimaryNameID).to.equal(nameId);
        expect(result.ApplicantStatus).to.equal('Active');
      });
    });

    describe('when the exported party member is an Occupant', () => {
      it('should set the ApplicantStatus as Other Resident', () => {
        const data = {
          ...base,
          partyMember: {
            ...base.partyMember,
            memberType: DALTypes.MemberType.OCCUPANT,
          },
          primaryTenant: { id: 'some other id' },
        };
        const [result] = createGuestCardMapper(data);
        expect(result.ApplicantStatus).to.equal('Other Resident');
      });
    });

    describe('when the exported party member is not the primary resident and is not an Occupant', () => {
      it('should set the ApplicantStatus as Co-Resident', () => {
        const data = {
          ...base,
          primaryTenant: { id: 'some other id' },
        };
        const [result] = createGuestCardMapper(data);
        expect(result.ApplicantStatus).to.equal('Co-Resident');
      });
    });

    describe('when the exported party member is a Guarantor', () => {
      it('should set the Guarantor flag', () => {
        const data = {
          ...base,
          partyMember: {
            ...base.partyMember,
            memberType: DALTypes.MemberType.GUARANTOR,
          },
        };
        const [result] = createGuestCardMapper(data);
        expect(result.Guarantor).to.equal('Y');
      });
    });

    describe('when the exported there is an inventory for an appointment', () => {
      it('should set the ProspectiveTenant values', () => {
        const data = {
          ...base,
          party: {
            ...base.party,
            metadata: { firstContactedDate: '2018-11-03T07:00:00.000Z' },
          },
          appointmentInventory: {
            property: {
              externalId: propertyExternalId,
            },
            inventorygroup: {
              externalId: 'ig-externalId',
            },
          },
        };
        const [result] = createGuestCardMapper(data);
        expect(result.ProspectiveTenant.PropertyPreference).to.equal(propertyExternalId);
        expect(result.ProspectiveTenant.UnitTypePreference).to.equal('ig-externalId');
        expect(result.ProspectiveTenant.VisitDate).to.equal('2018-11-03T00:00:00.0000000');
      });
    });
  });

  describe('residentialInteractions', () => {
    describe('where there is an appointment with an inventory', () => {
      it('should set the NameID, ActionDate, ActionDescription and LeasingAgentId', () => {
        const data = {
          ...base,
          externalInfo: { externalId: nameId },
          shouldExportExternalUniqueIdForTourAgent: true,
          tourAgentUserExternalId: 'tourAgentUserExternalId',
          tourAgentTeamMemberExternalId: '',
          party: {
            ...base.party,
            metadata: { firstContactedDate: '2018-11-03T07:00:00.000Z' },
          },
          appointmentInventory: {
            externalId: 'inventoryExternalId',
            property: {
              externalId: propertyExternalId,
            },
            inventorygroup: {
              externalId: 'ig-externalId',
            },
          },
          appointment: {
            metadata: {
              endDate: '2018-11-03T07:00:00.000Z',
            },
          },
        };
        const result = createResidentialInteractionsMapper(data);
        expect(result.ActionDate).to.equal('2018-11-03T00:00:00.0000000');
        expect(result.ActionDescription).to.equal('inventoryExternalId');
        expect(result.LeasingAgentId).to.equal('tourAgentUserExternalId');
      });
    });

    describe('where there is an appointment with an inventory associated to it and the party owner is a Lease Agent that has an externalId in the TeamMembers table', () => {
      it('should set the NameID, ActionDate, ActionDescription and LeasingAgentId to the teamMembersExternalId', () => {
        const data = {
          ...base,
          externalInfo: { externalId: nameId },
          shouldExportExternalUniqueIdForTourAgent: true,
          teamMemberExternalId: '222',
          tourAgentUserExternalId: 'tourAgentUserExternalId',
          tourAgentTeamMemberExternalId: '',
          party: {
            ...base.party,
            metadata: { firstContactedDate: '2018-11-03T07:00:00.000Z' },
          },
          appointmentInventory: {
            externalId: 'inventoryExternalId',
            property: {
              externalId: propertyExternalId,
            },
            inventorygroup: {
              externalId: 'ig-externalId',
            },
          },
          appointment: {
            metadata: {
              endDate: '2018-11-03T07:00:00.000Z',
            },
          },
        };
        const result = createResidentialInteractionsMapper(data);
        expect(result.ActionDate).to.equal('2018-11-03T00:00:00.0000000');
        expect(result.ActionDescription).to.equal('inventoryExternalId');
        expect(result.LeasingAgentId).to.equal('222');
      });
    });

    describe('where there is an appointment with an inventory associated to it, the appointment owner is different from the party owner and both agents have an externalId in the TeamMembers table', () => {
      it('should set the NameID, ActionDate, ActionDescription and LeasingAgentId to the tourAgentTeamMemberExternalId of the appointment owner', () => {
        const data = {
          ...base,
          externalInfo: { externalId: nameId },
          shouldExportExternalUniqueIdForTourAgent: true,
          teamMemberExternalId: '222',
          tourAgentUserExternalId: 'tourAgentUserExternalId',
          tourAgentTeamMemberExternalId: 'tourAgentTeamMemberExternalId',
          party: {
            ...base.party,
            metadata: { firstContactedDate: '2018-11-03T07:00:00.000Z' },
          },
          appointmentInventory: {
            externalId: 'inventoryExternalId',
            property: {
              externalId: propertyExternalId,
            },
            inventorygroup: {
              externalId: 'ig-externalId',
            },
          },
          appointment: {
            metadata: {
              endDate: '2018-11-03T07:00:00.000Z',
            },
          },
        };
        const result = createResidentialInteractionsMapper(data);
        expect(result.ActionDate).to.equal('2018-11-03T00:00:00.0000000');
        expect(result.ActionDescription).to.equal('inventoryExternalId');
        expect(result.LeasingAgentId).to.equal('tourAgentTeamMemberExternalId');
      });
    });

    describe('where there is an appointment with an inventory associated to it, the appointment owner is different from the party owner and appointment owner is not LA', () => {
      it('should set the NameID, ActionDate, ActionDescription and LeasingAgentId to @', () => {
        const data = {
          ...base,
          externalInfo: { externalId: nameId },
          shouldExportExternalUniqueIdForTourAgent: false,
          teamMemberExternalId: '222',
          tourAgentUserExternalId: 'tourAgentUserExternalId',
          party: {
            ...base.party,
            metadata: { firstContactedDate: '2018-11-03T07:00:00.000Z' },
          },
          appointmentInventory: {
            externalId: 'inventoryExternalId',
            property: {
              externalId: propertyExternalId,
            },
            inventorygroup: {
              externalId: 'ig-externalId',
            },
          },
          appointment: {
            metadata: {
              endDate: '2018-11-03T07:00:00.000Z',
            },
          },
        };
        const result = createResidentialInteractionsMapper(data);
        expect(result.ActionDate).to.equal('2018-11-03T00:00:00.0000000');
        expect(result.ActionDescription).to.equal('inventoryExternalId');
        expect(result.LeasingAgentId).to.equal('@');
      });
    });
  });

  describe('applicationDepositPayment', () => {
    describe('where there is a deposit payment for the application', () => {
      it('should set the relevant fields', () => {
        const data = {
          ...base,
          externals: [
            {
              partyMemberId,
              externalId: nameId,
            },
          ],
          holdDepositAmount: 100.5551,
          holdDepositInvoice: {
            transactionId: 'transactionExternalId',
            targetId: 2,
          },
          holdDepositSecurityCode: 'SEC',
        };

        const result = createApplicationDepositPaymentMapper(data);
        expect(result.amount).to.equal('100.56');
        expect(result.transactionReference).to.equal('transactionExternalId');
        expect(result.securityCode).to.equal('SEC');
      });
    });

    describe('where there is a deposit payment for the application, but the hold deposit invoice does not exist', () => {
      it('should set the transaction reference from the application account', () => {
        const data = {
          ...base,
          externals: [
            {
              partyMemberId,
              externalId: nameId,
            },
          ],
          appFeeInvoice: {
            transactionId: 'transactionExternalId',
            targetId: 1,
          },
          holdDepositAmount: 100.5551,
          holdDepositInvoice: {},
          holdDepositSecurityCode: 'SEC',
        };

        const result = createApplicationDepositPaymentMapper(data);
        expect(result.amount).to.equal('100.56');
        expect(result.transactionReference).to.equal('transactionExternalId');
        expect(result.securityCode).to.equal('SEC');
      });
    });
  });

  describe('applicationPayment', () => {
    describe('where there is an application fee payment', () => {
      it('should set the relevant fields', () => {
        const data = {
          ...base,
          externals: [
            {
              partyMemberId,
              externalId: nameId,
            },
          ],
          applicationFeeAmount: 100.5551,
          appFeeInvoice: {
            transactionId: 'transactionExternalId',
            targetId: 1,
          },
          holdDepositSecurityCode: 'SEC',
        };

        const result = createApplicationPaymentMapper(data);
        expect(result.amount).to.equal('100.56');
        expect(result.transactionReference).to.equal('transactionExternalId');
        expect(result.description).to.equal('App fee');
      });
    });
  });

  describe('petInformation', () => {
    const petBase = {
      ...base,
      externalInfo: { ...base.externalInfo, externalId: nameId },
      externals: [
        {
          partyMemberId,
          externalId: nameId,
        },
      ],
      pets: [{ info: { type: PetTypes.CAT, size: PetSizes.LIBS25 } }],
    };

    describe('where there are pets to be exported', () => {
      it('should set the relevant fields', () => {
        const [result] = createPetInformationMapper(petBase);
        expect(result.ResidentID).to.equal(nameId);
        expect(result.PetType).to.equal('C');
        expect(result.PetSize).to.equal('Medium');
      });
    });
  });

  describe('vehicleInformation', () => {
    const data = {
      ...base,
      externalInfo: { ...base.externalInfo, externalId: nameId },
      externals: [
        {
          partyMemberId,
          externalId: nameId,
        },
      ],
      vehicles: [{ info: { tagNumber: 'CJ 80 GAT', state: 'NY', color: 'black', makeAndModel: 'Jeep Wrangler' } }],
    };

    describe('where there are vehicles to be exported', () => {
      it('should set the relevant fields', () => {
        const [result] = createVehicleInformationMapper(data);
        expect(result.ResidentID).to.equal(nameId);
        expect(result.LicensePlate).to.equal('CJ 80 GAT');
        expect(result.State).to.equal('NY');
        expect(result.Color).to.equal('black');
        expect(result.Make).to.equal('Jeep');
        expect(result.Model).to.equal('Wrangler');
      });
    });

    describe('when the vehicle license plate is composed of special characteres', () => {
      const data2 = {
        ...data,
        vehicles: [
          { info: { makeAndModel: 'Alfa Romeo Giulia', tagNumber: 'CJ 80 GAT ✋' } },
          { info: { makeAndModel: 'Alfa Romeo Giulia', tagNumber: 'CJ 80 GA"T' } },
          { info: { makeAndModel: 'Alfa Romeo Giulia', tagNumber: 'CJ 8·"!0 GAT# a !"$' } },
        ],
      };
      it('should set lincense plate without special characteres', () => {
        const [result1, result2, result3] = createVehicleInformationMapper(data2);
        expect(result1.LicensePlate).to.equal('CJ 80 GAT');
        expect(result2.LicensePlate).to.equal('CJ 80 GAT');
        expect(result3.LicensePlate).to.equal('CJ 80 GAT a');
      });
    });

    describe('when the vehicle make is composed of multiple words', () => {
      const data2 = {
        ...data,
        vehicles: [{ info: { makeAndModel: 'Alfa Romeo Giulia', tagNumber: 'CJ 80 GAT' } }],
      };
      it('should detect the correct vehicle make', () => {
        const [result] = createVehicleInformationMapper(data2);
        expect(result.Make).to.equal('Alfa Romeo');
        expect(result.Model).to.equal('Giulia');
      });
    });

    describe('when the vehicle make and model are too long', () => {
      const data2 = {
        ...data,
        vehicles: [{ info: { makeAndModel: 'Koenigseggseggsegg CCXR Special Edition', tagNumber: 'CJ 80 GAT' } }],
      };
      it('should trim the make to MAX_LENGTH_VEHICLE_MAKE (15) and model to MAX_LENGTH_VEHICLE_MODEL (15)', () => {
        const [result] = createVehicleInformationMapper(data2);
        expect(result.Make).to.equal('Koenigseggseggs');
        expect(result.Model).to.equal('CCXR Special Ed');
      });
    });
  });

  describe('selectUnit', () => {
    const data = {
      ...base,
      externalInfo: { ...base.externalInfo, externalId: nameId },
      inventory: { building: { externalId: 'buildingExternalId' }, name: '101', externalId: '01-201', property: { externalId: propertyExternalId } },
      leaseTermLength: 12,
      lease: {
        baselineData: {
          quote: {
            moveInDate: '2018-11-03T07:00:00.000Z',
          },
          publishedLease: {
            moveInDate: '2018-11-03T07:00:00.000Z',
            leaseStartDate: '2018-11-02T07:00:00.000Z',
          },
        },
      },
    };

    describe('when a lease for a unit was executed', () => {
      it('should set the relevant fields', () => {
        const [result] = createSelectUnitMapper(data);
        expect(result.ProspectID).to.equal(nameId);
        expect(result.PropertyID).to.equal(propertyExternalId);
        expect(result.BuildingID).to.equal('buildingExternalId');
        expect(result.UnitID).to.equal('01-201');
        expect(result.LeaseTerm).to.equal(12);
        expect(result.OccupyDate).to.equal('2018-11-02T00:00:00.0000000');
      });
    });

    describe('when a lease for a unit was executed and the party property is different than the inventory property', () => {
      const exportData = {
        ...data,
        property: {
          externalId: '11190',
        },
      };

      it('should set the relevant fields', () => {
        const [result] = createSelectUnitMapper(exportData);
        expect(result.ProspectID).to.equal(nameId);
        expect(result.PropertyID).to.equal(propertyExternalId); // 13780
        expect(result.BuildingID).to.equal('buildingExternalId');
        expect(result.UnitID).to.equal('01-201');
        expect(result.LeaseTerm).to.equal(12);
        expect(result.OccupyDate).to.equal('2018-11-02T00:00:00.0000000');
      });
    });
  });

  describe('rentDetails', () => {
    const data = {
      ...base,
      externalInfo: { ...base.externalInfo, externalId: nameId },
      lease: { baselineData: { publishedLease: { unitRent: 1200 } } },
    };

    describe('when a lease for a unit was executed', () => {
      it('should set the relevant fields', () => {
        const [result] = createRentDetailsMapper(data);
        expect(result.Rent).to.equal(1200);
      });
    });
  });

  describe('confirmLease', () => {
    const allAvailableCharges = [
      {
        feeName: 'AdminFee',
        externalChargeCode: 'ADM',
        amount: 60,
      },
      {
        feeName: 'ParkingBaseRent',
        externalChargeCode: 'PRK',
        amount: 150,
      },
      {
        // SEC should not be exported
        feeName: 'SecurityDeposit',
        externalChargeCode: 'SEC',
        amount: 100,
      },
      {
        feeName: 'Employee Discount',
        isConcession: true,
        externalChargeCode: 'EED',
        amount: 300,
        nonRecurringAppliedAt: 'first',
      },
    ];

    const data = {
      ...base,
      externalInfo: { ...base.externalInfo, externalId: nameId },
      allAvailableCharges,
      appFeeAmount: 55,
      lease: {
        baselineData: {
          publishedLease: { leaseEndDate: '2018-10-30T00:00:00.0000000', leaseStartDate: '2018-06-30T00:00:00.0000000' },
          quote: { unitRent: 500 },
        },
      },
      property: { timezone: LA_TIMEZONE },
      leaseTerm: { termLength: 12 },
    };

    describe('when a lease for a unit was executed', () => {
      it('should set the relevant fields', () => {
        const { charges } = createConfirmLeaseMapper(data);
        const { lease, property } = data;
        const oneMonthAfterMoveIn = getConcessionEndDate(lease.baselineData.publishedLease.leaseStartDate, property.timezone);
        // SEC will not be exported, but the app fee will be added since there is an appFeeAmount
        // 4 fees * 3 categories (Nonrefundable, Recurring, Deposit)
        expect(charges.length).to.equal(15);

        expect(charges[0].externalChargeCode).to.equal("'ADM'");
        expect(charges[0].amount).to.equal(60);
        expect(charges[0].type).to.equal("'NONREFUNDABLE'");

        expect(charges[4].externalChargeCode).to.equal("'PRK'");
        expect(charges[4].amount).to.equal(150);
        expect(charges[4].type).to.equal("'RECURRING'");

        expect(charges[6].externalChargeCode).to.equal("'EED'");
        expect(charges[6].amount).to.equal(-300);
        expect(charges[6].type).to.equal("'RECURRING'");
        expect(charges[6].concessionEndDate).to.equal(`'${oneMonthAfterMoveIn}'`);

        expect(charges[7].externalChargeCode).to.equal("'EED'");
        expect(charges[7].amount).to.equal(0);
        expect(charges[7].type).to.equal("'NONREFUNDABLE'");

        expect(charges[9].externalChargeCode).to.equal("'APP'");
        expect(charges[9].amount).to.equal(55);
        expect(charges[9].type).to.equal("'NONREFUNDABLE'");

        expect(charges[13].externalChargeCode).to.equal("'RNT'");
        expect(charges[13].amount).to.equal(500);
        expect(charges[13].type).to.equal("'RECURRING'");
      });
    });

    describe('when a concession has a decimal monthly amount', () => {
      it('should not round the amount', () => {
        data.allAvailableCharges = [
          {
            isConcession: true,
            feeName: 'ParkingBaseRent',
            externalChargeCode: 'GAR',
            amount: 319,
            relativeAmount: 17.29,
            recurring: true,
          },
        ];
        const { charges } = createConfirmLeaseMapper(data);

        const charge = charges.find(c => c.externalChargeCode === "'GAR'" && c.type === FeeType.Recurring);
        expect(charge).to.be.ok;
        expect(charge.amount).to.equal(-17.29);
      });
    });

    describe('when there are 2 fees Nonrefundable and Recurring', () => {
      it('should add also a Deposit fee with amount zero', () => {
        data.allAvailableCharges = [
          {
            feeName: 'PetFee',
            externalChargeCode: 'PET',
            amount: 50,
          },
          {
            feeName: 'PetFee',
            externalChargeCode: 'PET',
            amount: 10,
            recurring: true,
          },
        ];

        const { charges } = createConfirmLeaseMapper(data);
        expect(charges.length).to.equal(9); // 3 for UnitBaseRent, 3 for AppFee which are added automatically, 3 for PET
        const charge = charges.find(c => c.externalChargeCode === "'PET'" && c.type === "'DEPOSIT'");
        expect(charge).to.be.ok;
        expect(charge.amount).to.equal(0);
      });
    });

    describe('when a lease for a unit was executed', () => {
      it('should set the relevant fields', () => {
        const { leaseEndDate } = createConfirmLeaseMapper(data);

        expect(leaseEndDate).to.equal('2018-10-29');
      });
    });
  });
});
