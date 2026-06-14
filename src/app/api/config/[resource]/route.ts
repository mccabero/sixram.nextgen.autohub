import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  ConfigServiceError,
  createConfigResource,
  isConfigResourceKey,
  listConfigResource,
} from "@/server/config/reference-data";

export const runtime = "nodejs";

type ConfigResourceContext = {
  params: Promise<{
    resource: string;
  }>;
};

export async function GET(request: Request, context: ConfigResourceContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { resource } = await context.params;

  if (!isConfigResourceKey(resource)) {
    return notFound();
  }

  return legacyJson(
    await listConfigResource(resource, new URL(request.url).searchParams),
  );
}

export async function POST(request: Request, context: ConfigResourceContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { resource } = await context.params;

  if (!isConfigResourceKey(resource)) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    return legacyJson(
      await createConfigResource(resource, body, authorization.user.userId),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ConfigServiceError) {
      return legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
