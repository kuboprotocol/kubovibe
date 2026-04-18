import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("generated_code, title, user_id")
      .eq("id", project_id)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (project.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!project.generated_code) {
      return new Response(JSON.stringify({ error: "No code to deploy" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlBlob = new Blob([project.generated_code], { type: "text/html" });
    const pinataJwt = Deno.env.get("PINATA_JWT");

    if (pinataJwt) {
      const formData = new FormData();
      formData.append("file", htmlBlob, "index.html");
      formData.append("pinataMetadata", JSON.stringify({ name: `kubovibe-${project.title || project_id}` }));

      const uploadRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${pinataJwt}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.text();
        console.error("Pinata upload error:", errData);
        return new Response(JSON.stringify({ error: "IPFS upload failed", details: errData }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { IpfsHash: cid } = await uploadRes.json();
      return new Response(JSON.stringify({
        cid,
        ipfs_url: `https://gateway.pinata.cloud/ipfs/${cid}`,
        gateway_url: `https://ipfs.io/ipfs/${cid}`,
        status: "deployed",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback simulado
    const encoder = new TextEncoder();
    const data = encoder.encode(project.generated_code);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    const fakeCid = `bafybeig${hashHex.slice(0, 50)}`;

    return new Response(JSON.stringify({
      cid: fakeCid,
      ipfs_url: `https://gateway.pinata.cloud/ipfs/${fakeCid}`,
      gateway_url: `https://ipfs.io/ipfs/${fakeCid}`,
      status: "simulated",
      message: "Configure PINATA_JWT para deploy real no IPFS",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ipfs-deploy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
