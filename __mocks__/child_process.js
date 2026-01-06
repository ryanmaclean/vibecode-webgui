/**
 * Mock for child_process module used in Docker tests
 * Simulates Docker command outputs without requiring actual Docker daemon
 */

const { EventEmitter } = require('events');

// Mock data for different Docker commands
const mockDockerResponses = {
  // Docker version check
  'docker --version': { stdout: 'Docker version 24.0.0, build abcd123\n', stderr: '' },
  'docker info': {
    stdout: `Server:
 Containers: 5
 Running: 3
 Paused: 0
 Stopped: 2
 Images: 10
 Server Version: 24.0.0
 Storage Driver: overlay2
 Logging Driver: json-file
 Cgroup Driver: cgroupfs
 Plugins:
  Volume: local
  Network: bridge host ipvlan macvlan null overlay
`,
    stderr: ''
  },

  // Docker compose version checks
  'docker-compose --version': { stdout: 'docker-compose version 2.20.0\n', stderr: '' },
  'docker compose version': { stdout: 'Docker Compose version v2.20.0\n', stderr: '' },

  // Docker compose config
  'docker-compose config': {
    stdout: `services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://vibecode:password@postgres:5432/vibecode_dev
      REDIS_URL: redis://redis:6379
    image: vibecode/webgui:latest
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "3000"
      target: 3000
  db:
    environment:
      POSTGRES_DB: vibecode_dev
      POSTGRES_PASSWORD: password
      POSTGRES_USER: vibecode
    healthcheck:
      interval: 10s
      retries: 5
      test: pg_isready -U vibecode
      timeout: 5s
    image: pgvector/pgvector:pg15
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "5432"
      target: 5432
    volumes:
    - postgres_data:/var/lib/postgresql/data
  redis:
    healthcheck:
      interval: 10s
      retries: 5
      test: redis-cli ping
      timeout: 5s
    image: valkey/valkey:7-alpine
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "6379"
      target: 6379
    volumes:
    - redis_data:/data
  websocket:
    environment:
      NODE_ENV: development
      REDIS_URL: redis://redis:6379
    image: node:20-alpine
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "3001"
      target: 3001
  code-server:
    image: vibecode/code-server:latest
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "8080"
      target: 8080
    volumes:
    - code_server_data:/home/coder
networks:
  vibecode-network:
    driver: bridge
    name: vibecode-webgui_vibecode-network
volumes:
  code_server_data:
    driver: local
  postgres_data:
    driver: local
  redis_data:
    driver: local
`,
    stderr: ''
  },
  'docker compose config': {
    stdout: `services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://vibecode:password@postgres:5432/vibecode_dev
      REDIS_URL: redis://redis:6379
    image: vibecode/webgui:latest
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "3000"
      target: 3000
  db:
    environment:
      POSTGRES_DB: vibecode_dev
      POSTGRES_PASSWORD: password
      POSTGRES_USER: vibecode
    healthcheck:
      interval: 10s
      retries: 5
      test: pg_isready -U vibecode
      timeout: 5s
    image: pgvector/pgvector:pg15
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "5432"
      target: 5432
    volumes:
    - postgres_data:/var/lib/postgresql/data
  redis:
    healthcheck:
      interval: 10s
      retries: 5
      test: redis-cli ping
      timeout: 5s
    image: valkey/valkey:7-alpine
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "6379"
      target: 6379
    volumes:
    - redis_data:/data
  websocket:
    environment:
      NODE_ENV: development
      REDIS_URL: redis://redis:6379
    image: node:20-alpine
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "3001"
      target: 3001
  code-server:
    image: vibecode/code-server:latest
    networks:
      vibecode-network: null
    ports:
    - mode: ingress
      published: "8080"
      target: 8080
    volumes:
    - code_server_data:/home/coder
networks:
  vibecode-network:
    driver: bridge
    name: vibecode-webgui_vibecode-network
volumes:
  code_server_data:
    driver: local
  postgres_data:
    driver: local
  redis_data:
    driver: local
`,
    stderr: ''
  },

  // File checks
  'ls -la .env.docker': { stdout: '-rw-r--r--  1 user  staff  1234 Jan  5 12:00 .env.docker\n', stderr: '' },
  'cat Dockerfile': {
    stdout: `FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app
ENV NODE_ENV=production
# Running as nonroot user for security
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["server.js"]
`,
    stderr: ''
  },
  'cat .dockerignore': {
    stdout: `node_modules
.git
*.log
.next
.env*
!.env.docker
.DS_Store
coverage
*.test.js
*.test.ts
`,
    stderr: ''
  },
  'cat fly.toml': {
    stdout: `app = 'vibecode-webgui'
primary_region = 'sjc'

[build]
  dockerfile = 'Dockerfile'

[env]
  NODE_ENV = 'production'

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
`,
    stderr: ''
  },

  // Docker compose ps commands
  'docker-compose ps postgres': {
    stdout: `NAME                            IMAGE                    COMMAND                  SERVICE    CREATED         STATUS                   PORTS
vibecode-webgui-postgres-1      pgvector/pgvector:pg15   "docker-entrypoint.s…"   postgres   10 minutes ago   Up 10 minutes (healthy)   0.0.0.0:5432->5432/tcp
`,
    stderr: ''
  },
  'docker compose ps postgres': {
    stdout: `NAME                            IMAGE                    COMMAND                  SERVICE    CREATED         STATUS                   PORTS
vibecode-webgui-postgres-1      pgvector/pgvector:pg15   "docker-entrypoint.s…"   postgres   10 minutes ago   Up 10 minutes (healthy)   0.0.0.0:5432->5432/tcp
`,
    stderr: ''
  },
  'docker-compose ps redis': {
    stdout: `NAME                         IMAGE                  COMMAND                  SERVICE   CREATED         STATUS                   PORTS
vibecode-webgui-redis-1      valkey/valkey:7-alpine "docker-entrypoint.s…"   redis     10 minutes ago   Up 10 minutes (healthy)   0.0.0.0:6379->6379/tcp
`,
    stderr: ''
  },
  'docker compose ps redis': {
    stdout: `NAME                         IMAGE                  COMMAND                  SERVICE   CREATED         STATUS                   PORTS
vibecode-webgui-redis-1      valkey/valkey:7-alpine "docker-entrypoint.s…"   redis     10 minutes ago   Up 10 minutes (healthy)   0.0.0.0:6379->6379/tcp
`,
    stderr: ''
  },

  // Docker compose ps with JSON format
  'docker-compose ps --format json': {
    stdout: `{"Name":"vibecode-webgui-postgres-1","State":"running","Status":"Up 10 minutes (healthy)"}
{"Name":"vibecode-webgui-redis-1","State":"running","Status":"Up 10 minutes (healthy)"}
{"Name":"vibecode-webgui-app-1","State":"running","Status":"Up 10 minutes"}
`,
    stderr: ''
  },
  'docker compose ps --format json': {
    stdout: `{"Name":"vibecode-webgui-postgres-1","State":"running","Status":"Up 10 minutes (healthy)"}
{"Name":"vibecode-webgui-redis-1","State":"running","Status":"Up 10 minutes (healthy)"}
{"Name":"vibecode-webgui-app-1","State":"running","Status":"Up 10 minutes"}
`,
    stderr: ''
  },

  // PostgreSQL commands
  'docker exec vibecode-webgui-postgres-1 psql -U vibecode -d vibecode_dev -c "SELECT version();"': {
    stdout: `                                                 version
---------------------------------------------------------------------------------------------------------
 PostgreSQL 15.3 (Debian 15.3-1.pgdg110+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 10.2.1-6) 10.2.1 20210110, 64-bit
(1 row)
`,
    stderr: ''
  },
  'docker exec vibecode-webgui-postgres-1 psql -U vibecode -d vibecode_dev -c "\\dt"': {
    stdout: `                    List of relations
 Schema |      Name       | Type  |   Owner
--------+-----------------+-------+-----------
 public | users           | table | vibecode
 public | projects        | table | vibecode
 public | files           | table | vibecode
 public | sessions        | table | vibecode
 public | ai_interactions | table | vibecode
 public | deployments     | table | vibecode
 public | collaborators   | table | vibecode
(7 rows)
`,
    stderr: ''
  },
  'docker exec vibecode-webgui-postgres-1 psql -U vibecode -d vibecode_dev -c "\\di"': {
    stdout: `                         List of relations
 Schema |         Name         | Type  |  Owner   |    Table
--------+----------------------+-------+----------+--------------
 public | idx_users_email      | index | vibecode | users
 public | idx_projects_owner   | index | vibecode | projects
 public | idx_files_project    | index | vibecode | files
(3 rows)
`,
    stderr: ''
  },
  'docker exec vibecode-webgui-postgres-1 pg_isready -U vibecode': {
    stdout: '/var/run/postgresql:5432 - accepting connections\n',
    stderr: ''
  },

  // Redis commands
  'docker exec vibecode-webgui-redis-1 redis-cli ping': {
    stdout: 'PONG\n',
    stderr: ''
  },
  'docker exec vibecode-webgui-redis-1 redis-cli set test_key "test_value"': {
    stdout: 'OK\n',
    stderr: ''
  },
  'docker exec vibecode-webgui-redis-1 redis-cli get test_key': {
    stdout: '"test_value"\n',
    stderr: ''
  },
  'docker exec vibecode-webgui-redis-1 redis-cli del test_key': {
    stdout: '(integer) 1\n',
    stderr: ''
  },
  'docker exec vibecode-webgui-redis-1 redis-cli set perf_test "performance_value"': {
    stdout: 'OK\n',
    stderr: ''
  },
  'docker exec vibecode-webgui-redis-1 redis-cli get perf_test': {
    stdout: '"performance_value"\n',
    stderr: ''
  },
  'docker exec vibecode-webgui-redis-1 redis-cli del perf_test': {
    stdout: '(integer) 1\n',
    stderr: ''
  },

  // Network commands
  'docker network ls': {
    stdout: `NETWORK ID     NAME                               DRIVER    SCOPE
abc123def456   bridge                             bridge    local
def456ghi789   host                               host      local
ghi789jkl012   vibecode-webgui_vibecode-network   bridge    local
`,
    stderr: ''
  },
  'docker network ls --format "{{.Name}}"': {
    stdout: `bridge
host
none
vibecode-webgui_vibecode-network
`,
    stderr: ''
  },

  // Docker stats
  'docker stats --no-stream --format "{{.Container}},{{.CPUPerc}},{{.MemUsage}}"': {
    stdout: `vibecode-webgui-postgres-1,2.45%,128.5MiB / 2GiB
vibecode-webgui-redis-1,0.12%,12.3MiB / 2GiB
vibecode-webgui-app-1,5.67%,256.7MiB / 2GiB
`,
    stderr: ''
  },
  'docker stats --no-stream --format "{{.Container}},{{.MemPerc}}"': {
    stdout: `vibecode-webgui-postgres-1,6.28%
vibecode-webgui-redis-1,0.62%
vibecode-webgui-app-1,12.84%
`,
    stderr: ''
  },

  // Docker compose logs
  'docker-compose logs --tail=5 postgres': {
    stdout: `postgres_1  | 2024-01-05 12:00:00.000 UTC [1] LOG:  database system is ready to accept connections
postgres_1  | 2024-01-05 12:00:01.000 UTC [1] LOG:  autovacuum launcher started
`,
    stderr: ''
  },
  'docker compose logs --tail=5 postgres': {
    stdout: `postgres_1  | 2024-01-05 12:00:00.000 UTC [1] LOG:  database system is ready to accept connections
postgres_1  | 2024-01-05 12:00:01.000 UTC [1] LOG:  autovacuum launcher started
`,
    stderr: ''
  },
  'docker-compose logs --tail=5 redis': {
    stdout: `redis_1  | 1:C 05 Jan 2024 12:00:00.000 # Server initialized
redis_1  | 1:M 05 Jan 2024 12:00:00.000 * Ready to accept connections
`,
    stderr: ''
  },
  'docker compose logs --tail=5 redis': {
    stdout: `redis_1  | 1:C 05 Jan 2024 12:00:00.000 # Server initialized
redis_1  | 1:M 05 Jan 2024 12:00:00.000 * Ready to accept connections
`,
    stderr: ''
  },
  'docker-compose logs --tail=5 web': {
    stdout: `web_1  | Server started on port 3000
web_1  | Database connected successfully
`,
    stderr: ''
  },
  'docker compose logs --tail=5 web': {
    stdout: `web_1  | Server started on port 3000
web_1  | Database connected successfully
`,
    stderr: ''
  },
  'docker-compose logs --tail=5 websocket': {
    stdout: `websocket_1  | WebSocket server started on port 3001
websocket_1  | Connected to Redis
`,
    stderr: ''
  },
  'docker compose logs --tail=5 websocket': {
    stdout: `websocket_1  | WebSocket server started on port 3001
websocket_1  | Connected to Redis
`,
    stderr: ''
  },
  'docker-compose logs --tail=20': {
    stdout: `postgres_1  | 2024-01-05 12:00:00.000 UTC [1] LOG:  database system is ready to accept connections
redis_1  | 1:M 05 Jan 2024 12:00:00.000 * Ready to accept connections
web_1  | Server started on port 3000
`,
    stderr: ''
  },
  'docker compose logs --tail=20': {
    stdout: `postgres_1  | 2024-01-05 12:00:00.000 UTC [1] LOG:  database system is ready to accept connections
redis_1  | 1:M 05 Jan 2024 12:00:00.000 * Ready to accept connections
web_1  | Server started on port 3000
`,
    stderr: ''
  },

  // Docker image operations
  'docker image inspect vibecode/code-server:latest': {
    stdout: JSON.stringify([{
      Id: 'sha256:abc123def456',
      RepoTags: ['vibecode/code-server:latest'],
      Size: 1234567890,
      Created: '2024-01-05T12:00:00.000000000Z'
    }]),
    stderr: ''
  },

  // Code-server extension list
  'code-server --list-extensions': {
    stdout: `continue.continue
codeium.codeium
saoudrizwan.claude-dev
aider.aider-vscode
usernamehw.errorlens
streetsidesoftware.code-spell-checker
wayou.vscode-todo-highlight
gruntfuggly.todo-tree
pkief.material-icon-theme
oderwat.indent-rainbow
christian-kohler.path-intellisense
mtxr.sqltools
mtxr.sqltools-driver-pg
ms-azuretools.vscode-docker
ms-kubernetes-tools.vscode-kubernetes-tools
humao.rest-client
yzhang.markdown-all-in-one
davidanson.vscode-markdownlint
ms-python.python
ms-python.vscode-pylance
ms-python.black-formatter
ms-vscode.vscode-typescript-next
ms-vscode.vscode-eslint
ms-vscode-remote.remote-ssh
ms-vscode-remote.remote-containers
`,
    stderr: ''
  },

  // LSP server checks
  'which pylsp': { stdout: '/usr/local/bin/pylsp\n', stderr: '' },
  'which typescript-language-server': { stdout: '/usr/local/bin/typescript-language-server\n', stderr: '' },
  'which rust-analyzer': { stdout: '/usr/local/bin/rust-analyzer\n', stderr: '' },
  'which gopls': { stdout: '/usr/local/bin/gopls\n', stderr: '' },
  'which bash-language-server': { stdout: '/usr/local/bin/bash-language-server\n', stderr: '' },
  'which dockerfile-language-server-nodejs': { stdout: '/usr/local/bin/dockerfile-language-server-nodejs\n', stderr: '' },

  // Database query commands
  'docker exec vibecode-webgui-postgres-1 psql -U vibecode -d vibecode_dev -c "SELECT COUNT(*) FROM users;"': {
    stdout: ` count
-------
    42
(1 row)
`,
    stderr: ''
  },

  // Kubectl commands for KIND integration tests
  'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.phase}"': {
    stdout: 'Running',
    stderr: ''
  },
  'kubectl get deployment vibecode-docs -n vibecode -o jsonpath="{.spec.replicas}"': {
    stdout: '2',
    stderr: ''
  },
  'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.conditions[?(@.type==\\"Ready\\")].status}"': {
    stdout: 'True',
    stderr: ''
  },
  'kubectl get svc vibecode-docs-service -n vibecode -o jsonpath="{.metadata.name}"': {
    stdout: 'vibecode-docs-service',
    stderr: ''
  },
  'kubectl get hpa vibecode-docs-hpa -n vibecode -o jsonpath="{.metadata.name}"': {
    stdout: 'vibecode-docs-hpa',
    stderr: ''
  },
  'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.conditions[?(@.type==\\"ContainersReady\\")].status}"': {
    stdout: 'True',
    stderr: ''
  },
  'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[0].spec.securityContext.runAsNonRoot}"': {
    stdout: 'true',
    stderr: ''
  },
  'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[0].spec.containers[0].securityContext.readOnlyRootFilesystem}"': {
    stdout: 'true',
    stderr: ''
  },
};

// Handle dynamic commands with regex patterns
function getResponseForCommand(command) {
  // Trim the command to handle whitespace variations
  const trimmedCommand = command.trim();

  // Direct match first
  if (mockDockerResponses[trimmedCommand]) {
    return mockDockerResponses[trimmedCommand];
  }

  // Also try without extra internal whitespace
  const normalizedCommand = trimmedCommand.replace(/\s+/g, ' ');
  if (mockDockerResponses[normalizedCommand]) {
    return mockDockerResponses[normalizedCommand];
  }

  // Handle docker compose up
  if (command.match(/docker(-| )compose up -d/)) {
    return { stdout: 'Creating network "vibecode-webgui_vibecode-network" with driver "bridge"\nCreating volume "vibecode-webgui_postgres_data" with driver "local"\nCreating vibecode-webgui-postgres-1 ... done\nCreating vibecode-webgui-redis-1 ... done\n', stderr: '' };
  }

  // Handle docker compose down
  if (command.match(/docker(-| )compose down/)) {
    return { stdout: 'Stopping vibecode-webgui-postgres-1 ... done\nStopping vibecode-webgui-redis-1 ... done\nRemoving vibecode-webgui-postgres-1 ... done\nRemoving vibecode-webgui-redis-1 ... done\n', stderr: '' };
  }

  // Handle docker compose restart
  if (command.match(/docker(-| )compose restart redis/)) {
    return { stdout: 'Restarting vibecode-webgui-redis-1 ... done\n', stderr: '' };
  }

  // Handle docker compose stop/start
  if (command.match(/docker(-| )compose stop redis/)) {
    return { stdout: 'Stopping vibecode-webgui-redis-1 ... done\n', stderr: '' };
  }
  if (command.match(/docker(-| )compose start redis/)) {
    return { stdout: 'Starting vibecode-webgui-redis-1 ... done\n', stderr: '' };
  }

  // Handle docker compose exec commands
  if (command.includes('docker-compose exec -T web') || command.includes('docker compose exec -T web')) {
    return { stdout: '1 packets transmitted, 1 received, 0% packet loss\n', stderr: '' };
  }
  if (command.includes('nslookup postgres')) {
    return { stdout: 'Server:\t\t127.0.0.11\nAddress:\t127.0.0.11#53\n\nNon-authoritative answer:\nName:\tpostgres\nAddress: 172.20.0.2\n', stderr: '' };
  }

  // Handle docker run commands
  if (command.match(/docker run -d --name code-server-test-\d+/)) {
    return { stdout: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz\n', stderr: '' };
  }

  // Handle docker stop/rm commands
  if (command.match(/docker stop code-server-test-\d+/)) {
    return { stdout: command.match(/code-server-test-\d+/)[0] + '\n', stderr: '' };
  }
  if (command.match(/docker rm code-server-test-\d+/)) {
    return { stdout: command.match(/code-server-test-\d+/)[0] + '\n', stderr: '' };
  }

  // Handle docker exec on dynamic containers
  if (command.match(/docker exec code-server-test-\d+ code-server --list-extensions/)) {
    return mockDockerResponses['code-server --list-extensions'];
  }
  if (command.match(/docker exec code-server-test-\d+ which/)) {
    const whichCmd = command.match(/which (\S+)/)[0];
    return mockDockerResponses[whichCmd] || { stdout: '/usr/local/bin/' + command.match(/which (\S+)/)[1] + '\n', stderr: '' };
  }

  // Handle SELECT queries with dynamic query_id
  if (command.match(/SELECT \d+ as query_id/)) {
    const queryId = command.match(/SELECT (\d+)/)[1];
    return { stdout: ` query_id
----------
        ${queryId}
(1 row)
`, stderr: '' };
  }

  // Handle sleep command
  if (command === 'sleep 3') {
    return { stdout: '', stderr: '' };
  }

  // Handle kubectl commands with pattern matching
  if (command.includes('kubectl get pods') && command.includes('status.phase')) {
    return { stdout: 'Running', stderr: '' };
  }
  if (command.includes('kubectl get deployment') && command.includes('.spec.replicas')) {
    return { stdout: '2', stderr: '' };
  }
  if (command.includes('kubectl get pods') && command.includes('Ready')) {
    return { stdout: 'True', stderr: '' };
  }
  if (command.includes('kubectl get svc vibecode-docs-service')) {
    return { stdout: 'vibecode-docs-service', stderr: '' };
  }
  if (command.includes('kubectl get hpa vibecode-docs-hpa')) {
    return { stdout: 'vibecode-docs-hpa', stderr: '' };
  }
  if (command.includes('kubectl get pods') && command.includes('ContainersReady')) {
    return { stdout: 'True', stderr: '' };
  }
  if (command.includes('kubectl get pods') && command.includes('runAsNonRoot')) {
    return { stdout: 'true', stderr: '' };
  }
  if (command.includes('kubectl get pods') && command.includes('readOnlyRootFilesystem')) {
    return { stdout: 'true', stderr: '' };
  }

  // Default response for unknown commands
  return { stdout: '', stderr: 'Command not mocked: ' + command };
}

// Mock execSync
const execSync = jest.fn((command, options) => {
  const response = getResponseForCommand(command);

  if (response.stderr && !options?.stdio?.includes('pipe')) {
    throw new Error(response.stderr);
  }

  if (options?.encoding === 'utf-8' || options?.stdio === 'pipe') {
    return response.stdout;
  }

  return Buffer.from(response.stdout);
});

// Mock exec (callback version)
const exec = jest.fn((command, options, callback) => {
  // Handle both (command, callback) and (command, options, callback)
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  const response = getResponseForCommand(command);

  // Simulate async behavior
  process.nextTick(() => {
    if (response.stderr && response.stderr.includes('Command not mocked')) {
      callback(new Error(response.stderr), response.stdout, response.stderr);
    } else {
      callback(null, response.stdout, response.stderr);
    }
  });

  // Return a mock ChildProcess
  const mockProcess = new EventEmitter();
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.stdin = new EventEmitter();
  mockProcess.stdin.end = jest.fn();

  return mockProcess;
});

// Mock promisify-compatible version
exec.__promisify__ = jest.fn(async (command, options = {}) => {
  const response = getResponseForCommand(command);

  if (response.stderr && response.stderr.includes('Command not mocked')) {
    throw new Error(response.stderr);
  }

  return {
    stdout: response.stdout,
    stderr: response.stderr
  };
});

// Mock spawn for port-forward and other long-running processes
const spawn = jest.fn((command, args, options) => {
  const mockProcess = new EventEmitter();
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.stdin = new EventEmitter();
  mockProcess.stdin.end = jest.fn();
  mockProcess.kill = jest.fn();
  mockProcess.pid = 12345;

  // Simulate successful spawn
  process.nextTick(() => {
    mockProcess.emit('spawn');
  });

  return mockProcess;
});

module.exports = {
  exec,
  execSync,
  spawn,
  execFile: jest.fn(),
  fork: jest.fn(),
};
