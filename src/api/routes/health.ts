import { OpenAPIHono } from "@hono/zod-openapi";
import { HealthResponseSchema } from "../schemas";

const healthRoute = new OpenAPIHono();

const healthResponse = {
	content: {
		"application/json": {
			schema: HealthResponseSchema,
		},
	},
	description: "Health check response",
};

healthRoute.openapi(
	{
		method: "get",
		path: "/health",
		responses: {
			200: healthResponse,
		},
		tags: ["Health"],
		summary: "Health check",
		description: "Check if the service is healthy",
	},
	(c) => {
		return c.json({
			status: "healthy" as const,
			timestamp: new Date().toISOString(),
		});
	},
);

export default healthRoute;
