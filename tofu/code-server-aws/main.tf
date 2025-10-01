terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# AWS Code-Server Cloud Deployment
# Creates ECS Fargate Spot tasks with EFS for affordable developer workspaces

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC and Networking
resource "aws_vpc" "codeserver" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.environment}-codeserver-vpc"
    Environment = var.environment
  }
}

resource "aws_internet_gateway" "codeserver" {
  vpc_id = aws_vpc.codeserver.id

  tags = {
    Name        = "${var.environment}-codeserver-igw"
    Environment = var.environment
  }
}

resource "aws_subnet" "public" {
  count = length(data.aws_availability_zones.available.names)

  vpc_id                  = aws_vpc.codeserver.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone        = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.environment}-codeserver-public-${count.index + 1}"
    Environment = var.environment
    Type        = "Public"
  }
}

resource "aws_subnet" "private" {
  count = length(data.aws_availability_zones.available.names)

  vpc_id            = aws_vpc.codeserver.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "${var.environment}-codeserver-private-${count.index + 1}"
    Environment = var.environment
    Type        = "Private"
  }
}

# Route tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.codeserver.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.codeserver.id
  }

  tags = {
    Name        = "${var.environment}-codeserver-public-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# NAT Gateway for private subnets
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? length(aws_subnet.public) : 0

  domain = "vpc"

  tags = {
    Name        = "${var.environment}-codeserver-nat-eip-${count.index + 1}"
    Environment = var.environment
  }
}

resource "aws_nat_gateway" "codeserver" {
  count = var.enable_nat_gateway ? length(aws_subnet.public) : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name        = "${var.environment}-codeserver-nat-${count.index + 1}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.codeserver]
}

resource "aws_route_table" "private" {
  count = var.enable_nat_gateway ? length(aws_subnet.private) : 0

  vpc_id = aws_vpc.codeserver.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.codeserver[count.index].id
  }

  tags = {
    Name        = "${var.environment}-codeserver-private-rt-${count.index + 1}"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "private" {
  count = var.enable_nat_gateway ? length(aws_subnet.private) : 0

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Security Groups
resource "aws_security_group" "codeserver" {
  name_prefix = "${var.environment}-codeserver-"
  vpc_id      = aws_vpc.codeserver.id

  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-codeserver-sg"
    Environment = var.environment
  }
}

# EFS File System for persistent storage
resource "aws_efs_file_system" "codeserver" {
  creation_token = "${var.environment}-codeserver-efs"
  encrypted       = true

  tags = {
    Name        = "${var.environment}-codeserver-efs"
    Environment = var.environment
  }
}

resource "aws_efs_mount_target" "codeserver" {
  count = length(aws_subnet.private)

  file_system_id  = aws_efs_file_system.codeserver.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.efs.id]
}

resource "aws_security_group" "efs" {
  name_prefix = "${var.environment}-codeserver-efs-"
  vpc_id      = aws_vpc.codeserver.id

  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.codeserver.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-codeserver-efs-sg"
    Environment = var.environment
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "codeserver" {
  name = "${var.environment}-codeserver-cluster"

  tags = {
    Name        = "${var.environment}-codeserver-cluster"
    Environment = var.environment
  }
}

resource "aws_ecs_cluster_capacity_providers" "codeserver" {
  cluster_name = aws_ecs_cluster.codeserver.name

  capacity_providers = ["FARGATE_SPOT", "FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight           = 100
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "codeserver" {
  family                   = "${var.environment}-codeserver"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "codeserver"
      image = var.container_image
      
      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "PASSWORD"
          value = var.codeserver_password
        },
        {
          name  = "USER"
          value = "coder"
        }
      ]

      mountPoints = [
        {
          sourceVolume  = "workspace"
          containerPath = "/home/coder/workspace"
          readOnly      = false
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.codeserver.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "ecs"
        }
      }

      essential = true
    }
  ])

  volume {
    name = "workspace"

    efs_volume_configuration {
      file_system_id          = aws_efs_file_system.codeserver.id
      root_directory          = "/workspace"
      transit_encryption      = "ENABLED"
      transit_encryption_port = 2049
    }
  }

  tags = {
    Name        = "${var.environment}-codeserver-task"
    Environment = var.environment
  }
}

# ECS Service
resource "aws_ecs_service" "codeserver" {
  name            = "${var.environment}-codeserver-service"
  cluster         = aws_ecs_cluster.codeserver.id
  task_definition = aws_ecs_task_definition.codeserver.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.codeserver.id]
    assign_public_ip = false
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight           = 100
  }

  depends_on = [aws_efs_mount_target.codeserver]

  tags = {
    Name        = "${var.environment}-codeserver-service"
    Environment = var.environment
  }
}

# Application Load Balancer
resource "aws_lb" "codeserver" {
  name               = "${var.environment}-codeserver-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = {
    Name        = "${var.environment}-codeserver-alb"
    Environment = var.environment
  }
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.environment}-codeserver-alb-"
  vpc_id      = aws_vpc.codeserver.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-codeserver-alb-sg"
    Environment = var.environment
  }
}

resource "aws_lb_target_group" "codeserver" {
  name        = "${var.environment}-codeserver-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.codeserver.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/healthz"
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }

  tags = {
    Name        = "${var.environment}-codeserver-tg"
    Environment = var.environment
  }
}

resource "aws_lb_listener" "codeserver" {
  load_balancer_arn = aws_lb.codeserver.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.codeserver.arn
  }
}

# Attach target group to ECS service
resource "aws_lb_target_group_attachment" "codeserver" {
  count = var.desired_count

  target_group_arn = aws_lb_target_group.codeserver.arn
  target_id        = aws_ecs_service.codeserver.id
  port             = 8080
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "codeserver" {
  name              = "/ecs/${var.environment}-codeserver"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.environment}-codeserver-logs"
    Environment = var.environment
  }
}

# EventBridge Scheduler for automated start/stop
resource "aws_scheduler_schedule" "codeserver_start" {
  count = var.enable_scheduling ? 1 : 0

  name       = "${var.environment}-codeserver-start"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = var.schedule_cron

  target {
    arn      = aws_ecs_service.codeserver.id
    role_arn = aws_iam_role.scheduler[0].arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.codeserver.arn
      launch_type         = "FARGATE"
      network_configuration {
        subnets          = aws_subnet.private[*].id
        security_groups  = [aws_security_group.codeserver.id]
        assign_public_ip = false
      }
    }
  }

}
