/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const DALTables = {
  Tables: {
    USERS: 'Users',
    PERSON_MESSAGE: 'PersonMessage',
    PERSON_RELATIONSHIP: 'PersonRelationship',
    PERSON_TO_PERSON_COMMUNICATION: 'PersonToPersonCommunication',
  },
  TableColumns: {
    USERS: {
      ID: 'id',
      EMAIL: 'email',
      ROOMMATE_PROFILE: 'roommateProfile',
      UPDATED_AT: 'updated_at',
    },
    ROOMMATE_PROFILE: [
      'fullName',
      'preferredName',
      'moveInDateFrom',
      'moveInDateTo',
      'gender',
      'age',
      'collegeYear',
      'academicMajor',
      'preferLiveWith',
      'likeKeepApartment',
      'normallyWakeUp',
      'normallyGoBed',
      'likeStudyIn',
      'likeHaveGatheringsInApartment',
      'preferPetFreeApartment',
      'shouldKnowAboutMe',
      'isActive',
    ],
    ROOMMATE_PROFILE_REQUIRED_FIELDS: [
      'fullName',
      'preferredName',
      'moveInDateFrom',
      'moveInDateTo',
      'gender',
      'age',
      'collegeYear',
      'preferLiveWith',
      'likeKeepApartment',
      'normallyWakeUp',
      'normallyGoBed',
    ],
    ROOMMATE: {
      ID: 'id',
      IS_ACTIVE: 'isActive',
    },
  },
};
