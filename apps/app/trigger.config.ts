import { PrismaInstrumentation } from "@prisma/instrumentation";
import { syncVercelEnvVars } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { puppeteer } from "@trigger.dev/build/extensions/puppeteer";
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
	project: "proj_lhxjliiqgcdyqbgtucda",
	logLevel: "log",
	instrumentations: [new PrismaInstrumentation()],
	maxDuration: 300, // 5 minutes
	build: {
		extensions: [
			prismaExtension({
				schema: "../../packages/db/prisma/schema.prisma",
				version: "6.6.0",
			}),
			puppeteer(),
			syncVercelEnvVars(),
		],
	},
	retries: {
		enabledInDev: true,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	dirs: ["./src/jobs", "./src/trigger"],
});
