import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_LIMIT = 10;
const REWARD_CREDITS = 0.5;

// Streak bonus milestones
const STREAK_BONUSES: { days: number; bonus: number }[] = [
  { days: 30, bonus: 5.0 },
  { days: 14, bonus: 2.0 },
  { days: 7, bonus: 1.0 },
  { days: 3, bonus: 0.5 },
];

function getStreakBonus(streak: number): number {
  for (const { days, bonus } of STREAK_BONUSES) {
    if (streak >= days) return bonus;
  }
  return 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authUser.id;
    const body = await req.json();
    const { reward_type } = body;

    if (reward_type !== "completed") {
      return new Response(JSON.stringify({ error: "Invalid reward type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check daily ad limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from("ad_rewards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", todayStart.toISOString());

    if ((count || 0) >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: "Daily ad limit reached", limit: DAILY_LIMIT }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record ad reward
    await supabaseAdmin.from("ad_rewards").insert({
      user_id: userId,
      reward_credits: REWARD_CREDITS,
      ad_type: "unity_rewarded",
    });

    const newCount = (count || 0) + 1;
    let streakBonus = 0;
    let currentStreak = 0;

    // Update streak when all daily videos are completed
    if (newCount >= DAILY_LIMIT) {
      const today = new Date().toISOString().split("T")[0];

      const { data: streakData } = await supabaseAdmin
        .from("user_streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (streakData) {
        const lastDate = streakData.last_activity_date;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        if (lastDate === today) {
          // Already counted today
          currentStreak = streakData.current_streak;
        } else if (lastDate === yesterdayStr) {
          // Consecutive day
          currentStreak = streakData.current_streak + 1;
          const longestStreak = Math.max(currentStreak, streakData.longest_streak);
          await supabaseAdmin
            .from("user_streaks")
            .update({
              current_streak: currentStreak,
              longest_streak: longestStreak,
              last_activity_date: today,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        } else {
          // Streak broken, restart
          currentStreak = 1;
          await supabaseAdmin
            .from("user_streaks")
            .update({
              current_streak: 1,
              last_activity_date: today,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }
      } else {
        // First streak record
        currentStreak = 1;
        await supabaseAdmin.from("user_streaks").insert({
          user_id: userId,
          current_streak: 1,
          longest_streak: 1,
          last_activity_date: today,
        });
      }

      // Calculate and credit streak bonus
      streakBonus = getStreakBonus(currentStreak);

      // Unlock badges for streak milestones
      const BADGE_MILESTONES = [3, 7, 14, 30];
      const newBadges: string[] = [];
      for (const milestone of BADGE_MILESTONES) {
        if (currentStreak >= milestone) {
          const badgeType = `streak_${milestone}`;
          const { data: existing } = await supabaseAdmin
            .from("user_badges")
            .select("id")
            .eq("user_id", userId)
            .eq("badge_type", badgeType)
            .maybeSingle();

          if (!existing) {
            await supabaseAdmin.from("user_badges").insert({
              user_id: userId,
              badge_type: badgeType,
            });
            newBadges.push(badgeType);
          }
        }
      }
    }

    // Add credits to subscription
    const totalCredits = REWARD_CREDITS + streakBonus;

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, edits_limit")
      .eq("user_id", userId)
      .maybeSingle();

    if (sub) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          edits_limit: sub.edits_limit + totalCredits,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        plan: "free",
        edits_used: 0,
        edits_limit: 5 + totalCredits,
        is_active: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        credits_earned: REWARD_CREDITS,
        streak_bonus: streakBonus,
        current_streak: currentStreak,
        daily_completed: newCount >= DAILY_LIMIT,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("unity-ad-reward error:", err);
    const safeMessage = (err.message?.includes("database") || err.message?.includes("sql"))
      ? "Internal server error"
      : err.message;
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
