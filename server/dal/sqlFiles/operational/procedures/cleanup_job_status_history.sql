CREATE OR REPLACE FUNCTION analytics.cleanup_job_status_history(p_days_to_keep int)
/* USAGE: Delete records from md_detailedJobStatus and md_jobStatus older than 5 days
** SELECT db_namespace.cleanup_job_status_history(5); */
 RETURNS void
 LANGUAGE plpgsql
AS $function$

BEGIN
-- delete detailed logs older than <p_days_to_keep> days
DELETE
FROM analytics."md_detailedJobStatus" AS d
USING analytics."md_jobStatus" AS js
WHERE d."jobStatusId" = js.id
	AND js.created_at < now() - (p_days_to_keep || ' days')::INTERVAL;

-- delete logs older than <p_days_to_keep>  days
DELETE
FROM analytics."md_jobStatus"
WHERE created_at < now() - (p_days_to_keep || ' days')::INTERVAL;
END;

$function$