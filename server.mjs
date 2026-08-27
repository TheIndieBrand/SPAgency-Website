import "dotenv/config";
import express from "express";
import { handler as ssrHandler } from "./dist/server/entry.mjs";

const app = express();
const port = process.env.PORT || 4321;

app.use(express.static("dist/client"));
app.use(ssrHandler);

app.listen(port, () => {
	console.log(`SP Agency listening on http://localhost:${port}`);
});
