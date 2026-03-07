// Mini HTML previews for each template, rendered as scaled-down iframes
const base = (body: string, bg = '#0f172a', fg = '#e2e8f0') => `
<!DOCTYPE html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${bg};color:${fg};font-family:system-ui,sans-serif;overflow:hidden;font-size:10px}
</style></head><body>${body}</body></html>`

export const templatePreviews: Record<string, string> = {
  'landing-startup': base(`
    <div style="padding:16px">
      <nav style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="display:flex;gap:4px;align-items:center"><div style="width:14px;height:14px;border-radius:4px;background:linear-gradient(135deg,#8b5cf6,#6366f1)"></div><span style="font-weight:700;font-size:10px">StartupCo</span></div>
        <div style="display:flex;gap:8px"><span style="opacity:.6;font-size:8px">Features</span><span style="opacity:.6;font-size:8px">Pricing</span><div style="background:#8b5cf6;color:#fff;padding:2px 8px;border-radius:8px;font-size:7px">Get Started</div></div>
      </nav>
      <div style="text-align:center;padding:16px 0">
        <div style="font-size:16px;font-weight:800;background:linear-gradient(135deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Build Faster</div>
        <div style="font-size:7px;opacity:.5;margin:6px 0">The platform for modern teams</div>
        <div style="display:flex;gap:4px;justify-content:center;margin-top:8px"><div style="background:#8b5cf6;padding:3px 10px;border-radius:6px;font-size:7px;color:#fff">Start Free</div><div style="border:1px solid #334155;padding:3px 10px;border-radius:6px;font-size:7px">Learn More</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px">
        ${[1,2,3].map(() => `<div style="background:#1e293b;padding:8px;border-radius:6px;text-align:center"><div style="width:16px;height:16px;border-radius:50%;background:#8b5cf6;margin:0 auto 4px;opacity:.3"></div><div style="font-size:7px;font-weight:600">Feature</div><div style="font-size:6px;opacity:.4;margin-top:2px">Lorem ipsum dolor sit amet</div></div>`).join('')}
      </div>
    </div>
  `),

  'landing-product': base(`
    <div style="padding:16px">
      <nav style="display:flex;justify-content:space-between;margin-bottom:12px"><span style="font-weight:700;font-size:10px">ProductX</span><div style="display:flex;gap:6px"><span style="opacity:.5;font-size:7px">Features</span><span style="opacity:.5;font-size:7px">Specs</span></div></nav>
      <div style="height:60px;background:linear-gradient(135deg,#f59e0b,#ea580c);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:10px"><span style="font-size:20px">📦</span></div>
      <div style="text-align:center;font-size:12px;font-weight:700">Amazing Product</div>
      <div style="text-align:center;font-size:7px;opacity:.5;margin:4px 0">Revolutionizing the way you work</div>
      <div style="display:flex;gap:4px;margin-top:8px">${[1,2,3,4].map(() => `<div style="flex:1;height:30px;background:#1e293b;border-radius:4px"></div>`).join('')}</div>
    </div>
  `),

  'landing-agency': base(`
    <div style="padding:16px;background:#0a0a0a;min-height:200px">
      <nav style="display:flex;justify-content:space-between;margin-bottom:16px"><span style="font-weight:700;font-size:10px;color:#d4a853">AGENCY</span><div style="display:flex;gap:6px"><span style="opacity:.5;font-size:7px;color:#999">Work</span><span style="opacity:.5;font-size:7px;color:#999">Team</span></div></nav>
      <div style="font-size:18px;font-weight:800;color:#fff;line-height:1.1">We Create<br><span style="color:#d4a853">Digital</span> Magic</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:12px">${[1,2,3].map(() => `<div style="height:40px;background:#1a1a1a;border-radius:4px;border:1px solid #222"></div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'landing-app': base(`
    <div style="padding:16px;background:linear-gradient(135deg,#1e3a5f,#0f172a)">
      <div style="text-align:center">
        <div style="font-size:12px;font-weight:700;color:#fff">Download Our App</div>
        <div style="font-size:7px;opacity:.5;margin:4px 0">Available on iOS & Android</div>
        <div style="width:40px;height:70px;background:#1e293b;border-radius:6px;margin:8px auto;border:2px solid #334155;display:flex;align-items:center;justify-content:center"><div style="width:28px;height:50px;background:#0f172a;border-radius:3px"></div></div>
        <div style="display:flex;gap:4px;justify-content:center"><div style="background:#111;padding:3px 8px;border-radius:4px;font-size:6px;color:#fff">App Store</div><div style="background:#111;padding:3px 8px;border-radius:4px;font-size:6px;color:#fff">Google Play</div></div>
      </div>
    </div>
  `),

  'ecommerce-store': base(`
    <div style="padding:12px">
      <nav style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-weight:700;font-size:10px;color:#ec4899">🛒 Shop</span><div style="display:flex;gap:6px;align-items:center"><div style="width:40px;height:14px;background:#1e293b;border-radius:4px"></div><span style="font-size:10px">🛒</span></div></nav>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${[1,2,3,4,5,6].map(i => `<div style="background:#1e293b;border-radius:6px;overflow:hidden"><div style="height:30px;background:linear-gradient(${i*60}deg,#1e293b,#334155)"></div><div style="padding:4px"><div style="font-size:6px;font-weight:600">Product ${i}</div><div style="font-size:7px;color:#ec4899;font-weight:700">$${(i*12.99).toFixed(2)}</div></div></div>`).join('')}
      </div>
    </div>
  `),

  'ecommerce-fashion': base(`
    <div style="padding:12px;background:#faf9f6">
      <nav style="text-align:center;margin-bottom:10px;border-bottom:1px solid #e5e5e5;padding-bottom:6px"><span style="font-weight:300;font-size:12px;letter-spacing:4px;color:#222">VOGUE</span></nav>
      <div style="height:60px;background:linear-gradient(135deg,#d4a7b0,#c9a9ca);border-radius:4px;margin-bottom:8px;display:flex;align-items:end;padding:6px"><span style="font-size:8px;color:#fff;font-weight:600">NEW COLLECTION</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">${[1,2,3].map(() => `<div style="height:40px;background:#eee;border-radius:2px"></div>`).join('')}</div>
    </div>
  `, '#faf9f6', '#222'),

  'dashboard-analytics': base(`
    <div style="display:flex;height:200px">
      <div style="width:36px;background:#1e293b;padding:4px">
        ${['📊','👥','⚙️','📁'].map(e => `<div style="text-align:center;margin:6px 0;font-size:8px">${e}</div>`).join('')}
      </div>
      <div style="flex:1;padding:8px">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px">
          ${['$12.4k','2,340','3.2%','890'].map((v,i) => `<div style="background:#1e293b;padding:4px 6px;border-radius:4px"><div style="font-size:5px;opacity:.5">Metric</div><div style="font-size:8px;font-weight:700;color:${['#3b82f6','#10b981','#f59e0b','#8b5cf6'][i]}">${v}</div></div>`).join('')}
        </div>
        <div style="background:#1e293b;border-radius:4px;padding:6px;height:60px;display:flex;align-items:end;gap:2px">
          ${[40,65,45,80,55,70,90,60,75,85,50,95].map(h => `<div style="flex:1;background:linear-gradient(180deg,#3b82f6,#1e40af);border-radius:2px 2px 0 0;height:${h}%"></div>`).join('')}
        </div>
      </div>
    </div>
  `),

  'dashboard-admin': base(`
    <div style="display:flex;height:200px">
      <div style="width:40px;background:#111827;padding:6px 4px">
        ${['🏠','👤','📦','⚙️'].map(e => `<div style="text-align:center;margin:8px 0;font-size:8px">${e}</div>`).join('')}
      </div>
      <div style="flex:1;padding:8px">
        <div style="font-size:8px;font-weight:600;margin-bottom:6px">Users</div>
        <div style="background:#1e293b;border-radius:4px;overflow:hidden">
          <div style="display:grid;grid-template-columns:2fr 2fr 1fr;gap:0;font-size:6px;background:#111827;padding:4px 6px;opacity:.6"><span>Name</span><span>Email</span><span>Role</span></div>
          ${['Alice','Bob','Carol'].map(n => `<div style="display:grid;grid-template-columns:2fr 2fr 1fr;padding:4px 6px;font-size:6px;border-top:1px solid #1e293b"><span>${n}</span><span style="opacity:.5">${n.toLowerCase()}@mail</span><span style="color:#3b82f6">Admin</span></div>`).join('')}
        </div>
      </div>
    </div>
  `),

  'dashboard-project': base(`
    <div style="padding:8px">
      <div style="font-size:8px;font-weight:600;margin-bottom:6px">📋 Project Board</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">
        ${['To Do','In Progress','Done'].map((col,ci) => `<div style="background:#1e293b;border-radius:4px;padding:4px"><div style="font-size:6px;font-weight:600;margin-bottom:4px;color:${['#f59e0b','#3b82f6','#10b981'][ci]}">${col}</div>${[1,2].map(() => `<div style="background:#0f172a;border-radius:3px;padding:4px;margin-bottom:3px"><div style="height:3px;background:#334155;border-radius:1px;width:80%"></div><div style="height:3px;background:#334155;border-radius:1px;width:50%;margin-top:2px"></div></div>`).join('')}</div>`).join('')}
      </div>
    </div>
  `),

  'portfolio-dev': base(`
    <div style="padding:16px;text-align:center">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#06b6d4,#3b82f6);margin:0 auto 6px"></div>
      <div style="font-size:10px;font-weight:700">John Doe</div>
      <div style="font-size:7px;color:#06b6d4">Full Stack Developer</div>
      <div style="display:flex;gap:3px;margin:8px auto;justify-content:center">${['React','TS','Node'].map(s => `<span style="font-size:5px;background:#164e63;color:#06b6d4;padding:2px 4px;border-radius:3px">${s}</span>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-top:6px">${[1,2].map(() => `<div style="height:34px;background:#1e293b;border-radius:4px;border:1px solid #334155"></div>`).join('')}</div>
    </div>
  `),

  'portfolio-designer': base(`
    <div style="padding:16px;background:#fafafa">
      <div style="text-align:center;margin-bottom:10px"><div style="font-size:14px;font-weight:300;letter-spacing:3px;color:#222">JANE DOE</div><div style="font-size:7px;color:#999">Visual Designer</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[1,2,3,4,5,6].map(i => `<div style="height:${i%2?30:40}px;background:hsl(${i*50},40%,80%);border-radius:2px"></div>`).join('')}</div>
    </div>
  `, '#fafafa', '#222'),

  'casino-landing': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="text-align:center;margin-bottom:8px"><span style="font-size:14px;font-weight:800;background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">🎰 CASINO</span></div>
      <div style="background:linear-gradient(135deg,#7c2d12,#991b1b);border-radius:6px;padding:8px;text-align:center;margin-bottom:8px;border:1px solid #fbbf2440"><div style="font-size:8px;color:#fbbf24;font-weight:700">🎁 WELCOME BONUS</div><div style="font-size:12px;color:#fff;font-weight:800">100% up to $500</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">${['🎰','🃏','🎲','⭐','🎯','💎'].map(e => `<div style="background:#1a1a1a;border-radius:4px;padding:6px;text-align:center;border:1px solid #333"><div style="font-size:14px">${e}</div><div style="font-size:5px;color:#999;margin-top:2px">Play</div></div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-slots': base(`
    <div style="padding:12px;background:#0a0a0a;text-align:center">
      <div style="font-size:10px;font-weight:700;color:#fbbf24;margin-bottom:6px">🎰 MEGA SLOTS</div>
      <div style="background:#111;border-radius:8px;padding:8px;border:2px solid #fbbf2440;display:inline-block">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:6px">${['🍒','💎','7️⃣','⭐','🍋','🔔','💎','7️⃣','🍒'].map(e => `<div style="background:#1a1a1a;border-radius:4px;padding:6px;font-size:14px">${e}</div>`).join('')}</div>
        <div style="background:linear-gradient(135deg,#fbbf24,#f59e0b);padding:4px 16px;border-radius:4px;font-size:8px;font-weight:700;color:#000">SPIN</div>
      </div>
      <div style="margin-top:6px;font-size:7px;color:#888">Balance: $1,000.00</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'faucet-crypto': base(`
    <div style="padding:12px">
      <div style="text-align:center;margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:#22c55e">⛏️ CryptoFaucet</span></div>
      <div style="background:#1e293b;border-radius:6px;padding:8px;text-align:center;border:1px solid #22c55e40">
        <div style="font-size:7px;opacity:.5">Claim Amount</div>
        <div style="font-size:14px;font-weight:800;color:#22c55e">0.00001 BTC</div>
        <div style="font-size:7px;opacity:.5;margin:4px 0">⏱ 04:59 remaining</div>
        <div style="background:#22c55e;padding:4px 12px;border-radius:4px;font-size:7px;font-weight:600;color:#000;display:inline-block">CLAIM NOW</div>
      </div>
      <div style="display:flex;gap:4px;margin-top:6px;justify-content:center">${['BTC','ETH','LTC','DOGE'].map(c => `<span style="font-size:5px;background:#1e293b;padding:2px 4px;border-radius:3px">${c}</span>`).join('')}</div>
    </div>
  `),

  'faucet-multi': base(`
    <div style="padding:12px">
      <div style="display:flex;gap:4px;margin-bottom:8px">${['Bitcoin','Ethereum','Litecoin'].map((c,i) => `<div style="flex:1;text-align:center;padding:3px;border-radius:4px;font-size:6px;font-weight:600;${i===0?'background:#f7931a;color:#fff':'background:#1e293b'}">${c}</div>`).join('')}</div>
      <div style="background:#1e293b;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:700;color:#f7931a">₿ 0.00005</div><div style="background:#f7931a;padding:3px 10px;border-radius:4px;font-size:7px;font-weight:600;color:#fff;margin-top:6px;display:inline-block">CLAIM</div></div>
    </div>
  `),

  'social-x': base(`
    <div style="display:flex;height:200px">
      <div style="width:36px;background:#000;padding:6px 4px">${['🏠','🔍','🔔','✉️','👤'].map(e => `<div style="text-align:center;margin:6px 0;font-size:8px">${e}</div>`).join('')}</div>
      <div style="flex:1;border-right:1px solid #333;padding:6px">
        <div style="font-size:9px;font-weight:700;margin-bottom:6px">Home</div>
        ${[1,2].map(() => `<div style="border-bottom:1px solid #222;padding:6px 0"><div style="display:flex;gap:4px;align-items:center"><div style="width:16px;height:16px;border-radius:50%;background:#333"></div><div><span style="font-size:7px;font-weight:600">User</span><span style="font-size:6px;opacity:.4"> @handle · 2h</span></div></div><div style="font-size:6px;opacity:.7;margin:3px 0 0 20px">Lorem ipsum dolor sit amet consectetur...</div><div style="display:flex;gap:10px;margin:3px 0 0 20px">${['💬','🔄','❤️','📤'].map(e => `<span style="font-size:7px;opacity:.4">${e}</span>`).join('')}</div></div>`).join('')}
      </div>
    </div>
  `, '#000', '#e7e9ea'),

  'social-instagram': base(`
    <div style="background:#fff;padding:8px">
      <nav style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;border-bottom:1px solid #eee;padding-bottom:4px"><span style="font-family:serif;font-size:11px;font-weight:600;color:#222">Instagram</span><div style="display:flex;gap:6px"><span style="font-size:9px">❤️</span><span style="font-size:9px">💬</span></div></nav>
      <div style="display:flex;gap:6px;margin-bottom:8px;overflow:hidden">${[1,2,3,4,5].map(i => `<div style="text-align:center"><div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);padding:1px"><div style="width:22px;height:22px;border-radius:50%;background:#fff;padding:1px"><div style="width:20px;height:20px;border-radius:50%;background:hsl(${i*60},60%,70%)"></div></div></div><div style="font-size:5px;color:#222">user${i}</div></div>`).join('')}</div>
      <div style="border:1px solid #eee;border-radius:4px;margin-bottom:6px"><div style="height:60px;background:linear-gradient(135deg,#667eea,#764ba2)"></div><div style="padding:4px;display:flex;gap:6px"><span style="font-size:8px">❤️</span><span style="font-size:8px">💬</span><span style="font-size:8px">📤</span></div></div>
    </div>
  `, '#fff', '#222'),

  'social-facebook': base(`
    <div>
      <nav style="background:#1877f2;padding:4px 8px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:700;color:#fff">facebook</span><div style="display:flex;gap:4px">${['🏠','👥','🏪'].map(e => `<span style="font-size:8px">${e}</span>`).join('')}</div></nav>
      <div style="padding:8px">
        <div style="background:#1e293b;border-radius:6px;padding:6px;margin-bottom:6px"><div style="display:flex;gap:4px;align-items:center"><div style="width:16px;height:16px;border-radius:50%;background:#334155"></div><div style="flex:1;height:14px;background:#334155;border-radius:10px"></div></div></div>
        <div style="background:#1e293b;border-radius:6px;overflow:hidden"><div style="padding:6px;display:flex;gap:4px;align-items:center"><div style="width:16px;height:16px;border-radius:50%;background:#334155"></div><div><div style="font-size:7px;font-weight:600">User Name</div><div style="font-size:5px;opacity:.4">2 hours ago</div></div></div><div style="height:50px;background:#334155"></div><div style="display:flex;justify-content:space-around;padding:4px;border-top:1px solid #334155"><span style="font-size:6px;opacity:.6">👍 Like</span><span style="font-size:6px;opacity:.6">💬 Comment</span><span style="font-size:6px;opacity:.6">↗ Share</span></div></div>
      </div>
    </div>
  `),

  'social-substack': base(`
    <div style="background:#fff;padding:12px">
      <nav style="text-align:center;margin-bottom:10px"><span style="font-size:12px;font-weight:700;color:#222">The Newsletter</span></nav>
      <div style="border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:8px"><div style="font-size:10px;font-weight:600;color:#222">Why This Matters Now</div><div style="font-size:6px;color:#888;margin-top:2px">A deep dive into the future of technology and its impact on our daily lives...</div><div style="font-size:5px;color:#ff6719;margin-top:3px">Read more →</div></div>
      <div style="border-bottom:1px solid #eee;padding-bottom:8px"><div style="font-size:10px;font-weight:600;color:#222">The Weekly Roundup</div><div style="font-size:6px;color:#888;margin-top:2px">Everything you need to know this week in one place...</div></div>
    </div>
  `, '#fff', '#222'),

  'social-linktree': base(`
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:16px;text-align:center;min-height:200px">
      <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#84cc16,#22c55e);margin:0 auto 4px"></div>
      <div style="font-size:9px;font-weight:700;color:#fff">@username</div>
      <div style="font-size:6px;opacity:.5;margin:2px 0 10px">Creator & Developer</div>
      ${['🎬 YouTube','📸 Instagram','🐦 Twitter','💼 Portfolio','🛒 Shop'].map(l => `<div style="background:#ffffff15;border:1px solid #ffffff20;padding:5px;border-radius:6px;margin-bottom:4px;font-size:7px;color:#fff">${l}</div>`).join('')}
    </div>
  `),

  'blog-modern': base(`
    <div style="background:#fff;padding:12px">
      <nav style="display:flex;gap:8px;margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:4px"><span style="font-size:9px;font-weight:700;color:#222">Blog</span>${['Tech','Design','Business'].map(c => `<span style="font-size:6px;color:#666">${c}</span>`).join('')}</nav>
      <div style="height:50px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:6px;margin-bottom:6px;display:flex;align-items:end;padding:6px"><div><div style="font-size:8px;font-weight:700;color:#fff">Featured Article Title</div><div style="font-size:5px;color:#fff;opacity:.7">5 min read · Jan 2025</div></div></div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px">${[1,2].map(() => `<div style="border:1px solid #eee;border-radius:4px;overflow:hidden"><div style="height:24px;background:#f3f4f6"></div><div style="padding:4px"><div style="font-size:6px;font-weight:600;color:#222">Article Title</div><div style="font-size:5px;color:#888">Short excerpt...</div></div></div>`).join('')}</div>
    </div>
  `, '#fff', '#222'),

  'blog-magazine': base(`
    <div style="background:#fff;padding:8px">
      <div style="background:#dc2626;color:#fff;text-align:center;padding:2px;font-size:5px;font-weight:700;margin-bottom:6px">⚡ BREAKING NEWS</div>
      <div style="font-size:11px;font-weight:800;color:#111;text-align:center;margin-bottom:6px">THE DAILY</div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:4px">
        <div style="height:60px;background:#1a1a1a;border-radius:4px;display:flex;align-items:end;padding:4px"><span style="font-size:7px;color:#fff;font-weight:600">Top Story Headline</span></div>
        <div style="display:flex;flex-direction:column;gap:4px">${[1,2].map(() => `<div style="flex:1;background:#f3f4f6;border-radius:3px;padding:3px"><div style="font-size:5px;font-weight:600;color:#222">News title</div></div>`).join('')}</div>
      </div>
    </div>
  `, '#fff', '#111'),

  'saas-landing': base(`
    <div style="padding:12px">
      <nav style="display:flex;justify-content:space-between;margin-bottom:12px"><div style="display:flex;gap:4px;align-items:center"><div style="width:12px;height:12px;border-radius:3px;background:linear-gradient(135deg,#8b5cf6,#6366f1)"></div><span style="font-weight:700;font-size:9px">SaaSify</span></div><div style="background:#8b5cf6;padding:2px 8px;border-radius:4px;font-size:6px;color:#fff">Start Free</div></nav>
      <div style="text-align:center;padding:8px 0"><div style="font-size:13px;font-weight:800">Ship Faster 🚀</div><div style="font-size:6px;opacity:.5;margin:4px 0">Everything you need to build your SaaS</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px">${['$9','$29','$99'].map((p,i) => `<div style="background:#1e293b;border-radius:6px;padding:6px;text-align:center;${i===1?'border:1px solid #8b5cf6':''}"><div style="font-size:10px;font-weight:800;color:#8b5cf6">${p}</div><div style="font-size:5px;opacity:.5">/month</div></div>`).join('')}</div>
    </div>
  `),

  'saas-dashboard-app': base(`
    <div style="display:flex;height:200px">
      <div style="width:40px;background:#1e293b;padding:6px 4px"><div style="width:20px;height:20px;border-radius:4px;background:#3b82f6;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:8px">S</div>${['📊','📁','👥','⚙️'].map(e => `<div style="text-align:center;margin:8px 0;font-size:7px">${e}</div>`).join('')}</div>
      <div style="flex:1;padding:8px">
        <div style="display:flex;gap:4px;margin-bottom:6px"><span style="font-size:6px;background:#1e293b;padding:2px 6px;border-radius:3px;color:#3b82f6">Overview</span><span style="font-size:6px;padding:2px 6px;opacity:.4">Analytics</span><span style="font-size:6px;padding:2px 6px;opacity:.4">Settings</span></div>
        <div style="background:#1e293b;border-radius:4px;padding:4px;font-size:6px"><div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:2px 0;opacity:.4;border-bottom:1px solid #334155"><span>Name</span><span>Status</span><span>Date</span><span>Action</span></div>${[1,2,3].map(() => `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:3px 0;border-bottom:1px solid #0f172a"><span>Item</span><span style="color:#22c55e">Active</span><span style="opacity:.4">Jan 1</span><span style="color:#3b82f6">Edit</span></div>`).join('')}</div>
      </div>
    </div>
  `),

  'crypto-wallet': base(`
    <div style="padding:12px">
      <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:8px;padding:10px;margin-bottom:8px;border:1px solid #ffffff10">
        <div style="font-size:6px;opacity:.5">Total Balance</div>
        <div style="font-size:16px;font-weight:800">$24,582.40</div>
        <div style="font-size:7px;color:#22c55e">↑ +2.4% (24h)</div>
      </div>
      <div style="display:flex;gap:4px;margin-bottom:8px"><div style="flex:1;background:#22c55e20;color:#22c55e;text-align:center;padding:4px;border-radius:4px;font-size:7px;font-weight:600">Send</div><div style="flex:1;background:#3b82f620;color:#3b82f6;text-align:center;padding:4px;border-radius:4px;font-size:7px;font-weight:600">Receive</div></div>
      ${[{n:'Bitcoin',s:'BTC',v:'$18,240',c:'+1.2%',cl:'#f7931a'},{n:'Ethereum',s:'ETH',v:'$4,120',c:'+3.1%',cl:'#627eea'},{n:'Solana',s:'SOL',v:'$2,222',c:'-0.8%',cl:'#9945ff'}].map(a => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #1e293b"><div style="display:flex;gap:4px;align-items:center"><div style="width:14px;height:14px;border-radius:50%;background:${a.cl}"></div><div><div style="font-size:7px;font-weight:600">${a.n}</div><div style="font-size:5px;opacity:.4">${a.s}</div></div></div><div style="text-align:right"><div style="font-size:7px;font-weight:600">${a.v}</div><div style="font-size:5px;color:${a.c.startsWith('+')?'#22c55e':'#ef4444'}">${a.c}</div></div></div>`).join('')}
    </div>
  `),

  'crypto-exchange': base(`
    <div style="display:flex;height:200px">
      <div style="flex:1;padding:6px">
        <div style="font-size:7px;font-weight:600;margin-bottom:4px">BTC/USDT <span style="color:#22c55e">$67,450</span></div>
        <div style="height:70px;background:#1e293b;border-radius:4px;margin-bottom:6px;display:flex;align-items:end;padding:4px;gap:1px">${[40,55,35,60,45,70,50,65,80,60,75,55].map(h => `<div style="flex:1;background:#22c55e40;border-radius:1px 1px 0 0;height:${h}%"></div>`).join('')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><div style="background:#22c55e;text-align:center;padding:4px;border-radius:4px;font-size:7px;font-weight:600;color:#fff">BUY</div><div style="background:#ef4444;text-align:center;padding:4px;border-radius:4px;font-size:7px;font-weight:600;color:#fff">SELL</div></div>
      </div>
      <div style="width:60px;background:#111827;padding:4px;font-size:5px"><div style="color:#22c55e;margin-bottom:2px">Bids</div>${[67400,67380,67350].map(p => `<div style="display:flex;justify-content:space-between;color:#22c55e80"><span>${p}</span><span>0.5</span></div>`).join('')}<div style="color:#ef4444;margin-top:4px;margin-bottom:2px">Asks</div>${[67500,67520,67550].map(p => `<div style="display:flex;justify-content:space-between;color:#ef444480"><span>${p}</span><span>0.3</span></div>`).join('')}</div>
    </div>
  `),

  'crypto-defi': base(`
    <div style="padding:12px;background:linear-gradient(135deg,#0f0720,#1a0a3e)">
      <div style="text-align:center;margin-bottom:8px"><span style="font-size:10px;font-weight:700;background:linear-gradient(135deg,#a855f7,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent">⚡ DeFi Swap</span></div>
      <div style="background:#ffffff08;border:1px solid #ffffff15;border-radius:8px;padding:8px;margin-bottom:4px">
        <div style="font-size:5px;opacity:.4">From</div>
        <div style="display:flex;justify-content:space-between"><span style="font-size:10px;font-weight:600">1.0</span><span style="font-size:7px;background:#a855f720;color:#a855f7;padding:2px 6px;border-radius:4px">ETH</span></div>
      </div>
      <div style="text-align:center;font-size:10px;margin:2px 0">↕</div>
      <div style="background:#ffffff08;border:1px solid #ffffff15;border-radius:8px;padding:8px">
        <div style="font-size:5px;opacity:.4">To</div>
        <div style="display:flex;justify-content:space-between"><span style="font-size:10px;font-weight:600">3,420</span><span style="font-size:7px;background:#3b82f620;color:#3b82f6;padding:2px 6px;border-radius:4px">USDC</span></div>
      </div>
      <div style="background:linear-gradient(135deg,#a855f7,#6366f1);text-align:center;padding:5px;border-radius:6px;font-size:7px;font-weight:600;color:#fff;margin-top:6px">Swap</div>
    </div>
  `, '#0f0720', '#e2e8f0'),

  'bank-app': base(`
    <div style="padding:12px;background:linear-gradient(135deg,#1a0a3e,#0f172a)">
      <div style="background:linear-gradient(135deg,#7c3aed,#6366f1);border-radius:10px;padding:10px;margin-bottom:8px">
        <div style="font-size:6px;opacity:.7;color:#fff">Total Balance</div>
        <div style="font-size:16px;font-weight:800;color:#fff">$8,459.20</div>
        <div style="display:flex;gap:8px;margin-top:6px">${['••• 4242','VISA'].map(t => `<span style="font-size:5px;color:#fff;opacity:.6">${t}</span>`).join('')}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px">${['💸','📱','💳','📈'].map((e,i) => `<div style="background:#1e293b;border-radius:6px;padding:6px;text-align:center"><div style="font-size:10px">${e}</div><div style="font-size:5px;opacity:.5;margin-top:2px">${['Transfer','Pay','Card','Invest'][i]}</div></div>`).join('')}</div>
      <div style="font-size:7px;font-weight:600;margin-bottom:4px">Recent</div>
      ${[{n:'Spotify',a:'-$9.99',e:'🎵'},{n:'Salary',a:'+$3,200',e:'💰'}].map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #1e293b"><div style="display:flex;gap:4px;align-items:center"><span style="font-size:10px">${t.e}</span><span style="font-size:7px">${t.n}</span></div><span style="font-size:7px;font-weight:600;color:${t.a.startsWith('+')?'#22c55e':'#ef4444'}">${t.a}</span></div>`).join('')}
    </div>
  `),

  'bank-landing': base(`
    <div style="padding:12px;background:#050505">
      <nav style="display:flex;justify-content:space-between;margin-bottom:12px"><span style="font-weight:700;font-size:10px;color:#d4a853">NeoBank</span><div style="background:#d4a853;padding:2px 8px;border-radius:4px;font-size:6px;color:#000;font-weight:600">Open Account</div></nav>
      <div style="display:flex;gap:8px;align-items:center"><div style="flex:1"><div style="font-size:14px;font-weight:800;color:#fff;line-height:1.1">Banking<br><span style="color:#d4a853">Reimagined</span></div><div style="font-size:6px;color:#888;margin-top:4px">No fees. No limits. No BS.</div></div><div style="width:40px;height:70px;background:#1a1a1a;border-radius:6px;border:1px solid #333"></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:10px">${['🚫 No Fees','⚡ Instant','💰 Cashback'].map(f => `<div style="background:#111;border-radius:4px;padding:6px;text-align:center;border:1px solid #222"><div style="font-size:7px">${f}</div></div>`).join('')}</div>
    </div>
  `, '#050505', '#fff'),

  'bank-investment': base(`
    <div style="padding:8px">
      <div style="font-size:8px;font-weight:600;margin-bottom:6px">📈 Portfolio</div>
      <div style="background:#1e293b;border-radius:6px;padding:8px;margin-bottom:6px"><div style="font-size:6px;opacity:.5">Total Value</div><div style="font-size:14px;font-weight:800">$52,340</div><div style="font-size:6px;color:#22c55e">↑ +12.4% all time</div></div>
      <div style="font-size:6px;font-weight:600;margin-bottom:4px">Watchlist</div>
      ${[{t:'AAPL',p:'$178.20',c:'+1.2%'},{t:'GOOGL',p:'$141.80',c:'-0.3%'},{t:'TSLA',p:'$248.50',c:'+2.8%'}].map(s => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1e293b;font-size:6px"><span style="font-weight:600">${s.t}</span><span>${s.p}</span><span style="color:${s.c.startsWith('+')?'#22c55e':'#ef4444'}">${s.c}</span></div>`).join('')}
    </div>
  `),

  // 2D Games
  'game2d-platformer': base(`
    <div style="position:relative;height:200px;background:linear-gradient(180deg,#1a1a2e 0%,#16213e 40%,#0f3460 100%)">
      <div style="position:absolute;top:20px;left:30px;width:20px;height:20px;background:#fff;border-radius:50%;opacity:.2"></div>
      <div style="position:absolute;top:35px;left:80px;width:30px;height:12px;background:#fff;border-radius:6px;opacity:.1"></div>
      <div style="position:absolute;bottom:40px;left:40px;width:16px;height:20px;background:#e74c3c;border-radius:3px 3px 0 0"><div style="width:16px;height:4px;background:#c0392b;border-radius:3px 3px 0 0"></div></div>
      <div style="position:absolute;bottom:40px;width:100%;display:flex;gap:0"><div style="height:40px;flex:1;background:#2d5016"></div></div>
      <div style="position:absolute;bottom:80px;left:80px;width:40px;height:8px;background:#8b4513;border-radius:2px"></div>
      <div style="position:absolute;bottom:60px;left:140px;width:50px;height:8px;background:#8b4513;border-radius:2px"></div>
      <div style="position:absolute;bottom:88px;left:90px;font-size:8px">⭐</div>
      <div style="position:absolute;bottom:68px;left:155px;font-size:8px">⭐</div>
      <div style="position:absolute;bottom:40px;right:30px;width:12px;height:14px;background:#e74c3c;border-radius:50%"></div>
      <div style="position:absolute;top:6px;left:6px;font-size:6px;color:#ffd700">⭐ 0 &nbsp; ❤️❤️❤️</div>
    </div>
  `),

  'game2d-snake': base(`
    <div style="padding:8px;background:#0a0a0a">
      <div style="font-size:8px;font-weight:700;color:#22c55e;text-align:center;margin-bottom:4px">🐍 SNAKE</div>
      <div style="width:120px;height:120px;background:#111;margin:0 auto;border:1px solid #22c55e40;position:relative;display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:repeat(12,1fr)">
        ${[{x:5,y:6},{x:4,y:6},{x:3,y:6},{x:2,y:6}].map((s,i) => `<div style="grid-column:${s.x};grid-row:${s.y};background:${i===0?'#4ade80':'#22c55e'};border-radius:${i===0?'2px':'1px'};box-shadow:0 0 ${i===0?'4':'2'}px #22c55e80"></div>`).join('')}
        <div style="grid-column:8;grid-row:4;background:#ef4444;border-radius:50%;box-shadow:0 0 6px #ef444480"></div>
      </div>
      <div style="text-align:center;margin-top:4px;font-size:6px;color:#666">Score: 4 &nbsp; Best: 28</div>
    </div>
  `, '#0a0a0a', '#e2e8f0'),

  'game2d-tetris': base(`
    <div style="padding:6px;background:#0a0a0a;display:flex;justify-content:center;gap:6px">
      <div>
        <div style="font-size:7px;color:#888;text-align:center;margin-bottom:3px">TETRIS</div>
        <div style="width:80px;height:140px;background:#111;border:1px solid #333;display:grid;grid-template-columns:repeat(10,1fr);grid-template-rows:repeat(18,1fr);gap:0.5px;padding:1px">
          ${[{c:'#00f0f0',cells:[[4,2],[5,2],[6,2],[7,2]]},{c:'#f0a000',cells:[[1,17],[2,17],[3,17],[1,16]]},{c:'#0000f0',cells:[[7,17],[8,17],[9,17],[9,16]]},{c:'#a000f0',cells:[[4,17],[5,17],[6,17],[5,16]]}].flatMap(t => t.cells.map(([x,y]) => `<div style="grid-column:${x};grid-row:${y};background:${t.c};border-radius:1px"></div>`)).join('')}
        </div>
      </div>
      <div style="width:30px"><div style="font-size:5px;color:#666">NEXT</div><div style="width:28px;height:28px;background:#111;border:1px solid #333;margin-top:2px;display:flex;align-items:center;justify-content:center"><div style="display:grid;grid-template-columns:repeat(2,6px);grid-template-rows:repeat(2,6px);gap:1px">${[1,2,3,4].map(() => `<div style="background:#f0f000;border-radius:1px"></div>`).join('')}</div></div><div style="font-size:5px;color:#666;margin-top:6px">SCORE</div><div style="font-size:7px;color:#fff;font-weight:700">2400</div><div style="font-size:5px;color:#666;margin-top:4px">LEVEL</div><div style="font-size:7px;color:#fff;font-weight:700">3</div></div>
    </div>
  `, '#0a0a0a', '#e2e8f0'),

  'game2d-flappy': base(`
    <div style="height:200px;background:linear-gradient(180deg,#87CEEB 0%,#98d8f0 60%,#90EE90 90%,#228B22 95%);position:relative;overflow:hidden">
      <div style="position:absolute;top:20px;left:50px;font-size:16px;transform:rotate(-15deg)">🐦</div>
      <div style="position:absolute;top:0;left:80px;width:20px;height:60px;background:#2d8b2d;border-radius:0 0 4px 4px"></div>
      <div style="position:absolute;bottom:20px;left:80px;width:20px;height:80px;background:#2d8b2d;border-radius:4px 4px 0 0"></div>
      <div style="position:absolute;top:0;left:140px;width:20px;height:40px;background:#2d8b2d;border-radius:0 0 4px 4px"></div>
      <div style="position:absolute;bottom:20px;left:140px;width:20px;height:100px;background:#2d8b2d;border-radius:4px 4px 0 0"></div>
      <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:14px;font-weight:800;color:#fff;text-shadow:1px 1px 2px rgba(0,0,0,.3)">7</div>
    </div>
  `, '#87CEEB', '#fff'),

  'game2d-shooter': base(`
    <div style="height:200px;background:#000;position:relative;overflow:hidden">
      ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(() => `<div style="position:absolute;top:${Math.random()*180}px;left:${Math.random()*100}%;width:1px;height:1px;background:#fff;border-radius:50%"></div>`).join('')}
      <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50);font-size:16px">🚀</div>
      <div style="position:absolute;bottom:40px;left:50%;width:2px;height:10px;background:#0ff;box-shadow:0 0 4px #0ff"></div>
      <div style="position:absolute;top:30px;left:30px;font-size:12px">👾</div>
      <div style="position:absolute;top:50px;left:70px;font-size:12px">👾</div>
      <div style="position:absolute;top:25px;right:30px;font-size:12px">👾</div>
      <div style="position:absolute;top:6px;left:6px;font-size:6px;color:#0ff">SCORE: 1200</div>
      <div style="position:absolute;top:6px;right:6px;font-size:6px;color:#f44">❤️❤️❤️</div>
    </div>
  `, '#000', '#fff'),

  'game2d-racing': base(`
    <div style="height:200px;background:#333;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;padding-top:10px">
        ${[1,2,3,4,5,6,7,8].map(() => `<div style="width:4px;height:12px;background:#fff;margin:0 auto"></div>`).join('')}
      </div>
      <div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%)"><div style="width:16px;height:24px;background:#e74c3c;border-radius:4px 4px 2px 2px;box-shadow:0 0 8px #e74c3c80"></div></div>
      <div style="position:absolute;top:40px;left:30%"><div style="width:14px;height:20px;background:#3498db;border-radius:3px 3px 2px 2px"></div></div>
      <div style="position:absolute;top:6px;right:6px;font-size:6px;color:#fff">🏎️ 180 km/h</div>
      <div style="position:absolute;top:6px;left:6px;font-size:6px;color:#ffd700">LAP 2/3</div>
    </div>
  `, '#333', '#fff'),

  // 3D Games
  'game3d-fps': base(`
    <div style="height:200px;background:linear-gradient(180deg,#1a1a2e,#16213e);position:relative;overflow:hidden">
      <div style="position:absolute;bottom:0;width:100%;height:60px;background:linear-gradient(180deg,#2a2a3e,#1a1a2e);border-top:1px solid #333"></div>
      <div style="position:absolute;bottom:60px;left:20px;width:30px;height:60px;background:#334155;border:1px solid #475569"></div>
      <div style="position:absolute;bottom:60px;right:40px;width:24px;height:40px;background:#334155;border:1px solid #475569"></div>
      <div style="position:absolute;bottom:60px;left:50%;width:20px;height:20px;background:#ef4444;transform:translateX(-50%);box-shadow:0 0 10px #ef444480"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"><div style="width:12px;height:1px;background:#0f0"></div><div style="width:1px;height:12px;background:#0f0;position:absolute;top:-5.5px;left:5.5px"></div></div>
      <div style="position:absolute;top:6px;left:6px;font-size:6px;color:#0f0">HP: 100</div>
      <div style="position:absolute;top:6px;right:6px;font-size:6px;color:#ff0">AMMO: 30/90</div>
      <div style="position:absolute;bottom:6px;right:6px;font-size:6px;color:#fff">SCORE: 5</div>
    </div>
  `),

  'game3d-racing': base(`
    <div style="height:200px;background:linear-gradient(180deg,#87CEEB 0%,#b8d4e8 50%);position:relative;overflow:hidden">
      <div style="position:absolute;bottom:0;width:100%;height:80px;background:#555;transform:perspective(200px) rotateX(30deg);transform-origin:bottom"></div>
      <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%)"><div style="width:20px;height:12px;background:#e74c3c;border-radius:3px"><div style="width:14px;height:4px;background:#c0392b;margin:0 auto;border-radius:1px"></div></div></div>
      <div style="position:absolute;bottom:50px;left:35%"><div style="width:14px;height:8px;background:#3498db;border-radius:2px;opacity:.7"></div></div>
      <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:7px;color:#333;font-weight:700">LAP 1/3</div>
      <div style="position:absolute;bottom:6px;left:6px;font-size:6px;color:#333">🏎️ 120 km/h</div>
    </div>
  `, '#87CEEB', '#333'),

  'game3d-minecraft': base(`
    <div style="height:200px;background:linear-gradient(180deg,#5b9bd5,#87CEEB);position:relative;overflow:hidden">
      <div style="position:absolute;bottom:0;width:100%;height:60px;background:#4a7a2e"></div>
      <div style="position:absolute;bottom:60px;display:flex;gap:0">${[1,2,3,4,5].map((i) => `<div style="width:20px;height:${20+i*8}px;background:#${i%2?'6b8e23':'5a7d1e'};border:1px solid #4a6b14"></div>`).join('')}</div>
      <div style="position:absolute;bottom:60px;right:20px;display:flex;flex-direction:column">${[1,2,3].map(() => `<div style="display:flex">${[1,2,3].map(() => `<div style="width:14px;height:14px;background:#8b7355;border:1px solid #6b5535"></div>`).join('')}</div>`).join('')}</div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"><div style="width:16px;height:1px;background:#fff"></div><div style="width:1px;height:16px;background:#fff;position:absolute;top:-7.5px;left:7.5px"></div></div>
      <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:2px">${['🟫','🟩','⬜','🪨','💎'].map(b => `<div style="width:16px;height:16px;background:#00000060;border:1px solid #ffffff40;display:flex;align-items:center;justify-content:center;font-size:8px;border-radius:2px">${b}</div>`).join('')}</div>
    </div>
  `, '#5b9bd5', '#fff'),

  'game3d-flight': base(`
    <div style="height:200px;background:linear-gradient(180deg,#1e3a5f 0%,#5b9bd5 40%,#87CEEB 60%,#5a7d1e 90%);position:relative;overflow:hidden">
      <div style="position:absolute;top:40px;left:30px;width:40px;height:6px;background:#fff;border-radius:3px;opacity:.3"></div>
      <div style="position:absolute;top:60px;right:40px;width:30px;height:5px;background:#fff;border-radius:3px;opacity:.2"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-5deg);font-size:20px">✈️</div>
      <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);width:60px;height:30px;border:1px solid #0f0;border-radius:2px;display:flex;align-items:center;justify-content:center"><div style="width:30px;height:1px;background:#0f0"></div><div style="width:1px;height:10px;background:#0f0;position:absolute"></div></div>
      <div style="position:absolute;bottom:8px;left:8px;font-size:6px;color:#fff">ALT: 2,400ft</div>
      <div style="position:absolute;bottom:8px;right:8px;font-size:6px;color:#fff">SPD: 340kts</div>
    </div>
  `),

  'game3d-dungeon': base(`
    <div style="height:200px;background:#0a0a0a;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,#2a1a0a 0%,#0a0a0a 70%)"></div>
      <div style="position:absolute;bottom:0;width:100%;height:80px;background:#1a1008;border-top:2px solid #3a2a1a"></div>
      <div style="position:absolute;bottom:80px;left:10px;width:20px;height:80px;background:#2a1a0a;border:1px solid #3a2a1a"></div>
      <div style="position:absolute;bottom:80px;right:10px;width:20px;height:80px;background:#2a1a0a;border:1px solid #3a2a1a"></div>
      <div style="position:absolute;bottom:80px;left:50%;transform:translateX(-50%);font-size:14px;filter:drop-shadow(0 0 4px #f00)">👹</div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"><div style="width:12px;height:1px;background:#ff6600"></div><div style="width:1px;height:12px;background:#ff6600;position:absolute;top:-5.5px;left:5.5px"></div></div>
      <div style="position:absolute;top:8px;left:8px"><div style="width:40px;height:4px;background:#333;border-radius:2px"><div style="width:70%;height:100%;background:#e74c3c;border-radius:2px"></div></div><div style="font-size:5px;color:#e74c3c;margin-top:1px">HP</div></div>
      <div style="position:absolute;top:8px;right:8px;font-size:6px;color:#ffd700">🪙 42</div>
    </div>
  `, '#0a0a0a', '#fff'),

  // Casino HD
  'casino-roulette': base(`
    <div style="padding:8px;background:#0a2e0a">
      <div style="width:80px;height:80px;border-radius:50%;background:conic-gradient(#c0392b 0deg,#111 10deg,#c0392b 20deg,#111 30deg,#c0392b 40deg,#111 50deg,#c0392b 60deg,#111 70deg,#c0392b 80deg,#111 90deg,#c0392b 100deg,#111 110deg,#c0392b 120deg,#111 130deg,#c0392b 140deg,#111 150deg,#c0392b 160deg,#111 170deg,#c0392b 180deg,#111 190deg,#c0392b 200deg,#111 210deg,#c0392b 220deg,#111 230deg,#c0392b 240deg,#111 250deg,#c0392b 260deg,#111 270deg,#c0392b 280deg,#111 290deg,#c0392b 300deg,#111 310deg,#c0392b 320deg,#111 330deg,#c0392b 340deg,#111 350deg,#c0392b 360deg);margin:0 auto;border:3px solid #d4a853;display:flex;align-items:center;justify-content:center"><div style="width:20px;height:20px;border-radius:50%;background:#0a2e0a;border:2px solid #d4a853;display:flex;align-items:center;justify-content:center;font-size:7px;color:#d4a853;font-weight:700">0</div></div>
      <div style="text-align:center;margin-top:6px;font-size:6px;color:#d4a853">Balance: $5,000</div>
      <div style="display:flex;gap:2px;justify-content:center;margin-top:4px">${[5,25,100].map(v => `<div style="width:18px;height:18px;border-radius:50%;background:#c0392b;border:2px solid #d4a853;display:flex;align-items:center;justify-content:center;font-size:5px;color:#fff;font-weight:700">$${v}</div>`).join('')}</div>
    </div>
  `, '#0a2e0a', '#d4a853'),

  'casino-poker': base(`
    <div style="padding:10px;background:#0a3d0a;border-radius:8px;position:relative">
      <div style="text-align:center;font-size:7px;color:#d4a853;margin-bottom:6px">TEXAS HOLD'EM</div>
      <div style="display:flex;gap:3px;justify-content:center;margin-bottom:8px">${['A♠','K♥','10♦','7♣','2♠'].map(c => `<div style="width:18px;height:26px;background:#fff;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:6px;font-weight:700;color:${c.includes('♥')||c.includes('♦')?'#c0392b':'#111'}">${c}</div>`).join('')}</div>
      <div style="text-align:center;font-size:8px;color:#ffd700;font-weight:700;margin-bottom:6px">POT: $2,400</div>
      <div style="display:flex;justify-content:center;gap:3px;margin-bottom:4px">${['Q♥','J♥'].map(c => `<div style="width:22px;height:30px;background:#fff;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#c0392b;border:1px solid #d4a853">${c}</div>`).join('')}</div>
      <div style="display:flex;gap:3px;justify-content:center">${['Fold','Call','Raise'].map((a,i) => `<div style="padding:2px 6px;border-radius:3px;font-size:5px;font-weight:600;${i===0?'background:#c0392b;color:#fff':i===1?'background:#2980b9;color:#fff':'background:#d4a853;color:#000'}">${a}</div>`).join('')}</div>
    </div>
  `, '#0a3d0a', '#fff'),

  'casino-blackjack': base(`
    <div style="padding:10px;background:#0a3d0a">
      <div style="text-align:center;font-size:7px;color:#d4a853;margin-bottom:6px">♠ BLACKJACK ♠</div>
      <div style="text-align:center;margin-bottom:4px"><div style="font-size:5px;color:#999">DEALER (17)</div><div style="display:flex;gap:2px;justify-content:center;margin-top:2px">${['K♠','7♣'].map(c => `<div style="width:18px;height:26px;background:#fff;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:6px;font-weight:700">${c}</div>`).join('')}</div></div>
      <div style="text-align:center;margin-top:8px"><div style="font-size:5px;color:#999">YOUR HAND (20)</div><div style="display:flex;gap:2px;justify-content:center;margin-top:2px">${['Q♥','10♦'].map(c => `<div style="width:20px;height:28px;background:#fff;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#c0392b;border:1px solid #d4a853">${c}</div>`).join('')}</div></div>
      <div style="display:flex;gap:3px;justify-content:center;margin-top:6px">${['HIT','STAND','DOUBLE'].map((a,i) => `<div style="padding:3px 8px;border-radius:3px;font-size:5px;font-weight:700;${i===1?'background:#d4a853;color:#000':'background:#1a5a1a;color:#fff;border:1px solid #d4a853'}">${a}</div>`).join('')}</div>
    </div>
  `, '#0a3d0a', '#fff'),

  // Canvas & Design
  'canvas-wireframe': base(`
    <div style="display:flex;height:200px;background:#f8f9fa">
      <div style="width:30px;background:#fff;border-right:1px solid #e0e0e0;padding:4px 2px;display:flex;flex-direction:column;gap:4px">${['▭','◻','━','◯','▤'].map(s => `<div style="width:20px;height:16px;background:#f0f0f0;border:1px solid #ddd;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:6px;color:#888">${s}</div>`).join('')}</div>
      <div style="flex:1;padding:8px;background:#fff url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22><circle cx=%221%22 cy=%221%22 r=%220.5%22 fill=%22%23e0e0e0%22/></svg>') repeat">
        <div style="border:1px solid #ccc;border-radius:2px;padding:3px;margin-bottom:4px;display:flex;justify-content:space-between"><div style="display:flex;gap:4px">${[1,2,3].map(() => `<div style="width:14px;height:4px;background:#ddd;border-radius:1px"></div>`).join('')}</div><div style="width:20px;height:4px;background:#3b82f6;border-radius:1px"></div></div>
        <div style="border:1px solid #ccc;border-radius:2px;height:40px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;margin-bottom:4px"><div style="width:60%;height:4px;background:#ddd;border-radius:1px"></div></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[1,2,3].map(() => `<div style="border:1px solid #ccc;border-radius:2px;padding:4px;background:#fafafa"><div style="width:100%;height:16px;background:#eee;border-radius:1px;margin-bottom:2px"></div><div style="width:60%;height:3px;background:#ddd;border-radius:1px"></div></div>`).join('')}</div>
      </div>
    </div>
  `, '#f8f9fa', '#333'),

  'canvas-flowchart': base(`
    <div style="height:200px;background:#fff url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22><circle cx=%221%22 cy=%221%22 r=%220.5%22 fill=%22%23e8e8e8%22/></svg>') repeat;padding:12px;position:relative">
      <div style="position:absolute;top:15px;left:50%;transform:translateX(-50%);width:50px;height:20px;border-radius:10px;background:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:5px;color:#fff;font-weight:600">Start</div>
      <div style="position:absolute;top:35px;left:50%;width:1px;height:12px;background:#666"></div>
      <div style="position:absolute;top:47px;left:50%;transform:translateX(-50%) rotate(45deg);width:28px;height:28px;background:#f59e0b;display:flex;align-items:center;justify-content:center"><span style="transform:rotate(-45deg);font-size:4px;color:#fff">Login?</span></div>
      <div style="position:absolute;top:80px;left:30%;width:1px;height:12px;background:#666"></div>
      <div style="position:absolute;top:80px;right:30%;width:1px;height:12px;background:#666"></div>
      <div style="position:absolute;top:92px;left:15%;width:44px;height:18px;background:#22c55e;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:5px;color:#fff">Dashboard</div>
      <div style="position:absolute;top:92px;right:15%;width:44px;height:18px;background:#ef4444;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:5px;color:#fff">Error</div>
    </div>
  `, '#fff', '#333'),

  'canvas-mindmap': base(`
    <div style="height:200px;background:#1a1a2e;position:relative;overflow:hidden">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:24px;background:linear-gradient(135deg,#8b5cf6,#6366f1);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:6px;color:#fff;font-weight:700">Project</div>
      ${[{x:-60,y:-40,c:'#3b82f6',t:'Design'},{x:60,y:-30,c:'#22c55e',t:'Dev'},{x:-50,y:40,c:'#f59e0b',t:'Marketing'},{x:55,y:35,c:'#ef4444',t:'Launch'}].map(n => `<div style="position:absolute;top:calc(50% + ${n.y}px);left:calc(50% + ${n.x}px);transform:translate(-50%,-50%);width:40px;height:16px;background:${n.c};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:5px;color:#fff;font-weight:600">${n.t}</div>`).join('')}
    </div>
  `),

  'canvas-kanban': base(`
    <div style="padding:6px">
      <div style="font-size:7px;font-weight:600;margin-bottom:4px">📋 Kanban Board</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px">
        ${['Backlog','To Do','In Progress','Done'].map((col,ci) => `<div style="background:#1e293b;border-radius:4px;padding:3px"><div style="font-size:5px;font-weight:600;margin-bottom:3px;color:${['#94a3b8','#f59e0b','#3b82f6','#22c55e'][ci]};display:flex;justify-content:space-between"><span>${col}</span><span style="opacity:.5">${[3,2,2,4][ci]}</span></div>${[1,2].map(() => `<div style="background:#0f172a;border-radius:2px;padding:3px;margin-bottom:2px;border-left:2px solid ${['#94a3b8','#f59e0b','#3b82f6','#22c55e'][ci]}"><div style="height:2px;background:#334155;border-radius:1px;width:80%"></div><div style="height:2px;background:#334155;border-radius:1px;width:50%;margin-top:2px"></div></div>`).join('')}</div>`).join('')}
      </div>
    </div>
  `),

  'canvas-retro': base(`
    <div style="padding:8px;background:#f8f5e6">
      <div style="font-size:8px;font-weight:700;color:#333;text-align:center;margin-bottom:6px">🔄 Sprint Retro</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">
        ${[{t:'😊 Went Well',c:'#fef08a',items:['Team collab','Fast delivery']},{t:'🤔 Improve',c:'#fda4af',items:['Code review','Testing']},{t:'🎯 Actions',c:'#93c5fd',items:['Add CI/CD','Daily standups']}].map(col => `<div><div style="font-size:5px;font-weight:600;color:#555;margin-bottom:3px">${col.t}</div>${col.items.map(item => `<div style="background:${col.c};padding:4px;border-radius:2px;margin-bottom:2px;font-size:5px;color:#333;box-shadow:1px 1px 2px rgba(0,0,0,.1)">${item}<div style="font-size:4px;color:#666;margin-top:1px">👍 3</div></div>`).join('')}</div>`).join('')}
      </div>
    </div>
  `, '#f8f5e6', '#333'),

  'canvas-sitemap': base(`
    <div style="height:200px;background:#fff;padding:10px;position:relative">
      <div style="text-align:center;margin-bottom:8px"><div style="display:inline-block;padding:3px 10px;background:#3b82f6;border-radius:3px;font-size:6px;color:#fff;font-weight:600">🏠 Homepage</div></div>
      <div style="display:flex;justify-content:center;gap:12px;position:relative">
        <div style="position:absolute;top:-4px;left:25%;right:25%;height:1px;background:#ccc"></div>
        ${[{t:'About',c:'#3b82f6'},{t:'Shop',c:'#f59e0b'},{t:'Blog',c:'#22c55e'},{t:'Contact',c:'#8b5cf6'}].map(p => `<div style="text-align:center"><div style="width:1px;height:8px;background:#ccc;margin:0 auto"></div><div style="padding:2px 6px;background:${p.c};border-radius:2px;font-size:5px;color:#fff;font-weight:600;white-space:nowrap">${p.t}</div></div>`).join('')}
      </div>
    </div>
  `, '#fff', '#333'),
}
