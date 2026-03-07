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
}
