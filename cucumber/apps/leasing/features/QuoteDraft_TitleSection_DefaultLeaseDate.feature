@QuoteDraft_TitleSection @Regression @Integration @Sanity @Smoke @Ignore
Feature: Quote Draft - Title section show default lease date
         CPM-1536: The following conditions will be covered in this feature file:
                  -IF move-in date range has been provided then default lease start to the move-in from date (starting point of move-in date).
                  -IF move-in date range has not been provided then default lease start to empty value.
                  -IF user returns to this draft in future such that the lease start date is now in the past, then show an error on this field.

Background:
  Given    The user opened a 'party prospect details' page with guest:
   | guest |
   | Foo   |

@TODO @Positive @Core
Scenario: CPM-1536: IF move-in date range has been provided then default lease start to the move-in from date (starting point of move-in date).
  Given   User Filtered units by using move-in from Date
  When    Clicks on QUOTE link to the Unit result '1014'
  Then    'Title' section of the 'Quotes details' page should be displayed on screen
  And     A default Lease Start date is set to the move-in from date.

@TODO @Positive @Core
Scenario: CPM-1536: IF move-in date range has not been provided then default lease start to empty value.
  Given   User does not filtered units by using move-in range
  When    Clicks on QUOTE link to the Unit result '1014'
  Then    'Title' section of the 'Quotes details' page should be displayed on screen
  And     A default Lease Start date is set to empty

@TODO @Positive @Core
Scenario: CPM-1536: IF user returns to this draft in future such that the lease start date is now in the past, then show an error on this field.
  Given   User Filtered units by using move-in from Date in future
  When    Clicks on QUOTE link to any Unit result with lease start date in past
  Then    'Title' section of the 'Quotes details' page should be displayed on screen
  And     The 'Lease Start date' field should display an error message

@TODO @Negative
Scenario: CPM-2042: Lease start date field in past does not show an error when draft in future.
  Given   User Filtered units by using move-in from Date in future
  When    Clicks on QUOTE link to any Unit result with lease start date in past
  Then    'Title' section of the 'Quotes details' page should be displayed on screen
  And     The 'Lease Start date' field shouldn't display an error message
