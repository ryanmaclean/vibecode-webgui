#!/usr/bin/env bash
# Stop or terminate an AWS code-server workspace instance.

set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
PROFILE_OPT=${AWS_PROFILE:+--profile $AWS_PROFILE}
INSTANCE_NAME=${INSTANCE_NAME:-codeserver-dev}
TERMINATE=${TERMINATE:-false}

INSTANCE_ID=$(aws ec2 describe-instances --region "$REGION" $PROFILE_OPT \
  --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running,stopped" \
  --query 'Reservations[].Instances[].InstanceId' --output text | head -n1 || true)

if [[ -z "$INSTANCE_ID" ]]; then
  echo "No instance found for tag Name=$INSTANCE_NAME"
  exit 0
fi

echo "Stopping instance $INSTANCE_ID"
aws ec2 stop-instances --region "$REGION" $PROFILE_OPT --instance-ids "$INSTANCE_ID" >/dev/null

echo "Instance stopped."

if [[ "$TERMINATE" == "true" ]]; then
  echo "Terminating instance $INSTANCE_ID (EBS volumes preserved unless DeleteOnTermination=true)."
  aws ec2 terminate-instances --region "$REGION" $PROFILE_OPT --instance-ids "$INSTANCE_ID" >/dev/null
fi
