@Ignore @Prospects @Regression @Integration @Sanity @Smoke
Feature: Prospects
         CPM-139: As a sales agent, I want to start a prospect by adding a guest

Background:
  Given    The user opened a party prospect details page with guest:
   | guest |
   | Foo   |
  And      Prospect Details view is displayed

@TODO @Positive @Core
Scenario: CPM-144: User can add a new guest from Prospect Details view page
  Given  User clicked on '(+)' menu
  When   Selects the 'Add Guest' option
  Then   'Guest' Dialog should be displayed
  And    User completes all the information in the 'Guest' Dialog
  When   He clicks on 'Done' button
  Then   New Guest should be added and Displayed on Guest list

@TODO @Positive
Scenario: CPM-145: User can view the Summary section from Prospect Details view page
  Given  'Prospect Details' view is displayed
  Then   'Summary' section should display all information about 'Guest'

@TODO @Positive
Scenario: CPM-243: (+) menu is displayed at bottom of the Prospect Details view page
  Given  'Prospect Details' view is displayed
  Then   'Prospect Details' view should display '(+)' Menu at bottom of the page

@TODO @Positive
Scenario: CPM-568: View prospect details page and the unit search section independently scrollable
          This scenario validates if Prospect Details and Unit section can be scrolled independently
  Given  'Prospect Details' view is displayed
  Then   'Prospect Details'/'Unit' sections should be independently scrollable
