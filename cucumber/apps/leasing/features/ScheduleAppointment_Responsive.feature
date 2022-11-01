@Ignore @ScheduleAppointment_Responsive @Regression @Integration @Sanity @Smoke
Feature: Edit an existing appointment Responsive
         CPM-140: As a sales agent, I want to edit or remove an appointment

Background:
  Given   A 'party prospect details' page is opened with one appointment in it
  And     The appointment has no Units or Notes
  And     User clicked on 'Edit' button in the 'appointment' card

@TODO
Scenario: CPM-647: Edit appointment dialog responsive design diplay 2nd window
  When    User clicks the 'Next' button
  Then    The 2nd step 'Edit appointment' window '360px width' should be displayed
  And     Window should contain 'sales agents' drop down
  And     'Sales' drop down should be set to logged agent
  And     Window should contain the calendar
  And     In calendar the time slot for current appointment should be selected
  And     Window should contain 'Done' and 'Back' buttons

@TODO
Scenario: CPM-643: Edit appointment - In Edit dialog filter and add units on small screen
  When    User types three letters in 'Units shorthand or address' field with match in db
  Then    The 'suggestions' window with matching units should be displayed
  And     The units in 'suggestions' window should contain the input letters
  When    The user clicks on a unit from 'suggestions' window
  Then    Selected 'unit' chip should be displayed in the 'Units shorthand or address' field
  When    Clicks on 'done' button in 'appointment' dialog
  Then    The 'appointment' card should contain the unit chip

@TODO
Scenario: CPM-643: Edit appointment - In Edit dialog filter and add guest on small screen
  When    User User types three letters in 'guests' field with match in db
  And     Clicks on a guest from 'suggestions' window
  Then    Selected 'guest' chip should be displayed in the 'guests' field
  When    Clicks on 'done' button in 'appointment' dialog
  Then    The 'appointment' card should contain the new guest

@TODO
Scenario: CPM-643: Edit appointment - In Edit dialog change time slot on small screen
  When    User clicks the 'Next' button
  And     Selects a new 'time' slot
  And     Clicks on 'done' button in 'appointment' dialog
  Then    The 'appointment' card should contain the new time
