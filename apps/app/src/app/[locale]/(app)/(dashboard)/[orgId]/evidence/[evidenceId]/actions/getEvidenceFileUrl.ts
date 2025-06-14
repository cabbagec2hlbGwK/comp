"use server";

import { authActionClient } from "@/actions/safe-action";
import { env } from "@/env.mjs";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@comp/db";
import { z } from "zod";

if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
	throw new Error("AWS credentials are not set");
}

if (!process.env.AWS_BUCKET_NAME) {
	throw new Error("AWS bucket name is not set");
}

if (!process.env.AWS_REGION) {
	throw new Error("AWS region is not set");
}

const s3Client = new S3Client({
	region: env.AWS_REGION,
	credentials: {
		accessKeyId: env.AWS_ACCESS_KEY_ID,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
	},
});

const schema = z.object({
	evidenceId: z.string(),
	fileUrl: z.string(),
});

function extractS3KeyFromUrl(url: string): string {
	// Try to extract the key using the full URL pattern
	const fullUrlMatch = url.match(/amazonaws\.com\/(.+)$/);
	if (fullUrlMatch?.[1]) {
		return decodeURIComponent(fullUrlMatch[1]);
	}

	// If it's already just the key (not a full URL), use it directly
	if (!url.includes("amazonaws.com")) {
		return url;
	}

	throw new Error("Invalid S3 URL format");
}

export const getEvidenceFileUrl = authActionClient
	.schema(schema)
	.metadata({
		name: "getEvidenceFileUrl",
		track: {
			event: "get-evidence-file-url",
			channel: "server",
		},
	})
	.action(async ({ parsedInput, ctx }) => {
		const { session } = ctx;
		const { evidenceId, fileUrl } = parsedInput;

		if (!session.activeOrganizationId) {
			throw new Error("Not authorized - no organization found");
		}

		try {
			// Check if evidence exists and belongs to organization
			const evidence = await db.evidence.findFirst({
				where: {
					id: evidenceId,
					organizationId: session.activeOrganizationId,
					fileUrls: {
						has: fileUrl,
					},
				},
			});

			if (!evidence) {
				throw new Error("Evidence or file not found");
			}

			try {
				const key = extractS3KeyFromUrl(fileUrl);

				const command = new GetObjectCommand({
					Bucket: process.env.AWS_BUCKET_NAME,
					Key: key,
				});

				const signedUrl = await getSignedUrl(s3Client, command, {
					expiresIn: 3600, // URL expires in 1 hour
				});

				if (!signedUrl) {
					throw new Error("Failed to generate signed URL");
				}

				return { signedUrl };
			} catch (error) {
				console.error("S3 Error:", error);
				throw new Error(
					`Failed to access file: ${error instanceof Error ? error.message : "unknown error"}`,
				);
			}
		} catch (error) {
			console.error("Server Error:", error);
			throw error instanceof Error
				? error
				: new Error("Failed to generate signed URL");
		}
	});
