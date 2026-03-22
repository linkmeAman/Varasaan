export function GET() {
  return new Response(null, { status: 204 });
}

export const HEAD = GET;
