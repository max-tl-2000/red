@Ignore @Units @Regression @Integration @Sanity @Smoke
Feature: Units
         CPM-203: As a sales agent I want to see and filter units

Background:
  Given    The user opened a party prospect details page with guest:
   | guest |
   | Foo   |
  And    The user clicked the Schedule appointment under '(+)' menu
  And    The 'Add Appointment' dialog should be opened

@TODO
Scenario: CPM-207: As a sales agent, I want to see unit summary - Phase 1
  When   User Filters units by number of bedrooms
  And    Clicks on any Unit result
  Then   'Unit details' page should be displayed
  And    Unit summary information should appear at the top of the page

@TODO
Scenario: CPM-232: The user is able to see the information displayed on Unit description
  When   User Filters units by number of bedrooms
  And    Clicks on any Unit result
  Then   'Unit details' page should be displayed
  And    'Unit description' section should appear under the 'summary' section

@TODO
Scenario: CPM-233: As a sales agent, I want to see unit amenities
  When   User Filters units by number of bedrooms
  And    Clicks on any Unit result
  Then   'Unit details' page should be displayed
  And    Information about 'Amenities' should appear under 'Unit description' section

@TODO
Scenario: CPM-391: As a sales agent, I want to see unit summary - Phase 2
  When   User Filters units by number of bedrooms
  And    Clicks on any Unit result
  Then   'Unit details' page should be displayed
  And    Unit summary information should appears at the top of the page
