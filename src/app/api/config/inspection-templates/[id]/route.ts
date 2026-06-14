import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteInspectionTemplate,
  getInspectionTemplate,
  updateInspectionTemplate,
} from "@/server/config/inspection-templates";
import { ConfigServiceError } from "@/server/config/reference-data";

export const runtime = "nodejs";

type InspectionTemplateContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: InspectionTemplateContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const templateId = parsePositiveInt(id);

  if (!templateId) {
    return notFound();
  }

  const template = await getInspectionTemplate(templateId);

  return template ? legacyJson(template) : notFound();
}

export async function PUT(
  request: Request,
  context: InspectionTemplateContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const templateId = parsePositiveInt(id);

  if (!templateId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    return legacyJson(
      await updateInspectionTemplate(
        templateId,
        body,
        authorization.user.userId,
      ),
    );
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
  context: InspectionTemplateContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const templateId = parsePositiveInt(id);

  if (!templateId) {
    return notFound();
  }

  try {
    await deleteInspectionTemplate(templateId, authorization.user.userId);
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
