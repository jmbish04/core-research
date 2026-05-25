import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/backend/db/schema.ts", "./src/backend/db/schemas/*.ts"],
  out: "./drizzle",
});
