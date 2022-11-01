/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const cellTypes = {
  BOOLEAN: 'boolean',
  STRING: 'string',
  NUMBER: 'number',
};

export const spreadsheet = {
  GlobalSetting: {
    workbookSheetName: 'Global Settings',
    columns: [
      {
        header: 'communications\ndefaultEmailSignature',
        type: 'string',
      },
      {
        header: 'communications\ncontactUsLink',
        type: 'string',
      },
      {
        header: 'communications\nfooterNotice',
        type: 'string',
      },
      {
        header: 'communications\nfooterCopyright',
        type: 'string',
      },
      {
        header: 'preferences\nhidePropertyLifestyles',
        type: 'boolean',
      },
      {
        header: 'screening\noriginatorId',
        type: 'number',
      },
      {
        header: 'screening\nusername',
        type: 'string',
      },
      {
        header: 'screening\npassword',
        type: 'string',
      },
      {
        header: 'quote\nallowBaseRentAdjustmentFlag',
        type: 'boolean',
      },
      {
        header: 'communicationOverrides\ncustomerEmails',
        type: 'string',
      },
      {
        header: 'communicationOverrides\nemployeeEmails',
        type: 'string',
      },
      {
        header: 'communicationOverrides\ncustomerPhone',
        type: 'string',
      },
      {
        header: 'export\noneToManys',
        type: 'boolean',
      },
      {
        header: 'export\nskipSameDayLeases',
        type: 'boolean',
      },
      {
        header: 'features\nenableMergeParty',
        type: 'boolean',
      },
      {
        header: 'features\nduplicatePersonNotification',
        type: 'boolean',
      },
      {
        header: 'features\nenableHoneypotTrap',
        type: 'boolean',
      },
      {
        header: 'features\nenableRenewals',
        type: 'boolean',
      },
      {
        header: 'features\nenableExternalCalendarIntegration',
        type: 'boolean',
      },
      {
        header: 'features\nenableIcsAttachment',
        type: 'boolean',
      },
      {
        header: 'features\nenableAgentsOnlyAutomaticDashboardRefresh',
        type: 'boolean',
      },
      {
        header: 'features\nenableUniversity',
        type: 'boolean',
      },
      {
        header: 'features\nexportLeaseViaFtp',
        type: 'boolean',
      },
      {
        header: 'features\nenableTransfers',
        type: 'boolean',
      },
      {
        header: 'features\nenableRingPhoneConfiguration',
        type: 'boolean',
      },
      {
        header: 'features\nenablePaymentPlan',
        type: 'boolean',
      },
      {
        header: 'features\nenableCohortComms',
        type: 'boolean',
      },
      {
        header: 'features\ntransformReservedUnitStatusWithoutLease',
        type: 'boolean',
      },
      {
        header: 'remoteFTP\nhost',
        type: 'string',
      },
      {
        header: 'remoteFTP\nuser',
        type: 'string',
      },
      {
        header: 'remoteFTP\npassword',
        type: 'string',
      },
      {
        header: 'lease\nallowCounterSigningInPast',
        type: 'boolean',
      },
      {
        header: 'legal\nprivacyPolicyUrl',
        type: 'string',
      },
      {
        header: 'legal\ntermsOfServiceUrl',
        type: 'string',
      },
      {
        header: 'rules\ncustomPrefix',
        type: 'string',
      },
      {
        header: 'customImport\nresidentLegalStipColumn',
        type: 'string',
      },
      { header: 'customImport\nlossLeaderUnitColumn', type: 'string' },
    ],
  },
  BusinessEntity: {
    workbookSheetName: 'Business Entities',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'type',
        type: 'string',
      },
      {
        header: 'expertise',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'website',
        type: 'string',
      },
      {
        header: 'addressLine1',
        type: 'string',
      },
      {
        header: 'addressLine2',
        type: 'string',
      },
      {
        header: 'city',
        type: 'string',
      },
      {
        header: 'state',
        type: 'string',
      },
      {
        header: 'postalCode',
        type: 'string',
      },
    ],
  },
  PropertyGroup: {
    workbookSheetName: 'Property Groups',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'owner',
        type: 'string',
      },
      {
        header: 'operator',
        type: 'string',
      },
      {
        header: 'parentGroup',
        type: 'string',
      },
    ],
    foreignKeys: ['owner', 'operator'],
  },
  Disclosure: {
    workbookSheetName: 'Disclosures',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'displayOrder',
        type: 'number',
      },
      {
        header: 'displayHelp',
        type: 'string',
      },
      {
        header: 'descriptionHelper',
        type: 'string',
      },
      {
        header: 'requireApplicationReview',
        type: 'boolean',
      },
      {
        header: 'showInApplication',
        type: 'boolean',
      },
      {
        header: 'showInParty',
        type: 'boolean',
      },
    ],
  },
  Property: {
    workbookSheetName: 'Properties',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'propertyLegalName',
        type: 'string',
      },
      {
        header: 'owner',
        type: 'string',
      },
      {
        header: 'operator',
        type: 'string',
      },
      {
        header: 'propertyGroup',
        type: 'string',
      },
      {
        header: 'partyCohort',
        type: 'string',
      },
      {
        header: 'addressLine1',
        type: 'string',
      },
      {
        header: 'addressLine2',
        type: 'string',
      },
      {
        header: 'city',
        type: 'string',
      },
      {
        header: 'state',
        type: 'string',
      },
      {
        header: 'postalCode',
        type: 'string',
      },
      {
        header: 'timeZone',
        type: 'string',
      },
      {
        header: 'startDate',
        type: 'string',
      },
      {
        header: 'endDate',
        type: 'string',
      },
      {
        header: 'APN',
        type: 'number',
      },
      {
        header: 'MSANumber',
        type: 'number',
      },
      {
        header: 'MSAName',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'websiteDomain',
        type: 'string',
      },
      {
        header: 'website',
        type: 'string',
      },
      {
        header: 'displayPhone',
        type: 'string',
      },
      {
        header: 'postMonth',
        type: 'string',
      },
      {
        header: 'externalId',
        type: 'string',
      },
      {
        header: 'rmsExternalId',
        type: 'string',
      },
      {
        header: 'leasingOfficeAddress',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
      {
        header: 'geoLocation',
        type: 'string',
      },
      {
        header: 'daughterProperties',
        type: 'array',
      },
    ],
    foreignKeys: ['propertyGroup', 'partyCohort', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode'],
  },
  PropertyCloseSchedule: {
    workbookSheetName: 'Property Close Schedule',
    columns: [
      {
        header: 'propertyName',
        type: 'string',
      },
      {
        header: 'month',
        type: 'string',
      },
      {
        header: 'year',
        type: 'string',
      },
      {
        header: 'rollForwardDate',
        type: 'string',
      },
    ],
  },
  Amenity: {
    workbookSheetName: 'Amenities',
    columns: [
      {
        header: 'name',
        type: cellTypes.STRING,
        metadata: {
          validations: [
            {
              type: 'protected',
            },
          ],
        },
      },
      {
        header: 'property',
        type: cellTypes.STRING,
        metadata: {
          validations: [
            {
              type: 'protected',
            },
          ],
        },
      },
      {
        header: 'category',
        type: cellTypes.STRING,
        metadata: {
          validations: [
            {
              type: 'list',
              items: ['property', 'building', 'inventory'],
            },
            {
              type: 'protected',
            },
          ],
        },
      },
      {
        header: 'subCategory',
        type: cellTypes.STRING,
        metadata: {
          validations: [
            {
              type: 'list',
              items: [
                'accessibility',
                'appliances',
                'bath',
                'comfort',
                'elevation',
                'environmentFriendly',
                'flooring',
                'kitchen',
                'livingSpace',
                'parking',
                'financial',
                'residentExperience',
                'residentService',
                'security',
                'storage',
                'technology',
                'upgrades',
                'utilitiesAndCable',
                'view',
                'windows',
              ],
            },
          ],
        },
      },
      {
        header: 'displayName',
        type: cellTypes.STRING,
        metadata: {
          validations: [
            {
              type: 'protected',
            },
          ],
        },
      },
      {
        header: 'description',
        type: cellTypes.STRING,
        metadata: {
          validations: [
            {
              type: 'protected',
            },
          ],
        },
      },
      {
        header: 'highValueFlag',
        type: cellTypes.BOOLEAN,
      },
      {
        header: 'relativePrice',
        type: cellTypes.NUMBER,
        format: '$0.00',
        metadata: {
          validations: [
            {
              type: 'protected',
            },
          ],
        },
      },
      {
        header: 'absolutePrice',
        type: cellTypes.NUMBER,
        format: '$0.00',
        metadata: {
          validations: [
            {
              type: 'protected',
            },
          ],
        },
      },
      {
        header: 'targetUnitFlag',
        type: cellTypes.BOOLEAN,
      },
      {
        header: 'hiddenFlag',
        type: cellTypes.BOOLEAN,
      },
      {
        header: 'externalId',
        type: cellTypes.STRING,
        metadata: {
          validations: [
            {
              type: 'protected',
            },
          ],
        },
      },
      {
        header: 'endDate',
        type: cellTypes.STRING,
        metadata: {
          validations: [
            {
              condition: 'notEmpty',
            },
          ],
        },
      },
    ],
    foreignKeys: ['property'],
  },
  Building: {
    workbookSheetName: 'Buildings',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'type',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'addressLine1',
        type: 'string',
      },
      {
        header: 'addressLine2',
        type: 'string',
      },
      {
        header: 'city',
        type: 'string',
      },
      {
        header: 'state',
        type: 'string',
      },
      {
        header: 'postalCode',
        type: 'string',
      },
      {
        header: 'startDate',
        type: 'string',
      },
      {
        header: 'endDate',
        type: 'string',
      },
      {
        header: 'floorCount',
        type: 'number',
      },
      {
        header: 'surfaceArea',
        type: 'number',
      },
      {
        header: 'amenities',
        type: 'array',
      },
      {
        header: 'externalId',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
    foreignKeys: ['property', 'amenities', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode'],
  },
  LeaseName: {
    workbookSheetName: 'Lease Names',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'inventoryType',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
    foreignKeys: ['property'],
  },
  LeaseTerm: {
    workbookSheetName: 'Lease Terms',
    columns: [
      {
        header: 'leaseName',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'length',
        type: 'number',
      },
      {
        header: 'period',
        type: 'string',
      },
      {
        header: 'relativeAdjustment',
        type: 'number',
      },
      {
        header: 'absoluteAdjustment',
        type: 'number',
      },
      {
        header: 'state',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
    foreignKeys: ['leaseName', 'property'],
  },
  Layout: {
    workbookSheetName: 'Layouts',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'inventoryType',
        type: 'string',
      },
      {
        header: 'numBedrooms',
        type: 'number',
      },
      {
        header: 'numBathrooms',
        type: 'number',
      },
      {
        header: 'surfaceArea',
        type: 'number',
      },
      {
        header: 'floorCount',
        type: 'number',
      },
      {
        header: 'amenities',
        type: 'array',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
      {
        header: 'marketingLayout',
        type: 'string',
      },
      {
        header: 'marketingVideoAssets',
        type: 'array',
      },
      {
        header: 'marketing3DAssets',
        type: 'array',
      },
      {
        header: 'externalId',
        type: 'string',
      },
    ],
    foreignKeys: ['property', 'amenities', 'marketingLayout', 'marketingVideoAssets', 'marketing3DAssets'],
  },
  Fee: {
    workbookSheetName: 'Fees',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'feeType',
        type: 'string',
      },
      {
        header: 'renewalLetterDisplayFlag',
        type: 'boolean',
      },
      {
        header: 'quoteSectionName',
        type: 'string',
      },
      {
        header: 'maxQuantityInQuote',
        type: 'number',
      },
      {
        header: 'additionalFees',
        type: 'array',
      },
      {
        header: 'relatedFees',
        type: 'array',
      },
      {
        header: 'servicePeriod',
        type: 'string',
      },
      {
        header: 'variableAdjustmentFlag',
        type: 'boolean',
      },
      {
        header: 'estimatedFlag',
        type: 'boolean',
      },
      {
        header: 'relativePrice',
        type: 'number',
      },
      {
        header: 'absolutePrice',
        type: 'number',
      },
      {
        header: 'relativeDefaultPrice',
        type: 'number',
      },
      {
        header: 'absoluteDefaultPrice',
        type: 'number',
      },
      {
        header: 'priceFloorCeiling',
        type: 'string',
      },
      {
        header: 'depositInterestFlag',
        type: 'boolean',
      },
      {
        header: 'quotePaymentScheduleFlag',
        type: 'boolean',
      },
      {
        header: 'leaseState',
        type: 'string',
      },
      {
        header: 'externalChargeCode',
        type: 'string',
      },
      {
        header: 'externalChargeAccount',
        type: 'string',
      },
      {
        header: 'externalChargeAccrualAccount',
        type: 'string',
      },
      {
        header: 'externalChargeNotes',
        type: 'string',
      },
      {
        header: 'externalChargeRef',
        type: 'string',
      },
      {
        header: 'externalReceiptAccount',
        type: 'string',
      },
      {
        header: 'externalReceiptAccrualAccount',
        type: 'string',
      },
      {
        header: 'externalReceiptOffset',
        type: 'string',
      },
      {
        header: 'externalReceiptNotes',
        type: 'string',
      },
      {
        header: 'externalReceiptRef',
        type: 'string',
      },
      {
        header: 'externalWaiverAccount',
        type: 'string',
      },
      {
        header: 'externalWaiverAccrualAccount',
        type: 'string',
      },
      {
        header: 'externalWaiverOffset',
        type: 'string',
      },
      {
        header: 'externalWaiverNotes',
        type: 'string',
      },
      {
        header: 'externalWaiverRef',
        type: 'string',
      },
      {
        header: 'marketingQuestionName',
        type: 'string',
      },
    ],
    foreignKeys: ['property', 'additionalFees', 'relatedFees', 'marketingQuestionName'],
  },
  MarketingQuestions: {
    workbookSheetName: 'Marketing Questions',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displaySectionQuestion',
        type: 'string',
      },
      {
        header: 'displayPrimaryQuestion',
        type: 'string',
      },
      {
        header: 'displayPrimaryQuestionDescription',
        type: 'string',
      },
      {
        header: 'displayFollowupQuestion',
        type: 'string',
      },
      {
        header: 'inputTypeForFollowupQuestion',
        type: 'string',
      },
      {
        header: 'enumValues',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
      {
        header: 'displayOrder',
        type: 'numeric',
      },
    ],
  },
  InventoryGroup: {
    workbookSheetName: 'Inventory Groups',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'inventoryType',
        type: 'string',
      },
      {
        header: 'leaseName',
        type: 'string',
      },
      {
        header: 'basePriceMonthly',
        type: 'number',
      },
      {
        header: 'basePriceWeekly',
        type: 'number',
      },
      {
        header: 'basePriceDaily',
        type: 'number',
      },
      {
        header: 'basePriceHourly',
        type: 'number',
      },
      {
        header: 'feeName',
        type: 'string',
      },
      {
        header: 'primaryRentableFlag',
        type: 'boolean',
      },
      {
        header: 'amenities',
        type: 'array',
      },
      {
        header: 'economicStatus',
        type: 'string',
      },
      {
        header: 'rentControlFlag',
        type: 'boolean',
      },
      {
        header: 'affordableFlag',
        type: 'boolean',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
      {
        header: 'externalId',
        type: 'string',
      },
    ],
    foreignKeys: ['property', 'leaseName', 'feeName', 'amenities'],
  },
  Inventory: {
    workbookSheetName: 'Inventory',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'building',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'type',
        type: 'string',
      },
      {
        header: 'state',
        type: 'string',
      },
      {
        header: 'inventoryGroup',
        type: 'string',
      },
      {
        header: 'layout',
        type: 'string',
      },
      {
        header: 'multipleItemTotal',
        type: 'number',
      },
      {
        header: 'parentInventory',
        type: 'string',
      },
      {
        header: 'floor',
        type: 'number',
      },
      {
        header: 'amenities',
        type: 'array',
      },
      {
        header: 'externalId',
        type: 'string',
      },
      {
        header: 'address',
        type: 'string',
      },
      {
        header: 'rmsExternalId',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
    foreignKeys: ['property', 'building', 'parentInventory', 'layout', 'inventoryGroup', 'amenities'],
  },
  Concession: {
    workbookSheetName: 'Concessions',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'appliedToFees',
        type: 'string',
      },
      {
        header: 'relativeAdjustment',
        type: 'number',
      },
      {
        header: 'absoluteAdjustment',
        type: 'number',
      },
      {
        header: 'relativeDefaultAdjustment',
        type: 'number',
      },
      {
        header: 'absoluteDefaultAdjustment',
        type: 'number',
      },
      {
        header: 'adjustmentFloorCeiling',
        type: 'string',
      },
      {
        header: 'variableAdjustmentFlag',
        type: 'boolean',
      },
      {
        header: 'optionalFlag',
        type: 'boolean',
      },
      {
        header: 'excludeFromRentFlag',
        type: 'boolean',
      },
      {
        header: 'hideInSelfServiceFlag',
        type: 'boolean',
      },
      {
        header: 'recurringFlag',
        type: 'boolean',
      },
      {
        header: 'recurringCount',
        type: 'number',
      },
      {
        header: 'nonRecurringAppliedAt',
        type: 'string',
      },
      {
        header: 'leaseState',
        type: 'string',
      },
      {
        header: 'leaseNames',
        type: 'array',
      },
      {
        header: 'minLeaseLength',
        type: 'number',
      },
      {
        header: 'maxLeaseLength',
        type: 'number',
      },
      {
        header: 'layouts',
        type: 'array',
      },
      {
        header: 'buildings',
        type: 'string',
      },
      {
        header: 'amenities',
        type: 'array',
      },
      {
        header: 'startDate',
        type: 'string',
      },
      {
        header: 'endDate',
        type: 'string',
      },
      {
        header: 'account',
        type: 'number',
      },
      {
        header: 'subAccount',
        type: 'number',
      },
      {
        header: 'taxableFlag',
        type: 'boolean',
      },
      {
        header: 'externalChargeCode',
        type: 'string',
      },
      {
        header: 'bakedIntoAppliedFeeFlag',
        type: 'boolean',
      },
    ],
    foreignKeys: ['property', 'appliedToFees'],
  },
  Employee: {
    workbookSheetName: 'Employees',
    columns: [
      {
        header: 'userUniqueId',
        type: 'string',
      },
      {
        header: 'registrationEmail',
        type: 'string',
      },
      {
        header: 'fullName',
        type: 'string',
      },
      {
        header: 'preferredName',
        type: 'string',
      },
      {
        header: 'employmentType',
        type: 'string',
      },
      {
        header: 'businessTitle',
        type: 'string',
      },
      {
        header: 'calendarAccount',
        type: 'string',
      },
    ],
  },
  Team: {
    workbookSheetName: 'Teams',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'module',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'properties',
        type: 'array',
      },
      {
        header: 'timeZone',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
      {
        header: 'associatedTeamNames',
        type: 'string',
      },
      {
        header: 'calendarAccount',
        type: 'string',
      },
      {
        header: 'calendarName',
        type: 'string',
      },
      {
        header: 'voiceMessage',
        type: 'string',
      },
    ],
    foreignKeys: ['properties', 'voiceMessage'],
  },
  TeamSalesTarget: {
    workbookSheetName: 'Team Targets',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'month',
        type: 'number',
      },
      {
        header: 'year',
        type: 'number',
      },
      {
        header: 'salesTarget',
        type: 'number',
      },
      {
        header: 'salesCycleDays',
        type: 'number',
      },
    ],
    foreignKeys: ['name'],
  },
  TeamMember: {
    workbookSheetName: 'Team Members',
    columns: [
      {
        header: 'team',
        type: 'string',
      },
      {
        header: 'userUniqueId',
        type: 'string',
      },
      {
        header: 'roles',
        type: 'array',
      },
      {
        header: 'laaAccessLevels',
        type: 'array',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
      {
        header: 'directEmailIdentifier',
        type: 'string',
      },
      {
        header: 'outsideDedicatedEmails',
        type: 'string',
      },
      {
        header: 'directPhoneIdentifier',
        type: 'string',
      },
      {
        header: 'voiceMessage',
        type: 'string',
      },
      {
        header: 'externalId',
        type: 'string',
      },
    ],
    foreignKeys: ['team', 'userUniqueId', 'voiceMessage'],
  },
  TeamMemberSalesTarget: {
    workbookSheetName: 'Team Member Targets',
    columns: [
      {
        header: 'team',
        type: 'string',
      },
      {
        header: 'registrationEmail',
        type: 'string',
      },
      {
        header: 'month',
        type: 'number',
      },
      {
        header: 'year',
        type: 'number',
      },
      {
        header: 'salesTarget',
        type: 'number',
      },
      {
        header: 'contactsToSalesConv',
        type: 'number',
      },
      {
        header: 'leadsToSalesConv',
        type: 'number',
      },
      {
        header: 'prospectsToSalesConv',
        type: 'number',
      },
      {
        header: 'applicantsToSalesConv',
        type: 'number',
      },
      {
        header: 'leasesToSalesConv',
        type: 'number',
      },
    ],
    foreignKeys: ['team', 'registrationEmail'],
  },
  PropertySetting: {
    workbookSheetName: 'Property Settings',
    columns: [
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'quote\nexpirationPeriod',
        type: 'number',
      },
      {
        header: 'quote\nrenewalLetterExpirationPeriod',
        type: 'number',
      },
      {
        header: 'quote\npolicyStatement',
        type: 'string',
      },
      {
        header: 'quote\nrenewalLetterPolicyStatement',
        type: 'string',
      },
      {
        header: 'quote\nprorationStrategy',
        type: 'string',
      },
      {
        header: 'inventory\nhideStateFlag',
        type: 'boolean',
      },
      {
        header: 'screening\npropertyName',
        type: 'number',
      },
      {
        header: 'lease\npropertyName',
        type: 'number',
      },
      {
        header: 'lease\nallowRentableItemSelection',
        type: 'boolean',
      },
      {
        header: 'lease\nresidentSignatureTypes',
        type: 'array',
      },
      {
        header: 'lease\nguarantorSignatureTypes',
        type: 'array',
      },
      {
        header: 'lease\nusername',
        type: 'string',
      },
      {
        header: 'lease\npassword',
        type: 'string',
      },
      {
        header: 'lease\nallowPartyRepresentativeSelection',
        type: 'boolean',
      },
      {
        header: 'application\nurlPropPolicy',
        type: 'string',
      },
      {
        header: 'calendar\nteamSlotDuration',
        type: 'number',
      },
      {
        header: 'screening\nincomePolicyRoommates',
        type: 'string',
      },
      {
        header: 'screening\nincomePolicyGuarantors',
        type: 'string',
      },
      {
        header: 'payment\npropertyName',
        type: 'string',
      },
      {
        header: 'appointment\nenableSelfServiceEdit',
        type: 'boolean',
      },
      {
        header: 'appointment\neditUrl',
        type: 'string',
      },
      {
        header: 'appointment\ntourTypesAvailable',
        type: 'array',
      },
      {
        header: 'residentservices\nmoveoutNoticePeriod',
        type: 'number',
      },
      {
        header: 'marketing\ncity',
        type: 'string',
      },
      {
        header: 'marketing\ncityAliases',
        type: 'string',
      },
      {
        header: 'marketing\nstate',
        type: 'string',
      },
      {
        header: 'marketing\nstateAliases',
        type: 'string',
      },
      {
        header: 'marketing\nregion',
        type: 'string',
      },
      {
        header: 'marketing\nregionAliases',
        type: 'string',
      },
      {
        header: 'marketing\nneighborhood',
        type: 'string',
      },
      {
        header: 'marketing\nneighborhoodAliases',
        type: 'string',
      },
      {
        header: 'marketing\ntestimonials',
        type: 'string',
      },
      {
        header: 'marketing\ntags',
        type: 'string',
      },
      {
        header: 'marketing\npropertyAmenities',
        type: 'string',
      },
      {
        header: 'marketing\nlayoutAmenities',
        type: 'string',
      },
      {
        header: 'marketing\nselfServeDefaultLeaseLengthsForUnits',
        type: 'array',
      },
      {
        header: 'marketing\nselfServeAllowExpandLeaseLengthsForUnits',
        type: 'boolean',
      },
      {
        header: 'marketing\nselfServeMaxLeaseStartDate',
        type: 'number',
      },
      {
        header: 'marketing\nincludedInListings',
        type: 'boolean',
      },
      {
        header: 'marketing\nmaxVacantReadyUnits',
        type: 'number',
      },
      {
        header: 'marketing\nmaxUnitsInLayout',
        type: 'number',
      },
      {
        header: 'marketing\nmapZoomLevel',
        type: 'number',
      },
      {
        header: 'marketing\nenableScheduleTour',
        type: 'boolean',
      },
      {
        header: 'marketing\nmapPlaces',
        type: 'array',
      },
      {
        header: 'marketing\nfacebookURL',
        type: 'string',
      },
      {
        header: 'marketing\ninstagramURL',
        type: 'string',
      },
      {
        header: 'marketing\ngoogleReviewsURL',
        type: 'string',
      },
      {
        header: 'marketing\nofficeHours',
        type: 'string',
      },
      {
        header: 'marketing\nenableHeroListingHighlight',
        type: 'boolean',
      },
      {
        header: 'comms\ndefaultPropertyProgram',
        type: 'string',
      },
      {
        header: 'comms\ndefaultOutgoingProgram',
        type: 'string',
      },
      {
        header: 'comms\ndaysToRouteToALPostMoveout',
        type: 'number',
      },
      {
        header: 'renewals\nrenewalCycleStart',
        type: 'number',
      },
      {
        header: 'renewals\nskipOriginalGuarantors',
        type: 'boolean',
      },
      {
        header: 'marketingLocation\naddressLine1',
        type: 'string',
      },
      {
        header: 'marketingLocation\naddressLine2',
        type: 'string',
      },
      {
        header: 'marketingLocation\ncity',
        type: 'string',
      },
      {
        header: 'marketingLocation\nstate',
        type: 'string',
      },
      {
        header: 'marketingLocation\npostalCode',
        type: 'string',
      },
      {
        header: 'applicationReview\nconditionalApprovalOptions',
        type: 'array',
      },
      {
        header: 'applicationReview\nsendAALetterOnDecline',
        type: 'boolean',
      },
      {
        header: 'applicationReview\nsendAALetterOnConditional',
        type: 'boolean',
      },
      {
        header: 'marketing\nvideoAssets',
        type: 'array',
      },
      {
        header: 'marketing\n3DAssets',
        type: 'array',
      },
    ],
  },
  Source: {
    workbookSheetName: 'Sources',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'type',
        type: 'string',
      },
    ],
  },
  OfficeHour: {
    workbookSheetName: 'Office Hours',
    columns: [
      {
        header: 'team',
        type: 'string',
      },
      {
        header: 'day',
        type: 'string',
      },
      {
        header: 'start',
        type: 'string',
      },
      {
        header: 'end',
        type: 'string',
      },
    ],
  },
  TeamSetting: {
    workbookSheetName: 'Team Settings',
    columns: [
      {
        header: 'team',
        type: 'string',
      },
      {
        header: 'callQueue\nenabled',
        type: 'boolean',
      },
      {
        header: 'callQueue\ntimeToVoiceMail',
        type: 'number',
      },
      {
        header: 'call\nwrapUpDelayAfterCallEnds',
        type: 'number',
      },
      {
        header: 'call\ninitialDelayAfterSignOn',
        type: 'number',
      },
      {
        header: 'comms\nallowBlockContactFlag',
        type: 'boolean',
      },
      {
        header: 'features\ndisableNewLeasePartyCreation',
        type: 'boolean',
      },
    ],
  },
  ExternalPhone: {
    workbookSheetName: 'External Phones',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'teams',
        type: 'array',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
    ],
    foreignKeys: ['teams', 'property'],
  },
  Campaign: {
    workbookSheetName: 'Campaigns',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
    ],
  },
  Program: {
    workbookSheetName: 'Programs',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'reportingDisplayName',
        type: 'string',
      },
      {
        header: 'path',
        type: 'string',
      },
      {
        header: 'campaign',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'team',
        type: 'string',
      },
      {
        header: 'primaryProperty',
        type: 'string',
      },
      {
        header: 'onSiteLeasingTeam',
        type: 'string',
      },
      {
        header: 'source',
        type: 'string',
      },
      {
        header: 'directEmailIdentifier',
        type: 'string',
      },
      {
        header: 'outsideDedicatedEmails',
        type: 'string',
      },
      {
        header: 'displayEmail',
        type: 'string',
      },
      {
        header: 'directPhoneIdentifier',
        type: 'string',
      },
      {
        header: 'displayPhoneNumber',
        type: 'string',
      },
      {
        header: 'displayUrl',
        type: 'string',
      },
      {
        header: 'voiceMessage',
        type: 'string',
      },
      {
        header: 'requireMatchingPathFlag',
        type: 'boolean',
      },
      {
        header: 'defaultMatchingPath',
        type: 'string',
      },
      {
        header: 'requireMatchingSourceFlag',
        type: 'boolean',
      },
      {
        header: 'defaultMatchingSource',
        type: 'string',
      },
      {
        header: 'endDate',
        type: 'string',
      },
      {
        header: 'forwardingEnabledFlag',
        type: 'boolean',
      },
      {
        header: 'forwardEmailToExternalTarget',
        type: 'string',
      },
      {
        header: 'forwardCallToExternalTarget',
        type: 'string',
      },
      {
        header: 'forwardSMSToExternalTarget',
        type: 'string',
      },
      {
        header: 'enableBotResponseOnCommunications',
        type: 'boolean',
      },
      {
        header: 'activatePaymentPlan',
        type: 'boolean',
      },
      {
        header: 'gaIds',
        type: 'string',
      },
      {
        header: 'gaActions',
        type: 'string',
      },
      {
        header: 'programFallback',
        type: 'string',
      },
      {
        header: 'selectedProperties',
        type: 'array',
      },
    ],
    foreignKeys: ['source', 'team', 'primaryProperty', 'onSiteLeasingTeam', 'voiceMessage', 'campaign', 'programFallback', 'selectedProperties'],
    customKeys: [
      'requireMatchingPathFlag',
      'defaultMatchingPath',
      'requireMatchingSourceFlag',
      'defaultMatchingSource',
      'forwardingEnabledFlag',
      'forwardEmailToExternalTarget',
      'forwardCallToExternalTarget',
      'forwardSMSToExternalTarget',
      'activatePaymentPlan',
      'gaIds',
      'gaActions',
    ],
  },
  ProgramReferrer: {
    workbookSheetName: 'Referrers',
    columns: [
      {
        header: 'order',
        type: 'number',
      },
      {
        header: 'program',
        type: 'string',
      },
      {
        header: 'currentUrl',
        type: 'string',
      },
      {
        header: 'referrerUrl',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'defaultFlag',
        type: 'boolean',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
    foreignKeys: ['program'],
  },
  OutgoingCall: {
    workbookSheetName: 'Outgoing calls',
    columns: [
      {
        header: 'team',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'program',
        type: 'string',
      },
    ],
    foreignKeys: ['team', 'property', 'program'],
  },
  ApplicationSetting: {
    workbookSheetName: 'Application Settings',
    columns: [
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'partyType',
        type: 'string',
      },
      {
        header: 'memberType',
        type: 'string',
      },
      {
        header: 'incomeSourcesSection',
        type: 'string',
      },
      {
        header: 'addressHistorySection',
        type: 'string',
      },
      {
        header: 'disclosuresSection',
        type: 'string',
      },
      {
        header: 'childrenSection',
        type: 'string',
      },
      {
        header: 'petsSection',
        type: 'string',
      },
      {
        header: 'vehiclesSection',
        type: 'string',
      },
      {
        header: 'privateDocumentsSection',
        type: 'string',
      },
      {
        header: 'sharedDocumentsSection',
        type: 'string',
      },
      {
        header: 'rentersInsuranceSection',
        type: 'string',
      },
      {
        header: 'holdDeposit',
        type: 'string',
      },
      {
        header: 'holdDepositWithoutUnit',
        type: 'string',
      },
      {
        header: 'creditReportRequiredFlag',
        type: 'boolean',
      },
      {
        header: 'criminalReportRequiredFlag',
        type: 'boolean',
      },
      {
        header: 'creditReportValidForPeriod',
        type: 'number',
      },
      {
        header: 'criminalReportValidForPeriod',
        type: 'number',
      },
      {
        header: 'appFeePaymentValidForPeriod',
        type: 'number',
      },
    ],
  },
  PartySetting: {
    workbookSheetName: 'Party Settings',
    columns: [
      {
        header: 'partyType',
        type: 'string',
      },
      {
        header: 'showOccupantMember',
        type: 'boolean',
      },
      {
        header: 'holdDepositAccepted',
        type: 'boolean',
      },
      {
        header: 'showEmergencyContactTask',
        type: 'boolean',
      },
      {
        header: 'residentOrPartyLevelGuarantor',
        type: 'string',
      },
    ],
  },
  CommsTemplate: {
    workbookSheetName: 'Comms Templates',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'emailSubject',
        type: 'string',
      },
      {
        header: 'emailTemplate',
        type: 'string',
      },
      {
        header: 'smsTemplate',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
  },
  CommsTemplateSettings: {
    workbookSheetName: 'Comms Template Settings',
    columns: [
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'virtualTour\ncreatedTemplate',
        type: 'string',
      },
      {
        header: 'virtualTour\ncancelledTemplate',
        type: 'string',
      },
      {
        header: 'virtualTour\nupdatedTemplate',
        type: 'string',
      },
      {
        header: 'virtualTour\ncreatedTemplateWithEditLink',
        type: 'string',
      },
      {
        header: 'virtualTour\nupdatedTemplateWithEditLink',
        type: 'string',
      },
      {
        header: 'inPersonTour\ncreatedTemplate',
        type: 'string',
      },
      {
        header: 'inPersonTour\ncancelledTemplate',
        type: 'string',
      },
      {
        header: 'inPersonTour\nupdatedTemplate',
        type: 'string',
      },
      {
        header: 'inPersonTour\ncreatedTemplateWithEditLink',
        type: 'string',
      },
      {
        header: 'inPersonTour\nupdatedTemplateWithEditLink',
        type: 'string',
      },
      {
        header: 'inPersonSelfGuidedTour\ncreatedTemplate',
        type: 'string',
      },
      {
        header: 'inPersonSelfGuidedTour\ncancelledTemplate',
        type: 'string',
      },
      {
        header: 'inPersonSelfGuidedTour\nupdatedTemplate',
        type: 'string',
      },
      {
        header: 'inPersonSelfGuidedTour\ncreatedTemplateWithEditLink',
        type: 'string',
      },
      {
        header: 'inPersonSelfGuidedTour\nupdatedTemplateWithEditLink',
        type: 'string',
      },
      {
        header: 'leasingAppointment\ncreatedTemplate',
        type: 'string',
      },
      {
        header: 'leasingAppointment\ncancelledTemplate',
        type: 'string',
      },
      {
        header: 'leasingAppointment\nupdatedTemplate',
        type: 'string',
      },
      {
        header: 'leasingAppointment\ncreatedTemplateWithEditLink',
        type: 'string',
      },
      {
        header: 'leasingAppointment\nupdatedTemplateWithEditLink',
        type: 'string',
      },
      {
        header: 'notification\nrxpAnnouncement',
        type: 'string',
      },
      {
        header: 'notification\nrxpDirectMessage',
        type: 'string',
      },
      {
        header: 'notification\nrxpAlert',
        type: 'string',
      },
      {
        header: 'consumerAccount\nnewResidentRegistration',
        type: 'string',
      },
      {
        header: 'consumerAccount\nregistrationConfirmation',
        type: 'string',
      },
      {
        header: 'consumerAccount\nresidentInvitation',
        type: 'string',
      },
      {
        header: 'consumerAccount\nchangePassword',
        type: 'string',
      },
      {
        header: 'consumerAccount\nchangePasswordConfirmation',
        type: 'string',
      },
      {
        header: 'quote\nrenewalLetter',
        type: 'string',
      },
      {
        header: 'screening\ndeclineAALetter',
        type: 'string',
      },
    ],
  },
  VoiceMessages: {
    workbookSheetName: 'VoiceMessages',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'afterHours',
        type: 'string',
      },
      {
        header: 'voicemail',
        type: 'string',
      },
      {
        header: 'unavailable',
        type: 'string',
      },
      {
        header: 'callBackRequestAck',
        type: 'string',
      },
      {
        header: 'callQueueWelcome',
        type: 'string',
      },
      {
        header: 'callQueueUnavailable',
        type: 'string',
      },
      {
        header: 'callQueueClosing',
        type: 'string',
      },
      {
        header: 'callRecordingNotice',
        type: 'string',
      },
      {
        header: 'holdingMusic',
        type: 'string',
      },
    ],
  },
  VoiceMenuItems: {
    workbookSheetName: 'VoiceMenuItems',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'key',
        type: 'number',
      },
      {
        header: 'action',
        type: 'string',
      },
      {
        header: 'number',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
    ],
  },
  TemplateShortCode: {
    workbookSheetName: 'Template Short Codes',
    columns: [
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'shortCode',
        type: 'string',
      },
      {
        header: 'templateName',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
    foreignKeys: ['property', 'templateName'],
  },
  ScreeningCriteria: {
    workbookSheetName: 'Screening Criteria',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'monthlyResidentIncomeDebtMultiple',
        type: 'number',
      },
      {
        header: 'monthlyGuarantorIncomeDebtMultiple',
        type: 'number',
      },
      {
        header: 'monthlyResidentIncomeMultiple',
        type: 'number',
      },
      {
        header: 'monthlyGuarantorIncomeMultiple',
        type: 'number',
      },
      {
        header: 'excessiveIssuesCount',
        type: 'number',
      },
      {
        header: 'hasGroupResidentIncomes',
        type: 'boolean',
      },
      {
        header: 'hasGroupGuarantorIncomes',
        type: 'boolean',
      },
      {
        header: 'hasGroupResidentCreditScores',
        type: 'boolean',
      },
      {
        header: 'hasGroupGuarantorCreditScores',
        type: 'boolean',
      },
      {
        header: 'fullLeaseLiquidAssetMultiple',
        type: 'number',
      },
      {
        header: 'approvedResidentCreditScore',
        type: 'number',
      },
      {
        header: 'declinedResidentCreditScore',
        type: 'number',
      },
      {
        header: 'approvedGuarantorCreditScore',
        type: 'number',
      },
      {
        header: 'declinedGuarantorCreditScore',
        type: 'number',
      },
      {
        header: 'defaultResidentCreditScore',
        type: 'number',
      },
      {
        header: 'defaultGuarantorCreditScore',
        type: 'number',
      },
      {
        header: 'drugsFelony',
        type: 'string',
      },
      {
        header: 'drugsMisdemeanor',
        type: 'string',
      },
      {
        header: 'duiFelony',
        type: 'string',
      },
      {
        header: 'duiMisdemeanor',
        type: 'string',
      },
      {
        header: 'unclassifiedFelony',
        type: 'string',
      },
      {
        header: 'unclassifiedMisdemeanor',
        type: 'string',
      },
      {
        header: 'propertyFelony',
        type: 'string',
      },
      {
        header: 'propertyMisdemeanor',
        type: 'string',
      },
      {
        header: 'sexFelony',
        type: 'string',
      },
      {
        header: 'sexMisdemeanor',
        type: 'string',
      },
      {
        header: 'theftFelony',
        type: 'string',
      },
      {
        header: 'theftMisdemeanor',
        type: 'string',
      },
      {
        header: 'theftByCheckFelony',
        type: 'string',
      },
      {
        header: 'theftByCheckMisdemeanor',
        type: 'string',
      },
      {
        header: 'trafficFelony',
        type: 'string',
      },
      {
        header: 'trafficMisdemeanor',
        type: 'string',
      },
      {
        header: 'violentCrimeFelony',
        type: 'string',
      },
      {
        header: 'violentCrimeMisdemeanor',
        type: 'string',
      },
      {
        header: 'weaponsFelony',
        type: 'string',
      },
      {
        header: 'weaponsMisdemeanor',
        type: 'string',
      },
      {
        header: 'registeredSexOffender',
        type: 'string',
      },
      {
        header: 'globalSanctions',
        type: 'string',
      },
      {
        header: 'applicantsInsufficientIncome',
        type: 'string',
      },
      {
        header: 'applicantsCreditScoreApproved',
        type: 'string',
      },
      {
        header: 'applicantsCreditScoreDeclined',
        type: 'string',
      },
      {
        header: 'applicantsCreditScoreBetween',
        type: 'string',
      },
      {
        header: 'applicantsNoEstablishedCredit',
        type: 'string',
      },
      {
        header: 'applicantsBankruptcy',
        type: 'string',
      },
      {
        header: 'applicantsForeclosure',
        type: 'string',
      },
      {
        header: 'applicantsLegalItem',
        type: 'string',
      },
      {
        header: 'applicantsTaxLien',
        type: 'string',
      },
      {
        header: 'applicantsPropertyDebt',
        type: 'string',
      },
      {
        header: 'applicantsMortgageDebt',
        type: 'string',
      },
      {
        header: 'applicantsUtilityDebt',
        type: 'string',
      },
      {
        header: 'applicantsEvictionOrEvictionFiling',
        type: 'string',
      },
      {
        header: 'applicantsExcessiveIssues',
        type: 'string',
      },
      {
        header: 'applicantsSsnSuspicious',
        type: 'string',
      },
      {
        header: 'guarantorsInsufficientIncome',
        type: 'string',
      },
      {
        header: 'guarantorsCreditScoreApproved',
        type: 'string',
      },
      {
        header: 'guarantorsCreditScoreDeclined',
        type: 'string',
      },
      {
        header: 'guarantorsCreditScoreBetween',
        type: 'string',
      },
      {
        header: 'guarantorsNoEstablishedCredit',
        type: 'string',
      },
      {
        header: 'guarantorsBankruptcy',
        type: 'string',
      },
      {
        header: 'guarantorsForeclosure',
        type: 'string',
      },
      {
        header: 'guarantorsLegalItem',
        type: 'string',
      },
      {
        header: 'guarantorsTaxLien',
        type: 'string',
      },
      {
        header: 'guarantorsPropertyDebt',
        type: 'string',
      },
      {
        header: 'guarantorsMortgageDebt',
        type: 'string',
      },
      {
        header: 'guarantorsUtilityDebt',
        type: 'string',
      },
      {
        header: 'guarantorsEvictionOrEvictionFiling',
        type: 'string',
      },
      {
        header: 'guarantorsExcessiveIssues',
        type: 'string',
      },
      {
        header: 'guarantorsSsnSuspicious',
        type: 'string',
      },
    ],
  },
  PropertyPartySettings: {
    workbookSheetName: 'Property-Party Settings',
    columns: [
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'partyType',
        type: 'string',
      },
      {
        header: 'screeningCriteria',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
    foreignKeys: ['property', 'screeningCriteria'],
  },
  ProgramReferences: {
    workbookSheetName: 'Program references',
    columns: [
      {
        header: 'parentProgram',
        type: 'string',
      },
      {
        header: 'referenceProgram',
        type: 'string',
      },
    ],
    foreignKeys: ['parentProgram', 'referenceProgram'],
  },
  MarketingLayoutGroups: {
    workbookSheetName: 'Marketing Layout Groups',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'order',
        type: 'number',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'shortDisplayName',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
    ],
  },
  MarketingLayouts: {
    workbookSheetName: 'Marketing Layouts',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'order',
        type: 'number',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'marketingLayoutGroup',
        type: 'string',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
    foreignKeys: ['property', 'marketingLayoutGroup'],
  },
  MarketingAssets: {
    workbookSheetName: 'Marketing Assets',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'type',
        type: 'string',
      },
      {
        header: 'url',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'displayDescription',
        type: 'string',
      },
      {
        header: 'altTag',
        type: 'string',
      },
    ],
  },
  Lifestyle: {
    workbookSheetName: 'Lifestyles',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'order',
        type: 'number',
      },
      {
        header: 'description',
        type: 'string',
      },
      {
        header: 'infographic',
        type: 'string',
      },
    ],
    foreignKeys: ['property'],
  },
  MarketingSearch: {
    workbookSheetName: 'Marketing Search',
    columns: [
      {
        header: 'order',
        type: 'number',
      },
      {
        header: 'entryMatch',
        type: 'string',
      },
      {
        header: 'scope',
        type: 'string',
      },
      {
        header: 'stateScope',
        type: 'string',
      },
      {
        header: 'cityScope',
        type: 'string',
      },
      {
        header: 'url',
        type: 'string',
      },
      {
        header: 'queryStringFlag',
        type: 'boolean',
      },
      {
        header: 'inactiveFlag',
        type: 'boolean',
      },
    ],
  },
  IntegrationSettings: {
    workbookSheetName: 'Integration Settings',
    columns: [
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'import\ninventoryState',
        type: 'boolean',
      },
      {
        header: 'import\ninventoryAvailabilityDate',
        type: 'boolean',
      },
      {
        header: 'import\nresidentData',
        type: 'boolean',
      },
      {
        header: 'import\nunitPricing',
        type: 'boolean',
      },
      {
        header: 'import\namenities',
        type: 'boolean',
      },
      {
        header: 'export\nnewLease',
        type: 'boolean',
      },
      {
        header: 'export\nrenewalLease',
        type: 'boolean',
      },
      {
        header: 'lease\nbmAutoESignatureRequest',
        type: 'boolean',
      },
    ],
  },
  RxpSettings: {
    workbookSheetName: 'Rxp Settings',
    columns: [
      {
        header: 'property',
        type: 'string',
      },
      {
        header: 'app\nid',
        type: 'string',
      },
      {
        header: 'app\nname',
        type: 'string',
      },
      {
        header: 'app\nscheme',
        type: 'string',
      },
      {
        header: 'app\nappStoreUrl',
        type: 'string',
      },
      {
        header: 'app\nplayStoreUrl',
        type: 'string',
      },
      {
        header: 'app\nallowAccess',
        type: 'boolean',
      },
      {
        header: 'loginFlow\nline1',
        type: 'string',
      },
      {
        header: 'loginFlow\nline2',
        type: 'string',
      },
      {
        header: 'loginFlow\nline3',
        type: 'string',
      },
      {
        header: 'loginFlow\nhideLogo',
        type: 'boolean',
      },
      {
        header: 'features\npaymentModule',
        type: 'boolean',
      },
      {
        header: 'features\nmaintenanceModule',
        type: 'boolean',
      },
      {
        header: 'app\nautoInvite',
        type: 'boolean',
      },
    ],
  },
  LeaseTemplates: {
    workbookSheetName: 'Lease Templates',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'category',
        type: 'string',
      },
      {
        header: 'displayName',
        type: 'string',
      },
      {
        header: 'manuallySelectedFlag',
        type: 'boolean',
      },
      {
        header: 'sandboxTemplateId',
        type: 'string',
      },
      {
        header: 'prodTemplateId',
        type: 'string',
      },
    ],
  },
  PartyCohorts: {
    workbookSheetName: 'Party Cohorts',
    columns: [
      {
        header: 'name',
        type: 'string',
      },
      {
        header: 'description',
        type: 'string',
      },
    ],
  },
};

export const getSheetNames = workbookSheets => workbookSheets.map(sheet => sheet.workbookSheetName);
export const getColumnHeaders = columns => columns && columns.map(column => column.header || column);
