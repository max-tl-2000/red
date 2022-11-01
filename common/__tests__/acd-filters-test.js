/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Immutable from 'immutable';
import { expect } from 'chai';
import { employeesSelectorData } from '../employee-selectors/selector-data-dashboard';
import { getUsersAndTeamsForForwardComm } from '../employee-selectors/forward-comm-selector-data';
import { dashboardFilterByUser, dashboardFilterByTeam } from '../acd/filters';

describe('acd-filters-tests', () => {
  describe('U1 - logged in user; U2 - the second user', () => {
    describe('1 - U1 is the only user in team T1', () => {
      const users = [
        {
          id: '1',
          teams: [
            {
              id: '1',
              displayName: 'T1',
              mainRoles: ['LA'],
            },
          ],
        },
      ];
      const usersMap = users.map(user => [user.id, user]);

      describe('1.1 - filter data for Employee Selector', () => {
        it('1.1 - should contain U1 and T1', () => {
          const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
          expect(filterData.users.length).to.equal(1);
          expect(filterData.teams.length).to.equal(1);
        });
      });
      describe('1.2 - when filtering the Dashboard by U1', () => {
        it('1.2 - filter data should contain U1 and T1', () => {
          const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
          expect(filterData.users.sort()).to.deep.equal(['1']);
          expect(filterData.teams.sort()).to.deep.equal(['1']);
        });
      });
      describe('1.3 - when filtering the Dashboard by T1', () => {
        it('1.2 - filter data should contain U1 and T1', () => {
          const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
          expect(filterData.users.sort()).to.deep.equal(['1']);
          expect(filterData.teams.sort()).to.deep.equal(['1']);
        });
      });
    });

    describe('2 - U1 and U2 share the same team (T1)', () => {
      describe('2.1 - when U1 and U2 have the same escalation value', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('2.1.1 - filter data for Employee Selector', () => {
          it('2.1.1 - should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
          });
        });
        describe('2.1.2 - when filtering the Dashboard by U1', () => {
          it('2.1.2 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('2.1.3 - when filtering the Dashboard by U2', () => {
          it('2.1.3 - filter data should contain one user (U2) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('2.1.4 - when filtering the Dashboard by T1', () => {
          it('2.1.4 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
      });

      describe('2.2 - when U2 has lower escalation value', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('2.2.1 - filter data for Employee Selector', () => {
          it('2.2.1 - should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
          });
        });
        describe('2.2.2 - when filtering the Dashboard by U1', () => {
          it('2.2.2 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('2.2.3 - when filtering the Dashboard by U2', () => {
          it('2.2.3 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('2.2.4 - when filtering the Dashboard by T1', () => {
          it('2.2.4 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
      });

      describe('2.3 - when U2 has higher escalation value', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('2.3.1 - filter data for Employee Selector', () => {
          it('2.3.1 - should contain one user (U1) and one team (T1)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
          });
        });
        describe('2.3.2 - when filtering the Dashboard by U1', () => {
          it('2.3.2 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('2.3.4 - when filtering the Dashboard by T1', () => {
          it('2.3.4 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
      });
    });

    describe('3 - U1 belongs to two teams (T1 and T2) and U2 belongs to one team (T1)', () => {
      describe('3.1 - U1 and U2 have the same escalation value in T1', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('3.1.1 - filter data for Employee Selector', () => {
          it('3.1.1 - should contain two users (U1 and U2) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('3.1.2 - when filtering the Dashboard by U1', () => {
          it('3.1.2 - filter data should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('3.1.3 - when filtering the Dashboard by U2', () => {
          it('3.1.3 - filter data should contain one user (U2) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('3.1.4 - when filtering the Dashboard by T1', () => {
          it('3.1.4 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('3.1.4 - when filtering the Dashboard by T2', () => {
          it('3.1.4 - filter data should contain one user (U1) and one team (T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });

      describe('3.2 - U2 has lower escalation value that U1 in T1', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('3.2.1 - filter data for Employee Selector', () => {
          it('3.2.1 - should contain two users (U1 and U2) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('3.2.2 - when filtering the Dashboard by U1', () => {
          it('3.2.2 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('3.2.3 - when filtering the Dashboard by U2', () => {
          it('3.2.3 - filter data should contain one user (U2) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('3.2.4 - when filtering the Dashboard by T1', () => {
          it('3.2.4 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('3.2.5 - when filtering the Dashboard by T2', () => {
          it('3.2.5 - filter data should contain one user (U1) and one team (T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });

      describe('3.3 - U2 has higher escalation value that U1 in T1', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('3.2.1 - filter data for Employee Selector', () => {
          it('3.2.1 - should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('3.2.2 - when filtering the Dashboard by U1', () => {
          it('3.2.2 - filter data should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('3.2.3 - when filtering the Dashboard by T1', () => {
          it('3.2.3 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('3.2.3 - when filtering the Dashboard by T2', () => {
          it('3.2.3 - filter data should contain one user (U1) and one team (T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });
    });

    describe('4 - U1 and U2 belongs to the same two teams (T1 and T2)', () => {
      describe('4.1 - U1 and U2 have the same escalation value in both teams', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('4.1.1 - filter data for Employee Selector', () => {
          it('4.1.1 - should contain two users (U1 and U2) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('4.1.2 - when filtering the Dashboard by U1', () => {
          it('4.1.2 - filter data should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('4.1.3 - when filtering the Dashboard by U2', () => {
          it('4.1.3 - filter data should contain one user (U2) and two teams (T1 and T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('4.1.4 - when filtering the Dashboard by T1', () => {
          it('4.1.4 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('4.1.5 - when filtering the Dashboard by T2', () => {
          it('4.1.5 - filter data should contain two users (U1 and U2) and one team (T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });

      describe('4.2 - U2 has lower escalation value than U1 in both teams', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('4.2.1 - filter data for Employee Selector', () => {
          it('4.2.1 - should contain two users (U1 and U2) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('4.2.2 - when filtering the Dashboard by U1', () => {
          it('4.2.2 - filter data should contain one user () and one team', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('4.2.3 - when filtering the Dashboard by U2', () => {
          it('4.2.3 - filter data should contain one user () and one team', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('4.2.3 - when filtering the Dashboard by T1', () => {
          it('4.2.4 - filter data should contain one user and one team', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('4.2.5 - when filtering the Dashboard by T2', () => {
          it('4.2.5 - filter data should contain one user and one team', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });

      describe('4.3 - U2 has higher escalation value than U1 in both teams', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('4.3.1 - filter data for Employee Selector', () => {
          it('4.3.1 - should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('4.3.2 - when filtering the Dashboard by U1', () => {
          it('4.3.2 - filter data should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('4.3.3 - when filtering the Dashboard by T1', () => {
          it('4.3.3 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('4.3.4 - when filtering the Dashboard by T2', () => {
          it('4.3.4 - filter data should contain one user (U1) and one team (T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });

      describe('4.4 - U2 has lower escalation value than U1 in T1 and higher escalation value in T2', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('4.4.1 - filter data for Employee Selector', () => {
          it('4.4.1 - should contain two users (U1 and U2) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('4.4.2 - when filtering the Dashboard by U1', () => {
          it('4.4.2 - filter data should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('4.4.3 - when filtering the Dashboard by U2', () => {
          it('4.4.3 - filter data should contain one user (U2) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('4.4.4 - when filtering the Dashboard by T1', () => {
          it('4.4.4 - filter data should contain one user (T1) and two teams (T1 and T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('4.4.5 - when filtering the Dashboard by T2', () => {
          it('4.4.5 - filter data should contain one user and one team', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });

      describe('4.5 - U2 has higher escalation value than U1 in T1 and lower escalation value in T2', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('4.5.1 - filter data for Employee Selector', () => {
          it('4.5.1 - should contain two users (U1 and U2) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('4.5.2 - when filtering the Dashboard by U1', () => {
          it('4.5.2 - filter data should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('4.5.3 - when filtering the Dashboard by U2', () => {
          it('4.5.3 - filter data should contain one user (U2) and one team (T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
        describe('4.5.4 - when filtering the Dashboard by T1', () => {
          it('4.5.4 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('4.5.5 - when filtering the Dashboard by T2', () => {
          it('4.5.5 - filter data should contain two users (U1 and U2) and one team (T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });
    });

    describe('5 - U1 belongs to one team (T1) and U2 belongs to two teams (T1 and T2)', () => {
      describe('5.1 - U1 and U2 have the same escalation value in T1', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('5.1.1 - filter data for Employee Selector', () => {
          it('5.1.1 - should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
          });
        });
        describe('5.1.2 - when filtering the Dashboard by U1', () => {
          it('5.1.2 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('5.1.3 - when filtering the Dashboard by U2', () => {
          it('5.1.3 - filter data should contain one user (U2) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('5.1.4 - when filtering the Dashboard by T1', () => {
          it('5.1.4 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
      });

      describe('5.2 - U2 has lower escalation value that U1 in T1', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('5.2.1 - filter data for Employee Selector', () => {
          it('5.2.1 - should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.users[1].id).to.equal(users[1].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
          });
        });
        describe('5.2.2 - when filtering the Dashboard by U1', () => {
          it('5.2.2 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('5.2.3 - when filtering the Dashboard by U2', () => {
          it('5.2.3 - filter data should contain one user (U2) and one team (T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('5.2.4 - when filtering the Dashboard by T1', () => {
          it('5.2.4 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
      });

      describe('5.3 - U2 has higher escalation value that U1 in T1', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('5.3.1 - filter data for Employee Selector', () => {
          it('5.3.1 - should contain one user (U1) and one team (T1)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
          });
        });
        describe('5.3.2 - when filtering the Dashboard by U1', () => {
          it('5.3.2 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('5.3.3 - when filtering the Dashboard by T1', () => {
          it('5.3.3 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
      });
    });

    describe('6 - U1 belongs to one team (T1) and U2 belongs to another team (T2)', () => {
      describe('6.1 - U1 and U2 have the same escalataion value', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('6.1.1 - filter data for Employee Selector', () => {
          it('6.1.1 - should contain one user (U1) and one team (T1)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
          });
        });
        describe('6.1.2 - when filtering the Dashboard by user', () => {
          it('6.1.2 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('6.1.3 - when filtering the Dashboard by team', () => {
          it('6.1.3 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
      });

      describe('6.2 - U2 has lower escalation value', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('6.2.1 - filter data for Employee Selector', () => {
          it('6.2.1 - should contain one user (U1) and one team (T1)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
          });
        });
        describe('6.2.2 - when filtering the Dashboard by user', () => {
          it('6.2.2 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('6.2.3 - when filtering the Dashboard by team', () => {
          it('6.2.3 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
      });

      describe('6.3 - U2 has higher escalation value', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LM'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('6.3.1 - filter data for Employee Selector', () => {
          it('6.3.1 - should contain two users (U1) and one team (T1)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
          });
        });
        describe('6.3.2 - when filtering the Dashboard by user', () => {
          it('6.3.2 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('6.3.3 - when filtering the Dashboard by team', () => {
          it('6.3.3 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
      });
    });

    describe('7 - U1 belongs to two teams (T1 and T2) and U2 belongs to two teams (T1 and T3)', () => {
      describe('7.1 - when U1 and U2 have the same escalation value in T1', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '3',
                displayName: 'T3',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('7.1.1 - filter data for Employee Selector', () => {
          it('7.1.1 - should contain two users (U1 and U2) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.users[1].id).to.equal(users[1].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('7.1.2 - when filtering the Dashboard by U1', () => {
          it('7.1.2 - filter data should contain one user (U1) and two teams (T1 and T2) ', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('7.1.3 - when filtering the Dashboard by T1', () => {
          it('7.1.3 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('7.1.4 - when filtering the Dashboard by T2', () => {
          it('7.1.4 - filter data should contain one user (U1) and one team (T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });

      describe('7.2 - when U2 has lower escalation value in T1', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '3',
                displayName: 'T3',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('7.2.1 - filter data for Employee Selector', () => {
          it('7.2.1 - should contain two users (U1 and U2) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.users[1].id).to.equal(users[1].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('7.2.2 - when filtering the Dashboard by U2', () => {
          it('7.2.2 - filter data should contain one user (U2) and one team (T1)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('7.2.3 - when filtering the Dashboard by T1', () => {
          it('7.2.3 - filter data should contain two users (U1 and U2) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(2);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users.sort()).to.deep.equal(['1', '2']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('7.2.4 - when filtering the Dashboard by T2', () => {
          it('7.2.4 - filter data should contain one user (U1) and one team (T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });

      describe('7.3 - when U2 has higher escalation value in T1', () => {
        const users = [
          {
            id: '1',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LA'],
              },
              {
                id: '2',
                displayName: 'T2',
                mainRoles: ['LA'],
              },
            ],
          },
          {
            id: '2',
            teams: [
              {
                id: '1',
                displayName: 'T1',
                mainRoles: ['LM'],
              },
              {
                id: '3',
                displayName: 'T3',
                mainRoles: ['LA'],
              },
            ],
          },
        ];
        const usersMap = users.map(user => [user.id, user]);
        describe('7.3.1 - filter data for Employee Selector', () => {
          it('7.3.1 - should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users[0].id).to.equal(users[0].id);
            expect(filterData.teams[0].id).to.equal(users[0].teams[0].id);
            expect(filterData.teams[1].id).to.equal(users[0].teams[1].id);
          });
        });
        describe('7.3.2 - when filtering the Dashboard by U1', () => {
          it('7.3.2 - filter data should contain one user (U1) and two teams (T1 and T2)', () => {
            const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(2);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams.sort()).to.deep.equal(['1', '2']);
          });
        });
        describe('7.3.3 - when filtering the Dashboard by T1', () => {
          it('7.3.3 - filter data should contain one user (U1) and one team (T1)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['1']);
          });
        });
        describe('7.3.4 - when filtering the Dashboard by T2', () => {
          it('7.3.4 - filter data should contain one user (U1) and one team (T2)', () => {
            const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '2');
            expect(filterData.users.length).to.equal(1);
            expect(filterData.teams.length).to.equal(1);
            expect(filterData.users).to.deep.equal(['1']);
            expect(filterData.teams).to.deep.equal(['2']);
          });
        });
      });
    });

    describe('8 - U1 has no role set', () => {
      const users = [
        {
          id: '1',
          teams: [
            {
              id: '1',
              displayName: 'T1',
              mainRoles: [],
            },
          ],
        },
      ];
      const usersMap = users.map(user => [user.id, user]);

      describe('8.1 - filter data for Employee Selector', () => {
        it('8.1 - should contain U1 and T1', () => {
          const filterData = employeesSelectorData(new Immutable.Map(usersMap), users[0]);
          expect(filterData.users.length).to.equal(1);
          expect(filterData.teams.length).to.equal(1);
        });
      });
      describe('8.2 - when filtering the Dashboard by U1', () => {
        it('8.2 - filter data should contain U1 and T1', () => {
          const filterData = dashboardFilterByUser(users[0], new Immutable.Map(usersMap), '1');
          expect(filterData.users.sort()).to.deep.equal(['1']);
          expect(filterData.teams.sort()).to.deep.equal(['1']);
        });
      });
      describe('8.3 - when filtering the Dashboard by T1', () => {
        it('8.3 - filter data should contain U1 and T1', () => {
          const filterData = dashboardFilterByTeam(users[0], new Immutable.Map(usersMap), '1');
          expect(filterData.users.sort()).to.deep.equal(['1']);
          expect(filterData.teams.sort()).to.deep.equal(['1']);
        });
      });
    });
  });

  describe('getUsersAndTeamsForForwardComm', () => {
    it('should return an object with keys: { suggestedTeams, suggestedUsers, allUsers, allTeams }', () => {
      expect(getUsersAndTeamsForForwardComm()).to.have.all.keys('suggestedTeams', 'suggestedUsers', 'allUsers', 'allTeams');
    });

    it('should return all teams and party teams as suggested teams', () => {
      const party = {
        teams: ['team-id-1', 'team-id-2'],
        collaborators: [],
        userId: 'userId',
      };
      const allTeams = new Immutable.Map([{ id: 'team-id-1' }, { id: 'team-id-2' }, { id: 'team-id-3' }].map(t => [t.id, t]));

      const allUsers = new Immutable.Map([]);
      const { suggestedTeams, allTeams: allTeamsRes } = getUsersAndTeamsForForwardComm(allUsers, allTeams, party, {});
      expect(suggestedTeams).to.deep.equal([{ id: 'team-id-1' }, { id: 'team-id-2' }]);
      expect(allTeamsRes).to.deep.equal(allTeams.toArray());
    });

    it('should return all active users and party users as suggested users, except current user', () => {
      const party = {
        collaborators: ['user-id-1', 'user-id-3', 'current-user'],
        userId: 'party-user',
        teams: [],
      };
      const user1 = { id: 'user-id-1', teams: [], teamIds: ['team-id-1'] };
      const user2 = { id: 'user-id-2', teams: [], teamIds: ['team-id-2'] };
      const inactiveUser = { id: 'user-id-3', teams: [], teamIds: [] };
      const currentUser = { id: 'current-user', teams: [], teamIds: ['team-id-1'] };
      const partyUser = { id: 'party-user', teams: [], teamIds: ['team-id-1'] };

      const allUsers = new Immutable.Map([user1, user2, inactiveUser, currentUser, partyUser].map(t => [t.id, t]));

      const allTeams = new Immutable.Map([]);
      const { suggestedUsers, allUsers: allUsersRes } = getUsersAndTeamsForForwardComm(allUsers, allTeams, party, currentUser);

      expect(suggestedUsers).to.deep.equal([user1, partyUser]);
      expect(allUsersRes).to.deep.equal([user1, user2, partyUser]);
    });
  });
});
