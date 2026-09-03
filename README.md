# DocVault

Self-hosted document vault with search and AI-grounded answers over your
team's files. Next.js (frontend + backend), PostgreSQL + pgvector for
storage and vector search, MinIO for file storage, Ollama for local
embeddings, Redis + BullMQ for background jobs, and Groq (with OpenRouter as
fallback) for AI answers. Everything runs locally via Docker Compose — nothing
leaves your machine.

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Bun](https://bun.sh/) (for local development and running the Prisma CLI outside Docker)

## Getting Started

1. Copy the example environment file and adjust values as needed:

   ```bash
   cp .env.example .env
   ```

   Note: some ports are remapped from their defaults (Postgres `5433`, MinIO
   `9002`/`9003`, Redis `6380`) to avoid clashing with services commonly
   already running on a dev machine. Adjust in both `.env` and
   `docker-compose.yml` if you'd rather use the defaults.

2. Build and start everything:

   ```bash
   docker compose up --build
   ```

   This starts the app, background worker, Postgres, MinIO, Ollama, and Redis.

3. Pull the embedding model (one-time, ~270MB download):

   ```bash
   docker exec -it $(docker compose ps -q ollama) ollama pull nomic-embed-text
   ```

4. Run database migrations and seed the initial admin account:

   ```bash
   bun install
   bunx prisma migrate deploy
   bunx prisma db seed
   ```

   This creates `admin@docvault.local` / `changeme123` — **change this
   password** (or delete/recreate the user) before using DocVault with real
   documents. There's no self-serve signup; new accounts are created by an
   admin from `/admin/users`.

5. Once running:

   - App: [http://localhost:3000](http://localhost:3000)
   - Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)
   - MinIO console: [http://localhost:9003](http://localhost:9003)

## Local development (without Docker for the app itself)

Run Postgres/MinIO/Ollama/Redis via Docker, and the Next.js app + worker
directly on the host for faster iteration:

```bash
bun install
docker compose up -d postgres minio redis ollama
bunx prisma migrate deploy
bunx prisma db seed
bun run dev      # Next.js app
bun run worker   # background embedding worker, in a separate terminal
```

## Onboarding a new office member

1. An existing admin signs in and opens `/admin/users`.
2. Fill in the new person's name and email, pick their role
   (`viewer` / `editor` / `admin`), and click **Add**. A temporary password
   is shown once — share it with them securely (there's no email delivery
   built in).
3. They sign in at `/login` with that email/password and can start uploading
   from `/upload`.
4. Documents are private to the uploader by default. Share a document with
   specific people (or the whole office) from its detail page.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
# docx
# docx
# docx
# docx
