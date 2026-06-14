import { notFound } from "@/server/api/errors";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import { deleteInventoryTransaction } from "@/server/management/service";
import { managementErrorResponse } from "@/server/management/route-helpers";

export const runtime = "nodejs";

type InventoryTransactionContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(
  request: Request,
  context: InventoryTransactionContext,
) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const transactionId = parsePositiveInt(id);

  if (!transactionId) {
    return notFound();
  }

  try {
    await deleteInventoryTransaction(transactionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return managementErrorResponse(error);
  }
}
