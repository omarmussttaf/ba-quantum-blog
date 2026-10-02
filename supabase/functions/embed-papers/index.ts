// BA Search v0.4 — Step 3
// Edge Function: embed-papers
// Purpose: generate ONE stored paper embedding per invocation.
// This keeps semantic work separate from research-search and avoids CPU spikes.

// Type definitions for Supabase Edge Runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// TypeScript-only definition for the Supabase Edge Runtime global.
// This does not create or replace Supabase at runtime.
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run(
        content: string,
        options: {
          mean_pool: boolean;
          normalize: boolean;
        },
      ): Promise<ArrayLike<number>>;
    };
  };
};

const EMBEDDING_MODEL =
  "gte-small";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(
  async (request) => {

    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            CORS_HEADERS,
        },
      );
    }

    // Only POST requests are allowed.
if (request.method !== "POST") {
  return jsonResponse(
    {
      ok: false,
      error: "Method not allowed",
    },
    405,
  );
}

// BA Embedding Worker Authentication
const expectedWorkerSecret =
  Deno.env.get("BA_EMBED_WORKER_SECRET");

const providedWorkerSecret =
  request.headers.get("x-ba-worker-secret");

// Fail closed if the server secret is missing.
if (!expectedWorkerSecret) {
  console.error(
    "BA_EMBED_WORKER_SECRET is not configured."
  );

  return jsonResponse(
    {
      ok: false,
      error: "Worker configuration error",
    },
    503,
  );
}

// Reject requests without the correct secret.
if (
  !providedWorkerSecret ||
  providedWorkerSecret !== expectedWorkerSecret
) {
  return jsonResponse(
    {
      ok: false,
      error: "Unauthorized",
    },
    401,
  );
}

    // Track the active reservation for error recovery.
    let activeClaim: {
      id: number;
      lease_token: string;
    } | null = null;

    try {

      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL",
        );

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Missing Supabase server credentials.",
          },
          500,
        );
      }

      const paper =
  await claimNextPaper(
    supabaseUrl,
    serviceRoleKey,
  );
      if (!paper) {
        return jsonResponse(
          {
            ok: true,
            processed: 0,
            message:
              "No paper available: queue empty or another worker holds the active lease.",
          },
        );
      }

            // Keep the claim accessible to the catch block.
      activeClaim = {
        id: paper.id,
        lease_token: paper.lease_token,
      };

      const content =
        String(
          paper.embedding_content ||
          "",
        )
          .trim()
          .slice(
            0,
            7000,
          );

            if (!content) {
        throw new Error(
          "Claimed paper has empty embedding content.",
        );
      }

      /*
        IMPORTANT:
        We generate only ONE embedding per invocation.
        research-search never performs this work.
      */
            // Measure embedding model performance
      const inferenceStartedAt = Date.now();

      console.log(
        "BA EMBED: starting gte-small",
        paper.id,
      );

      const session =
        new Supabase.ai.Session(
          EMBEDDING_MODEL,
        );

      const output =
        await session.run(
          content,
          {
            mean_pool: true,
            normalize: true,
          },
        );

      console.log(
        "BA EMBED: inference completed in ms:",
        Date.now() - inferenceStartedAt,
      );

      const embedding =
        Array.from(
          output as
            ArrayLike<number>,
        );

      if (
        embedding.length === 0
      ) {
        throw new Error(
          "Embedding model returned an empty vector.",
        );
      }

                  // Complete only if this worker still owns the lease.
      await completeClaimedEmbedding(
        supabaseUrl,
        serviceRoleKey,
        paper.id,
        paper.lease_token,
        embedding,
      );

      return jsonResponse(
        {
          ok: true,
          processed: 1,
          paperId:
            paper.id,
          title:
            paper.title,
          model:
            EMBEDDING_MODEL,
          dimensions:
            embedding.length,
        },
      );

    }

        catch (error) {

      console.error(
        "embed-papers error:",
        error,
      );

      // Attempt to release the active reservation.
      if (activeClaim) {

        const supabaseUrl =
          Deno.env.get("SUPABASE_URL");

        const serviceRoleKey =
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (supabaseUrl && serviceRoleKey) {

          try {

            const released =
              await releaseEmbeddingClaim(
                supabaseUrl,
                serviceRoleKey,
                activeClaim.id,
                activeClaim.lease_token,
              );

            console.log(
              "BA EMBED: claim released:",
              released,
            );

          } catch (releaseError) {

            // Preserve the original processing error.
            console.error(
              "BA EMBED: claim release failed:",
              releaseError,
            );

          }

        }

      }

      return jsonResponse(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown embedding worker error.",
        },
        500,
      );

    }

  },
);

// Atomically claim one paper through PostgreSQL.
// Only service_role can execute this RPC.
async function claimNextPaper(
  supabaseUrl: string,
  serviceRoleKey: string,
) {

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/ba_claim_next_embedding`,
    {
      method: "POST",

      headers: {
        ...serverHeaders(serviceRoleKey),
        "Content-Type": "application/json",
      },

      body: "{}",
    },
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Unable to claim paper (${response.status}): ${body.slice(0, 500)}`,
    );
  }

  const rows = await response.json();

  if (!Array.isArray(rows)) {
    throw new Error(
      "Invalid embedding claim response.",
    );
  }

  if (rows.length === 0) {
    return null;
  }

  if (rows.length !== 1) {
    throw new Error(
      "Expected exactly one embedding claim.",
    );
  }

  const row = rows[0];

  if (
    typeof row.paper_id !== "number" ||
    typeof row.lease_token !== "string"
  ) {
    throw new Error(
      "Embedding claim is missing its ID or lease token.",
    );
  }

  return {
    id: row.paper_id,
    title: row.paper_title,
    embedding_content: row.paper_content,
    lease_token: row.lease_token,
  };

}

// Save an embedding only when the worker owns a valid claim.
async function completeClaimedEmbedding(
  supabaseUrl: string,
  serviceRoleKey: string,
  paperId: number,
  leaseToken: string,
  embedding: number[],
) {

  if (
    embedding.length !== 384 ||
    !embedding.every(Number.isFinite)
  ) {
    throw new Error(
      "Invalid embedding: expected 384 finite dimensions.",
    );
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/ba_complete_embedding`,
    {
      method: "POST",

      headers: {
        ...serverHeaders(serviceRoleKey),
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        p_paper_id: paperId,
        p_lease_token: leaseToken,
        p_embedding: embedding,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Unable to complete embedding (${response.status}): ${
        body.slice(0, 500)
      }`,
    );
  }

  const completed = await response.json();

  if (completed !== true) {
    throw new Error(
      "Embedding was not saved: claim expired or became invalid.",
    );
  }

}

// Release a paper reservation if processing fails.
async function releaseEmbeddingClaim(
  supabaseUrl: string,
  serviceRoleKey: string,
  paperId: number,
  leaseToken: string,
): Promise<boolean> {

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/ba_release_embedding_claim`,
    {
      method: "POST",

      headers: {
        ...serverHeaders(serviceRoleKey),
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        p_paper_id: paperId,
        p_lease_token: leaseToken,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Unable to release embedding claim (${response.status}): ${
        body.slice(0, 500)
      }`,
    );
  }

  const released = await response.json();

  if (typeof released !== "boolean") {
    throw new Error(
      "Invalid embedding claim release response.",
    );
  }

  return released;

}

function serverHeaders(
  serviceRoleKey: string,
) {

  return {
    apikey:
      serviceRoleKey,

    Authorization:
      `Bearer ${serviceRoleKey}`,
  };

}


function jsonResponse(
  payload: unknown,
  status =
    200,
) {

  return new Response(
    JSON.stringify(
      payload,
      null,
      2,
    ),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "no-store",
      },
    },
  );

}
