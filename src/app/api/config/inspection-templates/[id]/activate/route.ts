import { notFound, serverError } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { activateInspectionTemplate } from "@/server/config/inspection-templates";
import { ConfigServiceError } from "@/server/config/reference-data";

export const runtime = "nodejs";

type ActivateInspectionTemplateContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: ActivateInspectionTemplateContext,
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
    return legacyJson(
      await activateInspectionTemplate(templateId, authorization.user.userId),
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
