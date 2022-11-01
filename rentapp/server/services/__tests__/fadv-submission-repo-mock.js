/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const getSubmissionRequests = () => [
  {
    created_at: '7:59 AM 6/6/2016',
    id: 'befd9472-8e20-4d71-a39a-1de38f309b85',
    partyApplicationId: '1fe091bc-988b-494c-bfad-33896b5e8fdf',
    rentData: { rent: 2500 },
    applicantData: {
      applicants: [{ lastName: 'Bell', firstName: 'Roy' }],
    },
  },
  {
    created_at: '7:55 AM 6/6/2016',
    id: '6c305c90-8252-42c8-ba95-3641ba84c02a',
    partyApplicationId: '1fe091bc-988b-494c-bfad-33896b5e8fdf',
    rentData: { rent: 3800 },
    applicantData: {
      applicants: [
        { lastName: 'Bell', firstName: 'Roy' },
        { lastName: 'Henderson', firstName: 'Kimberly' },
      ],
    },
  },
  {
    created_at: '7:51 AM 6/6/2016',
    id: 'e04824dd-24d1-412c-9452-e8120c11d425',
    partyApplicationId: '1fe091bc-988b-494c-bfad-33896b5e8fdf',
    rentData: { rent: 2000 },
    applicantData: {
      applicants: [{ lastName: 'Bell', firstName: 'Roy' }],
    },
  },
  {
    created_at: '7:47 AM 6/6/2016',
    id: '9c2f1455-0191-4432-be67-2c561905358f',
    partyApplicationId: '1fe091bc-988b-494c-bfad-33896b5e8fdf',
    rentData: { rent: 2700 },
    applicantData: {
      applicants: [{ lastName: 'Bell', firstName: 'Roy' }],
    },
  },
  {
    created_at: '7:43 AM 6/6/2016',
    id: '08c25032-a50c-4f90-8802-9c4e132df3a8',
    partyApplicationId: '1fe091bc-988b-494c-bfad-33896b5e8fdf',
    rentData: { rent: 2900 },
    applicantData: {
      applicants: [{ lastName: 'Bell', firstName: 'Roy' }],
    },
  },
];

export const emptySubmissionRequests = () => [];

export const emptySubmissionResponses = () => [];
