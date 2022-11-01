CREATE OR REPLACE FUNCTION db_namespace.getweakmatches("firstNameParam" character varying, "lastNameParam" character varying)
 RETURNS TABLE(id uuid, person jsonb, rank double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF "lastNameParam" IS NULL OR "lastNameParam" = '' THEN
    RETURN QUERY
      SELECT "personId", "personObject", GREATEST(public.similarity("firstNameParam", "firstName")::float, public.similarity("firstNameParam", "lastName")::float) AS rank
        FROM db_namespace."PersonSearch"
      WHERE "personObject"->>'personType' <> 'employee'
      AND COALESCE("personObject"->>'mergedWith', '') = ''
      AND (public.similarity("firstNameParam", "firstName") >= 0.5 OR public.similarity("firstNameParam", "lastName") >= 0.5);
  ELSE
    RETURN QUERY
      SELECT "personId", "personObject",
        CASE WHEN (lower("firstNameParam") = lower("firstName") and lower("lastNameParam") = lower("lastName")) OR
                    (lower("firstNameParam") = lower("lastName") and lower("lastNameParam") = lower("firstName"))) THEN 10
        -- as per PM request exact matches should appear on top of the list, hence the greater number
        else public.similarity("firstNameParam", "firstName")::float
        end AS rank
        FROM db_namespace."PersonSearch"
      WHERE "personObject"->>'personType' <> 'employee'
      AND COALESCE("personObject"->>'mergedWith', '') = ''
      AND ((public.similarity("firstNameParam", "firstName") >= 0.5 AND public.difference("lastNameParam", "lastName") = 4) OR
            (public.similarity("lastNameParam", "firstName") >= 0.5 AND public.difference("firstNameParam", "lastName") = 4));
      --  The difference function converts two strings to their Soundex codes and then reports the number of matching code positions.
      --  Since Soundex codes have four characters, the result ranges from zero to four, with zero being no match and four being an exact match.
      END IF;
    END;
$function$
