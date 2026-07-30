import {readFile, readdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import pg from "pg";

const {Client} = pg;
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(here, "migrations");
const connectionString = process.env.DATABASE_URL;

if(!connectionString){
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({connectionString});
await client.connect();
try{
  const files = (await readdir(migrationsDirectory))
    .filter(file => file.endsWith(".sql"))
    .sort();
  for(const file of files){
    const sql = await readFile(join(migrationsDirectory, file), "utf8");
    await client.query(sql);
    console.log(`Applied ${file}`);
  }
}finally{
  await client.end();
}
