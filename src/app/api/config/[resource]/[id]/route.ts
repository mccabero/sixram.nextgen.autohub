import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  ConfigServiceError,
  deleteConfigResource,
  getConfigResource,
  isConfigResourceKey,
  updateConfigResource,
} from "@/server/config/reference-data";

export const runtime = "nodejs";

type ConfigResourceItemContext = {
  params: Promise<{
    resource: string;
    id: string;
  }>;
};

export async function GET(request: Request, context: ConfigResourceItemContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { resource, id } = await context.params;
  const itemId = parsePositiveInt(id);

  if (!isConfigResourceKey(resource) || !itemId) {
    return notFound();
  }

  const item = await getConfigResource(resource, itemId);

  return item ? legacyJson(item) : notFound();
}

export async function PUT(request: Request, context: ConfigResourceItemContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { resource, id } = await context.params;
  const itemId = parsePositiveInt(id);

  if (!isConfigResourceKey(resource) || !itemId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    await updateConfigResource(
      resource,
      itemId,
      body,
      authorization.user.userId,
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ConfigServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}

export async function DELETE(
  request: Request,
  context: ConfigResourceItemContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { resource, id } = await context.params;
  const itemId = parsePositiveInt(id);

  if (!isConfigResourceKey(resource) || !itemId) {
    return notFound();
  }

  try {
    await deleteConfigResource(resource, itemId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ConfigServiceError) {
      return error.status === 404
        ? notFound()
        : legacyJson(error.body, { status: error.status });
    }

    return serverError();
  }
}
