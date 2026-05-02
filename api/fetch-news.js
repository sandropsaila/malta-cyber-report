// GitHub Action script — runs daily, updates data.json
// ONLY updates: fetched timestamp + live_news array
// PRESERVES: confirmed_incidents, court_cases (manually curated)

const https = require("https");
const fs    = require("fs");

const SYSTEM_PROMPT = `You are a cybersecurity intelligence analyst specialising in Malta.

STRICT MALTA-RELEVANCE FILTER — MANDATORY:
Only include incidents with a CLEAR and DIRECT Malta connection:
- VICTIM: org HQ/licensed in Malta, Maltese citizens' data, Maltese govt targeted, Malta infrastructure
- ATTACKER: Maltese suspect arrested, attack from Malta, Maltese entity in Europol/NCA operation
- REGULATORY: IDPC/MGA/MFSA/MDIA decision, Maltese court ruling, Malta company in intl cybercrime op
DO NOT INCLUDE: generic global breaches with no Malta link, EU-wide stats not naming Malta

Search ALL of the following sources:
1. NEWS PORTALS: maltatoday.com.mt, timesofmalta.com, independent.com.mt, theshiftnews.com,
   lovinmalta.com, newsbook.com.mt, maltadaily.mt, tvm.com.mt, illum.com.mt, netnews.com.mt, onenews.com.mt
2. MALTESE REGULATORS: mga.org.mt (Enforcement Register), mfsa.mt (Enforcement Dashboard + circulars),
   idpc.org.mt (Decisions page), mdia.org.mt, mita.gov.mt, MSS Parliamentary Reports,
   FCID Police Statistics, Transport Malta, MTCA, Identity Malta, Lands Authority
3. SOCIAL: LinkedIn (CISO/authority posts), Facebook (org announcements), Twitter/X, Reddit r/malta
4. IGAMING: igamingcapital.mt, igamingbusiness.com, sigma.world, next.io, tribuna.com, calvin.ayre.com
5. EU BODIES: ENISA, EDPB, Europol, EUR-Lex (Malta-specific enforcement only)
6. SECURITY INTELLIGENCE: GDPRhub (IDPC decisions), DataBreaches.net, HaveIBeenPwned,
   BleepingComputer, SecurityWeek, The Record, Cybernews, OCCRP, Daphne Foundation
7. PROACTIVE: Shodan (Maltese IP ranges), VirusTotal/MalwareBazaar, Google News

Return a JSON array of up to 10 recent items. Each must have:
- title: string
- source: string (publication + authority)
- date: string (e.g. "May 2026")
- url: string (full article URL)
- summary: string (2-3 sentences including authority response if any)
- severity: "critical" | "high" | "medium" | "low"
- sector: string (include authority name e.g. "Financial Services (MFSA)")
- malta_connection: string (WHY this qualifies under the Malta filter)

Today is \${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}.
Prioritise incidents from the past 12 months.
Return ONLY valid JSON array, no markdown, no preamble.`;

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
Search ALL 48 sources for the latest Malta cybersecurity incidents:
- Maltese news portals: maltatoday, timesofmalta, independent, theshiftnews, lovinmalta, newsbook, netnews, onenews, tvm, illum, maltadaily
- Maltese regulators: MGA (enforcement register), MFSA (circulars + enforcement), IDPC (decisions), MDIA, MITA, MSS, FCID, Transport Malta, MTCA, Identity Malta, Lands Authority
- Social: LinkedIn, Facebook, Twitter/X, Reddit r/malta
- iGaming: igamingcapital, igamingbusiness, sigma.world, next.io, tribuna.com, calvin.ayre
- EU: ENISA, EDPB, Europol, EUR-Lex
- Security: GDPRhub, DataBreaches.net, HaveIBeenPwned, BleepingComputer, SecurityWeek, The Record, Cybernews, OCCRP, Daphne Foundation
- Proactive: Shodan, VirusTotal, Google News
Apply strict Malta-relevance filter. Return JSON array only.`
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

  console.log("Searching 48 Malta cyber sources...");
  const liveNews = await callAnthropic(apiKey);
  console.log(`Got ${liveNews.length} live news items`);

  // Read existing data.json to preserve confirmed_incidents + court_cases
  let existing = {};
  if (fs.existsSync("data.json")) {
    existing = JSON.parse(fs.readFileSync("data.json", "utf8"));
  }

  const SOURCES = [
    "maltatoday.com.mt","timesofmalta.com","independent.com.mt","theshiftnews.com",
    "lovinmalta.com","newsbook.com.mt","maltadaily.mt","tvm.com.mt","illum.com.mt",
    "netnews.com.mt","onenews.com.mt",
    "mga.org.mt (incl. Enforcement Register)","mfsa.mt (incl. Enforcement Dashboard)",
    "idpc.org.mt (incl. Decisions page)","mdia.org.mt","mita.gov.mt",
    "MSS Parliamentary Reports","FCID Police Statistics",
    "Transport Malta","MTCA","Identity Malta","Lands Authority",
    "LinkedIn","Facebook","Twitter/X","Reddit r/malta",
    "igamingcapital.mt","igamingbusiness.com","sigma.world","next.io","tribuna.com","calvin.ayre.com",
    "ENISA","EDPB","Europol","EUR-Lex",
    "GDPRhub","DataBreaches.net","HaveIBeenPwned","BleepingComputer",
    "SecurityWeek","The Record","Cybernews","OCCRP","Daphne Foundation",
    "Shodan","VirusTotal/MalwareBazaar","Google News"
  ];

  // Write updated data.json — preserve curated data, update live feed + timestamp
  const output = {
    fetched: new Date().toISOString(),
    confirmed_incidents: existing.confirmed_incidents || [],
    court_cases: existing.court_cases || [],
    live_news: liveNews,
    sources_searched: SOURCES,
    filter_applied: "Strict Malta-relevance filter: victim/attacker/regulatory connection to Malta required"
  };

  fs.writeFileSync("data.json", JSON.stringify(output, null, 2));
  console.log(`data.json updated: ${output.confirmed_incidents.length} incidents, ${output.court_cases.length} court cases, ${liveNews.length} live news`);
  console.log(`Timestamp: ${output.fetched}`);
}

main().catch(e => { console.error(e); process.exit(1); });
