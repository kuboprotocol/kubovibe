#!/bin/bash

# 1. Create a job
USER_ID="00419379-1b5d-4be6-a2d0-c3a21a2f8cfd"
JOB_ID=$(psql -Atc "INSERT INTO agent_jobs (user_id, agent_slug, status, input) VALUES ('$USER_ID', 'chat-agent', 'processing', '{\"test\":true}') RETURNING id;" | head -n 1)
echo "Created job: $JOB_ID"

# 2. Call RPC concurrently using psql in background
ACTOR_ID="00000000-0000-0000-0000-000000000000"
CORR_ID="test-corr-$(date +%s)"

echo "Running concurrent actions..."
for i in {1..5}; do
  psql -c "SELECT public.execute_job_action('$JOB_ID', 'pause', '$ACTOR_ID', '$CORR_ID');" &
done

wait
echo "Concurrent actions finished."

# 3. Verify status
STATUS=$(psql -Atc "SELECT status FROM agent_jobs WHERE id = '$JOB_ID';")
echo "Final status: $STATUS"

if [ "$STATUS" == "paused" ]; then
  echo "SUCCESS: Status is paused."
else
  echo "FAILURE: Status is $STATUS"
  exit 1
fi

# 4. Verify audit logs
LOG_COUNT=$(psql -Atc "SELECT count(*) FROM job_audit_logs WHERE job_id = '$JOB_ID' AND action = 'pause';")
echo "Audit logs count: $LOG_COUNT"

if [ "$LOG_COUNT" -ge 1 ]; then
  echo "SUCCESS: Audit logs recorded."
else
  echo "FAILURE: No audit logs found."
  exit 1
fi

# Cleanup
psql -c "DELETE FROM job_audit_logs WHERE job_id = '$JOB_ID';" > /dev/null
psql -c "DELETE FROM agent_jobs WHERE id = '$JOB_ID';" > /dev/null

echo "Verification complete."
