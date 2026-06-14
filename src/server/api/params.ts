export function parsePositiveInt(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getQueryParam(request: Request, name: string) {
  return new URL(request.url).searchParams.get(name);
}
