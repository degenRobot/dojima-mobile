import { Hono } from "hono";
import { graphql } from "ponder";
import { db } from "ponder:api";
import schema from "ponder:schema";

const app = new Hono();

// Configure GraphQL endpoint
app.use("/graphql", graphql({ db, schema }));
app.use("/", graphql({ db, schema }));

export default app;