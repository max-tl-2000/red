/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const DALTypes = {
  Gender: {
    FEMALE: 'Female',
    MALE: 'Male',
    THIRD_GENDER: 'Non Binary / Third gender',
    OTHER_GENDER: 'Prefer to self describe',
  },
  Age: {
    EIGHTEEN_TO_TWENTY: '18-20',
    TWENTY_ONE_TO_TWENTY_THREE: '21-23',
    TWENTY_FOUR_TO_TWENTY_SIX: '24-26',
    TWENTY_SEVEN_TO_THIRTY: '27-30',
    THIRTY_PLUS: '30+',
  },
  CollegeYear: {
    FRESHMAN: 'Freshman',
    SOPHOMORE: 'Sophomore',
    JUNIOR: 'Junior',
    SENIOR: 'Senior',
    HIGHER: 'Graduate or higher',
    NOT_STUDENT: 'Im not a student',
  },
  PreferLiveWith: {
    FEMALE: 'Female',
    MALE: 'Male',
    NO_PREFERENCE: 'No preference',
  },
  LikeKeepApartment: {
    APARTMENT_VERY_CLEAN: 'Very clean',
    APARTMENT_CLEAN: 'About average clean',
    APARTMENT_MESSY: 'Messy but I know where things are',
    APARTMENT_VERY_MESSY: 'Very messy',
  },
  NormallyWakeUp: {
    WAKE_UP_EARLY: 'Early(6 am)',
    WAKE_UP_MODERATELY: 'Moderately early(8 am)',
    WAKE_UP_LATE: 'Late(9 am+)',
  },
  NormallyGoBed: {
    GO_BED_EARLY: 'Early(9 pm)',
    GO_BED_MODERATELY: 'Moderately early(11 pm)',
    GO_BED_LATE: 'Late(Midnight+)',
  },
  LikeStudyIn: {
    MY_APARTMENT: 'My apartment',
    LIBRARY: 'Library',
    OTHER_PLACE_TO_STUDY: 'Coffee shop or somewhere else',
  },
  LikeHaveGatheringsInApartment: {
    GATHERINGS_IN_APARTMENT_ALL_TIME: 'All the time',
    GATHERINGS_IN_APARTMENT_ONCE: 'Once in while',
    GATHERINGS_IN_APARTMENT_EVER: 'Hardly ever',
  },
  PreferPetFreeApartment: {
    YES: 'Yes',
    NO: 'No',
  },
  AppId: 'roommates',
  PersonRelationshipStatus: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
  },
  PersonMessageStatus: {
    SENT: 'sent',
    PENDING: 'pending',
    REJECTED: 'rejected',
    PERMANENTFAILURE: 'permanentFailure',
    SUCCESS: 'success',
  },
  PersonMessageType: {
    SMS: 'sms',
    EMAIL: 'email',
  },
};

export const PerformAction = {
  CREATE: 'create',
  UPDATE: 'update',
};
