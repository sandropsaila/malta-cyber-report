// GitHub Action script — runs server-side daily, writes news.json
// SEARCH STRATEGY: Comprehensive sweep across all Maltese sources

const https = require("https");
const fs    = require("fs");

const SYSTEM_PROMPT = `You are a cybersecurity intelligence analyst specialising in Malta.

Search comprehensively across ALL of the following source categories:

1. MALTESE NEWS PORTALS:
   maltatoday.com.mt, timesofmalta.com, independent.com.mt, theshiftnews.com,
   lovinmalta.com, newsbook.com.mt, maltadaily.mt, tvm.com.mt, illum.com.mt

2. MALTESE REGULATORY AUTHORITY ANNOUNCEMENTS:
   - MGA (Malta Gaming Authority): mga.org.mt — cybersecurity incidents, enforcement, breach notices
   - MFSA (Malta Financial Services Authority): mfsa.mt — circulars, breach reports, DORA/ICT incidents
   - IDPC (Information & Data Protection Commissioner): idpc.org.mt — GDPR breach decisions, fines
   - MDIA (Malta Digital Innovation Authority): mdia.org.mt — digital security incidents
   - MITA (Malta Information Technology Agency): mita.gov.mt — government IT incidents
   - MSS (Malta Security Service): annual reports tabled in Parliament
   - FCID (Financial Crime Investigations Department): police fraud/cybercrime statistics
   - Transport Malta, MTCA, Lands Authority, Identity Malta: any breach notices

3. SOCIAL & PROFESSIONAL NETWORKS:
   - LinkedIn: posts from Maltese cybersecurity professionals, CISO disclosures, authority announcements
   - Facebook: public posts from Maltese organisations announcing breaches or service disruptions
   - Twitter/X: Malta-tagged cybersecurity incidents

4. IGAMING & TECH INDUSTRY SOURCES:
   igamingcapital.mt, igamingbusiness.com, sigma.world, igamingfuture.com, next.io, tribuna.com

5. SECURITY DATABASES & DARK WEB MONITORS:
   HaveIBeenPwned mentions of Maltese companies, BleepingComputer, SecurityWeek,
   The Record, Shodan exposure reports referencing Malta

6. GOOGLE NEWS: broad search for "Malta" + cyberattack/breach/hacked/ransomware/phishing

Return a JSON array of up to 10 recent items. Each must have:
- title: string
- source: string (publication + authority where applicable)
- date: string (e.g. "April 2026")
- url: string
- summary: string (2-3 sentences including authority response if any)
- severity: "critical" | "high" | "medium" | "low"
- sector: string (include authority name if relevant, e.g. "Financial Services (MFSA)")

Today is ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}.
Prioritise incidents from the past 12 months. Return ONLY valid JSON array, no markdown, no preamble.`;

function callAnthropic(apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Today is ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}.
Search ALL of the following for the latest Malta cybersecurity incidents:
- Maltese news portals (maltatoday, timesofmalta, independent, theshiftnews, lovinmalta, newsbook)
- Regulatory bodies: MGA, MFSA, IDPC, MDIA, MITA, MSS, FCID, Transport Malta, MTCA
- LinkedIn and Facebook for Maltese organisation announcements
- iGaming industry sources (igamingcapital, igamingbusiness, sigma.world)
- Google News for "Malta" + cyberattack/breach/hacked/ransomware/phishing
- Security databases: BleepingComputer, SecurityWeek, HaveIBeenPwned Malta mentions
Return results as a JSON array.`
      }]
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          let text = "";
          if (parsed.content) {
            for (const block of parsed.content) {
              if (block.type === "text") text += block.text;
            }
          }
          const match = text.match(/\[[\s\S]*\]/);
          if (!match) throw new Error("No JSON array in response");
          resolve(JSON.parse(match[0]));
        } catch(e) { reject(e); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("No ANTHROPIC_API_KEY set"); process.exit(1); }
  console.log("Searching Malta cyber news across all sources...");
  const items = await callAnthropic(apiKey);
  console.log(`Got ${items.length} items`);
  const output = {
    fetched: new Date().toISOString(),
    count: items.length,
    sources_searched: [
      "maltatoday.com.mt","timesofmalta.com","independent.com.mt","theshiftnews.com",
      "lovinmalta.com","newsbook.com.mt","maltadaily.mt","tvm.com.mt",
      "mga.org.mt","mfsa.mt","idpc.org.mt","mdia.org.mt","mita.gov.mt",
      "MSS Parliamentary Reports","FCID Police Statistics",
      "LinkedIn","Facebook","Twitter/X",
      "igamingcapital.mt","igamingbusiness.com","sigma.world","next.io",
      "BleepingComputer","SecurityWeek","HaveIBeenPwned"
    ],
    items
  };
  fs.writeFileSync("news.json", JSON.stringify(output, null, 2));
  console.log("Wrote news.json");
}

main().catch(e => { console.error(e); process.exit(1); });
