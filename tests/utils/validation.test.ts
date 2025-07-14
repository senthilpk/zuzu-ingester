import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ValidationService } from "../../src/utils/validation";
import { z } from "zod";

describe("ValidationService", () => {
	it("should validate data against a Zod schema", () => {
		const schema = z.object({ name: z.string() });
		const data = { name: "John" };
		const result = ValidationService.validate(schema, data);
		expect(result).toEqual(data);
	});

	it("should throw an error if validation fails", () => {
		const schema = z.object({ name: z.string() });
		const data = { name: 123, age: "senth" };
		expect(() => ValidationService.validate(schema, data)).toThrow();
	});
});
