import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, company, e_mail, tel, free } = body;

    const res = await fetch(
      `https://${import.meta.env.MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v1/webinar_applications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-MICROCMS-API-KEY": import.meta.env.MICROCMS_API_KEY,
        },
        body: JSON.stringify({
          name,
          company,
          e_mail,
          tel,
          free,
        }),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      return new Response(JSON.stringify({ success: false, error }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
