import { OpenAPIHono } from "@hono/zod-openapi";
import healthRoute from "./api/routes/health";
import processingRoute from "./api/routes/processing";
import { swaggerUI } from "@hono/swagger-ui";

const app = new OpenAPIHono();

// Add routes
app.route("/", healthRoute);
app.route("/api", processingRoute);

// OpenAPI documentation
app.doc("/doc", {
	openapi: "3.0.0",
	info: {
		title: "Review System API",
		version: "0.0.1",
		description: "API for managing hotel reviews from various platforms",
	},
	servers: [
		{
			url: "http://localhost:3000",
			description: "Development server",
		},
	],
});
app.get("/ui", swaggerUI({ url: "/doc" }));

export default app;
