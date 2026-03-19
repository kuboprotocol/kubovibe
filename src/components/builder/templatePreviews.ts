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

  // Metaverse & VR
  'metaverse-social': base(`
    <div style="height:200px;background:#0a0014;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,#0a0014 0%,#1a0030 100%)"></div>
      <div style="position:absolute;bottom:0;width:100%;height:60px;background:repeating-linear-gradient(90deg,transparent,transparent 18px,#8b5cf640 19px,transparent 20px),repeating-linear-gradient(0deg,transparent,transparent 18px,#8b5cf640 19px,transparent 20px);opacity:.4;transform:perspective(200px) rotateX(50deg);transform-origin:bottom"></div>
      ${[{x:30,y:60,c:'#a855f7'},{x:70,y:70,c:'#06b6d4'},{x:110,y:55,c:'#f43f5e'},{x:50,y:90,c:'#22c55e'},{x:90,y:85,c:'#f59e0b'}].map(a => `<div style="position:absolute;top:${a.y}px;left:${a.x}px"><div style="width:8px;height:14px;background:${a.c};border-radius:4px 4px 2px 2px;box-shadow:0 0 8px ${a.c}80"></div><div style="width:20px;font-size:4px;color:${a.c};text-align:center;margin-top:1px">User</div></div>`).join('')}
      <div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);width:30px;height:30px;border:2px solid #8b5cf680;border-radius:50%;box-shadow:0 0 20px #8b5cf640"></div>
      <div style="position:absolute;bottom:6px;left:6px;background:#00000080;padding:2px 4px;border-radius:3px;font-size:5px;color:#a855f7">💬 Chat</div>
      <div style="position:absolute;top:6px;right:6px;font-size:5px;color:#06b6d4">👥 42 online</div>
      <div style="position:absolute;top:6px;left:6px;font-size:7px;font-weight:700;background:linear-gradient(135deg,#a855f7,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">METAVERSE</div>
    </div>
  `, '#0a0014', '#e2e8f0'),

  'metaverse-gallery': base(`
    <div style="height:200px;background:#f5f0eb;position:relative;overflow:hidden">
      <div style="position:absolute;bottom:0;width:100%;height:30px;background:linear-gradient(135deg,#d4c5b5,#c9baa8)"></div>
      <div style="position:absolute;left:0;width:100%;height:140px;top:30px;background:#fff;border-bottom:1px solid #e0d5c5"></div>
      <div style="position:absolute;top:45px;display:flex;gap:16px;left:12px">
        ${[{c:'linear-gradient(135deg,#e74c3c,#f39c12)'},{c:'linear-gradient(135deg,#3498db,#2ecc71)'},{c:'linear-gradient(135deg,#9b59b6,#e91e63)'},{c:'linear-gradient(135deg,#1abc9c,#3498db)'}].map(p => `<div><div style="width:28px;height:36px;background:${p.c};border:2px solid #d4a853;box-shadow:0 2px 8px rgba(0,0,0,.2)"></div><div style="width:4px;height:10px;background:#ffd700;margin:-2px auto 0;opacity:.6"></div></div>`).join('')}
      </div>
      <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:8px;font-weight:300;letter-spacing:3px;color:#555">GALLERY</div>
    </div>
  `, '#f5f0eb', '#333'),

  'metaverse-concert': base(`
    <div style="height:200px;background:#050005;position:relative;overflow:hidden">
      <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);width:80px;height:30px;background:#1a1a2e;border-radius:2px 2px 0 0;border-top:2px solid #333"></div>
      ${[{x:20,r:-20,c:'#ff00ff'},{x:50,r:0,c:'#00ffff'},{x:80,r:15,c:'#ffff00'}].map(l => `<div style="position:absolute;bottom:70px;left:${l.x}%;width:3px;height:80px;background:linear-gradient(0deg,${l.c},transparent);transform:rotate(${l.r}deg);opacity:.4"></div>`).join('')}
      <div style="position:absolute;bottom:0;width:100%;height:40px;display:flex;justify-content:center;gap:3px;align-items:flex-end">
        ${Array.from({length:20}).map(() => `<div style="width:4px;height:${8+Math.random()*12}px;background:#ffffff30;border-radius:2px 2px 0 0"></div>`).join('')}
      </div>
      <div style="position:absolute;bottom:72px;left:50%;transform:translateX(-50%);font-size:10px">🎤</div>
      <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:6px;color:#ff00ff;font-weight:700">🎵 LIVE CONCERT</div>
      <div style="position:absolute;bottom:45px;left:20px;font-size:6px">❤️</div>
      <div style="position:absolute;bottom:50px;right:25px;font-size:6px">🔥</div>
    </div>
  `, '#050005', '#fff'),

  'metaverse-classroom': base(`
    <div style="height:200px;background:#f0ebe3;position:relative;overflow:hidden">
      <div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);width:80px;height:40px;background:#fff;border:2px solid #333;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:5px;color:#333;font-weight:600">📐 Welcome to Class</div>
      <div style="position:absolute;bottom:0;width:100%;height:60px;background:#d4c5b5"></div>
      <div style="display:flex;gap:12px;justify-content:center;position:absolute;bottom:30px;left:50%;transform:translateX(-50%)">
        ${[1,2,3,4].map(i => `<div><div style="width:18px;height:12px;background:#8b7355;border-radius:1px"></div><div style="width:6px;height:10px;background:hsl(${i*80},60%,50%);border-radius:3px 3px 1px 1px;margin:-2px auto 0"></div></div>`).join('')}
      </div>
      <div style="position:absolute;top:70px;left:50%;transform:translateX(-50%)"><div style="width:8px;height:14px;background:#e74c3c;border-radius:4px 4px 1px 1px"></div><div style="font-size:4px;color:#555;text-align:center">Teacher</div></div>
      <div style="position:absolute;top:6px;right:6px;font-size:5px;color:#666">✋ Raise Hand</div>
    </div>
  `, '#f0ebe3', '#333'),

  'metaverse-city': base(`
    <div style="height:200px;background:#05000a;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,#0a0015 0%,#05000a 100%)"></div>
      ${[{x:10,h:120,w:20,c:'#ff00ff'},{x:35,h:90,w:16,c:'#00ffff'},{x:55,h:140,w:22,c:'#8b5cf6'},{x:80,h:100,w:18,c:'#06b6d4'},{x:100,h:80,w:14,c:'#f43f5e'},{x:120,h:110,w:20,c:'#a855f7'}].map(b => `<div style="position:absolute;bottom:20px;left:${b.x}px;width:${b.w}px;height:${b.h}px;background:#0a0a1a;border:1px solid ${b.c}30;box-shadow:0 0 10px ${b.c}20">${Array.from({length:Math.floor(b.h/10)}).map((_,i) => `<div style="display:flex;gap:1px;padding:1px">${Array.from({length:Math.floor(b.w/5)}).map(() => `<div style="width:3px;height:3px;background:${Math.random()>.5?b.c+'60':'transparent'}"></div>`).join('')}</div>`).join('')}</div>`).join('')}
      <div style="position:absolute;bottom:0;width:100%;height:20px;background:#0a0a1a;border-top:1px solid #ffffff10"></div>
      <div style="position:absolute;bottom:20px;width:100%;height:2px;background:linear-gradient(90deg,#ff00ff40,#00ffff40,#ff00ff40)"></div>
      ${[1,2,3].map(() => `<div style="position:absolute;top:${10+Math.random()*30}px;left:${Math.random()*100}%;width:8px;height:2px;background:#ff000060;box-shadow:0 0 4px #ff000040"></div>`).join('')}
      <div style="position:absolute;top:6px;left:6px;font-size:6px;font-weight:700;color:#ff00ff;text-shadow:0 0 6px #ff00ff80">CYBER CITY</div>
    </div>
  `, '#05000a', '#e2e8f0'),

  'metaverse-office': base(`
    <div style="height:200px;background:#f8f6f0;position:relative;overflow:hidden">
      <div style="position:absolute;bottom:0;width:100%;height:40px;background:#e8e0d0"></div>
      <div style="position:absolute;top:30px;left:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${[{s:'🟢',n:'Alice'},{s:'🔴',n:'Bob'},{s:'🟢',n:'Carol'}].map(d => `<div><div style="width:24px;height:14px;background:#8b7355;border-radius:1px;position:relative"><div style="position:absolute;top:-3px;right:-3px;font-size:5px">${d.s}</div></div><div style="font-size:4px;color:#666;text-align:center">${d.n}</div></div>`).join('')}
      </div>
      <div style="position:absolute;top:30px;right:10px;width:40px;height:50px;background:#e0f0ff;border:1px solid #b0d0f0;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:4px;color:#336">📋 Meeting<br>Room</div>
      <div style="position:absolute;bottom:45px;right:60px;font-size:8px">🪴</div>
      <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:7px;font-weight:600;color:#555">🏢 Virtual Office</div>
    </div>
  `, '#f8f6f0', '#333'),

  'metaverse-game-world': base(`
    <div style="height:200px;background:linear-gradient(180deg,#ff8c42 0%,#ffd700 20%,#87ceeb 40%,#87ceeb 60%,#4a7a2e 85%,#2d5016 100%);position:relative;overflow:hidden">
      <div style="position:absolute;bottom:30px;right:20px;width:30px;height:50px;background:#8b7355;position:relative"><div style="position:absolute;top:-10px;left:-5px;width:40px;height:12px;background:#6b5335;border-radius:2px"></div><div style="position:absolute;top:-20px;left:5px;width:10px;height:20px;background:#8b7355"></div><div style="position:absolute;top:-30px;left:2px;width:16px;height:12px;background:#6b5335;border-radius:2px"></div></div>
      <div style="position:absolute;bottom:30px;left:20px"><div style="width:6px;height:20px;background:#5a3a1a"></div><div style="width:20px;height:16px;background:#2d5016;border-radius:50%;margin-top:-8px;margin-left:-7px"></div></div>
      <div style="position:absolute;top:40px;left:60px;width:20px;height:14px;background:#4a7a2e40;border-radius:50%;box-shadow:0 4px 10px #00000020"></div>
      <div style="position:absolute;top:30px;right:60px;font-size:12px;animation:none">🐉</div>
      <div style="position:absolute;bottom:32px;left:80px;font-size:8px">💎</div>
      <div style="position:absolute;bottom:32px;left:55px;font-size:8px">📦</div>
      <div style="position:absolute;top:6px;left:6px;font-size:5px;color:#fff;text-shadow:1px 1px 2px #000">⚔️ QUEST: Find the Dragon</div>
      <div style="position:absolute;top:6px;right:6px;font-size:5px;color:#ffd700;text-shadow:1px 1px 2px #000">💰 120 Gold</div>
    </div>
  `),

  'metaverse-space-station': base(`
    <div style="height:200px;background:#050510;position:relative;overflow:hidden">
      ${Array.from({length:20}).map(() => `<div style="position:absolute;top:${Math.random()*200}px;left:${Math.random()*100}%;width:1px;height:1px;background:#fff;border-radius:50%;opacity:${.3+Math.random()*.7}"></div>`).join('')}
      <div style="position:absolute;top:20px;right:15px;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#4a90d9,#1a3a6a,#0a1a3a);box-shadow:0 0 15px #4a90d940"></div>
      <div style="position:absolute;inset:20px;border:1px solid #33335550;border-radius:4px;background:#0a0a1a80"></div>
      <div style="position:absolute;top:30px;left:30px;display:flex;gap:4px">
        ${[{c:'#3b82f6',t:'NAV'},{c:'#22c55e',t:'SYS'},{c:'#f59e0b',t:'O2'}].map(s => `<div style="width:24px;height:16px;background:#111;border:1px solid ${s.c}60;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:4px;color:${s.c}">${s.t}</div>`).join('')}
      </div>
      <div style="position:absolute;left:30px;top:55px;width:50px;height:25px;background:#0a0a20;border:1px solid #33335550;border-radius:2px;overflow:hidden"><div style="width:100%;height:100%;background:linear-gradient(90deg,#3b82f620 0%,#3b82f640 30%,#3b82f620 100%)"></div></div>
      <div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);width:30px;height:20px;border:1px solid #ffffff20;border-radius:2px;background:#0a0a1a;display:flex;align-items:center;justify-content:center;font-size:6px">🚪</div>
      <div style="position:absolute;top:6px;left:6px;font-size:6px;font-weight:600;color:#3b82f6">🛸 STATION ALPHA</div>
      <div style="position:absolute;bottom:8px;right:8px;font-size:5px;color:#22c55e">O₂: 98%</div>
    </div>
  `, '#050510', '#e2e8f0'),

  // ═══════════════════════════════════════════
  // CASINO — Additional Previews
  // ═══════════════════════════════════════════
  'casino-crash': base(`
    <div style="padding:8px;background:#0a0a0a;height:200px;position:relative">
      <div style="font-size:7px;color:#888;margin-bottom:4px">CRASH</div>
      <div style="position:relative;height:100px;border-left:1px solid #333;border-bottom:1px solid #333;margin-bottom:6px">
        <svg viewBox="0 0 120 80" style="width:100%;height:100%"><path d="M0,80 Q30,75 50,60 T90,20 L90,20" fill="none" stroke="#22c55e" stroke-width="2"/><circle cx="90" cy="20" r="3" fill="#22c55e"/></svg>
        <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);font-size:20px;font-weight:800;color:#22c55e">2.47x</div>
      </div>
      <div style="display:flex;gap:4px;justify-content:center"><div style="background:#22c55e;padding:3px 12px;border-radius:4px;font-size:7px;font-weight:700;color:#000">CASH OUT</div></div>
      <div style="display:flex;gap:2px;position:absolute;bottom:6px;left:8px">${[1.2,3.5,1.8,12.4,2.1,1.0].map(v => `<span style="font-size:5px;padding:1px 3px;border-radius:2px;background:${v>=2?'#22c55e20':'#ef444420'};color:${v>=2?'#22c55e':'#ef4444'}">${v}x</span>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-mines': base(`
    <div style="padding:10px;background:#0a0a0a">
      <div style="font-size:7px;color:#888;margin-bottom:6px">MINES — <span style="color:#22c55e">3.24x</span></div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-bottom:6px">
        ${Array.from({length:25}).map((_,i) => {
          if(i===3||i===11||i===18) return `<div style="width:100%;aspect-ratio:1;background:#22c55e20;border:1px solid #22c55e;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px">💎</div>`
          if(i===7) return `<div style="width:100%;aspect-ratio:1;background:#ef444420;border:1px solid #ef4444;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px">💣</div>`
          return `<div style="width:100%;aspect-ratio:1;background:#1a1a1a;border:1px solid #333;border-radius:3px"></div>`
        }).join('')}
      </div>
      <div style="display:flex;gap:4px;justify-content:center"><div style="background:#22c55e;padding:3px 10px;border-radius:4px;font-size:6px;font-weight:700;color:#000">CASH OUT $32.40</div></div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-plinko': base(`
    <div style="padding:6px;background:#0a0a0a;text-align:center">
      <div style="font-size:7px;color:#888;margin-bottom:4px">PLINKO</div>
      <div style="position:relative;height:120px;width:100px;margin:0 auto">
        ${Array.from({length:8}).map((_,row) => Array.from({length:row+3}).map((_,col) => `<div style="position:absolute;top:${row*14+4}px;left:${50-(row+3)*5+col*10}px;width:4px;height:4px;border-radius:50%;background:#334155"></div>`).join('')).join('')}
        <div style="position:absolute;top:20px;left:48px;width:6px;height:6px;border-radius:50%;background:#f59e0b;box-shadow:0 0 6px #f59e0b"></div>
      </div>
      <div style="display:flex;gap:1px;justify-content:center;margin-top:2px">${['0.2','0.5','1','2','5','10','5','2','1','0.5','0.2'].map((v,i) => `<div style="font-size:4px;padding:2px 2px;background:${Number(v)>=5?'#f59e0b':Number(v)>=2?'#eab308':'#334155'};color:${Number(v)>=2?'#000':'#999'};border-radius:1px;font-weight:600">${v}x</div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-wheel': base(`
    <div style="padding:8px;background:#0a0a0a;text-align:center">
      <div style="font-size:8px;font-weight:700;color:#fbbf24;margin-bottom:4px">🎡 WHEEL OF FORTUNE</div>
      <div style="width:90px;height:90px;border-radius:50%;background:conic-gradient(#ef4444 0deg,#f59e0b 30deg,#22c55e 60deg,#3b82f6 90deg,#8b5cf6 120deg,#ec4899 150deg,#ef4444 180deg,#f59e0b 210deg,#22c55e 240deg,#3b82f6 270deg,#8b5cf6 300deg,#ec4899 330deg,#ef4444 360deg);margin:0 auto;border:3px solid #fbbf24;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px #fbbf2440"><div style="width:20px;height:20px;border-radius:50%;background:#0a0a0a;border:2px solid #fbbf24;display:flex;align-items:center;justify-content:center;font-size:6px;color:#fbbf24;font-weight:700">▶</div></div>
      <div style="font-size:5px;color:#888;margin-top:4px">Click to spin • Balance: $500</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-baccarat': base(`
    <div style="padding:8px;background:#0a3d0a">
      <div style="text-align:center;font-size:7px;color:#d4a853;margin-bottom:6px">BACCARAT</div>
      <div style="display:flex;justify-content:space-around;margin-bottom:6px">
        <div style="text-align:center"><div style="font-size:5px;color:#999">PLAYER (8)</div><div style="display:flex;gap:2px;margin-top:2px">${['9♠','K♣'].map(c => `<div style="width:16px;height:22px;background:#fff;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:5px;font-weight:700">${c}</div>`).join('')}</div></div>
        <div style="text-align:center"><div style="font-size:5px;color:#999">BANKER (6)</div><div style="display:flex;gap:2px;margin-top:2px">${['J♥','6♦'].map(c => `<div style="width:16px;height:22px;background:#fff;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:5px;font-weight:700;color:#c0392b">${c}</div>`).join('')}</div></div>
      </div>
      <div style="display:flex;gap:3px;justify-content:center">${['PLAYER','TIE','BANKER'].map((b,i) => `<div style="padding:3px 8px;border-radius:3px;font-size:5px;font-weight:600;${i===0?'background:#2563eb;color:#fff':i===1?'background:#22c55e;color:#fff':'background:#dc2626;color:#fff'}">${b}</div>`).join('')}</div>
    </div>
  `, '#0a3d0a', '#fff'),

  'casino-keno': base(`
    <div style="padding:6px;background:#0a0a2e">
      <div style="font-size:7px;color:#fbbf24;text-align:center;margin-bottom:4px">KENO</div>
      <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:1px;margin-bottom:4px">
        ${Array.from({length:40}).map((_,i) => {
          const n = i+1; const sel = [3,7,15,22,28,33,37].includes(n); const hit = [7,22,33].includes(n)
          return `<div style="text-align:center;font-size:4px;padding:2px;border-radius:2px;font-weight:600;${hit?'background:#22c55e;color:#000':sel?'background:#3b82f6;color:#fff':'background:#1a1a3e;color:#666'}">${n}</div>`
        }).join('')}
      </div>
      <div style="text-align:center;font-size:5px;color:#888">Hits: 3/7 — Win: $45.00</div>
    </div>
  `, '#0a0a2e', '#e2e8f0'),

  'casino-video-poker': base(`
    <div style="padding:8px;background:#0a0a2e">
      <div style="font-size:7px;color:#fbbf24;text-align:center;margin-bottom:4px">VIDEO POKER — Jacks or Better</div>
      <div style="display:flex;gap:3px;justify-content:center;margin-bottom:6px">
        ${['J♥','Q♠','7♦','J♣','3♠'].map((c,i) => `<div style="position:relative"><div style="width:22px;height:32px;background:#fff;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:${c.includes('♥')||c.includes('♦')?'#c0392b':'#111'};${i===0||i===3?'border:2px solid #fbbf24':''}">${c}</div>${i===0||i===3?'<div style="font-size:4px;color:#fbbf24;text-align:center">HOLD</div>':''}</div>`).join('')}
      </div>
      <div style="text-align:center;font-size:6px;color:#22c55e;font-weight:700;margin-bottom:4px">PAIR OF JACKS!</div>
      <div style="display:flex;gap:3px;justify-content:center"><div style="background:#fbbf24;padding:2px 10px;border-radius:3px;font-size:6px;font-weight:700;color:#000">DRAW</div></div>
    </div>
  `, '#0a0a2e', '#e2e8f0'),

  'casino-hilo': base(`
    <div style="padding:10px;background:#0a0a0a;text-align:center">
      <div style="font-size:7px;color:#888;margin-bottom:6px">HI-LO • <span style="color:#22c55e">1.86x</span></div>
      <div style="width:40px;height:56px;background:#fff;border-radius:4px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#c0392b;border:2px solid #d4a853">8♥</div>
      <div style="display:flex;gap:4px;justify-content:center;margin-bottom:6px"><div style="background:#22c55e;padding:3px 10px;border-radius:3px;font-size:6px;font-weight:700;color:#000">▲ HIGH</div><div style="background:#ef4444;padding:3px 10px;border-radius:3px;font-size:6px;font-weight:700;color:#fff">▼ LOW</div></div>
      <div style="display:flex;gap:2px;justify-content:center">${['3♣','J♠','5♦','K♥','8♣'].map(c => `<div style="width:14px;height:20px;background:#1a1a1a;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:5px;color:#888">${c}</div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-aviator': base(`
    <div style="padding:8px;background:#1a0a0a;height:200px;position:relative">
      <div style="font-size:7px;color:#ef4444;margin-bottom:4px">AVIATOR</div>
      <div style="position:relative;height:100px;border-left:1px solid #333;border-bottom:1px solid #333">
        <svg viewBox="0 0 120 80" style="width:100%;height:100%"><path d="M0,78 Q20,76 40,70 T80,30 L100,5" fill="none" stroke="#ef4444" stroke-width="2"/></svg>
        <div style="position:absolute;top:5px;right:10px;font-size:16px">✈️</div>
        <div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);font-size:18px;font-weight:800;color:#ef4444">5.23x</div>
      </div>
      <div style="display:flex;gap:4px;justify-content:center;margin-top:6px"><div style="background:#ef4444;padding:3px 12px;border-radius:4px;font-size:7px;font-weight:700;color:#fff">BET $10</div><div style="background:#22c55e;padding:3px 12px;border-radius:4px;font-size:7px;font-weight:700;color:#000">CASH OUT</div></div>
    </div>
  `, '#1a0a0a', '#fff'),

  'casino-sports': base(`
    <div style="display:flex;height:200px;background:#0a0a0a">
      <div style="width:30px;background:#111;padding:4px 2px;font-size:6px">${['⚽','🏀','🎾','🥊','🎮'].map(e => `<div style="text-align:center;margin:6px 0">${e}</div>`).join('')}</div>
      <div style="flex:1;padding:6px">
        <div style="font-size:8px;font-weight:700;color:#fff;margin-bottom:6px">⚽ Football</div>
        ${[{t1:'Barcelona',t2:'Real Madrid',o:['1.85','3.50','4.20']},{t1:'Liverpool',t2:'Man City',o:['2.10','3.30','3.40']}].map(m => `<div style="background:#111;border-radius:4px;padding:4px;margin-bottom:4px;border:1px solid #222"><div style="display:flex;justify-content:space-between;font-size:6px;margin-bottom:3px"><span style="color:#fff">${m.t1} vs ${m.t2}</span><span style="color:#22c55e;font-size:5px">LIVE</span></div><div style="display:flex;gap:2px">${m.o.map((o,i) => `<div style="flex:1;text-align:center;padding:2px;background:#1a1a2e;border-radius:2px;font-size:6px;font-weight:600;color:#3b82f6">${['1','X','2'][i]} ${o}</div>`).join('')}</div></div>`).join('')}
      </div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-dice-game': base(`
    <div style="padding:10px;background:#0a0a0a;text-align:center">
      <div style="font-size:7px;color:#888;margin-bottom:6px">DICE — Roll Over</div>
      <div style="background:#111;border-radius:6px;padding:8px;margin-bottom:6px">
        <div style="width:100%;height:6px;background:#1a1a2e;border-radius:3px;position:relative;margin-bottom:4px"><div style="width:55%;height:100%;background:linear-gradient(90deg,#ef4444,#f59e0b);border-radius:3px"></div><div style="position:absolute;left:55%;top:-3px;width:8px;height:12px;background:#fff;border-radius:2px;transform:translateX(-50%)"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:5px;color:#888"><span>0</span><span style="color:#22c55e;font-weight:700">55.00</span><span>100</span></div>
      </div>
      <div style="font-size:14px;font-weight:800;color:#22c55e;margin-bottom:4px">72.41</div>
      <div style="font-size:5px;color:#888">Win Chance: 45% • Multiplier: 2.18x</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-scratch': base(`
    <div style="padding:10px;background:#1a1a2e;text-align:center">
      <div style="font-size:8px;font-weight:700;color:#fbbf24;margin-bottom:6px">🎫 SCRATCH & WIN</div>
      <div style="background:linear-gradient(135deg,#c0a060,#d4a853);border-radius:8px;padding:8px;display:inline-block;margin-bottom:4px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">
          ${['💎','⭐','💎','⭐','💎','🍒','💎','⭐','💎'].map((e,i) => `<div style="width:22px;height:22px;background:${i<5?'#ffffff20':'linear-gradient(135deg,#c8b080,#b09060)'};border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px">${i<5?e:''}</div>`).join('')}
        </div>
      </div>
      <div style="font-size:6px;color:#22c55e;font-weight:700">3x 💎 = $500!</div>
    </div>
  `, '#1a1a2e', '#e2e8f0'),

  'casino-bingo': base(`
    <div style="padding:8px;background:#1a0030">
      <div style="font-size:8px;font-weight:700;color:#ec4899;text-align:center;margin-bottom:4px">🎱 BINGO</div>
      <div style="display:flex;gap:6px;justify-content:center">
        <div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:1px">
          <div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:1px">${['B','I','N','G','O'].map(l => `<div style="text-align:center;font-size:6px;font-weight:700;color:#ec4899;padding:1px">${l}</div>`).join('')}</div>
          ${Array.from({length:25}).map((_,i) => {const n=i+1;const hit=[3,8,12,17,22].includes(n);return `<div style="width:14px;height:14px;font-size:5px;display:flex;align-items:center;justify-content:center;border-radius:2px;${hit?'background:#ec4899;color:#fff;font-weight:700':'background:#1a1a3e;color:#888'}">${n}</div>`}).join('')}
        </div></div>
        <div style="text-align:center"><div style="font-size:16px;margin-bottom:2px">🎱</div><div style="font-size:12px;font-weight:800;color:#fbbf24">42</div><div style="font-size:5px;color:#888">Called</div></div>
      </div>
    </div>
  `, '#1a0030', '#e2e8f0'),

  'casino-coin-flip': base(`
    <div style="padding:12px;background:#0a0a0a;text-align:center">
      <div style="font-size:7px;color:#888;margin-bottom:8px">COIN FLIP</div>
      <div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);margin:0 auto 8px;display:flex;align-items:center;justify-content:center;border:3px solid #d4a853;box-shadow:0 0 20px #fbbf2440"><span style="font-size:16px;font-weight:800;color:#7c2d12">H</span></div>
      <div style="display:flex;gap:6px;justify-content:center"><div style="background:#3b82f6;padding:4px 12px;border-radius:4px;font-size:7px;font-weight:700;color:#fff">HEADS</div><div style="background:#ef4444;padding:4px 12px;border-radius:4px;font-size:7px;font-weight:700;color:#fff">TAILS</div></div>
      <div style="font-size:5px;color:#888;margin-top:6px">Streak: 3 🔥 • Balance: $250</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-lottery': base(`
    <div style="padding:8px;background:#0a0a2e;text-align:center">
      <div style="font-size:8px;font-weight:700;color:#fbbf24;margin-bottom:4px">🎰 MEGA LOTTERY</div>
      <div style="font-size:14px;font-weight:800;color:#22c55e;margin-bottom:4px">$2,450,000</div>
      <div style="font-size:5px;color:#888;margin-bottom:6px">Next draw in 04:32:18</div>
      <div style="display:flex;gap:3px;justify-content:center;margin-bottom:6px">${[7,14,22,35,41,9].map((n,i) => `<div style="width:20px;height:20px;border-radius:50%;background:${i===5?'#fbbf24':'#3b82f6'};display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#fff">${n}</div>`).join('')}</div>
      <div style="background:#22c55e;padding:3px 14px;border-radius:4px;font-size:7px;font-weight:700;color:#000;display:inline-block">BUY TICKET — $5</div>
    </div>
  `, '#0a0a2e', '#e2e8f0'),

  // ═══════════════════════════════════════════
  // SOCIAL — Additional Previews
  // ═══════════════════════════════════════════
  'social-tiktok': base(`
    <div style="height:200px;background:#000;position:relative">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,#00000090 100%)"></div>
      <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:12px"><span style="font-size:7px;opacity:.5;color:#fff">Following</span><span style="font-size:7px;font-weight:700;color:#fff;border-bottom:1px solid #fff">For You</span></div>
      <div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:10px;align-items:center">
        <div style="width:18px;height:18px;border-radius:50%;background:#333"></div>
        ${['❤️','💬','↗️','🎵'].map(e => `<div style="text-align:center"><div style="font-size:10px">${e}</div><div style="font-size:4px;color:#fff">12.3K</div></div>`).join('')}
      </div>
      <div style="position:absolute;bottom:8px;left:8px"><div style="font-size:7px;font-weight:700;color:#fff">@creator_name</div><div style="font-size:5px;color:#fff;opacity:.8;margin-top:2px">Check out this amazing video! 🔥 #viral</div><div style="font-size:5px;color:#fff;opacity:.6;margin-top:2px;display:flex;align-items:center;gap:2px">🎵 Original Sound — creator</div></div>
    </div>
  `, '#000', '#fff'),

  'social-youtube': base(`
    <div style="background:#0f0f0f">
      <nav style="background:#0f0f0f;padding:4px 6px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #272727"><div style="display:flex;gap:4px;align-items:center"><span style="font-size:9px;font-weight:700;color:#ff0000">▶</span><span style="font-size:8px;font-weight:700;color:#fff">YouTube</span></div><div style="width:50px;height:12px;background:#121212;border:1px solid #333;border-radius:10px"></div></nav>
      <div style="padding:6px;display:grid;grid-template-columns:repeat(2,1fr);gap:4px">
        ${[1,2,3,4].map(i => `<div><div style="height:34px;background:#${['272727','1a1a2e','2a1a0a','0a2a1a'][i-1]};border-radius:4px;position:relative"><div style="position:absolute;bottom:2px;right:2px;background:#000;padding:0 2px;border-radius:1px;font-size:4px;color:#fff">${[3,12,8,5][i-1]}:${[42,8,15,30][i-1]}${i>1?'':''}</div></div><div style="display:flex;gap:3px;margin-top:3px"><div style="width:12px;height:12px;border-radius:50%;background:#333;flex-shrink:0"></div><div><div style="font-size:5px;color:#fff;font-weight:600">Video Title ${i}</div><div style="font-size:4px;color:#aaa">Channel • ${i}K views</div></div></div></div>`).join('')}
      </div>
    </div>
  `, '#0f0f0f', '#fff'),

  'social-discord': base(`
    <div style="display:flex;height:200px">
      <div style="width:22px;background:#1e1f22;padding:4px 2px;display:flex;flex-direction:column;gap:4px;align-items:center">
        ${['🎮','🎵','💻','🌐'].map(e => `<div style="width:16px;height:16px;border-radius:8px;background:#5865f2;display:flex;align-items:center;justify-content:center;font-size:7px">${e}</div>`).join('')}
      </div>
      <div style="width:50px;background:#2b2d31;padding:4px">
        <div style="font-size:6px;font-weight:700;color:#fff;margin-bottom:4px">Server</div>
        <div style="font-size:5px;color:#949ba4;margin-bottom:2px">TEXT CHANNELS</div>
        ${['# general','# memes','# dev'].map((c,i) => `<div style="font-size:5px;padding:2px;border-radius:2px;${i===0?'background:#35373c;color:#fff':'color:#949ba4'}">${c}</div>`).join('')}
      </div>
      <div style="flex:1;background:#313338;padding:4px;display:flex;flex-direction:column">
        <div style="flex:1;overflow:hidden">
          ${[{u:'Alice',c:'Hey everyone! 👋',cl:'#e74c3c'},{u:'Bob',c:'Working on the new feature',cl:'#3498db'}].map(m => `<div style="display:flex;gap:3px;margin-bottom:4px"><div style="width:12px;height:12px;border-radius:50%;background:${m.cl};flex-shrink:0"></div><div><span style="font-size:5px;font-weight:600;color:${m.cl}">${m.u}</span><div style="font-size:5px;color:#dbdee1">${m.c}</div></div></div>`).join('')}
        </div>
        <div style="height:14px;background:#383a40;border-radius:4px"></div>
      </div>
    </div>
  `, '#1e1f22', '#dbdee1'),

  'social-whatsapp': base(`
    <div style="display:flex;height:200px">
      <div style="width:60px;background:#111b21;border-right:1px solid #222d34;padding:4px">
        <div style="height:12px;background:#222d34;border-radius:6px;margin-bottom:4px"></div>
        ${[{n:'Mom',m:'See you tomorrow! ❤️',t:'10:30'},{n:'Work Group',m:'Meeting at 3pm',t:'09:45'},{n:'John',m:'Thanks!',t:'Yesterday'}].map((c,i) => `<div style="display:flex;gap:3px;padding:3px 0;border-bottom:1px solid #222d34;${i===0?'background:#222d3440':''}"><div style="width:14px;height:14px;border-radius:50%;background:#2a3942;flex-shrink:0"></div><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between"><span style="font-size:5px;color:#e9edef;font-weight:600">${c.n}</span><span style="font-size:4px;color:#8696a0">${c.t}</span></div><div style="font-size:4px;color:#8696a0;white-space:nowrap;overflow:hidden">${c.m}</div></div></div>`).join('')}
      </div>
      <div style="flex:1;background:#0b141a;display:flex;flex-direction:column">
        <div style="background:#202c33;padding:4px 6px;display:flex;align-items:center;gap:4px"><div style="width:14px;height:14px;border-radius:50%;background:#2a3942"></div><span style="font-size:6px;color:#e9edef;font-weight:600">Mom</span></div>
        <div style="flex:1;padding:6px">
          <div style="background:#005c4b;padding:4px 6px;border-radius:4px 4px 0 4px;font-size:5px;color:#e9edef;max-width:70%;margin-left:auto;margin-bottom:3px">Hi mom! Coming for dinner 🍕<span style="font-size:3px;color:#8696a0;margin-left:4px">10:28 ✓✓</span></div>
          <div style="background:#202c33;padding:4px 6px;border-radius:4px 4px 4px 0;font-size:5px;color:#e9edef;max-width:70%;margin-bottom:3px">See you tomorrow! ❤️<span style="font-size:3px;color:#8696a0;margin-left:4px">10:30</span></div>
        </div>
        <div style="background:#202c33;padding:4px 6px;display:flex;gap:3px"><div style="flex:1;height:14px;background:#2a3942;border-radius:10px"></div><div style="width:14px;height:14px;border-radius:50%;background:#00a884;display:flex;align-items:center;justify-content:center;font-size:6px">🎤</div></div>
      </div>
    </div>
  `, '#0b141a', '#e9edef'),

  'social-reddit': base(`
    <div style="background:#1a1a1b">
      <nav style="background:#1a1a1b;padding:3px 6px;border-bottom:1px solid #343536;display:flex;align-items:center;gap:6px"><span style="font-size:9px;font-weight:700;color:#ff4500">reddit</span><div style="flex:1;height:12px;background:#272729;border:1px solid #343536;border-radius:4px"></div></nav>
      <div style="padding:4px">
        ${[{t:'TIL that bees can recognize human faces',v:12400,c:342,s:'r/todayilearned'},{t:'My cat doing something weird again',v:8900,c:156,s:'r/cats'}].map(p => `<div style="background:#1a1a1b;border:1px solid #343536;border-radius:4px;padding:4px;margin-bottom:3px;display:flex;gap:4px"><div style="display:flex;flex-direction:column;align-items:center;gap:1px"><div style="font-size:6px;color:#ff4500">▲</div><div style="font-size:6px;font-weight:600;color:#d7dadc">${(p.v/1000).toFixed(1)}k</div><div style="font-size:6px;color:#818384">▼</div></div><div><div style="font-size:4px;color:#818384">${p.s} • 5h</div><div style="font-size:6px;color:#d7dadc;font-weight:600;margin:1px 0">${p.t}</div><div style="font-size:4px;color:#818384">💬 ${p.c} comments</div></div></div>`).join('')}
      </div>
    </div>
  `, '#1a1a1b', '#d7dadc'),

  'social-telegram': base(`
    <div style="display:flex;height:200px">
      <div style="width:60px;background:#17212b;border-right:1px solid #0e1621;padding:4px">
        <div style="height:12px;background:#242f3d;border-radius:6px;margin-bottom:4px"></div>
        ${[{n:'Crypto News',e:'📰',m:'BTC hits $70K!',b:'42'},{n:'Dev Team',e:'👥',m:'Deploy ready',b:''},{n:'Alice',e:'👩',m:'See the docs',b:'3'}].map(c => `<div style="display:flex;gap:3px;padding:3px 0;align-items:center"><div style="width:14px;height:14px;border-radius:50%;background:#5288c1;display:flex;align-items:center;justify-content:center;font-size:6px">${c.e}</div><div style="flex:1;min-width:0"><div style="font-size:5px;color:#fff;font-weight:600">${c.n}</div><div style="font-size:4px;color:#6c7883">${c.m}</div></div>${c.b?`<div style="background:#5288c1;border-radius:6px;padding:0 3px;font-size:4px;color:#fff">${c.b}</div>`:''}</div>`).join('')}
      </div>
      <div style="flex:1;background:#0e1621;display:flex;flex-direction:column">
        <div style="background:#17212b;padding:4px 6px"><span style="font-size:6px;color:#fff;font-weight:600">Crypto News</span><div style="font-size:4px;color:#6c7883">1.2K subscribers</div></div>
        <div style="flex:1;padding:6px">
          <div style="background:#182533;padding:4px 6px;border-radius:4px;margin-bottom:3px"><div style="font-size:5px;color:#fff">🚀 Bitcoin breaks $70K! New ATH</div><div style="font-size:3px;color:#6c7883;margin-top:1px">12:30 • 👁 2.4K</div></div>
        </div>
        <div style="background:#17212b;padding:4px 6px;display:flex;gap:3px"><div style="flex:1;height:14px;background:#242f3d;border-radius:10px"></div></div>
      </div>
    </div>
  `, '#0e1621', '#fff'),

  'social-spotify': base(`
    <div style="display:flex;height:200px;background:#000">
      <div style="width:50px;background:#000;padding:6px 4px;border-right:1px solid #282828">
        <div style="font-size:8px;color:#1db954;font-weight:700;margin-bottom:6px">●</div>
        ${['🏠','🔍','📚'].map(e => `<div style="font-size:8px;margin:6px 0;text-align:center">${e}</div>`).join('')}
        <div style="font-size:5px;color:#b3b3b3;margin-top:8px">Playlists</div>
        ${['Liked Songs','Chill Vibes','Workout'].map(p => `<div style="font-size:4px;color:#b3b3b3;padding:2px 0">${p}</div>`).join('')}
      </div>
      <div style="flex:1;background:#121212;padding:6px">
        <div style="font-size:8px;font-weight:700;color:#fff;margin-bottom:6px">Good evening</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px">
          ${['Liked Songs','Daily Mix 1','Release Radar','Chill Hits'].map((t,i) => `<div style="display:flex;align-items:center;gap:3px;background:#2a2a2a;border-radius:3px;overflow:hidden;height:22px"><div style="width:22px;height:22px;background:${['linear-gradient(135deg,#4c1d95,#7c3aed)','#1a3a1a','#2a1a3a','#1a2a3a'][i]};flex-shrink:0"></div><span style="font-size:5px;color:#fff;font-weight:600">${t}</span></div>`).join('')}
        </div>
      </div>
    </div>
  `, '#000', '#fff'),

  'social-linkedin': base(`
    <div style="background:#000">
      <nav style="background:#1b1f23;padding:3px 8px;display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;color:#0a66c2">in</span><div style="flex:1;height:12px;background:#38434f;border-radius:3px"></div>${['🏠','👥','💼','💬','🔔'].map(e => `<span style="font-size:7px">${e}</span>`).join('')}</nav>
      <div style="display:flex;gap:4px;padding:6px">
        <div style="width:50px;background:#1b1f23;border-radius:4px;padding:6px;text-align:center"><div style="width:24px;height:24px;border-radius:50%;background:#38434f;margin:0 auto 3px"></div><div style="font-size:5px;color:#fff;font-weight:600">John Doe</div><div style="font-size:4px;color:#ffffffb3">Software Eng</div></div>
        <div style="flex:1">
          <div style="background:#1b1f23;border-radius:4px;padding:4px;margin-bottom:3px"><div style="display:flex;gap:3px;margin-bottom:3px"><div style="width:14px;height:14px;border-radius:50%;background:#38434f"></div><div><div style="font-size:5px;color:#fff;font-weight:600">Jane Smith</div><div style="font-size:4px;color:#ffffffb3">PM at Google • 2h</div></div></div><div style="font-size:5px;color:#ffffffb3">Excited to share that I've joined...</div><div style="display:flex;gap:8px;margin-top:3px;border-top:1px solid #38434f;padding-top:2px"><span style="font-size:4px;color:#ffffffb3">👍 Like</span><span style="font-size:4px;color:#ffffffb3">💬 Comment</span></div></div>
        </div>
      </div>
    </div>
  `, '#000', '#fff'),

  'social-pinterest': base(`
    <div style="background:#fff;padding:4px">
      <nav style="display:flex;align-items:center;gap:4px;margin-bottom:6px;padding:2px 0"><div style="width:14px;height:14px;border-radius:50%;background:#e60023;display:flex;align-items:center;justify-content:center;font-size:7px;color:#fff;font-weight:700">P</div><div style="flex:1;height:14px;background:#efefef;border-radius:20px"></div></nav>
      <div style="columns:3;gap:3px">
        ${[{h:50,c:'#fde68a'},{h:70,c:'#c4b5fd'},{h:40,c:'#fca5a5'},{h:60,c:'#86efac'},{h:45,c:'#93c5fd'},{h:55,c:'#fda4af'}].map(p => `<div style="break-inside:avoid;margin-bottom:3px"><div style="height:${p.h}px;background:${p.c};border-radius:6px;margin-bottom:1px"></div><div style="font-size:4px;color:#333;font-weight:500">Pin title</div></div>`).join('')}
      </div>
    </div>
  `, '#fff', '#333'),

  'social-snapchat': base(`
    <div style="height:200px;background:#000;position:relative">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,#333 0%,#1a1a1a 100%)"></div>
      <div style="position:absolute;top:6px;left:6px;display:flex;gap:4px"><div style="width:14px;height:14px;border-radius:50%;background:#fffc00;display:flex;align-items:center;justify-content:center;font-size:7px">👻</div></div>
      <div style="position:absolute;top:6px;right:6px;display:flex;gap:4px">${['🔍','👤'].map(e => `<span style="font-size:10px">${e}</span>`).join('')}</div>
      <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);width:36px;height:36px;border-radius:50%;border:3px solid #fff"></div>
      <div style="position:absolute;bottom:8px;display:flex;justify-content:space-around;width:100%;padding:0 20px">
        ${['🗺','💬','📷','📖','🎯'].map((e,i) => `<span style="font-size:10px;${i===2?'opacity:0':''}">${e}</span>`).join('')}
      </div>
    </div>
  `, '#000', '#fff'),

  // ═══════════════════════════════════════════
  // CRYPTO & BANK — Additional Previews
  // ═══════════════════════════════════════════
  'crypto-portfolio': base(`
    <div style="padding:8px">
      <div style="font-size:8px;font-weight:600;margin-bottom:6px">📊 Crypto Portfolio</div>
      <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:8px;padding:8px;margin-bottom:6px;text-align:center">
        <div style="font-size:5px;opacity:.5">Total Value</div>
        <div style="font-size:16px;font-weight:800">$142,580</div>
        <div style="font-size:6px;color:#22c55e">↑ +$3,240 (2.3%)</div>
      </div>
      <div style="display:flex;gap:3px;margin-bottom:4px">
        <div style="flex:3;height:8px;background:#f7931a;border-radius:2px 0 0 2px"></div>
        <div style="flex:2;height:8px;background:#627eea"></div>
        <div style="flex:1;height:8px;background:#9945ff"></div>
        <div style="flex:1;height:8px;background:#26a17b;border-radius:0 2px 2px 0"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:4px;color:#888"><span>BTC 45%</span><span>ETH 28%</span><span>SOL 14%</span><span>USDT 13%</span></div>
    </div>
  `),

  'crypto-nft': base(`
    <div style="padding:8px;background:#0a0a0a">
      <div style="font-size:8px;font-weight:700;color:#fff;margin-bottom:6px">🖼 NFT Marketplace</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">
        ${[{c:'linear-gradient(135deg,#f43f5e,#8b5cf6)',p:'2.5 ETH'},{c:'linear-gradient(135deg,#06b6d4,#3b82f6)',p:'1.2 ETH'},{c:'linear-gradient(135deg,#f59e0b,#ef4444)',p:'0.8 ETH'}].map(n => `<div style="border-radius:6px;overflow:hidden;background:#111"><div style="height:40px;background:${n.c}"></div><div style="padding:3px"><div style="font-size:5px;color:#fff;font-weight:600">NFT #${Math.floor(Math.random()*9999)}</div><div style="font-size:5px;color:#8b5cf6;font-weight:600">${n.p}</div></div></div>`).join('')}
      </div>
    </div>
  `, '#0a0a0a', '#fff'),

  'crypto-staking': base(`
    <div style="padding:10px;background:linear-gradient(135deg,#0f0720,#1a0a3e)">
      <div style="font-size:8px;font-weight:700;color:#a855f7;margin-bottom:6px">💰 Staking Dashboard</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-bottom:6px">
        ${[{t:'Staked',v:'32.5 ETH',c:'#627eea'},{t:'APY',v:'5.2%',c:'#22c55e'},{t:'Rewards',v:'1.69 ETH',c:'#f59e0b'},{t:'Time',v:'142 days',c:'#8b5cf6'}].map(s => `<div style="background:#ffffff08;border:1px solid #ffffff10;border-radius:6px;padding:6px"><div style="font-size:4px;color:#888">${s.t}</div><div style="font-size:9px;font-weight:700;color:${s.c}">${s.v}</div></div>`).join('')}
      </div>
      <div style="background:#a855f7;text-align:center;padding:4px;border-radius:4px;font-size:6px;font-weight:600;color:#fff">Stake More</div>
    </div>
  `, '#0f0720', '#e2e8f0'),

  'bank-digital': base(`
    <div style="padding:10px;background:#050505">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:9px;font-weight:700;color:#fff">DigiBank</span><div style="width:16px;height:16px;border-radius:50%;background:#333"></div></div>
      <div style="background:linear-gradient(135deg,#1a1a2e,#2d1b4e);border-radius:8px;padding:8px;margin-bottom:8px"><div style="font-size:5px;color:#888">Checking Account</div><div style="font-size:14px;font-weight:800;color:#fff">$12,458.90</div><div style="display:flex;gap:4px;margin-top:4px"><span style="font-size:5px;color:#888">•••• 4242</span></div></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:6px">${['Send','Request','Pay','More'].map((a,i) => `<div style="text-align:center;background:#111;border-radius:6px;padding:4px"><div style="font-size:10px">${['💸','📥','📱','⋯'][i]}</div><div style="font-size:4px;color:#888;margin-top:1px">${a}</div></div>`).join('')}</div>
      <div style="font-size:6px;color:#888;margin-bottom:3px">Transactions</div>
      ${[{n:'Amazon',a:'-$42.99',e:'🛒'},{n:'Direct Deposit',a:'+$2,800',e:'💰'}].map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #111"><div style="display:flex;gap:3px;align-items:center"><span style="font-size:8px">${t.e}</span><span style="font-size:5px;color:#fff">${t.n}</span></div><span style="font-size:5px;font-weight:600;color:${t.a.startsWith('+')?'#22c55e':'#ef4444'}">${t.a}</span></div>`).join('')}
    </div>
  `, '#050505', '#fff'),

  'bank-crypto': base(`
    <div style="padding:8px;background:linear-gradient(180deg,#0a0a1a,#0f172a)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:9px;font-weight:700;color:#fbbf24">₿ CryptoBank</span><div style="font-size:5px;color:#22c55e">● Online</div></div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-bottom:6px">
        <div style="background:#111827;border-radius:6px;padding:6px"><div style="font-size:4px;color:#888">Fiat Balance</div><div style="font-size:10px;font-weight:800;color:#fff">$8,240</div></div>
        <div style="background:#111827;border-radius:6px;padding:6px"><div style="font-size:4px;color:#888">Crypto Value</div><div style="font-size:10px;font-weight:800;color:#fbbf24">$34,120</div></div>
      </div>
      <div style="display:flex;gap:3px;margin-bottom:6px">${['Buy','Sell','Swap','Earn'].map((a,i) => `<div style="flex:1;text-align:center;padding:3px;background:${i===0?'#22c55e':'#111827'};border-radius:4px;font-size:5px;font-weight:600;color:${i===0?'#000':'#fff'}">${a}</div>`).join('')}</div>
      ${[{n:'Bitcoin',s:'BTC',v:'0.42 BTC',p:'$28,140',c:'+2.1%'},{n:'Ethereum',s:'ETH',v:'2.8 ETH',p:'$5,980',c:'+4.3%'}].map(a => `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #111827"><div style="display:flex;gap:3px;align-items:center"><div style="width:12px;height:12px;border-radius:50%;background:${a.s==='BTC'?'#f7931a':'#627eea'}"></div><div><div style="font-size:5px;color:#fff">${a.n}</div><div style="font-size:4px;color:#888">${a.v}</div></div></div><div style="text-align:right"><div style="font-size:5px;color:#fff">${a.p}</div><div style="font-size:4px;color:#22c55e">${a.c}</div></div></div>`).join('')}
    </div>
  `, '#0a0a1a', '#fff'),

  'bank-neobank': base(`
    <div style="padding:10px;background:#000;text-align:center">
      <div style="font-size:10px;font-weight:800;background:linear-gradient(135deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px">NeoBank</div>
      <div style="width:80px;height:50px;background:linear-gradient(135deg,#8b5cf6,#3b82f6);border-radius:8px;margin:0 auto 8px;padding:6px;position:relative"><div style="font-size:4px;color:#fff;opacity:.7;text-align:left">NeoBank</div><div style="position:absolute;bottom:6px;left:6px;font-size:6px;color:#fff;letter-spacing:2px">•••• 8834</div><div style="position:absolute;bottom:6px;right:6px;font-size:5px;color:#fff;opacity:.7">VISA</div></div>
      <div style="font-size:5px;color:#888;margin-bottom:2px">Available Balance</div>
      <div style="font-size:18px;font-weight:800;color:#fff">$24,850</div>
      <div style="display:flex;gap:4px;justify-content:center;margin-top:6px">${['Send','Request','Top Up'].map((a,i) => `<div style="padding:3px 8px;background:${i===0?'linear-gradient(135deg,#8b5cf6,#3b82f6)':'#111'};border-radius:4px;font-size:5px;font-weight:600;color:#fff">${a}</div>`).join('')}</div>
    </div>
  `, '#000', '#fff'),

  // ═══════════════════════════════════════════
  // LANDING PAGES — Additional Previews
  // ═══════════════════════════════════════════
  'landing-saas-ai': base(`
    <div style="padding:12px;background:#0a0a1a">
      <nav style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-size:9px;font-weight:700;background:linear-gradient(135deg,#06b6d4,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent">AI Studio</span><div style="background:#06b6d4;padding:2px 6px;border-radius:4px;font-size:6px;color:#000">Try Free</div></nav>
      <div style="text-align:center;padding:6px 0"><div style="font-size:14px;font-weight:800;color:#fff">AI That <span style="color:#06b6d4">Thinks</span></div><div style="font-size:6px;color:#888;margin-top:4px">Powered by next-gen intelligence</div></div>
      <div style="background:#111;border:1px solid #06b6d420;border-radius:6px;padding:6px;margin-top:6px"><div style="font-size:5px;color:#06b6d4;margin-bottom:2px">✨ Try it</div><div style="height:4px;background:#1e293b;border-radius:2px;overflow:hidden"><div style="width:60%;height:100%;background:linear-gradient(90deg,#06b6d4,#a855f7)"></div></div></div>
    </div>
  `, '#0a0a1a', '#fff'),

  'landing-restaurant': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="text-align:center;margin-bottom:8px"><span style="font-size:12px;font-weight:300;letter-spacing:3px;color:#d4a853">RESTAURANT</span></div>
      <div style="height:40px;background:linear-gradient(135deg,#7c2d12,#451a03);border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:6px"><span style="font-size:7px;color:#d4a853;font-weight:600">🍽️ Reserve a Table</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${['🥩 Mains','🍰 Desserts','🍷 Drinks'].map(m => `<div style="background:#111;border:1px solid #222;border-radius:3px;padding:4px;text-align:center;font-size:5px;color:#d4a853">${m}</div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'landing-fitness': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="font-size:14px;font-weight:800;color:#fff;text-align:center">TRANSFORM<br><span style="color:#ef4444">YOUR BODY</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:8px">${['$29 Basic','$49 Pro','$79 VIP'].map((p,i) => `<div style="background:#111;border:1px solid ${i===1?'#ef4444':'#222'};border-radius:4px;padding:5px;text-align:center"><div style="font-size:7px;font-weight:700;color:${i===1?'#ef4444':'#888'}">${p.split(' ')[0]}</div><div style="font-size:5px;color:#666">${p.split(' ')[1]}</div></div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'landing-real-estate': base(`
    <div style="padding:12px">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px">Find Your <span style="color:#3b82f6">Home</span></div>
      <div style="display:flex;gap:3px;margin-bottom:8px"><div style="flex:1;height:14px;background:#1e293b;border-radius:4px"></div><div style="background:#3b82f6;padding:2px 8px;border-radius:4px;font-size:6px;color:#fff">Search</div></div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px">${[1,2].map(i => `<div style="background:#1e293b;border-radius:4px;overflow:hidden"><div style="height:28px;background:linear-gradient(${i*90}deg,#1e293b,#334155)"></div><div style="padding:4px"><div style="font-size:8px;font-weight:700;color:#3b82f6">$${i*250}K</div><div style="font-size:5px;opacity:.5">${i+1} bed · ${i} bath</div></div></div>`).join('')}</div>
    </div>
  `),

  'landing-wedding': base(`
    <div style="padding:16px;background:#faf5ef;text-align:center">
      <div style="font-size:14px;font-weight:300;font-style:italic;color:#8b6f47">Emma & James</div>
      <div style="font-size:7px;color:#b89a6a;margin:4px 0">June 15, 2025 · Tuscany</div>
      <div style="display:flex;gap:4px;justify-content:center;margin:8px 0">${['120','06','30','45'].map((v,i) => `<div style="background:#fff;border:1px solid #e0d5c5;border-radius:4px;padding:4px 6px"><div style="font-size:10px;font-weight:700;color:#8b6f47">${v}</div><div style="font-size:4px;color:#b89a6a">${['DAYS','HRS','MIN','SEC'][i]}</div></div>`).join('')}</div>
      <div style="background:#8b6f47;color:#fff;padding:3px 12px;border-radius:4px;font-size:6px;display:inline-block">RSVP</div>
    </div>
  `, '#faf5ef', '#333'),

  'landing-education': base(`
    <div style="padding:12px">
      <div style="font-size:12px;font-weight:700">Learn to <span style="color:#3b82f6">Code</span></div>
      <div style="font-size:6px;opacity:.5;margin:4px 0">Master web development in 12 weeks</div>
      <div style="background:#1e293b;border-radius:6px;padding:6px;margin-top:6px">${['✅ HTML/CSS','✅ JavaScript','✅ React','⬜ Node.js'].map(m => `<div style="font-size:5px;padding:2px 0;border-bottom:1px solid #0f172a">${m}</div>`).join('')}</div>
      <div style="background:#3b82f6;text-align:center;padding:4px;border-radius:4px;font-size:7px;font-weight:600;color:#fff;margin-top:6px">Enroll Now — $499</div>
    </div>
  `),

  'landing-event': base(`
    <div style="padding:12px;background:#0a0a1a">
      <div style="text-align:center"><div style="font-size:14px;font-weight:800;color:#fff">TECH<span style="color:#8b5cf6">CONF</span> 2025</div><div style="font-size:6px;color:#888;margin:4px 0">March 15-17 · San Francisco</div></div>
      <div style="display:flex;gap:3px;justify-content:center;margin:8px 0">${[1,2,3].map(() => `<div style="width:24px;height:24px;border-radius:50%;background:#1e293b;border:1px solid #334155"></div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${['$99 Early','$149 Regular','$299 VIP'].map((t,i) => `<div style="background:#111;border:1px solid ${i===2?'#8b5cf6':'#222'};border-radius:4px;padding:4px;text-align:center;font-size:5px;color:${i===2?'#8b5cf6':'#888'}">${t}</div>`).join('')}</div>
    </div>
  `, '#0a0a1a', '#fff'),

  'landing-nft': base(`
    <div style="padding:12px;background:#0a0a14">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#a855f7;margin-bottom:6px">🎨 CryptoApes</div>
      <div style="height:50px;background:linear-gradient(135deg,#7c3aed,#ec4899);border-radius:8px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;font-size:18px">🐵</div>
      <div style="display:flex;gap:6px;justify-content:center;font-size:6px;margin-bottom:6px">${[['10K','Items'],['2.1K','Owners'],['0.5','Floor']].map(([v,l]) => `<div style="text-align:center"><div style="font-weight:700;color:#fff">${v}</div><div style="color:#888">${l}</div></div>`).join('')}</div>
      <div style="background:#a855f7;text-align:center;padding:4px;border-radius:4px;font-size:7px;font-weight:600;color:#fff">MINT NOW</div>
    </div>
  `, '#0a0a14', '#fff'),

  'landing-crypto-ico': base(`
    <div style="padding:12px;background:#050510">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#fbbf24;margin-bottom:6px">🪙 TOKEN SALE</div>
      <div style="background:#111;border:1px solid #fbbf2430;border-radius:6px;padding:6px;margin-bottom:6px"><div style="font-size:5px;color:#888;margin-bottom:2px">Progress: 68%</div><div style="height:6px;background:#1a1a2e;border-radius:3px;overflow:hidden"><div style="width:68%;height:100%;background:linear-gradient(90deg,#fbbf24,#f59e0b)"></div></div><div style="display:flex;justify-content:space-between;font-size:5px;color:#888;margin-top:2px"><span>$6.8M raised</span><span>$10M goal</span></div></div>
    </div>
  `, '#050510', '#fff'),

  'landing-podcast': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><div style="width:36px;height:36px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px">🎙️</div><div><div style="font-size:10px;font-weight:700;color:#fff">The Daily Pod</div><div style="font-size:5px;color:#888">Tech & Culture</div></div></div>
      ${[1,2].map(i => `<div style="display:flex;gap:4px;padding:4px 0;border-bottom:1px solid #1a1a1a;align-items:center"><div style="font-size:8px">▶️</div><div style="flex:1"><div style="font-size:6px;font-weight:600;color:#fff">Episode ${i+10}</div><div style="font-size:5px;color:#888">42 min</div></div></div>`).join('')}
    </div>
  `, '#0a0a0a', '#fff'),

  'landing-saas-crm': base(`
    <div style="padding:12px">
      <div style="font-size:12px;font-weight:700">Manage Clients <span style="color:#3b82f6">Smarter</span></div>
      <div style="height:40px;background:#1e293b;border-radius:6px;margin:8px 0;border:1px solid #334155;display:flex;align-items:center;justify-content:center;font-size:6px;opacity:.4">Dashboard Preview</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${['$9/mo','$29/mo','Custom'].map((p,i) => `<div style="background:#1e293b;border:1px solid ${i===1?'#3b82f6':'#334155'};border-radius:4px;padding:4px;text-align:center;font-size:6px;${i===1?'color:#3b82f6':'opacity:.6'}">${p}</div>`).join('')}</div>
    </div>
  `),

  'landing-vpn': base(`
    <div style="padding:12px;background:#0a1a0a">
      <div style="text-align:center"><div style="font-size:18px;margin-bottom:4px">🛡️</div><div style="font-size:12px;font-weight:700;color:#22c55e">Protect Your Privacy</div><div style="font-size:6px;color:#888;margin-top:2px">Military-grade encryption</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:8px">${['$12.99 1mo','$4.99 1yr','$2.99 2yr'].map((p,i) => `<div style="background:#111;border:1px solid ${i===2?'#22c55e':'#222'};border-radius:4px;padding:4px;text-align:center;font-size:5px;color:${i===2?'#22c55e':'#888'}">${p}</div>`).join('')}</div>
    </div>
  `, '#0a1a0a', '#fff'),

  'landing-travel': base(`
    <div style="padding:12px">
      <div style="font-size:12px;font-weight:700">Explore the <span style="color:#0ea5e9">World</span></div>
      <div style="display:flex;gap:3px;margin:6px 0"><div style="flex:1;height:14px;background:#1e293b;border-radius:4px"></div><div style="background:#0ea5e9;padding:2px 8px;border-radius:4px;font-size:6px;color:#fff">Search</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${['🗼 Paris','🏖️ Bali','🗽 NYC'].map(d => `<div style="height:36px;background:#1e293b;border-radius:4px;display:flex;align-items:end;padding:3px"><span style="font-size:5px;font-weight:600">${d}</span></div>`).join('')}</div>
    </div>
  `),

  'landing-law-firm': base(`
    <div style="padding:12px;background:#0a0a1a">
      <div style="font-size:12px;font-weight:700;color:#d4a853">SMITH & ASSOCIATES</div>
      <div style="font-size:6px;color:#888;margin:4px 0">Attorneys at Law</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:6px">${['Corporate','Criminal','Family','Immigration'].map(a => `<div style="background:#111;border:1px solid #222;border-radius:3px;padding:4px;font-size:5px;color:#d4a853;text-align:center">${a}</div>`).join('')}</div>
    </div>
  `, '#0a0a1a', '#fff'),

  'landing-dental': base(`
    <div style="padding:12px;background:#f0fdf4">
      <div style="text-align:center"><div style="font-size:14px;margin-bottom:4px">😁</div><div style="font-size:12px;font-weight:700;color:#0d9488">Bright Smile Dental</div></div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:8px">${['Cleaning','Whitening','Implants','Orthodontics'].map(s => `<div style="background:#fff;border:1px solid #e0f2e9;border-radius:4px;padding:4px;text-align:center;font-size:5px;color:#0d9488">${s}</div>`).join('')}</div>
      <div style="background:#0d9488;text-align:center;padding:4px;border-radius:4px;font-size:6px;color:#fff;margin-top:6px">Book Appointment</div>
    </div>
  `, '#f0fdf4', '#333'),

  'landing-pet': base(`
    <div style="padding:12px;background:#fff8f0">
      <div style="text-align:center;font-size:14px;margin-bottom:4px">🐾</div>
      <div style="text-align:center;font-size:12px;font-weight:700;color:#ea580c">Happy Paws</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:8px">${['🐕 Grooming','🏠 Boarding','🎓 Training','☀️ Daycare'].map(s => `<div style="background:#fff;border:1px solid #fed7aa;border-radius:8px;padding:6px;text-align:center;font-size:5px;color:#ea580c">${s}</div>`).join('')}</div>
    </div>
  `, '#fff8f0', '#333'),

  'landing-music': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="height:50px;background:linear-gradient(135deg,#ec4899,#8b5cf6);border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:6px"><span style="font-size:16px">🎵</span></div>
      <div style="text-align:center;font-size:12px;font-weight:800;color:#fff">NEW ALBUM</div>
      <div style="text-align:center;font-size:6px;color:#ec4899;margin-top:2px">OUT NOW • Stream everywhere</div>
      <div style="display:flex;gap:4px;justify-content:center;margin-top:6px">${['▶ Listen','🎫 Tour'].map(b => `<div style="background:#1a1a1a;border:1px solid #333;padding:3px 8px;border-radius:4px;font-size:6px;color:#fff">${b}</div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'landing-charity': base(`
    <div style="padding:12px;background:#fffbeb">
      <div style="text-align:center;font-size:12px;font-weight:700;color:#b45309">Making a Difference</div>
      <div style="display:flex;gap:6px;justify-content:center;margin:8px 0">${[['12K','Lives'],['45','Countries'],['200','Projects']].map(([v,l]) => `<div style="text-align:center"><div style="font-size:10px;font-weight:800;color:#b45309">${v}</div><div style="font-size:5px;color:#92400e">${l}</div></div>`).join('')}</div>
      <div style="display:flex;gap:2px;justify-content:center">${['$10','$25','$50','$100'].map(a => `<div style="background:#b45309;padding:3px 6px;border-radius:3px;font-size:6px;color:#fff">${a}</div>`).join('')}</div>
    </div>
  `, '#fffbeb', '#333'),

  'landing-construction': base(`
    <div style="padding:12px;background:#1a1a1a">
      <div style="font-size:12px;font-weight:800;color:#fbbf24">BUILD CO.</div>
      <div style="font-size:6px;color:#888;margin:4px 0">Construction & Engineering</div>
      <div style="height:40px;background:linear-gradient(135deg,#78350f,#451a03);border-radius:4px;margin-top:6px;display:flex;align-items:center;justify-content:center"><span style="font-size:7px;color:#fbbf24">🏗️ 200+ Projects Completed</span></div>
    </div>
  `, '#1a1a1a', '#fff'),

  'landing-car-dealer': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="font-size:10px;font-weight:700;color:#ef4444">🚗 AUTO MOTORS</div>
      <div style="height:40px;background:linear-gradient(135deg,#1e293b,#334155);border-radius:6px;margin:6px 0;display:flex;align-items:center;justify-content:center;font-size:16px">🏎️</div>
      <div style="display:flex;gap:3px">${[1,2,3].map(i => `<div style="flex:1;background:#111;border-radius:3px;padding:3px;font-size:5px;text-align:center;color:#888">$${i*15}K</div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'landing-hotel': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="text-align:center;font-size:12px;font-weight:300;letter-spacing:3px;color:#d4a853">GRAND HOTEL</div>
      <div style="height:40px;background:linear-gradient(135deg,#1a1a2e,#0f172a);border-radius:6px;margin:8px 0;border:1px solid #d4a85330;display:flex;align-items:center;justify-content:center"><span style="font-size:7px;color:#d4a853">⭐⭐⭐⭐⭐</span></div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px">${['Standard $199','Suite $499'].map(r => `<div style="background:#111;border:1px solid #222;border-radius:3px;padding:4px;text-align:center;font-size:5px;color:#d4a853">${r}</div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'landing-gaming': base(`
    <div style="padding:12px;background:#0a0014">
      <div style="text-align:center;font-size:14px;font-weight:800;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent">JOIN THE BATTLE</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:8px">${['🎮 FPS','⚔️ MOBA','🔫 BR','🧙 RPG'].map(g => `<div style="background:#1a1a2e;border:1px solid #a855f720;border-radius:4px;padding:6px;text-align:center;font-size:6px;color:#a855f7">${g}</div>`).join('')}</div>
    </div>
  `, '#0a0014', '#fff'),

  'landing-portfolio-agency': base(`
    <div style="padding:16px;background:#000">
      <div style="font-size:16px;font-weight:800;color:#fff;line-height:1.1">We<br>Design<br><span style="color:#888">Things.</span></div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:10px">${[1,2,3,4].map(i => `<div style="height:24px;background:#${i%2?'111':'1a1a1a'};border-radius:2px"></div>`).join('')}</div>
    </div>
  `, '#000', '#fff'),

  'landing-fintech-app': base(`
    <div style="padding:12px;background:#050510">
      <div style="display:flex;gap:8px;align-items:center"><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#22c55e">FinApp</div><div style="font-size:6px;color:#888;margin-top:2px">2M+ Users</div></div><div style="width:30px;height:50px;background:#111;border-radius:6px;border:1px solid #333"></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:8px">${['⚡ Instant','💰 Cashback','🔒 Secure'].map(f => `<div style="background:#0a1a0a;border:1px solid #22c55e20;border-radius:3px;padding:4px;text-align:center;font-size:5px;color:#22c55e">${f}</div>`).join('')}</div>
    </div>
  `, '#050510', '#fff'),

  'landing-blockchain': base(`
    <div style="padding:12px;background:#050510">
      <div style="text-align:center;font-size:10px;font-weight:700;background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">CHAINCORE</div>
      <div style="display:flex;gap:6px;justify-content:center;margin:8px 0">${[['100K','TPS'],['500','Validators'],['1K+','dApps']].map(([v,l]) => `<div style="text-align:center"><div style="font-size:8px;font-weight:700;color:#3b82f6">${v}</div><div style="font-size:4px;color:#888">${l}</div></div>`).join('')}</div>
    </div>
  `, '#050510', '#fff'),

  'landing-fashion-brand': base(`
    <div style="padding:12px;background:#faf9f6">
      <div style="text-align:center;font-size:14px;font-weight:300;letter-spacing:4px;color:#222;margin-bottom:6px">LUXE</div>
      <div style="height:60px;background:linear-gradient(135deg,#d4a7b0,#c9a9ca);border-radius:2px;display:flex;align-items:end;padding:6px"><span style="font-size:8px;color:#fff;font-weight:600">New Collection</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:6px">${[1,2,3].map(i => `<div style="height:32px;background:hsl(${i*40+300},20%,85%);border-radius:2px"></div>`).join('')}</div>
    </div>
  `, '#faf9f6', '#222'),

  'landing-crypto-exchange': base(`
    <div style="padding:12px;background:#050510">
      <div style="font-size:10px;font-weight:700;color:#22c55e">CryptoX Exchange</div>
      <div style="display:flex;gap:4px;margin:6px 0;font-size:5px">${[{s:'BTC',p:'$67K',c:'↑1.2%'},{s:'ETH',p:'$3.4K',c:'↑3.1%'}].map(t => `<div style="background:#111;border-radius:3px;padding:3px;flex:1"><span style="color:#fff">${t.s}</span> <span style="color:#888">${t.p}</span> <span style="color:#22c55e">${t.c}</span></div>`).join('')}</div>
      <div style="background:#22c55e;text-align:center;padding:4px;border-radius:4px;font-size:7px;font-weight:600;color:#000">Start Trading</div>
    </div>
  `, '#050510', '#fff'),

  'landing-delivery': base(`
    <div style="padding:12px;background:#fff">
      <div style="font-size:12px;font-weight:700;color:#ea580c">🍔 FoodDash</div>
      <div style="display:flex;gap:3px;margin:6px 0">${['🍕','🍣','🌮','🍜'].map(f => `<div style="flex:1;background:#fff7ed;border-radius:8px;padding:6px;text-align:center;font-size:14px">${f}</div>`).join('')}</div>
      <div style="background:#ea580c;text-align:center;padding:4px;border-radius:8px;font-size:6px;color:#fff">Order Now</div>
    </div>
  `, '#fff', '#222'),

  'landing-coworking': base(`
    <div style="padding:12px;background:#f0fdf4">
      <div style="font-size:10px;font-weight:700;color:#16a34a">🏢 CoWork Hub</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:6px">${['Hot Desk $99','Dedicated $199','Private $399','Virtual $49'].map(p => `<div style="background:#fff;border:1px solid #e0f2e9;border-radius:4px;padding:4px;font-size:5px;color:#16a34a;text-align:center">${p}</div>`).join('')}</div>
    </div>
  `, '#f0fdf4', '#333'),

  'landing-saas-analytics': base(`
    <div style="padding:12px">
      <div style="font-size:10px;font-weight:700">📊 AnalyticsPro</div>
      <div style="background:#1e293b;border-radius:6px;padding:6px;margin:6px 0;height:40px;display:flex;align-items:end;gap:2px">${[30,50,35,65,45,70,55,80].map(h => `<div style="flex:1;background:#3b82f6;border-radius:2px 2px 0 0;height:${h}%"></div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${['$9','$29','$79'].map((p,i) => `<div style="background:#1e293b;border:1px solid ${i===1?'#3b82f6':'#334155'};border-radius:4px;padding:3px;text-align:center;font-size:7px;${i===1?'color:#3b82f6':''}">${p}</div>`).join('')}</div>
    </div>
  `),

  'landing-insurance': base(`
    <div style="padding:12px;background:#eff6ff">
      <div style="font-size:10px;font-weight:700;color:#1d4ed8">🛡️ SecureLife Insurance</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:6px">${['🚗 Auto','🏠 Home','❤️ Life','🏥 Health'].map(t => `<div style="background:#fff;border:1px solid #bfdbfe;border-radius:4px;padding:6px;text-align:center;font-size:5px;color:#1d4ed8">${t}</div>`).join('')}</div>
      <div style="background:#1d4ed8;text-align:center;padding:4px;border-radius:4px;font-size:6px;color:#fff;margin-top:6px">Get Quote</div>
    </div>
  `, '#eff6ff', '#1d4ed8'),

  'landing-marketplace': base(`
    <div style="padding:12px;background:#fff">
      <div style="font-size:10px;font-weight:700;color:#ea580c">🏪 MarketPlace</div>
      <div style="display:flex;gap:3px;margin:6px 0"><div style="flex:1;height:14px;background:#f3f4f6;border-radius:4px"></div><div style="background:#ea580c;padding:2px 6px;border-radius:4px;font-size:6px;color:#fff">🔍</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[1,2,3].map(i => `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:3px;text-align:center"><div style="font-size:6px;font-weight:600;color:#333">Item ${i}</div><div style="font-size:5px;color:#ea580c">$${i*12}</div></div>`).join('')}</div>
    </div>
  `, '#fff', '#222'),

  'landing-cybersecurity': base(`
    <div style="padding:12px;background:#001a00">
      <div style="font-size:10px;font-weight:700;color:#22c55e">🔒 CyberShield</div>
      <div style="background:#002200;border:1px solid #22c55e20;border-radius:6px;padding:8px;margin:6px 0;font-family:monospace;font-size:5px;color:#22c55e40">$ scanning network...<br>$ threats detected: 0<br>$ status: SECURE ✓</div>
    </div>
  `, '#001a00', '#22c55e'),

  // ═══════════════════════════════════════════
  // E-COMMERCE — Additional Previews
  // ═══════════════════════════════════════════
  'ecommerce-electronics': base(`
    <div style="padding:12px;background:#111">
      <div style="font-size:9px;font-weight:700;color:#3b82f6">⚡ TechShop</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:6px">${['📱','💻','🎧'].map((e,i) => `<div style="background:#1a1a1a;border-radius:4px;padding:6px;text-align:center"><div style="font-size:16px">${e}</div><div style="font-size:5px;color:#888;margin-top:2px">$${(i+1)*299}</div></div>`).join('')}</div>
    </div>
  `, '#111', '#fff'),

  'ecommerce-marketplace': base(`
    <div style="padding:12px;background:#fff">
      <div style="display:flex;gap:3px;margin-bottom:6px"><div style="flex:1;height:14px;background:#f3f4f6;border-radius:6px"></div><div style="background:#ef4444;padding:2px 6px;border-radius:4px;font-size:6px;color:#fff">Sell</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[1,2,3,4,5,6].map(i => `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden"><div style="height:20px;background:hsl(${i*50},40%,90%)"></div><div style="padding:3px"><div style="font-size:5px;font-weight:600;color:#333">Product</div><div style="font-size:5px;color:#ef4444">$${i*8}</div></div></div>`).join('')}</div>
    </div>
  `, '#fff', '#222'),

  'ecommerce-food': base(`
    <div style="padding:12px;background:#fffbeb">
      <div style="font-size:10px;font-weight:700;color:#b45309">🥗 FreshMart</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:6px">${['🥑','🍎','🥖','🧀','🥩','🍫'].map((f,i) => `<div style="background:#fff;border:1px solid #fde68a;border-radius:4px;padding:4px;text-align:center"><div style="font-size:12px">${f}</div><div style="font-size:5px;color:#b45309">$${(i+1)*2.5}</div></div>`).join('')}</div>
    </div>
  `, '#fffbeb', '#333'),

  'ecommerce-digital': base(`
    <div style="padding:12px;background:#0a0a1a">
      <div style="font-size:9px;font-weight:700;color:#a855f7">📦 DigiStore</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:6px">${['📱 App','📄 Template','🎨 Design','📚 Course'].map(p => `<div style="background:#111;border:1px solid #a855f720;border-radius:4px;padding:6px;text-align:center;font-size:6px;color:#a855f7">${p}</div>`).join('')}</div>
    </div>
  `, '#0a0a1a', '#fff'),

  'ecommerce-dropshipping': base(`
    <div style="padding:12px;background:#fff">
      <div style="font-size:9px;font-weight:700;color:#10b981">🚚 DropShip Pro</div>
      <div style="display:flex;gap:3px;margin:6px 0">${['Hot','Trending','New'].map((t,i) => `<div style="font-size:5px;padding:2px 6px;border-radius:8px;${i===0?'background:#10b981;color:#fff':'background:#f3f4f6;color:#666'}">${t}</div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[1,2,3].map(i => `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:3px;text-align:center"><div style="height:18px;background:#e5e7eb;border-radius:2px;margin-bottom:2px"></div><div style="font-size:5px;color:#10b981">$${i*15}</div></div>`).join('')}</div>
    </div>
  `, '#fff', '#222'),

  'ecommerce-booking': base(`
    <div style="padding:12px">
      <div style="font-size:9px;font-weight:700">🎫 BookItNow</div>
      <div style="background:#1e293b;border-radius:6px;padding:6px;margin-top:6px">${['📅 Select Date','👥 Guests','🏨 Room Type'].map(f => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #334155;font-size:5px"><span>${f}</span><span style="opacity:.4">Select</span></div>`).join('')}<div style="background:#3b82f6;text-align:center;padding:4px;border-radius:4px;font-size:6px;color:#fff;margin-top:4px">Search</div></div>
    </div>
  `),

  'ecommerce-subscription': base(`
    <div style="padding:12px">
      <div style="font-size:9px;font-weight:700">📦 SubBox</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:6px">${['$19 Basic','$39 Premium','$59 Ultimate'].map((b,i) => `<div style="background:#1e293b;border:1px solid ${i===1?'#8b5cf6':'#334155'};border-radius:6px;padding:6px;text-align:center"><div style="font-size:8px;font-weight:700;color:#8b5cf6">${b.split(' ')[0]}</div><div style="font-size:5px;opacity:.5;margin-top:2px">${b.split(' ')[1]}</div></div>`).join('')}</div>
    </div>
  `),

  'ecommerce-auction': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="font-size:9px;font-weight:700;color:#fbbf24">🔨 AuctionHub</div>
      <div style="background:#111;border:1px solid #fbbf2420;border-radius:6px;padding:6px;margin-top:6px"><div style="font-size:6px;color:#888">Current Bid</div><div style="font-size:14px;font-weight:800;color:#fbbf24">$1,250</div><div style="font-size:5px;color:#ef4444;margin-top:2px">⏱ Ends in 02:34:18</div><div style="background:#fbbf24;text-align:center;padding:3px;border-radius:3px;font-size:6px;color:#000;font-weight:600;margin-top:4px">Place Bid</div></div>
    </div>
  `, '#0a0a0a', '#fff'),

  'ecommerce-grocery': base(`
    <div style="padding:12px;background:#fff">
      <div style="font-size:9px;font-weight:700;color:#16a34a">🛒 FreshGrocer</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-top:6px">${['🍎','🥦','🍞','🥛','🍗','🧅','🍌','🥕'].map((f,i) => `<div style="background:#f0fdf4;border-radius:4px;padding:4px;text-align:center"><div style="font-size:10px">${f}</div><div style="font-size:4px;color:#16a34a">$${(i+1)*0.99}</div></div>`).join('')}</div>
    </div>
  `, '#fff', '#222'),

  'ecommerce-pet-shop': base(`
    <div style="padding:12px;background:#fff8f0">
      <div style="font-size:9px;font-weight:700;color:#ea580c">🐾 PetWorld</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:6px">${['🦴 Toys','🥩 Food','🛁 Care'].map(c => `<div style="background:#fff;border:1px solid #fed7aa;border-radius:4px;padding:5px;text-align:center;font-size:5px;color:#ea580c">${c}</div>`).join('')}</div>
    </div>
  `, '#fff8f0', '#333'),

  'ecommerce-jewelry': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="text-align:center;font-size:12px;font-weight:300;letter-spacing:4px;color:#d4a853">JEWELS</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:8px">${['💍','📿','⌚'].map(j => `<div style="height:36px;background:#111;border:1px solid #d4a85320;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px">${j}</div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'ecommerce-furniture': base(`
    <div style="padding:12px;background:#fafaf5">
      <div style="font-size:10px;font-weight:300;letter-spacing:2px;color:#555">HOMESTYLE</div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:4px;margin-top:6px"><div style="height:50px;background:#e8e0d0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px">🛋️</div><div style="display:flex;flex-direction:column;gap:4px">${[1,2].map(() => `<div style="flex:1;background:#e8e0d0;border-radius:3px"></div>`).join('')}</div></div>
    </div>
  `, '#fafaf5', '#333'),

  'ecommerce-sports': base(`
    <div style="padding:12px;background:#111">
      <div style="font-size:10px;font-weight:800;color:#fff">SPORT<span style="color:#ef4444">X</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:6px">${['👟','⚽','🏋️'].map((s,i) => `<div style="background:#1a1a1a;border-radius:4px;padding:6px;text-align:center"><div style="font-size:14px">${s}</div><div style="font-size:5px;color:#ef4444;margin-top:2px">$${(i+1)*49}</div></div>`).join('')}</div>
    </div>
  `, '#111', '#fff'),

  // ═══════════════════════════════════════════
  // DASHBOARDS — Additional Previews
  // ═══════════════════════════════════════════
  'dashboard-crm': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#1e293b;padding:4px">${['📊','👤','📧','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="font-size:7px;font-weight:600;margin-bottom:4px">Sales Pipeline</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px">${['Lead','Qualified','Proposal','Won'].map((s,i) => `<div style="background:#1e293b;border-radius:3px;padding:3px"><div style="font-size:4px;font-weight:600;color:${['#f59e0b','#3b82f6','#8b5cf6','#22c55e'][i]}">${s}</div><div style="font-size:8px;font-weight:700;color:${['#f59e0b','#3b82f6','#8b5cf6','#22c55e'][i]}">${[12,8,5,3][i]}</div></div>`).join('')}</div></div></div>
  `),

  'dashboard-ecommerce': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#1e293b;padding:4px">${['📊','📦','👥','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:4px">${[{l:'Revenue',v:'$24K',c:'#22c55e'},{l:'Orders',v:'342',c:'#3b82f6'},{l:'Customers',v:'1.2K',c:'#8b5cf6'}].map(m => `<div style="background:#1e293b;padding:4px;border-radius:3px"><div style="font-size:4px;opacity:.5">${m.l}</div><div style="font-size:8px;font-weight:700;color:${m.c}">${m.v}</div></div>`).join('')}</div><div style="background:#1e293b;border-radius:3px;padding:3px;font-size:5px"><div style="opacity:.4;margin-bottom:2px">Recent Orders</div>${['#4521 $89','#4520 $245'].map(o => `<div style="padding:2px 0;border-bottom:1px solid #0f172a">${o}</div>`).join('')}</div></div></div>
  `),

  'dashboard-social-media': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#1e293b;padding:4px">${['📊','📱','📅','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-bottom:6px">${[{n:'IG',v:'45K',c:'#e1306c'},{n:'X',v:'12K',c:'#fff'},{n:'FB',v:'30K',c:'#1877f2'},{n:'TT',v:'89K',c:'#ff0050'}].map(s => `<div style="background:#1e293b;padding:3px;border-radius:3px;text-align:center"><div style="font-size:4px;color:${s.c}">${s.n}</div><div style="font-size:7px;font-weight:700">${s.v}</div></div>`).join('')}</div></div></div>
  `),

  'dashboard-finance': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#1e293b;padding:4px">${['💰','📊','📄','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:4px">${[{l:'Revenue',v:'$84K',c:'#22c55e'},{l:'Expenses',v:'$62K',c:'#ef4444'},{l:'Profit',v:'$22K',c:'#3b82f6'}].map(m => `<div style="background:#1e293b;padding:4px;border-radius:3px"><div style="font-size:4px;opacity:.5">${m.l}</div><div style="font-size:8px;font-weight:700;color:${m.c}">${m.v}</div></div>`).join('')}</div></div></div>
  `),

  'dashboard-healthcare': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#eff6ff;padding:4px">${['🏥','👥','📅','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px;background:#f8fafc"><div style="font-size:7px;font-weight:600;color:#1d4ed8;margin-bottom:4px">Today's Schedule</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[{l:'Patients',v:'24',c:'#3b82f6'},{l:'Beds',v:'85%',c:'#22c55e'},{l:'Critical',v:'3',c:'#ef4444'}].map(m => `<div style="background:#fff;padding:4px;border-radius:4px;border:1px solid #e2e8f0"><div style="font-size:4px;color:#666">${m.l}</div><div style="font-size:9px;font-weight:700;color:${m.c}">${m.v}</div></div>`).join('')}</div></div></div>
  `, '#f8fafc', '#333'),

  'dashboard-hr': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#1e293b;padding:4px">${['👥','📊','📅','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:4px">${[{l:'Employees',v:'248',c:'#8b5cf6'},{l:'Open Roles',v:'12',c:'#f59e0b'},{l:'Attendance',v:'96%',c:'#22c55e'}].map(m => `<div style="background:#1e293b;padding:4px;border-radius:3px"><div style="font-size:4px;opacity:.5">${m.l}</div><div style="font-size:8px;font-weight:700;color:${m.c}">${m.v}</div></div>`).join('')}</div></div></div>
  `),

  'dashboard-logistics': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#1e293b;padding:4px">${['🚚','📦','🗺️','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-bottom:4px">${[{l:'On Time',v:'89%',c:'#22c55e'},{l:'Transit',v:'124',c:'#3b82f6'},{l:'Delayed',v:'8',c:'#ef4444'},{l:'Done',v:'456',c:'#8b5cf6'}].map(m => `<div style="background:#1e293b;padding:3px;border-radius:3px"><div style="font-size:3px;opacity:.5">${m.l}</div><div style="font-size:7px;font-weight:700;color:${m.c}">${m.v}</div></div>`).join('')}</div></div></div>
  `),

  'dashboard-school': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#1e293b;padding:4px">${['🎓','📚','👥','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="font-size:7px;font-weight:600;margin-bottom:4px">📚 School Dashboard</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[{l:'Students',v:'1.2K',c:'#3b82f6'},{l:'Teachers',v:'86',c:'#22c55e'},{l:'Avg Grade',v:'B+',c:'#f59e0b'}].map(m => `<div style="background:#1e293b;padding:4px;border-radius:3px;text-align:center"><div style="font-size:4px;opacity:.5">${m.l}</div><div style="font-size:9px;font-weight:700;color:${m.c}">${m.v}</div></div>`).join('')}</div></div></div>
  `),

  'dashboard-iot': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#0a1a2e;padding:4px">${['📡','🌡️','💡','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px;background:#0a0a1a"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[{l:'Temp',v:'24°C',c:'#06b6d4'},{l:'Humidity',v:'62%',c:'#22c55e'},{l:'Devices',v:'48',c:'#f59e0b'}].map(m => `<div style="background:#111;border:1px solid ${m.c}30;border-radius:4px;padding:4px;text-align:center"><div style="font-size:4px;color:${m.c}">${m.l}</div><div style="font-size:9px;font-weight:700;color:${m.c}">${m.v}</div></div>`).join('')}</div></div></div>
  `, '#0a0a1a', '#fff'),

  'dashboard-marketing': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#1e293b;padding:4px">${['📈','🎯','📧','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:4px">${[{l:'ROI',v:'245%',c:'#22c55e'},{l:'Leads',v:'1.8K',c:'#3b82f6'},{l:'Cost',v:'$4.2K',c:'#f59e0b'}].map(m => `<div style="background:#1e293b;padding:4px;border-radius:3px"><div style="font-size:4px;opacity:.5">${m.l}</div><div style="font-size:8px;font-weight:700;color:${m.c}">${m.v}</div></div>`).join('')}</div></div></div>
  `),

  'dashboard-crypto-trading': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#0a0a0a;padding:4px">${['📊','💰','🔔','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px;background:#050505"><div style="font-size:6px;opacity:.5;margin-bottom:2px">Portfolio Value</div><div style="font-size:14px;font-weight:800;color:#22c55e;margin-bottom:4px">$142,580</div><div style="height:40px;display:flex;align-items:end;gap:1px;margin-bottom:4px">${[30,45,35,60,40,55,70,50,65,80,55,75].map(h => `<div style="flex:1;background:#22c55e40;border-radius:1px 1px 0 0;height:${h}%"></div>`).join('')}</div></div></div>
  `, '#050505', '#fff'),

  // ═══════════════════════════════════════════
  // PORTFOLIOS — Additional Previews
  // ═══════════════════════════════════════════
  'portfolio-photographer': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="text-align:center;font-size:10px;font-weight:300;letter-spacing:3px;color:#fff;margin-bottom:8px">JOHN LENS</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px">${[1,2,3,4,5,6].map(i => `<div style="height:${i%2?28:36}px;background:hsl(${i*40},30%,${25+i*5}%);border-radius:1px"></div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'portfolio-freelancer': base(`
    <div style="padding:12px">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6)"></div><div><div style="font-size:8px;font-weight:700">Alex Dev</div><div style="font-size:5px;color:#22c55e">Available for Hire</div></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${['Web Dev $100/hr','Design $80/hr','Consult $120/hr'].map(s => `<div style="background:#1e293b;border-radius:4px;padding:4px;text-align:center;font-size:4px">${s}</div>`).join('')}</div>
    </div>
  `),

  'portfolio-architect': base(`
    <div style="padding:12px;background:#f5f0eb">
      <div style="font-size:12px;font-weight:300;letter-spacing:3px;color:#555">ARCH STUDIO</div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:4px;margin-top:8px"><div style="height:50px;background:#d4c5b5;border-radius:2px"></div><div style="height:50px;background:#c9baa8;border-radius:2px"></div></div>
    </div>
  `, '#f5f0eb', '#333'),

  'portfolio-3d-artist': base(`
    <div style="padding:12px;background:#0a0a14">
      <div style="font-size:10px;font-weight:700;background:linear-gradient(135deg,#a855f7,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">3D ARTIST</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:6px">${[1,2,3,4].map(i => `<div style="height:30px;background:linear-gradient(${i*90}deg,#1a1a2e,#2a1a3e);border-radius:4px"></div>`).join('')}</div>
    </div>
  `, '#0a0a14', '#fff'),

  'portfolio-musician': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="height:50px;background:linear-gradient(135deg,#dc2626,#991b1b);border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:6px"><span style="font-size:18px">🎸</span></div>
      <div style="font-size:10px;font-weight:700;color:#fff;text-align:center">ROCK BAND</div>
      <div style="display:flex;gap:4px;justify-content:center;margin-top:4px">${['▶ Play','🎫 Tour'].map(b => `<div style="background:#1a1a1a;border:1px solid #333;padding:2px 6px;border-radius:3px;font-size:5px;color:#fff">${b}</div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'portfolio-writer': base(`
    <div style="padding:16px;background:#faf8f5">
      <div style="text-align:center;font-family:serif;font-size:14px;font-weight:400;color:#333">Sarah Writer</div>
      <div style="text-align:center;font-size:6px;color:#888;margin-top:2px">Author & Journalist</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px">${[1,2,3].map(() => `<div style="height:40px;background:#e8e0d0;border-radius:2px"></div>`).join('')}</div>
    </div>
  `, '#faf8f5', '#333'),

  'portfolio-video': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="font-size:10px;font-weight:300;letter-spacing:2px;color:#fff">FILMWORKS</div>
      <div style="height:60px;background:#111;border-radius:4px;margin:6px 0;display:flex;align-items:center;justify-content:center;border:1px solid #222"><div style="width:24px;height:24px;border-radius:50%;background:#fff20;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px">▶</div></div>
    </div>
  `, '#0a0a0a', '#fff'),

  // ═══════════════════════════════════════════
  // FAUCETS — Additional Previews
  // ═══════════════════════════════════════════
  'faucet-btc': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#f7931a;margin-bottom:6px">₿ Bitcoin Faucet</div>
      <div style="background:#111;border:1px solid #f7931a30;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#f7931a">500 satoshis</div><div style="font-size:5px;color:#888;margin:4px 0">⏱ Claim every 60 min</div><div style="background:#f7931a;padding:3px 12px;border-radius:4px;font-size:6px;color:#000;font-weight:600;display:inline-block">CLAIM</div></div>
    </div>
  `, '#0a0a0a', '#fff'),

  'faucet-eth': base(`
    <div style="padding:12px;background:#0a0a1a">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#627eea;margin-bottom:6px">Ξ Ethereum Faucet</div>
      <div style="background:#111;border:1px solid #627eea30;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#627eea">0.001 ETH</div><div style="background:#627eea;padding:3px 12px;border-radius:4px;font-size:6px;color:#fff;font-weight:600;display:inline-block;margin-top:6px">CLAIM</div></div>
    </div>
  `, '#0a0a1a', '#fff'),

  'faucet-sol': base(`
    <div style="padding:12px;background:#0a0014">
      <div style="text-align:center;font-size:10px;font-weight:700;background:linear-gradient(135deg,#9945ff,#14f195);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px">◎ Solana Faucet</div>
      <div style="background:#111;border:1px solid #9945ff30;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#14f195">0.01 SOL</div><div style="background:linear-gradient(135deg,#9945ff,#14f195);padding:3px 12px;border-radius:4px;font-size:6px;color:#fff;font-weight:600;display:inline-block;margin-top:6px">CLAIM NOW</div></div>
    </div>
  `, '#0a0014', '#fff'),

  'faucet-doge': base(`
    <div style="padding:12px;background:#1a1500">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#c2a633;margin-bottom:6px">🐕 Dogecoin Faucet</div>
      <div style="background:#111;border:1px solid #c2a63330;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#c2a633">10 DOGE</div><div style="font-size:5px;color:#888;margin:2px 0">Much wow! Very crypto!</div><div style="background:#c2a633;padding:3px 12px;border-radius:4px;font-size:6px;color:#000;font-weight:600;display:inline-block;margin-top:4px">CLAIM</div></div>
    </div>
  `, '#1a1500', '#fff'),

  'faucet-bnb': base(`
    <div style="padding:12px;background:#0a0a00">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#f0b90b;margin-bottom:6px">🔶 BNB Faucet</div>
      <div style="background:#111;border:1px solid #f0b90b30;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#f0b90b">0.005 BNB</div><div style="background:#f0b90b;padding:3px 12px;border-radius:4px;font-size:6px;color:#000;font-weight:600;display:inline-block;margin-top:6px">CLAIM</div></div>
    </div>
  `, '#0a0a00', '#fff'),

  'faucet-tron': base(`
    <div style="padding:12px;background:#0a0000">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#ef0027;margin-bottom:6px">TRON Faucet</div>
      <div style="background:#111;border:1px solid #ef002730;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#ef0027">5 TRX</div><div style="background:#ef0027;padding:3px 12px;border-radius:4px;font-size:6px;color:#fff;font-weight:600;display:inline-block;margin-top:6px">CLAIM</div></div>
    </div>
  `, '#0a0000', '#fff'),

  'faucet-matic': base(`
    <div style="padding:12px;background:#0a001a">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#8247e5;margin-bottom:6px">🟣 Polygon Faucet</div>
      <div style="background:#111;border:1px solid #8247e530;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#8247e5">0.1 MATIC</div><div style="background:#8247e5;padding:3px 12px;border-radius:4px;font-size:6px;color:#fff;font-weight:600;display:inline-block;margin-top:6px">CLAIM</div></div>
    </div>
  `, '#0a001a', '#fff'),

  'faucet-avax': base(`
    <div style="padding:12px;background:#0a0000">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#e84142;margin-bottom:6px">🔺 Avalanche Faucet</div>
      <div style="background:#111;border:1px solid #e8414230;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#e84142">0.05 AVAX</div><div style="background:#e84142;padding:3px 12px;border-radius:4px;font-size:6px;color:#fff;font-weight:600;display:inline-block;margin-top:6px">CLAIM</div></div>
    </div>
  `, '#0a0000', '#fff'),

  'faucet-ada': base(`
    <div style="padding:12px;background:#001a2e">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#0033ad;margin-bottom:6px">♦️ Cardano Faucet</div>
      <div style="background:#0a1a2e;border:1px solid #0033ad30;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#3b82f6">2 ADA</div><div style="background:#0033ad;padding:3px 12px;border-radius:4px;font-size:6px;color:#fff;font-weight:600;display:inline-block;margin-top:6px">CLAIM</div></div>
    </div>
  `, '#001a2e', '#fff'),

  'faucet-xrp': base(`
    <div style="padding:12px;background:#001020">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#23292f;margin-bottom:6px">XRP Faucet</div>
      <div style="background:#0a1a2e;border:1px solid #ffffff20;border-radius:6px;padding:8px;text-align:center"><div style="font-size:12px;font-weight:800;color:#fff">1 XRP</div><div style="font-size:5px;color:#888;margin:2px 0">3-5 second settlement</div><div style="background:#3b82f6;padding:3px 12px;border-radius:4px;font-size:6px;color:#fff;font-weight:600;display:inline-block;margin-top:4px">CLAIM</div></div>
    </div>
  `, '#001020', '#fff'),

  'faucet-gaming': base(`
    <div style="padding:12px;background:#0a0014">
      <div style="text-align:center;font-size:10px;font-weight:700;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px">🎮 Gaming Faucet</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${['🎲 Dice','🔢 Guess','🪙 Flip'].map(g => `<div style="background:#111;border:1px solid #a855f720;border-radius:4px;padding:6px;text-align:center;font-size:5px;color:#a855f7">${g}</div>`).join('')}</div>
      <div style="text-align:center;font-size:5px;color:#888;margin-top:4px">Level 5 · 2,400 XP</div>
    </div>
  `, '#0a0014', '#fff'),

  'faucet-survey': base(`
    <div style="padding:12px">
      <div style="font-size:9px;font-weight:700;color:#22c55e">💰 Survey Faucet</div>
      <div style="margin-top:6px">${['📝 Quick Survey — $0.50','📱 App Install — $1.00','🎥 Watch Video — $0.25'].map(t => `<div style="background:#1e293b;border-radius:4px;padding:4px;margin-bottom:2px;font-size:5px;display:flex;justify-content:space-between"><span>${t.split('—')[0]}</span><span style="color:#22c55e">${t.split('—')[1]}</span></div>`).join('')}</div>
    </div>
  `),

  'faucet-testnet': base(`
    <div style="padding:12px;background:#111">
      <div style="font-size:9px;font-weight:700;color:#888">🔧 Testnet Faucet</div>
      <div style="margin-top:6px"><div style="display:flex;gap:2px;margin-bottom:4px">${['Goerli','Sepolia','Mumbai'].map((n,i) => `<div style="font-size:5px;padding:2px 4px;border-radius:3px;${i===0?'background:#3b82f6;color:#fff':'background:#1e293b;color:#888'}">${n}</div>`).join('')}</div><div style="height:14px;background:#1e293b;border-radius:4px;margin-bottom:4px"></div><div style="background:#3b82f6;text-align:center;padding:3px;border-radius:3px;font-size:6px;color:#fff">Request Tokens</div></div>
    </div>
  `, '#111', '#fff'),



  'social-twitch': base(`
    <div style="display:flex;height:200px;background:#0e0e10">
      <div style="width:30px;background:#1f1f23;padding:4px">${[1,2,3].map(() => `<div style="width:16px;height:16px;border-radius:50%;background:#333;margin:4px auto"></div>`).join('')}</div>
      <div style="flex:1;padding:6px"><div style="height:80px;background:#18181b;border-radius:4px;display:flex;align-items:center;justify-content:center;margin-bottom:4px"><span style="font-size:7px;color:#9146ff">LIVE</span></div><div style="font-size:6px;font-weight:600;color:#fff">Streamer playing Game</div><div style="font-size:5px;color:#888">🔴 12.4K viewers</div></div>
      <div style="width:50px;background:#18181b;padding:4px"><div style="font-size:5px;color:#fff;margin-bottom:2px">Chat</div>${[1,2,3].map(() => `<div style="font-size:4px;color:#888;margin-bottom:2px"><span style="color:#9146ff">user</span>: msg</div>`).join('')}</div>
    </div>
  `, '#0e0e10', '#fff'),

  'social-threads': base(`
    <div style="padding:12px;background:#101010">
      <div style="text-align:center;font-size:12px;font-weight:700;color:#fff;margin-bottom:8px">@</div>
      ${[1,2].map(() => `<div style="border-bottom:1px solid #222;padding:6px 0"><div style="display:flex;gap:4px;align-items:center"><div style="width:16px;height:16px;border-radius:50%;background:#333"></div><div><span style="font-size:6px;font-weight:600;color:#fff">user</span><span style="font-size:5px;color:#888"> · 2h</span></div></div><div style="font-size:5px;color:#ccc;margin:3px 0 0 20px">Just shared my thoughts on...</div><div style="display:flex;gap:8px;margin:3px 0 0 20px">${['❤️','💬','🔄','↗️'].map(e => `<span style="font-size:6px;opacity:.4">${e}</span>`).join('')}</div></div>`).join('')}
    </div>
  `, '#101010', '#fff'),

  'social-mastodon': base(`
    <div style="display:flex;height:200px;background:#191b22">
      <div style="width:40px;background:#282c37;padding:4px">${['🏠','🔍','🔔','📧'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div>
      <div style="flex:1;padding:6px"><div style="font-size:8px;font-weight:600;color:#fff;margin-bottom:4px">Home</div>${[1,2].map(() => `<div style="background:#313543;border-radius:4px;padding:4px;margin-bottom:3px"><div style="display:flex;gap:3px"><div style="width:14px;height:14px;border-radius:4px;background:#6364ff"></div><div style="font-size:5px;color:#fff">user@mastodon</div></div><div style="font-size:5px;color:#9baec8;margin-top:2px">A toot about federation...</div></div>`).join('')}</div>
    </div>
  `, '#191b22', '#9baec8'),

  'social-bereal': base(`
    <div style="padding:12px;background:#000;text-align:center">
      <div style="font-size:10px;font-weight:700;color:#fff;margin-bottom:6px">BeReal.</div>
      <div style="height:80px;background:#1a1a1a;border-radius:10px;position:relative;margin-bottom:6px"><div style="position:absolute;top:4px;left:4px;width:24px;height:32px;background:#333;border-radius:6px;border:2px solid #000"></div></div>
      <div style="font-size:5px;color:#888">⏱ You're 2h late</div>
    </div>
  `, '#000', '#fff'),

  'social-clubhouse': base(`
    <div style="padding:12px;background:#f0ebe3">
      <div style="font-size:10px;font-weight:700;color:#553b08;margin-bottom:6px">🎙️ Clubhouse</div>
      <div style="background:#fff;border-radius:10px;padding:8px;margin-bottom:4px"><div style="font-size:7px;font-weight:600;color:#333">Tech Talk Room</div><div style="font-size:5px;color:#888;margin:2px 0">🟢 Live · 142 listeners</div><div style="display:flex;gap:3px;margin-top:4px">${[1,2,3].map(() => `<div style="width:16px;height:16px;border-radius:50%;background:#e8e0d0"></div>`).join('')}</div></div>
    </div>
  `, '#f0ebe3', '#333'),

  'social-medium': base(`
    <div style="padding:12px;background:#fff">
      <div style="text-align:center;font-size:14px;font-weight:400;font-family:serif;color:#222;margin-bottom:8px">Medium</div>
      ${[1,2].map(() => `<div style="border-bottom:1px solid #eee;padding:6px 0"><div style="display:flex;gap:6px"><div style="flex:1"><div style="font-size:7px;font-weight:700;color:#222;font-family:serif">Article Title Here</div><div style="font-size:5px;color:#888;margin-top:2px">A brief description of this piece...</div><div style="font-size:4px;color:#888;margin-top:2px">5 min read · 👏 234</div></div><div style="width:24px;height:24px;background:#f3f4f6;border-radius:2px"></div></div></div>`).join('')}
    </div>
  `, '#fff', '#222'),

  'social-quora': base(`
    <div style="padding:12px;background:#fff">
      <div style="font-size:10px;font-weight:700;color:#b92b27;margin-bottom:8px">Quora</div>
      ${[1,2].map(i => `<div style="border-bottom:1px solid #eee;padding:4px 0"><div style="font-size:7px;font-weight:600;color:#222">Question ${i}?</div><div style="font-size:5px;color:#888;margin:2px 0">An expert answer with detailed explanation...</div><div style="display:flex;gap:6px;font-size:5px;color:#888"><span>▲ 42</span><span>💬 8</span></div></div>`).join('')}
    </div>
  `, '#fff', '#222'),

  'social-tumblr': base(`
    <div style="padding:12px;background:#001935">
      <div style="font-size:10px;font-weight:700;color:#fff;margin-bottom:6px">tumblr</div>
      <div style="background:#00264d;border-radius:4px;overflow:hidden;margin-bottom:4px"><div style="height:40px;background:linear-gradient(135deg,#e74c3c,#9b59b6)"></div><div style="padding:4px"><div style="font-size:6px;font-weight:600;color:#fff">blog-name</div><div style="font-size:5px;color:#8899a6">♻️ reblogged · ❤️ 1,234</div></div></div>
    </div>
  `, '#001935', '#fff'),

  'social-wechat': base(`
    <div style="display:flex;height:200px;background:#ebebeb">
      <div style="width:60px;background:#fff;border-right:1px solid #e0e0e0;padding:4px">${['Mom','Group','John'].map(n => `<div style="display:flex;gap:3px;padding:3px 0;border-bottom:1px solid #f0f0f0"><div style="width:14px;height:14px;border-radius:4px;background:#07c160"></div><div style="font-size:5px;color:#333">${n}</div></div>`).join('')}</div>
      <div style="flex:1;background:#ebebeb;padding:6px"><div style="background:#fff;border-radius:6px;padding:4px;margin-bottom:3px;font-size:5px;color:#333;max-width:70%">Hello! 👋</div><div style="background:#95ec69;border-radius:6px;padding:4px;font-size:5px;color:#333;max-width:70%;margin-left:auto">Hi there!</div></div>
    </div>
  `, '#ebebeb', '#333'),

  'social-signal': base(`
    <div style="display:flex;height:200px;background:#1b1b1b">
      <div style="width:60px;background:#1b1b1b;border-right:1px solid #333;padding:4px">${['🔒 Alice','🔒 Bob','🔒 Group'].map(n => `<div style="padding:3px 0;border-bottom:1px solid #333;font-size:5px;color:#fff">${n}</div>`).join('')}</div>
      <div style="flex:1;padding:6px"><div style="background:#2c6bed;border-radius:6px;padding:4px;margin-bottom:3px;font-size:5px;color:#fff;max-width:70%;margin-left:auto">Encrypted message 🔐</div><div style="background:#333;border-radius:6px;padding:4px;font-size:5px;color:#fff;max-width:70%">Secure reply</div></div>
    </div>
  `, '#1b1b1b', '#fff'),

  'social-kick': base(`
    <div style="display:flex;height:200px;background:#0e0e10">
      <div style="flex:1;padding:6px"><div style="height:90px;background:#141414;border-radius:4px;display:flex;align-items:center;justify-content:center;margin-bottom:4px"><span style="font-size:10px;font-weight:700;color:#53fc18">🔴 LIVE</span></div><div style="font-size:6px;font-weight:600;color:#fff">Streamer Name</div><div style="font-size:5px;color:#53fc18">Gaming · 5.2K viewers</div></div>
      <div style="width:50px;background:#141414;padding:4px"><div style="font-size:5px;color:#53fc18;margin-bottom:2px">Chat</div>${[1,2,3].map(() => `<div style="font-size:4px;color:#888;margin-bottom:2px"><span style="color:#53fc18">user</span>: GG</div>`).join('')}</div>
    </div>
  `, '#0e0e10', '#fff'),

  'social-bluesky': base(`
    <div style="padding:12px;background:#fff">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#0085ff;margin-bottom:8px">🦋 Bluesky</div>
      ${[1,2].map(() => `<div style="border-bottom:1px solid #eee;padding:6px 0"><div style="display:flex;gap:4px"><div style="width:16px;height:16px;border-radius:50%;background:#e0f0ff"></div><div><div style="font-size:6px;font-weight:600;color:#222">user.bsky.social</div><div style="font-size:5px;color:#666;margin-top:2px">A post about decentralized social...</div></div></div></div>`).join('')}
    </div>
  `, '#fff', '#222'),

  'social-lemon8': base(`
    <div style="padding:12px;background:#fff">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#8bc34a;margin-bottom:6px">🍋 Lemon8</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px">${[1,2,3,4].map(i => `<div style="height:${i%2?40:32}px;background:hsl(${60+i*20},70%,85%);border-radius:6px"></div>`).join('')}</div>
    </div>
  `, '#fff', '#222'),

  'social-letterboxd': base(`
    <div style="padding:12px;background:#14181c">
      <div style="font-size:9px;font-weight:700;color:#fff;margin-bottom:6px">Letterboxd</div>
      <div style="display:flex;gap:3px">${[1,2,3,4,5].map(i => `<div style="width:24px;height:36px;background:hsl(${i*70},50%,30%);border-radius:2px"></div>`).join('')}</div>
      <div style="font-size:5px;color:#9ab;margin-top:4px">★★★★☆ · Reviewed 2 days ago</div>
    </div>
  `, '#14181c', '#9ab'),

  'social-goodreads': base(`
    <div style="padding:12px;background:#f4f1ea">
      <div style="font-size:10px;font-weight:400;font-family:serif;color:#382110;margin-bottom:6px">goodreads</div>
      <div style="display:flex;gap:4px">${[1,2,3].map(i => `<div style="width:24px;height:36px;background:hsl(${30+i*20},40%,60%);border-radius:2px;border:1px solid #d5c8a8"></div>`).join('')}</div>
      <div style="font-size:5px;color:#999;margin-top:4px">📚 Reading Challenge: 12/24 books</div>
    </div>
  `, '#f4f1ea', '#382110'),

  'social-strava': base(`
    <div style="padding:12px;background:#fff">
      <div style="font-size:10px;font-weight:700;color:#fc4c02;margin-bottom:6px">STRAVA</div>
      <div style="background:#f7f7f7;border-radius:6px;padding:6px"><div style="font-size:7px;font-weight:600;color:#333">Morning Run 🏃</div><div style="display:flex;gap:6px;margin-top:4px;font-size:5px">${[['5.2 km','Distance'],['25:30','Time'],["4'54\"", 'Pace']].map(([v,l]) => `<div><div style="font-weight:700;color:#333">${v}</div><div style="color:#999">${l}</div></div>`).join('')}</div></div>
    </div>
  `, '#fff', '#333'),

  'social-nextdoor': base(`
    <div style="padding:12px;background:#fff">
      <div style="font-size:10px;font-weight:700;color:#8ed500;margin-bottom:6px">nextdoor</div>
      ${['🔒 Safety Alert — Car break-ins on Oak St','🆓 Free Items — Moving sale this weekend'].map(p => `<div style="background:#f7f7f7;border-radius:4px;padding:4px;margin-bottom:3px;font-size:5px;color:#333">${p}</div>`).join('')}
    </div>
  `, '#fff', '#333'),

  // ═══════════════════════════════════════════
  // BLOG — Additional Previews
  // ═══════════════════════════════════════════
  'blog-personal': base(`
    <div style="padding:16px;background:#faf8f5;text-align:center">
      <div style="font-size:14px;font-weight:400;font-family:serif;color:#333">thoughts.</div>
      <div style="font-size:6px;color:#888;margin:6px 0">A personal blog about life and code</div>
      ${[1,2].map(() => `<div style="text-align:left;border-bottom:1px solid #e8e0d0;padding:6px 0"><div style="font-size:7px;font-weight:600;color:#333;font-family:serif">Post Title</div><div style="font-size:5px;color:#888">Jan 2025 · 3 min read</div></div>`).join('')}
    </div>
  `, '#faf8f5', '#333'),

  'blog-tech': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="font-size:10px;font-weight:700;color:#06b6d4;margin-bottom:6px">{'<'} TechBlog {'>'}</div>
      <div style="background:#111;border:1px solid #06b6d420;border-radius:6px;padding:6px;margin-bottom:4px"><div style="font-size:6px;font-weight:600;color:#fff">Building a REST API</div><div style="font-size:5px;color:#06b6d4;margin-top:2px">Advanced · 12 min read</div><div style="background:#1a1a2e;border-radius:3px;padding:3px;margin-top:3px;font-family:monospace;font-size:4px;color:#22c55e">const api = express();</div></div>
    </div>
  `, '#0a0a0a', '#fff'),

  'blog-travel': base(`
    <div style="padding:12px;background:#fff">
      <div style="font-size:10px;font-weight:700;color:#0ea5e9">🌍 Wanderlust</div>
      <div style="height:50px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);border-radius:6px;margin:6px 0;display:flex;align-items:end;padding:6px"><span style="font-size:7px;color:#fff;font-weight:600">📍 Exploring Japan</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[1,2,3].map(i => `<div style="height:24px;background:hsl(${180+i*20},60%,80%);border-radius:3px"></div>`).join('')}</div>
    </div>
  `, '#fff', '#222'),

  'blog-food': base(`
    <div style="padding:12px;background:#fffbf0">
      <div style="font-size:10px;font-weight:700;color:#b45309">🍳 Kitchen Stories</div>
      <div style="height:50px;background:linear-gradient(135deg,#f59e0b,#ea580c);border-radius:6px;margin:6px 0;display:flex;align-items:center;justify-content:center;font-size:18px">🍝</div>
      <div style="font-size:6px;color:#333;font-weight:600">Classic Pasta Recipe</div>
      <div style="font-size:5px;color:#888">⏱ 30 min · 🍽️ 4 servings · ⭐ 4.8</div>
    </div>
  `, '#fffbf0', '#333'),

  'blog-news-portal': base(`
    <div style="background:#fff">
      <div style="background:#dc2626;text-align:center;padding:2px;font-size:5px;color:#fff;font-weight:700">⚡ BREAKING NEWS</div>
      <div style="padding:8px"><div style="font-size:12px;font-weight:800;color:#111;text-align:center;margin-bottom:6px">NEWS24</div><div style="display:grid;grid-template-columns:2fr 1fr;gap:4px"><div style="height:50px;background:#111;border-radius:3px;display:flex;align-items:end;padding:4px"><span style="font-size:6px;color:#fff;font-weight:600">Top Story</span></div><div style="display:flex;flex-direction:column;gap:3px">${[1,2].map(() => `<div style="flex:1;background:#f3f4f6;border-radius:2px;padding:2px"><div style="font-size:4px;font-weight:600;color:#333">Headline</div></div>`).join('')}</div></div></div>
    </div>
  `, '#fff', '#111'),

  // ═══════════════════════════════════════════
  // SAAS — Additional Previews
  // ═══════════════════════════════════════════
  'saas-email-marketing': base(`
    <div style="display:flex;height:200px"><div style="width:40px;background:#1e293b;padding:4px">${['📧','📊','👥','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="font-size:7px;font-weight:600;margin-bottom:4px">Campaigns</div>${['Newsletter #12 — Sent','Welcome Series — Active','Promo Q1 — Draft'].map((c,i) => `<div style="background:#1e293b;border-radius:3px;padding:3px;margin-bottom:2px;font-size:5px;display:flex;justify-content:space-between"><span>${c.split('—')[0]}</span><span style="color:${['#22c55e','#3b82f6','#888'][i]}">${c.split('—')[1]}</span></div>`).join('')}</div></div>
  `),

  'saas-helpdesk': base(`
    <div style="display:flex;height:200px"><div style="width:40px;background:#1e293b;padding:4px">${['🎫','📊','📚','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="font-size:7px;font-weight:600;margin-bottom:4px">Tickets</div>${[{t:'Login issue',p:'🔴',s:'Open'},{t:'Feature request',p:'🟡',s:'In Progress'},{t:'Bug report',p:'🟢',s:'Resolved'}].map(tk => `<div style="background:#1e293b;border-radius:3px;padding:3px;margin-bottom:2px;font-size:5px;display:flex;justify-content:space-between"><span>${tk.p} ${tk.t}</span><span style="color:#888">${tk.s}</span></div>`).join('')}</div></div>
  `),

  'saas-invoicing': base(`
    <div style="display:flex;height:200px"><div style="width:40px;background:#1e293b;padding:4px">${['📄','👥','💳','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="font-size:7px;font-weight:600;margin-bottom:4px">Invoices</div>${[{id:'#001',a:'$1,200',s:'Paid',c:'#22c55e'},{id:'#002',a:'$850',s:'Sent',c:'#3b82f6'},{id:'#003',a:'$2,400',s:'Overdue',c:'#ef4444'}].map(inv => `<div style="background:#1e293b;border-radius:3px;padding:3px;margin-bottom:2px;font-size:5px;display:flex;justify-content:space-between"><span>${inv.id} — ${inv.a}</span><span style="color:${inv.c}">${inv.s}</span></div>`).join('')}</div></div>
  `),

  'saas-scheduling': base(`
    <div style="padding:12px;background:#f8f5ff">
      <div style="font-size:10px;font-weight:700;color:#7c3aed">📅 ScheduleMe</div>
      <div style="background:#fff;border:1px solid #e9d5ff;border-radius:6px;padding:8px;margin-top:6px"><div style="font-size:7px;font-weight:600;color:#333;margin-bottom:4px">Select a time</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px">${['9:00','9:30','10:00','10:30','11:00','11:30'].map(t => `<div style="background:#f3e8ff;border-radius:3px;padding:3px;text-align:center;font-size:5px;color:#7c3aed">${t}</div>`).join('')}</div></div>
    </div>
  `, '#f8f5ff', '#333'),

  'saas-form-builder': base(`
    <div style="display:flex;height:200px"><div style="width:40px;background:#1e293b;padding:4px"><div style="font-size:5px;color:#888;margin-bottom:4px">Fields</div>${['Aa','📧','☑️','⭐'].map(f => `<div style="background:#111;border-radius:3px;padding:3px;margin-bottom:2px;text-align:center;font-size:6px">${f}</div>`).join('')}</div><div style="flex:1;padding:8px"><div style="font-size:7px;font-weight:600;margin-bottom:6px">Form Preview</div><div style="background:#1e293b;border-radius:4px;padding:4px;margin-bottom:3px"><div style="font-size:5px;opacity:.5;margin-bottom:2px">Name</div><div style="height:10px;background:#111;border-radius:2px"></div></div><div style="background:#1e293b;border-radius:4px;padding:4px"><div style="font-size:5px;opacity:.5;margin-bottom:2px">Email</div><div style="height:10px;background:#111;border-radius:2px"></div></div></div></div>
  `),

  // ═══════════════════════════════════════════
  // CRYPTO — Additional Previews
  // ═══════════════════════════════════════════
  'crypto-metamask': base(`
    <div style="padding:10px;background:#1a1a1a;max-width:120px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:6px;color:#e2761b">🦊 MetaMask</span><span style="font-size:4px;color:#888;background:#222;padding:1px 4px;border-radius:4px">Ethereum</span></div>
      <div style="text-align:center;margin-bottom:6px"><div style="font-size:12px;font-weight:800;color:#fff">2.45 ETH</div><div style="font-size:5px;color:#888">$8,330.00</div></div>
      <div style="display:flex;gap:3px">${['Send','Swap','Bridge'].map(a => `<div style="flex:1;background:#e2761b;border-radius:12px;padding:3px;text-align:center;font-size:5px;color:#fff">${a}</div>`).join('')}</div>
    </div>
  `, '#1a1a1a', '#fff'),

  'crypto-phantom': base(`
    <div style="padding:10px;background:#1a0a2e;max-width:120px;margin:0 auto">
      <div style="text-align:center;margin-bottom:6px"><div style="font-size:6px;color:#ab9ff2">👻 Phantom</div><div style="font-size:12px;font-weight:800;color:#fff;margin-top:4px">42.5 SOL</div><div style="font-size:5px;color:#888">$4,250.00</div></div>
      <div style="display:flex;gap:3px">${['Send','Receive','Swap'].map(a => `<div style="flex:1;background:#ab9ff2;border-radius:12px;padding:3px;text-align:center;font-size:5px;color:#000">${a}</div>`).join('')}</div>
    </div>
  `, '#1a0a2e', '#fff'),

  'crypto-trust': base(`
    <div style="padding:10px;background:#1a2035">
      <div style="text-align:center;font-size:6px;color:#3375bb;margin-bottom:4px">Trust Wallet</div>
      <div style="text-align:center;font-size:14px;font-weight:800;color:#fff;margin-bottom:6px">$12,450</div>
      <div style="display:flex;gap:3px;justify-content:center;margin-bottom:6px">${['Send','Receive','Buy'].map(a => `<div style="background:#3375bb;padding:3px 8px;border-radius:12px;font-size:5px;color:#fff">${a}</div>`).join('')}</div>
    </div>
  `, '#1a2035', '#fff'),

  'crypto-ledger': base(`
    <div style="padding:10px;background:#0a0a0a">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:7px;font-weight:700;color:#fff">Ledger Live</span><span style="font-size:5px;color:#22c55e">● Connected</span></div>
      <div style="font-size:12px;font-weight:800;color:#fff;margin-bottom:6px">$34,120</div>
      ${[{n:'Bitcoin',v:'$22K'},{n:'Ethereum',v:'$8K'}].map(a => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;font-size:5px"><span style="color:#fff">${a.n}</span><span style="color:#888">${a.v}</span></div>`).join('')}
    </div>
  `, '#0a0a0a', '#fff'),

  'crypto-nft-marketplace': base(`
    <div style="padding:10px;background:#0a0a14">
      <div style="font-size:9px;font-weight:700;color:#fff;margin-bottom:6px">🖼️ NFT Market</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[1,2,3].map(i => `<div style="border-radius:6px;overflow:hidden"><div style="height:30px;background:linear-gradient(${i*90+45}deg,hsl(${i*100},60%,40%),hsl(${i*100+60},60%,60%))"></div><div style="background:#1a1a2e;padding:3px"><div style="font-size:4px;color:#fff">NFT #${i*111}</div><div style="font-size:4px;color:#3b82f6">◎ ${(i*0.5).toFixed(1)}</div></div></div>`).join('')}</div>
    </div>
  `, '#0a0a14', '#fff'),

  'crypto-dex': base(`
    <div style="padding:12px;background:#0f0720">
      <div style="text-align:center;font-size:8px;font-weight:700;color:#ec4899;margin-bottom:6px">🦄 DEX Swap</div>
      <div style="background:#ffffff08;border:1px solid #ffffff15;border-radius:8px;padding:6px;margin-bottom:3px"><div style="font-size:5px;opacity:.4">From</div><div style="display:flex;justify-content:space-between"><span style="font-size:9px;font-weight:600;color:#fff">1.0</span><span style="font-size:6px;background:#ec489920;color:#ec4899;padding:2px 6px;border-radius:4px">ETH</span></div></div>
      <div style="text-align:center;font-size:8px;color:#888;margin:2px 0">↕</div>
      <div style="background:#ffffff08;border:1px solid #ffffff15;border-radius:8px;padding:6px"><div style="font-size:5px;opacity:.4">To</div><div style="display:flex;justify-content:space-between"><span style="font-size:9px;font-weight:600;color:#fff">3,420</span><span style="font-size:6px;background:#3b82f620;color:#3b82f6;padding:2px 6px;border-radius:4px">USDC</span></div></div>
    </div>
  `, '#0f0720', '#fff'),

  'crypto-launchpad': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="font-size:9px;font-weight:700;color:#fbbf24;margin-bottom:6px">🚀 LaunchPad</div>
      <div style="background:#111;border:1px solid #fbbf2420;border-radius:6px;padding:6px"><div style="font-size:7px;font-weight:700;color:#fff">ProjectX Token</div><div style="font-size:5px;color:#888;margin:2px 0">IDO starts in 2d 14h</div><div style="height:4px;background:#1a1a1a;border-radius:2px;overflow:hidden"><div style="width:35%;height:100%;background:#fbbf24"></div></div><div style="font-size:4px;color:#888;margin-top:2px">$350K / $1M</div></div>
    </div>
  `, '#0a0a0a', '#fff'),

  'crypto-bridge': base(`
    <div style="padding:12px;background:#0a0a1a">
      <div style="text-align:center;font-size:8px;font-weight:700;color:#3b82f6;margin-bottom:6px">🌉 Bridge</div>
      <div style="display:flex;gap:4px;align-items:center;justify-content:center;margin-bottom:6px"><div style="background:#627eea20;padding:3px 8px;border-radius:4px;font-size:6px;color:#627eea">Ethereum</div><span style="font-size:8px;color:#888">→</span><div style="background:#8247e520;padding:3px 8px;border-radius:4px;font-size:6px;color:#8247e5">Polygon</div></div>
      <div style="background:#111;border-radius:6px;padding:6px;text-align:center"><div style="font-size:10px;font-weight:700;color:#fff">1.0 ETH</div><div style="font-size:5px;color:#888;margin-top:2px">~2 min · Fee: $2.50</div></div>
    </div>
  `, '#0a0a1a', '#fff'),

  'crypto-portfolio-tracker': base(`
    <div style="padding:10px;background:#050505">
      <div style="font-size:7px;font-weight:600;margin-bottom:4px">📈 Portfolio</div>
      <div style="font-size:14px;font-weight:800;color:#22c55e;margin-bottom:4px">$142,580 <span style="font-size:6px">↑ 12.4%</span></div>
      ${[{n:'BTC',v:'$98K',p:'+2.1%'},{n:'ETH',v:'$32K',p:'+5.3%'},{n:'SOL',v:'$12K',p:'-1.2%'}].map(a => `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #1a1a1a;font-size:5px"><span>${a.n}</span><span>${a.v}</span><span style="color:${a.p.startsWith('+')?'#22c55e':'#ef4444'}">${a.p}</span></div>`).join('')}
    </div>
  `, '#050505', '#fff'),

  'crypto-staking': base(`
    <div style="padding:12px;background:#0a1a0a">
      <div style="font-size:9px;font-weight:700;color:#22c55e;margin-bottom:6px">🥩 Staking</div>
      ${[{n:'ETH',apy:'4.2%',tvl:'$2.1B'},{n:'SOL',apy:'6.8%',tvl:'$890M'}].map(p => `<div style="background:#111;border:1px solid #22c55e20;border-radius:4px;padding:4px;margin-bottom:3px;display:flex;justify-content:space-between;font-size:5px"><span style="color:#fff">${p.n}</span><span style="color:#22c55e">APY ${p.apy}</span><span style="color:#888">TVL ${p.tvl}</span></div>`).join('')}
    </div>
  `, '#0a1a0a', '#fff'),

  'crypto-lending': base(`
    <div style="padding:12px;background:#0f0720">
      <div style="font-size:9px;font-weight:700;color:#a855f7;margin-bottom:6px">🏦 Lending</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${[{t:'Supply',items:[{n:'USDC',r:'3.2%'},{n:'ETH',r:'1.8%'}]},{t:'Borrow',items:[{n:'USDC',r:'5.1%'},{n:'ETH',r:'3.4%'}]}].map(s => `<div><div style="font-size:5px;color:#888;margin-bottom:2px">${s.t}</div>${s.items.map(i => `<div style="background:#111;border-radius:3px;padding:3px;margin-bottom:2px;font-size:5px;display:flex;justify-content:space-between"><span style="color:#fff">${i.n}</span><span style="color:#a855f7">${i.r}</span></div>`).join('')}</div>`).join('')}</div>
    </div>
  `, '#0f0720', '#fff'),

  'crypto-dao': base(`
    <div style="padding:12px;background:#0f0720">
      <div style="font-size:9px;font-weight:700;color:#7c3aed;margin-bottom:6px">🏛️ DAO</div>
      ${['Proposal #42 — Increase treasury','Proposal #41 — New partnership'].map((p,i) => `<div style="background:#111;border-radius:4px;padding:4px;margin-bottom:3px"><div style="font-size:5px;color:#fff">${p}</div><div style="height:3px;background:#1a1a1a;border-radius:2px;margin-top:2px"><div style="width:${i===0?'68':'92'}%;height:100%;background:${i===0?'#22c55e':'#22c55e'};border-radius:2px"></div></div><div style="font-size:4px;color:#888;margin-top:1px">${i===0?'68% For':'92% For'} · ${i===0?'2d left':'Passed'}</div></div>`).join('')}
    </div>
  `, '#0f0720', '#fff'),

  'crypto-mining': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="font-size:9px;font-weight:700;color:#f59e0b;margin-bottom:6px">⛏️ Mining</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:4px">${[{l:'Hashrate',v:'120 MH/s',c:'#f59e0b'},{l:'Daily',v:'$12.40',c:'#22c55e'},{l:'Workers',v:'3/3',c:'#3b82f6'}].map(m => `<div style="background:#111;border-radius:3px;padding:3px;text-align:center"><div style="font-size:4px;color:#888">${m.l}</div><div style="font-size:6px;font-weight:700;color:${m.c}">${m.v}</div></div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'crypto-payment-gateway': base(`
    <div style="padding:12px;background:#0a0a1a">
      <div style="font-size:9px;font-weight:700;color:#3b82f6;margin-bottom:6px">💳 CryptoPay</div>
      <div style="background:#111;border-radius:6px;padding:6px"><div style="font-size:6px;color:#fff;margin-bottom:2px">Payment Link</div><div style="background:#1a1a2e;border-radius:3px;padding:3px;font-size:5px;color:#888;margin-bottom:4px">pay.crypto/inv-4521</div><div style="display:flex;gap:2px">${['BTC','ETH','USDC','SOL'].map(c => `<span style="font-size:4px;padding:1px 4px;background:#1e293b;border-radius:2px;color:#3b82f6">${c}</span>`).join('')}</div></div>
    </div>
  `, '#0a0a1a', '#fff'),

  'crypto-airdrop': base(`
    <div style="padding:12px;background:#0a0a14">
      <div style="font-size:9px;font-weight:700;background:linear-gradient(135deg,#ec4899,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px">🪂 Airdrops</div>
      ${['✅ Follow on X','✅ Join Discord','⬜ Use Protocol 3x','⬜ Hold 100+ tokens'].map(t => `<div style="font-size:5px;padding:2px 0;color:#888">${t}</div>`).join('')}
      <div style="font-size:5px;color:#22c55e;margin-top:4px">Est. value: $500-$2,000</div>
    </div>
  `, '#0a0a14', '#fff'),

  // ═══════════════════════════════════════════
  // BANKS — Additional Previews
  // ═══════════════════════════════════════════
  'bank-trading-app': base(`
    <div style="padding:10px;background:#050505">
      <div style="font-size:7px;font-weight:600;color:#22c55e;margin-bottom:4px">📈 Stocks</div>
      <div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:4px">$24,580</div>
      <div style="height:40px;display:flex;align-items:end;gap:1px;margin-bottom:4px">${[30,45,40,60,55,70,65,80,75,85].map(h => `<div style="flex:1;background:#22c55e40;border-radius:1px 1px 0 0;height:${h}%"></div>`).join('')}</div>
      ${[{t:'AAPL',p:'$178',c:'+1.2%'},{t:'TSLA',p:'$248',c:'+2.8%'}].map(s => `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:5px;border-bottom:1px solid #1a1a1a"><span style="color:#fff">${s.t}</span><span>${s.p}</span><span style="color:#22c55e">${s.c}</span></div>`).join('')}
    </div>
  `, '#050505', '#fff'),

  'bank-insurance': base(`
    <div style="padding:12px;background:#eff6ff">
      <div style="font-size:9px;font-weight:700;color:#1d4ed8">🛡️ InsurTech</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:6px">${['🚗 Auto','🏠 Home','❤️ Life','🏥 Health'].map(p => `<div style="background:#fff;border:1px solid #bfdbfe;border-radius:6px;padding:6px;text-align:center;font-size:5px;color:#1d4ed8">${p}</div>`).join('')}</div>
    </div>
  `, '#eff6ff', '#1d4ed8'),

  'bank-budget': base(`
    <div style="padding:12px;background:#f0fdf4">
      <div style="font-size:9px;font-weight:700;color:#16a34a">💰 Budget Tracker</div>
      <div style="background:#fff;border-radius:6px;padding:6px;margin-top:6px">${[{c:'Housing',p:45,cl:'#3b82f6'},{c:'Food',p:25,cl:'#22c55e'},{c:'Transport',p:15,cl:'#f59e0b'},{c:'Fun',p:15,cl:'#ec4899'}].map(b => `<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px"><div style="width:6px;height:6px;border-radius:1px;background:${b.cl}"></div><div style="flex:1;font-size:5px;color:#333">${b.c}</div><div style="width:50px;height:4px;background:#e5e7eb;border-radius:2px"><div style="width:${b.p}%;height:100%;background:${b.cl};border-radius:2px"></div></div></div>`).join('')}</div>
    </div>
  `, '#f0fdf4', '#333'),

  'bank-p2p-lending': base(`
    <div style="padding:12px">
      <div style="font-size:9px;font-weight:700;color:#3b82f6">🤝 P2P Lending</div>
      ${[{a:'$5,000',r:'8.5%',g:'A'},{a:'$12,000',r:'12%',g:'C'}].map(l => `<div style="background:#1e293b;border-radius:4px;padding:4px;margin-top:3px;display:flex;justify-content:space-between;font-size:5px"><span>${l.a}</span><span style="color:#22c55e">${l.r} APR</span><span style="color:${l.g==='A'?'#22c55e':'#f59e0b'}">Grade ${l.g}</span></div>`).join('')}
    </div>
  `),

  'bank-payment-app': base(`
    <div style="padding:12px;background:#0a0a1a">
      <div style="text-align:center;font-size:10px;font-weight:700;color:#3b82f6;margin-bottom:6px">💸 PayApp</div>
      <div style="text-align:center;font-size:16px;font-weight:800;color:#fff;margin-bottom:6px">$2,450.00</div>
      <div style="display:flex;gap:4px;justify-content:center">${['Send','Request','QR'].map(a => `<div style="background:#3b82f6;padding:4px 10px;border-radius:12px;font-size:5px;color:#fff">${a}</div>`).join('')}</div>
    </div>
  `, '#0a0a1a', '#fff'),

  'bank-wealth': base(`
    <div style="padding:12px;background:#0a0a0a">
      <div style="font-size:9px;font-weight:300;letter-spacing:2px;color:#d4a853">WEALTH</div>
      <div style="font-size:14px;font-weight:800;color:#fff;margin:4px 0">$1.2M</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${[{l:'Stocks',v:'45%'},{l:'Real Est.',v:'30%'},{l:'Bonds',v:'25%'}].map(a => `<div style="background:#111;border:1px solid #d4a85320;border-radius:3px;padding:3px;text-align:center;font-size:5px;color:#d4a853"><div>${a.l}</div><div style="font-weight:700">${a.v}</div></div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'bank-remittance': base(`
    <div style="padding:12px;background:#f0fdf4">
      <div style="font-size:9px;font-weight:700;color:#16a34a">🌍 Money Transfer</div>
      <div style="background:#fff;border-radius:6px;padding:6px;margin-top:6px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><div style="font-size:6px"><div style="font-weight:600;color:#333">You send</div><div style="font-size:10px;font-weight:700;color:#333">$1,000 USD</div></div><div style="font-size:8px;color:#888">→</div><div style="font-size:6px;text-align:right"><div style="font-weight:600;color:#333">They get</div><div style="font-size:10px;font-weight:700;color:#22c55e">€920 EUR</div></div></div></div>
    </div>
  `, '#f0fdf4', '#333'),

  'bank-mortgage': base(`
    <div style="padding:12px">
      <div style="font-size:9px;font-weight:700">🏠 Mortgage Calculator</div>
      <div style="background:#1e293b;border-radius:6px;padding:6px;margin-top:6px">${[{l:'Loan Amount',v:'$350,000'},{l:'Rate',v:'6.5%'},{l:'Monthly',v:'$2,212'}].map(f => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #334155;font-size:5px"><span style="opacity:.5">${f.l}</span><span style="font-weight:600">${f.v}</span></div>`).join('')}</div>
    </div>
  `),

  'bank-expense': base(`
    <div style="padding:12px">
      <div style="font-size:9px;font-weight:700">📋 Expenses</div>
      ${[{n:'Flight to NYC',a:'$420',s:'Pending'},{n:'Client Dinner',a:'$185',s:'Approved'}].map(e => `<div style="background:#1e293b;border-radius:3px;padding:4px;margin-top:3px;display:flex;justify-content:space-between;font-size:5px"><span>${e.n}</span><span>${e.a}</span><span style="color:${e.s==='Approved'?'#22c55e':'#f59e0b'}">${e.s}</span></div>`).join('')}
    </div>
  `),

  'bank-crypto-bank': base(`
    <div style="padding:12px;background:#0a0a1a">
      <div style="font-size:9px;font-weight:700;background:linear-gradient(135deg,#8b5cf6,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">🏦 CryptoBank</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:6px">${[{c:'USD',v:'$5,200',r:'5.2% APY'},{c:'BTC',v:'0.15',r:'2.1% APY'},{c:'ETH',v:'2.4',r:'3.8% APY'},{c:'USDC',v:'$8,000',r:'8.5% APY'}].map(a => `<div style="background:#111;border:1px solid #8b5cf620;border-radius:4px;padding:4px"><div style="font-size:5px;color:#fff">${a.c}</div><div style="font-size:7px;font-weight:700;color:#fff">${a.v}</div><div style="font-size:4px;color:#22c55e">${a.r}</div></div>`).join('')}</div>
    </div>
  `, '#0a0a1a', '#fff'),

  'bank-payroll': base(`
    <div style="display:flex;height:200px"><div style="width:36px;background:#1e293b;padding:4px">${['👥','💰','📊','⚙️'].map(e => `<div style="text-align:center;margin:6px 0;font-size:7px">${e}</div>`).join('')}</div><div style="flex:1;padding:6px"><div style="font-size:7px;font-weight:600;margin-bottom:4px">Payroll Run</div>${[{n:'Alice',s:'$4,500'},{n:'Bob',s:'$3,800'},{n:'Carol',s:'$5,200'}].map(e => `<div style="background:#1e293b;border-radius:3px;padding:3px;margin-bottom:2px;display:flex;justify-content:space-between;font-size:5px"><span>${e.n}</span><span style="color:#22c55e">${e.s}</span></div>`).join('')}</div></div>
  `),

  'bank-robo-advisor': base(`
    <div style="padding:12px">
      <div style="font-size:9px;font-weight:700;color:#3b82f6">🤖 Robo-Advisor</div>
      <div style="background:#1e293b;border-radius:6px;padding:6px;margin-top:6px"><div style="font-size:5px;opacity:.5;margin-bottom:2px">Recommended Portfolio</div><div style="display:flex;gap:2px;height:12px;margin-bottom:4px"><div style="width:40%;background:#3b82f6;border-radius:2px"></div><div style="width:30%;background:#22c55e;border-radius:2px"></div><div style="width:20%;background:#f59e0b;border-radius:2px"></div><div style="width:10%;background:#ef4444;border-radius:2px"></div></div><div style="display:flex;gap:4px;font-size:4px">${['Stocks 40%','Bonds 30%','Real Est 20%','Cash 10%'].map(l => `<span style="opacity:.6">${l}</span>`).join('')}</div></div>
    </div>
  `),

  'bank-open-banking': base(`
    <div style="padding:12px">
      <div style="font-size:9px;font-weight:700;color:#06b6d4">🔗 Open Banking</div>
      ${['🏦 Chase — $12,400','🏦 BofA — $8,200','🏦 Wells — $3,100'].map(b => `<div style="background:#1e293b;border-radius:4px;padding:4px;margin-top:3px;font-size:5px">${b}</div>`).join('')}
      <div style="font-size:6px;font-weight:700;color:#06b6d4;margin-top:4px;text-align:right">Total: $23,700</div>
    </div>
  `),

  'bank-islamic': base(`
    <div style="padding:12px;background:#0a1a0a">
      <div style="font-size:9px;font-weight:700;color:#22c55e">☪️ Islamic Bank</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:6px">${['Murabaha','Ijara','Sukuk','Zakat'].map(p => `<div style="background:#111;border:1px solid #22c55e20;border-radius:4px;padding:5px;text-align:center;font-size:5px;color:#22c55e">${p}</div>`).join('')}</div>
    </div>
  `, '#0a1a0a', '#fff'),

  'bank-kids': base(`
    <div style="padding:12px;background:#fef0ff">
      <div style="text-align:center;font-size:14px;margin-bottom:4px">🐷</div>
      <div style="text-align:center;font-size:10px;font-weight:700;color:#d946ef">Kids Bank!</div>
      <div style="text-align:center;font-size:14px;font-weight:800;color:#d946ef;margin:4px 0">$42.50</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${['🎮 Game $30','✈️ Trip $100','📚 Book $15'].map(g => `<div style="background:#fff;border:1px solid #f0abfc;border-radius:8px;padding:4px;text-align:center;font-size:4px;color:#d946ef">${g}</div>`).join('')}</div>
    </div>
  `, '#fef0ff', '#333'),

  // ═══════════════════════════════════════════
  // GAMES 2D — Additional Previews
  // ═══════════════════════════════════════════
  'game2d-racing': base(`
    <div style="height:200px;background:#333;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,#1a1a1a 0%,#333 100%)"></div>
      <div style="position:absolute;left:50%;top:0;bottom:0;width:2px;background:repeating-linear-gradient(180deg,#fff 0px,#fff 10px,transparent 10px,transparent 20px)"></div>
      <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);font-size:16px">🏎️</div>
      <div style="position:absolute;top:60px;left:30%;font-size:12px">🚗</div>
      <div style="position:absolute;top:30px;right:30%;font-size:12px">🚙</div>
      <div style="position:absolute;top:6px;right:6px;font-size:6px;color:#fff">🏁 Lap 2/3</div>
      <div style="position:absolute;top:6px;left:6px;font-size:6px;color:#22c55e">⚡ 120 mph</div>
    </div>
  `, '#333', '#fff'),

  'game2d-breakout': base(`
    <div style="height:200px;background:#0a0a0a;position:relative;overflow:hidden;padding:6px">
      <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:2px;margin-bottom:10px">${Array.from({length:24}).map((_,i) => `<div style="height:6px;background:hsl(${i*15},80%,50%);border-radius:1px"></div>`).join('')}</div>
      <div style="position:absolute;top:50%;left:50%;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 6px #fff"></div>
      <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:36px;height:6px;background:linear-gradient(90deg,#06b6d4,#3b82f6);border-radius:3px"></div>
      <div style="position:absolute;top:6px;right:6px;font-size:6px;color:#fff">Score: 1200</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'game2d-pong': base(`
    <div style="height:200px;background:#000;position:relative;overflow:hidden">
      <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:repeating-linear-gradient(180deg,#fff 0px,#fff 6px,transparent 6px,transparent 12px)"></div>
      <div style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:4px;height:30px;background:#fff;border-radius:2px;box-shadow:0 0 8px #ec489980"></div>
      <div style="position:absolute;right:10px;top:40%;transform:translateY(-50%);width:4px;height:30px;background:#fff;border-radius:2px;box-shadow:0 0 8px #06b6d480"></div>
      <div style="position:absolute;top:50%;left:55%;width:5px;height:5px;border-radius:50%;background:#fff;box-shadow:0 0 10px #fff"></div>
      <div style="position:absolute;top:10px;left:30%;font-size:16px;font-weight:800;color:#ec4899">3</div>
      <div style="position:absolute;top:10px;right:30%;font-size:16px;font-weight:800;color:#06b6d4">5</div>
    </div>
  `, '#000', '#fff'),

  'game2d-tower-defense': base(`
    <div style="height:200px;background:#2d5016;position:relative;overflow:hidden">
      <div style="position:absolute;top:40px;left:0;width:60px;height:16px;background:#8b7355;border-radius:0 8px 8px 0"></div>
      <div style="position:absolute;top:40px;left:60px;width:16px;height:60px;background:#8b7355"></div>
      <div style="position:absolute;top:84px;left:60px;width:60px;height:16px;background:#8b7355"></div>
      <div style="position:absolute;top:84px;right:0;width:40px;height:16px;background:#8b7355;border-radius:8px 0 0 8px"></div>
      <div style="position:absolute;top:30px;left:80px;font-size:12px">🏰</div>
      <div style="position:absolute;top:32px;left:20px;width:8px;height:8px;border-radius:50%;background:#ef4444"></div>
      <div style="position:absolute;top:6px;left:6px;font-size:5px;color:#fff">Wave 5 · Gold: 250</div>
    </div>
  `, '#2d5016', '#fff'),

  'game2d-match3': base(`
    <div style="padding:6px;background:#1a0030;text-align:center">
      <div style="font-size:8px;font-weight:700;color:#ec4899;margin-bottom:4px">💎 MATCH</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:2px;width:90px;margin:0 auto">${Array.from({length:36}).map((_,i) => `<div style="width:100%;aspect-ratio:1;background:hsl(${(i*37)%360},70%,50%);border-radius:3px;font-size:6px;display:flex;align-items:center;justify-content:center">${['💎','⭐','🔥','💜','🟢','🔵'][i%6]}</div>`).join('')}</div>
      <div style="font-size:5px;color:#888;margin-top:4px">Score: 4,200 · Moves: 12</div>
    </div>
  `, '#1a0030', '#fff'),

  'game2d-maze': base(`
    <div style="height:200px;background:#0a0a14;position:relative;overflow:hidden">
      <div style="position:absolute;inset:10px;border:2px solid #334155;border-radius:4px">
        <div style="position:absolute;top:20px;left:20px;right:40%;height:2px;background:#334155"></div>
        <div style="position:absolute;top:50px;right:20px;left:40%;height:2px;background:#334155"></div>
        <div style="position:absolute;top:80px;left:20px;right:30%;height:2px;background:#334155"></div>
        <div style="position:absolute;top:20px;left:50%;width:2px;height:30px;background:#334155"></div>
        <div style="position:absolute;top:50px;left:30%;width:2px;height:30px;background:#334155"></div>
      </div>
      <div style="position:absolute;top:30px;left:30px;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e"></div>
      <div style="position:absolute;bottom:20px;right:20px;font-size:8px">🔑</div>
      <div style="position:absolute;top:6px;left:6px;font-size:5px;color:#888">⏱ 01:24</div>
    </div>
  `, '#0a0a14', '#fff'),

  // ═══════════════════════════════════════════
  // GAMES 3D — Previews
  // ═══════════════════════════════════════════
  'game3d-fps': base(`
    <div style="height:200px;background:linear-gradient(180deg,#1a1a2e 0%,#2a2a3e 100%);position:relative;overflow:hidden">
      <div style="position:absolute;bottom:0;width:100%;height:60px;background:#2d2d4e;border-top:1px solid #3a3a5e"></div>
      ${[{x:30,h:80,w:20},{x:70,h:60,w:16},{x:120,h:70,w:18}].map(b => `<div style="position:absolute;bottom:60px;left:${b.x}px;width:${b.w}px;height:${b.h}px;background:#333358;border:1px solid #3a3a6e"></div>`).join('')}
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"><div style="width:2px;height:12px;background:#22c55e;position:absolute;top:-6px;left:-1px"></div><div style="width:12px;height:2px;background:#22c55e;position:absolute;top:-1px;left:-6px"></div></div>
      <div style="position:absolute;bottom:6px;left:6px;font-size:5px;color:#fff">HP: 100 | Ammo: 30/90</div>
      <div style="position:absolute;top:6px;right:6px;font-size:6px;color:#ef4444">Score: 450</div>
    </div>
  `, '#1a1a2e', '#fff'),

  'game3d-racing': base(`
    <div style="height:200px;background:linear-gradient(180deg,#87ceeb 0%,#87ceeb 50%,#4a7a2e 70%,#333 85%,#333 100%);position:relative;overflow:hidden">
      <div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);width:80px;height:8px;background:#555;border-radius:2px;transform:perspective(100px) rotateX(20deg)"></div>
      <div style="position:absolute;bottom:35px;left:50%;transform:translateX(-50%);font-size:16px">🏎️</div>
      <div style="position:absolute;top:6px;left:6px;font-size:6px;color:#fff;text-shadow:1px 1px 2px #000">LAP 2/3 · 120 mph</div>
    </div>
  `),

  'game3d-minecraft': base(`
    <div style="height:200px;background:linear-gradient(180deg,#87ceeb 0%,#87ceeb 40%,#4a7a2e 60%,#8b6f47 80%,#555 100%);position:relative;overflow:hidden">
      <div style="position:absolute;top:20px;left:60px;width:20px;height:20px;background:#8b6f47;border:1px solid #6b5335"></div>
      <div style="position:absolute;top:0;left:60px;width:20px;height:20px;background:#2d5016;border:1px solid #1a3a0a"></div>
      <div style="position:absolute;top:20px;left:80px;width:20px;height:20px;background:#2d5016;border:1px solid #1a3a0a"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"><div style="width:1px;height:10px;background:#fff;position:absolute;top:-5px;left:0"></div><div style="width:10px;height:1px;background:#fff;position:absolute;top:0;left:-5px"></div></div>
      <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:2px">${['🟫','🟩','⬜','💎'].map((b,i) => `<div style="width:16px;height:16px;background:#00000060;border:1px solid ${i===0?'#fff':'#ffffff40'};border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:8px">${b}</div>`).join('')}</div>
    </div>
  `),

  'game3d-flight': base(`
    <div style="height:200px;background:linear-gradient(180deg,#1a3a5f 0%,#87ceeb 50%,#4a7a2e 90%);position:relative;overflow:hidden">
      <div style="position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);font-size:20px">✈️</div>
      <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:5px;color:#fff;text-shadow:1px 1px 2px #000">ALT: 5,200ft · SPD: 340kts</div>
    </div>
  `),

  'game3d-dungeon': base(`
    <div style="height:200px;background:#0a0a0a;position:relative;overflow:hidden">
      <div style="position:absolute;inset:20px;background:radial-gradient(circle at center,#2a1a0a 0%,#0a0a0a 70%)"></div>
      <div style="position:absolute;top:50%;left:30%;width:20px;height:20px;background:#1a1a1a;border:1px solid #333"></div>
      <div style="position:absolute;top:50%;right:30%;width:20px;height:20px;background:#1a1a1a;border:1px solid #333"></div>
      <div style="position:absolute;top:30%;left:50%;transform:translateX(-50%);font-size:14px">🧟</div>
      <div style="position:absolute;bottom:6px;left:6px;font-size:5px;color:#ef4444">❤️❤️❤️ | ⚔️ 15 DMG</div>
      <div style="position:absolute;bottom:6px;right:6px;font-size:5px;color:#fbbf24">💰 120 Gold</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'game3d-golf': base(`
    <div style="height:200px;background:linear-gradient(180deg,#87ceeb 0%,#87ceeb 50%,#22c55e 60%,#16a34a 100%);position:relative;overflow:hidden">
      <div style="position:absolute;top:55%;right:25%;width:8px;height:20px;background:#333;border-radius:1px"></div>
      <div style="position:absolute;top:48%;right:24%;width:8px;height:8px;background:#ef4444;border-radius:50%"></div>
      <div style="position:absolute;bottom:30%;left:30%;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 4px #fff"></div>
      <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:6px;color:#fff;text-shadow:1px 1px 2px #000">Hole 3 · Par 4 · Stroke 2</div>
    </div>
  `),

  'game3d-tank': base(`
    <div style="height:200px;background:linear-gradient(180deg,#4a5568 0%,#2d3748 50%,#4a6a3a 70%,#2d5016 100%);position:relative;overflow:hidden">
      <div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);font-size:16px">🪖</div>
      <div style="position:absolute;top:40px;right:30px;font-size:12px">💥</div>
      <div style="position:absolute;top:6px;left:6px;font-size:5px;color:#fff;text-shadow:1px 1px 2px #000">HP: 85% | Ammo: 12</div>
      <div style="position:absolute;top:6px;right:6px;font-size:5px;color:#ef4444">Kills: 3</div>
    </div>
  `),

  // ═══════════════════════════════════════════
  // METAVERSE — Additional Previews
  // ═══════════════════════════════════════════
  'metaverse-underwater': base(`
    <div style="height:200px;background:linear-gradient(180deg,#0a3d6e 0%,#06234a 50%,#041a30 100%);position:relative;overflow:hidden">
      ${Array.from({length:8}).map(() => `<div style="position:absolute;top:${Math.random()*150}px;left:${Math.random()*100}%;width:${2+Math.random()*3}px;height:${2+Math.random()*3}px;border-radius:50%;background:#ffffff20"></div>`).join('')}
      <div style="position:absolute;top:30px;left:30px;font-size:10px">🐠</div>
      <div style="position:absolute;top:60px;right:40px;font-size:12px">🐡</div>
      <div style="position:absolute;bottom:20px;left:20px;font-size:8px">🪸</div>
      <div style="position:absolute;bottom:20px;right:30px;font-size:10px">🪸</div>
      <div style="position:absolute;top:6px;left:6px;font-size:6px;font-weight:600;color:#06b6d4">🌊 UNDERWATER</div>
      <div style="position:absolute;bottom:8px;right:8px;font-size:5px;color:#3b82f6">Depth: 45m</div>
    </div>
  `, '#041a30', '#fff'),

  'metaverse-museum': base(`
    <div style="height:200px;background:#f5f0eb;position:relative;overflow:hidden">
      <div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);font-size:8px;font-weight:300;letter-spacing:3px;color:#555">MUSEUM</div>
      <div style="position:absolute;left:0;width:100%;height:120px;top:40px;background:#fff"></div>
      <div style="position:absolute;top:50px;display:flex;gap:20px;left:15px">
        ${[{c:'#e74c3c'},{c:'#3498db'},{c:'#f39c12'},{c:'#2ecc71'}].map(p => `<div style="width:24px;height:32px;background:${p.c};border:2px solid #d4a853"></div>`).join('')}
      </div>
      <div style="position:absolute;bottom:0;width:100%;height:40px;background:#d4c5b5"></div>
    </div>
  `, '#f5f0eb', '#333'),

  'metaverse-nightclub': base(`
    <div style="height:200px;background:#050005;position:relative;overflow:hidden">
      ${[{x:20,c:'#ff00ff'},{x:50,c:'#00ffff'},{x:80,c:'#ff00ff'}].map(l => `<div style="position:absolute;bottom:50px;left:${l.x}%;width:2px;height:60px;background:linear-gradient(0deg,${l.c},transparent);opacity:.6;transform:rotate(${(l.x-50)*0.5}deg)"></div>`).join('')}
      <div style="position:absolute;bottom:0;width:100%;height:50px;display:grid;grid-template-columns:repeat(8,1fr);gap:1px">${Array.from({length:8}).map((_,i) => `<div style="background:hsl(${i*45+Date.now()%360},80%,50%);opacity:.4"></div>`).join('')}</div>
      <div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:radial-gradient(#fff,#888);box-shadow:0 0 20px #fff40"></div>
      <div style="position:absolute;top:6px;left:6px;font-size:6px;font-weight:700;color:#ff00ff">🎵 NIGHTCLUB</div>
    </div>
  `, '#050005', '#fff'),

  'metaverse-marketplace-3d': base(`
    <div style="height:200px;background:#f5f0eb;position:relative;overflow:hidden">
      <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);font-size:8px;font-weight:600;color:#ea580c">🏪 3D Market</div>
      <div style="position:absolute;bottom:0;width:100%;height:40px;background:#d4c5b5"></div>
      <div style="display:flex;gap:8px;position:absolute;top:40px;left:10px">${['🏬','🏬','🏬'].map((s,i) => `<div style="width:30px;height:50px;background:hsl(${i*40+20},30%,85%);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:14px;border:1px solid #d4c5b5">${s}</div>`).join('')}</div>
    </div>
  `, '#f5f0eb', '#333'),

  'metaverse-sports-arena': base(`
    <div style="height:200px;background:#1a3a1a;position:relative;overflow:hidden">
      <div style="position:absolute;inset:20px;background:#2d5016;border:2px solid #fff;border-radius:4px"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:30px;height:30px;border:2px solid #fff;border-radius:50%"></div>
      <div style="position:absolute;top:50%;left:0;right:0;height:2px;background:#fff;transform:translateY(-50%)"></div>
      <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:#00000080;padding:2px 8px;border-radius:3px;font-size:6px;color:#fff;font-weight:700">HOME 2 — 1 AWAY</div>
    </div>
  `, '#1a3a1a', '#fff'),

  'metaverse-zen-garden': base(`
    <div style="height:200px;background:linear-gradient(180deg,#87ceeb 0%,#e8dcc8 50%,#d4c5a0 100%);position:relative;overflow:hidden">
      <div style="position:absolute;bottom:0;width:100%;height:100px;background:#e8dcc8;background-image:repeating-linear-gradient(90deg,transparent,transparent 8px,#d4c5a060 9px,transparent 10px)"></div>
      <div style="position:absolute;bottom:40px;left:30px;font-size:10px">🪨</div>
      <div style="position:absolute;bottom:40px;right:30px;font-size:12px">🎋</div>
      <div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);font-size:8px">🧘</div>
      <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:6px;color:#555;letter-spacing:2px">🍃 ZEN GARDEN</div>
    </div>
  `),

  // ═══════════════════════════════════════════
  // CASINO — Remaining Previews
  // ═══════════════════════════════════════════
  'casino-craps': base(`
    <div style="padding:8px;background:#0a3d0a">
      <div style="text-align:center;font-size:7px;color:#d4a853;margin-bottom:4px">CRAPS</div>
      <div style="display:flex;justify-content:center;gap:6px;margin-bottom:6px"><div style="width:24px;height:24px;background:#fff;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#000">⚃</div><div style="width:24px;height:24px;background:#fff;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#000">⚅</div></div>
      <div style="display:flex;gap:2px;justify-content:center">${['PASS','DONT','FIELD','COME'].map(b => `<div style="padding:2px 6px;background:#1a5e1a;border:1px solid #d4a85340;border-radius:2px;font-size:4px;color:#d4a853">${b}</div>`).join('')}</div>
    </div>
  `, '#0a3d0a', '#fff'),

  'casino-sic-bo': base(`
    <div style="padding:8px;background:#3d0a0a">
      <div style="text-align:center;font-size:7px;color:#d4a853;margin-bottom:4px">SIC BO</div>
      <div style="display:flex;justify-content:center;gap:4px;margin-bottom:6px">${['⚂','⚄','⚁'].map(d => `<div style="width:20px;height:20px;background:#fff;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px">${d}</div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px">${['SMALL','BIG','ODD','EVEN'].map(b => `<div style="text-align:center;padding:3px;background:#5e1a1a;border:1px solid #d4a85340;border-radius:2px;font-size:5px;color:#d4a853">${b}</div>`).join('')}</div>
    </div>
  `, '#3d0a0a', '#fff'),

  'casino-limbo': base(`
    <div style="padding:12px;background:#0a0a0a;text-align:center">
      <div style="font-size:7px;color:#888;margin-bottom:8px">LIMBO</div>
      <div style="font-size:28px;font-weight:800;color:#22c55e;margin-bottom:8px">1.47x</div>
      <div style="background:#111;border-radius:6px;padding:6px;margin-bottom:6px"><div style="font-size:5px;color:#888;margin-bottom:2px">Target: 2.00x</div><div style="font-size:5px;color:#888">Win Chance: 49.5%</div></div>
      <div style="background:#22c55e;padding:3px 12px;border-radius:4px;font-size:7px;font-weight:700;color:#000;display:inline-block">BET</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-tower': base(`
    <div style="padding:8px;background:#0a0a0a">
      <div style="font-size:7px;color:#888;margin-bottom:4px">TOWER — <span style="color:#fbbf24">4.8x</span></div>
      <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:4px">${Array.from({length:6}).map((_,i) => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px">${Array.from({length:3}).map((_,j) => `<div style="height:10px;border-radius:2px;${i>3?'background:#22c55e20;border:1px solid #22c55e':i===3&&j===1?'background:#fbbf2440;border:1px solid #fbbf24':'background:#1a1a1a;border:1px solid #333'}"></div>`).join('')}</div>`).join('')}
      <div style="text-align:center;background:#fbbf24;padding:2px 8px;border-radius:3px;font-size:5px;font-weight:700;color:#000">CASH OUT</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-live-landing': base(`
    <div style="padding:10px;background:#0a0a0a">
      <div style="font-size:8px;font-weight:700;color:#ef4444;margin-bottom:6px">🔴 LIVE CASINO</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">${['🃏 Blackjack','🎡 Roulette','🃏 Baccarat'].map(g => `<div style="background:#1a1a1a;border:1px solid #ef444420;border-radius:4px;padding:6px;text-align:center"><div style="font-size:6px;color:#fff">${g}</div><div style="font-size:4px;color:#ef4444;margin-top:2px">LIVE</div></div>`).join('')}</div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-poker-room': base(`
    <div style="padding:8px;background:#0a3d0a">
      <div style="font-size:7px;color:#d4a853;margin-bottom:6px">🃏 POKER ROOM</div>
      ${[{n:'Table 1',s:'$1/$2 NL',p:'6/9'},{n:'Tournament',s:'$50 Buy-in',p:'124'}].map(t => `<div style="background:#0a2e0a;border:1px solid #d4a85320;border-radius:4px;padding:4px;margin-bottom:3px;display:flex;justify-content:space-between;font-size:5px"><span style="color:#fff">${t.n}</span><span style="color:#d4a853">${t.s}</span><span style="color:#888">${t.p} players</span></div>`).join('')}
    </div>
  `, '#0a3d0a', '#fff'),

  'casino-slots-5reel': base(`
    <div style="padding:8px;background:#0a0a0a;text-align:center">
      <div style="font-size:7px;font-weight:700;color:#fbbf24;margin-bottom:4px">🏛️ PHARAOH SLOTS</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2px;background:#111;border:2px solid #fbbf2430;border-radius:6px;padding:4px">${['👁️','🐍','💎','🏛️','⭐','🐪','👁️','💎','🐍','🏛️','⭐','👁️','🐪','💎','🐍'].map(s => `<div style="background:#1a1a1a;border-radius:2px;padding:3px;font-size:8px">${s}</div>`).join('')}</div>
      <div style="display:flex;gap:3px;justify-content:center;margin-top:4px"><div style="background:linear-gradient(135deg,#fbbf24,#f59e0b);padding:3px 10px;border-radius:3px;font-size:6px;font-weight:700;color:#000">SPIN</div></div>
    </div>
  `, '#0a0a0a', '#fff'),

  'casino-slots-progressive': base(`
    <div style="padding:8px;background:#0a0a1a;text-align:center">
      <div style="font-size:6px;color:#888;margin-bottom:2px">PROGRESSIVE JACKPOT</div>
      <div style="font-size:14px;font-weight:800;background:linear-gradient(135deg,#fbbf24,#ec4899,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px">$2,847,391</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-bottom:4px">${['Mini $50','Minor $500','Major $5K','Grand $$$'].map((j,i) => `<div style="background:#111;border:1px solid ${['#22c55e','#3b82f6','#a855f7','#fbbf24'][i]}30;border-radius:3px;padding:2px;font-size:4px;color:${['#22c55e','#3b82f6','#a855f7','#fbbf24'][i]}">${j}</div>`).join('')}</div>
    </div>
  `, '#0a0a1a', '#fff'),

  'casino-dragon-tiger': base(`
    <div style="padding:10px;background:#3d0a0a;text-align:center">
      <div style="font-size:8px;font-weight:700;color:#d4a853;margin-bottom:6px">🐉 DRAGON TIGER 🐯</div>
      <div style="display:flex;justify-content:space-around;margin-bottom:6px">${[{n:'DRAGON',c:'A♠'},{n:'TIGER',c:'K♥'}].map(s => `<div><div style="font-size:5px;color:#888">${s.n}</div><div style="width:22px;height:30px;background:#fff;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:${s.c.includes('♥')?'#c0392b':'#111'};margin:2px auto">${s.c}</div></div>`).join('')}</div>
      <div style="display:flex;gap:3px;justify-content:center">${['DRAGON','TIE','TIGER'].map((b,i) => `<div style="padding:3px 8px;border-radius:3px;font-size:5px;font-weight:600;${i===0?'background:#ef4444;color:#fff':i===1?'background:#22c55e;color:#fff':'background:#3b82f6;color:#fff'}">${b}</div>`).join('')}</div>
    </div>
  `, '#3d0a0a', '#fff'),

  'casino-andar-bahar': base(`
    <div style="padding:10px;background:#2e1a0a;text-align:center">
      <div style="font-size:8px;font-weight:700;color:#f59e0b;margin-bottom:6px">ANDAR BAHAR</div>
      <div style="width:22px;height:30px;background:#fff;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#c0392b;margin:0 auto 6px;border:2px solid #f59e0b">7♥</div>
      <div style="display:flex;gap:6px;justify-content:center">${['ANDAR','BAHAR'].map((b,i) => `<div style="padding:4px 12px;border-radius:4px;font-size:6px;font-weight:600;background:${i===0?'#3b82f6':'#ef4444'};color:#fff">${b}</div>`).join('')}</div>
    </div>
  `, '#2e1a0a', '#fff'),

  'casino-fish-game': base(`
    <div style="height:200px;background:linear-gradient(180deg,#0a3d6e 0%,#06234a 100%);position:relative;overflow:hidden">
      ${Array.from({length:6}).map(() => `<div style="position:absolute;top:${20+Math.random()*120}px;left:${Math.random()*80}%;width:${2+Math.random()*3}px;height:${2+Math.random()*3}px;border-radius:50%;background:#ffffff10"></div>`).join('')}
      <div style="position:absolute;top:30px;left:20px;font-size:12px">🐟</div>
      <div style="position:absolute;top:60px;right:30px;font-size:14px">🐠</div>
      <div style="position:absolute;top:90px;left:50px;font-size:16px">🦈</div>
      <div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);font-size:10px">🔫</div>
      <div style="position:absolute;top:6px;right:6px;font-size:5px;color:#fbbf24">💰 $120</div>
    </div>
  `, '#06234a', '#fff'),

  'casino-coin-flip-game': base(`
    <div style="padding:12px;background:#0a0a0a;text-align:center">
      <div style="font-size:7px;color:#888;margin-bottom:8px">COIN FLIP</div>
      <div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);margin:0 auto 8px;display:flex;align-items:center;justify-content:center;border:3px solid #d4a853"><span style="font-size:16px;font-weight:800;color:#7c2d12">H</span></div>
      <div style="display:flex;gap:6px;justify-content:center"><div style="background:#3b82f6;padding:4px 12px;border-radius:4px;font-size:7px;font-weight:700;color:#fff">HEADS</div><div style="background:#ef4444;padding:4px 12px;border-radius:4px;font-size:7px;font-weight:700;color:#fff">TAILS</div></div>
    </div>
  `, '#0a0a0a', '#fff'),
}
