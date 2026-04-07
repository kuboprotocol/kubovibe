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

    // Fetch project
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

    // Deploy to IPFS via web3.storage / nft.storage compatible API
    // Using Pinata public gateway as fallback
    const htmlBlob = new Blob([project.generated_code], { type: "text/html" });
    
    // Use web3.storage API (free tier)
    const w3Token = Deno.env.get("WEB3_STORAGE_TOKEN");
    
    if (w3Token) {
      const formData = new FormData();
      formData.append("file", htmlBlob, "index.html");

      const uploadRes = await fetch("https://api.web3.storage/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${w3Token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.text();
        console.error("IPFS upload error:", errData);
        return new Response(JSON.stringify({ error: "IPFS upload failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { cid } = await uploadRes.json();
      const ipfsUrl = `https://${cid}.ipfs.w3s.link/index.html`;
      const ipfsGateway = `https://ipfs.io/ipfs/${cid}/index.html`;

      return new Response(JSON.stringify({ 
        cid, 
        ipfs_url: ipfsUrl,
        gateway_url: ipfsGateway,
        status: "deployed" 
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: generate CID-like hash for demo purposes
    const encoder = new TextEncoder();
    const data = encoder.encode(project.generated_code);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    const fakeCid = `bafybeig${hashHex.slice(0, 50)}`;

    return new Response(JSON.stringify({
      cid: fakeCid,
      ipfs_url: `https://${fakeCid}.ipfs.w3s.link/index.html`,
      gateway_url: `https://ipfs.io/ipfs/${fakeCid}/index.html`,
      status: "simulated",
      message: "Configure WEB3_STORAGE_TOKEN for real IPFS deployment",
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
