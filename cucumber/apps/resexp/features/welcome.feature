@Regression @Integration @Sanity @Smoke @SkipTenantRefresh
Feature: Welcome Page
         CPM-3267: Verify the resexp welcome page loads correctly

@Positive @Core
Scenario: User tries to open the 'Welcome' page
  When    User opens the 'Welcome' page in resident app
  Then    The 'Welcome' page should be displayed in resident app
