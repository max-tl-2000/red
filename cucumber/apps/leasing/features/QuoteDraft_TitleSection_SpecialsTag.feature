@QuoteDraft_TitleSection @Regression @Integration @Sanity @Smoke @Ignore
Feature: Quote Draft - Title section show specials tag on the lease terms
         CPM-1534: The following story points will be covered in this feature file:
            - #3.b Show a specials indicator for applicable lease terms.
            - #6.b “Specials” tag should be displayed for 6, 12 and 24 month term lengths in this dropdown

@TODO @Positive @Core
Scenario: CPM-1534: #6.b “Specials” tag should be displayed for 6, 12 and 24 month term lengths in this dropdown
  Given    The user opened a 'party prospect details' page with guest:
    | guest |
    | Foo   |
  And     User Filtered units by number of bedrooms
  When    Clicks on QUOTE link to any Unit result
  Then    'Title' section of the 'Quotes details' page should be displayed on screen
  When    User clicks on Lease Terms dropdown indicator
  Then    The lease term lengths for '6, 12 and 24' months should have 'Specials' tags
