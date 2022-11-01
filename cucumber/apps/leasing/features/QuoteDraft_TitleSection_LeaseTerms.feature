# MAM - This test is being ignored because the Background is buggy. When attempting to
# the property and # of bedrooms, each row in the table is executed concurrently
# see CPM-4074
@QuoteDraft_TitleSection @Regression @Integration @Sanity @Smoke @CPM-3591 @Ignore @CPM-4074
Feature: Quote Draft - Title section show lease terms
        CPM-29: The following story points will be covered in this feature file:
                - #5 Select Jan 15th as the lease start date for the purpose of this test scenario.
                - #5 Empty state to Lease Start Date when lease start date is not selected yet
                - #6 Default lease term lengths selection can be configured by the property in admin settings.
                - #6.a Open state of the Lease term(s) dropdown

Background:
  Given    The 'party prospect details' page is already opened with a guest "Paul M.":
  And      User filtered units by number of bedrooms:
   | unit                   | number of bedrooms  |
   | Parkmerced Apartments  | 2                   |
   | The Cove at Tiburon    | 3                   |

@TODO @Positive @Core
Scenario: CPM-29: #5 Select Jan 15th as the lease start date for the purpose of this test scenario.
  When    Clicks on QUOTE link to any Unit result
  Then   'Title' section of the 'Quotes details' page should be displayed on screen
  When    User selects 'Jan 15th' as the lease start date
  Then    A lease start date to 'Jan 15th' should be displayed in dropdown

@TODO @Negative @Core
Scenario: CPM-29: #5 Empty state to Lease Start Date when lease start date is not selected yet.
  When    Clicks on QUOTE link to any Unit result
  Then   'Title' section of the 'Quotes details' page should be displayed on screen
  And     A 'empty' state to Lease Start Date should appears when lease start date is not selected yet

@TODO @Positive @Core
Scenario: CPM-29: #6 Default lease term lengths selection can be configured by the property in admin settings.
  When    Clicks on QUOTE link to any Unit result
  Then   'Title' section of the 'Quotes details' page should be displayed on screen
  And     All Lease term lengths should appear as unselected by default

@TODO @Positive @Core
Scenario: CPM-29: #6.a Open state of the Lease term(s) dropdown.
  Given   The user filtered a Unit that contains all Lease terms
  When    Clicks on QUOTE link to the Unit result '1002'
  Then    'Title' section of the 'Quotes details' page should be displayed on screen
  When    User selects any lease term length
  Then    '6, 9, 12, 15 and 24' month term lengths should be displayed
