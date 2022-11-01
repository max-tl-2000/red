@QuoteDraft_TitleSection @Regression @Integration @Sanity @Smoke @Ignore
Feature: Quote Draft - Title section show unit info
        CPM-29: The following story points will be covered in this feature file:
               - #1 Unit state and address
               - #2 Display a default picture for now
               - #4 Quote expiration

Background:
  Given    The user opened a 'party prospect details' page with guest:
   | guest |
   | Foo   |
  And    User Filtered units by number of bedrooms

@TODO @Positive @Core
Scenario: CPM-29: #1 Unit state and address
  When    Clicks on QUOTE link to any Unit result
  Then    'Title' section of the 'Quotes details' page should be displayed on screen
  And     'Ready now' state should be displayed in the 'Title' section
  And     Unit linked to a building should include both 'Unit' Name and 'Building' Name in the 'Title' section
  And     Unit linked to a property should include both 'Unit' Name and 'Property' Name in the 'Title' section

@TODO @Positive @Core
Scenario: CPM-29: #2 Display a default picture for now.
  When    Clicks on QUOTE link to any Unit result
  Then    'Title' section of the 'Quotes details' page should be displayed on screen
  And     A default picture should be displayed in the 'Title' section

@TODO @Positive @Core
Scenario: CPM-29: #4 Quote expiration
  When    Clicks on QUOTE link to any Unit result
  Then    'Title' section of the 'Quotes details' page should be displayed on screen
  And     A 'Quote expiration' text in 'read-only' mode should be displayed in the 'Title' section
