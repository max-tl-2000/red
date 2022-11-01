/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const groups = [
  {
    title: 'Complimentary',
    rows: [
      {
        mandatory: true,
        title: 'Covered parking',
        description: 'PK 121',
        quantity: 1,
        amount: 0,
      },
      {
        mandatory: true,
        title: 'Large Storage',
        description: 'D 303',
        quantity: 1,
        amount: 0,
      },
    ],
  },
  {
    title: 'Appliances',
    rows: [
      {
        selected: false,
        title: 'Air conditioner',
        quantity: 1,
        amount: 30,
      },
      {
        selected: false,
        title: 'Dryer',
        quantity: 1,
        amount: 45,
      },
      {
        selected: false,
        title: 'Portable dishwasher',
        quantity: 1,
        amount: 50,
      },
      {
        selected: false,
        title: 'Washer',
        quantity: 1,
        amount: 50,
      },
      {
        selected: false,
        title: 'Washer and Dryer combo',
        quantity: 1,
        amount: 80,
      },
    ],
  },
  {
    title: 'Parking',
    rows: [
      {
        selected: false,
        title: 'Aditional parking',
        quantity: 1,
        amount: 130,
      },
      {
        selected: true,
        title: 'EV Parking',
        quantity: 1,
        amount: 145,
      },
      {
        selected: false,
        title: 'Uncovered parking',
        quantity: 1,
        amount: 100,
      },
    ],
  },
  {
    title: 'Pet',
    rows: [
      {
        selected: true,
        title: "Large pet's rental",
        quantity: 1,
        amount: 45,
      },
      {
        selected: false,
        title: "Small pet's rental",
        quantity: 1,
        amount: 30,
      },
    ],
  },
  {
    title: 'Storage',
    rows: [
      {
        selected: false,
        title: 'Boat slip',
        quantity: 1,
        amount: 30,
      },
      {
        selected: false,
        title: 'Large Storage',
        quantity: 1,
        amount: 45,
      },
      {
        selected: false,
        title: 'Small Storage',
        quantity: 1,
        amount: 35,
      },
      {
        selected: false,
        title: 'Wine locker',
        quantity: 1,
        amount: 20,
      },
    ],
  },
  {
    title: 'Utilities',
    rows: [
      {
        selected: false,
        title: 'Cable TV',
        quantity: 1,
        amount: 30,
      },
      {
        selected: false,
        title: 'Internet Wifi',
        quantity: 1,
        amount: 45,
      },
      {
        mandatory: true,
        title: 'Sewer',
        quantity: 1,
        amount: 15,
      },
      {
        mandatory: true,
        title: 'Trash',
        quantity: 1,
        amount: 10,
      },
      {
        mandatory: true,
        title: 'Water',
        quantity: 1,
        amount: 25,
      },
    ],
  },
];

let count = 0;
groups.forEach(group => {
  group.id = `group_${count}`;
  count++;

  let rowCount = 0;

  group.rows.forEach(row => {
    row.id = `${group.id}_${rowCount}`;
    rowCount++;
  });
});

export default groups;
