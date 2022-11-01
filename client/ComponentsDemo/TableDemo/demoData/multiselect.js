/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const groups = [
  {
    title: '',
    rows: [
      {
        selected: false,
        title: 'Washer',
        quantity: 1,
        amount: 45,
      },
      {
        selected: false,
        title: 'Dryer',
        quantity: 1,
        amount: 115,
      },
      {
        selected: false,
        title: 'Furniture rental',
        quantity: 1,
        amount: 125,
      },
      {
        selected: false,
        title: 'Single parking',
        quantity: 1,
        amount: 100,
      },
      {
        selected: false,
        title: 'EV parking',
        quantity: 1,
        amount: 150,
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
