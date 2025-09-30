# GenAI with PostgreSQL and Datadog Demo

This demo showcases how to monitor GenAI workloads using PostgreSQL with pgvector and Datadog. It includes:

- Storing and querying vector embeddings
- Performing similarity searches
- Implementing Retrieval-Augmented Generation (RAG)
- Monitoring performance with Datadog

## Prerequisites

1. Node.js 18+
2. Docker and Docker Compose
3. PostgreSQL 15+ with pgvector
4. OpenAI API key
5. Datadog API key (optional for monitoring)

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd vibecode-webgui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://vibecode:password@localhost:5432/vibecode"
   
   # OpenAI
   OPENAI_API_KEY=your-openai-api-key
   
   # Datadog (optional)
   DD_API_KEY=your-datadog-api-key
   DD_SITE=datadoghq.com
   ```

## Running the Demo

1. Start the database:
   ```bash
   docker-compose up -d db
   ```

2. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```

3. Run the demo script:
   ```bash
   cd demo
   npx ts-node genai-workflow.ts
   ```

## Monitoring with Datadog

1. Enable PostgreSQL integration in Datadog
2. Import the provided dashboard:
   ```bash
   # Install Datadog CLI
   npm install -g @datadog/datadog-ci
   
   # Import dashboard
   datadog-ci dashboards push --source monitoring/datadog/
   ```

## Key Features Demonstrated

1. **Vector Embeddings**: Store and query document embeddings
2. **Similarity Search**: Find similar documents using vector similarity
3. **RAG**: Implement Retrieval-Augmented Generation
4. **Monitoring**: Track performance with Datadog

## Troubleshooting

- Ensure PostgreSQL is running and accessible
- Verify your OpenAI API key is valid
- Check Datadog agent logs for monitoring issues
- For performance issues, check the database indexes and query plans

## Cleanup

To stop and remove all containers:

```bash
docker-compose down -v
```

## License

MIT
