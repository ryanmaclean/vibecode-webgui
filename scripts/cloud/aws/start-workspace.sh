#!/usr/bin/env bash
# Start (or create) an AWS EC2 Spot instance for code-server with an attached EBS volume.
# Requires aws CLI configured with appropriate IAM permissions.

set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
PROFILE_OPT=${AWS_PROFILE:+--profile $AWS_PROFILE}
INSTANCE_NAME=${INSTANCE_NAME:-codeserver-dev}
LAUNCH_TEMPLATE=${LAUNCH_TEMPLATE:-codeserver-template}
VOLUME_ID=${VOLUME_ID:-}
INSTANCE_TYPE=${INSTANCE_TYPE:-t4g.small}
AMI_ID=${AMI_ID:-}
SECURITY_GROUP_IDS=${SECURITY_GROUP_IDS:-}
SUBNET_ID=${SUBNET_ID:-}
KEY_NAME=${KEY_NAME:-}
SPOT_PRICE=${SPOT_PRICE:-}

INSTANCE_ID=$(aws ec2 describe-instances \
  --region "$REGION" $PROFILE_OPT \
  --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running,stopped" \
  --query 'Reservations[].Instances[].InstanceId' --output text | head -n1 || true)

if [[ -n "$INSTANCE_ID" ]]; then
  echo "Starting existing instance $INSTANCE_ID ($INSTANCE_NAME)"
  aws ec2 start-instances --region "$REGION" $PROFILE_OPT --instance-ids "$INSTANCE_ID" >/dev/null
  exit 0
fi

echo "Launching new spot instance for $INSTANCE_NAME"

RUN_ARGS=(--region "$REGION" $PROFILE_OPT --instance-type "$INSTANCE_TYPE" --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" --iam-instance-profile Name=${IAM_INSTANCE_PROFILE:-EC2CodeServer} --user-data file://scripts/cloud/aws/user-data.sh)

if [[ -n "$AMI_ID" ]]; then
  RUN_ARGS+=(--image-id "$AMI_ID")
else
  echo "ERROR: AMI_ID not provided" >&2
  exit 1
fi

if [[ -n "$SECURITY_GROUP_IDS" ]]; then
  RUN_ARGS+=(--security-group-ids $SECURITY_GROUP_IDS)
fi

if [[ -n "$SUBNET_ID" ]]; then
  RUN_ARGS+=(--subnet-id "$SUBNET_ID")
fi

if [[ -n "$KEY_NAME" ]]; then
  RUN_ARGS+=(--key-name "$KEY_NAME")
fi

if [[ -n "$VOLUME_ID" ]]; then
  RUN_ARGS+=(--block-device-mappings "[{\"DeviceName\":\"/dev/sdf\",\"Ebs\":{\"VolumeId\":\"$VOLUME_ID\",\"DeleteOnTermination\":false}}]")
fi

if [[ -n "$SPOT_PRICE" ]]; then
  RUN_ARGS+=(--instance-market-options "MarketType=spot,SpotOptions={MaxPrice=$SPOT_PRICE,SpotInstanceType=persistent}")
fi

INSTANCE_ID=$(aws ec2 run-instances "${RUN_ARGS[@]}" --query 'Instances[0].InstanceId' --output text)

echo "Waiting for instance $INSTANCE_ID to reach running state..."
aws ec2 wait instance-running --region "$REGION" $PROFILE_OPT --instance-ids "$INSTANCE_ID"

echo "Instance $INSTANCE_ID running. Attach to ALB or use Session Manager/SSH to reach code-server."
