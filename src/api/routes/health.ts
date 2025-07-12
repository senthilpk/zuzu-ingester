import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

const healthRoute = new OpenAPIHono();

const HealthResponseSchema = z.object({
	status: z.enum(["healthy", "unhealthy"]),
	timestamp: z.string(),
});

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
