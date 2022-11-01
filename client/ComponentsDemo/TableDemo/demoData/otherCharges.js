/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const groups = [
  {
    title: 'Application Fee',
    selectionMode: 'singleSelection',
    selectedValue: null,
    rows: [
      {
        title: 'Application fee',
        description: 'Single',
        amount: 50,
      },
      {
        title: 'Application fee',
        description: 'Couple',
        amount: 80,
      },
      {
        title: 'Co-signer application fee',
        description: '',
        amount: 40,
      },
    ],
  },
  {
    title: 'Deposits and fees',
    rows: [
      {
        mandatory: true,
        title: 'EV fee',
        amount: 100,
      },
      {
        mandatory: true,
        title: 'Pet deposit',
        amount: 300,
      },
      {
        mandatory: true,
        title: 'Unit deposit',
        amount: 1300,
      },
    ],
  },
  {
    title: 'Resident services',
    rows: [
      {
        selected: false,
        title: 'Package delivery',
        amount: 60,
      },
      {
        selected: true,
        title: 'Package holding',
        amount: 50,
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
