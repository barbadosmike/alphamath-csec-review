import {createServer} from "node:http";
import {createApp} from "./app.js";
import {PostgresRepository} from "./postgres-repository.js";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const databaseUrl = process.env.DATABASE_URL;
const apiToken = process.env.ALPHAMATH_API_TOKEN;
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);

if(!databaseUrl) throw new Error("DATABASE_URL is required");
if(!apiToken) throw new Error("ALPHAMATH_API_TOKEN is required");
if(!allowedOrigins.length) throw new Error("ALLOWED_ORIGINS requires at least one origin");

const repository = new PostgresRepository({connectionString: databaseUrl});
const server = createServer(createApp({repository, allowedOrigins, apiToken}));

server.listen(port, host, () => {
  console.log(`AlphaMath evidence API listening at http://${host}:${port}`);
});

async function shutdown(){
  server.close(async () => {
    await repository.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
